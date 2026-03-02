import { EnrichedHolding, HeatmapBox, AssetCategory } from '../types/portfolio';
import Colors from '../constants/Colors';

export type ViewMode = 'daily' | 'cumulative';

// 카테고리별 히트맵 데이터
export interface HeatmapCategory {
  category: string;
  boxes: HeatmapBox[][];
  profitLossPercent: number; // 카테고리 전체 수익률 (누적)
  dailyChangePercent: number; // 카테고리 일간 변동률
  totalValue: number; // 카테고리 총 가치
  totalCost: number; // 카테고리 총 원금
  color: string; // 수익률 기반 배경색
}

// 히트맵 레이아웃 생성 (카테고리별 그룹화)
export function generateHeatmapLayout(
  holdings: EnrichedHolding[],
  viewMode: ViewMode = 'cumulative',
  isDark: boolean = true,
): HeatmapCategory[] {
  if (holdings.length === 0) return [];

  // 총 포트폴리오 가치 계산 (시세 없으면 매수금액 fallback)
  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.currentValue > 0 ? h.currentValue : h.totalCost), 0
  );

  // 카테고리별 그룹화
  const grouped = groupByCategory(holdings);

  // 각 카테고리별로 레이아웃 생성
  const categoryLayouts: HeatmapCategory[] = [];

  Object.entries(grouped).forEach(([category, categoryHoldings]) => {
    if (categoryHoldings.length === 0) return;

    // 카테고리별 수익률 계산
    // currentValue가 0이면 (시세 미조회) totalCost를 레이아웃 fallback으로 사용
    const categoryTotalValue = categoryHoldings.reduce(
      (sum, h) => sum + (h.currentValue > 0 ? h.currentValue : h.totalCost), 0
    );
    const categoryTotalCost = categoryHoldings.reduce((sum, h) => sum + h.totalCost, 0);
    // 수익률은 실제 currentValue 기준으로만 계산 (시세 있는 종목만)
    const categoryCurrentValue = categoryHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const categoryProfitLoss = categoryCurrentValue - categoryTotalCost;
    const categoryProfitLossPercent = categoryTotalCost > 0
      ? (categoryProfitLoss / categoryTotalCost) * 100
      : 0;

    // 일간 변동률 계산 (daily 모드용)
    const categoryDailyChangePercent = categoryHoldings.reduce((sum, h) => {
      const holdingChange = h.quote?.changePercent || 0;
      const holdingWeight = h.currentValue / categoryTotalValue;
      return sum + (holdingChange * holdingWeight);
    }, 0);

    // 카테고리 색상 계산
    const changePercentForColor = viewMode === 'daily'
      ? categoryDailyChangePercent
      : categoryProfitLossPercent;
    const categoryColor = calculateCategoryColor(changePercentForColor, viewMode, isDark);

    // 카테고리 내 박스 생성
    const boxes = categoryHoldings.map((h) => createHeatmapBox(h, totalValue, viewMode, isDark));

    // 가치순 정렬
    boxes.sort((a, b) => b.value - a.value);

    // 레이아웃 배치
    const rows = layoutBoxesInRows(boxes);

    categoryLayouts.push({
      category,
      boxes: rows,
      profitLossPercent: categoryProfitLossPercent,
      dailyChangePercent: categoryDailyChangePercent,
      totalValue: categoryTotalValue,
      totalCost: categoryTotalCost,
      color: categoryColor,
    });
  });

  // 카테고리별 총 가치로 정렬 (큰 카테고리부터)
  categoryLayouts.sort((a, b) => {
    const aValue = a.boxes.flat().reduce((sum, box) => sum + box.value, 0);
    const bValue = b.boxes.flat().reduce((sum, box) => sum + box.value, 0);
    return bValue - aValue;
  });

  return categoryLayouts;
}

// 카테고리별 그룹화 (동적 카테고리 지원)
function groupByCategory(
  holdings: EnrichedHolding[]
): Record<string, EnrichedHolding[]> {
  const groups: Record<string, EnrichedHolding[]> = {};

  holdings.forEach((h) => {
    if (!groups[h.category]) {
      groups[h.category] = [];
    }
    groups[h.category].push(h);
  });

  return groups;
}

// HeatmapBox 생성
function createHeatmapBox(
  holding: EnrichedHolding,
  totalValue: number,
  viewMode: ViewMode,
  isDark: boolean,
): HeatmapBox {
  // 시세 미조회 시 매수금액을 레이아웃 크기 계산에 fallback으로 사용
  const layoutValue = holding.currentValue > 0 ? holding.currentValue : holding.totalCost;
  const weight = totalValue > 0 ? layoutValue / totalValue : 0;
  const size = calculateSize(weight);

  // viewMode에 따라 다른 changePercent 사용
  const changePercent = viewMode === 'daily'
    ? (holding.quote?.changePercent || 0)
    : holding.profitLossPercent;

  const color = calculateColor(changePercent, viewMode, isDark);

  return {
    ticker: holding.ticker,
    category: holding.category,
    value: layoutValue,
    changePercent: changePercent,
    size,
    color,
  };
}

// 포트폴리오 비중에 따른 박스 크기 결정
function calculateSize(weight: number): 'tiny' | 'small' | 'medium' | 'large' {
  if (weight > 0.15) return 'large';
  if (weight > 0.08) return 'medium';
  if (weight > 0.04) return 'small';
  return 'tiny';
}

