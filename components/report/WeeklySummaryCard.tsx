import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WEEKLY_SAMPLE } from './sampleData';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const BG        = '#0D0221';
const CARD_BG   = 'rgba(107,79,255,0.06)';
const CARD_BDR  = 'rgba(107,79,255,0.18)';
const PURPLE    = '#6B4FFF';
const MINT      = '#00FFA3';
const PINK      = '#FF006B';
const TEXT      = '#E8E0FF';
const TEXT_SEC  = '#8B7FBF';
const MONO      = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtUSD(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number, forceSign = false): string {
  const sign = forceSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

// ─── Props ───────────────────────────────────────────────────────────────────
type Props = {
  data: typeof WEEKLY_SAMPLE;
  /** If true, uses monthReturn / monthPnl / prevMonthReturn field names */
  monthly?: boolean;
};

export default function WeeklySummaryCard({ data, monthly = false }: Props) {
  const returnVal = monthly
    ? (data as any).monthReturn
    : data.weekReturn;
  const pnlVal = monthly
    ? (data as any).monthPnl
    : data.weekPnl;
  const prevReturnVal = monthly
    ? (data as any).prevMonthReturn
    : data.prevWeekReturn;

  const returnColor = returnVal >= 0 ? MINT : PINK;
  const deltaVal    = returnVal - prevReturnVal;
  const deltaColor  = deltaVal >= 0 ? MINT : PINK;
  const deltaArrow  = deltaVal >= 0 ? '▲' : '▼';
  const periodLabel = monthly ? '전월 대비' : '전주 대비';

  return (
    <View style={styles.card}>
      {/* Period header */}
      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>{data.period}</Text>
        {!monthly && (data as typeof WEEKLY_SAMPLE).weekLabel ? (
          <Text style={styles.weekRange}>{(data as typeof WEEKLY_SAMPLE).weekLabel}</Text>
        ) : null}
      </View>

      {/* Asset row */}
      <View style={styles.assetGrid}>
        <View style={styles.assetCell}>
          <Text style={styles.assetCellLabel}>시작 자산</Text>
          <Text style={styles.assetCellValue}>{fmtUSD(data.startAsset)}</Text>
        </View>
        <View style={[styles.assetCell, styles.assetCellRight]}>
          <Text style={styles.assetCellLabel}>종료 자산</Text>
          <Text style={styles.assetCellValue}>{fmtUSD(data.endAsset)}</Text>
        </View>
      </View>

      {/* Big return number */}
      <View style={styles.returnCenter}>
        <Text style={[styles.returnBig, { color: returnColor }]}>
          {returnVal >= 0 ? '+' : ''}{fmtPct(returnVal)}
        </Text>
        <Text style={[styles.returnPnl, { color: returnColor }]}>
          {pnlVal >= 0 ? '+' : ''}${Math.abs(pnlVal).toLocaleString('en-US')}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Delta row */}
      <View style={styles.deltaRow}>
        <Text style={styles.deltaLabel}>{periodLabel}</Text>
        <Text style={[styles.deltaValue, { color: deltaColor }]}>
          {deltaArrow} {deltaVal >= 0 ? '+' : ''}{deltaVal.toFixed(2)}%p
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BDR,
    borderRadius: 14,
    padding: 14,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  periodLabel: {
    color: TEXT_SEC,
    fontSize: 14,
    fontWeight: '600',
  },
  weekRange: {
    color: TEXT_SEC,
    fontSize: 13,
  },
  assetGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  assetCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 10,
  },
  assetCellRight: {
    alignItems: 'flex-end',
  },
  assetCellLabel: {
    color: TEXT_SEC,
    fontSize: 13,
    marginBottom: 4,
  },
  assetCellValue: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: MONO,
  },
  returnCenter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  returnBig: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: MONO,
    letterSpacing: 1,
  },
  returnPnl: {
    fontSize: 19,
    fontWeight: '600',
    fontFamily: MONO,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: CARD_BDR,
    marginBottom: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deltaLabel: {
    color: TEXT_SEC,
    fontSize: 14,
  },
  deltaValue: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: MONO,
  },
});
