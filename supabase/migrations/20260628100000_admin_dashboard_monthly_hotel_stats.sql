-- Stats admin : demandes de visite (bail longue durée) + hôtels
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
    ),
    -- Bail longue durée : demandes de visite
    'monthly_visit_requests_total', (
      SELECT count(*)::int FROM public.monthly_rental_candidatures
    ),
    'monthly_visit_requests_accepted', (
      SELECT count(*)::int
      FROM public.monthly_rental_candidatures
      WHERE status = 'accepted'
    ),
    'monthly_visit_requests_rejected', (
      SELECT count(*)::int
      FROM public.monthly_rental_candidatures
      WHERE status = 'rejected'
    ),
    'monthly_visit_requests_pending', (
      SELECT count(*)::int
      FROM public.monthly_rental_candidatures
      WHERE status IN ('sent', 'viewed')
    ),
    -- Hôtels
    'hotel_establishments_total', (
      SELECT count(*)::int FROM public.hotel_establishments
    ),
    'hotel_establishments_active', (
      SELECT count(*)::int
      FROM public.hotel_establishments
      WHERE status = 'active'
        AND coalesce(hidden_by_admin, false) = false
    ),
    'hotel_bookings_total', (
      SELECT count(*)::int FROM public.hotel_bookings
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview() TO authenticated;

COMMENT ON FUNCTION public.admin_dashboard_overview() IS
  'Métriques dashboard admin : counts, revenus, visite bail longue durée, hôtels.';
