// 포트폴리오 관리를 위한 TypeScript 인터페이스

export type AssetCategory = 'ETF' | '한국주식' | '미국주식' | '코인' | '실물자산';

export interface Holding {
  id: string;
  ticker: string; // Yahoo Finance 형식 (예: "AAPL", "005930.KS")
  category: AssetCategory;
  quantity: number;
  purchasePrice: number; // 단위당 매수가 (KRW)
  purchaseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockQuote {
  ticker: string;
  currentPrice: number; // 원래 통화 기준
  priceInKRW: number; // KRW로 환산된 가격
  currency: string;
  change: number; // 가격 변동
  changePercent: number; // 변동률 (%)
  marketState: 'PRE' | 'REGULAR' | 'POST' | 'CLOSED';
  lastUpdated: Date;
}

export interface DividendInfo {
  ticker: string;
  exDividendDate: Date;
  paymentDate: Date;
  amount: number; // 주당 배당금
  currency: string;
  frequency: 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY';
}

export interface EnrichedHolding extends Holding {
  quote: StockQuote | null;
  currentValue: number; // quantity * currentPriceInKRW
  totalCost: number; // quantity * purchasePrice
  profitLoss: number; // currentValue - totalCost
  profitLossPercent: number; // ((currentValue - totalCost) / totalCost) * 100
  dividends: DividendInfo[];
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  monthlyDividendEstimate: number;
  annualDividendEstimate: number;
  holdings: EnrichedHolding[];
  lastUpdated: Date;
}

export interface HeatmapBox {
  ticker: string;
  category: AssetCategory;
  value: number; // 현재 가치 (KRW)
  changePercent: number;
  size: 'tiny' | 'small' | 'medium' | 'large';
  color: string; // 배경색 (성과 기반)
}

export interface DividendCalendarEvent {
  id: string;
  ticker: string;
  stockName: string;
  date: Date; // 지급일
  amount: number; // 총 배당금 (주당 * 수량)
  currency: string;
  status: 'upcoming' | 'paid';
}
