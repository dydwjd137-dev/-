import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { stockPerformanceService } from '../../services/performance/TwelveDataPerformanceService';
import { Period, CustomRange, StockPerformanceData } from '../../services/performance/IStockPerformanceService';
import PeriodSelector from './PeriodSelector';
import StockPerformanceCard from './StockPerformanceCard';

export default function StockPerformanceTab() {
  const { themeColors } = useTheme();
  const { holdings } = usePortfolio();
  const [period, setPeriod] = useState<Period>('weekly');
  const [customRange, setCustomRange] = useState<CustomRange>({ startDate: '', endDate: '' });
  const [data, setData] = useState<StockPerformanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRef = useRef(0);
  // holdings를 ref로 관리 → load가 holdings에 직접 의존하지 않아 WS 시세 업데이트 시 재호출 방지
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;

  const load = useCallback(async (p: Period, range?: CustomRange) => {
    const symbols = [...new Set(holdingsRef.current.map(h => h.ticker))];
    if (symbols.length === 0) return;
    if (p === 'custom' && (!range?.startDate || !range?.endDate)) return;

    const token = ++fetchRef.current;
    setLoading(true);
    setError(null);

    try {
      // 기간 시작가 → 기간 종료가 수익률 (서비스에서 계산)
      const result = await stockPerformanceService.fetchPerformance(symbols, p, range);
      if (token !== fetchRef.current) return;
      setData(result);
    } catch {
      if (token !== fetchRef.current) return;
      setError('데이터를 불러오지 못했습니다');
    } finally {
      if (token === fetchRef.current) setLoading(false);
    }
  }, []); // holdings 제거: holdingsRef.current로 접근하므로 deps 불필요

  // ticker 목록 변화 감지용 키 (시세 변동은 무시, 종목 추가/삭제만 감지)
  const tickerKey = useMemo(
    () => holdings.map(h => h.ticker).sort().join(','),
    [holdings],
  );

  // load는 stable(deps:[])이므로 period 또는 tickerKey 변경 시에만 실행
  // WS 시세 업데이트는 tickerKey를 변경하지 않아 재호출되지 않음
  useEffect(() => {
    if (period !== 'custom') load(period);
  }, [period, tickerKey, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setData([]);
  };

  if (holdings.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>보유 종목을 추가하면{'\n'}성과가 표시됩니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.periodWrap}>
        <PeriodSelector selected={period} onSelect={handlePeriodChange} />
      </View>

      {period === 'custom' && (
        <View style={styles.customRow}>
          <TextInput
            style={[styles.dateInput, { color: themeColors.text, backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
            placeholder="시작일 (YYYY-MM-DD)"
            placeholderTextColor={themeColors.textSecondary}
            value={customRange.startDate}
            onChangeText={v => setCustomRange(r => ({ ...r, startDate: v }))}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[styles.dateSep, { color: themeColors.textSecondary }]}>~</Text>
          <TextInput
            style={[styles.dateInput, { color: themeColors.text, backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
            placeholder="종료일 (YYYY-MM-DD)"
            placeholderTextColor={themeColors.textSecondary}
            value={customRange.endDate}
            onChangeText={v => setCustomRange(r => ({ ...r, endDate: v }))}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: themeColors.primary }]} onPress={() => load('custom', customRange)} activeOpacity={0.8}>
            <Text style={styles.searchBtnText}>조회</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>시세 불러오는 중…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: themeColors.loss }]}>{error}</Text>
          <TouchableOpacity onPress={() => load(period, customRange)} activeOpacity={0.8}>
            <Text style={[styles.retryText, { color: themeColors.primary }]}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>데이터가 없습니다</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.listHeader}>
            <Text style={[styles.listHeaderText, { color: themeColors.textSecondary }]}>종목</Text>
            <Text style={[styles.listHeaderText, { color: themeColors.textSecondary }]}>기간종가 / 전일종가</Text>
            <Text style={[styles.listHeaderText, { color: themeColors.textSecondary }]}>수익률</Text>
          </View>
          {data.map((item, idx) => (
            <StockPerformanceCard key={item.symbol} data={item} rank={idx + 1} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  periodWrap: { marginBottom: 12 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  dateInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    fontSize: 12,
    borderWidth: 1,
  },
  dateSep: { fontSize: 14 },
  searchBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  searchBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 6 },
  listHeaderText: { fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  loadingText: { fontSize: 13, marginTop: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryText: { fontSize: 13, textDecorationLine: 'underline' },
});
