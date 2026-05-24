-- Exposer les propriétaires de véhicules dans host_public_info (lecture publique anon)

CREATE OR REPLACE FUNCTION public.sync_host_public_info_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_user_id
      AND (
        p.is_host = true
        OR EXISTS (
          SELECT 1
          FROM public.vehicles v
          WHERE v.owner_id = p.user_id
            AND v.is_active = true
            AND v.is_approved = true
        )
      )
  ) THEN
    INSERT INTO public.host_public_info (
      user_id, first_name, last_name, avatar_url, bio, city, country
    )
    SELECT
      p.user_id, p.first_name, p.last_name, p.avatar_url, p.bio, p.city, p.country
    FROM public.profiles p
    WHERE p.user_id = p_user_id
    ON CONFLICT (user_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      avatar_url = EXCLUDED.avatar_url,
      bio = EXCLUDED.bio,
      city = EXCLUDED.city,
      country = EXCLUDED.country,
      updated_at = now();
  ELSE
    DELETE FROM public.host_public_info WHERE user_id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_host_public_info()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_host_public_info_for_user(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_host_public_info_from_vehicle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner uuid;
BEGIN
  owner := COALESCE(NEW.owner_id, OLD.owner_id);
  IF owner IS NOT NULL THEN
    PERFORM public.sync_host_public_info_for_user(owner);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_host_public_info_from_vehicle_trigger ON public.vehicles;

CREATE TRIGGER sync_host_public_info_from_vehicle_trigger
  AFTER INSERT OR UPDATE OF owner_id, is_active, is_approved OR DELETE
  ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_host_public_info_from_vehicle();

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT v.owner_id AS user_id
    FROM public.vehicles v
    WHERE v.is_active = true
      AND v.is_approved = true
      AND v.owner_id IS NOT NULL
  LOOP
    PERFORM public.sync_host_public_info_for_user(r.user_id);
  END LOOP;
END;
$$;
