/**
 * utils/performanceEngine.ts
 *
 * Backward-compatible re-export layer.
 * Canonical engine lives in engine/performanceEngine.ts.
 *
 * New code should import directly from engine/performanceEngine.
 */

export {
  getCumulativeReturn,
  getDailyReturn,
  getWeeklyReturn,
  getMonthlyReturn,
  getYearlyReturn,
  getDailyAssetContribution,
} from '../engine/performanceEngine';

export type {
  CumulativeReturn,
  ReturnResult,
  AssetContribution,
} from '../engine/performanceEngine';

// ── Backward-compatible aliases ───────────────────────────────

import {
  ReturnResult,
  AssetContribution,
  getDailyReturn,
  getWeeklyReturn,
  getMonthlyReturn,
  getYearlyReturn,
  getDailyAssetContribution,
} from '../engine/performanceEngine';
import { PortfolioSnapshot } from '../services/storage/snapshotStorage';

export type PeriodChange  = ReturnResult;
export type AssetChange   = AssetContribution;

export const getDailyChange   = getDailyReturn;
export const getWeeklyChange  = getWeeklyReturn;
export const getMonthlyChange = getMonthlyReturn;
export const getYearlyChange  = getYearlyReturn;

/** Wraps getDailyAssetContribution with the old array-based signature */
export function getPerAssetDailyChange(snapshots: PortfolioSnapshot[]): AssetContribution[] {
  if (snapshots.length < 2) return [];
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  return getDailyAssetContribution(sorted[sorted.length - 1], sorted[sorted.length - 2]);
}
