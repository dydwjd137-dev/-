import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import {
  EnrichedHolding,
  AccountType,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_COLORS,
  BrokerageId,
  BROKERAGE_LIST,
} from '../../types/portfolio';
import {
  CapitalSourceType,
  CapitalMixEntry,
  CAPITAL_SOURCE_LABELS,
  CAPITAL_SOURCE_COLORS,
  CAPITAL_SOURCE_OPTIONS,
} from '../../types/capitalSource';
import {
  formatUSD,
  formatKRW,
  convertKRWToUSD,
  formatPercent,
} from '../../utils/portfolioCalculations';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { getDisplayName } from '../../constants/searchDatabase';
import {
  loadCustomCategories,
  saveCustomCategory,
  deleteCustomCategory,
} from '../../services/storage/customCategoriesStorage';

const NVSTLY_BASE  = 'https://github.com/nvstly/icons/raw/refs/heads/main/ticker_icons';
const FMP_BASE     = 'https://financialmodelingprep.com/image-stock';
const CRYPTO_BASE  = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color';
const PRESET_CATEGORIES = ['미국주식', '한국주식'];
const ACCOUNT_TYPES: AccountType[] = ['REGULAR', 'ISA', 'PENSION', 'IRP', 'RETIREMENT'];

interface HoldingDetailModalProps {
  visible: boolean;
  holding: EnrichedHolding | null;
  onClose: () => void;
}

