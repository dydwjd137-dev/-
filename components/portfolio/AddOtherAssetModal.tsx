import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { usePortfolio } from '../../contexts/PortfolioContext';
import {
  OtherAsset, Loan, OtherAssetSubtype,
  OTHER_ASSET_LABELS, OTHER_ASSET_ICONS,
} from '../../types/otherAssets';

type TabType = 'asset' | 'loan';

const SUBTYPES: OtherAssetSubtype[] = [
  'cash-usd', 'cash-krw', 'jeonse', 'wolse-deposit', 'apartment', 'house',
];

function formatKRWAmount(val: number): string {
  if (val >= 100_000_000) return `${(val / 100_000_000).toFixed(1)}억`;
  if (val >= 10_000) return `${Math.round(val / 10_000)}만`;
  return `₩${Math.round(val).toLocaleString()}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddOtherAssetModal({ visible, onClose }: Props) {
  const { themeColors } = useTheme();
  const {
    otherAssets, loans, exchangeRate,
    addOtherAsset, deleteOtherAsset,
    addLoan, deleteLoan,
  } = usePortfolio();

  const [tab, setTab] = useState<TabType>('asset');

  // 자산 폼
  const [subtype, setSubtype] = useState<OtherAssetSubtype>('cash-usd');
  const [assetName, setAssetName] = useState('');
  const [assetAmount, setAssetAmount] = useState('');
  const [assetCurrency, setAssetCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [assetSaving, setAssetSaving] = useState(false);

  // 대출 폼
  const [loanName, setLoanName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanSaving, setLoanSaving] = useState(false);

  function resetAssetForm() {
    setAssetName('');
    setAssetAmount('');
    setSubtype('cash-usd');
    setAssetCurrency('KRW');
  }
  function resetLoanForm() {
    setLoanName('');
    setLoanAmount('');
  }

  // subtype 변경 시 통화 자동 설정
  function handleSubtypeChange(s: OtherAssetSubtype) {
    setSubtype(s);
    setAssetCurrency(s === 'cash-usd' ? 'USD' : 'KRW');
  }

  async function handleAddAsset() {
    const amount = parseFloat(assetAmount.replace(/,/g, ''));
    if (!assetName.trim() || isNaN(amount) || amount <= 0) return;
    setAssetSaving(true);
    try {
      await addOtherAsset({ subtype, name: assetName.trim(), amount, currency: assetCurrency });
      resetAssetForm();
    } finally {
      setAssetSaving(false);
    }
  }

  async function handleAddLoan() {
    const amount = parseFloat(loanAmount.replace(/,/g, ''));
    if (!loanName.trim() || isNaN(amount) || amount <= 0) return;
    setLoanSaving(true);
    try {
      await addLoan({ name: loanName.trim(), amount });
      resetLoanForm();
    } finally {
      setLoanSaving(false);
    }
  }

  function krwDisplay(asset: OtherAsset): string {
    const krw = asset.currency === 'USD' ? asset.amount * exchangeRate : asset.amount;
    return formatKRWAmount(krw);
  }

  const tc = themeColors;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: tc.background }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: 480 }}>
          <View style={[styles.sheet, { backgroundColor: tc.background, borderColor: tc.border }]}>
            {/* 헤더 */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: tc.text }]}>기타자산 & 대출</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={tc.text} />
              </TouchableOpacity>
            </View>

            {/* 탭 */}
            <View style={[styles.tabRow, { backgroundColor: tc.background, borderColor: tc.border }]}>
              {(['asset', 'loan'] as TabType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabBtn, tab === t && { backgroundColor: tc.primary }]}
                  onPress={() => setTab(t)}
                >
                  <Text style={[styles.tabText, { color: tab === t ? '#FFF' : tc.textSecondary }]}>
                    {t === 'asset' ? '기타자산' : '대출'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {tab === 'asset' ? (
                <View style={styles.body}>
                  {/* 자산 유형 선택 */}
                  <Text style={[styles.label, { color: tc.textSecondary }]}>자산 유형</Text>
                  <View style={styles.subtypeGrid}>
                    {SUBTYPES.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.subtypeChip,
                          { borderColor: subtype === s ? tc.primary : tc.border, backgroundColor: subtype === s ? tc.primary + '22' : tc.background },
                        ]}
                        onPress={() => handleSubtypeChange(s)}
                      >
                        <Text style={styles.subtypeIcon}>{OTHER_ASSET_ICONS[s]}</Text>
                        <Text style={[styles.subtypeLabel, { color: subtype === s ? tc.primary : tc.text }]}>
                          {OTHER_ASSET_LABELS[s]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 자산명 */}
                  <Text style={[styles.label, { color: tc.textSecondary }]}>자산명</Text>
                  <TextInput
                    style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    placeholder={`예) 강남 ${OTHER_ASSET_LABELS[subtype]}`}
                    placeholderTextColor={tc.textSecondary}
                    value={assetName}
                    onChangeText={setAssetName}
                  />

                  {/* 금액 & 통화 */}
                  <Text style={[styles.label, { color: tc.textSecondary }]}>금액</Text>
                  <View style={styles.amountRow}>
                    <TextInput
                      style={[styles.input, styles.amountInput, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                      placeholder="0"
                      placeholderTextColor={tc.textSecondary}
                      value={assetAmount}
                      onChangeText={setAssetAmount}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={[styles.currencyToggle, { borderColor: tc.primary, backgroundColor: tc.primary + '22' }]}
                      onPress={() => setAssetCurrency(c => c === 'KRW' ? 'USD' : 'KRW')}
                    >
                      <Text style={[styles.currencyText, { color: tc.primary }]}>{assetCurrency}</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: tc.primary, opacity: assetSaving ? 0.6 : 1 }]}
                    onPress={handleAddAsset}
                    disabled={assetSaving}
                  >
                    <Text style={styles.addBtnText}>추가</Text>
                  </TouchableOpacity>

                  {/* 기존 목록 */}
                  {otherAssets.length > 0 && (
                    <View style={[styles.listSection, { borderTopColor: tc.border }]}>
                      <Text style={[styles.listTitle, { color: tc.textSecondary }]}>등록된 기타자산</Text>
                      {otherAssets.map(a => (
                        <View key={a.id} style={[styles.listRow, { borderBottomColor: tc.border }]}>
                          <Text style={styles.listIcon}>{OTHER_ASSET_ICONS[a.subtype]}</Text>
                          <View style={styles.listInfo}>
                            <Text style={[styles.listName, { color: tc.text }]}>{a.name}</Text>
                            <Text style={[styles.listAmount, { color: tc.textSecondary }]}>
                              {a.currency === 'USD' ? `$${a.amount.toLocaleString()}` : `₩${a.amount.toLocaleString()}`}
                              {' → '}{krwDisplay(a)}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => deleteOtherAsset(a.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={18} color={tc.loss} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.body}>
                  {/* 대출명 */}
                  <Text style={[styles.label, { color: tc.textSecondary }]}>대출명</Text>
                  <TextInput
                    style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    placeholder="예) 주택담보대출"
                    placeholderTextColor={tc.textSecondary}
                    value={loanName}
                    onChangeText={setLoanName}
                  />

                  {/* 금액 (KRW 고정) */}
                  <Text style={[styles.label, { color: tc.textSecondary }]}>대출금액 (원화)</Text>
                  <TextInput
                    style={[styles.input, { color: tc.text, borderColor: tc.border, backgroundColor: tc.background }]}
                    placeholder="0"
                    placeholderTextColor={tc.textSecondary}
                    value={loanAmount}
                    onChangeText={setLoanAmount}
                    keyboardType="numeric"
                  />

                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: tc.loss, opacity: loanSaving ? 0.6 : 1 }]}
                    onPress={handleAddLoan}
                    disabled={loanSaving}
                  >
                    <Text style={styles.addBtnText}>대출 추가</Text>
                  </TouchableOpacity>

                  {/* 기존 목록 */}
                  {loans.length > 0 && (
                    <View style={[styles.listSection, { borderTopColor: tc.border }]}>
                      <Text style={[styles.listTitle, { color: tc.textSecondary }]}>등록된 대출</Text>
                      {loans.map(l => (
                        <View key={l.id} style={[styles.listRow, { borderBottomColor: tc.border }]}>
                          <Text style={styles.listIcon}>💳</Text>
                          <View style={styles.listInfo}>
                            <Text style={[styles.listName, { color: tc.text }]}>{l.name}</Text>
                            <Text style={[styles.listAmount, { color: tc.loss }]}>-₩{l.amount.toLocaleString()}</Text>
                          </View>
                          <TouchableOpacity onPress={() => deleteLoan(l.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={18} color={tc.loss} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { flex: 1, width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 10, padding: 3, borderWidth: 1, marginBottom: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabText: { fontSize: 13, fontWeight: '600' },
  body: { padding: 20, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  subtypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  subtypeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  subtypeIcon: { fontSize: 14 },
  subtypeLabel: { fontSize: 12, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 14 },
  amountRow: { flexDirection: 'row', gap: 8 },
  amountInput: { flex: 1 },
  currencyToggle: { paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  currencyText: { fontSize: 13, fontWeight: '700' },
  addBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  listSection: { marginTop: 20, borderTopWidth: 1, paddingTop: 16 },
  listTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  listIcon: { fontSize: 18 },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600' },
  listAmount: { fontSize: 12, marginTop: 2 },
});
