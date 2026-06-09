-- Évite les violations check_host_app_discount_percentage (0, >100, réduction incomplète).

CREATE OR REPLACE FUNCTION public.sanitize_host_application_discounts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.discount_percentage IS NOT NULL THEN
    NEW.discount_percentage := ROUND(NEW.discount_percentage::numeric, 0);
    IF NEW.discount_percentage <= 0 OR NEW.discount_percentage > 100 THEN
      NEW.discount_percentage := NULL;
    END IF;
  END IF;

  IF NEW.discount_enabled IS NOT TRUE
     OR NEW.discount_percentage IS NULL
     OR NEW.discount_min_nights IS NULL
     OR NEW.discount_min_nights <= 0
  THEN
    NEW.discount_enabled := false;
    NEW.discount_percentage := NULL;
    NEW.discount_min_nights := NULL;
  END IF;

  IF NEW.long_stay_discount_percentage IS NOT NULL THEN
    NEW.long_stay_discount_percentage := ROUND(NEW.long_stay_discount_percentage::numeric, 0);
    IF NEW.long_stay_discount_percentage <= 0 OR NEW.long_stay_discount_percentage > 100 THEN
      NEW.long_stay_discount_percentage := NULL;
    END IF;
  END IF;

  IF NEW.long_stay_discount_enabled IS NOT TRUE
     OR NEW.long_stay_discount_percentage IS NULL
     OR NEW.long_stay_discount_min_nights IS NULL
     OR NEW.long_stay_discount_min_nights <= 0
  THEN
    NEW.long_stay_discount_enabled := false;
    NEW.long_stay_discount_percentage := NULL;
    NEW.long_stay_discount_min_nights := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_host_application_discounts_trigger ON public.host_applications;
CREATE TRIGGER sanitize_host_application_discounts_trigger
  BEFORE INSERT OR UPDATE ON public.host_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_host_application_discounts();
