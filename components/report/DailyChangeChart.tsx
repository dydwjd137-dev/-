import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { WEEKLY_SAMPLE } from './sampleData';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const CARD_BG   = 'rgba(107,79,255,0.06)';
const CARD_BDR  = 'rgba(107,79,255,0.18)';
const MINT      = '#00FFA3';
const PINK      = '#FF006B';
const TEXT      = '#E8E0FF';
const TEXT_SEC  = '#8B7FBF';
const MONO      = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type DailyItem = { day: string; date: string; change: number };

type Props = {
  daily: DailyItem[];
};

export default function DailyChangeChart({ daily }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const cardPad   = 14 * 2;
  const outerPad  = 16 * 2;
  const chartW    = windowWidth - outerPad - cardPad;
  const chartH    = 140;
  const paddingV  = 24; // top/bottom padding inside chart
  const barAreaH  = chartH - paddingV * 2;
  const halfH     = barAreaH / 2;
  const zeroY     = paddingV + halfH;

  const n        = daily.length;
  const barGap   = 8;
  const barW     = Math.max(12, (chartW - barGap * (n + 1)) / n);
  const maxAbs   = Math.max(...daily.map(d => Math.abs(d.change)), 1);

  function barHeight(change: number): number {
    return (Math.abs(change) / maxAbs) * halfH * 0.88;
  }

  const bestDay  = daily.reduce((a, b) => (b.change > a.change ? b : a));
  const worstDay = daily.reduce((a, b) => (b.change < a.change ? b : a));

  return (
    <View style={styles.card}>
      {/* Chart */}
      <Svg width={chartW} height={chartH}>
        {/* Zero line */}
        <Line
          x1={0}
          y1={zeroY}
          x2={chartW}
          y2={zeroY}
          stroke={CARD_BDR}
          strokeWidth={1}
          strokeDasharray="3,3"
        />

        {daily.map((item, i) => {
          const bH   = barHeight(item.change);
          const xMid = barGap + i * (barW + barGap) + barW / 2;
          const xLeft = barGap + i * (barW + barGap);
          const isPos = item.change >= 0;
          const color = isPos ? MINT : PINK;
          const barY  = isPos ? zeroY - bH : zeroY;

          return (
            <G key={i}>
              {/* Bar */}
              <Rect
                x={xLeft}
                y={barY}
                width={barW}
                height={Math.max(bH, 2)}
                fill={color}
                opacity={0.85}
                rx={3}
              />
              {/* Amount label */}
              <SvgText
                x={xMid}
                y={isPos ? barY - 4 : barY + bH + 12}
                textAnchor="middle"
                fontSize={11}
                fontFamily={MONO}
                fill={color}
              >
                {isPos ? '+' : ''}{item.change}
              </SvgText>
              {/* Day label */}
              <SvgText
                x={xMid}
                y={chartH - 4}
                textAnchor="middle"
                fontSize={12}
                fill={TEXT_SEC}
              >
                {item.day}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Best / Worst row */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomCell}>
          <Text style={styles.bottomLabel}>최고 일자</Text>
          <Text style={[styles.bottomValue, { color: MINT }]}>
            {bestDay.day} ({bestDay.date}) +${bestDay.change}
          </Text>
        </View>
        <View style={[styles.bottomCell, styles.bottomCellRight]}>
          <Text style={styles.bottomLabel}>최저 일자</Text>
          <Text style={[styles.bottomValue, { color: PINK }]}>
            {worstDay.day} ({worstDay.date}) ${worstDay.change}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BDR,
    borderRadius: 14,
    padding: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  bottomCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 8,
  },
  bottomCellRight: {
    alignItems: 'flex-end',
  },
  bottomLabel: {
    color: TEXT_SEC,
    fontSize: 13,
    marginBottom: 3,
  },
  bottomValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONO,
  },
});
