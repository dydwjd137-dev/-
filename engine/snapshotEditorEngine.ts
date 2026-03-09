/**
 * engine/snapshotEditorEngine.ts
 *
 * Snapshot editing and historical backfill engine.
 * Pure logic layer — no UI dependencies, no component manipulation.
 *
 * Functions:
 *   createSnapshotForDate   — single date, current prices
 *   overwriteSnapshot       — explicit overwrite, current prices
 *   bulkApplySnapshots      — date range, current prices
 *   backfillHistoricalPrices — date range, fetches historical closes from API
 */

import { Holding, EnrichedHolding } from '../types/portfolio';
import { saveSnapshot, deleteSnapshot } from '../services/storage/snapshotStorage';
import { config } from '../config';

export { deleteSnapshot };

const BASE = `${config.backendUrl}/api`;

// ── Constants ─────────────────────────────────────────────────

export const MAX_RANGE_DAYS = 90;

// ── Types ─────────────────────────────────────────────────────

export interface BulkApplyResult {
  saved: number;
  skipped: number;
  failed: number;
  error?: string;
  /** 데이터를 정상 수신한 종목 수 (backfill 전용) */
  tickersOk?: number;
  /** 데이터가 전혀 없는 종목 목록 (backfill 전용) */
  tickersNoData?: string[];
}

export interface BackfillProgress {
  ticker: string;     // 현재 불러오는 종목
  done: number;       // 완료된 종목 수
  total: number;      // 전체 종목 수
  phase: 'fx' | 'ticker' | 'saving' | 'done';
}

// ── Date Utilities ────────────────────────────────────────────

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

/** Returns number of calendar days from startDate to endDate (inclusive) */
export function daysBetween(startDate: string, endDate: string): number {
  const a = new Date(`${startDate}T12:00:00`);
  const b = new Date(`${endDate}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Returns every YYYY-MM-DD between startDate and endDate inclusive */
export function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (cur <= end) {
    dates.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── Validation ────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDateRange(startDate: string, endDate: string): ValidationResult {
  const fmt = /^\d{4}-\d{2}-\d{2}$/;
  if (!fmt.test(startDate) || !fmt.test(endDate)) {
    return { valid: false, error: '날짜 형식은 YYYY-MM-DD 이어야 합니다.' };
  }
  if (startDate > endDate) {
    return { valid: false, error: '시작일이 종료일보다 늦습니다.' };
  }
  const days = daysBetween(startDate, endDate);
  if (days >= MAX_RANGE_DAYS) {
    return { valid: false, error: `최대 ${MAX_RANGE_DAYS}일 범위만 지원합니다. (현재: ${days + 1}일)` };
  }
  return { valid: true };
}

export function validateSingleDate(date: string): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { valid: false, error: '날짜 형식은 YYYY-MM-DD 이어야 합니다.' };
  }
  return { valid: true };
}

// ── Price API (internal) ──────────────────────────────────────

interface DailyClose {
  date: string;
  close: number;
  currency: string;
}

/** 코인 종목 여부 (BTC-USD, ETH-USDT 등) */
export function isCoin(ticker: string): boolean {
  return /-USD[T]?$/.test(ticker);
}

/** Yahoo Finance 심볼 → Twelve Data 심볼 변환 */
function yahooToTD(ticker: string): string {
  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return `${ticker.split('.')[0]}:KRX`;
  if (ticker.endsWith('.T'))  return `${ticker.split('.')[0]}:TSE`;
  if (ticker.endsWith('.HK')) return `${ticker.split('.')[0]}:HKEX`;
  if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) return `${ticker.split('.')[0]}:XSHG`;
  if (/-USD[T]?$/.test(ticker)) return ticker.replace('-', '/');
  return ticker;
}

/** Yahoo Finance 심볼 기준 기본 통화 결정 (API meta 보완용) */
function defaultCurrency(yahooTicker: string): string {
  if (
    yahooTicker.endsWith('.KS') ||
    yahooTicker.endsWith('.KQ') ||
    yahooTicker.endsWith('.KO')
  ) return 'KRW';
  if (yahooTicker.endsWith('.T')) return 'JPY';
  if (yahooTicker.endsWith('.HK')) return 'HKD';
  return 'USD';
}

async function fetchDailyCloses(
  yahooTicker: string,
  startDate: string,
  endDate: string,
): Promise<DailyClose[]> {
  const tdSymbol = yahooToTD(yahooTicker);
  const fallbackCurrency = defaultCurrency(yahooTicker);
  try {
    const qs = new URLSearchParams({
      symbol: tdSymbol,
      interval: '1day',
      start_date: startDate,
      end_date: endDate,
      outputsize: '90',
    }).toString();
    const res  = await fetch(`${BASE}/time_series?${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.values)) return [];
    // meta.currency 우선, 없으면 ticker 기반 폴백
    const currency: string = data.meta?.currency ?? fallbackCurrency;
    return (data.values as { datetime: string; close: string }[]).map(v => ({
      date: v.datetime.slice(0, 10),
      close: parseFloat(v.close),
      currency,
    }));
  } catch {
    return [];
  }
}

