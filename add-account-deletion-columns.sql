-- Script pour ajouter les colonnes de suppression de compte
-- Ajouter les colonnes si elles n'existent pas déjà

-- Vérifier et ajouter la colonne deleted_at
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN profiles.deleted_at IS 'Date de suppression du compte (soft delete)';
    END IF;
END $$;

-- Vérifier et ajouter la colonne is_active
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN profiles.is_active IS 'Indique si le compte est actif (non supprimé)';
    END IF;
END $$;

-- Créer un index sur deleted_at pour les requêtes de nettoyage
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

-- Créer un index sur is_active pour les requêtes de filtrage
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- Mettre à jour les profils existants pour marquer comme actifs
UPDATE profiles 
SET is_active = TRUE 
WHERE is_active IS NULL;

-- Créer une fonction pour nettoyer les comptes supprimés (à exécuter périodiquement)
CREATE OR REPLACE FUNCTION cleanup_deleted_accounts()
RETURNS void AS $$
BEGIN
    -- Supprimer les comptes marqués comme supprimés depuis plus de 30 jours
    DELETE FROM profiles 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
    
    -- Log du nettoyage
    RAISE NOTICE 'Nettoyage des comptes supprimés effectué à %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Créer une fonction pour annuler la suppression de compte
CREATE OR REPLACE FUNCTION cancel_account_deletion(user_id UUID)
RETURNS boolean AS $$
BEGIN
    UPDATE profiles 
    SET deleted_at = NULL, is_active = TRUE 
    WHERE id = user_id AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Créer une fonction pour vérifier si un compte est marqué pour suppression
CREATE OR REPLACE FUNCTION is_account_marked_for_deletion(user_id UUID)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM profiles 
        WHERE id = user_id 
        AND deleted_at IS NOT NULL 
        AND is_active = FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour les politiques RLS pour exclure les comptes supprimés
-- (Si RLS est activé sur la table profiles)

-- Exemple de politique pour exclure les comptes supprimés des requêtes publiques
-- CREATE POLICY "profiles_public_select" ON profiles
-- FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL);

-- Exemple de politique pour permettre aux utilisateurs de voir leur propre profil même s'il est marqué pour suppression
-- CREATE POLICY "profiles_own_select" ON profiles
-- FOR SELECT USING (auth.uid() = id);

COMMENT ON FUNCTION cleanup_deleted_accounts() IS 'Fonction pour nettoyer les comptes supprimés depuis plus de 30 jours';
COMMENT ON FUNCTION cancel_account_deletion(UUID) IS 'Fonction pour annuler la suppression d''un compte';
COMMENT ON FUNCTION is_account_marked_for_deletion(UUID) IS 'Fonction pour vérifier si un compte est marqué pour suppression';

