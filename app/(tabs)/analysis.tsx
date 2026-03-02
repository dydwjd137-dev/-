import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { EnrichedHolding, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS, AccountType } from '../../types/portfolio';
import { formatKRW } from '../../utils/taxEngine';

// ── 색상 팔레트 ───────────────────────────────────────────────
const PALETTE = [
  '#6B4FFF', '#00FFA3', '#FFD700', '#FF006B',
  '#00BFFF', '#FF8C00', '#A855F7', '#2ECC71',
  '#E74C3C', '#3498DB', '#F1C40F', '#1ABC9C',
];

// ── 그룹 집계 헬퍼 ────────────────────────────────────────────
function groupBy<K extends string>(
  holdings: EnrichedHolding[],
  keyFn: (h: EnrichedHolding) => K,
): { key: K; value: number; count: number }[] {
  const map = new Map<K, { value: number; count: number }>();
  for (const h of holdings) {
    const k = keyFn(h);
    const cur = map.get(k) ?? { value: 0, count: 0 };
    map.set(k, { value: cur.value + h.currentValue, count: cur.count + 1 });
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.value - a.value);
}

// ── 가로 막대 차트 행 ─────────────────────────────────────────
function BarRow({
  label,
  value,
  totalValue,
  color,
  count,
  themeColors,
}: {
  label: string;
  value: number;
  totalValue: number;
  color: string;
  count: number;
  themeColors: ReturnType<typeof useTheme>['themeColors'];
}) {
  const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;

  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelRow}>
        <View style={[barStyles.dot, { backgroundColor: color }]} />
        <Text style={[barStyles.label, { color: themeColors.text }]} numberOfLines={1}>{label}</Text>
        <Text style={[barStyles.count, { color: themeColors.textSecondary }]}>{count}종목</Text>
        <Text style={[barStyles.pct, { color: themeColors.text }]}>{pct.toFixed(1)}%</Text>
      </View>
      <View style={[barStyles.track, { backgroundColor: themeColors.border }]}>
        <View style={[barStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[barStyles.amount, { color: themeColors.textSecondary }]}>{formatKRW(value)}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 13, fontWeight: '600' },
  count: { fontSize: 11 },
  pct: { fontSize: 13, fontWeight: '700', minWidth: 42, textAlign: 'right' },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fill: { height: '100%', borderRadius: 4 },
  amount: { fontSize: 12, textAlign: 'right' },
});

// ── 섹션 래퍼 ─────────────────────────────────────────────────
function Section({ icon, title, children, themeColors }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
  themeColors: ReturnType<typeof useTheme>['themeColors'];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={16} color={themeColors.primary} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
      </View>
      <View style={[styles.sectionCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        {children}
      </View>
    </View>
  );
}

// ── 메인 화면 ─────────────────────────────────────────────────
export default function AnalysisScreen() {
  const { themeColors } = useTheme();
  const { holdings, summary } = usePortfolio();

  const totalValue = summary?.totalValue ?? 0;

  const byCategory = useMemo(
    () => groupBy(holdings, h => h.category || '미분류'),
    [holdings],
  );

  const byAccount = useMemo(
    () => groupBy(holdings, h => (h.accountType ?? 'REGULAR') as AccountType),
    [holdings],
  );

  const byCurrency = useMemo(() => {
    const krw = holdings.filter(h => h.ticker.endsWith('.KS') || h.ticker.endsWith('.KQ'));
    const usd = holdings.filter(h => !h.ticker.endsWith('.KS') && !h.ticker.endsWith('.KQ'));
    return [
      { key: '국내주식 (KRW)', value: krw.reduce((s, h) => s + h.currentValue, 0), count: krw.length, color: '#FF9500' },
      { key: '해외주식 (USD)', value: usd.reduce((s, h) => s + h.currentValue, 0), count: usd.length, color: '#6B4FFF' },
    ].filter(g => g.count > 0);
  }, [holdings]);

  // 상위 비중 종목
  const topHoldings = useMemo(
    () => [...holdings]
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 5),
    [holdings],
  );

  if (holdings.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
        <Ionicons name="pie-chart-outline" size={56} color={themeColors.textSecondary} />
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>보유 자산을 추가하면{'\n'}포트폴리오 분석이 시작됩니다</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>

      {/* ── 카테고리 분포 ── */}
      <Section icon="layers-outline" title="카테고리별 비중" themeColors={themeColors}>
        {byCategory.map((g, i) => (
          <BarRow
            key={g.key}
            label={g.key}
            value={g.value}
            totalValue={totalValue}
            color={PALETTE[i % PALETTE.length]}
            count={g.count}
            themeColors={themeColors}
          />
        ))}
      </Section>

      {/* ── 계좌별 분포 ── */}
      <Section icon="wallet-outline" title="계좌별 비중" themeColors={themeColors}>
        {byAccount.map((g) => {
          const acct = g.key as AccountType;
          return (
            <BarRow
              key={g.key}
              label={ACCOUNT_TYPE_LABELS[acct] ?? g.key}
              value={g.value}
              totalValue={totalValue}
              color={ACCOUNT_TYPE_COLORS[acct] ?? themeColors.primary}
              count={g.count}
              themeColors={themeColors}
            />
          );
        })}
      </Section>

      {/* ── 국내/해외 비중 ── */}
      <Section icon="globe-outline" title="국내/해외 비중" themeColors={themeColors}>
        {byCurrency.map((g) => (
          <BarRow
            key={g.key}
            label={g.key}
            value={g.value}
            totalValue={totalValue}
            color={g.color}
            count={g.count}
            themeColors={themeColors}
          />
        ))}
      </Section>

      {/* ── 상위 5종목 비중 ── */}
      <Section icon="podium-outline" title="비중 상위 5종목" themeColors={themeColors}>
        {topHoldings.map((h, i) => {
          const pct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
          return (
            <View key={h.id} style={styles.topRow}>
              <View style={[styles.topRank, { backgroundColor: PALETTE[i] + '22' }]}>
                <Text style={[styles.topRankText, { color: PALETTE[i] }]}>{i + 1}</Text>
              </View>
              <View style={styles.topInfo}>
                <Text style={[styles.topTicker, { color: themeColors.text }]}>{h.ticker}</Text>
                <View style={[styles.topBarTrack, { backgroundColor: themeColors.border }]}>
                  <View style={[styles.topBarFill, { width: `${pct}%` as any, backgroundColor: PALETTE[i] }]} />
                </View>
              </View>
              <View style={styles.topRight}>
                <Text style={[styles.topPct, { color: themeColors.text }]}>{pct.toFixed(1)}%</Text>
                <Text style={[styles.topAmount, { color: themeColors.textSecondary }]}>{formatKRW(h.currentValue)}</Text>
              </View>
            </View>
          );
        })}
      </Section>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ── Section ──
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },

  // ── Top Holdings ──
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  topRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRankText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topInfo: {
    flex: 1,
  },
  topTicker: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  topBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  topBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  topRight: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  topPct: {
    fontSize: 14,
    fontWeight: '700',
  },
  topAmount: {
    fontSize: 11,
    marginTop: 2,
  },
});
