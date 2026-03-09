import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { analyzeCsv, ExtractedHolding } from '../../services/api/claude';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAnalyzed: (holdings: ExtractedHolding[]) => void; // 분석 완료 → ImageAnalysisModal로 넘김
}

const EXAMPLE = `티커,수량,매수가
AAPL,10,185.5
005930.KS,20,73000
MSFT,5,420`;

export default function CsvImportModal({ visible, onClose, onAnalyzed }: Props) {
  const { themeColors } = useTheme();
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    if (!isLoading) {
      setText('');
      onClose();
    }
  };

  const handleAnalyze = async () => {
    if (!text.trim()) {
      Alert.alert('입력 필요', '종목 정보를 붙여넣어 주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const holdings = await analyzeCsv(text.trim());
      if (holdings.length === 0) {
        Alert.alert('인식 실패', '종목을 찾지 못했습니다.\n형식을 확인하거나 더 자세한 내용을 입력해보세요.');
        return;
      }
      setText('');
      onClose();
      onAnalyzed(holdings);
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '분석에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.sheet, { backgroundColor: themeColors.background }]}
        >
          {/* 헤더 */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <View>
              <Text style={[styles.title, { color: themeColors.text }]}>텍스트로 종목 추가</Text>
              <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
                구글시트, 엑셀, 메모 내용을 붙여넣으면 AI가 자동 인식합니다
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} disabled={isLoading}>
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* 예시 */}
            <TouchableOpacity
              style={[styles.exampleBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
              onPress={() => setText(EXAMPLE)}
              activeOpacity={0.7}
            >
              <View style={styles.exampleHeader}>
                <Ionicons name="bulb-outline" size={14} color={themeColors.primary} />
                <Text style={[styles.exampleTitle, { color: themeColors.primary }]}>예시 형식 (탭하면 자동 입력)</Text>
              </View>
              <Text style={[styles.exampleText, { color: themeColors.textSecondary }]}>{EXAMPLE}</Text>
            </TouchableOpacity>

            {/* 안내 */}
            <View style={styles.hints}>
              {[
                '자유로운 형식 가능 — CSV, 표, 목록 모두 OK',
                '티커 심볼 또는 종목명 (삼성전자, Apple 등)',
                '수량과 매수가가 포함되면 더 정확해요',
              ].map((hint) => (
                <View key={hint} style={styles.hintRow}>
                  <Text style={[styles.hintDot, { color: themeColors.primary }]}>•</Text>
                  <Text style={[styles.hintText, { color: themeColors.textSecondary }]}>{hint}</Text>
                </View>
              ))}
            </View>

            {/* 입력창 */}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.cardBackground,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                },
              ]}
              value={text}
              onChangeText={setText}
              placeholder={'여기에 종목 정보를 붙여넣으세요...\n\n예) AAPL 10주 185달러\n    삼성전자 20주 73000원'}
              placeholderTextColor={themeColors.textSecondary}
              multiline
              textAlignVertical="top"
              editable={!isLoading}
            />
          </ScrollView>

          {/* 하단 버튼 */}
          <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: themeColors.primary }, isLoading && { opacity: 0.6 }]}
              onPress={handleAnalyze}
              disabled={isLoading || !text.trim()}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={18} color="#fff" />
                  <Text style={styles.btnText}>AI로 종목 인식하기</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
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
    maxWidth: 260,
  },
  scroll: {
    padding: 16,
  },
  exampleBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  exampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  exampleText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  hints: {
    gap: 6,
    marginBottom: 14,
  },
  hintRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hintDot: {
    fontSize: 14,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 180,
    marginBottom: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
