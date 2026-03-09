import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { PORTFOLIO_ANALYSIS_SAMPLE } from './sampleData';

const MINT = '#00FFA3'; const PINK = '#FF006B'; const PURPLE = '#6B4FFF'; const GOLD = '#FFD700';
const TEXT = '#E8E0FF'; const TEXT_SEC = '#8B7FBF';
const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
const CARD = { backgroundColor: 'rgba(107,79,255,0.06)', borderWidth: 1, borderColor: 'rgba(107,79,255,0.18)', borderRadius: 14, padding: 14 } as const;

type AnalysisData = typeof PORTFOLIO_ANALYSIS_SAMPLE;
interface Props { data?: AnalysisData; }

function scoreColor(score: number) {
  if (score >= 80) return MINT;
  if (score >= 60) return PURPLE;
  return GOLD;
}

export default function PortfolioAnalysis({ data = PORTFOLIO_ANALYSIS_SAMPLE }: Props) {
  return (
    <View style={s.root}>
      <Text style={[s.sectionTitle, { color: TEXT }]}>AI 포트폴리오 분석</Text>

      {/* Summary */}
      <View style={CARD}>
        <Text style={[s.label, { color: TEXT_SEC }]}>분석 요약</Text>
        <Text style={[s.summary, { color: TEXT }]}>{data.summary}</Text>
      </View>

      {/* Score bars */}
      <View style={CARD}>
        {data.scores.map((item, i) => {
          const color = scoreColor(item.score);
          return (
            <View key={i} style={[s.scoreItem, i > 0 && { marginTop: 16 }]}>
              <View style={s.scoreLabelRow}>
                <Text style={[s.scoreLabel, { color: TEXT }]}>{item.label}</Text>
                <Text style={[s.scoreNum, { color, fontFamily: MONO }]}>{item.score}</Text>
              </View>
              <View style={s.trackWrap}>
                <View style={[s.trackFill, { width: `${item.score}%`, backgroundColor: color }]} />
              </View>
              <Text style={[s.scoreDesc, { color: TEXT_SEC }]}>{item.description}</Text>
            </View>
          );
        })}
      </View>

      {/* Risks */}
      <View style={[CARD, { backgroundColor: 'rgba(255,0,107,0.06)', borderColor: 'rgba(255,0,107,0.2)' }]}>
        <View style={s.riskHeader}>
          <Text style={[s.riskTitle, { color: PINK }]}>⚠ 위험</Text>
        </View>
        {data.risks.map((r, i) => (
          <View key={i} style={s.riskRow}>
            <Text style={[s.riskDot, { color: PINK }]}>●</Text>
            <Text style={[s.riskText, { color: TEXT }]}>{r}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  label: { fontSize: 11, marginBottom: 8 },
  summary: { fontSize: 14, lineHeight: 22 },
  scoreItem: {},
  scoreLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  scoreLabel: { fontSize: 13, fontWeight: '600' },
  scoreNum: { fontSize: 14, fontWeight: '800' },
  trackWrap: { height: 7, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  trackFill: { height: '100%', borderRadius: 4 },
  scoreDesc: { fontSize: 11, lineHeight: 17 },
  riskHeader: { marginBottom: 10 },
  riskTitle: { fontSize: 13, fontWeight: '800' },
  riskRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  riskDot: { fontSize: 8, marginTop: 4 },
  riskText: { flex: 1, fontSize: 12, lineHeight: 19 },
});
