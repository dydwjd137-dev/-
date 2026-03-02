import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './schema';

export interface PortfolioSnapshot {
  date: string;       // YYYY-MM-DD
  totalValue: number; // KRW
  totalCost: number;  // KRW
}

const MAX_SNAPSHOTS = 365; // 최대 1년치 보관

export async function saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  const all = await loadSnapshots();
  const idx = all.findIndex(s => s.date === snapshot.date);
  if (idx >= 0) {
    all[idx] = snapshot; // 오늘 스냅샷 업데이트
  } else {
    all.push(snapshot);
  }
  all.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = all.slice(-MAX_SNAPSHOTS);
  await AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(trimmed));
}

export async function loadSnapshots(): Promise<PortfolioSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    if (!raw) return [];
    return JSON.parse(raw) as PortfolioSnapshot[];
  } catch {
    return [];
  }
}
