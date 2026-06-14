import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getLocalDateKey } from '../games/zip/puzzles';
import type { ZipLeaderboardEntry } from '../games/zip/types';
import { getOrCreateZipAnonymousId } from '../utils/zipPlayerId';

type ZipPlayResult = 'saved' | 'already_played' | 'error';

type MyResult = {
  time_ms: number;
  rank: number | null;
  completed_at: string;
};

export function useZipGame(puzzleDate = getLocalDateKey()) {
  const [leaderboard, setLeaderboard] = useState<ZipLeaderboardEntry[]>([]);
  const [myResult, setMyResult] = useState<MyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: fetchError } = await supabase
        .from('zip_game_results')
        .select('user_id, time_ms, completed_at')
        .eq('puzzle_date', puzzleDate)
        .order('time_ms', { ascending: true })
        .limit(100);

      if (fetchError) throw fetchError;

      const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
      let profileMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        profileMap = new Map(
          (profiles ?? []).map((p) => [
            p.user_id,
            `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Joueur',
          ]),
        );
      }

      const ranked: ZipLeaderboardEntry[] = (rows ?? []).map((row, index) => ({
        user_id: row.user_id,
        time_ms: row.time_ms,
        completed_at: row.completed_at,
        display_name: profileMap.get(row.user_id) || 'Joueur',
        rank: index + 1,
      }));

      setLeaderboard(ranked);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (uid) {
        const mine = ranked.find((e) => e.user_id === uid);
        if (mine) {
          setMyResult({
            time_ms: mine.time_ms,
            rank: mine.rank,
            completed_at: mine.completed_at,
          });
        } else {
          setMyResult(null);
        }
      }
    } catch (err: any) {
      console.error('[useZipGame] load error', err);
      setError(err?.message || 'Impossible de charger le classement');
    } finally {
      setLoading(false);
    }
  }, [puzzleDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const recordPlay = useCallback(
    async (params: { puzzleId: string; timeMs: number; moves: number }): Promise<ZipPlayResult> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id ?? null;

        const timeMs = Math.max(1, Math.round(params.timeMs));
        const moves = Math.max(1, Math.round(params.moves));
        const anonymousId = uid ? null : await getOrCreateZipAnonymousId();

        const { data, error } = await supabase.rpc('record_zip_game_play', {
          p_puzzle_date: puzzleDate,
          p_puzzle_id: params.puzzleId,
          p_time_ms: timeMs,
          p_moves: moves,
          p_anonymous_id: anonymousId,
        });

        if (error) {
          console.error('[useZipGame] recordPlay RPC error', error.message, error);
          throw error;
        }
        return data === 'already_played' ? 'already_played' : 'saved';
      } catch (err: any) {
        console.error('[useZipGame] recordPlay error', err);
        return 'error';
      }
    },
    [puzzleDate],
  );

  const submitResult = useCallback(
    async (params: { puzzleId: string; timeMs: number; moves: number }) => {
      setSubmitting(true);
      setError(null);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) {
          throw new Error('Connectez-vous pour enregistrer votre score.');
        }

        const timeMs = Math.max(1, Math.round(params.timeMs));

        const { data: existing, error: existingError } = await supabase
          .from('zip_game_results')
          .select('time_ms')
          .eq('user_id', auth.user.id)
          .eq('puzzle_date', puzzleDate)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing) {
          await load();
          return 'already_played';
        }

        const payload = {
          user_id: auth.user.id,
          puzzle_date: puzzleDate,
          puzzle_id: params.puzzleId,
          time_ms: timeMs,
          moves: params.moves,
          completed_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('zip_game_results')
          .upsert(payload, { onConflict: 'user_id,puzzle_date' });

        if (upsertError) throw upsertError;

        await recordPlay(params);
        await load();
        return 'saved';
      } catch (err: any) {
        console.error('[useZipGame] submit error', err);
        setError(err?.message || 'Impossible d\'enregistrer le score');
        return 'error';
      } finally {
        setSubmitting(false);
      }
    },
    [load, puzzleDate, recordPlay],
  );

  return {
    puzzleDate,
    leaderboard,
    myResult,
    alreadyPlayedToday: myResult != null,
    loading,
    submitting,
    error,
    reload: load,
    recordPlay,
    submitResult,
  };
}

export function formatZipTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((ms % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
  }
  return `${seconds}.${String(millis).padStart(2, '0')} s`;
}
