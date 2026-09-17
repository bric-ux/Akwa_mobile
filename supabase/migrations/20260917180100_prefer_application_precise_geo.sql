-- Lors de la création d'une propriété depuis une candidature approuvée,
-- préférer latitude/longitude/location_id de la candidature si présents.

CREATE OR REPLACE FUNCTION public.create_property_from_approved_application()
RETURNS TRIGGER AS $$
DECLARE
  v_location_id UUID;
  existing_property_count integer;
  new_property_id UUID;
  photo_url text;
  photo_index integer := 0;
  categorized_photos jsonb;
  photo_category text;
  photo_is_main boolean;
  has_main_photo boolean := false;
  converted_amenities text[];
  v_latitude DECIMAL;
  v_longitude DECIMAL;
  v_service_fee INTEGER := 0;
  v_discount_enabled boolean;
  v_discount_min_nights integer;
  v_discount_percentage integer;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    SELECT COUNT(*) INTO existing_property_count
    FROM properties
    WHERE host_id = NEW.user_id
    AND title = NEW.title
    AND description = NEW.description
    AND created_at > (NEW.created_at - INTERVAL '1 hour');

    IF existing_property_count > 0 THEN
      RETURN NEW;
    END IF;

    -- Priorité : location_id fourni à la candidature
    v_location_id := NEW.location_id;

    IF v_location_id IS NULL THEN
      SELECT id INTO v_location_id
      FROM public.locations
      WHERE LOWER(name) = LOWER(NEW.location)
        AND type = 'neighborhood'
      LIMIT 1;
    END IF;

    IF v_location_id IS NULL THEN
      SELECT id INTO v_location_id
      FROM public.locations
      WHERE LOWER(name) = LOWER(NEW.location)
        AND type = 'commune'
      LIMIT 1;
    END IF;

    IF v_location_id IS NULL THEN
      SELECT id INTO v_location_id
      FROM public.locations
      WHERE LOWER(name) = LOWER(NEW.location)
        AND type = 'city'
      LIMIT 1;
    END IF;

    IF v_location_id IS NULL THEN
      SELECT id INTO v_location_id
      FROM public.locations
      WHERE LOWER(name) = 'abidjan'
        AND type = 'city'
      LIMIT 1;
    END IF;

    converted_amenities := public.convert_amenity_uuids_to_names(NEW.amenities);

    -- Coords précises candidature, sinon centroïde de la location
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      v_latitude := NEW.latitude;
      v_longitude := NEW.longitude;
    ELSIF v_location_id IS NOT NULL THEN
      SELECT latitude, longitude INTO v_latitude, v_longitude
      FROM public.locations
      WHERE id = v_location_id;
    END IF;

    v_discount_enabled := COALESCE(NEW.discount_enabled, false);
    v_discount_min_nights := NEW.discount_min_nights;
    v_discount_percentage := CASE
      WHEN NEW.discount_percentage IS NULL THEN NULL
      ELSE ROUND(NEW.discount_percentage)::integer
    END;
    IF v_discount_enabled AND (v_discount_min_nights IS NULL OR v_discount_percentage IS NULL) THEN
      v_discount_enabled := false;
      v_discount_min_nights := NULL;
      v_discount_percentage := NULL;
    END IF;

    INSERT INTO public.properties (
      host_id,
      title,
      description,
      property_type,
      bedrooms,
      bathrooms,
      max_guests,
      price_per_night,
      address,
      location_id,
      latitude,
      longitude,
      is_active,
      amenities,
      images,
      cleaning_fee,
      service_fee,
      taxes,
      minimum_nights,
      auto_booking,
      cancellation_policy,
      host_guide,
      discount_enabled,
      discount_min_nights,
      discount_percentage,
      long_stay_discount_enabled,
      long_stay_discount_min_nights,
      long_stay_discount_percentage,
      check_in_time,
      check_out_time,
      house_rules,
      address_details,
      custom_amenities,
      free_cleaning_min_days
    ) VALUES (
      NEW.user_id,
      NEW.title,
      NEW.description,
      NEW.property_type::property_type,
      NEW.bedrooms,
      NEW.bathrooms,
      NEW.max_guests,
      NEW.price_per_night,
      NEW.location,
      v_location_id,
      v_latitude,
      v_longitude,
      true,
      converted_amenities,
      COALESCE(NEW.images, ARRAY[]::text[]),
      COALESCE(NEW.cleaning_fee, 0),
      v_service_fee,
      COALESCE(NEW.taxes, 0),
      COALESCE(NEW.minimum_nights, 1),
      COALESCE(NEW.auto_booking, false),
      COALESCE(NEW.cancellation_policy, 'flexible'),
      COALESCE(NEW.host_guide, ''),
      v_discount_enabled,
      v_discount_min_nights,
      v_discount_percentage,
      COALESCE(NEW.long_stay_discount_enabled, false),
      NEW.long_stay_discount_min_nights,
      NEW.long_stay_discount_percentage,
      NEW.check_in_time,
      NEW.check_out_time,
      COALESCE(NEW.house_rules, ''),
      COALESCE(NEW.address_details, ''),
      COALESCE(NEW.custom_amenities, ARRAY[]::text[]),
      NEW.free_cleaning_min_days
    )
    RETURNING id INTO new_property_id;

    IF new_property_id IS NOT NULL AND (NEW.images IS NOT NULL OR NEW.categorized_photos IS NOT NULL) THEN
      IF NEW.categorized_photos IS NOT NULL THEN
        categorized_photos := NEW.categorized_photos;

        FOR photo_index IN 0..jsonb_array_length(categorized_photos) - 1
        LOOP
          photo_is_main := COALESCE((categorized_photos->photo_index->>'isMain')::boolean, false);
          IF photo_is_main THEN
            has_main_photo := true;
            EXIT;
          END IF;
        END LOOP;

        photo_index := 0;
        FOR photo_index IN 0..jsonb_array_length(categorized_photos) - 1
        LOOP
          photo_url := categorized_photos->photo_index->>'url';
          photo_category := categorized_photos->photo_index->>'category';
          photo_is_main := COALESCE((categorized_photos->photo_index->>'isMain')::boolean, false);

          IF NOT has_main_photo AND photo_index = 0 THEN
            photo_is_main := true;
          END IF;

          IF photo_category IS NULL OR photo_category = '' THEN
            photo_category := 'autre';
          END IF;

          BEGIN
            INSERT INTO property_photos (property_id, url, category, display_order, is_main)
            VALUES (new_property_id, photo_url, photo_category::photo_category, photo_index, photo_is_main);
          EXCEPTION WHEN invalid_text_representation THEN
            INSERT INTO property_photos (property_id, url, category, display_order, is_main)
            VALUES (new_property_id, photo_url, 'autre'::photo_category, photo_index, photo_is_main);
          END;
        END LOOP;
      ELSIF NEW.images IS NOT NULL AND array_length(NEW.images, 1) > 0 THEN
        photo_index := 0;
        FOREACH photo_url IN ARRAY NEW.images
        LOOP
          INSERT INTO property_photos (property_id, url, category, display_order, is_main)
          VALUES (new_property_id, photo_url, 'autre'::photo_category, photo_index, photo_index = 0);
          photo_index := photo_index + 1;
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.create_property_from_approved_application() IS
  'Crée une propriété depuis candidature approuvée. Utilise latitude/longitude/location_id candidature si présents.';
