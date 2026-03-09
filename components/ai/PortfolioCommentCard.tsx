import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { PortfolioCommentResponse } from '../../services/api/claude';

const METRIC_COLORS: Record<string, string> = {
  green:  '#00C896',
  blue:   '#6C63FF',
  orange: '#FF9800',
  red:    '#FF4444',
};

interface Props {
  data: PortfolioCommentResponse;
}

export default function PortfolioCommentCard({ data }: Props) {
  const { themeColors } = useTheme();

  return (
    <View style={styles.root}>
      {/* ── 요약 ── */}
      {!!data.summary && (
        <View style={[styles.summaryCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
          <View style={styles.summaryHeader}>
            <Ionicons name="analytics-outline" size={15} color={themeColors.primary} />
            <Text style={[styles.summaryTitle, { color: themeColors.text }]}>AI 분석 요약</Text>
          </View>
          <Text style={[styles.summaryText, { color: themeColors.text }]}>{data.summary}</Text>
        </View>
      )}

      {/* ── 지표 ── */}
      {data.metrics && data.metrics.length > 0 && (
        <View style={[styles.metricsCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
          {data.metrics.map((m, i) => {
            const mc = METRIC_COLORS[m.color] ?? '#6C63FF';
            return (
              <View key={i} style={[styles.metricRow, i > 0 && { borderTopWidth: 1, borderTopColor: themeColors.border, paddingTop: 12, marginTop: 4 }]}>
                <View style={styles.metricLabelRow}>
                  <Text style={[styles.metricLabel, { color: themeColors.text }]}>{m.label}</Text>
                  <Text style={[styles.metricScore, { color: mc }]}>{m.score}</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: themeColors.border }]}>
                  <View style={[styles.progressFill, { width: `${m.score}%` as any, backgroundColor: mc }]} />
                </View>
                <Text style={[styles.metricComment, { color: themeColors.textSecondary }]}>{m.comment}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── 구조 분석 / 위험 ── */}
      {((data.structure && data.structure.length > 0) || (data.risks && data.risks.length > 0)) && (
        <View style={styles.swRow}>
          {data.structure && data.structure.length > 0 && (
            <View style={[styles.swCard, { backgroundColor: '#00C89610', borderColor: '#00C89630', flex: 1 }]}>
              <View style={styles.swHeader}>
                <Ionicons name="layers-outline" size={14} color="#00C896" />
                <Text style={[styles.swTitle, { color: '#00C896' }]}>구조 분석</Text>
              </View>
              {data.structure.map((s, i) => (
                <View key={i} style={styles.swItemRow}>
                  <View style={[styles.swDot, { backgroundColor: '#00C896' }]} />
                  <Text style={[styles.swItem, { color: themeColors.text }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}
          {data.risks && data.risks.length > 0 && (
            <View style={[styles.swCard, { backgroundColor: '#FF444410', borderColor: '#FF444430', flex: 1 }]}>
              <View style={styles.swHeader}>
                <Ionicons name="warning-outline" size={14} color="#FF4444" />
                <Text style={[styles.swTitle, { color: '#FF4444' }]}>위험</Text>
              </View>
              {data.risks.map((r, i) => (
                <View key={i} style={styles.swItemRow}>
                  <View style={[styles.swDot, { backgroundColor: '#FF4444' }]} />
                  <Text style={[styles.swItem, { color: themeColors.text }]}>{r}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── 참고 포인트 ── */}
      {data.notes && data.notes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={15} color="#6C63FF" />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>참고 포인트</Text>
          </View>
          {data.notes.map((note, i) => (
            <View key={i} style={[styles.noteCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
              <View style={[styles.noteDot, { backgroundColor: '#6C63FF' }]} />
              <Text style={[styles.noteText, { color: themeColors.text }]}>{note}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },

  // Summary
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTitle: { fontSize: 13, fontWeight: '700' },
  summaryText: { fontSize: 14, lineHeight: 22 },

  // Metrics
  metricsCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  metricRow: { gap: 4 },
  metricLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: 13 },
  metricScore: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  metricComment: { fontSize: 11 },

  // Structure / Risks
  swRow: { flexDirection: 'row', gap: 10 },
  swCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  swHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swTitle: { fontSize: 12, fontWeight: '700' },
  swItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  swDot: { width: 5, height: 5, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  swItem: { flex: 1, fontSize: 12, lineHeight: 18 },

  // Notes
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  noteCard: {
    borderRadius: 12, borderWidth: 1, padding: 12,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  noteDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  noteText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