// 수익률에 따른 배경색 계산
function calculateColor(changePercent: number, viewMode: ViewMode, isDark: boolean): string {
  // 라이트 모드: 더 진하고 채도 높은 색상 + 더 높은 최소 불투명도
  const green = isDark ? '0, 255, 163' : '0, 155, 85';
  const red   = isDark ? '255, 0, 107' : '200, 0, 60';
  const neutral = isDark ? `rgba(107, 79, 255, 0.10)` : `rgba(107, 79, 255, 0.18)`;
  const minOp = isDark ? 0.15 : 0.35;
  const maxOp = isDark ? 0.80 : 0.85;

  if (viewMode === 'daily') {
    const absChange = Math.abs(changePercent);
    if (changePercent > 0) {
      let opacity: number;
      if (absChange < 0.5)      opacity = minOp + (absChange / 0.5) * 0.10;
      else if (absChange < 1)   opacity = minOp + 0.10 + ((absChange - 0.5) / 0.5) * 0.10;
      else if (absChange < 2)   opacity = minOp + 0.20 + ((absChange - 1) / 1) * 0.15;
      else if (absChange < 3)   opacity = minOp + 0.35 + ((absChange - 2) / 1) * 0.15;
      else                      opacity = Math.min(maxOp, minOp + 0.50 + ((absChange - 3) / 2) * 0.15);
      return `rgba(${green}, ${opacity})`;
    } else if (changePercent < 0) {
      let opacity: number;
      if (absChange < 0.5)      opacity = minOp + (absChange / 0.5) * 0.10;
      else if (absChange < 1)   opacity = minOp + 0.10 + ((absChange - 0.5) / 0.5) * 0.10;
      else if (absChange < 2)   opacity = minOp + 0.20 + ((absChange - 1) / 1) * 0.15;
      else if (absChange < 3)   opacity = minOp + 0.35 + ((absChange - 2) / 1) * 0.15;
      else                      opacity = Math.min(maxOp, minOp + 0.50 + ((absChange - 3) / 2) * 0.15);
      return `rgba(${red}, ${opacity})`;
    } else {
      return neutral;
    }
  } else {
    // 누적 모드
    const baseOp = isDark ? 0.25 : 0.50;
    if (changePercent > 0)      return `rgba(${green}, ${baseOp})`;
    else if (changePercent < 0) return `rgba(${red}, ${baseOp})`;
    else                        return neutral;
  }
}

// 카테고리 헤더 배경색 계산 (박스보다 조금 더 진함)
function calculateCategoryColor(changePercent: number, viewMode: ViewMode, isDark: boolean): string {
  const green = isDark ? '0, 255, 163' : '0, 155, 85';
  const red   = isDark ? '255, 0, 107' : '200, 0, 60';
  const neutral = isDark ? `rgba(107, 79, 255, 0.15)` : `rgba(107, 79, 255, 0.22)`;
  const minOp = isDark ? 0.25 : 0.42;
  const maxOp = isDark ? 0.90 : 0.90;

  if (viewMode === 'daily') {
    const absChange = Math.abs(changePercent);
    if (changePercent > 0) {
      let opacity: number;
      if (absChange < 0.5)      opacity = minOp + (absChange / 0.5) * 0.10;
      else if (absChange < 1)   opacity = minOp + 0.10 + ((absChange - 0.5) / 0.5) * 0.10;
      else if (absChange < 2)   opacity = minOp + 0.20 + ((absChange - 1) / 1) * 0.15;
      else if (absChange < 3)   opacity = minOp + 0.35 + ((absChange - 2) / 1) * 0.15;
      else                      opacity = Math.min(maxOp, minOp + 0.50 + ((absChange - 3) / 2) * 0.15);
      return `rgba(${green}, ${opacity})`;
    } else if (changePercent < 0) {
      let opacity: number;
      if (absChange < 0.5)      opacity = minOp + (absChange / 0.5) * 0.10;
      else if (absChange < 1)   opacity = minOp + 0.10 + ((absChange - 0.5) / 0.5) * 0.10;
      else if (absChange < 2)   opacity = minOp + 0.20 + ((absChange - 1) / 1) * 0.15;
      else if (absChange < 3)   opacity = minOp + 0.35 + ((absChange - 2) / 1) * 0.15;
      else                      opacity = Math.min(maxOp, minOp + 0.50 + ((absChange - 3) / 2) * 0.15);
      return `rgba(${red}, ${opacity})`;
    } else {
      return neutral;
    }
  } else {
    const baseOp = isDark ? 0.30 : 0.55;
    if (changePercent > 0)      return `rgba(${green}, ${baseOp})`;
    else if (changePercent < 0) return `rgba(${red}, ${baseOp})`;
    else                        return neutral;
  }
}

// 박스 배치 (간단한 행 기반 레이아웃)
function layoutBoxesInRows(boxes: HeatmapBox[]): HeatmapBox[][] {
  const rows: HeatmapBox[][] = [];
  let currentRow: HeatmapBox[] = [];
  let currentRowWeight = 0;

  boxes.forEach((box) => {
    const boxWeight = getSizeWeight(box.size);

    // 현재 행이 가득 찼으면 새 행 시작
    if (currentRowWeight + boxWeight > 1.0 && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWeight = 0;
    }

    currentRow.push(box);
    currentRowWeight += boxWeight;
  });

  // 마지막 행 추가
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

// 박스 크기에 따른 가중치
function getSizeWeight(size: HeatmapBox['size']): number {
  switch (size) {
    case 'large':
      return 0.5;
    case 'medium':
      return 0.33;
    case 'small':
      return 0.25;
    case 'tiny':
      return 0.16;
  }
}

// 카테고리별로 박스 필터링
export function filterBoxesByCategory(
  boxes: HeatmapBox[][],
  category: AssetCategory
): HeatmapBox[][] {
  return boxes.map((row) => row.filter((box) => box.category === category));
}
