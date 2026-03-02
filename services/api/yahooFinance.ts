import { StockQuote, DividendInfo } from '../../types/portfolio';
import { config } from '../../config';

// Twelve Data 프록시 서버 (백엔드) 경유
// 클래스명은 기존 import 호환성을 위해 YahooFinanceService 유지
const BASE_URL = `${config.backendUrl}/api`;

export class YahooFinanceService {
  private usdKrwRate: number = 1450;
  private dividendsCache: Record<string, DividendInfo[]> = {};

  // 외부에서 환율 주입 (PortfolioContext에서 호출)
  setUsdKrwRate(rate: number): void {
    this.usdKrwRate = rate;
    console.log(`💱 Exchange rate updated: 1 USD = ${rate} KRW`);
  }

  // 한국주식 여부 판단 (.KS/.KQ/.KO 접미사 또는 5-6자리 순수 숫자 코드)
  private isKoreanStock(ticker: string): boolean {
    return (
      ticker.endsWith('.KS') ||
      ticker.endsWith('.KQ') ||
      ticker.endsWith('.KO') ||
      /^\d{5,6}$/.test(ticker)
    );
  }

  // Yahoo Finance 티커 → Twelve Data 티커 변환
  // 예: 005930.KS → 005930:KRX, AAPL → AAPL
  private convertTicker(ticker: string): string {
    if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) {
      return `${ticker.split('.')[0]}:KRX`;
    }
    if (ticker.endsWith('.T')) {
      return `${ticker.split('.')[0]}:TSE`;
    }
    if (ticker.endsWith('.HK')) {
      return `${ticker.split('.')[0]}:HKEX`;
    }
    if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) {
      return `${ticker.split('.')[0]}:XSHG`;
    }
    // 코인: Yahoo Finance 형식(BTC-USD, ETH-USD) → Twelve Data 형식(BTC/USD, ETH/USD)
    if (/-USD[T]?$/.test(ticker)) return ticker.replace('-', '/');
    return ticker;
  }

  // Twelve Data API 공통 호출
  private async tdFetch(endpoint: string, params: Record<string, string>): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${endpoint}?${query}`;
    console.log(`🌐 [TwelveData] ${endpoint} | ${Object.entries(params).map(([k,v]) => `${k}=${v}`).join(', ')}`);

    const response = await fetch(url);
    console.log(`📡 Response: ${response.status}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ HTTP ${response.status}:`, text);
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // API 레벨 에러 처리
    if (data.code && data.status === 'error') {
      console.error(`❌ TwelveData error [${data.code}]:`, data.message);
      throw new Error(data.message || 'TwelveData API error');
    }

    return data;
  }

  // 단일 종목 시세 조회 (한국주식: EOD, 기타: /quote)
  async fetchQuote(ticker: string): Promise<StockQuote | null> {
    try {
      if (this.isKoreanStock(ticker)) {
        const eodResults = await this.fetchKoreanBatchEod([ticker]);
        return eodResults[ticker] ?? null;
      }
      const symbol = this.convertTicker(ticker);
      const data = await this.tdFetch('/quote', { symbol });
      return this.parseQuoteData(ticker, data);
    } catch (error) {
      console.error(`❌ fetchQuote(${ticker}):`, error);
      return null;
    }
  }

  // 여러 종목 시세 일괄 조회
  // 한국주식: /time_series EOD 경로 | 기타: /quote 경로
  async fetchBatchQuotes(tickers: string[]): Promise<Record<string, StockQuote>> {
    const results: Record<string, StockQuote> = {};
    if (tickers.length === 0) return results;

    const koreanTickers = tickers.filter(t => this.isKoreanStock(t));
    const otherTickers = tickers.filter(t => !this.isKoreanStock(t));

    // ── 한국주식: EOD (time_series 2일치) ──────────────────────────
    if (koreanTickers.length > 0) {
      const koreanResults = await this.fetchKoreanBatchEod(koreanTickers);
      Object.assign(results, koreanResults);
    }

    // ── 기타 종목: 실시간 /quote ──────────────────────────────────
    if (otherTickers.length > 0) {
      try {
        const symbolMap: Record<string, string> = {};
        otherTickers.forEach(t => { symbolMap[this.convertTicker(t)] = t; });
        const symbols = Object.keys(symbolMap).join(',');

        const data = await this.tdFetch('/quote', { symbol: symbols });

        if (otherTickers.length === 1) {
          const quote = this.parseQuoteData(otherTickers[0], data);
          if (quote) results[otherTickers[0]] = quote;
        } else {
          for (const [convertedSymbol, originalTicker] of Object.entries(symbolMap)) {
            let quoteData = data[convertedSymbol] ?? data[originalTicker];
            if (!quoteData) {
              const upper = convertedSymbol.toUpperCase();
              const found = Object.keys(data).find(k =>
                k.toUpperCase() === upper ||
                k.toUpperCase().startsWith(upper + ':')
              );
              if (found) quoteData = data[found];
            }
            if (!quoteData || quoteData.status === 'error') {
              console.warn(`⚠️ No quote data for ${originalTicker} (${convertedSymbol})`);
              continue;
            }
            const quote = this.parseQuoteData(originalTicker, quoteData);
            if (quote) results[originalTicker] = quote;
          }
        }
      } catch (error) {
        console.error(`❌ fetchBatchQuotes (non-Korean):`, error);
        for (const ticker of otherTickers) {
          const quote = await this.fetchQuote(ticker);
          if (quote) results[ticker] = quote;
        }
      }
    }

    console.log(`✅ Batch quotes: ${Object.keys(results).length}/${tickers.length} 성공`);
    return results;
  }

  // Quote 데이터 파싱
  private parseQuoteData(originalTicker: string, data: any): StockQuote | null {
    if (!data || data.status === 'error' || data.code) return null;

    const currentPrice = parseFloat(data.close || '0');
    if (!currentPrice || currentPrice <= 0) return null;

    const change = parseFloat(data.change || '0');
    const changePercent = parseFloat(data.percent_change || '0');
    const currency = data.currency || 'USD';
    const isMarketOpen = data.is_market_open ?? false;

    console.log(`✅ ${originalTicker}: ${currentPrice} ${currency} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);

    return {
      ticker: originalTicker,
      currentPrice,
      priceInKRW: this.convertToKRW(currentPrice, currency),
      currency,
      change,
      changePercent,
      marketState: isMarketOpen ? 'REGULAR' : 'CLOSED',
      lastUpdated: new Date(),
    };
  }

  // 한국주식 EOD: /time_series 2일치로 현재가 + 전일대비 계산
  private parseTimeSeriesData(originalTicker: string, data: any): StockQuote | null {
    if (!data || data.status === 'error') return null;
    const values: any[] = data.values;
    if (!values || values.length === 0) return null;

    const currentPrice = parseFloat(values[0]?.close || '0');
    if (!currentPrice || currentPrice <= 0) return null;

    const prevClose = values[1] ? parseFloat(values[1].close || '0') : 0;
    const change = prevClose > 0 ? currentPrice - prevClose : 0;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const currency = data.meta?.currency || 'KRW';

    console.log(`✅ [EOD] ${originalTicker}: ${currentPrice} ${currency} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);

    return {
      ticker: originalTicker,
      currentPrice,
      priceInKRW: this.convertToKRW(currentPrice, currency),
      currency,
      change,
      changePercent,
      marketState: 'CLOSED',
      lastUpdated: new Date(),
    };
  }

  // 한국주식 배치 EOD 조회 (/time_series interval=1day, outputsize=2)
  private async fetchKoreanBatchEod(tickers: string[]): Promise<Record<string, StockQuote>> {
    const results: Record<string, StockQuote> = {};
    if (tickers.length === 0) return results;

    const symbolMap: Record<string, string> = {};
    tickers.forEach(t => { symbolMap[this.convertTicker(t)] = t; });
    const symbols = Object.keys(symbolMap).join(',');

    try {
      const data = await this.tdFetch('/time_series', {
        symbol: symbols,
        interval: '1day',
        outputsize: '2',
      });

      if (tickers.length === 1) {
        // 단일 종목: { meta, values, status }
        const quote = this.parseTimeSeriesData(tickers[0], data);
        if (quote) results[tickers[0]] = quote;
      } else {
        // 복수 종목: { "005930:KRX": { meta, values, status }, ... }
        for (const [convertedSymbol, originalTicker] of Object.entries(symbolMap)) {
          const symbolData = data[convertedSymbol];
          if (!symbolData || symbolData.status === 'error') {
            console.warn(`⚠️ [EOD] No time_series for ${originalTicker}`);
            continue;
          }
          const quote = this.parseTimeSeriesData(originalTicker, symbolData);
          if (quote) results[originalTicker] = quote;
        }
      }

      console.log(`✅ [EOD] Korean batch: ${Object.keys(results).length}/${tickers.length} 성공`);
    } catch (error) {
      console.error('❌ fetchKoreanBatchEod 실패, /quote 폴백:', error);
      // 백엔드가 /time_series 미지원 시 /quote 폴백
      for (const ticker of tickers) {
        try {
          const symbol = this.convertTicker(ticker);
          const d = await this.tdFetch('/quote', { symbol });
          const quote = this.parseQuoteData(ticker, d);
          if (quote) results[ticker] = quote;
        } catch {}
      }
    }

    return results;
  }

  // 배당 정보 조회 (캐시 우선, 빈 배열이면 재조회)
  async fetchDividends(ticker: string): Promise<DividendInfo[]> {
    if (this.dividendsCache[ticker]?.length > 0) {
      console.log(`💰 캐시된 배당 반환: ${ticker}`);
      return this.dividendsCache[ticker];
    }
    return this.fetchDividendCalendar(ticker);
  }

  // 배당 캘린더 조회 (Twelve Data /dividends 엔드포인트)
  async fetchDividendCalendar(ticker: string): Promise<DividendInfo[]> {
    try {
      const symbol = this.convertTicker(ticker);
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const startDateStr = startDate.toISOString().split('T')[0];

      console.log(`📡 [dividends] 요청: ${ticker} (${symbol}), start_date=${startDateStr}`);

      const data = await this.tdFetch('/dividends', {
        symbol,
        start_date: startDateStr,
      });

      console.log(`📡 [dividends] 응답 raw:`, JSON.stringify(data).slice(0, 300));

      // API 에러 응답 체크 (code/status 필드가 있는 경우)
      if (data.code || data.status === 'error') {
        console.error(`❌ [dividends] API 에러: code=${data.code}, status=${data.status}, msg=${data.message}`);
        return [];
      }

      const rawDividends: any[] = data.dividends || [];
      console.log(`📡 [dividends] rawDividends.length=${rawDividends.length}`);

      if (rawDividends.length === 0) {
        console.log(`⚠️ 배당 없음: ${ticker}`);
        return [];
      }

      const currency = data.meta?.currency || 'USD';
      const isKorean = ticker.endsWith('.KS') || ticker.endsWith('.KQ') || ticker.endsWith('.KO');

      // 최신순 정렬
      const sorted = [...rawDividends].sort(
        (a, b) => new Date(b.ex_date).getTime() - new Date(a.ex_date).getTime()
      );
      const latest = sorted[0];
      console.log(`📡 [dividends] latest=`, JSON.stringify(latest));

      let amount: number;
      let frequency: DividendInfo['frequency'];

      if (isKorean) {
        // 실제 배당 빈도 계산 (데이터 부족 시 QUARTERLY 기본값)
        const actualFrequency = rawDividends.length >= 2
          ? this.calculateFrequency(rawDividends)
          : 'QUARTERLY';

        // 최근 12개월 실제 지급 합산 → 연간 배당액
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const recentDivs = rawDividends.filter(d => new Date(d.ex_date) >= oneYearAgo);
        const divList = recentDivs.length > 0 ? recentDivs : [latest];
        const annualTotal = divList.reduce((s, d) => {
          const amt = typeof d.amount === 'number' ? d.amount : parseFloat(d.amount || '0');
          return s + amt;
        }, 0);

        // 회당 평균 지급액: amount × paymentsPerYear = 연간합계
        const paymentsPerYear = actualFrequency === 'MONTHLY' ? 12
          : actualFrequency === 'QUARTERLY' ? 4
          : actualFrequency === 'SEMI_ANNUAL' ? 2
          : 1;
        amount = annualTotal / paymentsPerYear;
        frequency = actualFrequency;
        console.log(`📡 [dividends] 한국주식: ${divList.length}건 합산 ${annualTotal}, ${actualFrequency} → 회당 평균 ${amount.toFixed(0)}`);
      } else {
        frequency = this.calculateFrequency(rawDividends);
        amount = typeof latest.amount === 'number' ? latest.amount : parseFloat(latest.amount || '0');
      }

      console.log(`📡 [dividends] amount=${amount}, frequency=${frequency}`);

      if (amount <= 0) {
        console.warn(`⚠️ [dividends] amount <= 0, 빈 배열 반환`);
        return [];
      }

      // 빈도별 다음 배당 예상일
      const monthsAdd = frequency === 'MONTHLY' ? 1
        : frequency === 'QUARTERLY' ? 3
        : frequency === 'SEMI_ANNUAL' ? 6
        : 12;

      const lastExDate = new Date(latest.ex_date);
      const nextExDate = new Date(lastExDate);
      nextExDate.setMonth(nextExDate.getMonth() + monthsAdd);

      const nextPayDate = new Date(nextExDate);
      nextPayDate.setDate(nextPayDate.getDate() + 7);

      const dividend: DividendInfo = {
        ticker,
        exDividendDate: nextExDate,
        paymentDate: nextPayDate,
        amount,
        currency,
        frequency,
        yield: 0,
      };

      this.dividendsCache[ticker] = [dividend];
      console.log(`💰 ${ticker}: $${amount}/주 (${frequency}), 다음 배당 예상: ${nextExDate.toISOString().split('T')[0]}`);
      return [dividend];
    } catch (error) {
      console.error(`❌ fetchDividendCalendar(${ticker}):`, error);
      return [];
    }
  }

  // 배당 빈도 계산 (실제 지급 간격으로 판단)
  private calculateFrequency(dividends: any[]): DividendInfo['frequency'] {
    if (dividends.length < 2) return 'QUARTERLY';

    const sorted = [...dividends].sort(
      (a, b) => new Date(a.ex_date).getTime() - new Date(b.ex_date).getTime()
    );

    const intervals: number[] = [];
    const start = Math.max(0, sorted.length - 4);
    for (let i = start; i < sorted.length - 1; i++) {
      const days =
        (new Date(sorted[i + 1].ex_date).getTime() - new Date(sorted[i].ex_date).getTime())
        / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }

    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avg <= 45) return 'MONTHLY';
    if (avg <= 120) return 'QUARTERLY';
    if (avg <= 240) return 'SEMI_ANNUAL';
    return 'ANNUAL';
  }

  // USD/KRW 환율 조회
  async fetchExchangeRate(): Promise<number | null> {
    try {
      const data = await this.tdFetch('/exchange-rate', { symbol: 'USD/KRW' });
      const rate = data.rate;
      if (rate && rate > 0) {
        console.log(`✅ USD/KRW: ${rate}`);
        return rate;
      }
      return null;
    } catch (error) {
      console.error(`❌ fetchExchangeRate:`, error);
      return null;
    }
  }

  // KRW 환산
  private convertToKRW(amount: number, currency: string): number {
    if (currency === 'KRW') return amount;
    const fixedRates: Record<string, number> = {
      EUR: 1550,
      JPY: 9.5,
      CNY: 185,
      GBP: 1850,
    };
    const rate = currency === 'USD' ? this.usdKrwRate : (fixedRates[currency] || 1);
    return amount * rate;
  }

  // 티커 유효성 검증
  async validateTicker(ticker: string): Promise<boolean> {
    const quote = await this.fetchQuote(ticker);
    return quote !== null;
  }

  // 재시도 로직
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T | null> {
    let lastError: Error | null = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
        }
      }
    }
    console.error(`Failed after ${maxRetries} retries:`, lastError);
    return null;
  }
}
