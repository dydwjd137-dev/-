import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import StockPerformanceTab from '../../components/performance/StockPerformanceTab';
import { PeriodSection, BarChart, SnapData } from '../../components/performance/PortfolioCharts';
import {
  formatUSD,
  convertKRWToUSD,
  formatKRW,
} from '../../utils/portfolioCalculations';
import {
  loadSnapshots,
  PortfolioSnapshot,
} from '../../services/storage/snapshotStorage';

// ── 스냅샷 데이터 빌더 ────────────────────────────────────────

function buildDailyData(snapshots: PortfolioSnapshot[], count = 30): SnapData[] {
  const result: SnapData[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const daySnaps = snapshots.filter(s => s.date === dateStr);
    const last = daySnaps[daySnaps.length - 1];
    result.push({
      label: String(d.getDate()),
      yearLabel: d.getDate() === 1 ? `${d.getMonth() + 1}월` : '',
      totalValue: last?.totalValue ?? 0,
      totalCost:  last?.totalCost  ?? 0,
    });
  }
  return result;
}

function buildWeeklyData(snapshots: PortfolioSnapshot[], count = 12): SnapData[] {
  const result: SnapData[] = [];
  const now = new Date();
  const dow = now.getDay() || 7;
  for (let w = count - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow + 1 - w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr   = weekEnd.toISOString().slice(0, 10);
    const weekSnaps = snapshots.filter(s => s.date >= startStr && s.date <= endStr);
    const last = weekSnaps[weekSnaps.length - 1];
    const isYearStart = weekStart.getDate() <= 7 && weekStart.getMonth() === 0;
    result.push({
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      yearLabel: isYearStart ? `${weekStart.getFullYear() % 100}년` : '',
      totalValue: last?.totalValue ?? 0,
      totalCost:  last?.totalCost  ?? 0,
    });
  }
  return result;
}

function buildMonthlyData(snapshots: PortfolioSnapshot[], count = 12): SnapData[] {
  const result: SnapData[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthSnaps = snapshots.filter(s => s.date.startsWith(ym));
    const last = monthSnaps[monthSnaps.length - 1];
    result.push({
      label: String(d.getMonth() + 1),
      yearLabel: d.getMonth() === 0 ? `${d.getFullYear() % 100}년` : '',
      totalValue: last?.totalValue ?? 0,
      totalCost:  last?.totalCost  ?? 0,
    });
  }
  return result;
}

function buildYearlyData(snapshots: PortfolioSnapshot[]): SnapData[] {
  if (snapshots.length === 0) return [];
  const years = [...new Set(snapshots.map(s => s.date.slice(0, 4)))].sort();
  return years.map(year => {
    const yearSnaps = snapshots.filter(s => s.date.startsWith(year));
    const last = yearSnaps[yearSnaps.length - 1];
    return {
      label: `${year.slice(2)}년`,
      totalValue: last?.totalValue ?? 0,
      totalCost:  last?.totalCost  ?? 0,
    };
  });
}

// ── 기타 컴포넌트 ─────────────────────────────────────────────

type SubTab = 'portfolio' | 'stocks';

