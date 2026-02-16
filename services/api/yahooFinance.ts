import { StockQuote, DividendInfo } from '../../types/portfolio';
import { config } from '../../config';

// React Native 호환 Yahoo Finance API 서비스
// RapidAPI를 통한 Yahoo Finance 데이터 조회
export class YahooFinanceService {
  // RapidAPI 설정
  private rapidApiKey = config.rapidApi.key;
  private rapidApiHost = config.rapidApi.host;
  private baseUrl = `https://${config.rapidApi.host}/api/yahoo`;

  // RapidAPI 헤더 생성
  private getRapidApiHeaders(): HeadersInit {
    return {
      'X-RapidAPI-Key': this.rapidApiKey,
      'X-RapidAPI-Host': this.rapidApiHost,
    };
  }

  // 단일 종목 시세 조회
  async fetchQuote(ticker: string): Promise<StockQuote | null> {
    try {
      // Try multiple endpoint formats
      const endpoints = [
        `${this.baseUrl}/qu/quote/${ticker}`,
        `${this.baseUrl}/quote/${ticker}`,
        `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${ticker}`,
      ];

      console.log(`🔍 [RapidAPI] Fetching quote for ${ticker}`);
      console.log(`📍 API Host: ${this.rapidApiHost}`);
      console.log(`🔑 API Key (first 10 chars): ${this.rapidApiKey.substring(0, 10)}...`);

      for (const url of endpoints) {
        try {
          console.log(`🌐 Trying endpoint: ${url}`);

          const response = await fetch(url, {
            method: 'GET',
            headers: this.getRapidApiHeaders(),
          });

          console.log(`📡 Response status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API error for ${url}:`, errorText);
            continue; // Try next endpoint
          }

          const data = await response.json();
          console.log(`📊 RapidAPI response for ${ticker}:`, JSON.stringify(data, null, 2));

          // Try to extract price data from various response formats
          const currentPrice = data.regularMarketPrice || data.price || data.currentPrice || data.lastPrice || 0;
          const currency = data.currency || data.currencySymbol || 'USD';

          if (currentPrice && currentPrice > 0) {
            console.log(`✅ Successfully fetched ${ticker}: ${currentPrice} ${currency}`);

            return {
              ticker: data.symbol || ticker,
              currentPrice,
              priceInKRW: await this.convertToKRW(currentPrice, currency),
              currency,
              change: data.regularMarketChange || data.change || 0,
              changePercent: data.regularMarketChangePercent || data.changePercent || 0,
              marketState: data.marketState || 'CLOSED',
              lastUpdated: new Date(),
            };
          }
        } catch (endpointError) {
          console.error(`❌ Error with endpoint ${url}:`, endpointError);
          continue; // Try next endpoint
        }
      }

      console.error(`❌ All endpoints failed for ${ticker}`);
      return null;
    } catch (error) {
      console.error(`❌ Error fetching quote for ${ticker}:`, error);
      return null;
    }
  }

  // 여러 종목 시세 일괄 조회 (RapidAPI는 개별 요청으로 처리)
  async fetchBatchQuotes(
    tickers: string[]
  ): Promise<Record<string, StockQuote>> {
    const results: Record<string, StockQuote> = {};

    if (tickers.length === 0) return results;

    console.log('🔍 Fetching quotes for tickers:', tickers.join(', '));

    // 각 티커를 개별적으로 조회
    for (const ticker of tickers) {
      try {
        const quote = await this.fetchQuote(ticker);
        if (quote) {
          results[ticker] = quote;
          console.log(`✅ Successfully fetched ${ticker}: $${quote.currentPrice}`);
        } else {
          console.log(`⚠️ No quote data for ${ticker}`);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${ticker}:`, error);
      }
    }

    console.log(`✅ Successfully fetched ${Object.keys(results).length}/${tickers.length} quotes`);
    return results;
  }

  // 배당 정보 조회 (간단한 버전 - quote 데이터에서 배당률 추출)
  async fetchDividends(ticker: string): Promise<DividendInfo[]> {
    try {
      const quote = await this.fetchQuote(ticker);
      const dividends: DividendInfo[] = [];

      if (!quote) {
        return dividends;
      }

      // 임시: 배당 정보는 별도 엔드포인트가 필요하므로 일단 빈 배열 반환
      // RapidAPI의 다른 엔드포인트를 사용하거나 추후 구현
      console.log(`💰 Dividend info not available for ${ticker} (requires additional endpoint)`);

      return dividends;
    } catch (error) {
      console.error(`Error fetching dividends for ${ticker}:`, error);
      return [];
    }
  }

  // KRW 환산 (고정 환율 사용)
  private async convertToKRW(
    amount: number,
    currency: string
  ): Promise<number> {
    if (currency === 'KRW' || currency === 'KRw') {
      console.log(`💱 Currency is already KRW: ${amount}`);
      return amount;
    }

    // 고정 환율 사용 (API 쿼터 절약)
    const exchangeRates: Record<string, number> = {
      USD: 1350,
      EUR: 1450,
      JPY: 9.5,
      CNY: 185,
      GBP: 1650,
    };

    const rate = exchangeRates[currency] || 1;
    const converted = amount * rate;
    console.log(`💱 Converted ${amount} ${currency} to ${converted} KRW (rate: ${rate})`);
    return converted;
  }

  // 배당 빈도 추정
  private determineDividendFrequency(
    dividendYield: number
  ): DividendInfo['frequency'] {
    // 실제로는 과거 배당 이력을 조회해야 정확하지만, 기본값으로 분기 배당 가정
    return 'QUARTERLY';
  }

  // 티커 유효성 검증
  async validateTicker(ticker: string): Promise<boolean> {
    try {
      const quote = await this.fetchQuote(ticker);
      return quote !== null;
    } catch {
      return false;
    }
  }

  // 재시도 로직을 포함한 안전한 API 호출
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
