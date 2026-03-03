import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Heatmap, ViewMode } from '../../components/heatmap/Heatmap';
import { PieChart } from '../../components/heatmap/PieChart';
import { AddHoldingModal } from '../../components/portfolio/AddHoldingModal';
import { BrokerageDashboard } from '../../components/portfolio/BrokerageDashboard';
import { RefreshButton } from '../../components/common/RefreshButton';
import { SettingsModal } from '../../components/settings/SettingsModal';
import {
  formatUSD,
  convertKRWToUSD,
  formatPercent,
  formatKRW,
} from '../../utils/portfolioCalculations';

export default function HomeScreen() {
  const { themeColors } = useTheme();
  const { isGuest } = useAuth();
  const router = useRouter();
  const {
    holdings,
    summary,
    isLoading,
    isRefreshing,
    refreshPrices,
    exchangeRate,
  } = usePortfolio();
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [viewMode, setViewMode] = useState<ViewMode>('cumulative');
  const [chartMode, setChartMode] = useState<'heatmap' | 'pie'>('heatmap');
  const [showKRW, setShowKRW] = useState(false);

  // 슬라이드 애니메이션 (3초마다 전환)
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide((prev) => (prev + 1) % 2);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          포트폴리오 불러오는 중...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={refreshPrices}
          tintColor={themeColors.primary}
        />
      }
    >
      {/* 헤더: 포트폴리오 정보 + 새로고침 버튼 */}
      <View style={styles.headerRow}>
        <View style={styles.portfolioHeader}>
          {/* 환율 + 원화 토글 버튼 */}
          <View style={styles.rateRow}>
            <Text style={[styles.portfolioLabel, { color: themeColors.textSecondary }]}>
              1 USD = {exchangeRate.toLocaleString('ko-KR')}원
            </Text>
            <TouchableOpacity
              style={[
                styles.currencyToggle,
                { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
                showKRW && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
              ]}
              onPress={() => setShowKRW((v) => !v)}
            >
              <Text style={[
                styles.currencyToggleText,
                { color: showKRW ? '#fff' : themeColors.textSecondary },
              ]}>
                {showKRW ? '₩ 원화' : '$ 달러'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.totalAssetAmount, { color: themeColors.text }]} numberOfLines={1}>
            {summary
              ? showKRW
                ? formatKRW(summary.totalValue)
                : formatUSD(convertKRWToUSD(summary.totalValue, exchangeRate))
              : showKRW ? '₩0' : '$0.00'}
          </Text>
          {/* 슬라이드되는 수익 정보 (고정 높이) */}
          <View style={styles.slidingContainer}>
            <Animated.View style={{ opacity: fadeAnim, position: 'absolute', width: '100%' }}>
              <Text style={[styles.slidingText, { color: themeColors.textSecondary }]}>
                {currentSlide === 0
                  ? `총 수익 ${summary && summary.totalProfitLoss >= 0 ? '+' : ''}${summary
                      ? showKRW
                        ? formatKRW(summary.totalProfitLoss)
                        : formatUSD(convertKRWToUSD(summary.totalProfitLoss, exchangeRate))
                      : showKRW ? '₩0' : '$0.00'} (${summary ? formatPercent(summary.totalProfitLossPercent) : '0.00%'})`
                  : `일간 수익 ${summary && summary.dailyProfitLoss >= 0 ? '+' : ''}${summary
                      ? showKRW
                        ? formatKRW(summary.dailyProfitLoss)
                        : formatUSD(convertKRWToUSD(summary.dailyProfitLoss, exchangeRate))
                      : showKRW ? '₩0' : '$0.00'}`}
              </Text>
            </Animated.View>
          </View>
        </View>
        <View style={styles.headerActions}>
          {isGuest && (
            <TouchableOpacity
              style={[styles.loginChip, { backgroundColor: themeColors.primary }]}
              onPress={() => router.push('/(auth)/login')}
            >
              <Ionicons name="person-outline" size={14} color="#fff" />
              <Text style={styles.loginChipText}>로그인</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.gearButton,
              { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
            ]}
            onPress={() => setSettingsVisible(true)}
          >
            <Ionicons name="settings-outline" size={22} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <RefreshButton onRefresh={refreshPrices} isRefreshing={isRefreshing} />
        </View>
      </View>

      {/* 차트 타입 토글 (히트맵 / 원형그래프) */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
            chartMode === 'heatmap' && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
          ]}
          onPress={() => setChartMode('heatmap')}
        >
          <Text style={[
            styles.toggleButtonText,
            { color: chartMode === 'heatmap' ? '#fff' : themeColors.textSecondary },
          ]}>
            히트맵
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
            chartMode === 'pie' && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
          ]}
          onPress={() => setChartMode('pie')}
        >
          <Text style={[
            styles.toggleButtonText,
            { color: chartMode === 'pie' ? '#fff' : themeColors.textSecondary },
          ]}>
            원형그래프
          </Text>
        </TouchableOpacity>
      </View>

      {/* 일간/누적 토글 버튼 (히트맵 모드에서만 표시) */}
      {chartMode === 'heatmap' && (
        <View style={[styles.toggleContainer, { marginTop: -4 }]}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
              viewMode === 'daily' && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
            ]}
            onPress={() => setViewMode('daily')}
          >
            <Text style={[
              styles.toggleButtonText,
              { color: viewMode === 'daily' ? '#fff' : themeColors.textSecondary },
            ]}>
              일간
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
              viewMode === 'cumulative' && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
            ]}
            onPress={() => setViewMode('cumulative')}
          >
            <Text style={[
              styles.toggleButtonText,
              { color: viewMode === 'cumulative' ? '#fff' : themeColors.textSecondary },
            ]}>
              누적
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 히트맵 / 원형그래프 */}
      <View style={styles.heatmapContainer}>
        {chartMode === 'heatmap' ? (
          <Heatmap holdings={holdings} viewMode={viewMode} showKRW={showKRW} exchangeRate={exchangeRate} />
        ) : (
          <PieChart holdings={holdings} exchangeRate={exchangeRate} showKRW={showKRW} />
        )}
      </View>

      {/* 계좌별 현황 */}
      <BrokerageDashboard
        holdings={holdings}
        exchangeRate={exchangeRate}
        showKRW={showKRW}
      />

      {/* 월 예상배당금 */}
      <View style={styles.monthlyDividendContainer}>
        <Text style={[styles.monthlyDividendText, { color: themeColors.textSecondary }]}>
          {new Date().getMonth() + 1}월 예상배당금: {summary ? formatUSD(summary.monthlyDividendEstimate) : '$0.00'}
        </Text>
      </View>

      {/* 하단 여백 (FAB 공간 확보) */}
      <View style={{ height: 100 }} />

      {/* 플로팅 추가 버튼 */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: themeColors.primary }]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* 자산 추가 모달 */}
      <AddHoldingModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />

      {/* 설정 모달 */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  portfolioHeader: {
    flex: 1,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  portfolioLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  currencyToggle: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  currencyToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  slidingContainer: {
    height: 20,
    marginTop: 4,
    position: 'relative',
  },
  slidingText: {
    fontSize: 13,
  },
  totalAssetAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  gearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 12,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  heatmapContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  monthlyDividendContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  monthlyDividendText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loginChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  loginChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
