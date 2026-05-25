-- Évite "numeric field overflow" sur candidatures hôte (DECIMAL(5,2) trop petit pour montants FCFA).

ALTER TABLE public.host_applications
  ALTER COLUMN discount_percentage TYPE numeric USING discount_percentage::numeric,
  ALTER COLUMN long_stay_discount_percentage TYPE numeric USING long_stay_discount_percentage::numeric,
  ALTER COLUMN cleaning_fee TYPE numeric USING cleaning_fee::numeric,
  ALTER COLUMN taxes TYPE numeric USING taxes::numeric;

ALTER TABLE public.host_applications
  ALTER COLUMN monthly_rent_price TYPE numeric USING monthly_rent_price::numeric,
  ALTER COLUMN security_deposit TYPE numeric USING security_deposit::numeric,
  ALTER COLUMN surface_m2 TYPE numeric USING surface_m2::numeric;

COMMENT ON COLUMN public.host_applications.discount_percentage IS
  'Pourcentage 1–100 ; type numeric sans précision fixe pour éviter overflow DECIMAL(5,2).';
