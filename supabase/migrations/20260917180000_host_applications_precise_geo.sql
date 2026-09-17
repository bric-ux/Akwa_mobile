-- Coords précises saisies à la candidature hôte (GPS / pin carte)
ALTER TABLE public.host_applications
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.host_applications.latitude IS
  'Latitude précise du bien (GPS ou pin), prioritaire sur le centroïde locations';
COMMENT ON COLUMN public.host_applications.longitude IS
  'Longitude précise du bien (GPS ou pin), prioritaire sur le centroïde locations';
COMMENT ON COLUMN public.host_applications.location_id IS
  'Lien optionnel vers locations (quartier/commune/ville) détecté ou choisi';

CREATE INDEX IF NOT EXISTS idx_host_applications_location_id
  ON public.host_applications(location_id)
  WHERE location_id IS NOT NULL;
