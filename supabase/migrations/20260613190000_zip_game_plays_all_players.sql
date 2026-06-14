-- Suivi de toutes les parties Zip (connectés + visiteurs anonymes) pour les stats admin

CREATE TABLE IF NOT EXISTS public.zip_game_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id uuid,
  puzzle_date date NOT NULL,
  puzzle_id text NOT NULL,
  time_ms integer NOT NULL CHECK (time_ms > 0),
  moves integer CHECK (moves IS NULL OR moves > 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zip_game_plays_player_date_unique UNIQUE (player_key, puzzle_date),
  CONSTRAINT zip_game_plays_player_identity CHECK (
    (user_id IS NOT NULL AND anonymous_id IS NULL)
    OR (user_id IS NULL AND anonymous_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_zip_game_plays_player_key
  ON public.zip_game_plays (player_key);

ALTER TABLE public.zip_game_plays ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.zip_game_plays IS
  'Toutes les parties Zip terminées (joueurs connectés et visiteurs anonymes).';

-- Reprise des scores déjà enregistrés (joueurs connectés)
INSERT INTO public.zip_game_plays (
  player_key,
  user_id,
  puzzle_date,
  puzzle_id,
  time_ms,
  moves,
  completed_at
)
SELECT
  user_id::text,
  user_id,
  puzzle_date,
  puzzle_id,
  time_ms,
  moves,
  completed_at
FROM public.zip_game_results
ON CONFLICT (player_key, puzzle_date) DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_zip_game_play(
  p_puzzle_date date,
  p_puzzle_id text,
  p_time_ms integer,
  p_moves integer DEFAULT NULL,
  p_anonymous_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_player_key text;
BEGIN
  IF p_time_ms IS NULL OR p_time_ms <= 0 THEN
    RAISE EXCEPTION 'time_ms invalide';
  END IF;

  IF v_user_id IS NOT NULL THEN
    v_player_key := v_user_id::text;
  ELSIF p_anonymous_id IS NOT NULL THEN
    v_player_key := p_anonymous_id::text;
  ELSE
    RAISE EXCEPTION 'anonymous_id requis pour les visiteurs non connectés';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.zip_game_plays
    WHERE player_key = v_player_key
      AND puzzle_date = p_puzzle_date
  ) THEN
    RETURN 'already_played';
  END IF;

  INSERT INTO public.zip_game_plays (
    player_key,
    user_id,
    anonymous_id,
    puzzle_date,
    puzzle_id,
    time_ms,
    moves
  )
  VALUES (
    v_player_key,
    v_user_id,
    CASE WHEN v_user_id IS NULL THEN p_anonymous_id ELSE NULL END,
    p_puzzle_date,
    p_puzzle_id,
    p_time_ms,
    p_moves
  );

  RETURN 'saved';
END;
$$;

REVOKE ALL ON FUNCTION public.record_zip_game_play(date, text, integer, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_zip_game_play(date, text, integer, integer, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.record_zip_game_play(date, text, integer, integer, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_zip_game_play IS
  'Enregistre une partie Zip terminée (connecté ou visiteur anonyme).';

CREATE OR REPLACE FUNCTION public.count_zip_unique_players()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN (
    SELECT COUNT(DISTINCT player_key)::bigint
    FROM public.zip_game_plays
  );
END;
$$;

COMMENT ON FUNCTION public.count_zip_unique_players IS
  'Nombre de joueurs distincts ayant terminé au moins une partie Zip (connectés + anonymes, admin uniquement).';
