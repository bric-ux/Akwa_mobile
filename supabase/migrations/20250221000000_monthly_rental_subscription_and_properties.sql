-- Migration : Abonnement location mensuelle + champs propriétés
-- À exécuter manuellement si les tables/colonnes n'existent pas.
-- Ne modifie pas les données existantes (colonnes nullable / nouvelles tables).

-- 1. Table abonnements (un abonnement par bien pour la location mensuelle)
CREATE TABLE IF NOT EXISTS monthly_rental_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')) DEFAULT 'active',
  plan_type TEXT CHECK (plan_type IN ('single', 'multi_2_5', 'multi_6_plus')) NOT NULL,
  monthly_price INTEGER NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  trial_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(host_id, property_id)
);

-- Index pour lister les abonnements d'un hôte
CREATE INDEX IF NOT EXISTS idx_monthly_rental_subscriptions_host_id ON monthly_rental_subscriptions(host_id);
CREATE INDEX IF NOT EXISTS idx_monthly_rental_subscriptions_status ON monthly_rental_subscriptions(status);

-- 2. Colonnes optionnelles sur properties (sans casser l'existant)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_monthly_rental BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rental_type TEXT CHECK (rental_type IN ('short_term', 'monthly'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_rent_price INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS security_deposit INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS minimum_duration_months INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS charges_included BOOLEAN DEFAULT false;

-- RLS (à adapter selon votre auth)
ALTER TABLE monthly_rental_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view own subscriptions" ON monthly_rental_subscriptions;
CREATE POLICY "Hosts can view own subscriptions" ON monthly_rental_subscriptions
  FOR SELECT USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can insert own subscriptions" ON monthly_rental_subscriptions;
CREATE POLICY "Hosts can insert own subscriptions" ON monthly_rental_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update own subscriptions" ON monthly_rental_subscriptions;
CREATE POLICY "Hosts can update own subscriptions" ON monthly_rental_subscriptions
  FOR UPDATE USING (auth.uid() = host_id);

-- 3. Colonnes optionnelles sur host_applications (candidature devenir hôte / ajouter une propriété)
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS is_monthly_rental BOOLEAN DEFAULT false;
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS monthly_rent_price INTEGER;
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS security_deposit INTEGER;
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS minimum_duration_months INTEGER;
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS charges_included BOOLEAN DEFAULT false;
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS surface_m2 INTEGER;
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS number_of_rooms INTEGER;
ALTER TABLE host_applications ADD COLUMN IF NOT EXISTS is_furnished BOOLEAN DEFAULT false;
