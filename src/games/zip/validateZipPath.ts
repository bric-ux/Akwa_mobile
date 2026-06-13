import type { ZipCell, ZipPuzzle, ZipValidationResult } from './types';

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function isOrthogonalAdjacent(a: ZipCell, b: ZipCell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function getMaxNumber(puzzle: ZipPuzzle): number {
  return Math.max(...Object.values(puzzle.numbers), 0);
}

export function validateZipPath(puzzle: ZipPuzzle, path: ZipCell[]): ZipValidationResult {
  const totalCells = puzzle.rows * puzzle.cols;
  const maxNumber = getMaxNumber(puzzle);

  if (path.length === 0) {
    return { ok: false, reason: 'Commencez sur la case 1.' };
  }

  if (path.length !== totalCells) {
    return { ok: false, reason: 'Toutes les cases doivent être remplies.' };
  }

  const seen = new Set<string>();
  let expectedNumber = 1;

  for (let i = 0; i < path.length; i++) {
    const cell = path[i];
    const key = cellKey(cell.row, cell.col);

    if (cell.row < 0 || cell.col < 0 || cell.row >= puzzle.rows || cell.col >= puzzle.cols) {
      return { ok: false, reason: 'Parcours hors grille.' };
    }

    if (seen.has(key)) {
      return { ok: false, reason: 'Une case ne peut être visitée qu\'une seule fois.' };
    }
    seen.add(key);

    if (i > 0 && !isOrthogonalAdjacent(path[i - 1], cell)) {
      return { ok: false, reason: 'Le chemin doit rester continu (cases voisines).' };
    }

    const label = puzzle.numbers[key];
    if (label !== undefined) {
      if (label !== expectedNumber) {
        return { ok: false, reason: `Passez par les nombres dans l'ordre (${expectedNumber} attendu).` };
      }
      expectedNumber += 1;
    }
  }

  if (expectedNumber !== maxNumber + 1) {
    return { ok: false, reason: 'Tous les nombres n\'ont pas été visités dans l\'ordre.' };
  }

  const startKey = cellKey(path[0].row, path[0].col);
  const endKey = cellKey(path[path.length - 1].row, path[path.length - 1].col);
  if (puzzle.numbers[startKey] !== 1) {
    return { ok: false, reason: 'Le parcours doit commencer sur le 1.' };
  }
  if (puzzle.numbers[endKey] !== maxNumber) {
    return { ok: false, reason: `Le parcours doit se terminer sur le ${maxNumber}.` };
  }

  return { ok: true };
}
