import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { TaxAdviceResponse, TaxStrategy } from '../../services/api/claude';

// ── 헬퍼 ──────────────────────────────────────────────────────

function formatKRW(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`;
  return `${n.toLocaleString()}원`;
}

const RISK_CONFIG = {
  low:    { color: '#00C896', label: '낮음', icon: 'shield-checkmark' as const },
  medium: { color: '#FF9800', label: '보통', icon: 'shield-half' as const },
  high:   { color: '#FF4444', label: '높음', icon: 'shield' as const },
};

const DIFFICULTY_CONFIG = {
  easy:   { color: '#00C896', label: '쉬움' },
  medium: { color: '#FF9800', label: '보통' },
  hard:   { color: '#FF4444', label: '어려움' },
};

const CATEGORY_ICONS: Record<TaxStrategy['category'], { icon: string; color: string }> = {
  isa:       { icon: 'shield-checkmark-outline', color: '#00C896' },
  tax_loss:  { icon: 'trending-down-outline',    color: '#6C63FF' },
  irp:       { icon: 'wallet-outline',           color: '#FF9800' },
  dividend:  { icon: 'cash-outline',             color: '#00BFFF' },
};

const ALERT_CONFIG = {
  info:    { bg: '#6C63FF15', border: '#6C63FF40', color: '#6C63FF', icon: 'information-circle-outline' as const },
  warning: { bg: '#FF980015', border: '#FF980040', color: '#FF9800', icon: 'warning-outline' as const },
  danger:  { bg: '#FF444415', border: '#FF444440', color: '#FF4444', icon: 'alert-circle-outline' as const },
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────

interface Props {
  data: TaxAdviceResponse;
}

export default function TaxAdviceView({ data }: Props) {
  const { themeColors } = useTheme();
  const risk = RISK_CONFIG[data.summary.riskLevel];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 알림 배너 ── */}
      {data.alerts.map((alert, i) => {
        const cfg = ALERT_CONFIG[alert.type];
        return (
          <View key={i} style={[styles.alertBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Ionicons name={cfg.icon} size={16} color={cfg.color} />
            <Text style={[styles.alertText, { color: cfg.color }]}>{alert.message}</Text>
          </View>
        );
      })}

      {/* ── 요약 수치 ── */}
      <View style={[styles.summaryCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="calculator-outline" size={15} color={themeColors.primary} />
          <Text style={[styles.summaryTitle, { color: themeColors.text }]}>세금 요약</Text>
          <View style={[styles.riskBadge, { backgroundColor: risk.color + '22' }]}>
            <Ionicons name={risk.icon} size={11} color={risk.color} />
            <Text style={[styles.riskText, { color: risk.color }]}>위험 {risk.label}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>예상 세금</Text>
            <Text style={[styles.summaryBig, { color: '#FF4444' }]}>
              {data.summary.totalTax > 0 ? formatKRW(data.summary.totalTax) : '-'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>절감 가능액</Text>
            <Text style={[styles.summaryBig, { color: '#00C896' }]}>
              {data.summary.taxSaving > 0 ? `+${formatKRW(data.summary.taxSaving)}` : '-'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>연간 배당</Text>
            <Text style={[styles.summaryMed, { color: themeColors.text }]}>
              {data.summary.annualDividend > 0 ? formatKRW(data.summary.annualDividend) : '-'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>미실현 수익</Text>
            <Text style={[styles.summaryMed, { color: themeColors.text }]}>
              {data.summary.unrealizedGain > 0 ? formatKRW(data.summary.unrealizedGain) : '-'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 전략 카드 ── */}
      {data.strategies.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb-outline" size={15} color="#FF9800" />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>절세 전략</Text>
          </View>
          {data.strategies.map((s, i) => {
            const catCfg = CATEGORY_ICONS[s.category] ?? { icon: 'star-outline', color: '#6C63FF' };
            const diffCfg = DIFFICULTY_CONFIG[s.difficulty];
            return (
              <View key={i} style={[styles.stratCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
                {/* 헤더 */}
                <View style={styles.stratHeader}>
                  <View style={[styles.rankBadge, { backgroundColor: '#6C63FF' }]}>
                    <Text style={styles.rankText}>{s.rank}</Text>
                  </View>
                  <View style={[styles.catBadge, { backgroundColor: catCfg.color + '22' }]}>
                    <Ionicons name={catCfg.icon as any} size={11} color={catCfg.color} />
                  </View>
                  <Text style={[styles.stratTitle, { color: themeColors.text }]} numberOfLines={2}>{s.title}</Text>
                </View>

                {/* 절감액 + 난이도 */}
                <View style={styles.stratMeta}>
                  {s.expectedSaving > 0 && (
                    <View style={[styles.savingBadge, { backgroundColor: '#00C89622' }]}>
                      <Text style={[styles.savingText, { color: '#00C896' }]}>
                        절감 {formatKRW(s.expectedSaving)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.diffBadge, { backgroundColor: diffCfg.color + '22' }]}>
                    <Text style={[styles.diffText, { color: diffCfg.color }]}>{diffCfg.label}</Text>
                  </View>
                  {s.deadline && (
                    <View style={[styles.deadlineBadge, { borderColor: themeColors.border }]}>
                      <Ionicons name="time-outline" size={10} color={themeColors.textSecondary} />
                      <Text style={[styles.deadlineText, { color: themeColors.textSecondary }]}>{s.deadline}</Text>
                    </View>
                  )}
                </View>

                {/* 단계별 실행 */}
                {s.steps.length > 0 && (
                  <View style={[styles.stepsWrap, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                    {s.steps.map((step, j) => (
                      <View key={j} style={styles.stepRow}>
                        <View style={[styles.stepDot, { backgroundColor: '#6C63FF' }]} />
                        <Text style={[styles.stepText, { color: themeColors.text }]}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 경고 */}
                {s.warning && (
                  <View style={[styles.warningRow, { backgroundColor: '#FF980015' }]}>
                    <Ionicons name="warning-outline" size={13} color="#FF9800" />
                    <Text style={[styles.warningText, { color: '#FF9800' }]}>{s.warning}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 14, paddingBottom: 24 },

  // Alerts
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  alertText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },

  // Summary
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 10, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 40, marginHorizontal: 8 },
  summaryLabel: { fontSize: 11 },
  summaryBig: { fontSize: 22, fontWeight: '800' },
  summaryMed: { fontSize: 16, fontWeight: '700' },

  // Section
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },

  // Strategy
  stratCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  stratHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  catBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stratTitle: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  stratMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  savingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  savingText: { fontSize: 11, fontWeight: '700' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  diffText: { fontSize: 11, fontWeight: '700' },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  deadlineText: { fontSize: 10 },
  stepsWrap: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20 },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 8,
    padding: 8,
  },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
