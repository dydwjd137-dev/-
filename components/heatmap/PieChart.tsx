import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import {
  EnrichedHolding,
  AccountType,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_COLORS,
  BROKERAGE_LIST,
} from '../../types/portfolio';
import { formatKRW, formatPercent } from '../../utils/portfolioCalculations';

interface PieChartProps {
  holdings: EnrichedHolding[];
  exchangeRate: number;
  showKRW: boolean;
}

interface Slice {
  category: string;
  value: number;
  percent: number;
  color: string;
  holdings: EnrichedHolding[];
}

type PieMode = 'category' | 'account' | 'brokerage';

const PALETTE = [
  '#6B4FFF', '#00C896', '#FF9500', '#FF6B6B', '#5AC8FA',
  '#FFD60A', '#FF375F', '#30D158', '#64D2FF', '#BF5AF2',
  '#FF9F0A', '#32ADE6', '#AC8E68',
];

// 색상 선택기 팔레트 (6열 × 5행)
const COLOR_PICKER_PALETTE = [
  '#6B4FFF', '#5856D6', '#007AFF', '#32ADE6', '#5AC8FA', '#64D2FF',
  '#00C896', '#30D158', '#34C759', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFD60A', '#FFCD00', '#FF9F0A', '#FF9500', '#FF6600', '#FF3B30',
  '#FF6B6B', '#FF375F', '#FF2D55', '#BF5AF2', '#AF52DE', '#E91E63',
  '#AC8E68', '#A2845E', '#8E8E93', '#636366', '#48484A', '#1C1C1E',
];

