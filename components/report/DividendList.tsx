import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WEEKLY_SAMPLE, MONTHLY_SAMPLE } from './sampleData';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const CARD_BG   = 'rgba(107,79,255,0.06)';
const CARD_BDR  = 'rgba(107,79,255,0.18)';
const GOLD      = '#FFD700';
const TEXT      = '#E8E0FF';
const TEXT_SEC  = '#8B7FBF';
const MONO      = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ─── Types ────────────────────────────────────────────────────────────────────
type WeeklyDividend  = typeof WEEKLY_SAMPLE.dividends[number];
type MonthlyDividend = typeof MONTHLY_SAMPLE.dividendBreakdown[number];

type Props =
  | { dividends: WeeklyDividend[];  total?: number; mode: 'weekly' }
  | { dividends: MonthlyDividend[]; total?: number; mode: 'monthly' };

export default function DividendList({ dividends, total, mode }: Props) {
  const computedTotal =
    total ??
    (dividends as { amount: number }[]).reduce((sum, d) => sum + d.amount, 0);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        {mode === 'weekly' ? (
          <>
            <Text style={[styles.col, styles.colDate,   styles.headerText]}>날짜</Text>
            <Text style={[styles.col, styles.colTicker, styles.headerText]}>종목</Text>
            <Text style={[styles.col, styles.colAmount, styles.headerText]}>배당($)</Text>
          </>
        ) : (
          <>
            <Text style={[styles.col, styles.colTickerM, styles.headerText]}>종목</Text>
            <Text style={[styles.col, styles.colAmountM, styles.headerText]}>배당($)</Text>
          </>
        )}
      </View>

      {/* Rows */}
      {mode === 'weekly'
        ? (dividends as WeeklyDividend[]).map((d, i) => (
            <View key={i} style={[styles.dataRow, i % 2 === 0 && styles.rowEven]}>
              <Text style={[styles.col, styles.colDate,   styles.bodyText, { color: TEXT_SEC }]}>
                {d.date}
              </Text>
              <Text style={[styles.col, styles.colTicker, styles.bodyText]}>
                {d.ticker}
              </Text>
              <Text style={[styles.col, styles.colAmount, styles.bodyMono, { color: GOLD }]}>
                ${d.amount.toFixed(2)}
              </Text>
            </View>
          ))
        : (dividends as MonthlyDividend[]).map((d, i) => (
            <View key={i} style={[styles.dataRow, i % 2 === 0 && styles.rowEven]}>
              <Text style={[styles.col, styles.colTickerM, styles.bodyText]}>
                {d.ticker}
              </Text>
              <Text style={[styles.col, styles.colAmountM, styles.bodyMono, { color: GOLD }]}>
                ${d.amount.toFixed(2)}
              </Text>
            </View>
          ))}

      {/* Total row */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>총 배당 합계</Text>
        <Text style={styles.totalValue}>${computedTotal.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BDR,
    borderRadius: 14,
    overflow: 'hidden',
  },
  col: {
    paddingVertical: 0,
  },
  // Weekly column widths
  colDate:   { width: 52 },
  colTicker: { flex: 1 },
  colAmount: { width: 72, textAlign: 'right' },
  // Monthly column widths
  colTickerM: { flex: 1 },
  colAmountM: { width: 90, textAlign: 'right' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(107,79,255,0.10)',
    borderBottomWidth: 1,
    borderBottomColor: CARD_BDR,
  },
  headerText: {
    color: TEXT_SEC,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowEven: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  bodyText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  bodyMono: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: MONO,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: CARD_BDR,
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  totalLabel: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: MONO,
  },
});