async function fetchFxHistory(
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  try {
    const qs = new URLSearchParams({
      symbol: 'USD/KRW',
      interval: '1day',
      start_date: startDate,
      end_date: endDate,
      outputsize: '90',
    }).toString();
    const res  = await fetch(`${BASE}/time_series?${qs}`);
    const data = await res.json();
    if (!Array.isArray(data.values)) return {};
    return Object.fromEntries(
      (data.values as { datetime: string; close: string }[])
        .map(v => [v.datetime.slice(0, 10), parseFloat(v.close)]),
    );
  } catch {
    return {};
  }
}

// ── Internal snapshot builder from EnrichedHolding ───────────

function buildSnapshotData(enrichedHoldings: EnrichedHolding[]) {
  const holdingSnaps = enrichedHoldings
    .filter(h => h.quote !== null)
    .map(h => ({ symbol: h.ticker, value: h.currentValue, profit: h.profitLoss }));
  const totalValue  = holdingSnaps.reduce((s, h) => s + h.value,  0);
  const totalCost   = enrichedHoldings.reduce((s, h) => s + h.totalCost, 0);
  const totalProfit = totalValue - totalCost;
  return { holdingSnaps, totalValue, totalCost, totalProfit };
}

// ── Public Engine API ─────────────────────────────────────────

/**
 * createSnapshotForDate
 *
 * Creates (or overwrites) a snapshot for a specific date
 * using CURRENT holding values from the live portfolio state.
 *
 * All calculations use performanceEngine values — no UI-side math.
 */
export async function createSnapshotForDate(
  date: string,
  enrichedHoldings: EnrichedHolding[],
): Promise<void> {
  const v = validateSingleDate(date);
  if (!v.valid) throw new Error(v.error);

  const { holdingSnaps, totalValue, totalCost, totalProfit } = buildSnapshotData(enrichedHoldings);
  await saveSnapshot({ date, totalValue, totalCost, totalProfit, holdings: holdingSnaps });
}

/**
 * overwriteSnapshot
 *
 * Explicitly overwrites an existing snapshot (or creates one).
 * Semantically identical to createSnapshotForDate — provided for clarity.
 */
export async function overwriteSnapshot(
  date: string,
  enrichedHoldings: EnrichedHolding[],
): Promise<void> {
  return createSnapshotForDate(date, enrichedHoldings);
}

/**
 * bulkApplySnapshots
 *
 * Applies the CURRENT portfolio state to every day in startDate..endDate.
 * All dates in the range receive the same totalValue/totalCost
 * (reflecting current prices, not historical).
 *
 * Constraints:
 *   - Maximum range: 90 days
 *   - Creates or overwrites (upsert)
 *   - Weekends / holidays get the same values as trading days
 */
export async function bulkApplySnapshots(
  startDate: string,
  endDate: string,
  enrichedHoldings: EnrichedHolding[],
): Promise<BulkApplyResult> {
  const v = validateDateRange(startDate, endDate);
  if (!v.valid) return { saved: 0, skipped: 0, failed: 0, error: v.error };

  const { holdingSnaps, totalValue, totalCost, totalProfit } = buildSnapshotData(enrichedHoldings);
  const dates = dateRange(startDate, endDate);
  let saved = 0, failed = 0;

  for (const date of dates) {
    try {
      await saveSnapshot({ date, totalValue, totalCost, totalProfit, holdings: holdingSnaps });
      saved++;
    } catch {
      failed++;
    }
  }

  return { saved, skipped: 0, failed };
}

/**
 * backfillHistoricalPrices
 *
 * Fetches historical daily closing prices for every holding across
 * startDate..endDate, then calculates and saves accurate daily snapshots.
 *
 * Per snapshot date:
 *   For each holding:
 *     price = historical close on that date (KRW-converted via FX history)
 *     value = price × quantity
 *   snapshot.totalValue  = Σ(holding values)
 *   snapshot.totalProfit = totalValue - totalCost
 *
 * 전체 보유 종목 처리.
 * 주말·휴일은 직전 거래일 가격을 carry-forward로 복붙.
 * Holdings acquired after the snapshot date are excluded.
 *
 * Constraints:
 *   - Maximum range: 90 days
 *   - Uses existing backend /api/time_series proxy
 */
