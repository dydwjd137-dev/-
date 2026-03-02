import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { EnrichedHolding } from '../../types/portfolio';
import { HeatmapBox } from './HeatmapBox';
import { generateHeatmapLayout } from '../../utils/heatmapGenerator';
import { HoldingDetailModal } from '../portfolio/HoldingDetailModal';
import { formatPercent } from '../../utils/portfolioCalculations';
import { squarifiedTreemap, TmRect, TmNode } from '../../utils/treemapLayout';
import { useTheme } from '../../contexts/DisplayPreferencesContext';

export type ViewMode = 'daily' | 'cumulative';

// Heatmap height = width * this ratio (adjust to taste)
const ASPECT_RATIO = 0.72;
// Pixel gap between category sections (shows as dark separator)
const CATEGORY_GAP = 3;
// Pixel gap between holding boxes within a category
const BOX_GAP = 1;
// Height reserved for the category label row
const LABEL_HEIGHT = 18;
// Minimum fraction of heatmap area each category gets (prevents tiny categories from disappearing)
const MIN_CAT_FRACTION = 0.01;

interface HeatmapProps {
  holdings: EnrichedHolding[];
  viewMode: ViewMode;
  showKRW: boolean;
  exchangeRate: number;
}

export function Heatmap({ holdings, viewMode, showKRW, exchangeRate }: HeatmapProps) {
  const { prefs, themeColors } = useTheme();
  const systemScheme = useColorScheme();
  const isDark =
    prefs.themeMode !== 'light' &&
    !(prefs.themeMode === 'system' && systemScheme === 'light');

  const [selectedHolding, setSelectedHolding] = useState<EnrichedHolding | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const heatmapData = useMemo(
    () => generateHeatmapLayout(holdings, viewMode, isDark),
    [holdings, viewMode, isDark],
  );

  const containerHeight = containerWidth > 0 ? containerWidth * ASPECT_RATIO : 0;

  // Outer treemap: one tile per category, sized by totalValue
  const categoryLayout = useMemo((): TmNode[] => {
    if (containerWidth <= 0 || heatmapData.length === 0) return [];
    const totalPortfolioValue = heatmapData.reduce((s, cat) => s + cat.totalValue, 0);
    const minValue = totalPortfolioValue * MIN_CAT_FRACTION;
    return squarifiedTreemap(
      heatmapData.map((cat) => ({
        id: cat.category,
        value: Math.max(cat.totalValue, minValue),
      })),
      { x: 0, y: 0, width: containerWidth, height: containerHeight },
      CATEGORY_GAP,
    );
  }, [heatmapData, containerWidth, containerHeight]);

  // Inner treemap: one tile per holding, within each category's rect
  const holdingLayout = useMemo((): Record<string, TmNode[]> => {
    const result: Record<string, TmNode[]> = {};
    for (const cat of heatmapData) {
      const catNode = categoryLayout.find((n) => n.id === cat.category);
      if (!catNode) continue;

      const showLabelInner =
        catNode.rect.height >= LABEL_HEIGHT + 10 && catNode.rect.width >= 48;
      const innerRect: TmRect = {
        x: catNode.rect.x,
        y: catNode.rect.y + (showLabelInner ? LABEL_HEIGHT : 0),
        width: catNode.rect.width,
        height: Math.max(0, catNode.rect.height - (showLabelInner ? LABEL_HEIGHT : 0)),
      };

      const boxes = cat.boxes.flat();
      result[cat.category] = squarifiedTreemap(
        boxes.map((b) => ({ id: b.ticker, value: b.value })),
        innerRect,
        BOX_GAP,
      );
    }
    return result;
  }, [categoryLayout, heatmapData]);

  const handleBoxPress = (ticker: string) => {
    const holding = holdings.find((h) => h.ticker === ticker);
    if (holding) {
      setSelectedHolding(holding);
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedHolding(null);
  };

  if (holdings.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.border }]}>
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          보유 자산이 없습니다
        </Text>
        <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
          + 버튼을 눌러 종목을 추가하세요
        </Text>
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          styles.heatmapWrapper,
          {
            height: containerHeight > 0 ? containerHeight : undefined,
            minHeight: 200,
            backgroundColor: themeColors.primary + '28',
            borderColor: themeColors.primary + '4D',
          },
        ]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 &&
          heatmapData.map((cat) => {
            const catNode = categoryLayout.find((n) => n.id === cat.category);
            if (!catNode) return null;

            const changeValue =
              viewMode === 'daily' ? cat.dailyChangePercent : cat.profitLossPercent;
            const labelColor =
              changeValue > 0
                ? themeColors.profit
                : changeValue < 0
                ? themeColors.loss
                : themeColors.textSecondary;

            const boxes = cat.boxes.flat();
            const catBoxes = holdingLayout[cat.category] ?? [];

            const showLabel =
              catNode.rect.height >= LABEL_HEIGHT + 10 && catNode.rect.width >= 48;

            return (
              <React.Fragment key={cat.category}>
                <View
                  style={[
                    styles.categoryBg,
                    {
                      left: catNode.rect.x,
                      top: catNode.rect.y,
                      width: catNode.rect.width,
                      height: catNode.rect.height,
                      backgroundColor: themeColors.cardBackground,
                    },
                  ]}
                />

                {showLabel && (
                  <View
                    style={[
                      styles.labelRow,
                      {
                        left: catNode.rect.x,
                        top: catNode.rect.y,
                        width: catNode.rect.width,
                        height: LABEL_HEIGHT,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.categoryLabel, { color: labelColor }]}
                      numberOfLines={1}
                    >
                      {cat.category.toUpperCase()}
                    </Text>
                    <Text style={[styles.categoryLabelPercent, { color: labelColor }]}>
                      {formatPercent(changeValue)}
                    </Text>
                  </View>
                )}

                {catBoxes.map((node) => {
                  const box = boxes.find((b) => b.ticker === node.id);
                  if (!box) return null;
                  return (
                    <HeatmapBox
                      key={node.id}
                      box={box}
                      rect={node.rect}
                      onPress={() => handleBoxPress(node.id)}
                      showKRW={showKRW}
                      exchangeRate={exchangeRate}
                      labelMode={prefs.heatmapLabelMode}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
      </View>

      <HoldingDetailModal
        visible={modalVisible}
        holding={selectedHolding}
        onClose={handleCloseModal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heatmapWrapper: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  categoryBg: {
    position: 'absolute',
    borderRadius: 2,
  },
  labelRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    zIndex: 1,
  },
  categoryLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  categoryLabelPercent: {
    fontSize: 8,
    fontWeight: '700',
    marginLeft: 2,
    flexShrink: 0,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    opacity: 0.6,
  },
});
