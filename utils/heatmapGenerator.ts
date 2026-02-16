import { EnrichedHolding, HeatmapBox, AssetCategory } from '../types/portfolio';
import Colors from '../constants/Colors';

// 히트맵 레이아웃 생성
export function generateHeatmapLayout(holdings: EnrichedHolding[]): HeatmapBox[][] {
  if (holdings.length === 0) return [];

  // 카테고리별 그룹화
  const grouped = groupByCategory(holdings);

  // 총 포트폴리오 가치 계산
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  // HeatmapBox 배열 생성
  const boxes = holdings.map((h) => createHeatmapBox(h, totalValue));

  // 가치순 정렬 (큰 것부터)
  boxes.sort((a, b) => b.value - a.value);

  // 레이아웃 배치
  return layoutBoxes(boxes, grouped);
}

// 카테고리별 그룹화
function groupByCategory(
  holdings: EnrichedHolding[]
): Record<AssetCategory, EnrichedHolding[]> {
  const groups: Record<AssetCategory, EnrichedHolding[]> = {
    ETF: [],
    한국주식: [],
    미국주식: [],
    코인: [],
    실물자산: [],
  };

  holdings.forEach((h) => {
    groups[h.category].push(h);
  });

  return groups;
}

// HeatmapBox 생성
function createHeatmapBox(
  holding: EnrichedHolding,
  totalValue: number
): HeatmapBox {
  const weight = totalValue > 0 ? holding.currentValue / totalValue : 0;
  const size = calculateSize(weight);
  const color = calculateColor(holding.profitLossPercent);

  return {
    ticker: holding.ticker,
    category: holding.category,
    value: holding.currentValue,
    changePercent: holding.profitLossPercent,
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
function calculateColor(changePercent: number): string {
  const absChange = Math.abs(changePercent);

  if (changePercent > 0) {
    // 수익 - 초록색 (투명도는 수익률에 비례)
    const opacity = Math.min(0.3, (absChange / 10) * 0.3);
    return `rgba(0, 255, 163, ${opacity})`;
  } else if (changePercent < 0) {
    // 손실 - 빨간색 (투명도는 손실률에 비례)
    const opacity = Math.min(0.3, (absChange / 10) * 0.3);
    return `rgba(255, 0, 107, ${opacity})`;
  } else {
    // 중립 - 보라색
    return `rgba(107, 79, 255, 0.1)`;
  }
}

// 박스 배치 (간단한 행 기반 레이아웃)
function layoutBoxes(
  boxes: HeatmapBox[],
  grouped: Record<AssetCategory, EnrichedHolding[]>
): HeatmapBox[][] {
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
