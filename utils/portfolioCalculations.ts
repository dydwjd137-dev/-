import {
  Holding,
  EnrichedHolding,
  StockQuote,
  DividendInfo,
  PortfolioSummary,
} from '../types/portfolio';

// 보유 종목에 실시간 데이터 결합
export async function enrichHoldings(
  holdings: Holding[],
  quotesCache: Record<string, StockQuote>,
  dividendsCache: Record<string, DividendInfo[]>,
  exchangeRate: number = 1450,
): Promise<EnrichedHolding[]> {
  return holdings.map((holding) => {
    const isKRWTicker = holding.ticker.endsWith('.KS') || holding.ticker.endsWith('.KQ') || holding.ticker.endsWith('.KO');
    let quote = quotesCache[holding.ticker] || null;

    // manualPrice가 설정된 경우 API quote를 덮어씀
    if (holding.manualPrice && holding.manualPrice > 0) {
      const priceInKRW = isKRWTicker ? holding.manualPrice : holding.manualPrice * exchangeRate;
      quote = {
        ticker: holding.ticker,
        currentPrice: holding.manualPrice,
        priceInKRW,
        currency: isKRWTicker ? 'KRW' : 'USD',
        change: 0,
        changePercent: 0,
        marketState: 'CLOSED',
        lastUpdated: new Date(),
      };
    }

    const dividends = dividendsCache[holding.ticker] || [];

    const currentValue = quote ? quote.priceInKRW * holding.quantity : 0;
    const totalCost = holding.purchasePrice * holding.quantity;
    const profitLoss = currentValue - totalCost;

    // USD 종목은 환율 왜곡 없이 달러 기준 수익률 계산
    // 단, purchaseExchangeRate가 저장된 경우(달러 입력 종목)에만 적용
    // 코인처럼 KRW로 입력해 purchaseExchangeRate가 없으면 → KRW 기준 계산
    let profitLossPercent = 0;
    if (totalCost > 0) {
      if (quote && quote.currency !== 'KRW' && holding.purchaseExchangeRate) {
        const purchasePriceNative = holding.purchasePrice / holding.purchaseExchangeRate;
        profitLossPercent = purchasePriceNative > 0
          ? ((quote.currentPrice - purchasePriceNative) / purchasePriceNative) * 100
          : 0;
      } else {
        profitLossPercent = (profitLoss / totalCost) * 100;
      }
    }

    return {
      ...holding,
      quote,
      currentValue,
      totalCost,
      profitLoss,
      profitLossPercent,
      dividends,
    };
  });
}

// 포트폴리오 요약 정보 계산
export function calculatePortfolioSummary(
  holdings: EnrichedHolding[],
  usdKrwRate: number = 1450
): PortfolioSummary {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfitLoss = totalValue - totalCost;
  const totalProfitLossPercent =
    totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

  // 일간 수익금 계산 (전일 종가 대비)
  let dailyProfitLoss = 0;
  holdings.forEach((h) => {
    if (h.quote) {
      // quote.change는 USD 단위의 일간 변화
      // priceInKRW로 환산된 변화 계산: change * (priceInKRW / currentPrice)
      const changeInKRW = h.quote.change * (h.quote.priceInKRW / h.quote.currentPrice);
      dailyProfitLoss += changeInKRW * h.quantity;
    }
  });

  // 배당 예상액 계산 (USD 기준)
  let annualDividend = 0;
  holdings.forEach((h) => {
    h.dividends.forEach((d) => {
      const paymentsPerYear = getPaymentsPerYear(d.frequency);
      const amtUSD = d.currency === 'KRW' ? d.amount / usdKrwRate : d.amount;
      annualDividend += amtUSD * h.quantity * paymentsPerYear;
    });
  });

  return {
    totalValue,
    totalCost,
    totalProfitLoss,
    totalProfitLossPercent,
    dailyProfitLoss,
    monthlyDividendEstimate: annualDividend / 12,
    annualDividendEstimate: annualDividend,
    holdings,
    lastUpdated: new Date(),
  };
}

// 배당 빈도에 따른 연간 지급 횟수
function getPaymentsPerYear(frequency: DividendInfo['frequency']): number {
  switch (frequency) {
    case 'ANNUAL':
      return 1;
    case 'SEMI_ANNUAL':
      return 2;
    case 'QUARTERLY':
      return 4;
    case 'MONTHLY':
      return 12;
  }
}

// 숫자를 KRW 형식으로 포맷 (예: 12,450,000원)
export function formatKRW(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

// 숫자를 USD 형식으로 포맷 (예: $1,234.56)
export function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 카테고리별 표시 통화 결정
export function getDisplayCurrency(category: string): 'KRW' | 'USD' {
  switch (category) {
    case '미국주식':
    case 'ETF':
      return 'USD';
    case '한국주식':
    case '코인':
    case '실물자산':
    default:
      return 'KRW';
  }
}

// KRW 가격을 USD로 환산 (환율 적용)
export function convertKRWToUSD(krwAmount: number, rate = 1350): number {
  return krwAmount / rate;
}

// 카테고리에 맞는 통화로 가격 포맷
export function formatPrice(value: number, category: string): string {
  const currency = getDisplayCurrency(category);
  if (currency === 'USD') {
    return formatUSD(convertKRWToUSD(value));
  }
  return formatKRW(value);
}

// 퍼센트 포맷 (예: +3.75% 또는 -2.1%)
export function formatPercent(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

// 날짜 포맷 (예: 2024.02.20)
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