export default function PerformanceScreen() {
  const { themeColors } = useTheme();
  const { holdings, summary, snapshotVersion } = usePortfolio();
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [subTab, setSubTab] = useState<SubTab>('portfolio');

  function profitColor(value: number) {
    if (value > 0) return themeColors.profit;
    if (value < 0) return themeColors.loss;
    return themeColors.textSecondary;
  }

  function StatCard({ label, value, sub, valueColor }: {
    label: string; value: string; sub?: string; valueColor?: string;
  }) {
    return (
      <View style={styles.statCard}>
        <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{label}</Text>
        <Text style={[styles.statValue, { color: themeColors.text }, valueColor ? { color: valueColor } : {}]}>{value}</Text>
        {sub ? <Text style={[styles.statSub, { color: themeColors.textSecondary }]}>{sub}</Text> : null}
      </View>
    );
  }

  // summary 변경(새로고침) 또는 백필 완료(snapshotVersion 증가) 시 스냅샷 재로드
  useEffect(() => {
    loadSnapshots().then(setSnapshots);
  }, [summary, snapshotVersion]);

  const dailyData   = useMemo(() => buildDailyData(snapshots, 30),   [snapshots]);
  const weeklyData  = useMemo(() => buildWeeklyData(snapshots, 12),  [snapshots]);
  const monthlyData = useMemo(() => buildMonthlyData(snapshots, 12), [snapshots]);
  const yearlyData  = useMemo(() => buildYearlyData(snapshots),      [snapshots]);

  const totalValue = summary?.totalValue ?? 0;
  const totalCost  = summary?.totalCost  ?? 0;
  const totalPnl   = summary?.totalProfitLoss ?? 0;
  const totalPct   = summary?.totalProfitLossPercent ?? 0;
  const dailyPnl   = summary?.dailyProfitLoss ?? 0;

  const profitCount = holdings.filter(h => h.profitLoss > 0).length;
  const lossCount   = holdings.filter(h => h.profitLoss < 0).length;

  const SubTabBar = (
    <View style={[styles.subTabBar, { backgroundColor: themeColors.cardBackground }]}>
      {([['portfolio', '포트폴리오'], ['stocks', '종목 성과']] as [SubTab, string][]).map(
        ([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.subTabBtn,
              subTab === key && { backgroundColor: themeColors.primary },
            ]}
            onPress={() => setSubTab(key)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.subTabLabel,
              { color: themeColors.textSecondary },
              subTab === key && { color: '#FFFFFF' },
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        ),
      )}
    </View>
  );

  if (holdings.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.background }]}>
        {SubTabBar}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Ionicons name="trending-up-outline" size={56} color={themeColors.textSecondary} />
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>보유 자산을 추가하면{'\n'}성과 분석이 시작됩니다</Text>
        </View>
      </View>
    );
  }

  if (subTab === 'stocks') {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background, padding: 16 }]}>
        {SubTabBar}
        <StockPerformanceTab />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>

      {SubTabBar}

      {/* ── 전체 성과 요약 카드 ── */}
      <View style={[styles.summaryCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>총 평가금액</Text>
            <Text style={[styles.summaryTotal, { color: themeColors.text }]}>{formatUSD(convertKRWToUSD(totalValue))}</Text>
            <Text style={[styles.summaryTotalKrw, { color: themeColors.textSecondary }]}>{formatKRW(totalValue)}</Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={[styles.summaryPct, { color: profitColor(totalPct) }]}>
              {totalPct >= 0 ? '+' : ''}{totalPct.toFixed(2)}%
            </Text>
            <Text style={[styles.summaryPnl, { color: profitColor(totalPnl) }]}>
              {totalPnl >= 0 ? '+' : ''}{formatUSD(convertKRWToUSD(totalPnl))}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

        <View style={styles.statsRow}>
          <StatCard
            label="투자 원금"
            value={formatUSD(convertKRWToUSD(totalCost))}
            sub={formatKRW(totalCost)}
          />
          <StatCard
            label="오늘 수익"
            value={`${dailyPnl >= 0 ? '+' : ''}${formatUSD(convertKRWToUSD(dailyPnl))}`}
            valueColor={profitColor(dailyPnl)}
          />
          <StatCard
            label="수익/손실"
            value={`${profitCount}승 ${lossCount}패`}
            sub={`${holdings.length}종목`}
          />
        </View>
      </View>

      {/* ── 자산 추이 (12개월 막대, 고정) ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart-outline" size={16} color={themeColors.primary} />
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>자산 추이</Text>
          <Text style={[styles.sectionSubtitle, { color: themeColors.textSecondary }]}>최근 12개월</Text>
        </View>
        <View style={[styles.chartCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
          <BarChart data={monthlyData} />
        </View>
      </View>

      {/* ── 일별 변화 ── */}
      <PeriodSection
        icon={<Ionicons name="today-outline" size={16} color={themeColors.textSecondary} />}
        title="일별 변화"
        subtitle="최근 30일"
        data={dailyData}
      />

      {/* ── 주간 변화 ── */}
      <PeriodSection
        icon={<Ionicons name="calendar-outline" size={16} color={themeColors.textSecondary} />}
        title="주간 변화"
        subtitle="최근 12주"
        data={weeklyData}
      />

      {/* ── 월별 변화 ── */}
      <PeriodSection
        icon={<Ionicons name="stats-chart-outline" size={16} color={themeColors.textSecondary} />}
        title="월별 변화"
        subtitle="최근 12개월"
        data={monthlyData}
      />

      {/* ── 연간 변화 ── */}
      <PeriodSection
        icon={<Ionicons name="trending-up-outline" size={16} color={themeColors.textSecondary} />}
        title="연간 변화"
        subtitle="전체 기간"
        data={yearlyData}
      />

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
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  subTabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    gap: 2,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  subTabLabel: { fontSize: 13, fontWeight: '600' },
  subTabLabelActive: { color: '#FFFFFF' },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryTotal: { fontSize: 28, fontWeight: 'bold' },
  summaryTotalKrw: { fontSize: 13, marginTop: 2 },
  summaryRight: { alignItems: 'flex-end' },
  summaryPct: { fontSize: 22, fontWeight: '700' },
  summaryPnl: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  divider: { height: 1, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '700' },
  statSub: { fontSize: 11, marginTop: 2 },
  section: { marginBottom: 20 },
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
    marginLeft: 2,
  },
  chartCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
});
