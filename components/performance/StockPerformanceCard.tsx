import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { StockPerformanceData } from '../../services/performance/IStockPerformanceService';
import { getDisplayName } from '../../constants/searchDatabase';

/** .KS/.KQ 등 거래소 suffix 제거 (BRK.B 같은 점 포함 티커는 유지) */
function cleanTicker(symbol: string): string {
  if (/\.(KS|KQ|T|HK|SS|SZ)$/.test(symbol)) return symbol.split('.')[0];
  return symbol;
}

const NVSTLY_BASE = 'https://github.com/nvstly/icons/raw/refs/heads/main/ticker_icons';
const FMP_BASE    = 'https://financialmodelingprep.com/image-stock';

const BADGE_COLORS = ['#6B4FFF', '#00C896', '#FF9500', '#FF6B6B', '#5AC8FA', '#BF5FFF'];
function badgeColor(symbol: string) {
  let hash = 0;
  for (const c of symbol) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length];
}

function StockLogo({ symbol }: { symbol: string }) {
  const { themeColors } = useTheme();
  const base = symbol.split('.')[0];
  const [step, setStep] = useState<'nvstly' | 'fmp' | 'none'>('nvstly');
  const [uri, setUri]   = useState(`${NVSTLY_BASE}/${base}.png`);

  useEffect(() => {
    setStep('nvstly');
    setUri(`${NVSTLY_BASE}/${base}.png`);
  }, [base]);

  const onError = () => {
    if (step === 'nvstly') {
      setStep('fmp');
      setUri(`${FMP_BASE}/${symbol}.png`);
    } else {
      setStep('none');
    }
  };

  if (step === 'none') {
    const bg = badgeColor(symbol);
    return (
      <View style={[styles.logoBadge, { backgroundColor: bg + '33', borderColor: bg + '66' }]}>
        <Text style={[styles.logoBadgeText, { color: bg }]}>
          {base.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={[styles.logo, { backgroundColor: themeColors.cardBackground }]} onError={onError} />;
}

function fmt(price: number, currency: string) {
  return currency === 'KRW'
    ? `₩${Math.round(price).toLocaleString()}`
    : `$${price.toFixed(2)}`;
}

interface Props {
  data: StockPerformanceData;
  rank: number;
}

export default function StockPerformanceCard({ data, rank }: Props) {
  const { themeColors } = useTheme();
  const positive = data.performancePercent >= 0;
  const pctColor  = positive ? themeColors.profit : themeColors.loss;
  const sign      = positive ? '+' : '';

  return (
    <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
      {/* 로고 */}
      <StockLogo symbol={data.symbol} />

      {/* 종목명 */}
      <View style={styles.tickerCol}>
        <Text style={[styles.symbol, { color: themeColors.text }]} numberOfLines={1}>{getDisplayName(data.symbol)}</Text>
        <Text style={[styles.rank, { color: themeColors.textSecondary }]}>{cleanTicker(data.symbol)} #{rank}</Text>
      </View>

      {/* 기간종가 / 전일종가 */}
      <View style={styles.priceCol}>
        <Text style={[styles.priceLabel, { color: themeColors.textSecondary }]}>기간종가</Text>
        <Text style={[styles.priceValue, { color: themeColors.text }]}>{fmt(data.currentPrice, data.currency)}</Text>
        <Text style={[styles.priceLabel, { color: themeColors.textSecondary }]}>전일종가</Text>
        <Text style={[styles.priceValue, { color: themeColors.text }]}>{fmt(data.prevClose, data.currency)}</Text>
      </View>

      {/* 수익률 */}
      <Text style={[styles.pct, { color: pctColor }]}>
        {sign}{data.performancePercent.toFixed(2)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tickerCol: {
    width: 90,
  },
  symbol: {
    fontSize: 13,
    fontWeight: '700',
  },
  rank: {
    fontSize: 10,
    marginTop: 2,
  },
  priceCol: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 2,
  },
  priceLabel: {
    fontSize: 10,
    width: '40%',
  },
  priceValue: {
    fontSize: 12,
    fontWeight: '600',
    width: '55%',
    textAlign: 'right',
  },
  pct: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 72,
    textAlign: 'right',
  },
});
