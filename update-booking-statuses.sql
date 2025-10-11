-- Script SQL pour créer une fonction de mise à jour automatique des statuts de réservations
-- À exécuter dans l'éditeur SQL de Supabase Dashboard

-- 1. Créer une fonction pour mettre à jour automatiquement les statuts des réservations
CREATE OR REPLACE FUNCTION update_booking_statuses()
RETURNS void AS $$
BEGIN
  -- Marquer comme terminées les réservations dont la date de checkout est passée
  -- et qui ne sont pas déjà terminées ou annulées
  UPDATE bookings 
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE 
    check_out_date < CURRENT_DATE
    AND status NOT IN ('completed', 'cancelled');
    
  -- Log du nombre de réservations mises à jour
  RAISE NOTICE 'Mise à jour des statuts de réservations terminée';
END;
$$ LANGUAGE plpgsql;

-- 2. Créer une fonction trigger pour mettre à jour automatiquement les statuts
-- lors de la récupération des réservations (optionnel)
CREATE OR REPLACE FUNCTION trigger_update_booking_statuses()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour les statuts avant de retourner les données
  PERFORM update_booking_statuses();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Créer un trigger sur la table bookings (optionnel)
-- DROP TRIGGER IF EXISTS update_statuses_trigger ON bookings;
-- CREATE TRIGGER update_statuses_trigger
--   BEFORE SELECT ON bookings
--   FOR EACH STATEMENT
--   EXECUTE FUNCTION trigger_update_booking_statuses();

-- 4. Créer une fonction pour vérifier le statut d'une réservation spécifique
CREATE OR REPLACE FUNCTION check_booking_status(booking_id UUID)
RETURNS TEXT AS $$
DECLARE
  booking_record RECORD;
  new_status TEXT;
BEGIN
  -- Récupérer les informations de la réservation
  SELECT status, check_out_date INTO booking_record
  FROM bookings 
  WHERE id = booking_id;
  
  -- Si la réservation n'existe pas
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  
  -- Si déjà terminée ou annulée, retourner le statut actuel
  IF booking_record.status IN ('completed', 'cancelled') THEN
    RETURN booking_record.status;
  END IF;
  
  -- Vérifier si la date de checkout est passée
  IF booking_record.check_out_date < CURRENT_DATE THEN
    -- Mettre à jour le statut
    UPDATE bookings 
    SET 
      status = 'completed',
      updated_at = NOW()
    WHERE id = booking_id;
    
    RETURN 'completed';
  END IF;
  
  -- Retourner le statut actuel
  RETURN booking_record.status;
END;
$$ LANGUAGE plpgsql;

-- 5. Créer une vue pour les réservations avec statuts mis à jour automatiquement
CREATE OR REPLACE VIEW bookings_with_updated_status AS
SELECT 
  b.*,
  CASE 
    WHEN b.check_out_date < CURRENT_DATE AND b.status NOT IN ('completed', 'cancelled')
    THEN 'completed'
    ELSE b.status
  END as current_status
FROM bookings b;

-- 6. Exemple d'utilisation de la fonction de mise à jour
-- SELECT update_booking_statuses();

-- 7. Exemple de vérification du statut d'une réservation
-- SELECT check_booking_status('your-booking-id-here');

-- 8. Exemple d'utilisation de la vue
-- SELECT * FROM bookings_with_updated_status WHERE guest_id = 'your-user-id';

-- Note: Ces fonctions sont optionnelles et complètent la logique côté client.
-- La logique principale reste dans le hook useBookings pour une meilleure performance.

