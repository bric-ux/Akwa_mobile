-- Mois de caution et mois d’avance pour les annonces bail longue durée
ALTER TABLE public.monthly_rental_listings
  ADD COLUMN IF NOT EXISTS deposit_months integer,
  ADD COLUMN IF NOT EXISTS advance_months integer;

ALTER TABLE public.monthly_rental_listings
  DROP CONSTRAINT IF EXISTS monthly_rental_listings_deposit_months_check;

ALTER TABLE public.monthly_rental_listings
  ADD CONSTRAINT monthly_rental_listings_deposit_months_check
  CHECK (deposit_months IS NULL OR (deposit_months >= 0 AND deposit_months <= 24));

ALTER TABLE public.monthly_rental_listings
  DROP CONSTRAINT IF EXISTS monthly_rental_listings_advance_months_check;

ALTER TABLE public.monthly_rental_listings
  ADD CONSTRAINT monthly_rental_listings_advance_months_check
  CHECK (advance_months IS NULL OR (advance_months >= 0 AND advance_months <= 24));

COMMENT ON COLUMN public.monthly_rental_listings.deposit_months IS
  'Nombre de mois de caution exigés (ex. 2 = 2 mois de loyer).';
COMMENT ON COLUMN public.monthly_rental_listings.advance_months IS
  'Nombre de mois d’avance de loyer exigés à l’entrée.';
