import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { Heatmap } from '../../components/heatmap/Heatmap';
import { AddHoldingModal } from '../../components/portfolio/AddHoldingModal';
import { RefreshButton } from '../../components/common/RefreshButton';
import {
  formatKRW,
  formatUSD,
  formatPrice,
  formatPercent,
  formatDate,
  convertKRWToUSD,
} from '../../utils/portfolioCalculations';
import {
  generateDividendCalendar,
  getThisWeekDividends,
} from '../../utils/dividendCalendar';

export default function HomeScreen() {
  const {
    holdings,
    summary,
    isLoading,
    isRefreshing,
    refreshPrices,
    deleteHolding,
  } = usePortfolio();
  const [modalVisible, setModalVisible] = useState(false);

  const handleDeleteHolding = async (id: string, ticker: string) => {
    console.log('🗑️ Delete button clicked for:', ticker, id);

    // Web에서는 window.confirm 사용
    const confirmed = typeof window !== 'undefined' && window.confirm
      ? window.confirm(`${ticker}을(를) 삭제하시겠습니까?`)
      : true;

    if (!confirmed) {
      console.log('❌ Delete cancelled by user');
      return;
    }

    try {
      console.log('🗑️ Deleting holding:', id);
      await deleteHolding(id);
      console.log('✅ Delete successful');
    } catch (error) {
      console.error('❌ Delete failed:', error);
      Alert.alert('오류', '종목 삭제에 실패했습니다.');
    }
  };

  // 이번 주 배당 가져오기
  const thisWeekDividends = summary
    ? getThisWeekDividends(generateDividendCalendar(summary.holdings))
    : [];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>포트폴리오 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshPrices}
          tintColor={Colors.primary}
        />
      }
    >
      {/* 헤더와 새로고침 버튼 */}
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.greeting}>안녕하세요 👋</Text>
          <Text style={styles.subtitle}>오늘의 포트폴리오</Text>
        </View>
        <RefreshButton onRefresh={refreshPrices} isRefreshing={isRefreshing} />
      </View>

      {/* 총 자산 카드 */}
      <View style={styles.mainCard}>
        <Text style={styles.cardLabel}>총 자산 (USD)</Text>
        <Text style={styles.mainAmount}>
          {summary ? formatUSD(convertKRWToUSD(summary.totalValue)) : '$0.00'}
        </Text>
        <View style={styles.changeRow}>
          <Text
            style={[
              styles.profitText,
              summary && summary.totalProfitLoss < 0 && { color: Colors.loss },
            ]}
          >
            {summary
              ? `${formatUSD(convertKRWToUSD(summary.totalProfitLoss))} (${formatPercent(
                  summary.totalProfitLossPercent
                )})`
              : '+$0.00 (0.00%)'}
          </Text>
        </View>
      </View>

      {/* 요약 카드들 */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.summaryLabel}>수익률</Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  summary && summary.totalProfitLossPercent > 0
                    ? Colors.profit
                    : summary && summary.totalProfitLossPercent < 0
                    ? Colors.loss
                    : Colors.textSecondary,
              },
            ]}
          >
            {summary
              ? formatPercent(summary.totalProfitLossPercent)
              : '0.00%'}
          </Text>
        </View>
        <View style={[styles.summaryCard, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.summaryLabel}>월 배당</Text>
          <Text style={[styles.summaryValue, { color: Colors.dividend }]}>
            {summary ? formatKRW(summary.monthlyDividendEstimate) : '₩0'}
          </Text>
        </View>
      </View>

      {/* 포트폴리오 히트맵 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>포트폴리오</Text>
        <Heatmap holdings={holdings} />
      </View>

      {/* 이번 주 배당 */}
      {thisWeekDividends.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이번 주 배당</Text>
          {thisWeekDividends.slice(0, 3).map((div) => (
            <View key={div.id} style={styles.dividendCard}>
              <View style={styles.dividendRow}>
                <View>
                  <Text style={styles.stockName}>{div.stockName}</Text>
                  <Text style={styles.dividendDate}>
                    {formatDate(div.date)}
                  </Text>
                </View>
                <Text style={[styles.dividendAmount, { color: Colors.dividend }]}>
                  {formatKRW(div.amount)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 보유 주식 */}
      {holdings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>보유 주식</Text>
          {holdings.slice(0, 5).map((holding) => (
            <View key={holding.id} style={styles.stockCard}>
              <View style={styles.stockRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stockName}>{holding.ticker}</Text>
                  <Text style={styles.stockShares}>
                    {holding.quantity}주 • {holding.category}
                  </Text>
                </View>
                <View style={styles.stockRight}>
                  <Text style={styles.stockValue}>
                    {formatPrice(holding.currentValue, holding.category)}
                  </Text>
                  <Text
                    style={[
                      styles.stockChange,
                      {
                        color:
                          holding.profitLoss > 0
                            ? Colors.profit
                            : holding.profitLoss < 0
                            ? Colors.loss
                            : Colors.textSecondary,
                      },
                    ]}
                  >
                    {formatPercent(holding.profitLossPercent)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteHolding(holding.id, holding.ticker)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.loss} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 하단 여백 (FAB 공간 확보) */}
      <View style={{ height: 100 }} />

      {/* 플로팅 추가 버튼 */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={32} color={Colors.text} />
      </TouchableOpacity>

      {/* 자산 추가 모달 */}
      <AddHoldingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    marginTop: 16,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  header: {
    flex: 1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  mainCard: {
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 24,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  mainAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profitText: {
    fontSize: 16,
    color: Colors.profit,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  dividendCard: {
    backgroundColor: Colors.cardBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
    marginBottom: 12,
  },
  dividendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  dividendDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dividendAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stockCard: {
    backgroundColor: Colors.cardBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
    marginBottom: 12,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockShares: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  stockRight: {
    alignItems: 'flex-end',
  },
  stockValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  stockChange: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
