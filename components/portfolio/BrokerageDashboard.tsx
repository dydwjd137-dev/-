import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnrichedHolding, BROKERAGE_LIST, BrokerageId } from '../../types/portfolio';
import { BROKERAGE_LOGOS } from '../../constants/brokerageLogos';
import { formatKRW, formatPercent } from '../../utils/portfolioCalculations';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { getDisplayName } from '../../constants/searchDatabase';

interface BrokerageDashboardProps {
  holdings: EnrichedHolding[];
  exchangeRate: number;
  showKRW: boolean;
}

interface BrokerageSummary {
  id: BrokerageId;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  totalValue: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
  count: number;
  holdings: EnrichedHolding[];
}

// ── 로고 컴포넌트 ────────────────────────────────────────────────────────────
function BrokerLogo({ id, color, shortName, textColor, size = 56 }: {
  id: BrokerageId; color: string; shortName: string; textColor: string; size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const radius = size * 0.25;
  return (
    <View style={{
      width: size, height: size, borderRadius: radius,
      overflow: 'hidden', backgroundColor: color + '22',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: color,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: size * 0.18, fontWeight: '800', color: textColor, textAlign: 'center' }}>
          {shortName}
        </Text>
      </View>
      {!imgFailed && (
        <Image
          source={BROKERAGE_LOGOS[id]}
          style={{ width: size, height: size, position: 'absolute', zIndex: 2 }}
          resizeMode="contain"
          onError={() => setImgFailed(true)}
        />
      )}
    </View>
  );
}

export function BrokerageDashboard({ holdings, exchangeRate, showKRW }: BrokerageDashboardProps) {
  const { themeColors } = useTheme();
  const [selectedBrokerage, setSelectedBrokerage] = useState<BrokerageSummary | null>(null);
  const [dashMode, setDashMode] = useState<'summary' | 'detail'>('summary');
  const [expandedIds, setExpandedIds] = useState<Set<BrokerageId>>(new Set());

  const summaries = useMemo<BrokerageSummary[]>(() => {
    const map = new Map<BrokerageId, EnrichedHolding[]>();
    holdings.forEach(h => {
      if (!h.brokerage) return;
      const list = map.get(h.brokerage) ?? [];
      list.push(h);
      map.set(h.brokerage, list);
    });
    return Array.from(map.entries()).map(([id, hs]) => {
      const info = BROKERAGE_LIST.find(b => b.id === id)!;
      const totalValue = hs.reduce((s, h) => s + h.currentValue, 0);
      const totalCost  = hs.reduce((s, h) => s + h.totalCost,  0);
      const profitLoss = totalValue - totalCost;
      const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
      return { id, name: info.name, shortName: info.shortName, color: info.color, textColor: info.textColor,
        totalValue, totalCost, profitLoss, profitLossPercent, count: hs.length, holdings: hs };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }, [holdings]);

  if (summaries.length === 0) return null;

  const fv = (krw: number) =>
    showKRW
      ? formatKRW(krw)
      : `$${(krw / exchangeRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <View style={styles.section}>
      {/* 섹션 헤더 + 모드 토글 */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>계좌별 현황</Text>
        <View style={[styles.modeToggle, {
          backgroundColor: themeColors.cardBackground,
          borderColor: themeColors.border,
        }]}>
          <TouchableOpacity
            style={[styles.modeBtn, dashMode === 'summary' && { backgroundColor: themeColors.primary }]}
            onPress={() => setDashMode('summary')}
          >
            <Ionicons name="grid-outline" size={15}
              color={dashMode === 'summary' ? '#fff' : themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, dashMode === 'detail' && { backgroundColor: themeColors.primary }]}
            onPress={() => setDashMode('detail')}
          >
            <Ionicons name="list-outline" size={15}
              color={dashMode === 'detail' ? '#fff' : themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 요약 모드: 가로 스크롤 카드 ── */}
      {dashMode === 'summary' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
          {summaries.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.card, {
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.border,
              }]}
              onPress={() => setSelectedBrokerage(s)}
              activeOpacity={0.75}
            >
              <BrokerLogo id={s.id} color={s.color} shortName={s.shortName} textColor={s.textColor} size={56} />
              <Text style={[styles.cardName, { color: themeColors.textSecondary }]} numberOfLines={1}>{s.name}</Text>
              <Text style={[styles.cardValue, { color: themeColors.text }]}>{fv(s.totalValue)}</Text>
              <Text style={[styles.cardReturn, { color: s.profitLossPercent >= 0 ? themeColors.profit : themeColors.loss }]}>
                {formatPercent(s.profitLossPercent)}
              </Text>
              <Text style={[styles.cardCount, { color: themeColors.textSecondary }]}>{s.count}종목</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── 상세 모드: 아코디언 ── */}
      {dashMode === 'detail' && (
        <View style={styles.detailList}>
          {summaries.map(s => {
            const isPlusVal = s.profitLoss >= 0;
            const isPlusPct = s.profitLossPercent >= 0;
            const isExpanded = expandedIds.has(s.id);
            return (
              <View key={s.id} style={[styles.accordionCard, {
                backgroundColor: themeColors.cardBackground,
                borderColor: themeColors.border,
              }]}>
                {/* 헤더 행 */}
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() => setExpandedIds(prev => {
                    const next = new Set(prev);
                    next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                    return next;
                  })}
                  activeOpacity={0.8}
                >
                  <BrokerLogo id={s.id} color={s.color} shortName={s.shortName} textColor={s.textColor} size={52} />
                  <View style={styles.detailInfo}>
                    <View style={styles.detailTopRow}>
                      <Text style={[styles.detailName, { color: themeColors.text }]}>{s.name}</Text>
                      <Text style={[styles.detailValue, { color: themeColors.text }]}>{fv(s.totalValue)}</Text>
                    </View>
                    <View style={styles.detailBottomRow}>
                      <Text style={[styles.detailCount, { color: themeColors.textSecondary }]}>{s.count}종목</Text>
                      <View style={styles.detailPnlRow}>
                        <Text style={[styles.detailPnl, { color: isPlusVal ? themeColors.profit : themeColors.loss }]}>
                          {isPlusVal ? '+' : ''}{fv(s.profitLoss)}
                        </Text>
                        <View style={[styles.detailPctBadge, {
                          backgroundColor: isPlusPct ? themeColors.profit + '28' : themeColors.loss + '28',
                        }]}>
                          <Text style={[styles.detailPct, { color: isPlusPct ? themeColors.profit : themeColors.loss }]}>
                            {formatPercent(s.profitLossPercent)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={themeColors.textSecondary}
                  />
                </TouchableOpacity>

                {/* 펼쳐진 종목 리스트 */}
                {isExpanded && (
                  <View style={[styles.accordionBody, { borderTopColor: themeColors.border }]}>
                    {s.holdings.map(item => {
                      const isProfit = item.profitLossPercent >= 0;
                      return (
                        <View key={item.id} style={[styles.holdingRow, { borderBottomColor: themeColors.border }]}>
                          <View style={[styles.holdingBar, { backgroundColor: isProfit ? themeColors.profit : themeColors.loss }]} />
                          <View style={styles.holdingLeft}>
                            <Text style={[styles.holdingTicker, { color: themeColors.text }]} numberOfLines={1}>{getDisplayName(item.ticker)}</Text>
                            <Text style={[styles.holdingCategory, { color: themeColors.textSecondary }]}>{item.category}</Text>
                          </View>
                          <View style={styles.holdingRight}>
                            <Text style={[styles.holdingValue, { color: themeColors.text }]}>{fv(item.currentValue)}</Text>
                            <Text style={[styles.holdingReturn, { color: isProfit ? themeColors.profit : themeColors.loss }]}>
                              {formatPercent(item.profitLossPercent)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── 계좌 상세 모달 ── */}
      <Modal
        visible={selectedBrokerage !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedBrokerage(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: themeColors.background }]}>
            {selectedBrokerage && (
              <>
                <View style={[styles.sheetHeader, { borderBottomColor: themeColors.border }]}>
                  <View style={styles.sheetTitleRow}>
                    <BrokerLogo
                      id={selectedBrokerage.id}
                      color={selectedBrokerage.color}
                      shortName={selectedBrokerage.shortName}
                      textColor={selectedBrokerage.textColor}
                      size={48}
                    />
                    <View style={styles.sheetTitleText}>
                      <Text style={[styles.sheetName, { color: themeColors.text }]}>{selectedBrokerage.name}</Text>
                      <Text style={[styles.sheetCount, { color: themeColors.textSecondary }]}>{selectedBrokerage.count}종목</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedBrokerage(null)}>
                      <Ionicons name="close" size={26} color={themeColors.text} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.summaryRow, {
                    backgroundColor: themeColors.cardBackground,
                    borderColor: themeColors.border,
                  }]}>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>평가금액</Text>
                      <Text style={[styles.summaryValue, { color: themeColors.text }]}>{fv(selectedBrokerage.totalValue)}</Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>수익금</Text>
                      <Text style={[styles.summaryValue,
                        { color: selectedBrokerage.profitLoss >= 0 ? themeColors.profit : themeColors.loss }]}>
                        {selectedBrokerage.profitLoss >= 0 ? '+' : ''}{fv(selectedBrokerage.profitLoss)}
                      </Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryLabel, { color: themeColors.textSecondary }]}>수익률</Text>
                      <Text style={[styles.summaryValue,
                        { color: selectedBrokerage.profitLossPercent >= 0 ? themeColors.profit : themeColors.loss }]}>
                        {formatPercent(selectedBrokerage.profitLossPercent)}
                      </Text>
                    </View>
                  </View>
                </View>

                <FlatList
                  data={selectedBrokerage.holdings}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.holdingList}
                  renderItem={({ item }) => {
                    const isProfit = item.profitLossPercent >= 0;
                    return (
                      <View style={[styles.holdingRow, { borderBottomColor: themeColors.border }]}>
                        <View style={[styles.holdingBar, { backgroundColor: isProfit ? themeColors.profit : themeColors.loss }]} />
                        <View style={styles.holdingLeft}>
                          <Text style={[styles.holdingTicker, { color: themeColors.text }]}>{item.ticker}</Text>
                          <Text style={[styles.holdingCategory, { color: themeColors.textSecondary }]}>{item.category}</Text>
                        </View>
                        <View style={styles.holdingRight}>
                          <Text style={[styles.holdingValue, { color: themeColors.text }]}>{fv(item.currentValue)}</Text>
                          <Text style={[styles.holdingReturn, { color: isProfit ? themeColors.profit : themeColors.loss }]}>
                            {formatPercent(item.profitLossPercent)}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  modeToggle: {
    flexDirection: 'row', gap: 4,
    borderRadius: 10, padding: 3,
    borderWidth: 1,
  },
  modeBtn: { padding: 6, borderRadius: 7 },

  // ── 요약 카드 ──
  cardRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  card: {
    borderRadius: 16, padding: 14, width: 120, alignItems: 'center',
    borderWidth: 1,
  },
  cardName: { fontSize: 11, marginTop: 8, marginBottom: 4, textAlign: 'center' },
  cardValue: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  cardReturn: { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  cardCount: { fontSize: 11 },

  // ── 상세 리스트 ──
  detailList: { paddingHorizontal: 16, gap: 8 },
  accordionCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14,
  },
  accordionBody: {
    borderTopWidth: 1,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  detailInfo: { flex: 1 },
  detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  detailName: { fontSize: 14, fontWeight: '700' },
  detailValue: { fontSize: 15, fontWeight: '700' },
  detailBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailCount: { fontSize: 12 },
  detailPnlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailPnl: { fontSize: 12, fontWeight: '600' },
  detailPctBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  detailPct: { fontSize: 12, fontWeight: '700' },

  // ── 모달 ──
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  sheetHeader: { padding: 24, borderBottomWidth: 1 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  sheetTitleText: { flex: 1 },
  sheetName: { fontSize: 18, fontWeight: '700' },
  sheetCount: { fontSize: 13, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    borderRadius: 12, padding: 16,
    borderWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryDivider: { width: 1, marginVertical: 4 },
  holdingList: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  holdingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 10,
    borderBottomWidth: 1,
  },
  holdingBar: { width: 3, height: 36, borderRadius: 2 },
  holdingLeft: { flex: 1 },
  holdingTicker: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  holdingCategory: { fontSize: 12 },
  holdingRight: { alignItems: 'flex-end' },
  holdingValue: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  holdingReturn: { fontSize: 13, fontWeight: '600' },
});
