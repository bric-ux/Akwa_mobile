-- Ajouter les colonnes admin_payment_method et admin_payment_reference
-- pour enregistrer le moyen et les détails du versement aux hôtes et propriétaires
ALTER TABLE host_payouts ADD COLUMN IF NOT EXISTS admin_payment_method text;
ALTER TABLE host_payouts ADD COLUMN IF NOT EXISTS admin_payment_reference text;
ALTER TABLE vehicle_payouts ADD COLUMN IF NOT EXISTS admin_payment_method text;
ALTER TABLE vehicle_payouts ADD COLUMN IF NOT EXISTS admin_payment_reference text;

COMMENT ON COLUMN host_payouts.admin_payment_method IS 'Méthode utilisée: bank_transfer, wave, orange_money, mtn_money, moov_money, cash, other';
COMMENT ON COLUMN host_payouts.admin_payment_reference IS 'Référence virement, numéro envoyé, ou note selon la méthode';
COMMENT ON COLUMN vehicle_payouts.admin_payment_method IS 'Méthode utilisée: bank_transfer, wave, orange_money, mtn_money, moov_money, cash, other';
COMMENT ON COLUMN vehicle_payouts.admin_payment_reference IS 'Référence virement, numéro envoyé, ou note selon la méthode';
