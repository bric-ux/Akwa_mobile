-- Script de test pour vérifier les données existantes des hôtes
-- Ce script permet de voir quels hôtes ont déjà des informations de paiement

-- 1. Voir tous les hôtes avec leurs informations de base
SELECT 
  p.user_id,
  p.first_name,
  p.last_name,
  p.email,
  p.is_host,
  p.role,
  CASE 
    WHEN hpi.id IS NOT NULL THEN 'OUI'
    ELSE 'NON'
  END as has_payment_info,
  hpi.preferred_payment_method,
  hpi.verification_status,
  hpi.is_verified,
  hpi.created_at as payment_info_created_at
FROM profiles p
LEFT JOIN host_payment_info hpi ON p.user_id = hpi.user_id
WHERE p.is_host = true
ORDER BY p.first_name;

-- 2. Compter les hôtes avec et sans informations de paiement
SELECT 
  COUNT(*) as total_hosts,
  COUNT(hpi.id) as hosts_with_payment_info,
  COUNT(*) - COUNT(hpi.id) as hosts_without_payment_info
FROM profiles p
LEFT JOIN host_payment_info hpi ON p.user_id = hpi.user_id
WHERE p.is_host = true;

-- 3. Voir les détails des informations de paiement existantes
SELECT 
  p.first_name,
  p.last_name,
  p.email,
  hpi.preferred_payment_method,
  hpi.bank_name,
  hpi.account_holder_name,
  hpi.mobile_money_provider,
  hpi.mobile_money_number,
  hpi.paypal_email,
  hpi.verification_status,
  hpi.is_verified,
  hpi.verification_notes,
  hpi.created_at,
  hpi.updated_at
FROM profiles p
JOIN host_payment_info hpi ON p.user_id = hpi.user_id
WHERE p.is_host = true
ORDER BY hpi.created_at DESC;

-- 4. Voir les méthodes de paiement préférées
SELECT 
  preferred_payment_method,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM host_payment_info
GROUP BY preferred_payment_method
ORDER BY count DESC;

-- 5. Voir les statuts de vérification
SELECT 
  verification_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM host_payment_info
GROUP BY verification_status
ORDER BY count DESC;
