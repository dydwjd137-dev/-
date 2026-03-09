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
import WeeklySummaryCard from '../../components/report/WeeklySummaryCard';
import DailyChangeChart from '../../components/report/DailyChangeChart';
import AssetTable from '../../components/report/AssetTable';
import BenchmarkCompare from '../../components/report/BenchmarkCompare';
import DividendList from '../../components/report/DividendList';
import WeeklyBreakdownChart from '../../components/report/WeeklyBreakdownChart';
import { WEEKLY_SAMPLE, MONTHLY_SAMPLE } from '../../components/report/sampleData';
import {
  formatUSD,
  convertKRWToUSD,
  formatKRW,
} from '../../utils/portfolioCalculations';
import {
  loadSnapshots,
  PortfolioSnapshot,
} from '../../services/storage/snapshotStorage';
import {
  getDailyReturn,
  getWeeklyReturn,
  getMonthlyReturn,
  getYearlyReturn,
  getDailyAssetContribution,
  ReturnResult,
  AssetContribution,
} from '../../engine/performanceEngine';

// ── 스냅샷 데이터 빌더 ────────────────────────────────────────

/** toISOString()은 UTC 기준 → KST 자정 이전 호출 시 날짜 오차. 로컬 날짜 문자열로 대체. */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildDailyData(snapshots: PortfolioSnapshot[], count = 30): SnapData[] {
  const result: SnapData[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = localDateStr(d);
    const daySnaps = snapshots.filter(s => s.date === dateStr);
    const last = daySnaps[daySnaps.length - 1];
    result.push({
      label: String(d.getDate()),
      yearLabel: d.getDate() === 1 ? `${d.getMonth() + 1}월` : '',
      totalValue: last?.totalValue ?? 0,
      totalCost:  last?.totalCost  ?? 0,
      dateStr,
      holdings: last?.holdings,
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
    const startStr = localDateStr(weekStart);
    const endStr   = localDateStr(weekEnd);
    const weekSnaps = snapshots.filter(s => s.date >= startStr && s.date <= endStr);
    const last = weekSnaps[weekSnaps.length - 1];
    const isYearStart = weekStart.getDate() <= 7 && weekStart.getMonth() === 0;
    result.push({
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      yearLabel: isYearStart ? `${weekStart.getFullYear() % 100}년` : '',
      totalValue: last?.totalValue ?? 0,
      totalCost:  last?.totalCost  ?? 0,
      dateStr: last?.date,
      holdings: last?.holdings,
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
      dateStr: last?.date,
      holdings: last?.holdings,
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
      dateStr: last?.date,
      holdings: last?.holdings,
    };
  });
}

// ── 기타 컴포넌트 ─────────────────────────────────────────────

type SubTab = 'portfolio' | 'stocks' | 'report';
type ReportTab = 'weekly' | 'monthly';
type ChangePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const CHANGE_PERIOD_LABELS: Record<ChangePeriod, string> = {
  daily: '일별', weekly: '주간', monthly: '월간', yearly: '연간',
};

export default function PerformanceScreen() {
  const { themeColors } = useTheme();
  const { holdings, summary, snapshotVersion } = usePortfolio();
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [subTab, setSubTab] = useState<SubTab>('portfolio');
  const [changePeriod, setChangePeriod] = useState<ChangePeriod>('daily');
  const [reportTab, setReportTab] = useState<ReportTab>('weekly');

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

  // 기간별 변화 (performanceEngine)
  const changeMap = useMemo<Record<ChangePeriod, ReturnResult>>(() => ({
    daily:   getDailyReturn(snapshots),
    weekly:  getWeeklyReturn(snapshots),
    monthly: getMonthlyReturn(snapshots),
    yearly:  getYearlyReturn(snapshots),
  }), [snapshots]);
  const activeChange  = changeMap[changePeriod];
  const assetChanges  = useMemo<AssetContribution[]>(() => {
    if (changePeriod !== 'daily' || snapshots.length < 2) return [];
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    return getDailyAssetContribution(sorted[sorted.length - 1], sorted[sorted.length - 2]);
  }, [snapshots, changePeriod]);

  const totalValue = summary?.totalValue ?? 0;
  const totalCost  = summary?.totalCost  ?? 0;
  const totalPnl   = summary?.totalProfitLoss ?? 0;
  const totalPct   = summary?.totalProfitLossPercent ?? 0;
  const dailyPnl   = summary?.dailyProfitLoss ?? 0;

  const profitCount = holdings.filter(h => h.profitLoss > 0).length;
  const lossCount   = holdings.filter(h => h.profitLoss < 0).length;

  // ── 리포트용 실제 종목 데이터 빌드 ────────────────────────────
  const reportAssets = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

    const snapBefore = (daysBack: number) => {
      const target = new Date(); target.setDate(target.getDate() - daysBack);
      const tStr = localDateStr(target);
      return [...sorted].reverse().find(s => s.date <= tStr) ?? sorted[0];
    };
    const weekSnap  = snapBefore(7);
    const monthSnap = snapBefore(30);

    return holdings.map(h => {
      const currValue = h.currentValue ?? 0;
      const weight = totalValue > 0 ? Math.round((currValue / totalValue) * 1000) / 10 : 0;

      const prevW = weekSnap?.holdings?.find(ph => ph.symbol === h.ticker);
      const prevWVal = prevW?.value ?? 0;
      const weekPnlKRW = prevWVal > 0 ? currValue - prevWVal : 0;
      const weekReturn  = prevWVal > 0 ? Math.round((weekPnlKRW / prevWVal) * 10000) / 100 : 0;
      const weekPnl     = Math.round(convertKRWToUSD(weekPnlKRW) * 100) / 100;

      const prevM = monthSnap?.holdings?.find(ph => ph.symbol === h.ticker);
      const prevMVal = prevM?.value ?? 0;
      const monthPnlKRW = prevMVal > 0 ? currValue - prevMVal : 0;
      const monthReturn  = prevMVal > 0 ? Math.round((monthPnlKRW / prevMVal) * 10000) / 100 : 0;
      const monthPnl     = Math.round(convertKRWToUSD(monthPnlKRW) * 100) / 100;

      return {
        ticker: h.ticker,
        weight,
        weekReturn,
        weekPnl,
        monthReturn,
        monthPnl,
        price: h.quote?.currentPrice ?? 0,
      };
    }).sort((a, b) => b.weight - a.weight);
  }, [holdings, snapshots, totalValue]);

  const SubTabBar = (
    <View style={[styles.subTabBar, { backgroundColor: themeColors.cardBackground }]}>
      {([['portfolio', '포트폴리오'], ['stocks', '종목 성과'], ['report', '리포트']] as [SubTab, string][]).map(
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

  if (subTab === 'report') {
    return (
      <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
        {SubTabBar}

        {/* ── 리포트 서브탭 ── */}
        <View style={[styles.reportTabBar, { backgroundColor: themeColors.cardBackground }]}>
          {([['weekly', '주간 리포트'], ['monthly', '월간 리포트']] as [ReportTab, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.reportTabBtn, reportTab === key && styles.reportTabBtnActive]}
              onPress={() => setReportTab(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.reportTabLabel, reportTab === key && styles.reportTabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 주간 리포트 ── */}
        {reportTab === 'weekly' && (
          <View style={styles.reportSection}>
            <WeeklySummaryCard data={WEEKLY_SAMPLE} />
            <View style={styles.reportGap} />
            <DailyChangeChart daily={WEEKLY_SAMPLE.daily} />
            <View style={styles.reportGap} />
            <AssetTable assets={reportAssets} mode="weekly" />
            <View style={styles.reportGap} />
            <BenchmarkCompare data={WEEKLY_SAMPLE.benchmark} />
            <View style={styles.reportGap} />
            <DividendList dividends={WEEKLY_SAMPLE.dividends} mode="weekly" />
          </View>
        )}

        {/* ── 월간 리포트 ── */}
        {reportTab === 'monthly' && (
          <View style={styles.reportSection}>
            <WeeklySummaryCard
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={MONTHLY_SAMPLE as any}
              monthly
            />
            <View style={styles.reportGap} />
            <WeeklyBreakdownChart data={MONTHLY_SAMPLE.weeklyBreakdown} />
            <View style={styles.reportGap} />
            <AssetTable assets={reportAssets} mode="monthly" />
            <View style={styles.reportGap} />
            <BenchmarkCompare data={MONTHLY_SAMPLE.benchmark} />
            <View style={styles.reportGap} />
            <DividendList
              dividends={MONTHLY_SAMPLE.dividendBreakdown}
              total={MONTHLY_SAMPLE.totalDividends}
              mode="monthly"
            />
          </View>
        )}

      </ScrollView>
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

      {/* ── 기간별 변화 ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="swap-vertical-outline" size={16} color={themeColors.primary} />
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>기간별 변화</Text>
        </View>

        {/* 기간 선택 탭 */}
        <View style={[styles.changePeriodBar, { backgroundColor: themeColors.cardBackground }]}>
          {(Object.keys(CHANGE_PERIOD_LABELS) as ChangePeriod[]).map(key => (
            <TouchableOpacity
              key={key}
              style={[styles.changePeriodBtn, changePeriod === key && { backgroundColor: themeColors.primary }]}
              onPress={() => setChangePeriod(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.changePeriodLabel, { color: themeColors.textSecondary }, changePeriod === key && { color: '#FFFFFF' }]}>
                {CHANGE_PERIOD_LABELS[key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 변화 카드 */}
        {activeChange.hasData ? (
          <View style={[styles.changeCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <View style={styles.changeRow}>
              <View style={styles.changeValues}>
                <Text style={[styles.changeLabel, { color: themeColors.textSecondary }]}>평가금액 변화</Text>
                <Text style={[styles.changeMain, { color: profitColor(activeChange.valueChange) }]}>
                  {activeChange.valueChange >= 0 ? '+' : ''}{formatUSD(convertKRWToUSD(activeChange.valueChange))}
                </Text>
                <Text style={[styles.changePct, { color: profitColor(activeChange.percentChange) }]}>
                  {activeChange.percentChange >= 0 ? '+' : ''}{activeChange.percentChange.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.changeValues}>
                <Text style={[styles.changeLabel, { color: themeColors.textSecondary }]}>손익 변화</Text>
                <Text style={[styles.changeSub, { color: profitColor(activeChange.profitChange) }]}>
                  {activeChange.profitChange >= 0 ? '+' : ''}{formatUSD(convertKRWToUSD(activeChange.profitChange))}
                </Text>
              </View>
            </View>
            <Text style={[styles.changeDateRange, { color: themeColors.textSecondary }]}>
              {activeChange.fromDate} → {activeChange.toDate}
            </Text>
          </View>
        ) : (
          <View style={[styles.changeCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <Text style={[styles.changeNoData, { color: themeColors.textSecondary }]}>비교할 스냅샷이 부족합니다</Text>
          </View>
        )}

        {/* 종목별 기여 (일별만) */}
        {changePeriod === 'daily' && assetChanges.length > 0 && (
          <View style={styles.assetList}>
            <Text style={[styles.assetListTitle, { color: themeColors.textSecondary }]}>종목별 일간 변화</Text>
            {assetChanges.slice(0, 8).map(a => (
              <View key={a.symbol} style={[styles.assetRow, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.assetSymbol, { color: themeColors.text }]}>{a.symbol}</Text>
                <Text style={[styles.assetPct, { color: profitColor(a.percentChange) }]}>
                  {a.percentChange >= 0 ? '+' : ''}{a.percentChange.toFixed(2)}%
                </Text>
                <Text style={[styles.assetVal, { color: profitColor(a.valueChange) }]}>
                  {a.valueChange >= 0 ? '+' : ''}{formatUSD(convertKRWToUSD(a.valueChange))}
                </Text>
              </View>
            ))}
          </View>
        )}
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
  changePeriodBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    gap: 2,
  },
  changePeriodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  changePeriodLabel: { fontSize: 12, fontWeight: '600' },
  changeCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  changeNoData: {
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 8,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  changeValues: { flex: 1 },
  changeLabel: { fontSize: 11, marginBottom: 4 },
  changeMain: { fontSize: 18, fontWeight: '700' },
  changePct: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  changeSub: { fontSize: 15, fontWeight: '700' },
  changeDateRange: { fontSize: 11, textAlign: 'right' },
  assetList: { marginTop: 4 },
  assetListTitle: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  assetSymbol: { flex: 1, fontSize: 13, fontWeight: '600' },
  assetPct: { fontSize: 13, fontWeight: '600', width: 64, textAlign: 'right' },
  assetVal: { fontSize: 12, width: 80, textAlign: 'right' },
  // ── Report tab styles ──
  reportTabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    gap: 2,
  },
  reportTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  reportTabBtnActive: {
    backgroundColor: '#6B4FFF',
  },
  reportTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7FBF',
  },
  reportTabLabelActive: {
    color: '#FFFFFF',
  },
  reportSection: {
    gap: 0,
  },
  reportGap: {
    height: 12,
  },
});
