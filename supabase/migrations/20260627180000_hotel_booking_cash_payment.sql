-- Suivi paiement espèces à l'arrivée pour réservations hôtel
ALTER TABLE public.hotel_bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'waived')),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.hotel_bookings.payment_status IS
  'unpaid | paid | refunded | waived — pour cash à l''arrivée, paid quand l''hôtel encaisse';
COMMENT ON COLUMN public.hotel_bookings.paid_at IS
  'Horodatage de l''encaissement (espèces à l''arrivée ou autre)';
COMMENT ON COLUMN public.hotel_bookings.paid_by IS
  'Utilisateur (souvent le gérant) qui a marqué le paiement comme reçu';

CREATE INDEX IF NOT EXISTS idx_hotel_bookings_payment_status
  ON public.hotel_bookings(payment_status);
