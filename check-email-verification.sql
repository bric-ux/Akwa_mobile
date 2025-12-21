-- Script SQL pour vérifier le statut de vérification d'email
-- Remplacez 'VOTRE_EMAIL@example.com' par l'email à vérifier

-- 1. Vérifier le statut du profil
SELECT 
  user_id,
  email,
  email_verified,
  created_at,
  updated_at
FROM profiles
WHERE email = 'VOTRE_EMAIL@example.com';

-- 2. Vérifier les codes de vérification pour cet email
SELECT 
  id,
  email,
  code,
  used,
  created_at,
  expires_at,
  CASE 
    WHEN expires_at < NOW() THEN 'EXPIRÉ'
    WHEN used = true THEN 'UTILISÉ'
    ELSE 'VALIDE'
  END as status
FROM email_verification_codes
WHERE email = 'VOTRE_EMAIL@example.com'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Vérifier si la mise à jour fonctionne (test manuel)
-- Décommentez cette ligne pour forcer la mise à jour (remplacez USER_ID)
-- UPDATE profiles SET email_verified = true WHERE user_id = 'USER_ID';

-- 4. Vérifier les logs de la fonction Edge (dans Supabase Dashboard)
-- Allez dans: Edge Functions > verify-code > Logs
-- Cherchez les messages: "✅ Profil mis à jour avec succès"















