import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './schema';

export async function loadCustomCategories(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_CATEGORIES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveCustomCategory(name: string): Promise<string[]> {
  const current = await loadCustomCategories();
  if (current.includes(name)) return current;
  const updated = [...current, name];
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
  return updated;
}

export async function deleteCustomCategory(name: string): Promise<string[]> {
  const current = await loadCustomCategories();
  const updated = current.filter(c => c !== name);
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
  return updated;
}
