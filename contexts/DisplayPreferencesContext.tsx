/**
 * DisplayPreferencesContext.tsx
 * 테마, 화면 크기, 히트맵 라벨 등 표시 설정 전역 관리
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeMode,
  AccentColor,
  ScreenSizeMode,
  ThemeColors,
  ScaleFactors,
  getThemeColors,
  SCALE_FACTORS,
} from '../constants/themes';
import { STORAGE_KEYS } from '../services/storage/schema';

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────
export type HeatmapLabelMode = 'ticker' | 'nameKr' | 'nameEn';

export interface DisplayPreferences {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  nightShiftIntensity: number;   // 0–100
  heatmapLabelMode: HeatmapLabelMode;
  screenSizeMode: ScreenSizeMode;
}

const DEFAULT_PREFERENCES: DisplayPreferences = {
  themeMode:            'dark',
  accentColor:          'purple',
  nightShiftIntensity:  40,
  heatmapLabelMode:     'ticker',
  screenSizeMode:       'standard',
};

interface DisplayPreferencesContextValue {
  prefs: DisplayPreferences;
  themeColors: ThemeColors;
  scale: ScaleFactors;
  updatePref: <K extends keyof DisplayPreferences>(key: K, value: DisplayPreferences[K]) => void;
  isLoaded: boolean;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────
const DisplayPreferencesContext = createContext<DisplayPreferencesContextValue>({
  prefs:       DEFAULT_PREFERENCES,
  themeColors: getThemeColors('dark', 'purple', true),
  scale:       SCALE_FACTORS.standard,
  updatePref:  () => {},
  isLoaded:    false,
});

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────
export function DisplayPreferencesProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [prefs, setPrefs] = useState<DisplayPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // 저장된 설정 로드
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<DisplayPreferences>;
          setPrefs((prev) => ({ ...prev, ...saved }));
        } catch {
          // 파싱 실패 시 기본값 유지
        }
      }
      setIsLoaded(true);
    });
  }, []);

  // 개별 설정 업데이트 + 저장
  const updatePref = useCallback(<K extends keyof DisplayPreferences>(
    key: K,
    value: DisplayPreferences[K],
  ) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(next));
      return next;
    });
  }, []);

  // 현재 테마 색상 계산
  const themeColors = useMemo(() => {
    const systemIsDark = systemColorScheme !== 'light';
    return getThemeColors(prefs.themeMode, prefs.accentColor, systemIsDark);
  }, [prefs.themeMode, prefs.accentColor, systemColorScheme]);

  // 스케일 팩터
  const scale = useMemo(() => SCALE_FACTORS[prefs.screenSizeMode], [prefs.screenSizeMode]);

  const value = useMemo(
    () => ({ prefs, themeColors, scale, updatePref, isLoaded }),
    [prefs, themeColors, scale, updatePref, isLoaded],
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useTheme() {
  return useContext(DisplayPreferencesContext);
}
