/**
 * TaxAdviceView.tsx
 * Displays AI tax advice using expandable cards. Handles both old and new API formats.
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

// NEW format
interface TaxAdviceSummaryNew {
  totalEstimatedTax: number;
  potentialSaving: number;
  annualDividend: number;
  unrealizedGain: number;
  overseasCount: number;
  domesticCount: number;
}

interface TaxBreakdownSection {
  capitalGainTax: number;
  capitalGainNote: string;
  dividendTax: number;
  dividendNote: string;
  totalTax: number;
}

interface TaxStrategyStep {
  step: number;
  title: string;
  description: string;
}

interface TaxStrategyDetailNew {
  whatIs: string;
  howItHelps: string;
  limitation: string;
  steps: TaxStrategyStep[];
  warning: string;
}

interface TaxStrategyNew {
  rank: number;
  cardSummary: string;
  title: string;
  category: string;
  expectedSaving: number;
  difficulty: 'easy' | 'medium' | 'hard';
  detail: TaxStrategyDetailNew;
}

interface TaxAlertNew {
  type: 'info' | 'warning' | 'caution';
  cardSummary: string;
  detail: string;
}

// OLD format
interface TaxSummaryOld {
  totalTax: number;
  taxSaving: number;
  annualDividend: number;
  unrealizedGain: number;
  riskLevel: string;
}

interface TaxStrategyOld {
  rank: number;
  title: string;
  category: string;
  expectedSaving: number;
  difficulty: string;
  steps: string[];
  warning: string | null;
}

interface TaxAlertOld {
  type: string;
  message: string;
}

export interface TaxAdviceResponse {
  summary: TaxAdviceSummaryNew | TaxSummaryOld;
  taxBreakdown?: {
    overseas: TaxBreakdownSection;
    domestic: TaxBreakdownSection;
  };
  accounts?: any[];
  strategies: (TaxStrategyNew | TaxStrategyOld)[];
  alerts: (TaxAlertNew | TaxAlertOld)[];
}

interface Props {
  data: TaxAdviceResponse;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PURPLE = '#6B4FFF';
const MINT   = '#00FFA3';
const ORANGE = '#FFB84F';

// ─────────────────────────────────────────────────────────────
// Type Guards
// ─────────────────────────────────────────────────────────────

function isNewSummary(s: any): s is TaxAdviceSummaryNew {
  return 'totalEstimatedTax' in s;
}

function isNewStrategy(s: any): s is TaxStrategyNew {
  return !!s.cardSummary && s.detail !== null && s.detail !== undefined && typeof s.detail === 'object';
}

function isNewAlert(a: any): a is TaxAlertNew {
  return 'cardSummary' in a;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function fmtKRW(n: number): string {
  return `₩${Math.abs(n).toLocaleString('ko-KR')}`;
}

function difficultyBg(d: string): string {
  if (d === 'easy')   return 'rgba(0,255,163,0.15)';
  if (d === 'medium') return 'rgba(107,79,255,0.2)';
  return 'rgba(255,184,79,0.15)';
}

function difficultyText(d: string): string {
  if (d === 'easy')   return MINT;
  if (d === 'medium') return PURPLE;
  return ORANGE;
}

function difficultyLabel(d: string): string {
  if (d === 'easy')   return '쉬움';
  if (d === 'medium') return '보통';
  return '어려움';
}

function alertAccent(type: string): string {
  if (type === 'info') return PURPLE;
  return ORANGE; // warning | caution
}

// ─────────────────────────────────────────────────────────────
// TaxBreakdownCell: tappable overseas/domestic breakdown
// ─────────────────────────────────────────────────────────────

interface BreakdownCellProps {
  label: string;
  count?: number;
  section: TaxBreakdownSection;
}

function TaxBreakdownCell({ label, count, section }: BreakdownCellProps) {
  const { themeColors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  function handleToggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }

  return (
    <View style={[styles.breakdownCell, { borderColor: themeColors.border, backgroundColor: themeColors.cardBackground }]}>
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.7} style={styles.breakdownHeader}>
        <View style={styles.breakdownHeaderLeft}>
          <Text style={[styles.breakdownLabel, { color: themeColors.textSecondary }]}>{label}</Text>
          {count !== undefined && (
            <Text style={[styles.breakdownCount, { color: themeColors.text }]}>
              {count}종목
            </Text>
          )}
          <Text style={[styles.breakdownTotal, { color: themeColors.text }]}>
            {fmtKRW(section.totalTax)}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={themeColors.textSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.breakdownDetail, { borderTopColor: themeColors.border }]}>
          <View style={styles.breakdownDetailRow}>
            <Text style={[styles.breakdownDetailLabel, { color: themeColors.textSecondary }]}>
              양도세
            </Text>
            <View style={styles.breakdownDetailRight}>
              <Text style={[styles.breakdownDetailValue, { color: themeColors.text }]}>
                {fmtKRW(section.capitalGainTax)}
              </Text>
              {!!section.capitalGainNote && (
                <Text style={[styles.breakdownDetailNote, { color: themeColors.textSecondary }]}>
                  {section.capitalGainNote}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.breakdownDetailRow}>
            <Text style={[styles.breakdownDetailLabel, { color: themeColors.textSecondary }]}>
              배당세
            </Text>
            <View style={styles.breakdownDetailRight}>
              <Text style={[styles.breakdownDetailValue, { color: themeColors.text }]}>
                {fmtKRW(section.dividendTax)}
              </Text>
              {!!section.dividendNote && (
                <Text style={[styles.breakdownDetailNote, { color: themeColors.textSecondary }]}>
                  {section.dividendNote}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// StrategyDetail: expanded body for new-format strategy
// ─────────────────────────────────────────────────────────────

interface StrategyDetailProps {
  strategy: TaxStrategyNew;
}

function StrategyDetailNew({ strategy }: StrategyDetailProps) {
  const { themeColors } = useTheme();
  const d = strategy.detail;

  return (
    <View style={styles.stratDetailWrap}>
      {/* Title */}
      <Text style={[styles.stratDetailTitle, { color: themeColors.text }]}>
        {strategy.title}
      </Text>

      {/* What is it */}
      {!!d.whatIs && (
        <View style={styles.stratDetailBlock}>
          <Text style={[styles.stratDetailHeading, { color: themeColors.textSecondary }]}>
            📌 이게 뭔가요?
          </Text>
          <Text style={[styles.stratDetailBody, { color: themeColors.text }]}>
            {d.whatIs}
          </Text>
        </View>
      )}

      {/* How it helps */}
      {!!d.howItHelps && (
        <View style={styles.stratDetailBlock}>
          <Text style={[styles.stratDetailHeading, { color: themeColors.textSecondary }]}>
            💰 어떻게 절세되나요?
          </Text>
          <Text style={[styles.stratDetailBody, { color: themeColors.text }]}>
            {d.howItHelps}
          </Text>
        </View>
      )}

      {/* Limitation */}
      {!!d.limitation && (
        <View style={styles.stratDetailBlock}>
          <Text style={[styles.stratDetailHeading, { color: themeColors.textSecondary }]}>
            🚫 제한사항
          </Text>
          <Text style={[styles.stratDetailBody, { color: themeColors.text }]}>
            {d.limitation}
          </Text>
        </View>
      )}

      {/* Steps */}
      {d.steps && d.steps.length > 0 && (
        <View style={styles.stepsBlock}>
          {d.steps.map((step, i) => (
            <View
              key={i}
              style={[styles.stepCard, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
            >
              <View style={[styles.stepBadge, { backgroundColor: PURPLE }]}>
                <Text style={styles.stepBadgeText}>Step {step.step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: themeColors.text }]}>
                  {step.title}
                </Text>
                {!!step.description && (
                  <Text style={[styles.stepDescription, { color: themeColors.textSecondary }]}>
                    {step.description}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Warning */}
      {!!d.warning && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={14} color={ORANGE} />
          <Text style={[styles.warningText, { color: ORANGE }]}>{d.warning}</Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// StrategyExpandable: expandable card for strategy (custom layout)
// ─────────────────────────────────────────────────────────────

interface StrategyCardProps {
  strategy: TaxStrategyNew | TaxStrategyOld;
}

function StrategyExpandable({ strategy }: StrategyCardProps) {
  const { themeColors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isNew = isNewStrategy(strategy);
  const diff = strategy.difficulty as string;
  const diffBg = difficultyBg(diff);
  const diffColor = difficultyText(diff);

  function handleToggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }

  return (
    <View style={[styles.stratCard, { backgroundColor: `${PURPLE}08`, borderColor: `${PURPLE}30` }]}>
      <TouchableOpacity onPress={handleToggle} activeOpacity={0.7} style={styles.stratCardInner}>
        {/* Row 1: rank + summary + chevron */}
        <View style={styles.stratHeaderRow}>
          <View style={[styles.rankBadge, { backgroundColor: diffBg }]}>
            <Text style={[styles.rankText, { color: diffColor }]}>{strategy.rank}</Text>
          </View>
          <Text
            style={[styles.stratSummaryText, { color: themeColors.text }]}
            numberOfLines={expanded ? undefined : 2}
          >
            {isNew
              ? (strategy as TaxStrategyNew).cardSummary
              : (strategy as TaxStrategyOld).title}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={14}
            color={PURPLE}
            style={styles.stratChevron}
          />
        </View>

        {/* Row 2: saving + difficulty */}
        <View style={styles.stratMetaRow}>
          {strategy.expectedSaving > 0 && (
            <Text style={[styles.stratSaving, { color: MINT }]}>
              예상 절감: {fmtKRW(strategy.expectedSaving)}
            </Text>
          )}
          <View style={[styles.diffBadge, { backgroundColor: diffBg }]}>
            <Text style={[styles.diffText, { color: diffColor }]}>
              {difficultyLabel(diff)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && (
        <View style={[styles.stratDetailSection, { borderTopColor: `${PURPLE}25` }]}>
          {isNew ? (
            <StrategyDetailNew strategy={strategy as TaxStrategyNew} />
          ) : (
            <View style={styles.oldStratDetail}>
              {(strategy as TaxStrategyOld).steps?.map((step, i) => (
                <View key={i} style={styles.oldStepRow}>
                  <View style={[styles.oldStepDot, { backgroundColor: PURPLE }]} />
                  <Text style={[styles.oldStepText, { color: themeColors.text }]}>{step}</Text>
                </View>
              ))}
              {!!(strategy as TaxStrategyOld).warning && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={14} color={ORANGE} />
                  <Text style={[styles.warningText, { color: ORANGE }]}>
                    {(strategy as TaxStrategyOld).warning}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function TaxAdviceView({ data }: Props) {
  const { themeColors } = useTheme();

  const summary = data.summary;
  const newFmt = isNewSummary(summary);

  const totalTax = newFmt
    ? (summary as TaxAdviceSummaryNew).totalEstimatedTax
    : (summary as TaxSummaryOld).totalTax;

  const potentialSaving = newFmt
    ? (summary as TaxAdviceSummaryNew).potentialSaving
    : (summary as TaxSummaryOld).taxSaving;

  const overseasCount = newFmt ? (summary as TaxAdviceSummaryNew).overseasCount : undefined;
  const domesticCount = newFmt ? (summary as TaxAdviceSummaryNew).domesticCount : undefined;

  return (
    <View style={styles.root}>

      {/* ── Section 1: Tax Summary Dashboard ── */}
      <View
        style={[
          styles.summaryDashboard,
          { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border },
        ]}
      >
        {/* Total tax */}
        <View style={styles.summaryTop}>
          <Text style={[styles.summaryDashLabel, { color: themeColors.textSecondary }]}>
            예상 세금 합계
          </Text>
          <Text style={styles.summaryDashTotal}>
            {totalTax > 0 ? fmtKRW(totalTax) : '-'}
          </Text>
          {potentialSaving > 0 && (
            <Text style={styles.summaryDashSaving}>
              절감 가능: {fmtKRW(potentialSaving)}
            </Text>
          )}
        </View>

        {/* Overseas / Domestic counts */}
        {(overseasCount !== undefined || domesticCount !== undefined) && !data.taxBreakdown && (
          <View style={styles.summaryCountRow}>
            {overseasCount !== undefined && (
              <View style={[styles.summaryCountCell, { borderColor: themeColors.border }]}>
                <Text style={[styles.summaryCountLabel, { color: themeColors.textSecondary }]}>
                  해외
                </Text>
                <Text style={[styles.summaryCountValue, { color: themeColors.text }]}>
                  {overseasCount}종목
                </Text>
              </View>
            )}
            {domesticCount !== undefined && (
              <View style={[styles.summaryCountCell, { borderColor: themeColors.border }]}>
                <Text style={[styles.summaryCountLabel, { color: themeColors.textSecondary }]}>
                  국내
                </Text>
                <Text style={[styles.summaryCountValue, { color: themeColors.text }]}>
                  {domesticCount}종목
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tax breakdown expandable cells */}
        {data.taxBreakdown && (
          <View style={styles.breakdownRow}>
            <TaxBreakdownCell
              label="해외"
              count={overseasCount}
              section={data.taxBreakdown.overseas}
            />
            <TaxBreakdownCell
              label="국내"
              count={domesticCount}
              section={data.taxBreakdown.domestic}
            />
          </View>
        )}
      </View>

      {/* ── Section 2: 절세 전략 ── */}
      {data.strategies && data.strategies.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={15} color={MINT} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              절세 전략
            </Text>
          </View>
          <View style={styles.sectionItems}>
            {data.strategies.map((strategy, i) => (
              <StrategyExpandable key={i} strategy={strategy} />
            ))}
          </View>
        </View>
      )}

      {/* ── Section 3: 알림 ── */}
      {data.alerts && data.alerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={15} color={themeColors.text} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              알림
            </Text>
          </View>
          <View style={styles.sectionItems}>
            {data.alerts.map((alert, i) => {
              const accent = alertAccent(alert.type);
              if (isNewAlert(alert)) {
                return (
                  <ExpandableCard
                    key={i}
                    cardSummary={alert.cardSummary}
                    detail={alert.detail}
                    accentColor={accent}
                  />
                );
              } else {
                const old = alert as TaxAlertOld;
                return (
                  <ExpandableCard
                    key={i}
                    cardSummary={old.message}
                    detail=""
                    accentColor={accent}
                  />
                );
              }
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: 16 },

  // Summary Dashboard
  summaryDashboard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  summaryTop: {
    alignItems: 'center',
    gap: 4,
  },
  summaryDashLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryDashTotal: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E8E0FF',
    fontVariant: ['tabular-nums'],
  },
  summaryDashSaving: {
    fontSize: 13,
    fontWeight: '600',
    color: MINT,
    marginTop: 2,
  },
  summaryCountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCountCell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  summaryCountLabel: {
    fontSize: 11,
  },
  summaryCountValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  breakdownRow: {
    gap: 8,
  },

  // Breakdown Cell
  breakdownCell: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  breakdownHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  breakdownTotal: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 'auto',
    marginRight: 8,
  },
  breakdownDetail: {
    borderTopWidth: 1,
    padding: 10,
    gap: 8,
  },
  breakdownDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  breakdownDetailLabel: {
    fontSize: 12,
    paddingTop: 1,
  },
  breakdownDetailRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  breakdownDetailValue: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  breakdownDetailNote: {
    fontSize: 11,
    textAlign: 'right',
  },

  // Sections
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionItems: { gap: 8 },

  // Strategy expandable card
  stratCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stratCardInner: {
    padding: 12,
    gap: 8,
  },
  stratHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stratSummaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  stratChevron: {
    flexShrink: 0,
  },
  stratMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 32,
  },
  stratSaving: {
    fontSize: 12,
    fontWeight: '600',
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  diffText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stratDetailSection: {
    borderTopWidth: 1,
    padding: 12,
  },

  // Strategy detail (new format)
  stratDetailWrap: { gap: 12 },

  stratDetailTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  stratDetailBlock: { gap: 4 },
  stratDetailHeading: {
    fontSize: 12,
    fontWeight: '600',
  },
  stratDetailBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  stepsBlock: { gap: 8 },
  stepCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  stepContent: { gap: 2 },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,184,79,0.12)',
    borderRadius: 8,
    padding: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Old format strategy detail
  oldStratDetail: { gap: 8 },
  oldStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  oldStepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  oldStepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },

});