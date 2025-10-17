-- Script pour ajouter les colonnes de réduction à la table host_applications
-- et mettre à jour la fonction de création de propriété

-- 1. Ajouter les colonnes de réduction à host_applications
ALTER TABLE public.host_applications 
ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discount_min_nights INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT NULL;

-- 2. Ajouter des contraintes de validation
ALTER TABLE public.host_applications 
ADD CONSTRAINT IF NOT EXISTS check_host_app_discount_min_nights 
CHECK (discount_min_nights IS NULL OR discount_min_nights > 0);

ALTER TABLE public.host_applications 
ADD CONSTRAINT IF NOT EXISTS check_host_app_discount_percentage 
CHECK (discount_percentage IS NULL OR (discount_percentage > 0 AND discount_percentage <= 100));

-- 3. Mettre à jour la fonction de création de propriété pour inclure les réductions
CREATE OR REPLACE FUNCTION public.create_property_from_approved_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  city_uuid uuid;
  final_images text[];
  existing_property_count integer;
BEGIN
  -- Si le statut passe à 'approved', créer une propriété
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    
    -- Vérifier si une propriété existe déjà pour cette candidature
    SELECT COUNT(*) INTO existing_property_count
    FROM properties 
    WHERE host_id = NEW.user_id 
    AND title = NEW.title 
    AND description = NEW.description
    AND created_at > (NEW.created_at - INTERVAL '1 hour');
    
    -- Si aucune propriété similaire récente n'existe, procéder à la création
    IF existing_property_count = 0 THEN
      -- Trouver ou créer la ville
      SELECT id INTO city_uuid
      FROM cities
      WHERE LOWER(name) = LOWER(NEW.location)
      LIMIT 1;
      
      -- Si la ville n'existe pas, la créer
      IF city_uuid IS NULL THEN
        INSERT INTO cities (name, region, country)
        VALUES (NEW.location, 'Non spécifiée', 'Côte d''Ivoire')
        RETURNING id INTO city_uuid;
      END IF;
      
      -- Gérer les images
      IF NEW.images IS NOT NULL THEN
        final_images := NEW.images;
      ELSE
        final_images := ARRAY[]::text[];
      END IF;
      
      -- Créer la propriété avec les réductions
      INSERT INTO properties (
        host_id,
        title,
        description,
        property_type,
        price_per_night,
        max_guests,
        bedrooms,
        bathrooms,
        city_id,
        images,
        amenities,
        is_active,
        discount_enabled,
        discount_min_nights,
        discount_percentage
      ) VALUES (
        NEW.user_id,
        NEW.title,
        NEW.description,
        NEW.property_type::property_type,
        NEW.price_per_night,
        NEW.max_guests,
        NEW.bedrooms,
        NEW.bathrooms,
        city_uuid,
        final_images,
        ARRAY[]::text[],
        true,
        COALESCE(NEW.discount_enabled, false),
        NEW.discount_min_nights,
        NEW.discount_percentage
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'host_applications' 
AND column_name LIKE 'discount_%'
ORDER BY column_name;

