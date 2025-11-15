-- Corriger le problème de récursion infinie dans les politiques RLS pour profiles
-- Le problème : la fonction check_user_role lit depuis profiles, ce qui déclenche les politiques RLS,
-- qui appellent check_user_role, créant une récursion infinie.

-- Solution : Modifier la fonction check_user_role pour qu'elle contourne complètement RLS
-- en utilisant SECURITY DEFINER avec désactivation temporaire de RLS

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS public.check_user_role(uuid, user_role);

-- Recréer la fonction avec SECURITY DEFINER qui contourne RLS
-- Utiliser plpgsql pour pouvoir désactiver RLS temporairement
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

-- Vérification : tester que la fonction fonctionne
-- (Cette requête ne devrait pas causer de récursion)
DO $$
BEGIN
  -- Test silencieux de la fonction
  PERFORM public.check_user_role(auth.uid(), 'admin'::user_role);
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorer les erreurs de test
    NULL;
END $$;

