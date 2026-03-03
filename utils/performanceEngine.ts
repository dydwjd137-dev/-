/**
 * performanceEngine.ts
 *
 * 스냅샷 기반 포트폴리오 성과 계산 엔진.
 * 모두 pure function — side effect 없음.
 */

import { PortfolioSnapshot } from '../services/storage/snapshotStorage';

// ── 출력 타입 ─────────────────────────────────────────────────

export interface PeriodChange {
  valueChange: number;    // KRW 평가금액 변화량
  profitChange: number;   // KRW 손익 변화량
  percentChange: number;  // 평가금액 기준 변화율 (%)
  hasData: boolean;       // 비교 가능한 스냅샷이 있는지
  fromDate: string;       // 비교 기준 날짜 (이전)
  toDate: string;         // 비교 대상 날짜 (현재)
}

export interface AssetChange {
  symbol: string;
  valueChange: number;    // KRW
  profitChange: number;   // KRW
  percentChange: number;  // %
}

// ── 내부 유틸 ─────────────────────────────────────────────────

function emptyChange(): PeriodChange {
  return { valueChange: 0, profitChange: 0, percentChange: 0, hasData: false, fromDate: '', toDate: '' };
}

/**
 * targetDate 이하인 스냅샷 중 가장 최근 것 반환
 * (snapshots 는 날짜 오름차순 정렬 전제)
 */
function closestAtOrBefore(snapshots: PortfolioSnapshot[], targetDate: string): PortfolioSnapshot | null {
  let result: PortfolioSnapshot | null = null;
  for (const s of snapshots) {
    if (s.date <= targetDate) result = s;
    else break;
  }
  return result;
}

function dateOffsetDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function dateOffsetMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function computeChange(current: PortfolioSnapshot, previous: PortfolioSnapshot): PeriodChange {
  const valueChange  = current.totalValue  - previous.totalValue;
  const profitChange = current.totalProfit - previous.totalProfit;
  const percentChange = previous.totalValue > 0
    ? (valueChange / previous.totalValue) * 100
    : 0;
  return {
    valueChange,
    profitChange,
    percentChange,
    hasData: true,
    fromDate: previous.date,
    toDate: current.date,
  };
}

// ── 공개 API ─────────────────────────────────────────────────

/**
 * 일별 변화: 최신 스냅샷 vs 직전 스냅샷
 */
export function getDailyChange(snapshots: PortfolioSnapshot[]): PeriodChange {
  if (snapshots.length < 2) return emptyChange();
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current  = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  return computeChange(current, previous);
}

/**
 * 주간 변화: 최신 스냅샷 vs 7일 전 가장 가까운 스냅샷
 */
export function getWeeklyChange(snapshots: PortfolioSnapshot[]): PeriodChange {
  if (snapshots.length < 2) return emptyChange();
  const sorted  = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];
  const target  = dateOffsetDays(current.date, 7);
  // current보다 앞선 스냅샷 중 target 이하 최신
  const candidates = sorted.slice(0, -1);
  const previous = closestAtOrBefore(candidates, target);
  if (!previous) return emptyChange();
  return computeChange(current, previous);
}

/**
 * 월별 변화: 최신 스냅샷 vs 1개월 전 가장 가까운 스냅샷
 */
export function getMonthlyChange(snapshots: PortfolioSnapshot[]): PeriodChange {
  if (snapshots.length < 2) return emptyChange();
  const sorted  = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];
  const target  = dateOffsetMonths(current.date, 1);
  const candidates = sorted.slice(0, -1);
  const previous = closestAtOrBefore(candidates, target);
  if (!previous) return emptyChange();
  return computeChange(current, previous);
}

/**
 * 연간 변화: 최신 스냅샷 vs 1년 전 가장 가까운 스냅샷
 */
export function getYearlyChange(snapshots: PortfolioSnapshot[]): PeriodChange {
  if (snapshots.length < 2) return emptyChange();
  const sorted  = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];
  const target  = dateOffsetDays(current.date, 365);
  const candidates = sorted.slice(0, -1);
  const previous = closestAtOrBefore(candidates, target);
  if (!previous) return emptyChange();
  return computeChange(current, previous);
}

/**
 * 종목별 일간 변화: 최신 스냅샷 vs 직전 스냅샷의 holdings 비교
 * 절대값 기준 내림차순 정렬
 */
export function getPerAssetDailyChange(snapshots: PortfolioSnapshot[]): AssetChange[] {
  if (snapshots.length < 2) return [];
  const sorted   = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current  = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  if (current.holdings.length === 0) return [];

  const prevMap = new Map(previous.holdings.map(h => [h.symbol, h]));

  return current.holdings
    .map(h => {
      const prev         = prevMap.get(h.symbol);
      const prevValue    = prev?.value  ?? 0;
      const prevProfit   = prev?.profit ?? 0;
      const valueChange  = h.value  - prevValue;
      const profitChange = h.profit - prevProfit;
      const percentChange = prevValue > 0 ? (valueChange / prevValue) * 100 : 0;
      return { symbol: h.symbol, valueChange, profitChange, percentChange };
    })
    .sort((a, b) => Math.abs(b.valueChange) - Math.abs(a.valueChange));
}
