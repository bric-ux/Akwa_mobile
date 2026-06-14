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

function buildFromPath(
  id: string,
  rows: number,
  cols: number,
  path: ZipCell[],
  numberCount: number,
  theme: string,
  subtitle: string,
  difficulty: ZipPuzzle['difficulty'],
): ZipPuzzle {
  const numbers: Record<string, number> = {};
  const lastIndex = path.length - 1;

  for (let n = 1; n <= numberCount; n++) {
    const t = (n - 1) / (numberCount - 1);
    const index = Math.round(t * lastIndex);
    const cell = path[index];
    numbers[`${cell.row},${cell.col}`] = n;
  }

  return { id, rows, cols, numbers, solutionPath: path, theme, subtitle, difficulty };
}

/** Banque de grilles thème Côte d'Ivoire / AkwaHome */
const PUZZLE_BUILDERS: (() => ZipPuzzle)[] = [
  () => buildFromPath('abidjan-5', 5, 5, serpentinePath(5, 5), 6, 'Abidjan', 'De la lagune au Plateau', 'easy'),
  () => buildFromPath('assinie-5', 5, 5, spiralPath(5, 5), 7, 'Assinie', 'Entre plage et cocotiers', 'easy'),
  () => buildFromPath('grand-bassam-5', 5, 5, serpentinePath(5, 5), 8, 'Grand-Bassam', 'Ville historique UNESCO', 'easy'),
  () => buildFromPath('yamoussoukro-5', 5, 5, spiralPath(5, 5), 8, 'Yamoussoukro', 'Capitale politique', 'medium'),
  () => buildFromPath('bouake-5', 5, 5, serpentinePath(5, 5), 9, 'Bouaké', 'Cœur du pays Baoulé', 'medium'),
  () => buildFromPath('san-pedro-5', 5, 5, spiralPath(5, 5), 9, 'San-Pédro', 'Port du sud-ouest', 'medium'),
  () => buildFromPath('man-5', 5, 5, serpentinePath(5, 5), 10, 'Man', 'Les montagnes de l\'ouest', 'medium'),
  () => buildFromPath('korhogo-6', 6, 6, serpentinePath(6, 6), 8, 'Korhogo', 'Porte du nord ivoirien', 'medium'),
  () => buildFromPath('cocody-6', 6, 6, spiralPath(6, 6), 9, 'Cocody', 'Quartier des ambassades', 'medium'),
  () => buildFromPath('marcory-6', 6, 6, serpentinePath(6, 6), 10, 'Marcory', 'Zone 4 et vie nocturne', 'hard'),
  () => buildFromPath('treichville-6', 6, 6, spiralPath(6, 6), 10, 'Treichville', 'Marché et culture', 'hard'),
  () => buildFromPath('bingerville-6', 6, 6, serpentinePath(6, 6), 11, 'Bingerville', 'Ville jardin', 'hard'),
  () => buildFromPath('daloa-6', 6, 6, spiralPath(6, 6), 11, 'Daloa', 'Capitale du Haut-Sassandra', 'hard'),
  () => buildFromPath('akwa-7', 7, 7, serpentinePath(7, 7), 10, 'AkwaHome', 'Le défi du week-end', 'hard'),
];

export function getPuzzlePoolSize(): number {
  return PUZZLE_BUILDERS.length;
}

export function getPuzzleByIndex(index: number): ZipPuzzle {
  const safeIndex = ((index % PUZZLE_BUILDERS.length) + PUZZLE_BUILDERS.length) % PUZZLE_BUILDERS.length;
  return PUZZLE_BUILDERS[safeIndex]();
}

/** Date locale Abidjan YYYY-MM-DD */
export function getLocalDateKey(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Abidjan' });
}

/** Index du jour : lun=0 … dim=6 pour la difficulté progressive */
export function getWeekdayIndex(date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Abidjan',
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekday] ?? 0;
}

export function getDailyPuzzle(date = new Date()): ZipPuzzle {
  const dateKey = getLocalDateKey(date);
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }

  const weekday = getWeekdayIndex(date);
  const difficultyBoost = weekday >= 5 ? 2 : weekday >= 3 ? 1 : 0;
  const index = (hash + weekday + difficultyBoost) % PUZZLE_BUILDERS.length;
  const puzzle = getPuzzleByIndex(index);
  return { ...puzzle, id: `${dateKey}-${puzzle.id}` };
}

export function getDailyPuzzleId(date = new Date()): string {
  return getDailyPuzzle(date).id;
}
