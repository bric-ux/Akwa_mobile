-- Stat admin : nombre de joueurs uniques au défi Zip

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
    SELECT COUNT(DISTINCT user_id)::bigint
    FROM public.zip_game_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.count_zip_unique_players() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_zip_unique_players() TO authenticated;

COMMENT ON FUNCTION public.count_zip_unique_players IS
  'Nombre de joueurs distincts ayant enregistré au moins un score Zip (admin uniquement).';
