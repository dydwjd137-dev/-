/**
 * engine/performanceEngine.ts
 *
 * Snapshot-based portfolio return calculation engine.
 * All functions are PURE — no side effects, no AsyncStorage access, no UI state.
 *
 * Calculation model:
 *   A) Cumulative  : (currentValue - totalCost) / totalCost
 *   B) Daily       : lastSnapshot.totalValue  - prevSnapshot.totalValue
 *   C) Period      : latestSnapshot.totalValue - snapshotFromPeriodAgo.totalValue
 *   D) Per-asset   : today.holding.value - yesterday.holding.value
 *
 * NOT implemented (by design):
 *   - FIFO / lot tracking
 *   - Money-weighted return (MWR / IRR)
 *   - Tax or settlement logic
 */

import { PortfolioSnapshot } from '../services/storage/snapshotStorage';

// ── Output Types ──────────────────────────────────────────────

/** A) 누적 수익률 */
export interface CumulativeReturn {
  totalCost: number;      // 총 투자원금 (KRW)
  totalValue: number;     // 총 평가금액 (KRW)
  valueChange: number;    // totalValue - totalCost
  percentChange: number;  // valueChange / totalCost × 100
}

/** B / C) 기간 수익률 */
export interface ReturnResult {
  valueChange: number;    // latest.totalValue - prev.totalValue (KRW)
  profitChange: number;   // latest.totalProfit - prev.totalProfit (KRW)
  percentChange: number;  // valueChange / prev.totalValue × 100
  hasData: boolean;
  fromDate: string;       // YYYY-MM-DD
  toDate: string;         // YYYY-MM-DD
}

/** D) 종목별 일간 기여 */
export interface AssetContribution {
  symbol: string;
  valueChange: number;    // today.value - yesterday.value (KRW)
  percentChange: number;  // valueChange / yesterday.value × 100
}

// ── Internal Helpers ──────────────────────────────────────────

function noData(): ReturnResult {
  return { valueChange: 0, profitChange: 0, percentChange: 0, hasData: false, fromDate: '', toDate: '' };
}

function sortAsc(snapshots: PortfolioSnapshot[]): PortfolioSnapshot[] {
  return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * targetDate 이하인 스냅샷 중 가장 최근 것 반환.
 * snapshots 는 날짜 오름차순 전제.
 */
function atOrBefore(snaps: PortfolioSnapshot[], targetDate: string): PortfolioSnapshot | null {
  let result: PortfolioSnapshot | null = null;
  for (const s of snaps) {
    if (s.date <= targetDate) result = s;
    else break;
  }
  return result;
}

/** 날짜 문자열에서 N일 뺀 날짜 반환 (로컬 기준, noon 파싱으로 DST 안전) */
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 날짜 문자열에서 N개월 뺀 날짜 반환 */
function subtractMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function compute(current: PortfolioSnapshot, previous: PortfolioSnapshot): ReturnResult {
  const valueChange   = current.totalValue  - previous.totalValue;
  const profitChange  = current.totalProfit - previous.totalProfit;
  const percentChange = previous.totalValue > 0 ? (valueChange / previous.totalValue) * 100 : 0;
  return { valueChange, profitChange, percentChange, hasData: true, fromDate: previous.date, toDate: current.date };
}

// ── Public API ────────────────────────────────────────────────

/**
 * A) Cumulative Return
 *
 *   cumulativeReturn = (currentTotalValue - totalInvestedCapital) / totalInvestedCapital
 *
 * Uses the most recent snapshot's totalCost as invested capital.
 */
export function getCumulativeReturn(snapshot: PortfolioSnapshot): CumulativeReturn {
  const valueChange   = snapshot.totalValue - snapshot.totalCost;
  const percentChange = snapshot.totalCost > 0 ? (valueChange / snapshot.totalCost) * 100 : 0;
  return {
    totalCost: snapshot.totalCost,
    totalValue: snapshot.totalValue,
    valueChange,
    percentChange,
  };
}

/**
 * B) Daily Return
 *
 *   dailyChangeValue   = todaySnapshot.totalValue - yesterdaySnapshot.totalValue
 *   dailyReturnPercent = dailyChangeValue / yesterdaySnapshot.totalValue
 *
 * Uses the two most recent snapshots by date.
 * Returns noData if fewer than 2 snapshots exist.
 */
export function getDailyReturn(snapshots: PortfolioSnapshot[]): ReturnResult {
  const s = sortAsc(snapshots);
  if (s.length < 2) return noData();
  return compute(s[s.length - 1], s[s.length - 2]);
}

/**
 * C) Weekly Return
 *
 *   periodChangeValue   = latestSnapshot.totalValue - snapshotFrom7DaysAgo.totalValue
 *   periodReturnPercent = periodChangeValue / snapshotFrom7DaysAgo.totalValue
 *
 * If exact date not found, uses closest earlier snapshot.
 */
export function getWeeklyReturn(snapshots: PortfolioSnapshot[]): ReturnResult {
  const s = sortAsc(snapshots);
  if (s.length < 2) return noData();
  const current  = s[s.length - 1];
  const target   = subtractDays(current.date, 7);
  const previous = atOrBefore(s.slice(0, -1), target);
  if (!previous) return noData();
  return compute(current, previous);
}

/**
 * C) Monthly Return
 *
 *   periodChangeValue   = latestSnapshot.totalValue - snapshotFrom1MonthAgo.totalValue
 *   periodReturnPercent = periodChangeValue / snapshotFrom1MonthAgo.totalValue
 *
 * If exact date not found, uses closest earlier snapshot.
 */
export function getMonthlyReturn(snapshots: PortfolioSnapshot[]): ReturnResult {
  const s = sortAsc(snapshots);
  if (s.length < 2) return noData();
  const current  = s[s.length - 1];
  const target   = subtractMonths(current.date, 1);
  const previous = atOrBefore(s.slice(0, -1), target);
  if (!previous) return noData();
  return compute(current, previous);
}

/**
 * C) Yearly Return
 *
 *   periodChangeValue   = latestSnapshot.totalValue - snapshotFrom365DaysAgo.totalValue
 *   periodReturnPercent = periodChangeValue / snapshotFrom365DaysAgo.totalValue
 *
 * If exact date not found, uses closest earlier snapshot.
 */
export function getYearlyReturn(snapshots: PortfolioSnapshot[]): ReturnResult {
  const s = sortAsc(snapshots);
  if (s.length < 2) return noData();
  const current  = s[s.length - 1];
  const target   = subtractDays(current.date, 365);
  const previous = atOrBefore(s.slice(0, -1), target);
  if (!previous) return noData();
  return compute(current, previous);
}

/**
 * D) Per-Asset Daily Contribution
 *
 *   valueChange   = todayHolding.value - yesterdayHolding.value
 *   percentChange = valueChange / yesterdayHolding.value
 *
 * If holding did not exist yesterday: previous value treated as 0.
 * Result sorted by absolute valueChange descending.
 */
export function getDailyAssetContribution(
  today: PortfolioSnapshot,
  yesterday: PortfolioSnapshot,
): AssetContribution[] {
  if (today.holdings.length === 0) return [];

  const prevMap = new Map(yesterday.holdings.map(h => [h.symbol, h.value]));

  return today.holdings
    .map(h => {
      const prevValue    = prevMap.get(h.symbol) ?? 0;
      const valueChange  = h.value - prevValue;
      const percentChange = prevValue > 0 ? (valueChange / prevValue) * 100 : 0;
      return { symbol: h.symbol, valueChange, percentChange };
    })
    .sort((a, b) => Math.abs(b.valueChange) - Math.abs(a.valueChange));
}
