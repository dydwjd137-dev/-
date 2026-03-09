import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './schema';
import { OtherAsset, Loan } from '../../types/otherAssets';

// ─── 기타자산 ─────────────────────────────────────────────────

export async function getOtherAssets(): Promise<OtherAsset[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.OTHER_ASSETS);
  if (!raw) return [];
  return JSON.parse(raw) as OtherAsset[];
}

export async function addOtherAsset(asset: Omit<OtherAsset, 'id' | 'createdAt' | 'updatedAt'>): Promise<OtherAsset> {
  const existing = await getOtherAssets();
  const now = new Date().toISOString();
  const newAsset: OtherAsset = {
    ...asset,
    id: `oa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };
  await AsyncStorage.setItem(STORAGE_KEYS.OTHER_ASSETS, JSON.stringify([...existing, newAsset]));
  return newAsset;
}

export async function updateOtherAsset(id: string, updates: Partial<Omit<OtherAsset, 'id' | 'createdAt'>>): Promise<void> {
  const existing = await getOtherAssets();
  const updated = existing.map(a =>
    a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
  );
  await AsyncStorage.setItem(STORAGE_KEYS.OTHER_ASSETS, JSON.stringify(updated));
}

export async function deleteOtherAsset(id: string): Promise<void> {
  const existing = await getOtherAssets();
  await AsyncStorage.setItem(STORAGE_KEYS.OTHER_ASSETS, JSON.stringify(existing.filter(a => a.id !== id)));
}

// ─── 대출 ─────────────────────────────────────────────────────

export async function getLoans(): Promise<Loan[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.LOANS);
  if (!raw) return [];
  return JSON.parse(raw) as Loan[];
}

export async function addLoan(loan: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
  const existing = await getLoans();
  const now = new Date().toISOString();
  const newLoan: Loan = {
    ...loan,
    id: `ln_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
  };
  await AsyncStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify([...existing, newLoan]));
  return newLoan;
}

export async function updateLoan(id: string, updates: Partial<Omit<Loan, 'id' | 'createdAt'>>): Promise<void> {
  const existing = await getLoans();
  const updated = existing.map(l =>
    l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
  );
  await AsyncStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(updated));
}

export async function deleteLoan(id: string): Promise<void> {
  const existing = await getLoans();
  await AsyncStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(existing.filter(l => l.id !== id)));
}
