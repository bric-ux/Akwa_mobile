import type { ZipCell, ZipPuzzle } from './types';

function serpentinePath(rows: number, cols: number): ZipCell[] {
  const path: ZipCell[] = [];
  for (let row = 0; row < rows; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < cols; col++) path.push({ row, col });
    } else {
      for (let col = cols - 1; col >= 0; col--) path.push({ row, col });
    }
  }
  return path;
}

function spiralPath(rows: number, cols: number): ZipCell[] {
  const path: ZipCell[] = [];
  let top = 0;
  let bottom = rows - 1;
  let left = 0;
  let right = cols - 1;

  while (top <= bottom && left <= right) {
    for (let col = left; col <= right; col++) path.push({ row: top, col });
    top += 1;
    for (let row = top; row <= bottom; row++) path.push({ row, col: right });
    right -= 1;
    if (top <= bottom) {
      for (let col = right; col >= left; col--) path.push({ row: bottom, col });
      bottom -= 1;
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row--) path.push({ row, col: left });
      left += 1;
    }
  }
  return path;
}

function buildDemo(
  id: string,
  rows: number,
  cols: number,
  path: ZipCell[],
  numberCount: number,
): ZipPuzzle {
  const numbers: Record<string, number> = {};
  const lastIndex = path.length - 1;

  for (let n = 1; n <= numberCount; n++) {
    const t = (n - 1) / (numberCount - 1);
    const index = Math.round(t * lastIndex);
    const cell = path[index];
    numbers[`${cell.row},${cell.col}`] = n;
  }

  return {
    id,
    rows,
    cols,
    numbers,
    solutionPath: path,
    theme: 'Exemple',
    subtitle: '',
    difficulty: 'easy',
  };
}

export type ZipDemoGrid = {
  puzzle: ZipPuzzle;
  caption: string;
};

/** Deux mini-grilles complétées pour illustrer le principe du Zip. */
export const ZIP_DEMO_GRIDS: ZipDemoGrid[] = [
  {
    puzzle: buildDemo('demo-serpentine-3', 3, 3, serpentinePath(3, 3), 4),
    caption: 'Ligne par ligne',
  },
  {
    puzzle: buildDemo('demo-spiral-3', 3, 3, spiralPath(3, 3), 4),
    caption: 'En spiral',
  },
];
