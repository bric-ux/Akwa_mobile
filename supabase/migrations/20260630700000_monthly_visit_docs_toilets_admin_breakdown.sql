-- Bail longue durée : toilettes, docs complémentaires, visite
-- Messagerie monthly + admin support RLS
-- Admin : ventilation réservations par statut / service

-- 1) Toilettes sur annonces bail
ALTER TABLE public.monthly_rental_listings
  ADD COLUMN IF NOT EXISTS toilets integer;

COMMENT ON COLUMN public.monthly_rental_listings.toilets IS
  'Nombre de toilettes (WC), distinct des salles de bain';

-- 2) Candidatures : visite autorisée + docs demandés
ALTER TABLE public.monthly_rental_candidatures
  DROP CONSTRAINT IF EXISTS monthly_rental_candidatures_status_check;

ALTER TABLE public.monthly_rental_candidatures
  ADD CONSTRAINT monthly_rental_candidatures_status_check
  CHECK (status IN (
    'sent',
    'viewed',
    'accepted',
    'rejected',
    'visit_authorized',
    'docs_requested'
  ));

ALTER TABLE public.monthly_rental_candidatures
  ADD COLUMN IF NOT EXISTS requested_documents text[] DEFAULT '{}'::text[];

ALTER TABLE public.monthly_rental_candidatures
  ADD COLUMN IF NOT EXISTS visit_authorized_at timestamptz;

ALTER TABLE public.monthly_rental_candidatures
  ADD COLUMN IF NOT EXISTS docs_requested_at timestamptz;

COMMENT ON COLUMN public.monthly_rental_candidatures.requested_documents IS
  'Types de documents complémentaires demandés par le propriétaire';

-- 3) RLS messagerie bail longue durée
DROP POLICY IF EXISTS "Users can create monthly listing conversations" ON public.conversations;
CREATE POLICY "Users can create monthly listing conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    monthly_rental_listing_id IS NOT NULL
    AND (auth.uid() = guest_id OR auth.uid() = host_id)
    AND EXISTS (
      SELECT 1 FROM public.monthly_rental_listings m
      WHERE m.id = monthly_rental_listing_id
        AND (m.owner_id = auth.uid() OR auth.uid() = guest_id OR auth.uid() = host_id)
    )
  );

-- Guests can read their admin_support threads
DROP POLICY IF EXISTS "Guests can view own admin support conversations" ON public.conversations;
CREATE POLICY "Guests can view own admin support conversations"
  ON public.conversations
  FOR SELECT
  USING (kind = 'admin_support' AND auth.uid() = guest_id);

DROP POLICY IF EXISTS "Guests can read own admin support messages" ON public.conversation_messages;
CREATE POLICY "Guests can read own admin support messages"
  ON public.conversation_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.kind = 'admin_support'
        AND c.guest_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Guests can send admin support messages" ON public.conversation_messages;
CREATE POLICY "Guests can send admin support messages"
  ON public.conversation_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.kind = 'admin_support'
        AND c.guest_id = auth.uid()
    )
  );

-- 4) RPC admin : ventilation résas par statut × service
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
      'in_progress', (SELECT count(*)::int FROM vehicle_bookings WHERE status = 'in_progress'),
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
