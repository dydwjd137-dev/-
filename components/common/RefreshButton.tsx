import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/DisplayPreferencesContext';

interface RefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function RefreshButton({ onRefresh, isRefreshing }: RefreshButtonProps) {
  const { themeColors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}
      onPress={onRefresh}
      disabled={isRefreshing}
    >
      {isRefreshing ? (
        <ActivityIndicator size="small" color={themeColors.primary} />
      ) : (
        <Ionicons name="refresh" size={24} color={themeColors.primary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});
