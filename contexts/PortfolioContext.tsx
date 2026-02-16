import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  Holding,
  EnrichedHolding,
  PortfolioSummary,
} from '../types/portfolio';
import { HoldingsStorage } from '../services/storage/holdingsStorage';
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
  addHolding: (
    holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  updateHolding: (id: string, updates: Partial<Holding>) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  refreshPrices: () => Promise<void>;
  validateTicker: (ticker: string) => Promise<boolean>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(
  undefined
);

const storage = new HoldingsStorage();
const yahooAPI = new YahooFinanceService();

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 앱 시작 시 보유 종목 로드
  useEffect(() => {
    loadHoldings();
  }, []);

  // AsyncStorage에서 보유 종목 로드
  async function loadHoldings() {
    setIsLoading(true);
    setError(null);
    try {
      const rawHoldings = await storage.getAllHoldings();
      const quotesCache = await storage.getQuotesCache();
      const dividendsCache = await storage.getDividendsCache();

      const enriched = await enrichHoldings(
        rawHoldings,
        quotesCache,
        dividendsCache
      );
      setHoldings(enriched);
      setSummary(calculatePortfolioSummary(enriched));
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

      console.log('🔄 Refreshing prices from Yahoo Finance...');
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
      await loadHoldings();
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
      await loadHoldings();
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

      const tickers = rawHoldings.map((h) => h.ticker);

      // 모든 종목의 시세 일괄 조회
      console.log('Fetching quotes for:', tickers);
      const quotes = await yahooAPI.fetchBatchQuotes(tickers);
      await storage.saveQuotesCache(quotes);

      // 각 종목의 배당 정보 조회
      console.log('Fetching dividends...');
      const dividendsMap: Record<string, any[]> = {};
      for (const ticker of tickers) {
        try {
          const divs = await yahooAPI.fetchDividends(ticker);
          dividendsMap[ticker] = divs;
        } catch (err) {
          console.error(`Failed to fetch dividends for ${ticker}:`, err);
          dividendsMap[ticker] = [];
        }
      }
      await storage.saveDividendsCache(dividendsMap);

      await storage.updateLastRefresh();
      await loadHoldings();
      console.log('Refresh completed');
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
