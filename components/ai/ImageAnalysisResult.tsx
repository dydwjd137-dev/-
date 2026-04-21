import React, { useState } from 'react';
import {
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
import { ImageAnalysisResponse, ExtractedHolding } from '../../services/api/claude';
import { loadCustomCategories } from '../../services/storage/customCategoriesStorage';
import { searchStocks, StockEntry } from '../../constants/searchDatabase';

const COMMON_CATEGORIES = ['미국주식', '한국주식', 'ETF', '채권', '리츠', '암호화폐', '기타'];
const ACCOUNT_TYPES: AccountType[] = ['REGULAR', 'ISA', 'PENSION', 'IRP', 'RETIREMENT'];

type EditableHolding = ExtractedHolding & { selected: boolean };

interface Props {
  data: ImageAnalysisResponse;
  onAdd: (holdings: ExtractedHolding[]) => Promise<void>;
  onClose: () => void;
}

export default function ImageAnalysisResult({ data, onAdd, onClose }: Props) {
  const { themeColors } = useTheme();
  const { holdings: existingHoldings } = usePortfolio();

  // 카테고리
  const baseCategories = React.useMemo(() => {
    const fromPortfolio = existingHoldings.map(h => h.category).filter(Boolean) as string[];
    return [...new Set([...fromPortfolio, ...COMMON_CATEGORIES])];
  }, [existingHoldings]);

  const [persistedCategories, setPersistedCategories] = useState<string[]>([]);
  React.useEffect(() => {
    loadCustomCategories().then(setPersistedCategories);
  }, []);

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

  const triggerSearch = (index: number, item: EditableHolding) => {
    // ticker 우선으로 검색 (name은 한글 등 DB에 없을 수 있음)
    const query = (item.ticker || item.name || '').trim();
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
    data.holdings.map(h => ({ ...h, selected: true }))
  );
  const [isAdding, setIsAdding] = useState(false);

  const update = (index: number, patch: Partial<EditableHolding>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const selectedCount = items.filter(i => i.selected).length;

  const handleAdd = async () => {
    const toAdd = items.filter(i => i.selected);
    if (!toAdd.length) {
      Alert.alert('선택 없음', '추가할 종목을 하나 이상 선택해주세요.');
      return;
    }
    setIsAdding(true);
    try {
      await onAdd(toAdd);
      onClose();
    } catch {
      Alert.alert('오류', '일부 종목 추가에 실패했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>이미지 분석 결과</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Claude가 인식한 종목 목록입니다. 확인 후 추가해주세요.
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} disabled={isAdding}>
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
          {/* 미인식 항목 */}
          {data.unrecognized && data.unrecognized.length > 0 && (
            <View style={[styles.unrecognizedBox, { backgroundColor: '#FF444415', borderColor: '#FF444430' }]}>
              <View style={styles.unrecognizedHeader}>
                <Ionicons name="alert-circle-outline" size={14} color="#FF4444" />
                <Text style={[styles.unrecognizedTitle, { color: '#FF4444' }]}>인식 불가 항목</Text>
              </View>
              {data.unrecognized.map((u, i) => (
                <Text key={i} style={styles.unrecognizedItem}>• {u}</Text>
              ))}
            </View>
          )}

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
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>티커</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                    value={item.ticker}
                    onChangeText={v => handleTickerChange(index, v)}
                    onFocus={() => {
                      // handleTickerChange를 직접 호출 — triggerSearch보다 안정적
                      if (item.ticker) handleTickerChange(index, item.ticker);
                    }}
                    autoCapitalize="characters"
                    editable={!isAdding}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>수량</Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                    value={String(item.quantity)}
                    onChangeText={v => update(index, { quantity: parseFloat(v) || 0 })}
                    keyboardType="decimal-pad"
                    editable={!isAdding}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                    매수가 ({item.currency})
                  </Text>
                  <TextInput
                    style={[styles.fieldInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                    value={String(item.avgPrice)}
                    onChangeText={v => update(index, { avgPrice: parseFloat(v) || 0 })}
                    keyboardType="decimal-pad"
                    editable={!isAdding}
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
                          disabled={isAdding}
                        >
                          <Text style={[styles.accountChipText, { color: active ? '#fff' : themeColors.textSecondary }]}>{cat}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                <View style={styles.newCatRow}>
                  <TextInput
                    style={[styles.newCatInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                    placeholder="새 카테고리 입력..."
                    placeholderTextColor={themeColors.textSecondary}
                    value={newCategoryInput[index] ?? ''}
                    onChangeText={v => setNewCategoryInput(prev => ({ ...prev, [index]: v }))}
                    editable={!isAdding}
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
                    disabled={isAdding}
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
                          disabled={isAdding}
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
                          onPress={() => update(index, { brokerage: active ? undefined : b.id as BrokerageId })}
                          disabled={isAdding}
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

          {/* 노트 */}
          {data.note && (
            <View style={[styles.noteBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
              <Ionicons name="information-circle-outline" size={14} color={themeColors.textSecondary} />
              <Text style={[styles.noteText, { color: themeColors.textSecondary }]}>{data.note}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* 하단 버튼 */}
      {items.length > 0 && (
        <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: themeColors.primary }, (isAdding || selectedCount === 0) && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={isAdding || selectedCount === 0}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>선택 {selectedCount}개 추가하기</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 24 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  card: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitleWrap: { flex: 1 },
  cardTicker: { fontSize: 16, fontWeight: '700' },
  cardName: { fontSize: 12, marginTop: 2 },
  searchHint: { fontSize: 10, marginTop: 2, opacity: 0.8 },
  currencyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  currencyBadgeText: { fontSize: 12, fontWeight: '700' },
  fields: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600' },
  fieldInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, fontWeight: '600',
  },
  tickerDropdown: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  tickerDropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1,
  },
  tickerDropdownName: { fontSize: 13, fontWeight: '600', flex: 1 },
  tickerDropdownTicker: { fontSize: 12, marginLeft: 8 },
  accountRow: { gap: 0 },
  accountChips: { flexDirection: 'row', gap: 6 },
  accountChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  accountChipText: { fontSize: 12, fontWeight: '600' },
  newCatRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  newCatInput: {
    flex: 1, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, fontSize: 13,
  },
  newCatBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, justifyContent: 'center' },
  newCatBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  unrecognizedBox: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  unrecognizedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unrecognizedTitle: { fontSize: 12, fontWeight: '700' },
  unrecognizedItem: { fontSize: 12, color: '#FF4444', marginLeft: 4 },
  noteBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  footer: { padding: 16, borderTopWidth: 1 },
  submitBtn: {
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});