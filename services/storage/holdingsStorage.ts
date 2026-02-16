import AsyncStorage from '@react-native-async-storage/async-storage';
import { Holding, StockQuote, DividendInfo, AssetCategory } from '../../types/portfolio';
import { STORAGE_KEYS } from './schema';

export class HoldingsStorage {

  // CREATE
  async addHolding(holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>): Promise<Holding> {
    const holdings = await this.getAllHoldings();
    const newHolding: Holding = {
      ...holding,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    holdings.push(newHolding);
    await this.saveHoldings(holdings);
    return newHolding;
  }

  // READ
  async getAllHoldings(): Promise<Holding[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HOLDINGS);
      if (!data) return [];
      return JSON.parse(data, this.dateReviver);
    } catch (error) {
      console.error('Error reading holdings:', error);
      return [];
    }
  }

  async getHoldingById(id: string): Promise<Holding | null> {
    const holdings = await this.getAllHoldings();
    return holdings.find(h => h.id === id) || null;
  }

  async getHoldingsByCategory(category: AssetCategory): Promise<Holding[]> {
    const holdings = await this.getAllHoldings();
    return holdings.filter(h => h.category === category);
  }

  // UPDATE
  async updateHolding(id: string, updates: Partial<Holding>): Promise<Holding | null> {
    const holdings = await this.getAllHoldings();
    const index = holdings.findIndex(h => h.id === id);
    if (index === -1) return null;

    holdings[index] = {
      ...holdings[index],
      ...updates,
      updatedAt: new Date(),
    };
    await this.saveHoldings(holdings);
    return holdings[index];
  }

  // DELETE
  async deleteHolding(id: string): Promise<boolean> {
    const holdings = await this.getAllHoldings();
    const filtered = holdings.filter(h => h.id !== id);
    if (filtered.length === holdings.length) return false;
    await this.saveHoldings(filtered);
    return true;
  }

  // CACHE OPERATIONS
  async saveQuotesCache(quotes: Record<string, StockQuote>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.QUOTES_CACHE, JSON.stringify(quotes));
  }

  async getQuotesCache(): Promise<Record<string, StockQuote>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.QUOTES_CACHE);
      return data ? JSON.parse(data, this.dateReviver) : {};
    } catch (error) {
      console.error('Error reading quotes cache:', error);
      return {};
    }
  }

  async saveDividendsCache(dividends: Record<string, DividendInfo[]>): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.DIVIDENDS_CACHE, JSON.stringify(dividends));
  }

  async getDividendsCache(): Promise<Record<string, DividendInfo[]>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DIVIDENDS_CACHE);
      return data ? JSON.parse(data, this.dateReviver) : {};
    } catch (error) {
      console.error('Error reading dividends cache:', error);
      return {};
    }
  }

  async updateLastRefresh(): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_REFRESH,
      JSON.stringify({ timestamp: new Date().toISOString() })
    );
  }

  async getLastRefresh(): Promise<Date | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_REFRESH);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return new Date(parsed.timestamp);
    } catch (error) {
      console.error('Error reading last refresh:', error);
      return null;
    }
  }

  // UTILITIES
  private async saveHoldings(holdings: Holding[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.HOLDINGS, JSON.stringify(holdings));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private dateReviver(key: string, value: any): any {
    const dateFields = [
      'createdAt',
      'updatedAt',
      'purchaseDate',
      'lastUpdated',
      'exDividendDate',
      'paymentDate',
      'date',
    ];
    if (dateFields.includes(key) && typeof value === 'string') {
      return new Date(value);
    }
    return value;
  }

  // MIGRATION SUPPORT (클라우드 동기화를 위한 내보내기/가져오기)
  async exportData(): Promise<string> {
    const holdings = await this.getAllHoldings();
    const quotes = await this.getQuotesCache();
    const dividends = await this.getDividendsCache();
    return JSON.stringify({ holdings, quotes, dividends, version: '1.0' });
  }

  async importData(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData, this.dateReviver);
    await this.saveHoldings(data.holdings);
    await this.saveQuotesCache(data.quotes);
    await this.saveDividendsCache(data.dividends);
  }

  // CLEAR ALL DATA (개발/테스트용)
  async clearAllData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.HOLDINGS,
      STORAGE_KEYS.QUOTES_CACHE,
      STORAGE_KEYS.DIVIDENDS_CACHE,
      STORAGE_KEYS.LAST_REFRESH,
    ]);
  }
}
