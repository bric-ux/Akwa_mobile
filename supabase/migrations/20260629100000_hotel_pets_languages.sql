-- Infos hébergement hôtel : animaux + langues parlées
ALTER TABLE public.hotel_establishments
  ADD COLUMN IF NOT EXISTS pets_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spoken_languages text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.hotel_establishments.pets_allowed IS
  'Animaux de compagnie autorisés dans l’établissement';
COMMENT ON COLUMN public.hotel_establishments.spoken_languages IS
  'Langues parlées à la réception / par le personnel';
