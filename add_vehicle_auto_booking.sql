-- Migration pour ajouter le champ auto_booking à la table vehicles
-- Permet aux propriétaires de choisir si les réservations sont automatiques (confirmed) ou sur demande (pending)

ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS auto_booking BOOLEAN DEFAULT false;

-- Commenter la colonne
COMMENT ON COLUMN vehicles.auto_booking IS 'Si true, les réservations sont automatiquement confirmées. Si false, elles nécessitent l''approbation du propriétaire.';






