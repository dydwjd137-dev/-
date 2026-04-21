/**
 * TaxAdviceModal.tsx
 * Fancy popup modal for AI tax advice (history tab).
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AIModal from './AIModal';
import TaxAdviceView, { TaxAdviceResponse } from './TaxAdviceView';

interface Props {
  visible: boolean;
  onClose: () => void;
  data: TaxAdviceResponse | null;
  loading?: boolean;
  onReanalyze?: () => void;
  savedAt?: string | null;
}

export default function TaxAdviceModal({ visible, onClose, data, loading, onReanalyze, savedAt }: Props) {
  return (
    <AIModal
      visible={visible}
      onClose={onClose}
      title="AI 절세 어드바이저"
      icon="shield-checkmark-outline"
      accentColor="#A855F7"
      loading={loading}
      loadingText="절세 전략 분석 중…"
    >
      {data && (
        <>
          <TaxAdviceView data={data} />
          {onReanalyze && (
            <View style={styles.footer}>
              {savedAt && <Text style={styles.savedAt}>{savedAt}</Text>}
              <TouchableOpacity style={styles.reanalyzeBtn} onPress={onReanalyze} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={14} color="#A855F7" />
                <Text style={styles.reanalyzeTxt}>재분석</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </AIModal>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  savedAt: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  reanalyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  reanalyzeTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A855F7',
  },
});