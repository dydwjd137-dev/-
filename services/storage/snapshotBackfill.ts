/**
 * snapshotBackfill.ts
 * 앱을 열지 않은 기간의 포트폴리오 스냅샷을
 * 과거 종가 데이터를 기반으로 자동 계산·저장합니다.
 *
 * 동작 방식:
 *  1. 마지막 저장된 스냅샷 날짜 이후 ~ 어제까지 빠진 날짜 목록 계산
 *  2. 모든 보유 종목의 일봉(1day) 시계열을 백엔드 프록시로 병렬 조회
 *  3. USD/KRW 역사 환율도 함께 조회 (실패 시 현재 환율로 대체)
 *  4. 날짜별 totalValue / totalCost 계산 후 스냅샷 저장
 */

import { Holding } from '../../types/portfolio';
import { loadSnapshots, saveSnapshot } from './snapshotStorage';
import { config } from '../../config';

const BASE = `${config.backendUrl}/api`;

// ── 유틸 ────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Yahoo Finance 심볼 → Twelve Data 심볼 변환 */
function yahooToTD(ticker: string): string {
  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return `${ticker.split('.')[0]}:KRX`;
  if (ticker.endsWith('.T'))  return `${ticker.split('.')[0]}:TSE`;
  if (ticker.endsWith('.HK')) return `${ticker.split('.')[0]}:HKEX`;
  if (ticker.endsWith('.SS') || ticker.endsWith('.SZ')) return `${ticker.split('.')[0]}:XSHG`;
  // 코인: Yahoo Finance 형식(BTC-USD) → Twelve Data 형식(BTC/USD)
  if (/-USD[T]?$/.test(ticker)) return ticker.replace('-', '/');
  return ticker;
}

/** 마지막 스냅샷 날짜 이후 ~ 어제까지 빠진 날짜 목록 반환 */
function getMissingDates(lastDate: string): string[] {
  const today = localDateStr(new Date());
  const missing: string[] = [];
  // noon을 기준으로 파싱해 타임존 이슈 방지
  const cur = new Date(`${lastDate}T12:00:00`);
  cur.setDate(cur.getDate() + 1);
  while (localDateStr(cur) < today) {
    missing.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return missing;
}

// ── API 조회 ─────────────────────────────────────────────────

interface DailyClose {
  date: string;
  close: number;
  currency: string;
}

async function fetchDailyCloses(
  tdSymbol: string,
  startDate: string,
  endDate: string,
): Promise<DailyClose[]> {
  try {
    const qs = new URLSearchParams({
      symbol: tdSymbol,
      interval: '1day',
      start_date: startDate,
      end_date: endDate,
      outputsize: '90',
    }).toString();
    const res = await fetch(`${BASE}/time_series?${qs}`);
    const data = await res.json();
    if (!Array.isArray(data.values)) return [];
    const currency: string = data.meta?.currency ?? 'USD';
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
    const res = await fetch(`${BASE}/time_series?${qs}`);
    const data = await res.json();
    if (!Array.isArray(data.values)) return {};
    return Object.fromEntries(
      (data.values as { datetime: string; close: string }[])
        .map(v => [v.datetime.slice(0, 10), parseFloat(v.close)])
    );
  } catch {
    return {};
  }
}

// ── 메인 ─────────────────────────────────────────────────────

/**
 * @param rawHoldings  현재 보유 종목 목록 (Holding[])
 * @param fallbackRate API 실패 시 사용할 현재 USD/KRW 환율
 * @param maxDays      최대 백필 일수 (기본 90일)
 */
export async function backfillSnapshots(
  rawHoldings: Holding[],
  fallbackRate: number,
  maxDays = 90,
): Promise<void> {
  if (rawHoldings.length === 0) return;

  const snapshots = await loadSnapshots();
  if (snapshots.length === 0) return; // 기준 스냅샷이 없으면 백필 불가

  const lastDate = snapshots[snapshots.length - 1].date;
  let missingDates = getMissingDates(lastDate);
  if (missingDates.length === 0) return; // 빠진 날 없음

  // 너무 긴 기간은 최근 maxDays 일만 처리
  if (missingDates.length > maxDays) {
    missingDates = missingDates.slice(-maxDays);
  }

  const startDate = missingDates[0];
  const endDate   = missingDates[missingDates.length - 1];

  // 유니크 티커 → TD 심볼 맵
  const tickerMap = new Map<string, string>();
  for (const h of rawHoldings) {
    if (!tickerMap.has(h.ticker)) {
      tickerMap.set(h.ticker, yahooToTD(h.ticker));
    }
  }
  const tickerList = [...tickerMap.keys()];

  // 병렬로 환율 + 전 종목 종가 히스토리 조회
  const [fxHistory, ...closesResults] = await Promise.all([
    fetchFxHistory(startDate, endDate),
    ...tickerList.map(ticker =>
      fetchDailyCloses(tickerMap.get(ticker)!, startDate, endDate)
        .then(closes => ({ ticker, closes }))
    ),
  ]);

  // ticker → { date → { close, currency } }
  const priceMap = new Map<string, Map<string, { close: number; currency: string }>>();
  for (const { ticker, closes } of closesResults) {
    const m = new Map<string, { close: number; currency: string }>();
    for (const c of closes) m.set(c.date, { close: c.close, currency: c.currency });
    priceMap.set(ticker, m);
  }

  // 날짜별 스냅샷 계산 & 저장
  for (const date of missingDates) {
    const rate = fxHistory[date] ?? fallbackRate;
    let totalValue = 0;
    let totalCost  = 0;
    let hasPrice   = false;

    for (const h of rawHoldings) {
      // 이 날짜 이후에 매수한 종목은 제외
      const buyDate = localDateStr(
        h.purchaseDate instanceof Date ? h.purchaseDate : new Date(h.purchaseDate)
      );
      if (buyDate > date) continue;

      const entry = priceMap.get(h.ticker)?.get(date);
      if (!entry) continue; // 해당 날짜 시세 없음 (주말·공휴일 등)

      hasPrice = true;
      // purchasePrice는 KRW (types/portfolio.ts 주석 기준)
      totalCost += h.purchasePrice * h.quantity;
      // 종가 → KRW 환산
      const priceKRW = entry.currency === 'KRW' ? entry.close : entry.close * rate;
      totalValue += priceKRW * h.quantity;
    }

    if (hasPrice && totalValue > 0) {
      await saveSnapshot({ date, totalValue, totalCost });
    }
  }
}
