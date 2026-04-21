/**
 * PortfolioCommentModal.tsx
 * 4-page tabbed portfolio analysis modal.
 * Page 1: Metrics  |  Page 2: Structure  |  Page 3: Cautions  |  Page 4: Notes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AIModal from './AIModal';
import ExpandableCard from './ExpandableCard';
import { PortfolioCommentResponse } from './PortfolioCommentCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── constants ──────────────────────────────────────────────────
const PURPLE = '#6B4FFF';
const MINT   = '#00FFA3';
const ORANGE = '#FFB84F';

const TABS = [
  { label: '지표',    icon: 'stats-chart-outline'  },
  { label: '구조분석', icon: 'layers-outline'        },
  { label: '유의사항', icon: 'warning-outline'       },
  { label: '참고',    icon: 'bulb-outline'           },
];

// ── helpers ────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 80) return MINT;
  if (score >= 60) return PURPLE;
  if (score >= 40) return ORANGE;
  return '#FF006B';
}

function toExpandable(arr: any[]) {
  return arr.map((item) =>
    typeof item === 'string' ? { cardSummary: item, detail: '' } : item,
  );
}

// ── MetricRow ──────────────────────────────────────────────────
function MetricRow({ metric }: { metric: any }) {
  const [expanded, setExpanded] = useState(false);
  const color   = scoreColor(metric.score);
  const summary = metric.cardSummary ?? metric.comment ?? '';
  const detail  = metric.detail ?? '';
  const hasDetail = detail.trim().length > 0;

  function toggle() {
    if (!hasDetail) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  }

  return (
    <View style={[styles.metricCard, { backgroundColor: `${color}08`, borderColor: `${color}30` }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={hasDetail ? 0.7 : 1} style={styles.metricInner}>
        <View style={styles.metricLabelRow}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <Text style={[styles.metricScore, { color }]}>{metric.score}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(metric.score, 100)}%` as any, backgroundColor: color }]} />
        </View>
        {summary.length > 0 && (
          <View style={styles.metricSummaryRow}>
            <Text style={styles.metricSummaryText} numberOfLines={expanded ? undefined : 2}>
              {summary}
            </Text>
            {hasDetail && (
              <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={13} color={color} />
            )}
          </View>
        )}
      </TouchableOpacity>
      {expanded && hasDetail && (
        <View style={[styles.metricDetail, { borderTopColor: `${color}25` }]}>
          <Text style={styles.metricDetailText}>{detail}</Text>
        </View>
      )}
    </View>
  );
}

// ── EmptyPage ──────────────────────────────────────────────────
function EmptyPage({ label }: { label: string }) {
  return (
    <View style={styles.emptyPage}>
      <Ionicons name="checkmark-circle-outline" size={36} color="rgba(255,255,255,0.15)" />
      <Text style={styles.emptyText}>{label} 항목이 없습니다</Text>
    </View>
  );
}

// ── Props ──────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  data: PortfolioCommentResponse | null;
  loading?: boolean;
  onReanalyze?: () => void;
  savedAt?: string | null;
}

// ── Main ───────────────────────────────────────────────────────
export default function PortfolioCommentModal({
  visible, onClose, data, loading, onReanalyze, savedAt,
}: Props) {
  const [page, setPage] = useState(0);

  const summaryIsJson = typeof data?.summary === 'string' && data.summary.trim().startsWith('{');
  const hasData = data && !summaryIsJson && (
    data.summary || data.metrics?.length > 0 || (data.structure ?? []).length > 0
  );

  const structure = toExpandable(data?.structure ?? []);
  const cautions  = toExpandable(data?.cautions ?? data?.risks ?? []);
  const notes     = toExpandable(data?.notes ?? []);

  function switchPage(i: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPage(i);
  }

  return (
    <AIModal
      visible={visible}
      onClose={onClose}
      title="포트폴리오 분석"
      icon="bar-chart-outline"
      accentColor={PURPLE}
      loading={loading}
      loadingText="포트폴리오 분析 중…"
      noScroll
    >
      {hasData ? (
        <View style={styles.container}>
          {/* ── Tab bar ── */}
          <View style={styles.tabBar}>
            {TABS.map((tab, i) => {
              const active = page === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.tab, active && { backgroundColor: PURPLE, borderColor: PURPLE }]}
                  onPress={() => switchPage(i)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={13}
                    color={active ? '#fff' : 'rgba(255,255,255,0.4)'}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Page content ── */}
          <ScrollView
            style={styles.pageScroll}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Page 1 — Metrics */}
            {page === 0 && (
              <>
                {!!data?.summary && (
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                      <Ionicons name="sparkles" size={14} color={PURPLE} />
                      <Text style={styles.summaryTitle}>AI 분析 요약</Text>
                    </View>
                    <Text style={styles.summaryText}>{data.summary}</Text>
                  </View>
                )}
                {data?.metrics && data.metrics.length > 0 ? (
                  <View style={styles.section}>
                    {data.metrics.map((m, i) => <MetricRow key={i} metric={m} />)}
                  </View>
                ) : (
                  <EmptyPage label="지표" />
                )}
              </>
            )}

            {/* Page 2 — Structure */}
            {page === 1 && (
              structure.length > 0
                ? <View style={styles.section}>
                    {structure.map((item, i) => (
                      <ExpandableCard key={i} cardSummary={item.cardSummary} detail={item.detail} accentColor={PURPLE} />
                    ))}
                  </View>
                : <EmptyPage label="구조분석" />
            )}

            {/* Page 3 — Cautions */}
            {page === 2 && (
              cautions.length > 0
                ? <View style={styles.section}>
                    {cautions.map((item, i) => (
                      <ExpandableCard
                        key={i}
                        cardSummary={item.cardSummary}
                        detail={item.detail}
                        accentColor={ORANGE}
                        style={{ backgroundColor: 'rgba(255,184,79,0.06)', borderColor: 'rgba(255,184,79,0.2)' }}
                      />
                    ))}
                  </View>
                : <EmptyPage label="유의사항" />
            )}

            {/* Page 4 — Notes */}
            {page === 3 && (
              notes.length > 0
                ? <View style={styles.section}>
                    {notes.map((item, i) => (
                      <ExpandableCard key={i} cardSummary={item.cardSummary} detail={item.detail} accentColor="#6C63FF" />
                    ))}
                  </View>
                : <EmptyPage label="참고" />
            )}
          </ScrollView>

          {/* ── Footer ── */}
          {onReanalyze && (
            <View style={styles.footer}>
              {savedAt && <Text style={styles.savedAt}>{savedAt}</Text>}
              <TouchableOpacity style={styles.reanalyzeBtn} onPress={onReanalyze} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={14} color={PURPLE} />
                <Text style={styles.reanalyzeTxt}>재분析</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : !loading ? (
        /* Error state */
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={32} color={ORANGE} />
          <Text style={styles.errorTitle}>분析 결과를 불러오지 못했습니다</Text>
          <Text style={styles.errorDesc}>재분析 버튼을 눌러 다시 시도해주세요.</Text>
          {onReanalyze && (
            <TouchableOpacity style={[styles.reanalyzeBtn, { marginTop: 8 }]} onPress={onReanalyze} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={14} color={PURPLE} />
              <Text style={styles.reanalyzeTxt}>재분析</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </AIModal>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
  },
  tabLabelActive: {
    color: '#fff',
  },

  // Page scroll
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  section: {
    gap: 8,
  },

  // Summary card
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${PURPLE}40`,
    backgroundColor: `${PURPLE}0D`,
    padding: 14,
    gap: 8,
    marginBottom: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#fff',
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
    color: '#fff',
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
    color: 'rgba(255,255,255,0.55)',
  },
  metricDetail: {
    borderTopWidth: 1,
    padding: 12,
    paddingTop: 10,
  },
  metricDetailText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.55)',
  },

  // Empty page
  emptyPage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.25)',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
    borderColor: 'rgba(107,79,255,0.4)',
    backgroundColor: 'rgba(107,79,255,0.08)',
  },
  reanalyzeTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: PURPLE,
  },

  // Error state
  errorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
  },
});