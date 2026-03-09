import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import {
  AssetCategory,
  AccountType,
  ACCOUNT_TYPE_LABELS,
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
import { usePortfolio } from '../../contexts/PortfolioContext';
import {
  loadCustomCategories,
  saveCustomCategory,
  deleteCustomCategory,
} from '../../services/storage/customCategoriesStorage';
import { searchStocks, StockEntry } from '../../constants/searchDatabase';

interface AddHoldingModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRESET_CATEGORIES: AssetCategory[] = ['미국주식', '한국주식'];
const ACCOUNT_TYPES: AccountType[] = ['REGULAR', 'ISA', 'PENSION', 'IRP', 'RETIREMENT'];

export function AddHoldingModal({ visible, onClose }: AddHoldingModalProps) {
  const { addHolding, exchangeRate } = usePortfolio();
  const { themeColors } = useTheme();

  const [ticker, setTicker] = useState('');
  const [searchResults, setSearchResults] = useState<StockEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [category, setCategory] = useState<AssetCategory>('미국주식');
  const [accountType, setAccountType] = useState<AccountType>('REGULAR');
  const [brokerage, setBrokerage] = useState<BrokerageId | undefined>(undefined);
  const [capitalRatios, setCapitalRatios] = useState<Record<CapitalSourceType, string>>({
    [CapitalSourceType.PRINCIPAL]:    '100',
    [CapitalSourceType.DIVIDEND]:     '0',
    [CapitalSourceType.INTEREST]:     '0',
    [CapitalSourceType.CAPITAL_GAIN]: '0',
    [CapitalSourceType.TRANSFER]:     '0',
  });
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [priceCurrency, setPriceCurrency] = useState<'KRW' | 'USD'>('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 커스텀 카테고리
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const addInputRef = useRef<TextInput>(null);

  // 모달 열릴 때 저장된 커스텀 카테고리 로드
  useEffect(() => {
    if (visible) {
      loadCustomCategories().then(setCustomCategories);
    }
  }, [visible]);

  // 입력창 표시 시 자동 포커스
  useEffect(() => {
    if (showAddInput) {
      setTimeout(() => addInputRef.current?.focus(), 100);
    }
  }, [showAddInput]);

  const allCategories = [...PRESET_CATEGORIES, ...customCategories];

  const handleTickerChange = (text: string) => {
    setTicker(text);
    const trimmed = text.trim();
    if (trimmed.length >= 1) {
      const results = searchStocks(trimmed, 8);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleSelectStock = (entry: StockEntry) => {
    setTicker(entry.ticker);
    setShowDropdown(false);
    setSearchResults([]);
    if (entry.category === 'kr-stock' || entry.category === 'kr-etf') {
      setCategory('한국주식');
      setPriceCurrency('KRW');
    } else {
      setCategory('미국주식');
      setPriceCurrency('USD');
    }
  };

  const convertToKRW = (price: number): number => {
    return priceCurrency === 'KRW' ? price : price * exchangeRate;
  };

  const handleDeleteCategory = async (cat: string) => {
    const updated = await deleteCustomCategory(cat);
    setCustomCategories(updated);
    if (category === cat) setCategory('미국주식');
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (allCategories.includes(name)) {
      setCategory(name);
      setShowAddInput(false);
      setNewCategoryName('');
      return;
    }
    const updated = await saveCustomCategory(name);
    setCustomCategories(updated);
    setCategory(name);
    setShowAddInput(false);
    setNewCategoryName('');
  };

  const capitalMixTotal = CAPITAL_SOURCE_OPTIONS.reduce(
    (sum, src) => sum + (parseFloat(capitalRatios[src]) || 0), 0,
  );

  const buildCapitalMix = (): CapitalMixEntry[] =>
    CAPITAL_SOURCE_OPTIONS
      .map(src => ({ source: src, ratio: parseFloat(capitalRatios[src]) || 0 }))
      .filter(e => e.ratio > 0);

  const handleSubmit = async () => {
    if (!ticker || !quantity || !purchasePrice) {
      Alert.alert('오류', '모든 필드를 입력해주세요.');
      return;
    }
    const quantityNum = parseFloat(quantity);
    const priceNum = parseFloat(purchasePrice);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('오류', '유효한 수량을 입력해주세요.');
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('오류', '유효한 매수가를 입력해주세요.');
      return;
    }
    if (ticker.length < 1 || ticker.length > 15) {
      Alert.alert('오류', '유효한 티커 심볼을 입력해주세요.');
      return;
    }
    if (Math.round(capitalMixTotal) !== 100) {
      Alert.alert('오류', `투자 재원 합계가 ${capitalMixTotal}%입니다. 100%로 맞춰주세요.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addHolding({
        ticker: ticker.toUpperCase(),
        category,
        accountType,
        brokerage,
        capitalMix: buildCapitalMix(),
        quantity: quantityNum,
        purchasePrice: convertToKRW(priceNum),
        purchaseExchangeRate: priceCurrency !== 'KRW' ? exchangeRate : undefined,
        purchaseDate: new Date(),
      });

      setTicker('');
      setQuantity('');
      setPurchasePrice('');
      setCategory('미국주식');
      setAccountType('REGULAR');
      setBrokerage(undefined);
      setPriceCurrency('USD');
      setCapitalRatios({
        [CapitalSourceType.PRINCIPAL]:    '100',
        [CapitalSourceType.DIVIDEND]:     '0',
        [CapitalSourceType.INTEREST]:     '0',
        [CapitalSourceType.CAPITAL_GAIN]: '0',
        [CapitalSourceType.TRANSFER]:     '0',
      });
      onClose();
      Alert.alert('성공! 🎉', '보유 자산이 추가되었습니다!\n\n홈 화면에서 새로고침하면 실시간 시세를 불러옵니다.');
    } catch (error) {
      Alert.alert('오류', `자산 추가에 실패했습니다.\n\n오류: ${JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setShowAddInput(false);
      setNewCategoryName('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: themeColors.background }]}>
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.title, { color: themeColors.text }]}>자산 추가</Text>
            <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          >
            <View style={styles.form}>

              {/* 티커 입력 + 자동완성 드롭다운 */}
              <View style={[styles.inputGroup, { zIndex: 10 }]}>
                <Text style={[styles.label, { color: themeColors.text }]}>티커 / 종목명 검색</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border, color: themeColors.text }]}
                  value={ticker}
                  onChangeText={handleTickerChange}
                  placeholder="AAPL, 애플, 삼성전자, SPY..."
                  placeholderTextColor={themeColors.textSecondary}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                {showDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.ticker}
                      scrollEnabled={false}
                      keyboardShouldPersistTaps="always"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => handleSelectStock(item)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.dropdownItemLeft}>
                            <Text style={[styles.dropdownName, { color: themeColors.text }]}>
                              {item.nameKr ?? item.name}
                            </Text>
                            <Text style={[styles.dropdownTicker, { color: themeColors.textSecondary }]}>{item.ticker}</Text>
                          </View>
                          <Text style={[styles.dropdownCategory, { color: themeColors.primary }]}>
                            {item.category === 'us-stock' ? '미국주식'
                              : item.category === 'kr-stock' ? '한국주식'
                              : item.category === 'us-etf' ? 'US ETF'
                              : 'KR ETF'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      ItemSeparatorComponent={() => <View style={[styles.dropdownSeparator, { backgroundColor: themeColors.border }]} />}
                    />
                  </View>
                )}
                <Text style={[styles.hint, { color: themeColors.textSecondary }]}>티커, 영문명, 한국어명 검색 가능</Text>
              </View>

              {/* 카테고리 선택 */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.text }]}>카테고리</Text>
                <View style={styles.categoryGrid}>
                  {/* 프리셋 + 커스텀 칩 */}
                  {allCategories.map((cat) => {
                    const isCustom = !PRESET_CATEGORIES.includes(cat as any);
                    return (
                      <View key={cat} style={styles.catWrapper}>
                        <TouchableOpacity
                          style={[
                            styles.categoryButton,
                            { borderColor: themeColors.border, backgroundColor: themeColors.cardBackground },
                            category === cat && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                          ]}
                          onPress={() => {
                            setCategory(cat);
                            setShowAddInput(false);
                            setNewCategoryName('');
                          }}
                          disabled={isSubmitting}
                        >
                          <Text style={[
                            styles.categoryText,
                            { color: themeColors.textSecondary },
                            category === cat && { color: themeColors.text, fontWeight: '600' },
                          ]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                        {isCustom && (
                          <TouchableOpacity
                            style={styles.catDeleteBtn}
                            onPress={() => handleDeleteCategory(cat)}
                            disabled={isSubmitting}
                          >
                            <Ionicons name="close-circle" size={16} color={themeColors.loss} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* + 추가 버튼 */}
                  {!showAddInput && (
                    <TouchableOpacity
                      style={[styles.addCategoryButton, { borderColor: themeColors.primary, backgroundColor: themeColors.cardBackground }]}
                      onPress={() => setShowAddInput(true)}
                      disabled={isSubmitting}
                    >
                      <Ionicons name="add" size={16} color={themeColors.primary} />
                      <Text style={[styles.addCategoryText, { color: themeColors.primary }]}>추가</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 새 카테고리 입력 */}
                {showAddInput && (
                  <View style={styles.newCategoryRow}>
                    <TextInput
                      ref={addInputRef}
                      style={[styles.newCategoryInput, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.primary, color: themeColors.text }]}
                      value={newCategoryName}
                      onChangeText={setNewCategoryName}
                      placeholder="카테고리 이름"
                      placeholderTextColor={themeColors.textSecondary}
                      returnKeyType="done"
                      onSubmitEditing={handleAddCategory}
                    />
                    <TouchableOpacity style={[styles.newCategoryConfirm, { backgroundColor: themeColors.primary }]} onPress={handleAddCategory}>
                      <Text style={[styles.newCategoryConfirmText, { color: themeColors.text }]}>확인</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.newCategoryCancel}
                      onPress={() => { setShowAddInput(false); setNewCategoryName(''); }}
                    >
                      <Ionicons name="close" size={18} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* 계좌 유형 선택 */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.text }]}>계좌 유형</Text>
                <View style={styles.categoryGrid}>
                  {ACCOUNT_TYPES.map((acct) => (
                    <TouchableOpacity
                      key={acct}
                      style={[
                        styles.categoryButton,
                        { borderColor: themeColors.border, backgroundColor: themeColors.cardBackground },
                        accountType === acct && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
                      ]}
                      onPress={() => setAccountType(acct)}
                      disabled={isSubmitting}
                    >
                      <Text style={[
                        styles.categoryText,
                        { color: themeColors.textSecondary },
                        accountType === acct && { color: themeColors.text, fontWeight: '600' },
                      ]}>
                        {ACCOUNT_TYPE_LABELS[acct]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
                  {accountType === 'ISA' && 'ISA: 비과세 200만원, 초과분 9.9% 분리과세'}
                  {accountType === 'PENSION' && '연금저축: 납입액 세액공제 최대 66만원/년'}
                  {accountType === 'IRP' && 'IRP: 연금저축 합산 세액공제 최대 115.5만원/년'}
                  {accountType === 'RETIREMENT' && '퇴직연금: 회사 납입, 과세이연'}
                  {accountType === 'REGULAR' && '일반계좌: 해외주식 22% 양도세, 배당 15.4%'}
                </Text>
              </View>

              {/* 증권사 선택 */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.text }]}>증권사 (선택)</Text>
                <View style={styles.brokerageGrid}>
                  {BROKERAGE_LIST.map((b) => {
                    const isSelected = brokerage === b.id;
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.brokerageBadge,
                          { backgroundColor: isSelected ? b.color : themeColors.cardBackground, borderColor: themeColors.border },
                          isSelected && styles.brokerageBadgeActive,
                        ]}
                        onPress={() => setBrokerage(isSelected ? undefined : b.id)}
                        disabled={isSubmitting}
                      >
                        <Text style={[
                          styles.brokerageBadgeText,
                          { color: isSelected ? b.textColor : themeColors.textSecondary },
                        ]}>
                          {b.shortName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {brokerage && (
                  <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
                    {BROKERAGE_LIST.find(b => b.id === brokerage)?.name}
                  </Text>
                )}
              </View>

              {/* 투자 재원 비율 */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.text }]}>투자 재원</Text>
                {CAPITAL_SOURCE_OPTIONS.map((src) => (
                  <View key={src} style={styles.ratioRow}>
                    <View style={[styles.ratioDot, { backgroundColor: CAPITAL_SOURCE_COLORS[src] }]} />
                    <Text style={[styles.ratioLabel, { color: themeColors.text }]}>{CAPITAL_SOURCE_LABELS[src]}</Text>
                    <TextInput
                      style={[styles.ratioInput, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border, color: themeColors.text }]}
                      value={capitalRatios[src]}
                      onChangeText={(v) => setCapitalRatios(prev => ({ ...prev, [src]: v }))}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      editable={!isSubmitting}
                    />
                    <Text style={[styles.ratioUnit, { color: themeColors.textSecondary }]}>%</Text>
                  </View>
                ))}
                <View style={styles.ratioTotalRow}>
                  <Text style={[
                    styles.ratioTotalText,
                    { color: Math.round(capitalMixTotal) === 100 ? '#00C896' : '#FF006B' },
                  ]}>
                    합계 {capitalMixTotal.toFixed(0)}%{Math.round(capitalMixTotal) === 100 ? '  ✓' : '  — 100%로 맞춰주세요'}
                  </Text>
                </View>
              </View>

              {/* 수량 입력 */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.text }]}>수량</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border, color: themeColors.text }]}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="10"
                  placeholderTextColor={themeColors.textSecondary}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
              </View>

              {/* 매수가 입력 */}
              <View style={styles.inputGroup}>
                <View style={styles.priceLabelRow}>
                  <Text style={[styles.label, { color: themeColors.text }]}>매수가</Text>
                  <View style={[styles.currencyToggle, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
                    <TouchableOpacity
                      style={[styles.currencyBtn, priceCurrency === 'KRW' && { backgroundColor: themeColors.primary }]}
                      onPress={() => setPriceCurrency('KRW')}
                      disabled={isSubmitting}
                    >
                      <Text style={[styles.currencyBtnText, { color: themeColors.textSecondary }, priceCurrency === 'KRW' && { color: themeColors.text }]}>원화 ₩</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.currencyBtn, priceCurrency === 'USD' && { backgroundColor: themeColors.primary }]}
                      onPress={() => setPriceCurrency('USD')}
                      disabled={isSubmitting}
                    >
                      <Text style={[styles.currencyBtnText, { color: themeColors.textSecondary }, priceCurrency === 'USD' && { color: themeColors.text }]}>달러 $</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border, color: themeColors.text }]}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  placeholder={priceCurrency === 'KRW' ? '50000' : '150'}
                  placeholderTextColor={themeColors.textSecondary}
                  keyboardType="decimal-pad"
                  editable={!isSubmitting}
                />
                <Text style={[styles.hint, { color: themeColors.textSecondary }]}>
                  {priceCurrency === 'KRW'
                    ? '단위당 매수 가격 (원화)'
                    : '단위당 매수 가격 (달러, 자동으로 원화 환산됩니다)'}
                </Text>
              </View>

              {/* 제출 버튼 */}
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: themeColors.primary }, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={themeColors.text} />
                    <Text style={[styles.submitButtonText, { color: themeColors.text }]}>추가 중...</Text>
                  </View>
                ) : (
                  <Text style={[styles.submitButtonText, { color: themeColors.text }]}>추가하기</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
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
    height: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    opacity: 0.7,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryButtonActive: {},
  categoryText: {
    fontSize: 14,
  },
  categoryTextActive: {
    fontWeight: '600',
  },
  catWrapper: {
    position: 'relative',
  },
  catDeleteBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 1,
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  addCategoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  newCategoryInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  newCategoryConfirm: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newCategoryConfirmText: {
    fontSize: 14,
    fontWeight: '700',
  },
  newCategoryCancel: {
    padding: 8,
  },
  submitButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
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
  ratioTotalRow: {
    marginTop: 4,
    alignItems: 'flex-end',
  },
  ratioTotalText: {
    fontSize: 13,
    fontWeight: '700',
  },
  brokerageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brokerageBadge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  brokerageBadgeActive: {
    borderColor: 'transparent',
  },
  brokerageBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  priceLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currencyToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  currencyBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  currencyBtnActive: {},
  currencyBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  currencyBtnTextActive: {},
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  dropdownItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  dropdownName: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownTicker: {
    fontSize: 11,
    marginTop: 2,
  },
  dropdownCategory: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  dropdownSeparator: {
    height: 1,
  },
});
