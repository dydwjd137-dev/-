// AsyncStorage 키 정의

export const STORAGE_KEYS = {
  HOLDINGS: '@portfolio/holdings',
  QUOTES_CACHE: '@portfolio/quotes_cache',
  DIVIDENDS_CACHE: '@portfolio/dividends_cache',
  LAST_REFRESH: '@portfolio/last_refresh',
  USER_PREFERENCES: '@portfolio/preferences',
  EXCHANGE_RATE: '@portfolio/exchange_rate',
  CUSTOM_CATEGORIES: '@portfolio/custom_categories',
  SNAPSHOTS: '@portfolio/snapshots',
} as const;
