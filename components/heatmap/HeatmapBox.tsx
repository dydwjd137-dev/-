import React, { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HeatmapBox as HeatmapBoxType } from '../../types/portfolio';
import { formatKRW, formatUSD, formatPercent } from '../../utils/portfolioCalculations';
import { TmRect } from '../../utils/treemapLayout';
import { ALL_STOCKS } from '../../constants/searchDatabase';
import { HeatmapLabelMode, useTheme } from '../../contexts/DisplayPreferencesContext';

interface HeatmapBoxProps {
  box: HeatmapBoxType;
  rect: TmRect;
  onPress: () => void;
  showKRW: boolean;
  exchangeRate: number;
  labelMode: HeatmapLabelMode;
}

export function HeatmapBox({ box, rect, onPress, showKRW, exchangeRate, labelMode }: HeatmapBoxProps) {
  const { themeColors } = useTheme();
  const { width, height } = rect;
  const minDim = Math.min(width, height);

  // Dynamic font sizes based on actual pixel dimensions
  const tickerFontSize = Math.min(Math.max(minDim * 0.28, 5), 28);
  const percentFontSize = Math.min(Math.max(minDim * 0.17, 5), 16);
  const amountFontSize = Math.min(Math.max(minDim * 0.13, 5), 13);

  const showLabel = minDim >= 16;
  const showPercent = minDim >= 28;
  const showAmount = width >= 60 && height >= 60;

  const percentColor =
    box.changePercent > 0
      ? themeColors.profit
      : box.changePercent < 0
      ? themeColors.loss
      : themeColors.textSecondary;

  // 표시할 라벨 결정 (searchDatabase 룩업)
  const displayLabel = useMemo(() => {
    const entry = ALL_STOCKS.find((e) => e.ticker === box.ticker);

    if (!entry) return box.ticker;

    if (entry.category === 'us-etf') {
      return box.ticker;
    }

    if (entry.category === 'kr-stock' || entry.category === 'kr-etf') {
      return entry.nameKr ?? entry.name ?? box.ticker;
    }

    switch (labelMode) {
      case 'nameKr': return entry.nameKr ?? box.ticker;
      case 'nameEn': return entry.name ?? box.ticker;
      default:       return box.ticker;
    }
  }, [box.ticker, labelMode]);

  return (
    <TouchableOpacity
      style={[
        styles.box,
        {
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          backgroundColor: box.color,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {showLabel && (
        <Text
          style={[styles.label, { fontSize: tickerFontSize, color: themeColors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayLabel}
        </Text>
      )}
      {showPercent && (
        <Text style={[styles.percent, { fontSize: percentFontSize, color: percentColor }]}>
          {formatPercent(box.changePercent)}
        </Text>
      )}
      {showAmount && (
        <Text style={[styles.amount, { fontSize: amountFontSize, color: themeColors.textSecondary }]}>
          {showKRW ? formatKRW(box.value) : formatUSD(box.value / exchangeRate)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 2,
  },
  label: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  percent: {
    fontWeight: '600',
    textAlign: 'center',
  },
  amount: {
    textAlign: 'center',
    opacity: 0.85,
  },
});
