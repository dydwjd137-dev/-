import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  PORTFOLIO_COMMENT: 'ai_portfolio_comment',
  TAX_ADVICE:        'ai_tax_advice',
};

export interface StoredAnalysis<T> {
  data: T;
  savedAt: string; // ISO string
}

export async function savePortfolioComment<T>(data: T): Promise<void> {
  const payload: StoredAnalysis<T> = { data, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEYS.PORTFOLIO_COMMENT, JSON.stringify(payload));
}

export async function loadPortfolioComment<T>(): Promise<StoredAnalysis<T> | null> {
  const raw = await AsyncStorage.getItem(KEYS.PORTFOLIO_COMMENT);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveTaxAdvice<T>(data: T): Promise<void> {
  const payload: StoredAnalysis<T> = { data, savedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEYS.TAX_ADVICE, JSON.stringify(payload));
}

export async function loadTaxAdvice<T>(): Promise<StoredAnalysis<T> | null> {
  const raw = await AsyncStorage.getItem(KEYS.TAX_ADVICE);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MM}/${DD} ${hh}:${mm} 분석`;
}