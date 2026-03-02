/**
 * PortfolioCharts.tsx
 * 재사용 가능한 자산 추이 차트 컴포넌트
 * - BarChart:  투자원금(보라) + 평가금액(초록/와인) 그룹 막대 (스크롤 가능)
 * - LineChart: SVG 에어리어 차트 – 교차 지점 기준 초록/와인 그라데이션
 * - PeriodSection: 제목 + 막대/라인 토글 + 차트 통합 컴포넌트
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  Rect,
  Circle,
  Line,
} from 'react-native-svg';
import { useTheme } from '../../contexts/DisplayPreferencesContext';

// ── 공개 타입 ────────────────────────────────────────────────
export interface SnapData {
  label: string;
  yearLabel?: string;
  totalValue: number;
  totalCost: number;
}

// ── 내부 유틸 ────────────────────────────────────────────────
type Pt = { x: number; y: number };

/** 두 선분의 교차점 반환 (없으면 null) */
function segmentIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): Pt | null {
  const dxA = x2 - x1, dyA = y2 - y1;
  const dxB = x4 - x3, dyB = y4 - y3;
  const denom = dxA * dyB - dyA * dxB;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((x3 - x1) * dyB - (y3 - y1) * dxB) / denom;
  const u = ((x3 - x1) * dyA - (y3 - y1) * dxA) / denom;
  if (t > 0 && t < 1 && u > 0 && u < 1) {
    return { x: x1 + t * dxA, y: y1 + t * dyA };
  }
  return null;
}

interface MergedPt { x: number; yV: number; yC: number }

/** 교차점을 삽입한 merged 배열 → 색상 세그먼트 분할 */
function buildCrossoverSegments(
  vPts: Pt[],
  cPts: Pt[],
): Array<{ pts: MergedPt[]; isGreen: boolean }> {
  const merged: MergedPt[] = [];

  for (let i = 0; i < vPts.length; i++) {
    if (i > 0) {
      const ix = segmentIntersect(
        vPts[i - 1].x, vPts[i - 1].y, vPts[i].x, vPts[i].y,
        cPts[i - 1].x, cPts[i - 1].y, cPts[i].x, cPts[i].y,
      );
      if (ix) merged.push({ x: ix.x, yV: ix.y, yC: ix.y });
    }
    merged.push({ x: vPts[i].x, yV: vPts[i].y, yC: cPts[i].y });
  }

  const result: Array<{ pts: MergedPt[]; isGreen: boolean }> = [];
  let segStart = 0;

  for (let i = 1; i <= merged.length; i++) {
    const isLast = i === merged.length;
    const isCross = !isLast && Math.abs(merged[i].yV - merged[i].yC) < 0.01;

    if (isLast || (isCross && i > segStart)) {
      const seg = merged.slice(segStart, i + (isCross ? 1 : 0));
      const mid = seg[Math.floor(seg.length / 2)];
      // SVG y축: 위로 갈수록 작음 → yV < yC 이면 value가 위(= 더 큰 값)
      result.push({ pts: seg, isGreen: mid.yV < mid.yC });
      segStart = isCross ? i : i;
    }
  }

  return result;
}

