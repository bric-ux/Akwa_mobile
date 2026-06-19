-- ============================================================
-- Annonces test — location longue durée (4 variantes)
-- Images : photos distinctes (Unsplash, libres d'usage)
-- À exécuter dans Supabase → SQL Editor (rôle service / admin)
--
-- Réexécuter ce script met à jour les images même si les
-- annonces existent déjà (section UPDATE en bas).
-- ============================================================

-- ---------------------------------------------------------------------------
-- INSERT (si l'annonce n'existe pas encore)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_id UUID;
  v_location_abidjan UUID;
  v_location_assinie UUID;
  v_listing_id UUID;
BEGIN
  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE email = 'jeanbrice270@gmail.com'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur introuvable : jeanbrice270@gmail.com';
  END IF;

  SELECT id INTO v_location_abidjan
  FROM locations
  WHERE type = 'city' AND name ILIKE '%Abidjan%'
  LIMIT 1;

  SELECT id INTO v_location_assinie
  FROM locations
  WHERE type = 'city' AND (name ILIKE '%Assinie%' OR name ILIKE '%Grand-Bassam%')
  LIMIT 1;

  -- 1. Appartement Cocody Riviera
  IF NOT EXISTS (
    SELECT 1 FROM monthly_rental_listings
    WHERE owner_id = v_owner_id AND title = 'Appartement 3 pièces meublé — Cocody Riviera'
  ) THEN
    v_listing_id := gen_random_uuid();
    INSERT INTO monthly_rental_listings (
      id, owner_id, title, description, location, location_id,
      property_type, surface_m2, number_of_rooms, bedrooms, bathrooms,
      is_furnished, monthly_rent_price, security_deposit, minimum_duration_months,
      charges_included, address_details, images, amenities, status,
      submitted_at, reviewed_at, created_at, updated_at
    ) VALUES (
      v_listing_id, v_owner_id,
      'Appartement 3 pièces meublé — Cocody Riviera',
      'Appartement meublé et sécurisé, proche commerces. Idéal famille ou expatrié.',
      'Abidjan, Cocody', v_location_abidjan,
      'apartment', 85, 3, 2, 1,
      true, 350000, 350000, 6, false,
      'Riviera Palmeraie',
      ARRAY[
        'https://images.unsplash.com/photo-1502672265066-763c89493da6?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1560448204-e02f11c2d0e2?auto=format&fit=crop&w=1200&q=80'
      ],
      ARRAY['WiFi gratuit', 'Climatisation', 'Parking gratuit'],
      'approved', now(), now(), now(), now()
    );
    INSERT INTO monthly_rental_listing_payments (owner_id, listing_id, amount_fcfa, status, paid_at)
    VALUES (v_owner_id, v_listing_id, 200, 'completed', now())
    ON CONFLICT (listing_id) DO NOTHING;
  END IF;

  -- 2. Studio Yopougon
  IF NOT EXISTS (
    SELECT 1 FROM monthly_rental_listings
    WHERE owner_id = v_owner_id AND title = 'Studio moderne — Yopougon'
  ) THEN
    v_listing_id := gen_random_uuid();
    INSERT INTO monthly_rental_listings (
      id, owner_id, title, description, location, location_id,
      property_type, surface_m2, number_of_rooms, bedrooms, bathrooms,
      is_furnished, monthly_rent_price, security_deposit, minimum_duration_months,
      charges_included, address_details, images, amenities, status,
      submitted_at, reviewed_at, created_at, updated_at
    ) VALUES (
      v_listing_id, v_owner_id,
      'Studio moderne — Yopougon',
      'Studio fonctionnel, bien situé, parfait pour un premier logement à Abidjan.',
      'Abidjan, Yopougon', v_location_abidjan,
      'studio', 32, 1, 1, 1,
      true, 180000, 180000, 3, true,
      'Yopougon Maroc',
      ARRAY[
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1536376072261-38c42f89b64b?auto=format&fit=crop&w=1200&q=80'
      ],
      ARRAY['WiFi gratuit', 'Climatisation'],
      'approved', now(), now(), now(), now()
    );
    INSERT INTO monthly_rental_listing_payments (owner_id, listing_id, amount_fcfa, status, paid_at)
    VALUES (v_owner_id, v_listing_id, 200, 'completed', now())
    ON CONFLICT (listing_id) DO NOTHING;
  END IF;

  -- 3. Villa Assinie
  IF NOT EXISTS (
    SELECT 1 FROM monthly_rental_listings
    WHERE owner_id = v_owner_id AND title = 'Villa avec jardin — Assinie'
  ) THEN
    v_listing_id := gen_random_uuid();
    INSERT INTO monthly_rental_listings (
      id, owner_id, title, description, location, location_id,
      property_type, surface_m2, number_of_rooms, bedrooms, bathrooms,
      is_furnished, monthly_rent_price, security_deposit, minimum_duration_months,
      charges_included, address_details, images, amenities, status,
      submitted_at, reviewed_at, created_at, updated_at
    ) VALUES (
      v_listing_id, v_owner_id,
      'Villa avec jardin — Assinie',
      'Villa spacieuse proche de la plage, calme et lumineuse. Long séjour recommandé.',
      'Assinie', v_location_assinie,
      'villa', 180, 5, 4, 3,
      true, 750000, 750000, 12, false,
      'Assinie Mafia',
      ARRAY[
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1512917774080-999499f1f20c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
      ],
      ARRAY['WiFi gratuit', 'Parking gratuit', 'Piscine'],
      'approved', now(), now(), now(), now()
    );
    INSERT INTO monthly_rental_listing_payments (owner_id, listing_id, amount_fcfa, status, paid_at)
    VALUES (v_owner_id, v_listing_id, 200, 'completed', now())
    ON CONFLICT (listing_id) DO NOTHING;
  END IF;

  -- 4. Maison Marcory
  IF NOT EXISTS (
    SELECT 1 FROM monthly_rental_listings
    WHERE owner_id = v_owner_id AND title = 'Maison 4 pièces — Marcory'
  ) THEN
    v_listing_id := gen_random_uuid();
    INSERT INTO monthly_rental_listings (
      id, owner_id, title, description, location, location_id,
      property_type, surface_m2, number_of_rooms, bedrooms, bathrooms,
      is_furnished, monthly_rent_price, security_deposit, minimum_duration_months,
      charges_included, address_details, images, amenities, status,
      submitted_at, reviewed_at, created_at, updated_at
    ) VALUES (
      v_listing_id, v_owner_id,
      'Maison 4 pièces — Marcory',
      'Maison familiale non meublée, quartier résidentiel, proche Zone 4.',
      'Abidjan, Marcory', v_location_abidjan,
      'house', 120, 4, 3, 2,
      false, 420000, 420000, 6, false,
      'Marcory Résidentiel',
      ARRAY[
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80'
      ],
      ARRAY['Parking gratuit', 'Eau chaude'],
      'approved', now(), now(), now(), now()
    );
    INSERT INTO monthly_rental_listing_payments (owner_id, listing_id, amount_fcfa, status, paid_at)
    VALUES (v_owner_id, v_listing_id, 200, 'completed', now())
    ON CONFLICT (listing_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Insert terminé pour owner %', v_owner_id;
END $$;

-- ---------------------------------------------------------------------------
-- UPDATE images (annonces déjà créées — relancer pour rafraîchir les photos)
-- ---------------------------------------------------------------------------
UPDATE monthly_rental_listings m
SET
  images = v.images,
  updated_at = now()
FROM (
  VALUES
    (
      'Appartement 3 pièces meublé — Cocody Riviera',
      ARRAY[
        'https://images.unsplash.com/photo-1502672265066-763c89493da6?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1560448204-e02f11c2d0e2?auto=format&fit=crop&w=1200&q=80'
      ]::TEXT[]
    ),
    (
      'Studio moderne — Yopougon',
      ARRAY[
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1536376072261-38c42f89b64b?auto=format&fit=crop&w=1200&q=80'
      ]::TEXT[]
    ),
    (
      'Villa avec jardin — Assinie',
      ARRAY[
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1512917774080-999499f1f20c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
      ]::TEXT[]
    ),
    (
      'Maison 4 pièces — Marcory',
      ARRAY[
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80'
      ]::TEXT[]
    )
) AS v(title, images)
WHERE m.title = v.title
  AND m.owner_id = (
    SELECT id FROM auth.users WHERE email = 'jeanbrice270@gmail.com' LIMIT 1
  );

-- Vérification
SELECT
  id,
  title,
  location,
  property_type,
  monthly_rent_price,
  status,
  images[1] AS cover_image,
  array_length(images, 1) AS image_count
FROM monthly_rental_listings
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'jeanbrice270@gmail.com' LIMIT 1)
ORDER BY created_at DESC;
