-- Script de diagnostic pour vérifier l'état de la fonction check_user_role
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Vérifier si la fonction existe et son type de langage
SELECT 
  p.proname as function_name,
  l.lanname as language,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE p.proname = 'check_user_role'
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Vérifier les politiques RLS sur profiles qui utilisent check_user_role
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'profiles'
  AND (qual::text LIKE '%check_user_role%' OR with_check::text LIKE '%check_user_role%')
ORDER BY policyname;

-- 3. Tester la fonction directement (devrait fonctionner sans récursion)
DO $$
DECLARE
  test_result boolean;
  test_user_id uuid;
BEGIN
  -- Récupérer un user_id de test (premier utilisateur)
  SELECT user_id INTO test_user_id FROM public.profiles LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Tester la fonction
    SELECT public.check_user_role(test_user_id, 'user'::user_role) INTO test_result;
    RAISE NOTICE 'Test de check_user_role: %', test_result;
  ELSE
    RAISE NOTICE 'Aucun utilisateur trouvé pour le test';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erreur lors du test: %', SQLERRM;
END $$;

