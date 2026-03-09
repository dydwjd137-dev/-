import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './schema';

// ── 인터페이스 ────────────────────────────────────────────────

export interface SnapshotHolding {
  symbol: string;
  value: number;   // KRW 평가금액
  profit: number;  // KRW 손익
}

export interface PortfolioSnapshot {
  date: string;                // YYYY-MM-DD
  totalValue: number;          // KRW 총 평가금액
  totalCost: number;           // KRW 총 투자원금
  totalProfit: number;         // KRW 총 손익
  holdings: SnapshotHolding[]; // 종목별 스냅샷
}

const MAX_SNAPSHOTS = 365;

// ── 마이그레이션 ──────────────────────────────────────────────
// 구버전 스냅샷({ date, totalValue, totalCost }) → 신버전으로 안전 변환

function migrateSnapshot(raw: any): PortfolioSnapshot {
  return {
    date:        raw.date        ?? '',
    totalValue:  raw.totalValue  ?? 0,
    totalCost:   raw.totalCost   ?? 0,
    totalProfit: raw.totalProfit ?? ((raw.totalValue ?? 0) - (raw.totalCost ?? 0)),
    holdings:    Array.isArray(raw.holdings) ? raw.holdings : [],
  };
}

function isValidSnapshot(s: any): boolean {
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.date === 'string' &&
    s.date.length === 10 &&
    typeof s.totalValue === 'number' &&
    typeof s.totalCost === 'number'
  );
}

// ── 저장 ─────────────────────────────────────────────────────

export async function saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  try {
    const all = await loadSnapshots();
    const idx = all.findIndex(s => s.date === snapshot.date);
    if (idx >= 0) {
      all[idx] = snapshot;
    } else {
      all.push(snapshot);
    }
    all.sort((a, b) => a.date.localeCompare(b.date));
    const trimmed = all.slice(-MAX_SNAPSHOTS);
    await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[snapshotStorage] saveSnapshot failed:', e);
  }
}

// ── 삭제 ─────────────────────────────────────────────────────

export async function deleteSnapshot(date: string): Promise<void> {
  try {
    const all = await loadSnapshots();
    const filtered = all.filter(s => s.date !== date);
    await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[snapshotStorage] deleteSnapshot failed:', e);
  }
}

// ── 로드 (마이그레이션 포함) ──────────────────────────────────

export async function loadSnapshots(): Promise<PortfolioSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    if (!raw) return [];
    const parsed: any[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidSnapshot)
      .map(migrateSnapshot)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}
