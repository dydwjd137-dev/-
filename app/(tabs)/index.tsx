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
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Heatmap, ViewMode } from '../../components/heatmap/Heatmap';
import { PieChart } from '../../components/heatmap/PieChart';
import { AddHoldingModal } from '../../components/portfolio/AddHoldingModal';
import AddOtherAssetModal from '../../components/portfolio/AddOtherAssetModal';
import ImageAnalysisModal from '../../components/portfolio/ImageAnalysisModal';
import CsvImportModal from '../../components/portfolio/CsvImportModal';
import ChatModal from '../../components/ai/ChatModal';
import ImageAnalysisResult from '../../components/ai/ImageAnalysisResult';
import { BrokerageDashboard } from '../../components/portfolio/BrokerageDashboard';
import { RefreshButton } from '../../components/common/RefreshButton';
import { SettingsModal } from '../../components/settings/SettingsModal';
import { OTHER_ASSET_ICONS } from '../../types/otherAssets';
import { analyzePortfolioImage, getPortfolioComment, ExtractedHolding, ImageAnalysisResponse, PortfolioCommentResponse } from '../../services/api/claude';
import PortfolioCommentModal from '../../components/ai/PortfolioCommentModal';
import { savePortfolioComment, loadPortfolioComment, formatSavedAt } from '../../services/storage/aiAnalysisStorage';
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
    addHolding,
    otherAssets,
    loans,
    otherAssetsTotal,
    loansTotal,
    showOtherAssetsInHeatmap,
    toggleOtherAssetsInHeatmap,
  } = usePortfolio();
  const [modalVisible, setModalVisible] = useState(false);
  const [otherAssetModalVisible, setOtherAssetModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [viewMode, setViewMode] = useState<ViewMode>('cumulative');
  const [chartMode, setChartMode] = useState<'heatmap' | 'pie'>('heatmap');
  const [showKRW, setShowKRW] = useState(false);

  // 이미지 분석 (카메라) → ImageAnalysisResult
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageResultVisible, setImageResultVisible] = useState(false);
  const [imageAnalysisData, setImageAnalysisData] = useState<ImageAnalysisResponse | null>(null);

  // 이미지 분석 (CSV) → 기존 ImageAnalysisModal 유지
  const [imageAnalysisVisible, setImageAnalysisVisible] = useState(false);
  const [extractedHoldings, setExtractedHoldings] = useState<ExtractedHolding[]>([]);

  // CSV 임포트
  const [csvVisible, setCsvVisible] = useState(false);

  // AI 포트폴리오 코멘트
  const [aiCommentData, setAiCommentData] = useState<PortfolioCommentResponse | null>(null);
  const [isCommentLoading, setIsCommentLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiSavedAt, setAiSavedAt] = useState<string | null>(null);

  // 저장된 분석 불러오기
  useEffect(() => {
    loadPortfolioComment<PortfolioCommentResponse>().then(stored => {
      if (stored) {
        setAiCommentData(stored.data);
        setAiSavedAt(formatSavedAt(stored.savedAt));
      }
    });
  }, []);

  // 저장된 분석 결과 보기 (재분석 없이)
  const handleOpenAiModal = () => {
    if (aiCommentData) {
      setAiModalVisible(true);
      return;
    }
    handleReanalyze();
  };

  // 실제 재분석
  const handleReanalyze = async () => {
    if (!summary || holdings.length === 0) {
      Alert.alert('보유 종목 없음', '종목을 먼저 추가해주세요.');
      return;
    }
    setAiModalVisible(true);
    setIsCommentLoading(true);
    try {
      const data = await getPortfolioComment({
        totalValue: summary.totalValue,
        totalCost: summary.totalCost,
        profitLossPercent: summary.totalProfitLossPercent,
        exchangeRate,
        holdings: holdings.map(h => ({
          ticker: h.ticker,
          category: h.category,
          currentValue: h.currentValue,
          profitLossPercent: h.profitLossPercent,
        })),
      });
      setAiCommentData(data);
      await savePortfolioComment(data);
      setAiSavedAt(formatSavedAt(new Date().toISOString()));
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? 'AI 코멘트를 불러오지 못했습니다.');
    } finally {
      setIsCommentLoading(false);
    }
  };

  const handleAddImageHoldings = async (selected: ExtractedHolding[]) => {
    for (const h of selected) {
      const priceKRW = h.currency === 'USD' ? h.avgPrice * exchangeRate : h.avgPrice;
      await addHolding({
        ticker: h.ticker,
        quantity: h.quantity,
        purchasePrice: priceKRW,
        accountType: h.accountType,
        category: (h.category ?? '미분류') as any,
        purchaseDate: new Date(),
      });
    }
  };

  const detectMimeType = (base64: string): string => {
    if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    return 'image/jpeg';
  };

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0].base64) return;

    setIsAnalyzing(true);
    try {
      const asset = result.assets[0];
      const mimeType = detectMimeType(asset.base64!);
      const data = await analyzePortfolioImage(asset.base64!, mimeType);
      setImageAnalysisData(data);
      setImageResultVisible(true);
    } catch (e: any) {
      Alert.alert('분석 실패', e?.message ?? '이미지에서 종목을 인식하지 못했습니다.\n증권앱 잔고 화면 캡처를 사용해보세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

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
          <View style={styles.assetAmountRow}>
            <Text style={[styles.totalAssetAmount, { color: themeColors.text }]} numberOfLines={1}>
              {summary
                ? showKRW
                  ? formatKRW(summary.totalValue)
                  : formatUSD(convertKRWToUSD(summary.totalValue, exchangeRate))
                : showKRW ? '₩0' : '$0.00'}
            </Text>
            <TouchableOpacity
              style={[styles.robotBtn, { backgroundColor: themeColors.primary + '18', borderColor: themeColors.primary + '40' }]}
              onPress={() => setChatVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.robotBtnEmoji}>🤖</Text>
            </TouchableOpacity>
          </View>
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
          <Heatmap
            holdings={holdings}
            viewMode={viewMode}
            showKRW={showKRW}
            exchangeRate={exchangeRate}
            otherAssets={otherAssets}
            showOtherAssetsInHeatmap={showOtherAssetsInHeatmap}
            onToggleOtherAssets={toggleOtherAssetsInHeatmap}
          />
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

      {/* 기타자산 & 순자산 섹션 */}
      <View style={[styles.otherSection, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        <View style={styles.otherSectionHeader}>
          <Text style={[styles.otherSectionTitle, { color: themeColors.text }]}>기타자산 &amp; 순자산</Text>
          <TouchableOpacity
            style={[styles.otherAddBtn, { backgroundColor: themeColors.primary }]}
            onPress={() => setOtherAssetModalVisible(true)}
          >
            <Ionicons name="add" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {otherAssets.length === 0 && loans.length === 0 ? (
          <Text style={[styles.otherEmptyText, { color: themeColors.textSecondary }]}>
            + 버튼으로 기타자산 또는 대출을 추가하세요
          </Text>
        ) : (
          <>
            {otherAssets.length > 0 && otherAssets.map(a => {
              const krwAmount = a.currency === 'USD' ? a.amount * exchangeRate : a.amount;
              return (
                <View key={a.id} style={[styles.otherRow, { borderBottomColor: themeColors.border }]}>
                  <Text style={styles.otherIcon}>{OTHER_ASSET_ICONS[a.subtype]}</Text>
                  <Text style={[styles.otherName, { color: themeColors.text }]}>{a.name}</Text>
                  <View style={styles.otherAmountCol}>
                    {a.currency === 'USD' && (
                      <Text style={[styles.otherAmountSub, { color: themeColors.textSecondary }]}>
                        ${a.amount.toLocaleString()}
                      </Text>
                    )}
                    <Text style={[styles.otherAmountMain, { color: themeColors.text }]}>
                      {formatKRW(krwAmount)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {loans.length > 0 && (
              <>
                <View style={[styles.sectionDivider, { backgroundColor: themeColors.border }]} />
                <Text style={[styles.otherSubLabel, { color: themeColors.textSecondary }]}>💳 대출</Text>
                {loans.map(l => (
                  <View key={l.id} style={[styles.otherRow, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.otherName, { color: themeColors.text }]}>{l.name}</Text>
                    <Text style={[styles.otherAmountMain, { color: themeColors.loss }]}>
                      -{formatKRW(l.amount)}
                    </Text>
                  </View>
                ))}
              </>
            )}

            <View style={[styles.sectionDivider, { backgroundColor: themeColors.border }]} />
            <View style={styles.netWorthRow}>
              <View style={styles.netWorthItem}>
                <Text style={[styles.netWorthLabel, { color: themeColors.textSecondary }]}>순자산</Text>
                <Text style={[styles.netWorthValue, { color: themeColors.text }]}>
                  {formatKRW((summary?.totalValue ?? 0) + otherAssetsTotal - loansTotal)}
                </Text>
              </View>
              <View style={[styles.netWorthDivider, { backgroundColor: themeColors.border }]} />
              <View style={styles.netWorthItem}>
                <Text style={[styles.netWorthLabel, { color: themeColors.textSecondary }]}>대출제외자산</Text>
                <Text style={[styles.netWorthValue, { color: themeColors.text }]}>
                  {formatKRW((summary?.totalValue ?? 0) + otherAssetsTotal)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* 월 예상배당금 */}
      <View style={styles.monthlyDividendContainer}>
        <Text style={[styles.monthlyDividendText, { color: themeColors.textSecondary }]}>
          {new Date().getMonth() + 1}월 예상배당금: {summary ? formatUSD(summary.monthlyDividendEstimate) : '$0.00'}
        </Text>
      </View>

      {/* AI 포트폴리오 분석 버튼 */}
      {holdings.length > 0 && (
        <TouchableOpacity
          style={[styles.aiCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
          onPress={handleOpenAiModal}
          activeOpacity={0.8}
        >
          <View style={styles.aiCardHeader}>
            <Text style={styles.aiCardEmoji}>🤖</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiCardTitle, { color: themeColors.text }]}>AI 포트폴리오 분석</Text>
              <Text style={[styles.aiCardPlaceholder, { color: themeColors.textSecondary, marginTop: 2 }]}>
                {aiSavedAt ? `${aiSavedAt} · 탭하여 보기` : (aiCommentData ? '분석 결과 보기' : '탭하여 AI 분석 시작')}
              </Text>
            </View>
            <View style={[styles.aiCardBtn, { backgroundColor: themeColors.primary + '18', borderColor: themeColors.primary + '50' }]}>
              <Ionicons name="sparkles" size={14} color={themeColors.primary} />
              <Text style={[styles.aiCardBtnText, { color: themeColors.primary }]}>{aiCommentData ? '보기' : '분석'}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      <PortfolioCommentModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        data={aiCommentData}
        loading={isCommentLoading}
        onReanalyze={handleReanalyze}
        savedAt={aiSavedAt}
      />

      {/* 하단 여백 (FAB 공간 확보) */}
      <View style={{ height: 100 }} />

      {/* CSV FAB */}
      <TouchableOpacity
        style={[styles.fabCsv, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
        onPress={() => setCsvVisible(true)}
      >
        <Ionicons name="document-text-outline" size={22} color={themeColors.primary} />
      </TouchableOpacity>

      {/* 카메라 FAB (이미지 분석) */}
      <TouchableOpacity
        style={[styles.fabCamera, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
        onPress={handleImagePick}
        disabled={isAnalyzing}
      >
        {isAnalyzing
          ? <ActivityIndicator size="small" color={themeColors.primary} />
          : <Ionicons name="camera-outline" size={22} color={themeColors.primary} />
        }
      </TouchableOpacity>

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

      {/* 기타자산 & 대출 모달 */}
      <AddOtherAssetModal
        visible={otherAssetModalVisible}
        onClose={() => setOtherAssetModalVisible(false)}
      />

      {/* AI 채팅 모달 */}
      <ChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
      />

      {/* 카메라 이미지 분석 결과 모달 (ImageAnalysisResult) */}
      <Modal visible={imageResultVisible} animationType="slide" onRequestClose={() => setImageResultVisible(false)}>
        {imageAnalysisData && (
          <ImageAnalysisResult
            data={imageAnalysisData}
            onAdd={handleAddImageHoldings}
            onClose={() => setImageResultVisible(false)}
          />
        )}
      </Modal>

      {/* CSV 이미지 분석 결과 모달 (기존 ImageAnalysisModal 유지) */}
      <ImageAnalysisModal
        visible={imageAnalysisVisible}
        holdings={extractedHoldings}
        onClose={() => setImageAnalysisVisible(false)}
        onDone={() => setImageAnalysisVisible(false)}
      />

      {/* CSV 텍스트 임포트 모달 */}
      <CsvImportModal
        visible={csvVisible}
        onClose={() => setCsvVisible(false)}
        onAnalyzed={(h) => {
          setExtractedHoldings(h);
          setImageAnalysisVisible(true);
        }}
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
  otherSection: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  otherSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  otherSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  otherAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherEmptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  otherIcon: {
    fontSize: 16,
  },
  otherName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  otherAmountCol: {
    alignItems: 'flex-end',
  },
  otherAmountSub: {
    fontSize: 11,
  },
  otherAmountMain: {
    fontSize: 13,
    fontWeight: '600',
  },
  otherSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 10,
  },
  netWorthRow: {
    flexDirection: 'row',
    paddingTop: 4,
  },
  netWorthItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  netWorthDivider: {
    width: 1,
  },
  netWorthLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  netWorthValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  assetAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  robotBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  robotBtnEmoji: {
    fontSize: 20,
  },
  fabCamera: {
    position: 'absolute',
    bottom: 24,
    right: 100,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabCsv: {
    position: 'absolute',
    bottom: 24,
    right: 164,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  aiCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  aiCardEmoji: {
    fontSize: 18,
  },
  aiCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  aiCardBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 72,
    alignItems: 'center',
  },
  aiCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiCardComment: {
    fontSize: 14,
    lineHeight: 22,
  },
  aiCardPlaceholder: {
    fontSize: 13,
    lineHeight: 20,
  },
});
