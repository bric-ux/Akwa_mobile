-- Script pour ajouter les colonnes de réduction à la table properties
-- Exécuter ce script dans votre dashboard Supabase

-- Ajouter les colonnes de réduction
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS discount_min_nights INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT NULL;

-- Ajouter des commentaires pour clarifier l'usage
COMMENT ON COLUMN properties.discount_enabled IS 'Indique si les réductions sont activées pour cette propriété';
COMMENT ON COLUMN properties.discount_min_nights IS 'Nombre minimum de nuits pour bénéficier de la réduction';
COMMENT ON COLUMN properties.discount_percentage IS 'Pourcentage de réduction appliqué (ex: 10.00 pour 10%)';

-- Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'properties' 
AND column_name LIKE 'discount_%'
ORDER BY column_name;
