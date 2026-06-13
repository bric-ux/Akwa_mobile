-- Défi Zip quotidien AkwaHome : classement par temps de résolution

CREATE TABLE IF NOT EXISTS public.zip_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_date date NOT NULL,
  puzzle_id text NOT NULL,
  time_ms integer NOT NULL CHECK (time_ms > 0),
  moves integer CHECK (moves IS NULL OR moves > 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zip_game_results_user_date_unique UNIQUE (user_id, puzzle_date)
);

CREATE INDEX IF NOT EXISTS idx_zip_game_results_puzzle_date_time
  ON public.zip_game_results (puzzle_date, time_ms ASC);

ALTER TABLE public.zip_game_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zip_game_results_select_all ON public.zip_game_results;
CREATE POLICY zip_game_results_select_all
  ON public.zip_game_results
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS zip_game_results_insert_own ON public.zip_game_results;
CREATE POLICY zip_game_results_insert_own
  ON public.zip_game_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS zip_game_results_update_own ON public.zip_game_results;
CREATE POLICY zip_game_results_update_own
  ON public.zip_game_results
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.zip_game_results IS 'Scores du défi Zip quotidien (temps de résolution, classement).';
