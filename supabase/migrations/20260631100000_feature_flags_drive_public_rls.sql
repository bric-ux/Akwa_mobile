-- Visibilité produits : les flags platform_feature_flags pilotent aussi le RLS.
-- Vert (enabled) → lecture publique des annonces approuvées / hôtels actifs.
-- Rouge → admins seulement (tests internes).

CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.platform_feature_flags WHERE key = p_key LIMIT 1),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_feature_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(text) TO anon, authenticated;

COMMENT ON FUNCTION public.is_feature_enabled(text) IS
  'Lit platform_feature_flags.enabled (SECURITY DEFINER). Utilisé par les policies RLS hôtel / bail.';

-- ── Bail longue durée ────────────────────────────────────────────────
DROP POLICY IF EXISTS mrl_public_approved ON public.monthly_rental_listings;
CREATE POLICY mrl_public_approved
  ON public.monthly_rental_listings
  FOR SELECT
  USING (
    status = 'approved'
    AND (
      public.is_feature_enabled('monthly_rental')
      OR public.is_admin()
    )
  );

COMMENT ON POLICY mrl_public_approved ON public.monthly_rental_listings IS
  'Lecture publique si flag monthly_rental ON ; sinon admin seulement.';

-- ── Hôtels ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS hotel_establishments_public_read ON public.hotel_establishments;
CREATE POLICY hotel_establishments_public_read
  ON public.hotel_establishments
  FOR SELECT
  USING (
    status = 'active'
    AND COALESCE(hidden_by_admin, false) = false
    AND (
      public.is_feature_enabled('hotel')
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS hotel_room_types_public_read ON public.hotel_room_types;
CREATE POLICY hotel_room_types_public_read
  ON public.hotel_room_types
  FOR SELECT
  USING (
    status = 'active'
    AND (
      public.is_feature_enabled('hotel')
      OR public.is_admin()
    )
    AND EXISTS (
      SELECT 1 FROM public.hotel_establishments e
      WHERE e.id = hotel_room_types.establishment_id
        AND e.status = 'active'
        AND COALESCE(e.hidden_by_admin, false) = false
    )
  );

DROP POLICY IF EXISTS hotel_photos_public_read ON public.hotel_establishment_photos;
CREATE POLICY hotel_photos_public_read
  ON public.hotel_establishment_photos
  FOR SELECT
  USING (
    (
      public.is_feature_enabled('hotel')
      OR public.is_admin()
    )
    AND EXISTS (
      SELECT 1 FROM public.hotel_establishments e
      WHERE e.id = hotel_establishment_photos.establishment_id
        AND e.status = 'active'
        AND COALESCE(e.hidden_by_admin, false) = false
    )
  );
