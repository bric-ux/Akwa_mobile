-- Migration : Tables SÉPARÉES pour la location mensuelle (longue durée)
-- Ne pas mélanger avec properties / host_applications.
-- À exécuter plus tard selon votre planning.

-- 1. Logements en location mensuelle (annonces des propriétaires)
CREATE TABLE IF NOT EXISTS monthly_rental_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  location_id UUID REFERENCES locations(id),
  property_type TEXT,
  surface_m2 INTEGER NOT NULL CHECK (surface_m2 > 0),
  number_of_rooms INTEGER NOT NULL CHECK (number_of_rooms > 0),
  bedrooms INTEGER NOT NULL CHECK (bedrooms > 0),
  bathrooms INTEGER NOT NULL CHECK (bathrooms > 0),
  is_furnished BOOLEAN DEFAULT false,
  monthly_rent_price INTEGER NOT NULL CHECK (monthly_rent_price > 0),
  security_deposit INTEGER,
  minimum_duration_months INTEGER DEFAULT 1 CHECK (minimum_duration_months IS NULL OR minimum_duration_months >= 1),
  charges_included BOOLEAN DEFAULT false,
  address_details TEXT,
  images TEXT[] DEFAULT '{}',
  categorized_photos JSONB,
  amenities TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('draft', 'active', 'hidden')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monthly_rental_listings_host_id ON monthly_rental_listings(host_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rental_listings_status ON monthly_rental_listings(status);
CREATE INDEX IF NOT EXISTS idx_monthly_rental_listings_location ON monthly_rental_listings(location);

-- 2. Candidatures des locataires sur un logement (demandes de location)
CREATE TABLE IF NOT EXISTS monthly_rental_candidatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES monthly_rental_listings(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  desired_move_in_date DATE,
  duration_months INTEGER,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monthly_rental_candidatures_listing_id ON monthly_rental_candidatures(listing_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rental_candidatures_tenant_id ON monthly_rental_candidatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rental_candidatures_status ON monthly_rental_candidatures(status);

-- RLS
ALTER TABLE monthly_rental_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_rental_candidatures ENABLE ROW LEVEL SECURITY;

-- Listings : le propriétaire voit/modifie les siens
DROP POLICY IF EXISTS "Hosts can view own monthly listings" ON monthly_rental_listings;
CREATE POLICY "Hosts can view own monthly listings" ON monthly_rental_listings
  FOR SELECT USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can insert own monthly listings" ON monthly_rental_listings;
CREATE POLICY "Hosts can insert own monthly listings" ON monthly_rental_listings
  FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update own monthly listings" ON monthly_rental_listings;
CREATE POLICY "Hosts can update own monthly listings" ON monthly_rental_listings
  FOR UPDATE USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can delete own monthly listings" ON monthly_rental_listings;
CREATE POLICY "Hosts can delete own monthly listings" ON monthly_rental_listings
  FOR DELETE USING (auth.uid() = host_id);

-- Candidatures : le propriétaire du logement voit/accepte/refuse les candidatures de son listing
DROP POLICY IF EXISTS "Hosts can view candidatures for own listings" ON monthly_rental_candidatures;
CREATE POLICY "Hosts can view candidatures for own listings" ON monthly_rental_candidatures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM monthly_rental_listings m WHERE m.id = listing_id AND m.host_id = auth.uid())
  );

DROP POLICY IF EXISTS "Hosts can update candidatures for own listings" ON monthly_rental_candidatures;
CREATE POLICY "Hosts can update candidatures for own listings" ON monthly_rental_candidatures
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM monthly_rental_listings m WHERE m.id = listing_id AND m.host_id = auth.uid())
  );

-- Les locataires peuvent créer une candidature (à exposer via API/app)
DROP POLICY IF EXISTS "Tenants can insert candidatures" ON monthly_rental_candidatures;
CREATE POLICY "Tenants can insert candidatures" ON monthly_rental_candidatures
  FOR INSERT WITH CHECK (true);

-- Lecture publique des annonces actives (pour recherche / détail)
DROP POLICY IF EXISTS "Public can view active monthly listings" ON monthly_rental_listings;
CREATE POLICY "Public can view active monthly listings" ON monthly_rental_listings
  FOR SELECT USING (status = 'active');
