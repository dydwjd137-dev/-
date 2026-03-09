// 포트폴리오 관리를 위한 TypeScript 인터페이스
import { CapitalSourceType, CapitalMixEntry } from './capitalSource';
export { CapitalSourceType, CapitalMixEntry };

export type AssetCategory = string; // 배당, 성장, 반도체, 헬스케어, 은행 등 커스텀 카테고리 지원

// 기본 카테고리 상수
export const DEFAULT_CATEGORIES = ['배당', '성장', 'ETF', '한국주식', '미국주식', '코인', '실물자산'] as const;

// 계좌 유형
export type AccountType = 'REGULAR' | 'ISA' | 'PENSION' | 'IRP' | 'RETIREMENT';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  REGULAR: '일반',
  ISA: 'ISA',
  PENSION: '연금저축',
  IRP: 'IRP',
  RETIREMENT: '퇴직연금',
};

export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  REGULAR: '#6B4FFF',
  ISA: '#00C896',
  PENSION: '#FF9500',
  IRP: '#FF6B6B',
  RETIREMENT: '#5AC8FA',
};

// 증권사
export type BrokerageId =
  | 'HANWHA' | 'DB' | 'KB' | 'NAMU' | 'KAKAO' | 'MIRAE'
  | 'SAMSUNG' | 'SHINHAN' | 'NAVER' | 'KIWOOM' | 'TOSS' | 'HANA' | 'KIS' | 'MERITZ';

export interface BrokerageInfo {
  id: BrokerageId;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
}

export const BROKERAGE_LIST: BrokerageInfo[] = [
  { id: 'HANWHA',    name: '한화투자증권',  shortName: '한화',   color: '#FF6600', textColor: '#fff' },
  { id: 'DB',        name: 'DB금융투자',    shortName: 'DB',     color: '#E65C00', textColor: '#fff' },
  { id: 'KB',        name: 'KB증권',        shortName: 'KB',     color: '#FFBE00', textColor: '#1a1a1a' },
  { id: 'NAMU',      name: '나무증권',      shortName: '나무',   color: '#00B250', textColor: '#fff' },
  { id: 'KAKAO',     name: '카카오증권',    shortName: 'kakao', color: '#FFCD00', textColor: '#1A0A00' },
  { id: 'MIRAE',     name: '미래에셋증권',  shortName: '미래에셋', color: '#FF5A1F', textColor: '#fff' },
  { id: 'SAMSUNG',   name: '삼성증권',      shortName: '삼성',   color: '#1428A0', textColor: '#fff' },
  { id: 'SHINHAN',   name: '신한SOL증권',   shortName: '신한',   color: '#0046FF', textColor: '#fff' },
  { id: 'NAVER',     name: '네이버증권',    shortName: '네이버', color: '#03C75A', textColor: '#fff' },
  { id: 'KIWOOM',    name: '키움증권',      shortName: '영웅문', color: '#D01C23', textColor: '#fff' },
  { id: 'TOSS',      name: '토스증권',      shortName: '토스',   color: '#1B64DA', textColor: '#fff' },
  { id: 'HANA',      name: '하나증권',      shortName: '하나1Q', color: '#009B77', textColor: '#fff' },
  { id: 'KIS',       name: '한국투자증권',  shortName: '한투',   color: '#004EA2', textColor: '#fff' },
  { id: 'MERITZ',    name: '메리츠증권',    shortName: '메리츠', color: '#FF1732', textColor: '#fff' },
];

export interface Holding {
  id: string;
  ticker: string; // Yahoo Finance 형식 (예: "AAPL", "005930.KS")
  category: AssetCategory;
  accountType?: AccountType;      // 계좌 유형 (미설정 시 REGULAR로 간주)
  brokerage?: BrokerageId;        // 증권사 (선택)
  capitalSource?: CapitalSourceType; // 단일 재원 (레거시, capitalMix 없을 때 폴백)
  capitalMix?: CapitalMixEntry[];    // 다중 재원 비율 (합산 100%)
  quantity: number;
  purchasePrice: number; // 단위당 매수가 (KRW)
  manualPrice?: number;  // 수동 현재가 설정 (native 통화: USD종목→USD, KRW종목→KRW)
  purchaseExchangeRate?: number; // 매수 시점 USD/KRW 환율 (USD 종목만, 없으면 1350 폴백)
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
  yield: number; // 시가배당률 (%)
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
  dailyProfitLoss: number; // 일간 수익금 (전일 종가 대비)
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
  isOtherAsset?: boolean; // 기타자산 여부 (로고 스킵, % 표시 생략)
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
