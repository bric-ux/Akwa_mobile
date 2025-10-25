-- Script pour ajouter la contrainte de vérification d'identité pour les réservations
-- Ce script s'assure que seuls les utilisateurs avec une identité vérifiée peuvent créer des réservations

-- Créer une fonction pour vérifier l'identité de l'utilisateur
CREATE OR REPLACE FUNCTION check_user_identity_verified(user_id_param UUID)
RETURNS boolean AS $$
BEGIN
  -- Vérifier s'il existe un document d'identité vérifié pour cet utilisateur
  RETURN EXISTS (
    SELECT 1 
    FROM identity_documents 
    WHERE user_id = user_id_param 
    AND verified = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenter la fonction
COMMENT ON FUNCTION check_user_identity_verified(UUID) IS 'Vérifie si l''utilisateur a une identité vérifiée';

-- Créer une fonction pour créer une réservation avec vérification d'identité
CREATE OR REPLACE FUNCTION create_booking_with_identity_check(
  property_id_param UUID,
  guest_id_param UUID,
  check_in_date_param DATE,
  check_out_date_param DATE,
  guests_count_param INTEGER,
  adults_count_param INTEGER DEFAULT 1,
  children_count_param INTEGER DEFAULT 0,
  infants_count_param INTEGER DEFAULT 0,
  total_price_param DECIMAL,
  message_to_host_param TEXT DEFAULT NULL,
  special_requests_param TEXT DEFAULT NULL,
  discount_applied_param BOOLEAN DEFAULT FALSE,
  discount_amount_param DECIMAL DEFAULT 0,
  original_total_param DECIMAL DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  booking_id UUID;
BEGIN
  -- Vérifier que l'utilisateur a une identité vérifiée
  IF NOT check_user_identity_verified(guest_id_param) THEN
    RAISE EXCEPTION 'Vérification d''identité requise pour effectuer une réservation';
  END IF;
  
  -- Créer la réservation
  INSERT INTO bookings (
    property_id,
    guest_id,
    check_in_date,
    check_out_date,
    guests_count,
    adults_count,
    children_count,
    infants_count,
    total_price,
    message_to_host,
    special_requests,
    discount_applied,
    discount_amount,
    original_total,
    status
  ) VALUES (
    property_id_param,
    guest_id_param,
    check_in_date_param,
    check_out_date_param,
    guests_count_param,
    adults_count_param,
    children_count_param,
    infants_count_param,
    total_price_param,
    message_to_host_param,
    special_requests_param,
    discount_applied_param,
    discount_amount_param,
    COALESCE(original_total_param, total_price_param),
    CASE 
      WHEN (SELECT auto_booking FROM properties WHERE id = property_id_param) = true 
      THEN 'confirmed' 
      ELSE 'pending' 
    END
  ) RETURNING id INTO booking_id;
  
  RETURN booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION check_user_identity_verified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_booking_with_identity_check(UUID, UUID, DATE, DATE, INTEGER, INTEGER, INTEGER, INTEGER, DECIMAL, TEXT, TEXT, BOOLEAN, DECIMAL, DECIMAL) TO authenticated;

-- Commenter la fonction
COMMENT ON FUNCTION create_booking_with_identity_check IS 'Crée une réservation avec vérification automatique de l''identité de l''utilisateur';

-- Créer un trigger pour empêcher l'insertion directe de réservations sans vérification d'identité
CREATE OR REPLACE FUNCTION prevent_booking_without_identity()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier que l'utilisateur a une identité vérifiée
  IF NOT check_user_identity_verified(NEW.guest_id) THEN
    RAISE EXCEPTION 'Vérification d''identité requise pour effectuer une réservation. Veuillez utiliser la fonction create_booking_with_identity_check.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger (optionnel - peut être commenté si on préfère utiliser uniquement la fonction)
-- CREATE TRIGGER check_identity_before_booking
--   BEFORE INSERT ON bookings
--   FOR EACH ROW
--   EXECUTE FUNCTION prevent_booking_without_identity();

-- Créer une vue pour les statistiques de vérification d'identité
CREATE OR REPLACE VIEW identity_verification_stats AS
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM identity_documents 
    WHERE identity_documents.user_id = profiles.user_id 
    AND verified = true
  )) as verified_users,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM identity_documents 
    WHERE identity_documents.user_id = profiles.user_id 
    AND verified IS NULL
  )) as pending_verifications,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM identity_documents 
    WHERE identity_documents.user_id = profiles.user_id 
    AND verified = false
  )) as rejected_verifications
FROM profiles
WHERE is_active = true;

-- Donner les permissions sur la vue
GRANT SELECT ON identity_verification_stats TO authenticated;

-- Commenter la vue
COMMENT ON VIEW identity_verification_stats IS 'Statistiques de vérification d''identité des utilisateurs';

-- Créer une fonction pour obtenir les utilisateurs non vérifiés qui tentent de réserver
CREATE OR REPLACE FUNCTION get_unverified_users_with_bookings()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  booking_count BIGINT,
  last_booking_attempt TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.email,
    COUNT(b.id) as booking_count,
    MAX(b.created_at) as last_booking_attempt
  FROM profiles p
  LEFT JOIN bookings b ON p.user_id = b.guest_id
  WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM identity_documents 
    WHERE identity_documents.user_id = p.user_id 
    AND verified = true
  )
  AND EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.guest_id = p.user_id
  )
  GROUP BY p.user_id, p.first_name, p.last_name, p.email
  ORDER BY last_booking_attempt DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions
GRANT EXECUTE ON FUNCTION get_unverified_users_with_bookings() TO authenticated;

-- Commenter la fonction
COMMENT ON FUNCTION get_unverified_users_with_bookings() IS 'Retourne les utilisateurs non vérifiés qui ont tenté de faire des réservations';
