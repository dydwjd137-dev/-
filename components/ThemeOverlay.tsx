/**
 * ThemeOverlay.tsx
 * 루트에 position:absolute로 렌더되는 전체화면 오버레이
 * - Night Shift: 따뜻한 주황색 색조 (nightShiftIntensity 연동)
 * - Grayscale: 회색 색조 (완전 그레이스케일 근사)
 * - 기타 모드: 완전 투명 (화면에 영향 없음)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/DisplayPreferencesContext';

export function ThemeOverlay() {
  const { prefs } = useTheme();
  const { themeMode, nightShiftIntensity } = prefs;

  if (themeMode === 'night-shift') {
    // intensity 0~100 → opacity 0.02~0.28
    const opacity = (nightShiftIntensity / 100) * 0.28;
    return (
      <View
        style={[styles.overlay, { backgroundColor: `rgba(255,140,30,${opacity.toFixed(3)})` }]}
        pointerEvents="none"
      />
    );
  }

  if (themeMode === 'grayscale') {
    return (
      <View
        style={[styles.overlay, { backgroundColor: 'rgba(40,40,40,0.42)' }]}
        pointerEvents="none"
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
});
