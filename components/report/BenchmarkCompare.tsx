import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const CARD_BG   = 'rgba(107,79,255,0.06)';
const CARD_BDR  = 'rgba(107,79,255,0.18)';
const PURPLE    = '#6B4FFF';
const MINT      = '#00FFA3';
const PINK      = '#FF006B';
const TEXT      = '#E8E0FF';
const TEXT_SEC  = '#8B7FBF';
const MONO      = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type BenchmarkData = {
  sp500:    number;
  nasdaq:   number;
  myReturn: number;
};

type Props = {
  data: BenchmarkData;
};

type BarItem = {
  label:    string;
  value:    number;
  barColor: string;
};

export default function BenchmarkCompare({ data }: Props) {
  const { width: windowWidth } = useWindowDimensions();

  const items: BarItem[] = [
    { label: '내 포트폴리오', value: data.myReturn, barColor: PURPLE },
    { label: 'S&P 500',      value: data.sp500,    barColor: '#555555' },
    { label: 'NASDAQ',       value: data.nasdaq,   barColor: '#444444' },
  ];

  const maxVal    = Math.max(...items.map(i => Math.abs(i.value)), 0.01);
  const cardPad   = 14 * 2;
  const outerPad  = 16 * 2;
  const labelW    = 110;
  const pctW      = 54;
  const barAreaW  = windowWidth - outerPad - cardPad - labelW - pctW - 8;

  const alpha     = data.myReturn - data.sp500;
  const alphaColor = alpha >= 0 ? MINT : PINK;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>벤치마크 비교</Text>

      {items.map((item, idx) => {
        const barFillW = (Math.abs(item.value) / maxVal) * barAreaW;
        const pctStr   = `${item.value >= 0 ? '+' : ''}${item.value.toFixed(2)}%`;

        return (
          <View key={idx} style={styles.barRow}>
            <Text style={styles.barLabel}>{item.label}</Text>
            <View style={[styles.barTrack, { width: barAreaW }]}>
              <View
                style={[
                  styles.barFill,
                  { width: barFillW, backgroundColor: item.barColor },
                ]}
              />
            </View>
            <Text style={[styles.barPct, { color: item.value >= 0 ? MINT : PINK }]}>
              {pctStr}
            </Text>
          </View>
        );
      })}

      {/* Alpha row */}
      <View style={styles.alphaRow}>
        <Text style={styles.alphaLabel}>Alpha (vs S&P 500)</Text>
        <Text style={[styles.alphaValue, { color: alphaColor }]}>
          {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%p
        </Text>
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
    padding: 14,
  },
  sectionTitle: {
    color: TEXT_SEC,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  barLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
    width: 115,
  },
  barTrack: {
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 7,
  },
  barPct: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: MONO,
    width: 58,
    textAlign: 'right',
  },
  alphaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: CARD_BDR,
  },
  alphaLabel: {
    color: TEXT_SEC,
    fontSize: 14,
    fontWeight: '600',
  },
  alphaValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: MONO,
  },
});
