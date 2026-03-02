// Squarified Treemap Algorithm
// Based on Bruls et al. "Squarified Treemaps" (2000)
// Produces near-square rectangles for each item, proportional to its value.

export interface TmRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TmItem {
  id: string;
  value: number;
}

export interface TmNode {
  id: string;
  rect: TmRect;
}

// Worst aspect ratio for a row of areas given the strip length w.
// For each item i: one dimension = area_i / (sum/w) = area_i*w/sum, other = sum/w
// Aspect ratio_i = max(area_i*w^2/sum^2, sum^2/(area_i*w^2))
// Worst = max(max_area * w^2 / sum^2, sum^2 / (min_area * w^2))
function worstAspect(rowAreas: number[], w: number): number {
  if (rowAreas.length === 0 || w <= 0) return Infinity;
  const s = rowAreas.reduce((a, b) => a + b, 0);
  if (s <= 0) return Infinity;
  const rMax = Math.max(...rowAreas);
  const rMin = Math.min(...rowAreas);
  return Math.max((w * w * rMax) / (s * s), (s * s) / (w * w * rMin));
}

// Place one row of items into the current rect, return the remaining rect.
// If landscape (W >= H): vertical strip on the left side.
// If portrait (H > W): horizontal strip on the top.
function placeRow(
  row: { id: string; area: number }[],
  rect: TmRect,
  results: TmNode[],
): TmRect {
  const s = row.reduce((sum, i) => sum + i.area, 0);
  const { x, y, width, height } = rect;

  if (width >= height) {
    // Landscape: left strip with full height H, width = s/H
    const stripW = height > 0 ? s / height : 0;
    let curY = y;
    for (const item of row) {
      const itemH = stripW > 0 ? item.area / stripW : 0;
      results.push({ id: item.id, rect: { x, y: curY, width: stripW, height: itemH } });
      curY += itemH;
    }
    return { x: x + stripW, y, width: width - stripW, height };
  } else {
    // Portrait: top strip with full width W, height = s/W
    const stripH = width > 0 ? s / width : 0;
    let curX = x;
    for (const item of row) {
      const itemW = stripH > 0 ? item.area / stripH : 0;
      results.push({ id: item.id, rect: { x: curX, y, width: itemW, height: stripH } });
      curX += itemW;
    }
    return { x, y: y + stripH, width, height: height - stripH };
  }
}

function squarifyInner(
  items: { id: string; area: number }[],
  rect: TmRect,
  results: TmNode[],
): void {
  if (items.length === 0 || rect.width <= 0 || rect.height <= 0) return;

  const w = Math.min(rect.width, rect.height);
  let row: { id: string; area: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const newRow = [...row, items[i]];
    const rowAreas = row.map((r) => r.area);
    const newRowAreas = newRow.map((r) => r.area);

    if (row.length === 0 || worstAspect(rowAreas, w) >= worstAspect(newRowAreas, w)) {
      row = newRow;
    } else {
      // Adding this item makes aspect ratio worse — commit current row and recurse
      const remaining = placeRow(row, rect, results);
      squarifyInner(items.slice(i), remaining, results);
      return;
    }
  }

  // Commit the final row
  if (row.length > 0) {
    placeRow(row, rect, results);
  }
}

/**
 * Compute a squarified treemap layout.
 * @param items  Array of {id, value} — values must be positive.
 * @param rect   Bounding rectangle for the entire treemap.
 * @param gap    Pixel gap to inset each tile (half on each side).
 * @returns      Array of {id, rect} with absolute pixel positions.
 */
export function squarifiedTreemap(
  items: TmItem[],
  rect: TmRect,
  gap: number = 0,
): TmNode[] {
  if (items.length === 0 || rect.width <= 0 || rect.height <= 0) return [];

  const totalValue = items.reduce((s, i) => s + i.value, 0);
  if (totalValue <= 0) return [];

  const totalArea = rect.width * rect.height;
  const sorted = [...items].sort((a, b) => b.value - a.value);

  const withAreas = sorted.map((item) => ({
    id: item.id,
    area: (item.value / totalValue) * totalArea,
  }));

  const results: TmNode[] = [];
  squarifyInner(withAreas, rect, results);

  if (gap <= 0) return results;

  // Inset each tile by gap/2 on each side
  return results.map((node) => ({
    ...node,
    rect: {
      x: node.rect.x + gap / 2,
      y: node.rect.y + gap / 2,
      width: Math.max(0, node.rect.width - gap),
      height: Math.max(0, node.rect.height - gap),
    },
  }));
}
