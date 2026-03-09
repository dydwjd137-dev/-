import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import {
  AccountType,
  ACCOUNT_TYPE_LABELS,
  BrokerageId,
  BROKERAGE_LIST,
} from '../../types/portfolio';
import { ExtractedHolding } from '../../services/api/claude';
import { loadCustomCategories } from '../../services/storage/customCategoriesStorage';
import { searchStocks, StockEntry } from '../../constants/searchDatabase';

const COMMON_CATEGORIES = ['미국주식', '한국주식', 'ETF', '채권', '리츠', '암호화폐', '기타'];

interface Props {
  visible: boolean;
  holdings: ExtractedHolding[];
  onClose: () => void;
  onDone: () => void;
}

type EditableHolding = ExtractedHolding & { selected: boolean };

const ACCOUNT_TYPES: AccountType[] = ['REGULAR', 'ISA', 'PENSION', 'IRP', 'RETIREMENT'];

export default function ImageAnalysisModal({ visible, holdings, onClose, onDone }: Props) {
  const { themeColors } = useTheme();
  const { addHolding, exchangeRate, holdings: existingHoldings } = usePortfolio();

  // 기존 포트폴리오에서 카테고리 추출 + 기본 카테고리 병합
  const baseCategories = React.useMemo(() => {
    const fromPortfolio = existingHoldings.map(h => h.category).filter(Boolean) as string[];
    return [...new Set([...fromPortfolio, ...COMMON_CATEGORIES])];
  }, [existingHoldings]);

  // AddHoldingModal에서 저장된 커스텀 카테고리 로드
  const [persistedCategories, setPersistedCategories] = useState<string[]>([]);
  React.useEffect(() => {
    if (visible) {
      loadCustomCategories().then(setPersistedCategories);
    }
  }, [visible]);

  // 모달 내에서 새로 추가한 카테고리 (즉시 칩에 반영)
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const allCategories = [...new Set([...baseCategories, ...persistedCategories, ...localCategories])];

  const [newCategoryInput, setNewCategoryInput] = useState<{ [index: number]: string }>({});

  // 티커 검색
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [tickerSearchResults, setTickerSearchResults] = useState<StockEntry[]>([]);

  const handleTickerChange = (index: number, text: string) => {
    update(index, { ticker: text.toUpperCase() });
    const trimmed = text.trim();
    if (trimmed.length >= 1) {
      const results = searchStocks(trimmed, 6);
      setTickerSearchResults(results);
      setActiveSearchIndex(results.length > 0 ? index : null);
    } else {
      setTickerSearchResults([]);
      setActiveSearchIndex(null);
    }
  };

  // 티커를 바꾸지 않고 현재 종목명/티커로 즉시 검색
  const triggerSearch = (index: number, item: EditableHolding) => {
    const query = (item.name || item.ticker || '').trim();
    if (query.length >= 1) {
      const results = searchStocks(query, 8);
      setTickerSearchResults(results);
      setActiveSearchIndex(results.length > 0 ? index : null);
    }
  };

  const handleSelectStock = (index: number, entry: StockEntry) => {
    const isKr = entry.category === 'kr-stock' || entry.category === 'kr-etf';
    update(index, {
      ticker: entry.ticker,
      name: entry.nameKr ?? entry.name,
      currency: isKr ? 'KRW' : 'USD',
      category: isKr ? '한국주식' : '미국주식',
    });
    setActiveSearchIndex(null);
    setTickerSearchResults([]);
  };

  const [items, setItems] = useState<EditableHolding[]>(() =>
    holdings.map(h => ({ ...h, selected: true }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // holdings prop이 바뀔 때 (새 분석 결과) items 초기화
  React.useEffect(() => {
    setItems(holdings.map(h => ({ ...h, selected: true })));
  }, [holdings]);

  const update = (index: number, patch: Partial<EditableHolding>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const selectedCount = items.filter(i => i.selected).length;

  const handleSubmit = async () => {
    const toAdd = items.filter(i => i.selected);
    if (toAdd.length === 0) {
      Alert.alert('선택 없음', '추가할 종목을 하나 이상 선택해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      for (const h of toAdd) {
        const priceKRW =
          h.currency === 'USD' ? h.avgPrice * exchangeRate : h.avgPrice;
        await addHolding({
          ticker: h.ticker.toUpperCase(),
          category: h.category ?? (h.currency === 'USD' ? '미국주식' : '한국주식'),
          accountType: h.accountType ?? 'REGULAR',
          brokerage: h.brokerage,
          quantity: h.quantity,
          purchasePrice: priceKRW,
          purchaseExchangeRate: h.currency === 'USD' ? exchangeRate : undefined,
          purchaseDate: new Date(),
          capitalMix: [{ source: 'PRINCIPAL' as any, ratio: 100 }],
        });
      }
      Alert.alert('완료', `${toAdd.length}개 종목이 추가되었습니다.`);
      onDone();
    } catch (e) {
      Alert.alert('오류', '일부 종목 추가에 실패했습니다. 티커를 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: themeColors.background }]}>

          {/* 헤더 */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <View>
              <Text style={[styles.title, { color: themeColors.text }]}>이미지 분석 결과</Text>
              <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                Claude가 인식한 종목 목록입니다. 확인 후 추가해주세요.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={48} color={themeColors.textSecondary} />
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                인식된 종목이 없습니다.{'\n'}다른 이미지를 시도해보세요.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {items.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.card,
                    {
                      backgroundColor: themeColors.cardBackground,
                      borderColor: item.selected ? themeColors.primary : themeColors.border,
                      opacity: item.selected ? 1 : 0.5,
                    },
                  ]}
                >
                  {/* 선택 체크 + 종목명 */}
                  <View style={styles.cardHeader}>
                    <TouchableOpacity
                      onPress={() => update(index, { selected: !item.selected })}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.checkbox,
                        {
                          borderColor: themeColors.primary,
                          backgroundColor: item.selected ? themeColors.primary : 'transparent',
                        },
                      ]}>
                        {item.selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cardTitleWrap}
                      onPress={() => triggerSearch(index, item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cardTicker, { color: themeColors.text }]} numberOfLines={1}>
                        {item.name || item.ticker}
                      </Text>
                      <Text style={[styles.cardName, { color: themeColors.textSecondary }]}>
                        {item.ticker}
                      </Text>
                      <Text style={[styles.searchHint, { color: themeColors.primary }]}>
                        탭하여 종목 검색
                      </Text>
                    </TouchableOpacity>
                    <View style={[
                      styles.currencyBadge,
                      { backgroundColor: item.currency === 'USD' ? '#6B4FFF22' : '#FF950022' },
                    ]}>
                      <Text style={[
                        styles.currencyBadgeText,
                        { color: item.currency === 'USD' ? '#6B4FFF' : '#FF9500' },
                      ]}>
                        {item.currency}
                      </Text>
                    </View>
                  </View>

                  {/* 편집 필드 */}
                  <View style={styles.fields}>
                    {/* 티커 */}
                    <View style={styles.field}>
                      <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>티커</Text>
                      <TextInput
                        style={[styles.fieldInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                        value={item.ticker}
                        onChangeText={v => handleTickerChange(index, v)}
                        onFocus={() => triggerSearch(index, item)}
                        autoCapitalize="characters"
                        editable={!isSubmitting}
                      />
                    </View>

                    {/* 수량 */}
                    <View style={styles.field}>
                      <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>수량</Text>
                      <TextInput
                        style={[styles.fieldInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                        value={String(item.quantity)}
                        onChangeText={v => update(index, { quantity: parseFloat(v) || 0 })}
                        keyboardType="decimal-pad"
                        editable={!isSubmitting}
                      />
                    </View>

                    {/* 매수가 */}
                    <View style={styles.field}>
                      <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                        매수가 ({item.currency})
                      </Text>
                      <TextInput
                        style={[styles.fieldInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                        value={String(item.avgPrice)}
                        onChangeText={v => update(index, { avgPrice: parseFloat(v) || 0 })}
                        keyboardType="decimal-pad"
                        editable={!isSubmitting}
                      />
                    </View>
                  </View>

                  {/* 티커 검색 결과 드롭다운 */}
                  {activeSearchIndex === index && tickerSearchResults.length > 0 && (
                    <View style={[styles.tickerDropdown, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
                      {tickerSearchResults.map(entry => (
                        <TouchableOpacity
                          key={entry.ticker}
                          style={[styles.tickerDropdownItem, { borderBottomColor: themeColors.border }]}
                          onPress={() => handleSelectStock(index, entry)}
                        >
                          <Text style={[styles.tickerDropdownName, { color: themeColors.text }]} numberOfLines={1}>
                            {entry.nameKr ?? entry.name}
                          </Text>
                          <Text style={[styles.tickerDropdownTicker, { color: themeColors.textSecondary }]}>
                            {entry.ticker}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* 카테고리 선택 */}
                  <View style={styles.accountRow}>
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginBottom: 6 }]}>카테고리</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.accountChips}>
                        {allCategories.map(cat => {
                          const active = (item.category ?? (item.currency === 'USD' ? '미국주식' : '한국주식')) === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              style={[styles.accountChip, { backgroundColor: active ? themeColors.primary : themeColors.background, borderColor: active ? themeColors.primary : themeColors.border }]}
                              onPress={() => update(index, { category: cat })}
                              disabled={isSubmitting}
                            >
                              <Text style={[styles.accountChipText, { color: active ? '#fff' : themeColors.textSecondary }]}>{cat}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                    {/* 새 카테고리 직접 입력 */}
                    <View style={styles.newCatRow}>
                      <TextInput
                        style={[styles.newCatInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                        placeholder="새 카테고리 입력..."
                        placeholderTextColor={themeColors.textSecondary}
                        value={newCategoryInput[index] ?? ''}
                        onChangeText={v => setNewCategoryInput(prev => ({ ...prev, [index]: v }))}
                        editable={!isSubmitting}
                      />
                      <TouchableOpacity
                        style={[styles.newCatBtn, { backgroundColor: themeColors.primary }]}
                        onPress={() => {
                          const val = (newCategoryInput[index] ?? '').trim();
                          if (val) {
                            setLocalCategories(prev => prev.includes(val) ? prev : [...prev, val]);
                            update(index, { category: val });
                            setNewCategoryInput(prev => ({ ...prev, [index]: '' }));
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.newCatBtnText}>추가</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* 계좌 유형 선택 */}
                  <View style={styles.accountRow}>
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginBottom: 6 }]}>계좌</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.accountChips}>
                        {ACCOUNT_TYPES.map(acct => {
                          const active = (item.accountType ?? 'REGULAR') === acct;
                          return (
                            <TouchableOpacity
                              key={acct}
                              style={[styles.accountChip, { backgroundColor: active ? themeColors.primary : themeColors.background, borderColor: active ? themeColors.primary : themeColors.border }]}
                              onPress={() => update(index, { accountType: acct })}
                              disabled={isSubmitting}
                            >
                              <Text style={[styles.accountChipText, { color: active ? '#fff' : themeColors.textSecondary }]}>{ACCOUNT_TYPE_LABELS[acct]}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>

                  {/* 증권사 선택 */}
                  <View style={styles.accountRow}>
                    <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginBottom: 6 }]}>증권사</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.accountChips}>
                        {BROKERAGE_LIST.map(b => {
                          const active = item.brokerage === b.id;
                          return (
                            <TouchableOpacity
                              key={b.id}
                              style={[styles.accountChip, { backgroundColor: active ? b.color : themeColors.background, borderColor: active ? b.color : themeColors.border }]}
                              onPress={() => update(index, { brokerage: active ? undefined : b.id })}
                              disabled={isSubmitting}
                            >
                              <Text style={[styles.accountChipText, { color: active ? b.textColor : themeColors.textSecondary }]}>{b.shortName}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {/* 하단 버튼 */}
          {items.length > 0 && (
            <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: themeColors.primary }, isSubmitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={isSubmitting || selectedCount === 0}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    선택 {selectedCount}개 추가하기
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTicker: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardName: {
    fontSize: 12,
    marginTop: 2,
  },
  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currencyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fields: {
    flexDirection: 'row',
    gap: 8,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  accountRow: {
    gap: 0,
  },
  accountChips: {
    flexDirection: 'row',
    gap: 6,
  },
  accountChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  accountChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  newCatRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  newCatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
  },
  newCatBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    justifyContent: 'center',
  },
  newCatBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  tickerDropdown: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tickerDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  tickerDropdownName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  tickerDropdownTicker: {
    fontSize: 12,
    marginLeft: 8,
  },
  searchHint: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.8,
  },
});
