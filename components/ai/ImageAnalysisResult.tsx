import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { ImageAnalysisResponse, ExtractedHolding } from '../../services/api/claude';

const CONFIDENCE_CONFIG = {
  high:   { label: '높음', color: '#00C896', bg: '#00C89622' },
  medium: { label: '보통', color: '#FF9800', bg: '#FF980022' },
  low:    { label: '낮음', color: '#FF4444', bg: '#FF444422' },
};

interface Props {
  data: ImageAnalysisResponse;
  onAdd: (holdings: ExtractedHolding[]) => Promise<void>;
  onClose: () => void;
}

export default function ImageAnalysisResult({ data, onAdd, onClose }: Props) {
  const { themeColors } = useTheme();
  const [selected, setSelected] = useState<Set<number>>(
    new Set(data.holdings.map((_, i) => i)),
  );
  const [isAdding, setIsAdding] = useState(false);

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleAdd = async () => {
    const toAdd = data.holdings.filter((_, i) => selected.has(i));
    if (!toAdd.length) return;
    setIsAdding(true);
    try {
      await onAdd(toAdd);
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: '#6C63FF22' }]}>
            <Ionicons name="scan-outline" size={20} color="#6C63FF" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>이미지 분석 결과</Text>
            <Text style={[styles.headerSub, { color: themeColors.textSecondary }]}>
              {data.holdings.length}개 종목 인식됨
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {/* 종목 카드 */}
        {data.holdings.map((h, i) => {
          const conf = CONFIDENCE_CONFIG[h.confidence ?? 'medium'];
          const isSelected = selected.has(i);
          return (
            <TouchableOpacity
              key={i}
              onPress={() => toggleSelect(i)}
              activeOpacity={0.8}
              style={[
                styles.card,
                {
                  backgroundColor: themeColors.cardBackground,
                  borderColor: isSelected ? '#6C63FF' : themeColors.border,
                },
              ]}
            >
              {/* 선택 체크 */}
              <View style={[styles.checkbox, { borderColor: isSelected ? '#6C63FF' : themeColors.border, backgroundColor: isSelected ? '#6C63FF' : 'transparent' }]}>
                {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.ticker, { color: themeColors.text }]}>{h.ticker}</Text>
                  <View style={[styles.confBadge, { backgroundColor: conf.bg }]}>
                    <Text style={[styles.confText, { color: conf.color }]}>신뢰도 {conf.label}</Text>
                  </View>
                </View>
                {h.name && (
                  <Text style={[styles.name, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {h.name}
                  </Text>
                )}
                <View style={styles.cardMeta}>
                  <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                    수량 <Text style={{ color: themeColors.text, fontWeight: '600' }}>{h.quantity}</Text>
                  </Text>
                  {h.avgPrice > 0 && (
                    <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                      평단가 <Text style={{ color: themeColors.text, fontWeight: '600' }}>
                        {h.currency === 'KRW' ? `₩${h.avgPrice.toLocaleString()}` : `$${h.avgPrice.toLocaleString()}`}
                      </Text>
                    </Text>
                  )}
                  <View style={[styles.currBadge, { backgroundColor: h.currency === 'KRW' ? '#FF950022' : '#6C63FF22' }]}>
                    <Text style={[styles.currText, { color: h.currency === 'KRW' ? '#FF9500' : '#6C63FF' }]}>
                      {h.currency}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

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

        {/* 노트 */}
        {data.note && (
          <View style={[styles.noteBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
            <Ionicons name="information-circle-outline" size={14} color={themeColors.textSecondary} />
            <Text style={[styles.noteText, { color: themeColors.textSecondary }]}>{data.note}</Text>
          </View>
        )}
      </ScrollView>

      {/* 하단 추가 버튼 */}
      <View style={[styles.footer, { borderTopColor: themeColors.border, backgroundColor: themeColors.background }]}>
        <Text style={[styles.footerSub, { color: themeColors.textSecondary }]}>
          {selected.size}/{data.holdings.length}개 선택됨
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { opacity: selected.size === 0 || isAdding ? 0.5 : 1 }]}
          onPress={handleAdd}
          disabled={selected.size === 0 || isAdding}
          activeOpacity={0.8}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addBtnText}>포트폴리오에 추가</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 24 },
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticker: { fontSize: 15, fontWeight: '700' },
  confBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  confText: { fontSize: 10, fontWeight: '700' },
  name: { fontSize: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  metaText: { fontSize: 12 },
  currBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  currText: { fontSize: 10, fontWeight: '700' },
  unrecognizedBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  unrecognizedHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unrecognizedTitle: { fontSize: 12, fontWeight: '700' },
  unrecognizedItem: { fontSize: 12, color: '#FF4444', marginLeft: 4 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  footerSub: { fontSize: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
