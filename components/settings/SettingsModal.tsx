import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, HeatmapLabelMode } from '../../contexts/DisplayPreferencesContext';
import { ThemeMode, AccentColor, ScreenSizeMode, ACCENT_MAP } from '../../constants/themes';
import { SnapshotManagerModal } from './SnapshotManagerModal';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'dark',          label: '다크',       icon: 'moon' },
  { mode: 'light',         label: '라이트',     icon: 'sunny' },
  { mode: 'system',        label: '시스템',     icon: 'phone-portrait' },
  { mode: 'night-shift',   label: '야간',       icon: 'partly-sunny' },
  { mode: 'grayscale',     label: '그레이스케일', icon: 'contrast' },
  { mode: 'high-contrast', label: '고대비',     icon: 'eye' },
];

const ACCENT_OPTIONS: { color: AccentColor; hex: string; label: string }[] = [
  { color: 'purple', hex: '#6B4FFF', label: '보라' },
  { color: 'blue',   hex: '#0A84FF', label: '파랑' },
  { color: 'green',  hex: '#00C896', label: '초록' },
  { color: 'orange', hex: '#FF8C00', label: '주황' },
];

const SIZE_OPTIONS: { mode: ScreenSizeMode; label: string }[] = [
  { mode: 'compact',  label: '소형' },
  { mode: 'standard', label: '표준' },
  { mode: 'large',    label: '대형' },
  { mode: 'xl',       label: 'XL' },
];

const LABEL_OPTIONS: { mode: HeatmapLabelMode; label: string }[] = [
  { mode: 'ticker', label: '티커' },
  { mode: 'nameKr', label: '한국명' },
  { mode: 'nameEn', label: '영문명' },
];

// ─── Night Shift Intensity Slider ───────────────────────────────────────────
function IntensitySlider({
  value,
  onChange,
  accentColor,
}: {
  value: number;
  onChange: (v: number) => void;
  accentColor: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (trackWidth <= 0) return;
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth));
        onChange(Math.round(pct * 100));
      },
      onPanResponderMove: (e) => {
        if (trackWidth <= 0) return;
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth));
        onChange(Math.round(pct * 100));
      },
    }),
  ).current;

  const thumbLeft = trackWidth > 0 ? (value / 100) * (trackWidth - 20) : 0;

  return (
    <View style={sliderStyles.wrapper}>
      <View
        style={sliderStyles.touchArea}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...pan.panHandlers}
      >
        {/* Track background */}
        <View style={sliderStyles.track}>
          {/* Fill */}
          <View
            style={[
              sliderStyles.fill,
              { width: trackWidth > 0 ? (value / 100) * trackWidth : 0, backgroundColor: accentColor },
            ]}
          />
        </View>
        {/* Thumb */}
        <View
          style={[
            sliderStyles.thumb,
            { left: thumbLeft, backgroundColor: accentColor, shadowColor: accentColor },
          ]}
        />
      </View>
      <Text style={[sliderStyles.valueLabel, { color: accentColor }]}>{value}%</Text>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: { paddingVertical: 8 },
  touchArea: { height: 44, justifyContent: 'center' },
  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 2 },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: 12,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 2,
  },
});

// ─── Section Title ───────────────────────────────────────────────────────────
function SectionTitle({
  title,
  color,
  accent,
}: {
  title: string;
  color: string;
  accent: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionAccentBar, { backgroundColor: accent }]} />
      <Text style={[styles.sectionTitleText, { color }]}>{title}</Text>
    </View>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────
