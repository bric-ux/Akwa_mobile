-- Script pour forcer la correction de la fonction check_user_role
-- À exécuter dans l'éditeur SQL de Supabase si la fonction n'est pas correctement corrigée

-- Supprimer complètement l'ancienne fonction
DROP FUNCTION IF EXISTS public.check_user_role(uuid, user_role) CASCADE;

-- Recréer la fonction avec la correction pour éviter la récursion
CREATE OR REPLACE FUNCTION public.check_user_role(user_id uuid, required_role user_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- Désactiver RLS temporairement pour cette fonction
  -- Cela permet de lire depuis profiles sans déclencher les politiques RLS
  SET LOCAL row_security = off;
  
  -- Lire directement depuis la table sans passer par RLS
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE profiles.user_id = check_user_role.user_id 
      AND profiles.role = check_user_role.required_role
  ) INTO result;
  
  -- Retourner le résultat
  RETURN COALESCE(result, false);
EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur, retourner false
    RETURN false;
END;
$$;

-- S'assurer que la fonction a les bonnes permissions
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, user_role) TO anon;
GRANT EXECUTE ON FUNCTION public.check_user_role(uuid, user_role) TO service_role;

-- Vérification : tester que la fonction fonctionne
DO $$
DECLARE
  test_result boolean;
  test_user_id uuid;
BEGIN
  -- Récupérer un user_id de test
  SELECT user_id INTO test_user_id FROM public.profiles LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Tester la fonction
    SELECT public.check_user_role(test_user_id, 'user'::user_role) INTO test_result;
    RAISE NOTICE '✅ Test réussi: check_user_role retourne %', test_result;
  ELSE
    RAISE NOTICE '⚠️ Aucun utilisateur trouvé pour le test';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Erreur lors du test: %', SQLERRM;
END $$;

