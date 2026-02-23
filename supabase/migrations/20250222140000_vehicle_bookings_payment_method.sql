-- Ajouter la colonne payment_method à vehicle_bookings pour enregistrer
-- le moyen de paiement choisi par le voyageur lors de la réservation
ALTER TABLE vehicle_bookings ADD COLUMN IF NOT EXISTS payment_method text;

COMMENT ON COLUMN vehicle_bookings.payment_method IS 'Moyen de paiement choisi: card, wave, orange_money, mtn_money, moov_money, cash';