const MODE_LABELS: Record<PieMode, string> = {
  category: '카테고리',
  account: '계좌유형',
  brokerage: '증권사',
};

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number, gap = 1.5): string {
  const s = start + gap;
  const e = end - gap;
  const sp = polarToXY(cx, cy, r, s);
  const ep = polarToXY(cx, cy, r, e);
  const large = e - s > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${sp.x} ${sp.y} A ${r} ${r} 0 ${large} 1 ${ep.x} ${ep.y} Z`;
}

const SCREEN_W = Dimensions.get('window').width;
const SIZE = Math.min(SCREEN_W - 48, 280);
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = SIZE / 2 - 8;
const R_INNER = R_OUTER * 0.52;

export function PieChart({ holdings, exchangeRate, showKRW }: PieChartProps) {
  const { themeColors } = useTheme();
  const [selectedSlice, setSelectedSlice] = useState<Slice | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [pieMode, setPieMode] = useState<PieMode>('category');
  const [colorPickerSlice, setColorPickerSlice] = useState<Slice | null>(null);
  const [customColors, setCustomColors] = useState<Map<string, string>>(new Map());

  const slices = useMemo<Slice[]>(() => {
    const map = new Map<string, EnrichedHolding[]>();
    holdings.forEach(h => {
      let key: string;
      if (pieMode === 'category') key = h.category;
      else if (pieMode === 'account') key = h.accountType ?? 'REGULAR';
      else key = h.brokerage ?? '미설정';
      const list = map.get(key) ?? [];
      list.push(h);
      map.set(key, list);
    });

    const total = holdings.reduce((s, h) => s + h.currentValue, 0);

    return Array.from(map.entries())
      .map(([key, hs], i) => {
        const value = hs.reduce((s, h) => s + h.currentValue, 0);
        let displayName = key;
        let defaultColor = PALETTE[i % PALETTE.length];

        if (pieMode === 'account') {
          displayName = ACCOUNT_TYPE_LABELS[key as AccountType] ?? key;
          defaultColor = ACCOUNT_TYPE_COLORS[key as AccountType] ?? defaultColor;
        } else if (pieMode === 'brokerage') {
          const broker = BROKERAGE_LIST.find(b => b.id === key);
          displayName = broker?.name ?? key;
          defaultColor = broker?.color ?? defaultColor;
        }

        const color = customColors.get(displayName) ?? defaultColor;

        return {
          category: displayName,
          value,
          percent: total > 0 ? (value / total) * 100 : 0,
          color,
          holdings: hs.sort((a, b) => b.currentValue - a.currentValue),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [holdings, pieMode, customColors]);

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);

  const fv = (krw: number) =>
    showKRW
      ? formatKRW(krw)
      : `$${(krw / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const sliceAngles: { start: number; end: number }[] = [];
  let cursor = 0;
  slices.forEach(s => {
    const sweep = (s.percent / 100) * 360;
    sliceAngles.push({ start: cursor, end: cursor + sweep });
    cursor += sweep;
  });

  const centerLabel = activeIdx !== null ? slices[activeIdx] : null;

  const handleModeChange = (mode: PieMode) => {
    setPieMode(mode);
    setActiveIdx(null);
    setSelectedSlice(null);
  };

  return (
    <View style={styles.container}>
      {/* 모드 토글 */}
      <View style={[styles.modeToggle, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        {(['category', 'account', 'brokerage'] as PieMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeBtn, pieMode === mode && { backgroundColor: themeColors.primary }]}
            onPress={() => handleModeChange(mode)}
          >
            <Text style={[styles.modeBtnText, { color: themeColors.textSecondary }, pieMode === mode && { color: themeColors.text }]}>
              {MODE_LABELS[mode]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 파이 차트 SVG */}
      <View style={styles.chartWrapper}>
        <Svg width={SIZE} height={SIZE}>
          <G>
            {slices.map((slice, i) => {
              const { start, end } = sliceAngles[i];
              const isActive = activeIdx === i;
              const r = isActive ? R_OUTER + 6 : R_OUTER;
              return (
                <Path
                  key={slice.category}
                  d={arcPath(CX, CY, r, start, end)}
                  fill={slice.color}
                  opacity={activeIdx !== null && !isActive ? 0.45 : 1}
                  onPress={() => setActiveIdx(prev => (prev === i ? null : i))}
                />
              );
            })}
            <Circle cx={CX} cy={CY} r={R_INNER} fill={themeColors.background} />
          </G>

          {centerLabel ? (
            <>
              <SvgText x={CX} y={CY - 16} textAnchor="middle" fill={centerLabel.color} fontSize={13} fontWeight="700">
                {centerLabel.category}
              </SvgText>
              <SvgText x={CX} y={CY + 4} textAnchor="middle" fill={themeColors.text} fontSize={15} fontWeight="800">
                {centerLabel.percent.toFixed(1)}%
              </SvgText>
              <SvgText x={CX} y={CY + 20} textAnchor="middle" fill={themeColors.textSecondary} fontSize={11}>
                {fv(centerLabel.value)}
              </SvgText>
            </>
          ) : (
            <>
              <SvgText x={CX} y={CY - 8} textAnchor="middle" fill={themeColors.textSecondary} fontSize={11}>
                총 평가금액
              </SvgText>
              <SvgText x={CX} y={CY + 10} textAnchor="middle" fill={themeColors.text} fontSize={15} fontWeight="800">
                {fv(totalValue)}
              </SvgText>
            </>
          )}
        </Svg>
      </View>

      {/* 범례 안내 */}
      <View style={styles.legendHint}>
        <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>● 색상변경</Text>
        <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>이름 → 강조</Text>
        <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>% → 상세</Text>
      </View>

      {/* 범례: 좌(색상변경) | 중(강조) | 우(상세모달) */}
      <View style={styles.legend}>
        {slices.map((slice, i) => {
          const isActive = activeIdx === i;
          return (
            <View
              key={slice.category}
              style={[
                styles.legendItem,
                { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
                isActive && { borderColor: themeColors.primary, backgroundColor: themeColors.cardBackground },
              ]}
            >
              {/* 좌: 색상 도트 → 색상 선택기 */}
              <TouchableOpacity
                style={styles.legendDotBtn}
                onPress={() => setColorPickerSlice(slice)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              </TouchableOpacity>

              <View style={[styles.legendDivider, { backgroundColor: themeColors.border }]} />

              {/* 중: 카테고리명 → 그래프 강조 */}
              <TouchableOpacity
                style={styles.legendCatBtn}
                onPress={() => setActiveIdx(prev => (prev === i ? null : i))}
              >
                <Text style={[styles.legendCat, { color: themeColors.textSecondary }, isActive && { color: themeColors.text }]} numberOfLines={1}>
                  {slice.category}
                </Text>
              </TouchableOpacity>

              <View style={[styles.legendDivider, { backgroundColor: themeColors.border }]} />

              {/* 우: 비중% + 화살표 → 상세 모달 */}
              <TouchableOpacity
                style={styles.legendRightBtn}
                onPress={() => setSelectedSlice(slice)}
              >
                <Text style={[styles.legendPct, { color: slice.color }]}>
                  {slice.percent.toFixed(1)}%
                </Text>
                <Ionicons name="chevron-forward" size={14} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* ── 색상 선택기 모달 ── */}
      <Modal
        visible={colorPickerSlice !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setColorPickerSlice(null)}
      >
        <TouchableOpacity
          style={styles.colorOverlay}
          activeOpacity={1}
          onPress={() => setColorPickerSlice(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.colorSheet, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
              <View style={styles.colorSheetHeader}>
                <View style={[styles.colorPreviewDot, { backgroundColor: colorPickerSlice?.color }]} />
                <Text style={[styles.colorSheetTitle, { color: themeColors.text }]}>{colorPickerSlice?.category} 색상</Text>
                <TouchableOpacity onPress={() => setColorPickerSlice(null)}>
                  <Ionicons name="close" size={22} color={themeColors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.colorGrid}>
                {COLOR_PICKER_PALETTE.map(c => {
                  const isSelected = colorPickerSlice?.color === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, isSelected && styles.colorSwatchActive]}
                      onPress={() => {
                        if (colorPickerSlice) {
                          setCustomColors(prev => {
                            const next = new Map(prev);
                            next.set(colorPickerSlice.category, c);
                            return next;
                          });
                          setColorPickerSlice(null);
                        }
                      }}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 섹터 상세 모달 ── */}
      <Modal
        visible={selectedSlice !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedSlice(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: themeColors.background }]}>
            {selectedSlice && (
              <>
                <View style={[styles.sheetHeader, { borderBottomColor: themeColors.border }]}>
                  <View style={styles.sheetTitleRow}>
                    <View style={[styles.sliceDot, { backgroundColor: selectedSlice.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetTitle, { color: themeColors.text }]}>{selectedSlice.category}</Text>
                      <Text style={[styles.sheetSub, { color: themeColors.textSecondary }]}>{selectedSlice.holdings.length}종목</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedSlice(null)}>
                      <Ionicons name="close" size={26} color={themeColors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.sectorSummary, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>비중</Text>
                      <Text style={[styles.summaryValue, { color: selectedSlice.color }]}>
                        {selectedSlice.percent.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>평가금액</Text>
                      <Text style={[styles.summaryValue, { color: themeColors.text }]}>{fv(selectedSlice.value)}</Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>수익률</Text>
                      {(() => {
                        const tc = selectedSlice.holdings.reduce((s, h) => s + h.totalCost, 0);
                        const pl = selectedSlice.value - tc;
                        const pct = tc > 0 ? (pl / tc) * 100 : 0;
                        return (
                          <Text style={[styles.summaryValue, { color: pct >= 0 ? themeColors.profit : themeColors.loss }]}>
                            {formatPercent(pct)}
                          </Text>
                        );
                      })()}
                    </View>
                  </View>
                </View>
                <FlatList
                  data={selectedSlice.holdings}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.holdingList}
                  renderItem={({ item }) => {
                    const isProfit = item.profitLossPercent >= 0;
                    const pct = selectedSlice.value > 0 ? (item.currentValue / selectedSlice.value) * 100 : 0;
                    return (
                      <View style={[styles.holdingRow, { borderBottomColor: themeColors.border }]}>
                        <View style={[styles.holdingBar, { backgroundColor: selectedSlice.color }]} />
                        <View style={styles.holdingLeft}>
                          <Text style={[styles.holdingTicker, { color: themeColors.text }]}>{item.ticker}</Text>
                          <Text style={[styles.holdingCategory, { color: themeColors.textSecondary }]}>{pct.toFixed(1)}%</Text>
                        </View>
                        <View style={styles.holdingRight}>
                          <Text style={[styles.holdingValue, { color: themeColors.text }]}>{fv(item.currentValue)}</Text>
                          <Text style={[styles.holdingReturn, { color: isProfit ? themeColors.profit : themeColors.loss }]}>
                            {formatPercent(item.profitLossPercent)}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },

  // 모드 토글
  modeToggle: {
    flexDirection: 'row', gap: 6, marginBottom: 16,
    borderRadius: 12, padding: 4,
    borderWidth: 1,
  },
  modeBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  modeBtnText: { fontSize: 12, fontWeight: '600' },

  chartWrapper: { marginBottom: 12 },

  // 범례 안내
  legendHint: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 28,
    marginBottom: 6,
  },
  hintText: { fontSize: 10, opacity: 0.6 },

  // 범례
  legend: { width: '100%', paddingHorizontal: 24, gap: 6 },
  legendItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  legendDotBtn: { padding: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendDivider: { width: 1, height: 36 },
  legendCatBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, justifyContent: 'center' },
  legendCat: { fontSize: 13, fontWeight: '500' },
  legendRightBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10, paddingRight: 12 },
  legendPct: { fontSize: 13, fontWeight: '700' },

  // 색상 선택기
  colorOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  colorSheet: {
    borderRadius: 20, padding: 20,
    width: SCREEN_W - 48,
    borderWidth: 1,
  },
  colorSheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  colorPreviewDot: { width: 20, height: 20, borderRadius: 10 },
  colorSheetTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  colorGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 3, borderColor: '#fff',
  },

  // 섹터 상세 모달
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  sheetHeader: { padding: 24, borderBottomWidth: 1 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  sliceDot: { width: 18, height: 18, borderRadius: 9 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  sheetSub: { fontSize: 13, marginTop: 2 },
  sectorSummary: {
    flexDirection: 'row',
    borderRadius: 12, padding: 16,
    borderWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryDivider: { width: 1, marginVertical: 4 },
  holdingList: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  holdingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 10,
    borderBottomWidth: 1,
  },
  holdingBar: { width: 3, height: 36, borderRadius: 2 },
  holdingLeft: { flex: 1 },
  holdingTicker: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  holdingCategory: { fontSize: 12 },
  holdingRight: { alignItems: 'flex-end' },
  holdingValue: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  holdingReturn: { fontSize: 13, fontWeight: '600' },
});
