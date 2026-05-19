-- Connexion par téléphone : comptes créés par email (Gmail, etc.) avec numéro renseigné au profil
CREATE OR REPLACE FUNCTION public.resolve_phone_to_email(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_phone_norm TEXT;
BEGIN
  v_phone_norm := regexp_replace(COALESCE(p_phone, ''), '\s+', '', 'g');
  IF v_phone_norm IS NULL OR v_phone_norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT p.user_id INTO v_user_id
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE (
    p.phone_e164 = v_phone_norm
    OR regexp_replace(COALESCE(p.phone, ''), '\s+', '', 'g') = v_phone_norm
  )
  AND (
    COALESCE(p.phone_verified, false) = true
    OR (
      u.email IS NOT NULL
      AND lower(u.email) NOT LIKE '%@phone.akwahome.local'
    )
  )
  ORDER BY COALESCE(p.phone_verified, false) DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  RETURN v_email;
END;
$$;

COMMENT ON FUNCTION public.resolve_phone_to_email(TEXT) IS
  'Résout un numéro E.164 vers l''email auth : comptes téléphone (vérifiés) ou comptes email avec numéro au profil.';
