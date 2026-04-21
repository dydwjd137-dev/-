/**
 * PortfolioCommentCard.tsx
 * Displays AI portfolio analysis using expandable cards.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import ExpandableCard from './ExpandableCard';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ExpandableItem {
  cardSummary: string;
  detail: string;
}

interface PortfolioMetric {
  label: string;
  score: number;
  cardSummary?: string;  // new format
  comment?: string;       // old format
  detail?: string;
  color: 'green' | 'blue' | 'orange' | 'red';
}

export interface PortfolioCommentResponse {
  summary: string;
  metrics: PortfolioMetric[];
  structure: ExpandableItem[] | string[];
  cautions?: ExpandableItem[] | string[];  // new name
  risks?: ExpandableItem[] | string[];     // old name
  notes: ExpandableItem[] | string[];
}

interface Props {
  data: PortfolioCommentResponse;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PURPLE  = '#6B4FFF';
const MINT    = '#00FFA3';
const ORANGE  = '#FFB84F';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toExpandable(arr: any[]): ExpandableItem[] {
  return arr.map((item) =>
    typeof item === 'string'
      ? { cardSummary: item, detail: '' }
      : item,
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return MINT;
  if (score >= 60) return PURPLE;
  if (score >= 40) return ORANGE;
  return '#FF006B';
}

// ─────────────────────────────────────────────────────────────
// MetricCard (inline sub-component)
// ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  metric: PortfolioMetric;
}

function MetricCard({ metric }: MetricCardProps) {
  const { themeColors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const color = scoreColor(metric.score);
  const summary = metric.cardSummary ?? metric.comment ?? '';
  const detail = metric.detail ?? '';
  const hasDetail = detail.trim().length > 0;

  function handleToggle() {
    if (!hasDetail) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }

  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: `${color}08`, borderColor: `${color}30` },
      ]}
    >
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={hasDetail ? 0.7 : 1}
        style={styles.metricInner}
      >
        {/* Row 1: label + score */}
        <View style={styles.metricLabelRow}>
          <Text style={[styles.metricLabel, { color: themeColors.text }]}>
            {metric.label}
          </Text>
          <Text style={[styles.metricScore, { color }]}>
            {metric.score}
          </Text>
        </View>

        {/* Row 2: progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(metric.score, 100)}%` as any, backgroundColor: color },
            ]}
          />
        </View>

        {/* Row 3: summary + chevron */}
        {summary.length > 0 && (
          <View style={styles.metricSummaryRow}>
            <Text
              style={[styles.metricSummaryText, { color: themeColors.textSecondary }]}
              numberOfLines={expanded ? undefined : 2}
            >
              {summary}
            </Text>
            {hasDetail && (
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-forward'}
                size={13}
                color={color}
                style={styles.metricChevron}
              />
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <View style={[styles.metricDetail, { borderTopColor: `${color}25` }]}>
          <Text style={[styles.metricDetailText, { color: themeColors.textSecondary }]}>
            {detail}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function PortfolioCommentCard({ data }: Props) {
  const { themeColors } = useTheme();

  const cautions = toExpandable(data.cautions ?? data.risks ?? []);
  const structure = toExpandable(data.structure ?? []);
  const notes = toExpandable(data.notes ?? []);

  // summary가 JSON 문자열이거나 데이터가 비어있으면 에러 상태
  const summaryIsJson = typeof data.summary === 'string' && data.summary.trim().startsWith('{');
  const isEmpty = !data.summary && data.metrics.length === 0 && structure.length === 0 && notes.length === 0;
  if (summaryIsJson || isEmpty) {
    return (
      <View style={[styles.errorCard, { borderColor: 'rgba(255,184,79,0.3)', backgroundColor: 'rgba(255,184,79,0.06)' }]}>
        <Ionicons name="alert-circle-outline" size={32} color="#FFB84F" />
        <Text style={[styles.errorTitle, { color: themeColors.text }]}>분석 결과를 불러오지 못했습니다</Text>
        <Text style={[styles.errorDesc, { color: themeColors.textSecondary }]}>
          재분析 버튼을 눌러 다시 시도해주세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>

      {/* ── 1. Summary card ── */}
      {!!data.summary && (
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: `${PURPLE}0D`, borderColor: `${PURPLE}40` },
          ]}
        >
          <View style={styles.summaryHeader}>
            <Ionicons name="sparkles" size={15} color={PURPLE} />
            <Text style={[styles.summaryTitle, { color: themeColors.text }]}>
              AI 분석 요약
            </Text>
          </View>
          <Text style={[styles.summaryText, { color: themeColors.text }]}>
            {data.summary}
          </Text>
        </View>
      )}

      {/* ── 2. Metrics ── */}
      {data.metrics && data.metrics.length > 0 && (
        <View style={styles.section}>
          {data.metrics.map((metric, i) => (
            <MetricCard key={i} metric={metric} />
          ))}
        </View>
      )}

      {/* ── 3. Structure section ── */}
      {structure.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="layers-outline" size={15} color={themeColors.text} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              구조 분석
            </Text>
          </View>
          {structure.map((item, i) => (
            <ExpandableCard
              key={i}
              cardSummary={item.cardSummary}
              detail={item.detail}
              accentColor={PURPLE}
            />
          ))}
        </View>
      )}

      {/* ── 4. Cautions section ── */}
      {cautions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning-outline" size={15} color={ORANGE} />
            <Text style={[styles.sectionTitle, { color: ORANGE }]}>
              유의사항
            </Text>
          </View>
          {cautions.map((item, i) => (
            <ExpandableCard
              key={i}
              cardSummary={item.cardSummary}
              detail={item.detail}
              accentColor={ORANGE}
              style={{
                backgroundColor: 'rgba(255,184,79,0.06)',
                borderColor: 'rgba(255,184,79,0.2)',
              }}
            />
          ))}
        </View>
      )}

      {/* ── 5. Notes section ── */}
      {notes.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb-outline" size={15} color={themeColors.text} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              참고
            </Text>
          </View>
          {notes.map((item, i) => (
            <ExpandableCard
              key={i}
              cardSummary={item.cardSummary}
              detail={item.detail}
              accentColor="#6C63FF"
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: 12 },

  // Summary
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // Sections
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Metric card
  metricCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  metricInner: {
    padding: 12,
    gap: 6,
  },
  metricLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricScore: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metricSummaryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  metricChevron: {
    flexShrink: 0,
  },
  metricDetail: {
    borderTopWidth: 1,
    padding: 12,
    paddingTop: 10,
  },
  metricDetailText: {
    fontSize: 13,
    lineHeight: 20,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});