function pathFromPts(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function fmtKRW(v: number): string {
  if (v <= 0) return '-';
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`;
  return `₩${Math.round(v).toLocaleString()}`;
}

// ── 범례 ─────────────────────────────────────────────────────
function Legend() {
  const { themeColors } = useTheme();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#6B4FFF55', borderWidth: 1, borderColor: '#6B4FFF' }]} />
        <Text style={[styles.legendLabel, { color: themeColors.textSecondary }]}>투자원금</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: themeColors.profit + 'BB' }]} />
        <Text style={[styles.legendLabel, { color: themeColors.textSecondary }]}>평가금액</Text>
      </View>
    </View>
  );
}

// ── 막대 차트 ────────────────────────────────────────────────
const BAR_H = 90;
const COL_W = 38;

export function BarChart({ data }: { data: SnapData[] }) {
  const { themeColors } = useTheme();
  const hasData = data.some(d => d.totalValue > 0 || d.totalCost > 0);
  if (!hasData) {
    return <Text style={[styles.chartEmpty, { color: themeColors.textSecondary }]}>새로고침 후 차트가 표시됩니다</Text>;
  }

  const firstIdx = data.findIndex(d => d.totalValue > 0 || d.totalCost > 0);
  const visible = firstIdx > 0 ? data.slice(firstIdx) : data;
  const maxVal = Math.max(...visible.map(d => Math.max(d.totalValue, d.totalCost)), 1);

  return (
    <>
      <Legend />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.barRow}>
          {visible.map((d, i) => {
            const costH  = Math.max(2, (d.totalCost  / maxVal) * BAR_H);
            const valueH = Math.max(2, (d.totalValue / maxVal) * BAR_H);
            const valueColor = d.totalValue >= d.totalCost ? themeColors.profit : '#C0003C';
            return (
              <View key={i} style={{ width: COL_W, alignItems: 'center' }}>
                <View style={[styles.barGroup, { height: BAR_H }]}>
                  <View style={[styles.bar, { height: costH,  width: 11, backgroundColor: '#6B4FFF55', borderColor: '#6B4FFF99', borderWidth: 1 }]} />
                  <View style={[styles.bar, { height: valueH, width: 11, backgroundColor: valueColor + 'BB' }]} />
                </View>
                {d.yearLabel ? (
                  <Text style={[styles.xLabel, { color: themeColors.primary }]}>{d.yearLabel}</Text>
                ) : (
                  <Text style={[styles.xLabel, { color: themeColors.textSecondary }]}>{d.label}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

// ── 라인 차트 (SVG 에어리어) ─────────────────────────────────
const LINE_H = 130;
const PAD_H  = 6;
const PAD_V  = 10;

export function LineChart({ data }: { data: SnapData[] }) {
  const { themeColors } = useTheme();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const { width: screenW } = useWindowDimensions();
  // 카드 padding 16 × 2 + 화면 padding 16 × 2 = 64
  const W = Math.max(screenW - 64, 200);
  const usableW = W - PAD_H * 2;
  const usableH = LINE_H - PAD_V * 2;
  const bottomY = PAD_V + usableH;
  const n = data.length;

  const hasData = data.some(d => d.totalValue > 0 || d.totalCost > 0);
  if (!hasData || n < 2) {
    return <Text style={[styles.chartEmpty, { color: themeColors.textSecondary }]}>새로고침 후 차트가 표시됩니다</Text>;
  }

  // 앞쪽 0-데이터 제거: 스냅샷이 없는 날을 그리면 차트 바닥에 빨간 선이 생김
  const firstIdx = data.findIndex(d => d.totalValue > 0 || d.totalCost > 0);
  const visible = firstIdx > 0 ? data.slice(firstIdx) : data;
  const vn = visible.length;

  if (vn < 2) {
    return <Text style={[styles.chartEmpty, { color: themeColors.textSecondary }]}>새로고침 후 차트가 표시됩니다</Text>;
  }

  const maxVal = Math.max(...visible.map(d => Math.max(d.totalValue, d.totalCost)), 1);

  const xAt = (i: number) => PAD_H + (i / (vn - 1)) * usableW;
  const yAtVal = (v: number) => PAD_V + (1 - v / maxVal) * usableH;

  const vPts: Pt[] = visible.map((d, i) => ({ x: xAt(i), y: yAtVal(d.totalValue) }));
  const cPts: Pt[] = visible.map((d, i) => ({ x: xAt(i), y: yAtVal(d.totalCost)  }));

  const costLinePath  = pathFromPts(cPts);
  const valueLinePath = pathFromPts(vPts);

  // 투자원금 그라데이션 영역 (항상 표시)
  const costAreaD = `${costLinePath} L ${cPts[vn - 1].x.toFixed(1)},${bottomY} L ${cPts[0].x.toFixed(1)},${bottomY} Z`;

  // 교차 세그먼트 (초록 / 와인)
  const segments = buildCrossoverSegments(vPts, cPts);

  // X축 레이블 (최대 7개)
  const labelStep = Math.max(1, Math.floor((vn - 1) / 6));
  const labelIndices = new Set<number>();
  for (let i = 0; i < vn; i += labelStep) labelIndices.add(i);
  labelIndices.add(vn - 1);

  return (
    <>
      <Legend />
      <Svg width={W} height={LINE_H + 18}>
        <Defs>
          <LinearGradient id="lcCostGrad" x1="0" y1="0" x2="0" y2={LINE_H} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#6B4FFF" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#6B4FFF" stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="lcGreenGrad" x1="0" y1="0" x2="0" y2={LINE_H} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#00FFA3" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#00FFA3" stopOpacity="0.03" />
          </LinearGradient>
          <LinearGradient id="lcWineGrad" x1="0" y1="0" x2="0" y2={LINE_H} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#C0003C" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#C0003C" stopOpacity="0.03" />
          </LinearGradient>
        </Defs>

        {/* 투자원금 그라데이션 배경 */}
        <Path d={costAreaD} fill="url(#lcCostGrad)" />

        {/* 교차점별 초록/와인 영역 */}
        {segments.map((seg, idx) => {
          const fwd = seg.pts.map(p => `${p.x.toFixed(1)},${p.yV.toFixed(1)}`).join(' L ');
          const bwd = [...seg.pts].reverse().map(p => `${p.x.toFixed(1)},${p.yC.toFixed(1)}`).join(' L ');
          const d = `M ${fwd} L ${bwd} Z`;
          return (
            <Path
              key={idx}
              d={d}
              fill={seg.isGreen ? 'url(#lcGreenGrad)' : 'url(#lcWineGrad)'}
            />
          );
        })}

        {/* 투자원금 라인 */}
        <Path d={costLinePath} fill="none" stroke="#6B4FFF" strokeWidth={1.5} strokeOpacity={0.85} />

        {/* 평가금액 라인 */}
        <Path
          d={valueLinePath}
          fill="none"
          stroke={segments[Math.floor(segments.length / 2)]?.isGreen ? themeColors.profit : '#C0003C'}
          strokeWidth={2}
        />

        {/* 선택된 포인트 인디케이터 */}
        {selectedIdx !== null && (
          <>
            <Line
              x1={xAt(selectedIdx)} y1={PAD_V}
              x2={xAt(selectedIdx)} y2={bottomY}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <Circle
              cx={xAt(selectedIdx)}
              cy={yAtVal(visible[selectedIdx].totalCost)}
              r={4} fill="#6B4FFF"
            />
            <Circle
              cx={xAt(selectedIdx)}
              cy={yAtVal(visible[selectedIdx].totalValue)}
              r={4}
              fill={visible[selectedIdx].totalValue >= visible[selectedIdx].totalCost ? themeColors.profit : '#C0003C'}
            />
          </>
        )}

        {/* X축 레이블 */}
        {visible.map((d, i) => {
          if (!labelIndices.has(i)) return null;
          const x = xAt(i);
          const isYear = !!d.yearLabel;
          return (
            <SvgText
              key={i}
              x={x}
              y={LINE_H + 14}
              textAnchor="middle"
              fontSize={8}
              fill={isYear ? themeColors.primary : themeColors.textSecondary}
            >
              {isYear ? d.yearLabel : d.label}
            </SvgText>
          );
        })}

        {/* 터치 히트 영역 (투명 rect) */}
        {visible.map((_, i) => {
          const colW = vn > 1 ? usableW / (vn - 1) : usableW;
          const x = Math.max(0, xAt(i) - colW / 2);
          return (
            <Rect
              key={`hit-${i}`}
              x={x}
              y={0}
              width={colW}
              height={LINE_H}
              fill="transparent"
              onPress={() => setSelectedIdx(prev => prev === i ? null : i)}
            />
          );
        })}
      </Svg>

      {/* 선택 정보 패널 */}
      {selectedIdx !== null && (() => {
        const sel = visible[selectedIdx];
        const isProfit = sel.totalValue >= sel.totalCost;
        const pnl = sel.totalValue - sel.totalCost;
        return (
          <View style={[styles.selInfo, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <Text style={[styles.selDate, { color: themeColors.text }]}>
              {sel.yearLabel ? `${sel.yearLabel} ` : ''}{sel.label}
            </Text>
            <View style={styles.selRow}>
              <View style={[styles.selDot, { backgroundColor: '#6B4FFF' }]} />
              <Text style={[styles.selLabel, { color: themeColors.textSecondary }]}>투자원금</Text>
              <Text style={[styles.selVal, { color: themeColors.text }]}>{fmtKRW(sel.totalCost)}</Text>
            </View>
            <View style={styles.selRow}>
              <View style={[styles.selDot, { backgroundColor: isProfit ? themeColors.profit : '#C0003C' }]} />
              <Text style={[styles.selLabel, { color: themeColors.textSecondary }]}>평가금액</Text>
              <Text style={[styles.selVal, { color: isProfit ? themeColors.profit : '#C0003C' }]}>
                {fmtKRW(sel.totalValue)}
              </Text>
            </View>
            <View style={styles.selRow}>
              <View style={[styles.selDot, { backgroundColor: 'transparent' }]} />
              <Text style={[styles.selLabel, { color: themeColors.textSecondary }]}>손익</Text>
              <Text style={[styles.selVal, { color: isProfit ? themeColors.profit : '#C0003C' }]}>
                {isProfit ? '+' : ''}{fmtKRW(pnl)}
              </Text>
            </View>
          </View>
        );
      })()}
    </>
  );
}

// ── 뷰 토글 버튼 ─────────────────────────────────────────────
function ViewToggle({ view, onToggle }: { view: 'bar' | 'line'; onToggle: () => void }) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.toggleRow, { backgroundColor: themeColors.cardBackground }]}>
      {(['bar', 'line'] as const).map(v => (
        <TouchableOpacity
          key={v}
          style={[styles.toggleBtn, view === v && { backgroundColor: themeColors.primary }]}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <Text style={[styles.toggleLabel, { color: themeColors.textSecondary }, view === v && styles.toggleLabelActive]}>
            {v === 'bar' ? '막대' : '라인'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── 기간 변화 섹션 (외부 사용) ────────────────────────────────
interface PeriodSectionProps {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  data: SnapData[];
}

export function PeriodSection({ icon, title, subtitle, data }: PeriodSectionProps) {
  const { themeColors } = useTheme();
  const [view, setView] = useState<'bar' | 'line'>('bar');

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{title}</Text>
        <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text>
        <View style={{ flex: 1 }} />
        <ViewToggle view={view} onToggle={() => setView(v => v === 'bar' ? 'line' : 'bar')} />
      </View>
      <View style={[styles.chartCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        {view === 'bar' ? <BarChart data={data} /> : <LineChart data={data} />}
      </View>
    </View>
  );
}

// ── 스타일 ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 11,
  },
  chartEmpty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  barGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    borderRadius: 3,
  },
  xLabel: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    gap: 1,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: '#FFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 11,
    opacity: 0.7,
  },
  chartCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  selInfo: {
    marginTop: 10,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
  },
  selDate: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  selRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selLabel: {
    fontSize: 12,
    flex: 1,
  },
  selVal: {
    fontSize: 13,
    fontWeight: '700',
  },
});
