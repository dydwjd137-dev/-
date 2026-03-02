/**
 * themes.ts
 * 테마 색상 토큰 + 액센트 컬러 매트릭스
 */

export type ThemeMode =
  | 'dark'
  | 'light'
  | 'system'
  | 'night-shift'
  | 'grayscale'
  | 'high-contrast';

export type AccentColor = 'purple' | 'blue' | 'green' | 'orange';

export interface ThemeColors {
  background: string;
  cardBackground: string;
  profit: string;
  loss: string;
  dividend: string;
  primary: string;
  text: string;
  textSecondary: string;
  tabIconSelected: string;
  tabIconDefault: string;
  border: string;
  inputBackground: string;
}

// ─────────────────────────────────────────────────────────────
// 액센트 컬러 매핑
// ─────────────────────────────────────────────────────────────
export const ACCENT_MAP: Record<AccentColor, string> = {
  purple: '#6B4FFF',
  blue:   '#0A84FF',
  green:  '#00C896',
  orange: '#FF8C00',
};

// ─────────────────────────────────────────────────────────────
// 베이스 색상 세트 (accent-independent)
// ─────────────────────────────────────────────────────────────
const DARK_BASE: Omit<ThemeColors, 'primary' | 'tabIconSelected'> = {
  background:     '#0D0221',
  cardBackground: 'rgba(107, 79, 255, 0.08)',
  profit:         '#00FFA3',
  loss:           '#FF006B',
  dividend:       '#FFD700',
  text:           '#FFFFFF',
  textSecondary:  '#A0A0B0',
  tabIconDefault: '#A0A0B0',
  border:         'rgba(107, 79, 255, 0.25)',
  inputBackground:'rgba(107, 79, 255, 0.12)',
};

const LIGHT_BASE: Omit<ThemeColors, 'primary' | 'tabIconSelected'> = {
  background:     '#F5F3FF',
  cardBackground: '#E8E4FF',
  profit:         '#007A52',
  loss:           '#C00050',
  dividend:       '#A07800',
  text:           '#0D0221',
  textSecondary:  '#5A5A7A',
  tabIconDefault: '#8888AA',
  border:         'rgba(107, 79, 255, 0.25)',
  inputBackground:'rgba(107, 79, 255, 0.10)',
};

const GRAYSCALE_BASE: Omit<ThemeColors, 'primary' | 'tabIconSelected'> = {
  background:     '#111111',
  cardBackground: 'rgba(128, 128, 128, 0.10)',
  profit:         '#AAAAAA',
  loss:           '#666666',
  dividend:       '#999999',
  text:           '#EEEEEE',
  textSecondary:  '#888888',
  tabIconDefault: '#666666',
  border:         'rgba(180, 180, 180, 0.2)',
  inputBackground:'rgba(128, 128, 128, 0.12)',
};

const HIGH_CONTRAST_BASE: Omit<ThemeColors, 'primary' | 'tabIconSelected'> = {
  background:     '#000000',
  cardBackground: 'rgba(255, 255, 255, 0.05)',
  profit:         '#00FF88',
  loss:           '#FF0055',
  dividend:       '#FFD700',
  text:           '#FFFFFF',
  textSecondary:  '#CCCCCC',
  tabIconDefault: '#888888',
  border:         'rgba(255, 255, 255, 0.3)',
  inputBackground:'rgba(255, 255, 255, 0.08)',
};

// ─────────────────────────────────────────────────────────────
// 헥스 → "R, G, B" 문자열 변환 (rgba 동적 생성용)
// ─────────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// ─────────────────────────────────────────────────────────────
// 테마 색상 생성 함수
// ─────────────────────────────────────────────────────────────
export function getThemeColors(
  mode: ThemeMode,
  accent: AccentColor,
  systemIsDark: boolean = true,
): ThemeColors {
  const primary = ACCENT_MAP[accent];

  let base: Omit<ThemeColors, 'primary' | 'tabIconSelected'>;

  switch (mode) {
    case 'light':
      base = LIGHT_BASE;
      break;
    case 'system':
      base = systemIsDark ? DARK_BASE : LIGHT_BASE;
      break;
    case 'grayscale':
      base = GRAYSCALE_BASE;
      break;
    case 'high-contrast':
      base = HIGH_CONTRAST_BASE;
      break;
    case 'night-shift':
    case 'dark':
    default:
      base = DARK_BASE;
      break;
  }

  // Grayscale 모드에서는 accent도 회색 계열로
  const effectivePrimary = mode === 'grayscale' ? '#888888' : primary;

  // Grayscale / High-contrast 는 중립 색상 유지
  if (mode === 'grayscale' || mode === 'high-contrast') {
    return { ...base, primary: effectivePrimary, tabIconSelected: effectivePrimary };
  }

  // 그 외 모드: border / cardBackground / inputBackground 를 엑센트 색상 기반으로 동적 계산
  const rgb = hexToRgb(primary);
  const isLight = mode === 'light' || (mode === 'system' && !systemIsDark);

  return {
    ...base,
    primary:          effectivePrimary,
    tabIconSelected:  effectivePrimary,
    border:           `rgba(${rgb}, 0.25)`,
    cardBackground:   isLight ? `rgba(${rgb}, 0.10)` : `rgba(${rgb}, 0.08)`,
    inputBackground:  isLight ? `rgba(${rgb}, 0.10)` : `rgba(${rgb}, 0.12)`,
  };
}

// ─────────────────────────────────────────────────────────────
// 화면 크기 스케일 팩터
// ─────────────────────────────────────────────────────────────
export type ScreenSizeMode = 'compact' | 'standard' | 'large' | 'xl';

export interface ScaleFactors {
  font: number;
  padding: number;
  radius: number;
}

export const SCALE_FACTORS: Record<ScreenSizeMode, ScaleFactors> = {
  compact:  { font: 0.85, padding: 0.80, radius: 10 },
  standard: { font: 1.00, padding: 1.00, radius: 16 },
  large:    { font: 1.15, padding: 1.20, radius: 20 },
  xl:       { font: 1.30, padding: 1.40, radius: 24 },
};
