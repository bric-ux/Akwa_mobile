-- Fix conversations check that blocks admin_support / monthly threads
-- Recreate admin_booking_status_breakdown (stats admin)

-- 1) Contrainte trop stricte : property_id OR vehicle_id obligatoires
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS check_property_or_vehicle;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS check_conversation_target;

-- Autorise : bien | véhicule | bail | support admin
ALTER TABLE public.conversations
  ADD CONSTRAINT check_conversation_target
  CHECK (
    kind = 'admin_support'
    OR property_id IS NOT NULL
    OR vehicle_id IS NOT NULL
    OR monthly_rental_listing_id IS NOT NULL
  );

-- 2) RPC stats (inclut pending)
CREATE OR REPLACE FUNCTION public.admin_booking_status_breakdown()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'residences', jsonb_build_object(
      'pending', (SELECT count(*)::int FROM bookings WHERE status = 'pending'),
      'confirmed', (SELECT count(*)::int FROM bookings WHERE status = 'confirmed'),
      'in_progress', (
        SELECT count(*)::int FROM bookings
        WHERE status = 'confirmed'
          AND check_in_date <= CURRENT_DATE
          AND check_out_date > CURRENT_DATE
      ),
      'cancelled', (SELECT count(*)::int FROM bookings WHERE status = 'cancelled'),
      'completed', (SELECT count(*)::int FROM bookings WHERE status = 'completed')
    ),
    'vehicles', jsonb_build_object(
      'pending', (SELECT count(*)::int FROM vehicle_bookings WHERE status = 'pending'),
      'confirmed', (SELECT count(*)::int FROM vehicle_bookings WHERE status = 'confirmed'),
      'in_progress', (
        SELECT count(*)::int FROM vehicle_bookings
        WHERE status = 'confirmed'
          AND start_date <= CURRENT_DATE
          AND end_date >= CURRENT_DATE
      ),
      'cancelled', (SELECT count(*)::int FROM vehicle_bookings WHERE status = 'cancelled'),
      'completed', (SELECT count(*)::int FROM vehicle_bookings WHERE status = 'completed')
    ),
    'hotels', jsonb_build_object(
      'pending', (SELECT count(*)::int FROM hotel_bookings WHERE status = 'pending'),
      'confirmed', (SELECT count(*)::int FROM hotel_bookings WHERE status = 'confirmed'),
      'in_progress', (
        SELECT count(*)::int FROM hotel_bookings
        WHERE status = 'confirmed'
          AND check_in_date <= CURRENT_DATE
          AND check_out_date > CURRENT_DATE
      ),
      'cancelled', (SELECT count(*)::int FROM hotel_bookings WHERE status = 'cancelled'),
      'completed', (SELECT count(*)::int FROM hotel_bookings WHERE status = 'completed')
    ),
    'monthly', jsonb_build_object(
      'pending', (
        SELECT count(*)::int FROM monthly_rental_candidatures
        WHERE status IN ('sent', 'viewed', 'docs_requested')
      ),
      'visit_authorized', (
        SELECT count(*)::int FROM monthly_rental_candidatures WHERE status = 'visit_authorized'
      ),
      'accepted', (SELECT count(*)::int FROM monthly_rental_candidatures WHERE status = 'accepted'),
      'rejected', (SELECT count(*)::int FROM monthly_rental_candidatures WHERE status = 'rejected')
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_booking_status_breakdown() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_booking_status_breakdown() TO authenticated;
