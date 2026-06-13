export type ZipCell = { row: number; col: number };

export type ZipPuzzle = {
  id: string;
  rows: number;
  cols: number;
  /** Clé "row,col" → numéro à visiter dans l'ordre */
  numbers: Record<string, number>;
  theme: string;
  subtitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

export type ZipValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type ZipLeaderboardEntry = {
  user_id: string;
  time_ms: number;
  completed_at: string;
  display_name: string;
  rank: number;
};
