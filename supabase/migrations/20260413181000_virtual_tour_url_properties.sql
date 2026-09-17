-- Visite virtuelle (Matterport, Kuula, etc.) sur les annonces
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS virtual_tour_url TEXT NULL;

COMMENT ON COLUMN public.properties.virtual_tour_url IS
  'URL HTTPS publique de visite virtuelle (Matterport, Kuula, etc.)';
