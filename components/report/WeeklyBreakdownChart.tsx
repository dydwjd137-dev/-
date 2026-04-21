import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { MONTHLY_SAMPLE } from './sampleData';

const MINT = '#00FFA3'; const PINK = '#FF006B';
const TEXT = '#E8E0FF'; const TEXT_SEC = '#8B7FBF';
const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const CARD = { backgroundColor: 'rgba(107,79,255,0.06)', borderWidth: 1, borderColor: 'rgba(107,79,255,0.18)', borderRadius: 14, padding: 14 } as const;

type WeekRow = typeof MONTHLY_SAMPLE.weeklyBreakdown[0];
interface Props { data: WeekRow[]; }

export default function WeeklyBreakdownChart({ data }: Props) {
  const { width } = useWindowDimensions();
  const chartW = width - 56;
  const chartH = 110;
  const PADX = 12;
  const maxAbs = Math.max(...data.map(d => Math.abs(d.returnPct)), 0.01);
  const midY = chartH / 2;
  const barSpacing = (chartW - PADX * 2) / data.length;
  const barW = barSpacing * 0.5;

  return (
    <View style={CARD}>
      <Text style={[s.title, { color: TEXT_SEC }]}>주차별 성과</Text>
      <Svg width={chartW} height={chartH}>
        <Line x1={PADX} y1={midY} x2={chartW - PADX} y2={midY} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        {data.map((d, i) => {
          const cx = PADX + i * barSpacing + barSpacing / 2;
          const barH = (Math.abs(d.returnPct) / maxAbs) * (midY - 14);
          const isPos = d.returnPct >= 0;
          const color = isPos ? MINT : PINK;
          return (
            <React.Fragment key={i}>
              <Rect x={cx - barW / 2} y={isPos ? midY - barH : midY} width={barW} height={Math.max(barH, 2)} fill={color} rx={2} />
              <SvgText x={cx} y={isPos ? midY - barH - 4 : midY + barH + 12} fontSize={10} fill={color} textAnchor="middle" fontFamily={MONO}>
                {`${d.returnPct >= 0 ? '+' : ''}${d.returnPct.toFixed(2)}%`}
              </SvgText>
              <SvgText x={cx} y={chartH - 2} fontSize={11} fill={TEXT_SEC} textAnchor="middle">{d.week.replace('주차', 'W')}</SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Table */}
      <View style={[s.tableHeader]}>
        {['주차', '기간', '수익률', '손익'].map(h => (
          <Text key={h} style={[s.th, { color: TEXT_SEC, flex: h === '기간' ? 2 : 1, textAlign: h === '주차' ? 'left' : 'right' }]}>{h}</Text>
        ))}
      </View>
      {data.map((d, i) => {
        const rc = d.returnPct >= 0 ? MINT : PINK;
        return (
          <View key={i} style={s.tableRow}>
            <Text style={[s.td, { color: TEXT, flex: 1 }]}>{d.week}</Text>
            <Text style={[s.td, { color: TEXT_SEC, flex: 2, textAlign: 'right' }]}>{d.startDate}~{d.endDate}</Text>
            <Text style={[s.td, { color: rc, flex: 1, textAlign: 'right', fontFamily: MONO }]}>{d.returnPct >= 0 ? '+' : ''}{d.returnPct.toFixed(2)}%</Text>
            <Text style={[s.td, { color: rc, flex: 1, textAlign: 'right', fontFamily: MONO }]}>{d.pnl >= 0 ? '+' : ''}${Math.abs(d.pnl)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, marginBottom: 8 },
  tableHeader: { flexDirection: 'row', marginTop: 12, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(107,79,255,0.18)' },
  tableRow: { flexDirection: 'row', paddingVertical: 6 },
  th: { fontSize: 12, fontWeight: '700' },
  td: { fontSize: 13 },
});
