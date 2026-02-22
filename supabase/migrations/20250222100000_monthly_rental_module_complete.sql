-- =============================================================================
-- MODULE LOCATION MENSUELLE (LONGUE DURÉE) – Migration complète et isolée
-- =============================================================================
-- Aucune modification des tables critiques (properties, host_applications,
-- conversations, conversation_messages, profiles, bookings, etc.).
-- Ce module est autonome : tables dédiées uniquement.
--
-- Dépendances (tables existantes requises) : auth.users, locations, conversations,
-- profiles (pour RLS admin). Aucune modification de ces tables.
--
-- Première migration sur ce module : aucune table à supprimer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BIENS (ANNONCES) – monthly_rental_listings
-- -----------------------------------------------------------------------------
-- Statuts : draft (brouillon), pending (en attente validation admin),
--           approved (visible), rejected (refusé), archived (archivé).
-- Visible publiquement uniquement si status = 'approved'.
CREATE TABLE monthly_rental_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mrl_listings_owner ON monthly_rental_listings(owner_id);
CREATE INDEX idx_mrl_listings_status ON monthly_rental_listings(status);
CREATE INDEX idx_mrl_listings_location ON monthly_rental_listings(location);
CREATE INDEX idx_mrl_listings_submitted ON monthly_rental_listings(submitted_at) WHERE submitted_at IS NOT NULL;

COMMENT ON TABLE monthly_rental_listings IS 'Annonces location longue durée (mensuelle). Visibles uniquement si status = approved.';

-- -----------------------------------------------------------------------------
-- 2. PAIEMENTS RÉFÉRENCEMENT – monthly_rental_listing_payments
-- -----------------------------------------------------------------------------
-- 200 FCFA par bien. Paiement obligatoire avant passage en pending.
-- 1 paiement = 1 bien (lien listing_id). Historique visible par le propriétaire.
CREATE TABLE monthly_rental_listing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES monthly_rental_listings(id) ON DELETE CASCADE,
  amount_fcfa INTEGER NOT NULL DEFAULT 200 CHECK (amount_fcfa > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_mrl_payments_listing ON monthly_rental_listing_payments(listing_id);
CREATE INDEX idx_mrl_payments_owner ON monthly_rental_listing_payments(owner_id);
CREATE INDEX idx_mrl_payments_status ON monthly_rental_listing_payments(status);

COMMENT ON TABLE monthly_rental_listing_payments IS 'Paiement de référencement (200 FCFA) par bien. 1 paiement = 1 bien.';

-- -----------------------------------------------------------------------------
-- 3. CANDIDATURES – monthly_rental_candidatures
-- -----------------------------------------------------------------------------
-- Une seule candidature par (listing_id, tenant_id). Snapshot du profil au moment
-- de la candidature. Conversation créée à la candidature (conversation_id).
-- Statuts : sent → viewed → accepted | rejected.
CREATE TABLE monthly_rental_candidatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES monthly_rental_listings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  -- Snapshot profil au moment de la candidature (ne pas dépendre du profil live)
  snapshot JSONB NOT NULL DEFAULT '{}',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  desired_move_in_date DATE,
  duration_months INTEGER,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'viewed', 'accepted', 'rejected')),
  viewed_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(listing_id, tenant_id)
);

CREATE INDEX idx_mrl_candidatures_listing ON monthly_rental_candidatures(listing_id);
CREATE INDEX idx_mrl_candidatures_tenant ON monthly_rental_candidatures(tenant_id);
CREATE INDEX idx_mrl_candidatures_status ON monthly_rental_candidatures(status);
CREATE INDEX idx_mrl_candidatures_conversation ON monthly_rental_candidatures(conversation_id) WHERE conversation_id IS NOT NULL;

COMMENT ON TABLE monthly_rental_candidatures IS 'Candidatures locataires. 1 par utilisateur par bien. Snapshot profil stocké.';

-- -----------------------------------------------------------------------------
-- 4. FAVORIS (LIKES) – monthly_rental_listing_favorites
-- -----------------------------------------------------------------------------
CREATE TABLE monthly_rental_listing_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES monthly_rental_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_mrl_favorites_user ON monthly_rental_listing_favorites(user_id);
CREATE INDEX idx_mrl_favorites_listing ON monthly_rental_listing_favorites(listing_id);

COMMENT ON TABLE monthly_rental_listing_favorites IS 'Favoris (likes) des utilisateurs sur les annonces location mensuelle.';

-- -----------------------------------------------------------------------------
-- RLS – monthly_rental_listings
-- -----------------------------------------------------------------------------
ALTER TABLE monthly_rental_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrl_owner_all" ON monthly_rental_listings;
CREATE POLICY "mrl_owner_all" ON monthly_rental_listings
  FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "mrl_public_approved" ON monthly_rental_listings;
CREATE POLICY "mrl_public_approved" ON monthly_rental_listings
  FOR SELECT USING (status = 'approved');

-- Admin : voir tous (à combiner avec rôle admin en app ou policy avec role)
DROP POLICY IF EXISTS "mrl_admin_select" ON monthly_rental_listings;
CREATE POLICY "mrl_admin_select" ON monthly_rental_listings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- -----------------------------------------------------------------------------
-- RLS – monthly_rental_listing_payments
-- -----------------------------------------------------------------------------
ALTER TABLE monthly_rental_listing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrl_payments_owner" ON monthly_rental_listing_payments;
CREATE POLICY "mrl_payments_owner" ON monthly_rental_listing_payments
  FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "mrl_payments_admin" ON monthly_rental_listing_payments;
CREATE POLICY "mrl_payments_admin" ON monthly_rental_listing_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- -----------------------------------------------------------------------------
-- RLS – monthly_rental_candidatures
-- -----------------------------------------------------------------------------
ALTER TABLE monthly_rental_candidatures ENABLE ROW LEVEL SECURITY;

-- Propriétaire du listing : voir / mettre à jour (viewed, accepted, rejected)
DROP POLICY IF EXISTS "mrl_cand_host" ON monthly_rental_candidatures;
CREATE POLICY "mrl_cand_host" ON monthly_rental_candidatures
  FOR ALL USING (
    EXISTS (SELECT 1 FROM monthly_rental_listings m WHERE m.id = listing_id AND m.owner_id = auth.uid())
  );

-- Locataire : voir ses propres candidatures, insérer (une seule fois par listing)
DROP POLICY IF EXISTS "mrl_cand_tenant_select" ON monthly_rental_candidatures;
CREATE POLICY "mrl_cand_tenant_select" ON monthly_rental_candidatures
  FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "mrl_cand_tenant_insert" ON monthly_rental_candidatures;
CREATE POLICY "mrl_cand_tenant_insert" ON monthly_rental_candidatures
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

-- Admin : voir toutes
DROP POLICY IF EXISTS "mrl_cand_admin" ON monthly_rental_candidatures;
CREATE POLICY "mrl_cand_admin" ON monthly_rental_candidatures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- -----------------------------------------------------------------------------
-- RLS – monthly_rental_listing_favorites
-- -----------------------------------------------------------------------------
ALTER TABLE monthly_rental_listing_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mrl_fav_user" ON monthly_rental_listing_favorites;
CREATE POLICY "mrl_fav_user" ON monthly_rental_listing_favorites
  FOR ALL USING (auth.uid() = user_id);
