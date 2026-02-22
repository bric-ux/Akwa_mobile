-- Nombre de vues sur les annonces location mensuelle (pour statistiques propriétaire)
ALTER TABLE monthly_rental_listings
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN monthly_rental_listings.view_count IS 'Nombre de consultations de l''annonce (incrémenté à chaque vue détail).';
