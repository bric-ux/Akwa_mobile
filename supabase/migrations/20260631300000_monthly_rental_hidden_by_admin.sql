-- Masquage admin des annonces bail longue durée (front public).
-- L’hôte ne peut pas lever le flag ; seul un admin peut réafficher.

ALTER TABLE public.monthly_rental_listings
  ADD COLUMN IF NOT EXISTS hidden_by_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.monthly_rental_listings.hidden_by_admin IS
  'true = masqué du catalogue public par un admin ; status peut rester approved.';

CREATE INDEX IF NOT EXISTS idx_monthly_rental_listings_hidden_by_admin
  ON public.monthly_rental_listings (hidden_by_admin)
  WHERE hidden_by_admin = true;

CREATE OR REPLACE FUNCTION public.monthly_rental_listings_enforce_admin_hide()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Seuls les administrateurs peuvent modifier le masquage administratif'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_rental_listings_enforce_admin_hide
  ON public.monthly_rental_listings;
CREATE TRIGGER trg_monthly_rental_listings_enforce_admin_hide
  BEFORE UPDATE ON public.monthly_rental_listings
  FOR EACH ROW
  EXECUTE PROCEDURE public.monthly_rental_listings_enforce_admin_hide();

-- Lecture publique : exclure les annonces masquées par l’admin
DROP POLICY IF EXISTS mrl_public_approved ON public.monthly_rental_listings;
CREATE POLICY mrl_public_approved
  ON public.monthly_rental_listings
  FOR SELECT
  USING (
    status = 'approved'
    AND COALESCE(hidden_by_admin, false) = false
    AND (
      public.is_feature_enabled('monthly_rental')
      OR public.is_admin()
    )
  );

COMMENT ON POLICY mrl_public_approved ON public.monthly_rental_listings IS
  'Lecture publique si approved, non masqué admin, et flag monthly_rental ON (sinon admin).';