export async function backfillHistoricalPrices(
  startDate: string,
  endDate: string,
  rawHoldings: Holding[],
  fallbackRate: number,
  onProgress?: (p: BackfillProgress) => void,
): Promise<BulkApplyResult> {
  const v = validateDateRange(startDate, endDate);
  if (!v.valid) return { saved: 0, skipped: 0, failed: 0, error: v.error };

  if (rawHoldings.length === 0) {
    return { saved: 0, skipped: 0, failed: 0, error: '보유 종목이 없습니다.' };
  }

  // 중복 제거한 전체 티커 목록
  const tickerList = [...new Set(rawHoldings.map(h => h.ticker))];
  const total = tickerList.length;

  // ── 1단계: FX 히스토리 (USD/KRW) ────────────────────────────
  onProgress?.({ ticker: 'USD/KRW', done: 0, total, phase: 'fx' });
  const fxHistory = await fetchFxHistory(startDate, endDate);

  // ── 2단계: 종목별 순차 fetch ─────────────────────────────────
  // ticker → (date → { close, currency })
  const priceMap = new Map<string, Map<string, { close: number; currency: string }>>();
  const tickersNoData: string[] = [];

  for (let i = 0; i < tickerList.length; i++) {
    const ticker = tickerList[i];
    onProgress?.({ ticker, done: i, total, phase: 'ticker' });

    const closes = await fetchDailyCloses(ticker, startDate, endDate);
    const m = new Map<string, { close: number; currency: string }>();
    for (const c of closes) m.set(c.date, { close: c.close, currency: c.currency });
    priceMap.set(ticker, m);

    // 데이터 없는 종목 기록
    if (closes.length === 0) tickersNoData.push(ticker);

    // 연속 요청 사이 딜레이 (rate limit 방어)
    if (i < tickerList.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  const tickersOk = tickerList.length - tickersNoData.length;

  // 모든 종목이 데이터 없음 → 즉시 반환
  if (tickersOk === 0) {
    return {
      saved: 0,
      skipped: 0,
      failed: 0,
      error: `모든 종목(${tickerList.length}개)에서 데이터를 받지 못했습니다. 티커 형식 또는 API 플랜을 확인하세요.`,
      tickersOk: 0,
      tickersNoData,
    };
  }

  // ── 3단계: carry-forward 가격으로 날짜별 스냅샷 생성 ────────
  // lastKnown: ticker → 직전 거래일의 가격 (주말 복붙용)
  const lastKnown = new Map<string, { close: number; currency: string }>();

  onProgress?.({ ticker: '', done: total, total, phase: 'saving' });

  const dates = dateRange(startDate, endDate);
  let saved = 0, skipped = 0, failed = 0;

  for (const date of dates) {
    // 해당 날짜에 새 거래일 가격이 있으면 lastKnown 갱신
    for (const ticker of tickerList) {
      const entry = priceMap.get(ticker)?.get(date);
      if (entry) lastKnown.set(ticker, entry);
    }

    // FX: 해당 날짜 환율 없으면 마지막 알려진 환율 carry-forward
    const rate = fxHistory[date] ?? fallbackRate;

    let totalValue = 0;
    let totalCost  = 0;
    let hasPrice   = false;
    const holdingSnaps: { symbol: string; value: number; profit: number }[] = [];

    for (const h of rawHoldings) {
      // carry-forward: 당일 가격 없으면 직전 거래일 가격 사용
      const entry = lastKnown.get(h.ticker);
      if (!entry) continue; // 아직 첫 거래일 이전 → 건너뜀

      hasPrice = true;
      const cost     = h.purchasePrice * h.quantity;
      const priceKRW = entry.currency === 'KRW' ? entry.close : entry.close * rate;
      const value    = priceKRW * h.quantity;

      totalCost  += cost;
      totalValue += value;
      holdingSnaps.push({ symbol: h.ticker, value, profit: value - cost });
    }

    if (!hasPrice || totalValue <= 0) {
      skipped++;
      continue;
    }

    try {
      await saveSnapshot({
        date,
        totalValue,
        totalCost,
        totalProfit: totalValue - totalCost,
        holdings: holdingSnaps,
      });
      saved++;
    } catch {
      failed++;
    }
  }

  onProgress?.({ ticker: '', done: total, total, phase: 'done' });
  return { saved, skipped, failed, tickersOk, tickersNoData };
}
