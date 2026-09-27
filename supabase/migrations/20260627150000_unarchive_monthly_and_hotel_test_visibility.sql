-- Remet en ligne les annonces longue durée archivées et les hôtels masqués.
-- La visibilité produit reste gated côté clients :
--   app  : uniquement __DEV__ (build test)
--   web  : uniquement Vite DEV (pas la prod déployée)

-- Location longue durée : archived → approved (RLS public = approved only)
UPDATE public.monthly_rental_listings
SET
  status = 'approved',
  updated_at = now()
WHERE status = 'archived';

-- Hôtels masqués / hidden_by_admin → actifs visibles
UPDATE public.hotel_establishments
SET
  status = 'active',
  hidden_by_admin = false,
  updated_at = now()
WHERE status = 'hidden'
   OR hidden_by_admin = true;

-- Brouillons hôtel déjà renseignés (titre) : les publier pour tests
UPDATE public.hotel_establishments
SET
  status = 'active',
  hidden_by_admin = false,
  updated_at = now()
WHERE status = 'draft'
  AND coalesce(trim(title), '') <> '';

-- Flags DB : off par défaut (la prod store n’affiche pas ; le test force ON côté client)
UPDATE public.platform_feature_flags
SET
  enabled = false,
  updated_at = now()
WHERE key IN ('monthly_rental', 'hotel');
