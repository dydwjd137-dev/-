import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HeatmapBox as HeatmapBoxType } from '../../types/portfolio';
import Colors from '../../constants/Colors';
import { formatPrice, formatPercent } from '../../utils/portfolioCalculations';

interface HeatmapBoxProps {
  box: HeatmapBoxType;
}

export function HeatmapBox({ box }: HeatmapBoxProps) {
  const sizeStyle = getSizeStyle(box.size);
  const percentColor =
    box.changePercent > 0
      ? Colors.profit
      : box.changePercent < 0
      ? Colors.loss
      : Colors.textSecondary;

  return (
    <View
      style={[
        styles.box,
        sizeStyle,
        { backgroundColor: box.color },
      ]}
    >
      <Text style={styles.ticker}>{box.ticker}</Text>
      <Text style={[styles.percent, { color: percentColor }]}>
        {formatPercent(box.changePercent)}
      </Text>
      <Text style={styles.amount}>{formatPrice(box.value, box.category)}</Text>
    </View>
  );
}

function getSizeStyle(size: HeatmapBoxType['size']) {
  switch (size) {
    case 'large':
      return styles.sizeLarge;
    case 'medium':
      return styles.sizeMedium;
    case 'small':
      return styles.sizeSmall;
    case 'tiny':
      return styles.sizeTiny;
  }
}

const styles = StyleSheet.create({
  box: {
    padding: 12,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
  },
  sizeLarge: {
    flex: 2,
    minHeight: 100,
  },
  sizeMedium: {
    flex: 1,
    minHeight: 90,
  },
  sizeSmall: {
    flex: 1,
    minHeight: 42,
  },
  sizeTiny: {
    flex: 1,
    minHeight: 25,
  },
  ticker: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  percent: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  amount: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
});
