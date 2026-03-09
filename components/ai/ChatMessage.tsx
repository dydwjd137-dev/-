import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { ChatResponse, ChatHighlight } from '../../services/api/claude';

const HIGHLIGHT_COLORS: Record<ChatHighlight['color'], string> = {
  blue: '#6C63FF',
  green: '#00C896',
  red: '#FF4444',
  orange: '#FF9800',
};

// 텍스트에서 highlights 키워드를 인라인 강조로 렌더링
function HighlightedText({
  text,
  highlights = [],
  baseColor,
}: {
  text: string;
  highlights: ChatHighlight[];
  baseColor: string;
}) {
  if (!highlights.length) {
    return <Text style={[styles.messageText, { color: baseColor }]}>{text}</Text>;
  }

  // 모든 키워드를 찾아 분할
  const regex = new RegExp(
    `(${highlights.map(h => h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g',
  );
  const parts = text.split(regex);
  const highlightMap = new Map(highlights.map(h => [h.text, h.color]));

  return (
    <Text style={[styles.messageText, { color: baseColor }]}>
      {parts.map((part, i) => {
        const color = highlightMap.get(part);
        if (color) {
          return (
            <Text key={i} style={{ color: HIGHLIGHT_COLORS[color], fontWeight: '700' }}>
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

interface Props {
  data: ChatResponse;
}

export default function ChatMessage({ data }: Props) {
  const { themeColors } = useTheme();
  const isAppGuide = data.type === 'app_guide';
  const bubbleColor = isAppGuide ? '#1E3A5F' : '#2D1B69';
  const accentColor = isAppGuide ? '#6C63FF' : '#A855F7';

  return (
    <View style={[styles.container, { backgroundColor: bubbleColor, borderColor: accentColor + '40' }]}>
      {/* 타입 뱃지 */}
      <View style={[styles.badge, { backgroundColor: accentColor + '22' }]}>
        <Ionicons
          name={isAppGuide ? 'phone-portrait-outline' : 'trending-up-outline'}
          size={11}
          color={accentColor}
        />
        <Text style={[styles.badgeText, { color: accentColor }]}>
          {isAppGuide ? '앱 가이드' : '투자 분석'}
        </Text>
      </View>

      {/* 본문 */}
      <HighlightedText
        text={data.message}
        highlights={data.highlights ?? []}
        baseColor={themeColors.text}
      />

      {/* 관련 기능 */}
      {data.relatedFeatures && data.relatedFeatures.length > 0 && (
        <View style={styles.featuresRow}>
          {data.relatedFeatures.map((f, i) => (
            <View key={i} style={[styles.featureBadge, { borderColor: accentColor + '60' }]}>
              <Text style={[styles.featureText, { color: accentColor }]}>{f}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 22,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  featureBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
