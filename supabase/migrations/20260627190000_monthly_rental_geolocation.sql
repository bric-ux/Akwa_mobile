-- Position précise pour annonces location longue durée (comme properties)
ALTER TABLE public.monthly_rental_listings
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS idx_monthly_rental_listings_coords
  ON public.monthly_rental_listings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN public.monthly_rental_listings.latitude IS 'Latitude du pin (géolocalisation précise)';
COMMENT ON COLUMN public.monthly_rental_listings.longitude IS 'Longitude du pin (géolocalisation précise)';
