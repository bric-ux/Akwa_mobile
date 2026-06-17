-- Autoriser booking_type = 'hotel' dans les brouillons Stripe (paiement carte avant résa)

ALTER TABLE public.stripe_checkout_drafts
  DROP CONSTRAINT IF EXISTS stripe_checkout_drafts_booking_type_check;

ALTER TABLE public.stripe_checkout_drafts
  ADD CONSTRAINT stripe_checkout_drafts_booking_type_check
  CHECK (booking_type IN ('property', 'vehicle', 'hotel'));

COMMENT ON COLUMN public.stripe_checkout_drafts.booking_type IS
  'Type de réservation: property, vehicle ou hotel';
