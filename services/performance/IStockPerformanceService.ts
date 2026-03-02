export type Period = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface CustomRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface StockPerformanceData {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;  // 기간 마지막 종가
  prevClose: number;     // 전일 종가 (기간 마지막-1 캔들)
  startPrice: number;    // 기간 첫 번째 종가 (수익률 기준)
  performancePercent: number;
  sparkline: number[];   // 종가 배열 (오래된 것 → 최신 순)
}

export interface IStockPerformanceService {
  fetchPerformance(
    symbols: string[],
    period: Period,
    customRange?: CustomRange,
  ): Promise<StockPerformanceData[]>;
}
