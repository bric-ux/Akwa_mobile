-- Normalisation CI : conserver le 0 après +225 (ex. +2250712345678 pour Twilio)
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v TEXT;
  v_national TEXT;
BEGIN
  v := regexp_replace(COALESCE(p_phone, ''), '\s+', '', 'g');
  IF v IS NULL OR v = '' THEN
    RETURN NULL;
  END IF;

  IF v ~ '^\+225\d+$' THEN
    v_national := substring(v from 5);
    IF length(v_national) = 10 AND v_national LIKE '0%' THEN
      RETURN '+225' || v_national;
    ELSIF length(v_national) = 9 THEN
      RETURN '+2250' || v_national;
    END IF;
    RETURN NULL;
  END IF;

  IF v ~ '^\+\d{8,15}$' THEN
    RETURN v;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.normalize_phone_e164(TEXT) IS
  'E.164 avec règle CI : +225 suivi de 10 chiffres dont le premier est 0.';

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
  v_phone_norm := public.normalize_phone_e164(p_phone);
  IF v_phone_norm IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.user_id INTO v_user_id
  FROM public.profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE (
    public.normalize_phone_e164(p.phone_e164) = v_phone_norm
    OR public.normalize_phone_e164(regexp_replace(COALESCE(p.phone, ''), '\s+', '', 'g')) = v_phone_norm
    OR p.phone_e164 = v_phone_norm
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
