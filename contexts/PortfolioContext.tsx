import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { config } from '../config';
import {
  Holding,
  EnrichedHolding,
  PortfolioSummary,
} from '../types/portfolio';
import { HoldingsStorage } from '../services/storage/holdingsStorage';
import { saveSnapshot } from '../services/storage/snapshotStorage';
import { backfillSnapshots } from '../services/storage/snapshotBackfill';
import { YahooFinanceService } from '../services/api/yahooFinance';
import {
  enrichHoldings,
  calculatePortfolioSummary,
} from '../utils/portfolioCalculations';

interface PortfolioContextType {
  holdings: EnrichedHolding[];
  summary: PortfolioSummary | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  exchangeRate: number; // USD → KRW
  addHolding: (
    holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateHolding: (id: string, updates: Partial<Holding>) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  refreshPrices: () => Promise<void>;
  validateTicker: (ticker: string) => Promise<boolean>;
  snapshotVersion: number; // 백필 완료 시 증가 → 성과 탭 재로드 트리거
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(
  undefined
);

const storage = new HoldingsStorage();
const yahooAPI = new YahooFinanceService();

// ── WS 헬퍼 ──────────────────────────────────────────
// Yahoo Finance 형식 → Twelve Data 형식 변환
function yahooToTD(ticker: string): string {
  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return `${ticker.split('.')[0]}:KRX`;
  if (ticker.endsWith('.T'))  return `${ticker.split('.')[0]}:TSE`;
  if (ticker.endsWith('.HK')) return `${ticker.split('.')[0]}:HKEX`;
  if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) return `${ticker.split('.')[0]}:XSHG`;
  // 코인: Yahoo Finance 형식(BTC-USD) → Twelve Data 형식(BTC/USD)
  if (/-USD[T]?$/.test(ticker)) return ticker.replace('-', '/');
  return ticker;
}

// WS 핸들러 내부용 KRW 환산 (YahooFinanceService.convertToKRW 복사)
function wsConvertToKRW(amount: number, currency: string, usdKrwRate: number): number {
  if (currency === 'KRW') return amount;
  const fixedRates: Record<string, number> = { EUR: 1550, JPY: 9.5, CNY: 185, GBP: 1850 };
  const rate = currency === 'USD' ? usdKrwRate : (fixedRates[currency] ?? 1);
  return amount * rate;
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1450);
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  // ── 포트폴리오 실시간 WS ──
  const wsRef           = useRef<WebSocket | null>(null);
  const prevCloseRef    = useRef<Record<string, number>>({});  // yahooTicker → prevClose
  const exchangeRateRef = useRef<number>(1450);                // WS 핸들러용 최신 환율
  const tickersRef      = useRef<string[]>([]);                // WS 핸들러용 최신 티커 목록
  const subscribedRef   = useRef<Set<string>>(new Set());      // 이미 구독된 TD 심볼 (중복 크레딧 방지)