export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { prefs, themeColors, updatePref } = useTheme();
  const accentHex = ACCENT_MAP[prefs.accentColor];
  const [showSnapshotManager, setShowSnapshotManager] = useState(false);

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>설정</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── 히트맵 라벨 ── */}
          <SectionTitle title="히트맵 미국주식 이름" color={themeColors.textSecondary} accent={accentHex} />
          <View style={styles.rowGroup}>
            {LABEL_OPTIONS.map((opt) => {
              const active = prefs.heatmapLabelMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.segmentBtn,
                    { borderColor: themeColors.border, backgroundColor: themeColors.cardBackground },
                    active && { backgroundColor: accentHex, borderColor: accentHex },
                  ]}
                  onPress={() => updatePref('heatmapLabelMode', opt.mode)}
                >
                  <Text style={[styles.segmentText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
            * 한국주식은 항상 한국명, US ETF는 항상 티커로 표시
          </Text>

          {/* ── 테마 ── */}
          <SectionTitle title="테마" color={themeColors.textSecondary} accent={accentHex} />
          <View style={styles.themeGrid}>
            {THEME_OPTIONS.map((opt) => {
              const active = prefs.themeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.themeCard,
                    { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
                    active && { borderColor: accentHex, borderWidth: 2 },
                  ]}
                  onPress={() => updatePref('themeMode', opt.mode)}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={active ? accentHex : themeColors.textSecondary}
                  />
                  <Text style={[styles.themeCardLabel, { color: active ? accentHex : themeColors.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 야간 모드 강도 (night-shift 선택 시만) ── */}
          {prefs.themeMode === 'night-shift' && (
            <>
              <SectionTitle title="야간 모드 강도" color={themeColors.textSecondary} accent={accentHex} />
              <View style={[styles.sliderCard, { backgroundColor: themeColors.cardBackground }]}>
                <IntensitySlider
                  value={prefs.nightShiftIntensity}
                  onChange={(v) => updatePref('nightShiftIntensity', v)}
                  accentColor={accentHex}
                />
              </View>
            </>
          )}

          {/* ── 액센트 컬러 ── */}
          <SectionTitle title="액센트 컬러" color={themeColors.textSecondary} accent={accentHex} />
          <View style={styles.accentRow}>
            {ACCENT_OPTIONS.map((opt) => {
              const active = prefs.accentColor === opt.color;
              return (
                <TouchableOpacity
                  key={opt.color}
                  style={[
                    styles.accentCircle,
                    { backgroundColor: opt.hex },
                    active && { borderWidth: 3, borderColor: '#fff' },
                  ]}
                  onPress={() => updatePref('accentColor', opt.color)}
                >
                  {active && <Ionicons name="checkmark" size={18} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 화면 크기 ── */}
          <SectionTitle title="화면 크기" color={themeColors.textSecondary} accent={accentHex} />
          <View style={styles.rowGroup}>
            {SIZE_OPTIONS.map((opt) => {
              const active = prefs.screenSizeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.segmentBtn,
                    { borderColor: themeColors.border, backgroundColor: themeColors.cardBackground },
                    active && { backgroundColor: accentHex, borderColor: accentHex },
                  ]}
                  onPress={() => updatePref('screenSizeMode', opt.mode)}
                >
                  <Text style={[styles.segmentText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── 데이터 관리 ── */}
          <SectionTitle title="데이터 관리" color={themeColors.textSecondary} accent={accentHex} />
          <TouchableOpacity
            style={[styles.menuRow, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
            onPress={() => setShowSnapshotManager(true)}
          >
            <Ionicons name="albums-outline" size={18} color={accentHex} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: themeColors.text }]}>스냅샷 히스토리 관리</Text>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </View>

    </Modal>

    <SnapshotManagerModal
      visible={showSnapshotManager}
      onClose={() => setShowSnapshotManager(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  closeBtn: { padding: 4 },
  scroll: { flex: 1, paddingHorizontal: 24 },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionAccentBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  rowGroup: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '600' },

  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeCard: {
    width: '31%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  themeCardLabel: { fontSize: 11, fontWeight: '600' },

  sliderCard: { paddingHorizontal: 16, borderRadius: 12 },

  accentRow: { flexDirection: 'row', gap: 16, paddingLeft: 4 },
  accentCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  hint: { fontSize: 11, marginTop: 8, opacity: 0.7 },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: { marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
});
