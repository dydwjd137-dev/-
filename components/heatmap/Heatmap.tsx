import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EnrichedHolding } from '../../types/portfolio';
import { HeatmapBox } from './HeatmapBox';
import { generateHeatmapLayout } from '../../utils/heatmapGenerator';
import Colors from '../../constants/Colors';

interface HeatmapProps {
  holdings: EnrichedHolding[];
}

export function Heatmap({ holdings }: HeatmapProps) {
  const heatmapData = useMemo(() => {
    return generateHeatmapLayout(holdings);
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>보유 자산이 없습니다</Text>
        <Text style={styles.emptySubtext}>+ 버튼을 눌러 종목을 추가하세요</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {heatmapData.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((box, boxIndex) => (
            <HeatmapBox key={`${rowIndex}-${boxIndex}`} box={box} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 2,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(107, 79, 255, 0.2)',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    opacity: 0.6,
  },
});
