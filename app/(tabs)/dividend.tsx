import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { formatUSD } from '../../utils/portfolioCalculations';
import { DividendInfo, EnrichedHolding } from '../../types/portfolio';

// ─── 배당 성장 헬퍼 ────────────────────────────────────────

const FREQ_MULT: Record<string, number> = {
  ANNUAL: 1, SEMI_ANNUAL: 2, QUARTERLY: 4, MONTHLY: 12,
};

interface YearlyDiv { year: number; annualKRW: number }

function buildDividendGrowth(holdings: EnrichedHolding[], usdKrwRate: number): YearlyDiv[] {
  if (holdings.length === 0) return [];
  const purchaseYears = holdings.map(h => new Date(h.purchaseDate).getFullYear());
  const minYear = Math.min(...purchaseYears);
  const maxYear = new Date().getFullYear();
  return Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
    const year = minYear + i;
    let annualKRW = 0;
    holdings
      .filter(h => new Date(h.purchaseDate).getFullYear() <= year)
      .forEach(h => {
        h.dividends.forEach(d => {
          const amtKRW = d.currency === 'KRW' ? d.amount : d.amount * usdKrwRate;
          annualKRW += amtKRW * h.quantity * (FREQ_MULT[d.frequency] ?? 4);
        });
      });
    return { year, annualKRW };
  });
}

