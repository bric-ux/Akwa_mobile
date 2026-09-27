-- Agrégats dashboard admin en 1 round-trip (évite de scanner bookings/reviews côté client).
CREATE OR REPLACE FUNCTION public.admin_dashboard_overview()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT count(*)::int FROM public.profiles),
    'total_properties', (SELECT count(*)::int FROM public.properties),
    'total_bookings', (SELECT count(*)::int FROM public.bookings),
    'total_revenue', (
      SELECT coalesce(sum(total_price), 0)::bigint
      FROM public.bookings
      WHERE status = 'confirmed'
    ),
    'average_rating', (
      SELECT coalesce(round(avg(rating)::numeric, 1), 0)
      FROM public.reviews
    ),
    'pending_applications', (
      SELECT count(*)::int
      FROM public.host_applications
      WHERE status = 'pending'
    ),
    'zip_unique_players', (
      SELECT coalesce(public.count_zip_unique_players(), 0)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview() TO authenticated;

COMMENT ON FUNCTION public.admin_dashboard_overview() IS
  'Métriques légères du tableau de bord admin (counts + revenus + note + zip).';
