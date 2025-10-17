-- Script pour ajouter la fonction de suppression de compte sécurisée
-- (même fonction que le site web)

-- Supprimer les anciennes fonctions et triggers si ils existent
DROP TRIGGER IF EXISTS on_profile_delete ON public.profiles;
DROP FUNCTION IF EXISTS public.delete_user_account();

-- Créer la fonction sécurisée pour supprimer un compte utilisateur
CREATE OR REPLACE FUNCTION public.delete_user_account_safely(user_id_to_delete uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier que l'utilisateur peut supprimer ce compte (seulement son propre compte)
  IF auth.uid() != user_id_to_delete THEN
    RAISE EXCEPTION 'Vous ne pouvez supprimer que votre propre compte';
  END IF;
  
  -- Supprimer d'abord le profil (ce qui déclenchera la suppression en cascade des données liées)
  DELETE FROM public.profiles WHERE user_id = user_id_to_delete;
  
  -- Ensuite supprimer l'utilisateur de auth.users
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$;

-- Donner les permissions nécessaires à la fonction
GRANT EXECUTE ON FUNCTION public.delete_user_account_safely(uuid) TO authenticated;

-- Commenter la fonction
COMMENT ON FUNCTION public.delete_user_account_safely(uuid) IS 'Fonction sécurisée pour supprimer complètement un compte utilisateur et toutes ses données associées';

