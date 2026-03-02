import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/DisplayPreferencesContext';
import { Period } from '../../services/performance/IStockPerformanceService';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily',   label: '1주' },
  { key: 'weekly',  label: '1달' },
  { key: 'monthly', label: '3달' },
  { key: 'custom',  label: '직접' },
];

interface Props {
  selected: Period;
  onSelect: (p: Period) => void;
}

export default function PeriodSelector({ selected, onSelect }: Props) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: themeColors.cardBackground }]}>
      {PERIODS.map(({ key, label }) => {
        const active = key === selected;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.btn, active && { backgroundColor: themeColors.primary }]}
            onPress={() => onSelect(key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, { color: themeColors.textSecondary }, active && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  btn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
