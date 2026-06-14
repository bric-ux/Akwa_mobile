import type { ZipCell, ZipPuzzle } from './types';
import { cellKey } from './validateZipPath';

export const MAX_ZIP_HINTS = 3;

export function getSolutionPrefixLength(puzzle: ZipPuzzle, path: ZipCell[]): number {
  const limit = Math.min(path.length, puzzle.solutionPath.length);
  let i = 0;
  while (i < limit) {
    const a = path[i];
    const b = puzzle.solutionPath[i];
    if (a.row !== b.row || a.col !== b.col) break;
    i += 1;
  }
  return i;
}

export function getHint(
  puzzle: ZipPuzzle,
  path: ZipCell[],
  hintsUsed: number,
): { message: string; highlightCell: ZipCell } | null {
  if (hintsUsed >= MAX_ZIP_HINTS) return null;

  const prefixLen = getSolutionPrefixLength(puzzle, path);
  const nextCell = puzzle.solutionPath[prefixLen] ?? puzzle.solutionPath[0];
  const nextLabel = puzzle.numbers[cellKey(nextCell.row, nextCell.col)];

  const hints: { message: string; highlightCell: ZipCell }[] = [
    {
      message: 'Glissez sans relâcher : le chemin doit rester continu, case par case.',
      highlightCell: nextCell,
    },
    {
      message:
        prefixLen === 0
          ? 'Placez-vous sur la case 1 pour démarrer le parcours.'
          : `Prochaine étape : case en surbrillance${nextLabel ? ` (chiffre ${nextLabel})` : ''}.`,
      highlightCell: nextCell,
    },
    {
      message: nextLabel
        ? `Direction suggérée : rejoignez le chiffre ${nextLabel} sur la case indiquée.`
        : 'Suivez la case en surbrillance pour avancer vers la solution.',
      highlightCell: nextCell,
    },
  ];

  return hints[Math.min(hintsUsed, hints.length - 1)];
}