function fmtKRWShort(v: number): string {
  if (v === 0) return '-';
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${Math.round(v / 10_000)}만`;
  return `${Math.round(v)}`;
}

const DIV_COL_W = 52;
const DIV_BAR_H = 90;

function DivGrowthChart({ data }: { data: YearlyDiv[] }) {
  const { themeColors } = useTheme();

  if (data.length === 0 || data.every(d => d.annualKRW === 0)) {
    return (
      <Text style={[styles.chartEmpty, { color: themeColors.textSecondary }]}>배당 정보가 있는 종목을 추가하면 표시됩니다</Text>
    );
  }
  const maxDiv   = Math.max(...data.map(d => d.annualKRW), 1);
  const prevYear = data.length >= 2 ? data[data.length - 2].annualKRW : 0;
  const currYear = data[data.length - 1]?.annualKRW ?? 0;
  const growthPct = prevYear > 0 ? ((currYear - prevYear) / prevYear) * 100 : 0;

  return (
    <>
      {data.length >= 2 && (
        <View style={styles.growthBadge}>
          <Ionicons
            name={growthPct >= 0 ? 'trending-up' : 'trending-down'}
            size={14}
            color={growthPct >= 0 ? themeColors.profit : themeColors.loss}
          />
          <Text style={[styles.growthBadgeText, { color: growthPct >= 0 ? themeColors.profit : themeColors.loss }]}>
            전년 대비 {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}%
          </Text>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartRow}>
          {data.map((d, i) => {
            const h = Math.max(2, (d.annualKRW / maxDiv) * DIV_BAR_H);
            const isLatest = i === data.length - 1;
            return (
              <View key={i} style={{ width: DIV_COL_W, alignItems: 'center' }}>
                <View style={{ height: DIV_BAR_H, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <View style={[styles.divBar, {
                    height: h,
                    backgroundColor: isLatest ? themeColors.dividend + 'EE' : themeColors.dividend + '66',
                  }]} />
                </View>
                <Text style={[styles.divXLabel, { color: themeColors.textSecondary }, isLatest && { color: themeColors.text, fontWeight: '700' }]}>
                  {d.year}
                </Text>
                <Text style={[styles.divXSubLabel, { color: isLatest ? themeColors.dividend : themeColors.textSecondary }]}>
                  {fmtKRWShort(d.annualKRW)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

// ─── 색상 팔레트 ───────────────────────────────────────────
const CHART_COLORS = [
  '#6B4FFF', '#00FFA3', '#FFD700', '#FF006B',
  '#00BFFF', '#FF8C00', '#A855F7', '#2ECC71',
  '#E74C3C', '#3498DB', '#F1C40F', '#1ABC9C',
];

// 색상 선택기 팔레트 (6열 × 5행)
const COLOR_PICKER_PALETTE = [
  '#6B4FFF', '#5856D6', '#007AFF', '#32ADE6', '#5AC8FA', '#64D2FF',
  '#00C896', '#30D158', '#34C759', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFD60A', '#FFCD00', '#FF9F0A', '#FF9500', '#FF6600', '#FF3B30',
  '#FF6B6B', '#FF375F', '#FF2D55', '#BF5AF2', '#AF52DE', '#E91E63',
  '#AC8E68', '#A2845E', '#8E8E93', '#636366', '#48484A', '#00FFA3',
];

const MONTH_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

type Tab = 'portfolio' | 'calendar';

// ─── 유틸 ────────────────────────────────────────────────
function getPaymentsPerYear(freq: DividendInfo['frequency']): number {
  switch (freq) {
    case 'ANNUAL':      return 1;
    case 'SEMI_ANNUAL': return 2;
    case 'QUARTERLY':   return 4;
    case 'MONTHLY':     return 12;
  }
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ─── 타입 ────────────────────────────────────────────────
interface TickerDiv {
  ticker: string;
  annualAmount: number;
  weight: number;
  color: string;
}

interface CalEvent {
  ticker: string;
  amount: number;
  paymentDate: Date;
  status: 'paid' | 'confirmed' | 'upcoming';
  color: string;
}

interface MonthData {
  key: string;
  year: number;
  month: number;
  events: CalEvent[];
  total: number;
}

// ─── 메인 화면 ────────────────────────────────────────────
export default function DividendScreen() {
  const { themeColors } = useTheme();
  const { holdings, summary, exchangeRate, isLoading, isRefreshing, refreshPrices } = usePortfolio();
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [customTickerColors, setCustomTickerColors] = useState<Map<string, string>>(new Map());

  const tickerDivs = useMemo((): TickerDiv[] => {
    const items = holdings
      .map((h) => {
        if (!h.dividends?.length) return null;
        const annual = h.dividends.reduce((s, d) => {
          const amtUSD = d.currency === 'KRW' ? d.amount / exchangeRate : d.amount;
          return s + amtUSD * h.quantity * getPaymentsPerYear(d.frequency);
        }, 0);
        return annual > 0 ? { ticker: h.ticker, annual } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.annual - a!.annual) as { ticker: string; annual: number }[];

    const total = items.reduce((s, i) => s + i.annual, 0);
    return items.map((item, idx) => ({
      ticker: item.ticker,
      annualAmount: item.annual,
      weight: total > 0 ? (item.annual / total) * 100 : 0,
      color: customTickerColors.get(item.ticker) ?? CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [holdings, customTickerColors, exchangeRate]);

  const colorMap = useMemo(
    () => Object.fromEntries(tickerDivs.map((t) => [t.ticker, t.color])),
    [tickerDivs],
  );

  const monthlyCalendar = useMemo((): MonthData[] => {
    const now = new Date();
    const horizon = addMonths(now, 13);
    const allEvents: CalEvent[] = [];

    holdings.forEach((h) => {
      h.dividends?.forEach((div) => {
        if (div.amount <= 0) return;
        const intervalMonths = 12 / getPaymentsPerYear(div.frequency);
        const amtUSD = div.currency === 'KRW' ? div.amount / exchangeRate : div.amount;

        let d = new Date(div.paymentDate);
        while (addMonths(d, intervalMonths) >= addMonths(now, -1)) {
          d = addMonths(d, -intervalMonths);
        }
        d = addMonths(d, intervalMonths);

        while (d <= horizon) {
          const exDiv = new Date(d.getTime() - 14 * 24 * 60 * 60 * 1000);
          let status: CalEvent['status'];
          if (d < now)       status = 'paid';
          else if (exDiv < now) status = 'confirmed';
          else               status = 'upcoming';

          allEvents.push({
            ticker: h.ticker,
            amount: amtUSD * h.quantity,
            paymentDate: new Date(d),
            status,
            color: colorMap[h.ticker] ?? CHART_COLORS[0],
          });

          d = addMonths(d, intervalMonths);
        }
      });
    });

    const grouped: Record<string, CalEvent[]> = {};
    allEvents.forEach((e) => {
      const key = `${e.paymentDate.getFullYear()}-${String(e.paymentDate.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, evs]) => {
        const [yr, mo] = key.split('-').map(Number);
        return {
          key,
          year: yr,
          month: mo,
          events: evs.sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime()),
          total: evs.reduce((s, e) => s + e.amount, 0),
        };
      });
  }, [holdings, colorMap, exchangeRate]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>배당 정보 불러오는 중...</Text>
      </View>
    );
  }

  const hasDividends = tickerDivs.length > 0;

  const handleColorChange = (ticker: string, color: string) => {
    setCustomTickerColors(prev => {
      const next = new Map(prev);
      next.set(ticker, color);
      return next;
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshPrices}
          tintColor={themeColors.primary}
        />
      }
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>배당</Text>
      </View>

      {/* 요약 카드 */}
      <View style={[styles.summaryCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>월 예상배당</Text>
          <Text style={[styles.summaryValue, { color: themeColors.dividend }]}>
            {summary ? formatUSD(summary.monthlyDividendEstimate) : '$0.00'}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>연 예상배당</Text>
          <Text style={[styles.summaryValue, { color: themeColors.dividend }]}>
            {summary ? formatUSD(summary.annualDividendEstimate) : '$0.00'}
          </Text>
        </View>
      </View>

      {/* 탭 토글 */}
      <View style={[styles.tabRow, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'portfolio' && { backgroundColor: themeColors.primary }]}
          onPress={() => setActiveTab('portfolio')}
        >
          <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'portfolio' && { color: themeColors.text }]}>
            배당 비중
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'calendar' && { backgroundColor: themeColors.primary }]}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={[styles.tabText, { color: themeColors.textSecondary }, activeTab === 'calendar' && { color: themeColors.text }]}>
            월별 일정
          </Text>
        </TouchableOpacity>
      </View>

      {!hasDividends ? (
        <View style={[styles.emptyContainer, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>배당 정보가 없습니다</Text>
          <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>배당을 지급하는 종목을 추가하고 새로고침하세요</Text>
        </View>
      ) : activeTab === 'portfolio' ? (
        <PortfolioView
          tickerDivs={tickerDivs}
          onColorChange={handleColorChange}
        />
      ) : (
        <CalendarView
          months={monthlyCalendar}
          holdings={holdings}
          exchangeRate={exchangeRate}
        />
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── 배당 비중 탭 ─────────────────────────────────────────
function PortfolioView({
  tickerDivs,
  onColorChange,
}: {
  tickerDivs: TickerDiv[];
  onColorChange: (ticker: string, color: string) => void;
}) {
  const { themeColors } = useTheme();
  const total = tickerDivs.reduce((s, t) => s + t.annualAmount, 0);
  const [colorPickerTicker, setColorPickerTicker] = useState<TickerDiv | null>(null);

  return (
    <View style={styles.section}>
      {/* 도넛 차트 */}
      <DonutChart data={tickerDivs} total={total} />

      {/* 종목별 리스트 */}
      <View style={styles.tickerList}>
        <Text style={[styles.colorHint, { color: themeColors.textSecondary }]}>● 을 눌러 색상 변경</Text>
        {tickerDivs.map((t) => (
          <View key={t.ticker} style={styles.tickerRow}>
            <TouchableOpacity
              onPress={() => setColorPickerTicker(t)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[styles.colorDot, { backgroundColor: t.color }]} />
            </TouchableOpacity>
            <Text style={[styles.tickerName, { color: themeColors.text }]}>{t.ticker}</Text>
            <View style={[styles.barTrack, { backgroundColor: themeColors.cardBackground }]}>
              <View
                style={[
                  styles.barFill,
                  { width: `${t.weight}%` as any, backgroundColor: t.color },
                ]}
              />
            </View>
            <Text style={[styles.tickerWeight, { color: themeColors.textSecondary }]}>{t.weight.toFixed(1)}%</Text>
            <Text style={[styles.tickerAmount, { color: themeColors.dividend }]}>
              연간 {formatUSD(t.annualAmount)}
            </Text>
          </View>
        ))}
      </View>

      {/* 색상 선택기 모달 */}
      <Modal
        visible={colorPickerTicker !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setColorPickerTicker(null)}
      >
        <TouchableOpacity
          style={styles.colorOverlay}
          activeOpacity={1}
          onPress={() => setColorPickerTicker(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={[styles.colorSheet, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
              <View style={styles.colorSheetHeader}>
                <View style={[styles.colorPreviewDot, { backgroundColor: colorPickerTicker?.color }]} />
                <Text style={[styles.colorSheetTitle, { color: themeColors.text }]}>{colorPickerTicker?.ticker} 색상</Text>
                <TouchableOpacity onPress={() => setColorPickerTicker(null)}>
                  <Ionicons name="close" size={22} color={themeColors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.colorGrid}>
                {COLOR_PICKER_PALETTE.map(c => {
                  const isSelected = colorPickerTicker?.color === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, isSelected && styles.colorSwatchActive]}
                      onPress={() => {
                        if (colorPickerTicker) {
                          onColorChange(colorPickerTicker.ticker, c);
                          setColorPickerTicker(null);
                        }
                      }}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── SVG 도넛 차트 ────────────────────────────────────────
function SvgDonut({ data, size = 220 }: { data: TickerDiv[]; size?: number }) {
  const { themeColors } = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.52;

  let currentAngle = -Math.PI / 2;

  const slices = data.map((t) => {
    const sweep = (t.weight / 100) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    currentAngle = endAngle;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const xi1 = cx + innerR * Math.cos(startAngle);
    const yi1 = cy + innerR * Math.sin(startAngle);
    const xi2 = cx + innerR * Math.cos(endAngle);
    const yi2 = cy + innerR * Math.sin(endAngle);

    const largeArc = sweep > Math.PI ? 1 : 0;

    const d = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${xi2.toFixed(2)} ${yi2.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)}`,
      'Z',
    ].join(' ');

    return { d, color: t.color };
  });

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => (
        <Path key={i} d={s.d} fill={s.color} stroke={themeColors.background} strokeWidth={2} />
      ))}
      <Circle cx={cx} cy={cy} r={innerR} fill={themeColors.background} />
    </Svg>
  );
}

// ─── 배당 비중 차트 ────────────────────────────────────────
function DonutChart({ data, total }: { data: TickerDiv[]; total: number }) {
  const { themeColors } = useTheme();
  if (total <= 0) return null;

  return (
    <View style={[styles.donutWrapper, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
      <View style={styles.donutContainer}>
        <SvgDonut data={data} size={220} />
        <View style={styles.donutCenter}>
          <Text style={[styles.donutLabel, { color: themeColors.textSecondary }]}>연간 배당</Text>
          <Text style={[styles.donutTotal, { color: themeColors.dividend }]}>
            {formatUSD(total)}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        {data.map((t) => (
          <View key={t.ticker} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: t.color }]} />
            <Text style={[styles.legendTicker, { color: themeColors.text }]}>{t.ticker}</Text>
            <Text style={[styles.legendPct, { color: themeColors.textSecondary }]}>{t.weight.toFixed(0)}%</Text>
          </View>
        ))}
      </View>

      <View style={styles.stackedBar}>
        {data.map((t, i) => (
          <View
            key={t.ticker}
            style={{
              flex: t.weight,
              backgroundColor: t.color,
              borderTopLeftRadius: i === 0 ? 8 : 0,
              borderBottomLeftRadius: i === 0 ? 8 : 0,
              borderTopRightRadius: i === data.length - 1 ? 8 : 0,
              borderBottomRightRadius: i === data.length - 1 ? 8 : 0,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ─── 월별 배당 바 차트 ────────────────────────────────────
interface BarChartProps {
  months: MonthData[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}

function MonthlyBarChart({ months, selectedYear, onYearChange, selectedKey, onSelect }: BarChartProps) {
  const { themeColors } = useTheme();
  const now = new Date();
  const BAR_MAX_H = 150;
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const slots = Array.from({ length: 12 }, (_, i) => {
    const mo = i + 1;
    const key = `${selectedYear}-${String(mo).padStart(2, '0')}`;
    const found = months.find((m) => m.key === key);
    const colorMap: Record<string, number> = {};
    found?.events.forEach((e) => {
      colorMap[e.color] = (colorMap[e.color] ?? 0) + e.amount;
    });
    const events = found?.events ?? [];
    return {
      key,
      mo,
      total: found?.total ?? 0,
      segments: Object.entries(colorMap).map(([color, amount]) => ({ color, amount })),
      isCurrent: selectedYear === curYear && mo === curMonth,
      isFullyPaid: events.length > 0 && events.every((e) => e.status === 'paid'),
      isSelected: key === selectedKey,
    };
  });

  const maxTotal = Math.max(...slots.map((s) => s.total), 0.01);

  return (
    <View style={[styles.barChartCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
      <View style={styles.yearNav}>
        <TouchableOpacity
          onPress={() => { onYearChange(selectedYear - 1); onSelect(null); }}
          style={styles.yearNavBtn}
        >
          <Ionicons name="chevron-back" size={18} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.barChartTitle, { color: themeColors.textSecondary }]}>{selectedYear}년 월별 배당</Text>
        <TouchableOpacity
          onPress={() => { onYearChange(selectedYear + 1); onSelect(null); }}
          style={styles.yearNavBtn}
        >
          <Ionicons name="chevron-forward" size={18} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.barChartArea}>
        {slots.map((slot) => {
          const barH = Math.max((slot.total / maxTotal) * BAR_MAX_H, slot.total > 0 ? 4 : 0);
          return (
            <TouchableOpacity
              key={slot.key}
              style={styles.barChartCol}
              activeOpacity={slot.total > 0 ? 0.7 : 1}
              onPress={() => slot.total > 0 && onSelect(slot.isSelected ? null : slot.key)}
            >
              <View style={{ height: 14 }}>
                {slot.total > 0 && (
                  <Text style={[styles.barAmountLabel, { color: themeColors.dividend }, slot.isSelected && { color: '#fff' }]} numberOfLines={1}>
                    {slot.total >= 1000 ? `$${(slot.total / 1000).toFixed(1)}k` : `$${Math.round(slot.total)}`}
                  </Text>
                )}
              </View>

              <View style={[styles.barTrackBg, { height: BAR_MAX_H, backgroundColor: themeColors.cardBackground }]}>
                {slot.total > 0 && slot.isFullyPaid ? (
                  <View style={{
                    height: barH, width: '100%', overflow: 'hidden', borderRadius: 3,
                    borderWidth: slot.isSelected ? 1.5 : 0, borderColor: '#fff',
                  }}>
                    {slot.segments.map((seg, idx) => (
                      <View key={`${seg.color}-${idx}`} style={{
                        height: (seg.amount / slot.total) * barH,
                        width: '100%', backgroundColor: seg.color,
                      }} />
                    ))}
                  </View>
                ) : slot.total > 0 ? (
                  <View style={{
                    height: barH, width: '100%', borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderWidth: slot.isSelected ? 1.5 : (slot.isCurrent ? 1 : 0),
                    borderColor: slot.isSelected ? '#fff' : themeColors.dividend,
                  }} />
                ) : (
                  <View style={{
                    height: BAR_MAX_H, width: '100%', borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                  }} />
                )}
              </View>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[
                  styles.barMonthLabel,
                  { color: themeColors.textSecondary },
                  slot.isCurrent && { color: themeColors.dividend, fontWeight: '700' as const },
                  slot.isSelected && { color: '#fff', fontWeight: '700' as const },
                ]}
              >
                {MONTH_KR[slot.mo - 1]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── 선택 월 상세 패널 ────────────────────────────────────
function MonthDetailPanel({ month }: { month: MonthData }) {
  const { themeColors } = useTheme();
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrent = month.key === currentKey;

  return (
    <View style={[
      styles.monthCard,
      { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
      isCurrent && { borderColor: themeColors.dividend, borderWidth: 1.5 },
    ]}>
      <View style={styles.monthHeader}>
        <View style={styles.monthTitleRow}>
          {isCurrent && (
            <View style={[styles.currentBadge, { borderColor: themeColors.dividend }]}>
              <Text style={[styles.currentBadgeText, { color: themeColors.dividend }]}>이번 달</Text>
            </View>
          )}
          <Text style={[styles.monthTitle, { color: themeColors.text }]}>{month.year}년 {MONTH_KR[month.month - 1]}</Text>
        </View>
        <Text style={[styles.monthTotal, { color: themeColors.dividend }]}>+{formatUSD(month.total)}</Text>
      </View>

      {month.events.map((e, idx) => (
        <View key={`${e.ticker}-${idx}`} style={[styles.eventRow, { borderTopColor: themeColors.border }]}>
          <View style={[styles.eventDot, { backgroundColor: e.color }]} />
          <Text style={[styles.eventTicker, { color: themeColors.text }]}>{e.ticker}</Text>
          <Text style={[styles.eventDate, { color: themeColors.textSecondary }]}>
            {e.paymentDate.getMonth() + 1}월 {e.paymentDate.getDate()}일
          </Text>
          <Text style={[styles.eventAmount, { color: themeColors.dividend }]}>+{formatUSD(e.amount)}</Text>
          <View style={[styles.statusBadge, statusStyle(e.status, themeColors.primary)]}>
            <Text style={[styles.statusText, { color: themeColors.text }]}>{statusLabel(e.status)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── 월별 일정 탭 ─────────────────────────────────────────
function CalendarView({
  months,
  holdings,
  exchangeRate,
}: {
  months: MonthData[];
  holdings: EnrichedHolding[];
  exchangeRate: number;
}) {
  const { themeColors } = useTheme();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedMonth = selectedKey ? months.find((m) => m.key === selectedKey) ?? null : null;

  const divGrowth = useMemo(
    () => buildDividendGrowth(holdings, exchangeRate),
    [holdings, exchangeRate],
  );

  if (months.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>배당 정보가 없습니다</Text>
        <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>배당을 지급하는 종목을 추가하고 새로고침하세요</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {/* 월별 바 차트 */}
      <MonthlyBarChart
        months={months}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {/* 선택 월 상세 */}
      {selectedMonth ? (
        <MonthDetailPanel month={selectedMonth} />
      ) : (
        <View style={styles.selectHint}>
          <Text style={[styles.selectHintText, { color: themeColors.textSecondary }]}>월 막대를 클릭하면 배당 상세 내역을 볼 수 있습니다</Text>
        </View>
      )}

      {/* ── 배당 성장 차트 (하단) ── */}
      {divGrowth.length > 0 && (
        <View style={styles.divGrowthSection}>
          <View style={styles.divGrowthHeader}>
            <Ionicons name="leaf-outline" size={16} color={themeColors.dividend} />
            <Text style={[styles.divGrowthTitle, { color: themeColors.dividend }]}>배당 성장</Text>
            <Text style={[styles.divGrowthSubtitle, { color: themeColors.textSecondary }]}>연도별 예상 배당</Text>
          </View>
          <View style={[styles.divGrowthCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <DivGrowthChart data={divGrowth} />
          </View>
        </View>
      )}
    </View>
  );
}

function statusLabel(s: CalEvent['status']): string {
  switch (s) {
    case 'paid':      return '입금완료';
    case 'confirmed': return '배당확정';
    case 'upcoming':  return '예정';
  }
}

function statusStyle(s: CalEvent['status'], primary: string) {
  switch (s) {
    case 'paid':      return { backgroundColor: 'rgba(160,160,176,0.2)' };
    case 'confirmed': return { backgroundColor: 'rgba(0,255,163,0.15)' };
    case 'upcoming':  return { backgroundColor: primary + '33' };
  }
}

// ─── 스타일 ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 14 },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 32, fontWeight: 'bold' },
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: 24, marginTop: 16, padding: 20,
    borderRadius: 20, borderWidth: 1,
    marginBottom: 20,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, marginVertical: 4 },
  summaryLabel: { fontSize: 12, marginBottom: 6 },
  summaryValue: { fontSize: 20, fontWeight: 'bold' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 24, marginBottom: 20,
    borderRadius: 12, padding: 4,
    borderWidth: 1,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 14, fontWeight: '600' },
  section: { paddingHorizontal: 24 },
  emptyContainer: {
    margin: 24, padding: 48, alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyText: { fontSize: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 13, opacity: 0.6, textAlign: 'center' },

  // ── 도넛 차트 ──
  donutWrapper: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20, marginBottom: 24,
  },
  donutContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutLabel: { fontSize: 11, marginBottom: 2 },
  donutTotal: { fontSize: 18, fontWeight: 'bold' },
  stackedBar: {
    flexDirection: 'row', height: 20, borderRadius: 8,
    overflow: 'hidden', marginBottom: 16, gap: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 80 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTicker: { fontSize: 12, fontWeight: '700', flex: 1 },
  legendPct: { fontSize: 11 },

  // ── 티커 리스트 ──
  tickerList: { gap: 12 },
  colorHint: { fontSize: 11, opacity: 0.6, marginBottom: 4 },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorDot: { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  tickerName: { fontSize: 13, fontWeight: '700', width: 52 },
  barTrack: {
    flex: 1, height: 6,
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  tickerWeight: { fontSize: 12, width: 40, textAlign: 'right' },
  tickerAmount: { fontSize: 12, fontWeight: '600', width: 76, textAlign: 'right' },

  // ── 색상 선택기 ──
  colorOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  colorSheet: {
    borderRadius: 20, padding: 20,
    width: 340, borderWidth: 1,
  },
  colorSheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  colorPreviewDot: { width: 20, height: 20, borderRadius: 10 },
  colorSheetTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  colorSwatchActive: { borderWidth: 3, borderColor: '#fff' },

  // ── 월별 바 차트 ──
  barChartCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20, paddingHorizontal: 10, marginBottom: 20,
  },
  barChartTitle: { fontSize: 16, fontWeight: '700' },
  barChartArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barChartCol: { flex: 1, alignItems: 'center' },
  barAmountLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  barTrackBg: {
    width: '100%',
    borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden',
  },
  barMonthLabel: { fontSize: 11, marginTop: 6, textAlign: 'center' },

  // ── 월별 카드 ──
  monthCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16, marginBottom: 16,
  },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  monthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthTitle: { fontSize: 16, fontWeight: 'bold' },
  monthTotal: { fontSize: 16, fontWeight: 'bold' },
  currentBadge: {
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1,
  },
  currentBadgeText: { fontSize: 10, fontWeight: '700' },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderTopWidth: 1,
  },
  eventDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  eventTicker: { fontSize: 13, fontWeight: '700', width: 52 },
  eventDate: { fontSize: 12, flex: 1 },
  eventAmount: { fontSize: 13, fontWeight: '600' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '600' },

  // ── 연도 네비게이션 ──
  yearNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  yearNavBtn: { padding: 4 },

  // ── 선택 힌트 ──
  selectHint: { padding: 24, alignItems: 'center' },
  selectHintText: { fontSize: 12, textAlign: 'center' },

  // ── 배당 성장 차트 ──
  chartEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  growthBadgeText: { fontSize: 13, fontWeight: '600' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 2 },
  divBar: { width: 28, borderRadius: 4 },
  divXLabel: { fontSize: 9, marginTop: 4, textAlign: 'center' },
  divXSubLabel: { fontSize: 8, marginTop: 1, textAlign: 'center' },
  divGrowthSection: { marginTop: 8, marginBottom: 24 },
  divGrowthHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  divGrowthTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  divGrowthSubtitle: { fontSize: 11, opacity: 0.7 },
  divGrowthCard: {
    borderRadius: 14, padding: 16,
    borderWidth: 1,
  },
});
