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
  dividendsCache: Record<string, DividendInfo[]>
): Promise<EnrichedHolding[]> {
  return holdings.map((holding) => {
    const quote = quotesCache[holding.ticker] || null;
    const dividends = dividendsCache[holding.ticker] || [];

    const currentValue = quote ? quote.priceInKRW * holding.quantity : 0;
    const totalCost = holding.purchasePrice * holding.quantity;
    const profitLoss = currentValue - totalCost;
    const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;

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
  holdings: EnrichedHolding[]
): PortfolioSummary {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfitLoss = totalValue - totalCost;
  const totalProfitLossPercent =
    totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

  // 배당 예상액 계산
  let annualDividend = 0;
  holdings.forEach((h) => {
    h.dividends.forEach((d) => {
      const paymentsPerYear = getPaymentsPerYear(d.frequency);
      annualDividend += d.amount * h.quantity * paymentsPerYear;
    });
  });

  return {
    totalValue,
    totalCost,
    totalProfitLoss,
    totalProfitLossPercent,
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

// 숫자를 KRW 형식으로 포맷 (예: 12,450,000)
export function formatKRW(value: number): string {
  return `₩${Math.round(value).toLocaleString('ko-KR')}`;
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
export function convertKRWToUSD(krwAmount: number): number {
  const exchangeRate = 1350; // USD/KRW 환율
  return krwAmount / exchangeRate;
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
