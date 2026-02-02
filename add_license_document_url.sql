-- Migration pour ajouter le champ license_document_url à la table vehicle_bookings
-- Cette colonne stocke l'URL du document du permis de conduire uploadé par le locataire

ALTER TABLE vehicle_bookings
ADD COLUMN IF NOT EXISTS license_document_url TEXT;

COMMENT ON COLUMN vehicle_bookings.license_document_url IS 'URL du document du permis de conduire uploadé par le locataire';


















