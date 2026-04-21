/**
 * ExpandableCard.tsx
 * Shared expandable card component for AI insight sections.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  UIManager,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ExpandableCardProps {
  cardSummary: string;
  detail: React.ReactNode | string;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  rightElement?: React.ReactNode;
  defaultExpanded?: boolean;
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function ExpandableCard({
  cardSummary,
  detail,
  icon,
  accentColor = '#6B4FFF',
  rightElement,
  defaultExpanded = false,
  style,
}: ExpandableCardProps) {
  const { themeColors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasDetail = detail !== '' && detail !== null && detail !== undefined;

  function handleToggle() {
    if (!hasDetail) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }

  const cardBg = `${accentColor}08`;
  const cardBorder = `${accentColor}30`;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cardBg, borderColor: cardBorder },
        style,
      ]}
    >
      {/* ── Header row ── */}
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={hasDetail ? 0.7 : 1}
        style={styles.headerRow}
      >
        {/* Left: icon + summary */}
        <View style={styles.headerLeft}>
          {icon && (
            <Ionicons
              name={icon}
              size={15}
              color={accentColor}
              style={styles.headerIcon}
            />
          )}
          <Text
            style={[styles.summaryText, { color: themeColors.text }]}
            numberOfLines={expanded ? undefined : 2}
          >
            {cardSummary}
          </Text>
        </View>

        {/* Right: rightElement + chevron */}
        <View style={styles.headerRight}>
          {rightElement && (
            <View style={styles.rightElementWrap}>{rightElement}</View>
          )}
          {hasDetail && (
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color={accentColor}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* ── Expanded detail ── */}
      {expanded && hasDetail && (
        <View style={[styles.detailSection, { borderTopColor: `${accentColor}25` }]}>
          {typeof detail === 'string' ? (
            <Text
              style={[
                styles.detailText,
                { color: themeColors.textSecondary },
              ]}
            >
              {detail}
            </Text>
          ) : (
            detail
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    flexShrink: 0,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  rightElementWrap: {
    flexShrink: 0,
  },
  detailSection: {
    borderTopWidth: 1,
    padding: 12,
    paddingTop: 10,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 20,
  },
});