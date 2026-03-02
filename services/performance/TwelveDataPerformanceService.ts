import { config } from '../../config';
import {
  IStockPerformanceService,
  Period,
  CustomRange,
  StockPerformanceData,
} from './IStockPerformanceService';

const BASE = `${config.backendUrl}/api`;

interface TDCandle {
  datetime: string;
  close: string;
}

interface TDTimeSeriesResponse {
  meta?: { symbol: string; currency: string; exchange_timezone: string };
  values?: TDCandle[];
  status?: string;
  code?: number;
  message?: string;
}

async function fetchTimeSeries(
  symbol: string,
  interval: string,
  params: Record<string, string>,
): Promise<TDTimeSeriesResponse> {
  const qs = new URLSearchParams({ symbol, interval, ...params }).toString();
  const res = await fetch(`${BASE}/time_series?${qs}`);
  return res.json() as Promise<TDTimeSeriesResponse>;
}

function periodToParams(
  period: Period,
  customRange?: CustomRange,
): { interval: string; extra: Record<string, string> } {
  switch (period) {
    case 'daily':
      // 1주(5영업일) 일봉
      return { interval: '1day', extra: { outputsize: '7' } };
    case 'weekly':
      // 4주(20영업일) 일봉
      return { interval: '1day', extra: { outputsize: '22' } };
    case 'monthly':
      // 3개월 일봉
      return { interval: '1day', extra: { outputsize: '66' } };
    case 'custom': {
      const start = customRange?.startDate ?? '';
      const end   = customRange?.endDate   ?? '';
      return { interval: '1day', extra: { start_date: start, end_date: end } };
    }
  }
}

export class TwelveDataPerformanceService implements IStockPerformanceService {
  async fetchPerformance(
    symbols: string[],
    period: Period,
    customRange?: CustomRange,
  ): Promise<StockPerformanceData[]> {
    if (symbols.length === 0) return [];

    const { interval, extra } = periodToParams(period, customRange);

    const results = await Promise.allSettled(
      symbols.map(sym => fetchTimeSeries(sym, interval, extra)),
    );

    const output: StockPerformanceData[] = [];

    results.forEach((result, idx) => {
      const symbol = symbols[idx];
      if (result.status === 'rejected') return;

      const data = result.value;
      if (!data.values || data.values.length === 0) return;

      // Twelve Data returns newest-first; reverse to oldest→newest
      const candles = [...data.values].reverse();
      const sparkline = candles.map(c => parseFloat(c.close));

      if (sparkline.length < 2) return;

      const startPrice   = sparkline[0];
      const currentPrice = sparkline[sparkline.length - 1];
      const prevClose    = sparkline[sparkline.length - 2] ?? currentPrice;
      const performancePercent =
        startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

      output.push({
        symbol,
        name: data.meta?.symbol ?? symbol,
        currency: data.meta?.currency ?? 'USD',
        currentPrice,
        prevClose,
        startPrice,
        performancePercent,
        sparkline,
      });
    });

    // 수익률 내림차순 정렬
    return output.sort((a, b) => b.performancePercent - a.performancePercent);
  }
}

export const stockPerformanceService = new TwelveDataPerformanceService();