export function HoldingDetailModal({
  visible,
  holding,
  onClose,
}: HoldingDetailModalProps) {
  const { themeColors } = useTheme();
  const { updateHolding, deleteHolding, exchangeRate } = usePortfolio();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountTypePicker, setShowAccountTypePicker] = useState(false);
  const [showBrokeragePicker, setShowBrokeragePicker] = useState(false);
  const [showCapitalSourcePicker, setShowCapitalSourcePicker] = useState(false);

  // 수량·현재가 인라인 편집
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(String(holding?.quantity ?? ''));
  const [editingManualPrice, setEditingManualPrice] = useState(false);
  const [localManualPrice, setLocalManualPrice] = useState(String(holding?.manualPrice ?? ''));

  // 즉시 반영용 로컬 상태
  const [localCategory, setLocalCategory] = useState(holding?.category ?? '');
  const [localAccountType, setLocalAccountType] = useState<AccountType>(holding?.accountType ?? 'REGULAR');
  const [localBrokerage, setLocalBrokerage] = useState<BrokerageId | undefined>(holding?.brokerage);
  const defaultMix: CapitalMixEntry[] = [{ source: CapitalSourceType.PRINCIPAL, ratio: 100 }];
  const [localCapitalMix, setLocalCapitalMix] = useState<CapitalMixEntry[]>(
    holding?.capitalMix ?? defaultMix,
  );
  const [editRatios, setEditRatios] = useState<Record<CapitalSourceType, string>>({
    [CapitalSourceType.PRINCIPAL]:    '100',
    [CapitalSourceType.DIVIDEND]:     '0',
    [CapitalSourceType.INTEREST]:     '0',
    [CapitalSourceType.CAPITAL_GAIN]: '0',
    [CapitalSourceType.TRANSFER]:     '0',
  });

  // holding prop이 바뀌면 (다른 종목 열릴 때) 로컬 상태 동기화
  useEffect(() => {
    if (holding) {
      setLocalCategory(holding.category);
      setLocalAccountType(holding.accountType ?? 'REGULAR');
      setLocalBrokerage(holding.brokerage);
      setLocalCapitalMix(holding.capitalMix ?? defaultMix);
      setLocalQuantity(String(holding.quantity));
      setLocalManualPrice(holding.manualPrice ? String(holding.manualPrice) : '');
      setEditingQuantity(false);
      setEditingManualPrice(false);
    }
  }, [holding?.id]);

  // 커스텀 카테고리
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const addCatInputRef = useRef<TextInput>(null);

  // 로고 로드 순서
  // 한국(.KS/.KQ/.KO): FMP({ticker}.png) → none
  // 숫자형 한국(005930 등): FMP({ticker}.KS.png) → none
  // 그 외: nvstly → FMP({ticker}.png) → none
  const [logoUri, setLogoUri]   = useState<string | null>(null);
  const [logoStep, setLogoStep] = useState<'crypto' | 'nvstly' | 'fmp' | 'fmp-ks' | 'none'>('nvstly');

  useEffect(() => {
    if (holding) {
      const isCrypto        = /-USD[T]?$/.test(holding.ticker);
      const isKorean        = holding.ticker.endsWith('.KS') || holding.ticker.endsWith('.KQ') || holding.ticker.endsWith('.KO');
      const isNumericKorean = /^\d{5,6}$/.test(holding.ticker);

      if (isCrypto) {
        // BTC-USD → btc, ETH-USD → eth
        const baseSymbol = holding.ticker.split('-')[0].toLowerCase();
        setLogoStep('crypto');
        setLogoUri(`${CRYPTO_BASE}/${baseSymbol}.png`);
      } else if (isKorean) {
        setLogoStep('fmp');
        setLogoUri(`${FMP_BASE}/${holding.ticker}.png`);
      } else if (isNumericKorean) {
        setLogoStep('fmp-ks');
        setLogoUri(`${FMP_BASE}/${holding.ticker}.KS.png`);
      } else {
        setLogoStep('nvstly');
        setLogoUri(`${NVSTLY_BASE}/${holding.ticker}.png`);
      }
    }
  }, [holding?.ticker]);

  // 카테고리 피커 열릴 때 커스텀 카테고리 로드
  useEffect(() => {
    if (showCategoryPicker) {
      loadCustomCategories().then(setCustomCategories);
      setShowAddCatInput(false);
      setNewCatName('');
    }
  }, [showCategoryPicker]);

  // 입력창 자동 포커스
  useEffect(() => {
    if (showAddCatInput) {
      setTimeout(() => addCatInputRef.current?.focus(), 100);
    }
  }, [showAddCatInput]);

  const handleLogoError = () => {
    if (!holding) return;
    if (logoStep === 'nvstly') {
      setLogoStep('fmp');
      setLogoUri(`${FMP_BASE}/${holding.ticker}.png`);
    } else {
      // crypto / fmp / fmp-ks 실패 → 아이콘 없음
      setLogoStep('none');
      setLogoUri(null);
    }
  };

  if (!holding) return null;

  const allCategories = [...PRESET_CATEGORIES, ...customCategories];

  const handleCategoryChange = async (cat: string) => {
    setLocalCategory(cat);           // 즉시 반영
    setShowCategoryPicker(false);
    updateHolding(holding.id, { category: cat }).catch(() => {
      Alert.alert('오류', '카테고리 변경에 실패했습니다.');
    });
  };

  const handleDeleteCategory = async (cat: string) => {
    const updated = await deleteCustomCategory(cat);
    setCustomCategories(updated);
    if (localCategory === cat) {
      handleCategoryChange('미국주식');
    }
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    // 이미 있는 카테고리면 바로 선택
    if (allCategories.includes(name)) {
      handleCategoryChange(name);
      return;
    }
    const updated = await saveCustomCategory(name);
    setCustomCategories(updated);
    handleCategoryChange(name);
  };

  const handleAccountTypeChange = (newAccountType: AccountType) => {
    setLocalAccountType(newAccountType);  // 즉시 반영
    setShowAccountTypePicker(false);
    updateHolding(holding.id, { accountType: newAccountType }).catch(() => {
      Alert.alert('오류', '계좌 유형 변경에 실패했습니다.');
    });
  };

  const handleBrokerageChange = (id: BrokerageId | undefined) => {
    setLocalBrokerage(id);
    setShowBrokeragePicker(false);
    updateHolding(holding.id, { brokerage: id }).catch(() => {
      Alert.alert('오류', '증권사 변경에 실패했습니다.');
    });
  };

  const editTotal = CAPITAL_SOURCE_OPTIONS.reduce(
    (sum, src) => sum + (parseFloat(editRatios[src]) || 0), 0,
  );

  const handleCapitalMixConfirm = () => {
    if (Math.round(editTotal) !== 100) {
      Alert.alert('오류', `합계가 ${editTotal.toFixed(0)}%입니다. 100%로 맞춰주세요.`);
      return;
    }
    const mix: CapitalMixEntry[] = CAPITAL_SOURCE_OPTIONS
      .map(src => ({ source: src, ratio: parseFloat(editRatios[src]) || 0 }))
      .filter(e => e.ratio > 0);
    setLocalCapitalMix(mix);              // 즉시 반영
    setShowCapitalSourcePicker(false);
    updateHolding(holding.id, { capitalMix: mix }).catch(() => {
      Alert.alert('오류', '재원 변경에 실패했습니다.');
    });
  };

  const handleSaveQuantity = () => {
    const q = parseFloat(localQuantity);
    if (isNaN(q) || q <= 0) {
      Alert.alert('오류', '올바른 수량을 입력해주세요.');
      return;
    }
    setEditingQuantity(false);
    updateHolding(holding.id, { quantity: q }).catch(() => {
      Alert.alert('오류', '수량 변경에 실패했습니다.');
    });
  };

  const handleSaveManualPrice = () => {
    const p = parseFloat(localManualPrice);
    if (isNaN(p) || p <= 0) {
      Alert.alert('오류', '올바른 가격을 입력해주세요.');
      return;
    }
    setEditingManualPrice(false);
    updateHolding(holding.id, { manualPrice: p }).catch(() => {
      Alert.alert('오류', '가격 변경에 실패했습니다.');
    });
  };

  const handleClearManualPrice = () => {
    setLocalManualPrice('');
    setEditingManualPrice(false);
    updateHolding(holding.id, { manualPrice: undefined }).catch(() => {
      Alert.alert('오류', '가격 초기화에 실패했습니다.');
    });
  };

  const handleDeleteConfirm = () => {
    const idToDelete = holding.id;
    onClose();
    deleteHolding(idToDelete).catch(() => {});
  };

  const isKRW = holding.ticker.endsWith('.KS') || holding.ticker.endsWith('.KQ') || holding.ticker.endsWith('.KO');
  const currentPrice = holding.quote?.currentPrice || 0;
  // 주당 연배당 (native 통화) — yield 계산용 (분자/분모 동일 통화)
  const annualDividendNative =
    holding.dividends.length > 0
      ? holding.dividends.reduce((sum, d) => {
          const times =
            d.frequency === 'MONTHLY' ? 12
            : d.frequency === 'QUARTERLY' ? 4
            : d.frequency === 'SEMI_ANNUAL' ? 2
            : 1;
          return sum + d.amount * times;
        }, 0)
      : 0;
  // 주당 연배당 USD — 화면 표시용
  const annualDividend =
    holding.dividends.length > 0
      ? holding.dividends.reduce((sum, d) => {
          const times =
            d.frequency === 'MONTHLY' ? 12
            : d.frequency === 'QUARTERLY' ? 4
            : d.frequency === 'SEMI_ANNUAL' ? 2
            : 1;
          const amtUSD = d.currency === 'KRW' ? d.amount / exchangeRate : d.amount;
          return sum + amtUSD * times;
        }, 0)
      : 0;

  const dividendYield = currentPrice > 0 ? (annualDividendNative / currentPrice) * 100 : 0;
  const frequency = holding.dividends.length > 0 ? holding.dividends[0].frequency : null;

  const getFrequencyText = (freq: string | null) => {
    switch (freq) {
      case 'MONTHLY':    return '월배당';
      case 'QUARTERLY':  return '분기배당';
      case 'SEMI_ANNUAL': return '반기배당';
      case 'ANNUAL':     return '연배당';
      default:           return '배당 없음';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: themeColors.background }]}>
          {/* 헤더 */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <View>
              <Text style={[styles.ticker, { color: themeColors.text }]}>{getDisplayName(holding.ticker)}</Text>
              {getDisplayName(holding.ticker) !== holding.ticker && (
                <Text style={[styles.tickerCode, { color: themeColors.textSecondary }]}>{holding.ticker}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {/* 현재가 */}
            <View style={styles.priceSection}>
              {logoUri && logoStep !== 'none' && (
                <Image
                  source={{ uri: logoUri }}
                  style={styles.tickerLogo}
                  resizeMode="contain"
                  onError={handleLogoError}
                />
              )}
              <Text style={[styles.priceLabel, { color: themeColors.textSecondary }]}>현재가</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.priceValue, { color: themeColors.text }]}>{isKRW ? formatKRW(currentPrice) : formatUSD(currentPrice)}</Text>
              </View>
              <Text style={[
                styles.priceChange,
                { color: (holding.quote?.changePercent || 0) >= 0 ? themeColors.profit : themeColors.loss },
              ]}>
                {formatPercent(holding.quote?.changePercent || 0)}
              </Text>
            </View>

            {/* 상세 정보 */}
            <View style={[styles.detailsSection, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
              {/* 카테고리 (클릭하면 피커) */}
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>카테고리</Text>
                <View style={styles.rowRight}>
                  <Text style={[styles.detailValue, { color: themeColors.text }]}>{localCategory}</Text>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* 계좌 유형 (클릭하면 피커) */}
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => setShowAccountTypePicker(true)}
              >
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>계좌 유형</Text>
                <View style={styles.rowRight}>
                  <View style={[
                    styles.accountTypeBadge,
                    { backgroundColor: ACCOUNT_TYPE_COLORS[localAccountType] + '22' },
                  ]}>
                    <Text style={[
                      styles.accountTypeBadgeText,
                      { color: ACCOUNT_TYPE_COLORS[localAccountType] },
                    ]}>
                      {ACCOUNT_TYPE_LABELS[localAccountType]}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* 증권사 (클릭하면 피커) */}
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => setShowBrokeragePicker(true)}
              >
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>증권사</Text>
                <View style={styles.rowRight}>
                  {localBrokerage ? (() => {
                    const b = BROKERAGE_LIST.find(x => x.id === localBrokerage)!;
                    return (
                      <View style={[styles.accountTypeBadge, { backgroundColor: b.color + '22' }]}>
                        <Text style={[styles.accountTypeBadgeText, { color: b.color }]}>{b.name}</Text>
                      </View>
                    );
                  })() : (
                    <Text style={[styles.detailValue, { color: themeColors.textSecondary }]}>미설정</Text>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                </View>
              </TouchableOpacity>

              {/* 투자 재원 (클릭하면 피커) */}
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => {
                  // 피커 열릴 때 현재 mix로 editRatios 초기화
                  const init: Record<CapitalSourceType, string> = {
                    [CapitalSourceType.PRINCIPAL]:    '0',
                    [CapitalSourceType.DIVIDEND]:     '0',
                    [CapitalSourceType.INTEREST]:     '0',
                    [CapitalSourceType.CAPITAL_GAIN]: '0',
                    [CapitalSourceType.TRANSFER]:     '0',
                  };
                  localCapitalMix.forEach(e => { init[e.source] = String(e.ratio); });
                  setEditRatios(init);
                  setShowCapitalSourcePicker(true);
                }}
              >
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>투자 재원</Text>
                <View style={styles.rowRight}>
                  <Text style={[styles.detailValue, { color: themeColors.text }]} numberOfLines={1}>
                    {localCapitalMix.map(e => `${CAPITAL_SOURCE_LABELS[e.source]} ${e.ratio}%`).join(' · ')}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                </View>
              </TouchableOpacity>

              <View style={[styles.separator, { backgroundColor: themeColors.border }]} />

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>시가배당률</Text>
                <Text style={[styles.detailValue, { color: themeColors.text }]}>{(dividendYield || 0).toFixed(2)}%</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>1년 배당금</Text>
                <Text style={[styles.detailValue, { color: themeColors.text }]}>{isKRW ? formatKRW(annualDividendNative) : formatUSD(annualDividend)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>배당 주기</Text>
                <Text style={[styles.detailValue, { color: themeColors.text }]}>{getFrequencyText(frequency)}</Text>
              </View>

              <View style={[styles.separator, { backgroundColor: themeColors.border }]} />

              {/* 보유 수량 — 인라인 편집 */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>보유 수량</Text>
                {editingQuantity ? (
                  <View style={styles.inlineEditRow}>
                    <TextInput
                      style={[styles.inlineInput, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.primary, color: themeColors.text }]}
                      value={localQuantity}
                      onChangeText={setLocalQuantity}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                    <Text style={[styles.inlineUnit, { color: themeColors.textSecondary }]}>주</Text>
                    <TouchableOpacity onPress={handleSaveQuantity}>
                      <Ionicons name="checkmark-circle" size={26} color={themeColors.profit} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingQuantity(false); setLocalQuantity(String(holding.quantity)); }}>
                      <Ionicons name="close-circle" size={26} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.rowRight} onPress={() => setEditingQuantity(true)}>
                    <Text style={[styles.detailValue, { color: themeColors.text }]}>{holding.quantity}주</Text>
                    <Ionicons name="create-outline" size={16} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* 현재가 수동설정 — 인라인 편집 */}
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>현재가 설정</Text>
                {editingManualPrice ? (
                  <View style={styles.inlineEditRow}>
                    <TextInput
                      style={[styles.inlineInput, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.primary, color: themeColors.text }]}
                      value={localManualPrice}
                      onChangeText={setLocalManualPrice}
                      keyboardType="decimal-pad"
                      autoFocus
                      placeholder={isKRW ? '원' : 'USD'}
                      placeholderTextColor={themeColors.textSecondary}
                    />
                    <TouchableOpacity onPress={handleSaveManualPrice}>
                      <Ionicons name="checkmark-circle" size={26} color={themeColors.profit} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingManualPrice(false)}>
                      <Ionicons name="close-circle" size={26} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : holding.manualPrice ? (
                  <View style={styles.rowRight}>
                    <Text style={[styles.detailValue, { color: themeColors.primary }]}>
                      {isKRW ? formatKRW(holding.manualPrice) : formatUSD(holding.manualPrice)}
                    </Text>
                    <TouchableOpacity onPress={() => { setLocalManualPrice(String(holding.manualPrice)); setEditingManualPrice(true); }}>
                      <Ionicons name="create-outline" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClearManualPrice}>
                      <Ionicons name="refresh-outline" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.rowRight} onPress={() => setEditingManualPrice(true)}>
                    <Text style={[styles.detailValue, { color: themeColors.textSecondary }]}>자동 (API)</Text>
                    <Ionicons name="create-outline" size={16} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>투자 원금</Text>
                <Text style={[styles.detailValue, { color: themeColors.text }]}>{isKRW ? formatKRW(holding.totalCost) : formatUSD(convertKRWToUSD(holding.totalCost))}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: themeColors.textSecondary }]}>현재 가치</Text>
                <Text style={[styles.detailValue, { color: themeColors.text }]}>{isKRW ? formatKRW(holding.currentValue) : formatUSD(convertKRWToUSD(holding.currentValue))}</Text>
              </View>

              <View style={[styles.separator, { backgroundColor: themeColors.border }]} />

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontWeight: 'bold', color: themeColors.textSecondary }]}>총 수익금</Text>
                <Text style={[
                  styles.detailValue,
                  { fontWeight: 'bold', color: holding.profitLoss >= 0 ? themeColors.profit : themeColors.loss },
                ]}>
                  {holding.profitLoss >= 0 ? '+' : ''}{isKRW ? formatKRW(holding.profitLoss) : formatUSD(convertKRWToUSD(holding.profitLoss))}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { fontWeight: 'bold', color: themeColors.textSecondary }]}>수익률</Text>
                <Text style={[
                  styles.detailValue,
                  { fontWeight: 'bold', color: holding.profitLossPercent >= 0 ? themeColors.profit : themeColors.loss },
                ]}>
                  {formatPercent(holding.profitLossPercent)}
                </Text>
              </View>
            </View>

            {/* 삭제 */}
            {showDeleteConfirm ? (
              <View style={styles.deleteConfirmRow}>
                <Text style={[styles.deleteConfirmText, { color: themeColors.loss }]}>{holding.ticker}를 삭제할까요?</Text>
                <View style={styles.deleteConfirmButtons}>
                  <TouchableOpacity style={[styles.deleteCancelButton, { borderColor: themeColors.border }]} onPress={() => setShowDeleteConfirm(false)}>
                    <Text style={[styles.deleteCancelText, { color: themeColors.textSecondary }]}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.deleteConfirmButton, { backgroundColor: themeColors.loss }]} onPress={handleDeleteConfirm}>
                    <Text style={[styles.deleteConfirmButtonText, { color: themeColors.text }]}>삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
                <Ionicons name="trash-outline" size={18} color={themeColors.loss} />
                <Text style={[styles.deleteButtonText, { color: themeColors.loss }]}>종목 삭제</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>

      {/* ── 계좌 유형 피커 ── */}
      <Modal
        visible={showAccountTypePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAccountTypePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: themeColors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.pickerTitle, { color: themeColors.text }]}>계좌 유형 변경</Text>
              <TouchableOpacity onPress={() => setShowAccountTypePicker(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.pickerContent, { paddingBottom: 24 }]}>
              <View style={styles.chipGrid}>
                {ACCOUNT_TYPES.map((acct) => {
                  const color = ACCOUNT_TYPE_COLORS[acct];
                  const isActive = localAccountType === acct;
                  return (
                    <TouchableOpacity
                      key={acct}
                      style={[styles.chip, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }, isActive && { backgroundColor: color, borderColor: color }]}
                      onPress={() => handleAccountTypeChange(acct)}
                    >
                      <Text style={[styles.chipText, { color: themeColors.textSecondary }, isActive && styles.chipTextActive]}>
                        {ACCOUNT_TYPE_LABELS[acct]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 증권사 피커 ── */}
      <Modal
        visible={showBrokeragePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowBrokeragePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: themeColors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.pickerTitle, { color: themeColors.text }]}>증권사 변경</Text>
              <TouchableOpacity onPress={() => setShowBrokeragePicker(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerContent} contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.chipGrid}>
                {/* 미설정 선택지 */}
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }, !localBrokerage && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                  onPress={() => handleBrokerageChange(undefined)}
                >
                  <Text style={[styles.chipText, { color: themeColors.textSecondary }, !localBrokerage && styles.chipTextActive]}>
                    미설정
                  </Text>
                </TouchableOpacity>
                {BROKERAGE_LIST.map((b) => {
                  const isActive = localBrokerage === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.chip,
                        { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
                        isActive && { backgroundColor: b.color, borderColor: b.color },
                      ]}
                      onPress={() => handleBrokerageChange(b.id)}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: themeColors.textSecondary },
                        isActive && { color: b.textColor, fontWeight: '700' },
                      ]}>
                        {b.shortName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {localBrokerage && (
                <Text style={[styles.chipText, { color: themeColors.textSecondary, marginTop: 12, textAlign: 'center' }]}>
                  {BROKERAGE_LIST.find(b => b.id === localBrokerage)?.name}
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 투자 재원 피커 ── */}
      <Modal
        visible={showCapitalSourcePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCapitalSourcePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: themeColors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.pickerTitle, { color: themeColors.text }]}>투자 재원 변경</Text>
              <TouchableOpacity onPress={() => setShowCapitalSourcePicker(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.pickerContent, { paddingBottom: 8 }]}>
              {CAPITAL_SOURCE_OPTIONS.map((src) => (
                <View key={src} style={styles.ratioRow}>
                  <View style={[styles.ratioDot, { backgroundColor: CAPITAL_SOURCE_COLORS[src] }]} />
                  <Text style={[styles.ratioLabel, { color: themeColors.text }]}>{CAPITAL_SOURCE_LABELS[src]}</Text>
                  <TextInput
                    style={[styles.ratioInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                    value={editRatios[src]}
                    onChangeText={(v) => setEditRatios(prev => ({ ...prev, [src]: v }))}
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                  <Text style={[styles.ratioUnit, { color: themeColors.textSecondary }]}>%</Text>
                </View>
              ))}
              <View style={styles.ratioTotalRow}>
                <Text style={[
                  styles.ratioTotalText,
                  { color: Math.round(editTotal) === 100 ? '#00C896' : '#FF006B' },
                ]}>
                  합계 {editTotal.toFixed(0)}%{Math.round(editTotal) === 100 ? '  ✓' : '  — 100%로 맞춰주세요'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.ratioConfirmBtn,
                  { backgroundColor: themeColors.primary },
                  Math.round(editTotal) !== 100 && { opacity: 0.4 },
                ]}
                onPress={handleCapitalMixConfirm}
              >
                <Text style={[styles.ratioConfirmText, { color: themeColors.text }]}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 카테고리 피커 ── */}
      <Modal
        visible={showCategoryPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: themeColors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.pickerTitle, { color: themeColors.text }]}>카테고리 변경</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickerContent} keyboardShouldPersistTaps="handled">
              <View style={styles.chipGrid}>
                {allCategories.map((cat) => {
                  const isCustom = !PRESET_CATEGORIES.includes(cat);
                  return (
                    <View key={cat} style={styles.chipWrapper}>
                      <TouchableOpacity
                        style={[styles.chip, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }, cat === localCategory && { backgroundColor: themeColors.primary, borderColor: themeColors.primary }]}
                        onPress={() => handleCategoryChange(cat)}
                      >
                        <Text style={[styles.chipText, { color: themeColors.textSecondary }, cat === localCategory && styles.chipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                      {isCustom && (
                        <TouchableOpacity
                          style={styles.chipDeleteBtn}
                          onPress={() => handleDeleteCategory(cat)}
                        >
                          <Ionicons name="close-circle" size={16} color={themeColors.loss} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {/* + 추가 버튼 */}
                {!showAddCatInput && (
                  <TouchableOpacity
                    style={[styles.addChip, { borderColor: themeColors.primary, backgroundColor: themeColors.cardBackground }]}
                    onPress={() => setShowAddCatInput(true)}
                  >
                    <Ionicons name="add" size={15} color={themeColors.primary} />
                    <Text style={[styles.addChipText, { color: themeColors.primary }]}>추가</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* 새 카테고리 입력 */}
              {showAddCatInput && (
                <View style={styles.addCatRow}>
                  <TextInput
                    ref={addCatInputRef}
                    style={[styles.addCatInput, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.primary, color: themeColors.text }]}
                    value={newCatName}
                    onChangeText={setNewCatName}
                    placeholder="카테고리 이름"
                    placeholderTextColor={themeColors.textSecondary}
                    returnKeyType="done"
                    onSubmitEditing={handleAddCategory}
                  />
                  <TouchableOpacity style={[styles.addCatConfirm, { backgroundColor: themeColors.primary }]} onPress={handleAddCategory}>
                    <Text style={[styles.addCatConfirmText, { color: themeColors.text }]}>확인</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addCatCancel}
                    onPress={() => { setShowAddCatInput(false); setNewCatName(''); }}
                  >
                    <Ionicons name="close" size={18} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  ticker: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  tickerCode: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 24,
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerLogo: {
    width: 140,
    height: 140,
    borderRadius: 20,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  priceValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  priceChange: {
    fontSize: 20,
    fontWeight: '600',
  },
  detailsSection: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 16,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accountTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  accountTypeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 107, 0.4)',
    backgroundColor: 'rgba(255, 0, 107, 0.08)',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteConfirmRow: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 107, 0.4)',
    backgroundColor: 'rgba(255, 0, 107, 0.08)',
    gap: 12,
  },
  deleteConfirmText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteCancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Picker ──
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderRadius: 16,
    width: '85%',
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  pickerContent: {
    padding: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipActive: {
    // backgroundColor and borderColor applied via inline themeColors.primary
  },
  chipText: {
    fontSize: 14,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  addChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  addCatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addCatConfirm: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addCatConfirmText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addCatCancel: {
    padding: 6,
  },
  chipWrapper: {
    position: 'relative',
  },
  chipDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 1,
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  ratioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ratioLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  ratioInput: {
    width: 64,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 15,
    textAlign: 'right',
  },
  ratioUnit: {
    fontSize: 14,
    width: 16,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    textAlign: 'right',
  },
  inlineUnit: {
    fontSize: 14,
  },
  ratioTotalRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  ratioTotalText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ratioConfirmBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  ratioConfirmText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
