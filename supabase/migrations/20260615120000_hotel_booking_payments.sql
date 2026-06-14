-- Réservations hôtel : paiements + champs checkout (aligné sur public.bookings)

ALTER TABLE public.hotel_establishments
  ADD COLUMN IF NOT EXISTS auto_booking boolean NOT NULL DEFAULT false;

ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS payment_plan text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_token text;

CREATE INDEX IF NOT EXISTS idx_hotel_bookings_stripe_checkout_token
  ON public.hotel_bookings(stripe_checkout_token)
  WHERE stripe_checkout_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.hotel_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.hotel_bookings(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'XOF',
  payment_method text,
  payment_provider text,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payment_intent_id text,
  external_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotel_payments_booking_id
  ON public.hotel_payments(booking_id);

ALTER TABLE public.hotel_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_payments_guest_read ON public.hotel_payments;
CREATE POLICY hotel_payments_guest_read ON public.hotel_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hotel_bookings hb
      WHERE hb.id = hotel_payments.booking_id AND hb.guest_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS hotel_payments_host_read ON public.hotel_payments;
CREATE POLICY hotel_payments_host_read ON public.hotel_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.hotel_bookings hb
      INNER JOIN public.hotel_establishments e ON e.id = hb.establishment_id
      WHERE hb.id = hotel_payments.booking_id AND e.host_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS hotel_payments_admin_all ON public.hotel_payments;
CREATE POLICY hotel_payments_admin_all ON public.hotel_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS hotel_payments_service_role ON public.hotel_payments;
CREATE POLICY hotel_payments_service_role ON public.hotel_payments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Wave : lecture des complétions pour réservations hôtel
DROP POLICY IF EXISTS "Participants can read their wave payment completions" ON wave_payment_completions;
CREATE POLICY "Participants can read their wave payment completions"
ON wave_payment_completions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = reference_id::uuid AND b.guest_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM vehicle_bookings vb WHERE vb.id = reference_id::uuid AND vb.renter_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM hotel_bookings hb WHERE hb.id = reference_id::uuid AND hb.guest_id = auth.uid()
  )
);

COMMENT ON TABLE public.hotel_payments IS
  'Paiements des réservations hôtel (carte, Wave). Espèces : pas de ligne obligatoire.';