  const connectPortfolioWS = useCallback((yahooTickers: string[]) => {
    tickersRef.current = yahooTickers;

    if (yahooTickers.length === 0) {
      wsRef.current?.close();
      wsRef.current = null;
      subscribedRef.current.clear();
      return;
    }

    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN) {
      // 이미 연결 중: 아직 구독 안 된 신규 심볼만 추가 구독
      const newSyms = yahooTickers
        .map(yahooToTD)
        .filter(s => !subscribedRef.current.has(s));
      if (newSyms.length > 0) {
        wsRef.current!.send(JSON.stringify({ action: 'subscribe', params: { symbols: newSyms.join(',') } }));
        newSyms.forEach(s => subscribedRef.current.add(s));
        console.log('[PortfolioWS] added subscriptions:', newSyms);
      }
      return;
    }
    if (state === WebSocket.CONNECTING) return;

    subscribedRef.current.clear();
    const wsUrl = config.backendUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const syms = tickersRef.current.map(yahooToTD);
      ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: syms.join(',') } }));
      syms.forEach(s => subscribedRef.current.add(s));
      console.log('[PortfolioWS] subscribed:', syms);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.event !== 'price') return;

        const tdSym: string = msg.symbol;
        const newPrice = parseFloat(msg.price);
        if (isNaN(newPrice)) return;

        // TD 심볼 → Yahoo 티커 역변환
        const yahooTicker = tickersRef.current.find(t => yahooToTD(t) === tdSym) ?? tdSym;
        const prev   = prevCloseRef.current[yahooTicker] ?? 0;
        const change = prev > 0 ? newPrice - prev : 0;
        const pct    = prev > 0 ? (change / prev) * 100 : 0;

        setHoldings(prevHoldings => {
          const updated = prevHoldings.map(h => {
            if (h.ticker !== yahooTicker || !h.quote) return h;
            const priceInKRW   = wsConvertToKRW(newPrice, h.quote.currency, exchangeRateRef.current);
            const currentValue = h.quantity * priceInKRW;
            const profitLoss   = currentValue - h.totalCost;

            // enrichHoldings와 동일 로직: purchaseExchangeRate가 있는 USD 종목만 달러 기준
            // 코인(KRW 입력, purchaseExchangeRate 없음)은 KRW 기준으로 계산
            let profitLossPercent = 0;
            if (h.totalCost > 0) {
              if (h.quote.currency !== 'KRW' && h.purchaseExchangeRate) {
                const purchasePriceNative = h.purchasePrice / h.purchaseExchangeRate;
                profitLossPercent = purchasePriceNative > 0
                  ? ((newPrice - purchasePriceNative) / purchasePriceNative) * 100
                  : 0;
              } else {
                profitLossPercent = (profitLoss / h.totalCost) * 100;
              }
            }
            return {
              ...h,
              quote: { ...h.quote, currentPrice: newPrice, change, changePercent: pct, priceInKRW, lastUpdated: new Date() },
              currentValue,
              profitLoss,
              profitLossPercent,
            };
          });
          setSummary(calculatePortfolioSummary(updated, exchangeRateRef.current));
          return updated;
        });
      } catch {}
    };

    ws.onerror = (e) => console.warn('[PortfolioWS] error:', e);
    ws.onclose = () => {
      console.log('[PortfolioWS] closed');
      subscribedRef.current.clear();
    };
  }, []);

  // 앱 시작 시 보유 종목 로드
  useEffect(() => {
    loadHoldings();
    // 캐시된 환율 로드 + 빠진 날짜 백필
    storage.getExchangeRate().then((cached) => {
      if (cached) {
        exchangeRateRef.current = cached.rate;
        setExchangeRate(cached.rate);
        yahooAPI.setUsdKrwRate(cached.rate);
        // 앱을 오랫동안 안 열었을 때 과거 스냅샷 자동 채우기
        storage.getAllHoldings().then(holdings => {
          backfillSnapshots(holdings, cached.rate)
            .then(() => setSnapshotVersion(v => v + 1))
            .catch(() => {});
        });
      }
    });
  }, []);

  // WS 정리 (언마운트 시)
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  // AsyncStorage에서 보유 종목 로드
  // silent=true이면 isLoading 스피너 없이 조용히 재로드 (삭제/수정 후 사용)
  async function loadHoldings(silent = false) {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const rawHoldings = await storage.getAllHoldings();
      const quotesCache = await storage.getQuotesCache();
      const dividendsCache = await storage.getDividendsCache();

      // 전일종가 저장 (WS 변동률 계산용)
      rawHoldings.forEach(h => {
        const q = quotesCache[h.ticker];
        if (q) prevCloseRef.current[h.ticker] = q.currentPrice - q.change;
      });

      const enriched = await enrichHoldings(
        rawHoldings,
        quotesCache,
        dividendsCache,
        exchangeRateRef.current,
      );
      setHoldings(enriched);
      const computedSummary = calculatePortfolioSummary(enriched, exchangeRateRef.current);
      setSummary(computedSummary);

      // 스냅샷 저장 (시세 데이터가 있는 경우만)
      if (enriched.some(h => h.quote !== null) && computedSummary.totalValue > 0) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        saveSnapshot({
          date: today,
          totalValue:  computedSummary.totalValue,
          totalCost:   computedSummary.totalCost,
          totalProfit: computedSummary.totalProfitLoss,
          holdings: enriched
            .filter(h => h.quote !== null)
            .map(h => ({ symbol: h.ticker, value: h.currentValue, profit: h.profitLoss })),
        }).catch(() => {});
      }

      // 실시간 WS 연결/재구독
      connectPortfolioWS(rawHoldings.map(h => h.ticker));
    } catch (err) {
      setError('보유 종목을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // 보유 종목 추가
  async function addHolding(
    holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>
  ) {
    try {
      console.log('📝 Adding holding to storage:', holding);
      await storage.addHolding(holding);

      console.log('📖 Loading holdings from storage...');
      await loadHoldings();

      console.log('🔄 Refreshing prices from Twelve Data...');
      await refreshPrices();

      console.log('✅ Holding added successfully!');
    } catch (err) {
      setError('종목 추가에 실패했습니다.');
      console.error('❌ Add holding error:', err);
      throw err;
    }
  }

  // 보유 종목 수정
  async function updateHolding(id: string, updates: Partial<Holding>) {
    try {
      await storage.updateHolding(id, updates);
      await loadHoldings(true); // silent: 로딩 스피너 없이 재로드
    } catch (err) {
      setError('종목 수정에 실패했습니다.');
      console.error(err);
      throw err;
    }
  }

  // 보유 종목 삭제
  async function deleteHolding(id: string) {
    try {
      await storage.deleteHolding(id);
      await loadHoldings(true); // silent: 로딩 스피너 없이 재로드
    } catch (err) {
      setError('종목 삭제에 실패했습니다.');
      console.error(err);
      throw err;
    }
  }


  // 시세 새로고침
  async function refreshPrices() {
    setIsRefreshing(true);
    setError(null);
    try {
      const rawHoldings = await storage.getAllHoldings();

      if (rawHoldings.length === 0) {
        setIsRefreshing(false);
        return;
      }

      // 환율 갱신 (새로고침마다 실시간 갱신)
      const newRate = await yahooAPI.fetchExchangeRate();
      if (newRate) {
        await storage.saveExchangeRate(newRate);
        yahooAPI.setUsdKrwRate(newRate);
        exchangeRateRef.current = newRate;
        setExchangeRate(newRate);
      }

      const tickers = rawHoldings.map((h) => h.ticker);

      // 모든 종목의 시세 일괄 조회
      console.log('Fetching quotes for:', tickers);
      const quotes = await yahooAPI.fetchBatchQuotes(tickers);
      await storage.saveQuotesCache(quotes);

      // 각 종목의 배당 정보 조회 (인메모리 캐시 무시하고 항상 API 재조회)
      // Rate limit 방지: quote 호출 후 1초 대기
      await new Promise((r) => setTimeout(r, 1000));
      console.log('Fetching dividends...');
      const dividendsMap: Record<string, any[]> = {};
      for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        try {
          const divs = await yahooAPI.fetchDividendCalendar(ticker);
          dividendsMap[ticker] = divs;
          console.log(`💰 ${ticker} dividends: ${divs.length}개`);
        } catch (err) {
          console.error(`Failed to fetch dividends for ${ticker}:`, err);
          dividendsMap[ticker] = [];
        }
        // 종목 간 500ms 간격
        if (i < tickers.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      await storage.saveDividendsCache(dividendsMap);

      await storage.updateLastRefresh();
      await loadHoldings();
      console.log('Refresh completed');
      // 새로고침 후 백그라운드로 빠진 날짜 스냅샷 자동 채우기
      backfillSnapshots(rawHoldings, exchangeRateRef.current)
        .then(() => setSnapshotVersion(v => v + 1))
        .catch(() => {});
    } catch (err) {
      setError('시세 업데이트에 실패했습니다.');
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  }

  // 티커 유효성 검증
  async function validateTicker(ticker: string): Promise<boolean> {
    try {
      return await yahooAPI.validateTicker(ticker);
    } catch (err) {
      console.error('Ticker validation error:', err);
      return false;
    }
  }

  return (
    <PortfolioContext.Provider
      value={{
        holdings,
        summary,
        isLoading,
        isRefreshing,
        error,
        exchangeRate,
        snapshotVersion,
        addHolding,
        updateHolding,
        deleteHolding,
        refreshPrices,
        validateTicker,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

// Custom Hook
export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within PortfolioProvider');
  }
  return context;
}
