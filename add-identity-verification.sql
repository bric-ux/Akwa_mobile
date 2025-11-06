-- Script pour ajouter la vérification d'identité aux profils utilisateurs
-- Ajouter les colonnes si elles n'existent pas déjà

-- Vérifier et ajouter la colonne identity_verified
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'identity_verified'
    ) THEN
        ALTER TABLE profiles ADD COLUMN identity_verified BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN profiles.identity_verified IS 'Indique si l\'identité de l\'utilisateur a été vérifiée';
    END IF;
END $$;

-- Vérifier et ajouter la colonne identity_document_url
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'identity_document_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN identity_document_url TEXT;
        COMMENT ON COLUMN profiles.identity_document_url IS 'URL du document d\'identité uploadé';
    END IF;
END $$;

-- Vérifier et ajouter la colonne identity_verification_status
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'identity_verification_status'
    ) THEN
        ALTER TABLE profiles ADD COLUMN identity_verification_status TEXT DEFAULT 'pending';
        COMMENT ON COLUMN profiles.identity_verification_status IS 'Statut de la vérification d\'identité (pending, approved, rejected)';
    END IF;
END $$;

-- Vérifier et ajouter la colonne identity_verification_date
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'identity_verification_date'
    ) THEN
        ALTER TABLE profiles ADD COLUMN identity_verification_date TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN profiles.identity_verification_date IS 'Date de vérification d\'identité';
    END IF;
END $$;

-- Vérifier et ajouter la colonne identity_verification_notes
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'identity_verification_notes'
    ) THEN
        ALTER TABLE profiles ADD COLUMN identity_verification_notes TEXT;
        COMMENT ON COLUMN profiles.identity_verification_notes IS 'Notes de l\'administrateur sur la vérification d\'identité';
    END IF;
END $$;

-- Créer un index sur identity_verification_status pour les requêtes de filtrage
CREATE INDEX IF NOT EXISTS idx_profiles_identity_verification_status ON profiles(identity_verification_status);

-- Créer un index sur identity_verified pour les requêtes de vérification
CREATE INDEX IF NOT EXISTS idx_profiles_identity_verified ON profiles(identity_verified);

-- Créer une fonction pour mettre à jour le statut de vérification d'identité
CREATE OR REPLACE FUNCTION update_identity_verification_status(
    user_id_param UUID,
    new_status TEXT,
    admin_notes TEXT DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    -- Vérifier que l'utilisateur est admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Seuls les administrateurs peuvent modifier le statut de vérification d\'identité';
    END IF;
    
    -- Mettre à jour le statut
    UPDATE profiles 
    SET 
        identity_verification_status = new_status,
        identity_verified = (new_status = 'approved'),
        identity_verification_date = CASE 
            WHEN new_status = 'approved' THEN NOW()
            ELSE identity_verification_date
        END,
        identity_verification_notes = COALESCE(admin_notes, identity_verification_notes),
        updated_at = NOW()
    WHERE user_id = user_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions nécessaires à la fonction
GRANT EXECUTE ON FUNCTION update_identity_verification_status(UUID, TEXT, TEXT) TO authenticated;

-- Commenter la fonction
COMMENT ON FUNCTION update_identity_verification_status(UUID, TEXT, TEXT) IS 'Fonction pour mettre à jour le statut de vérification d\'identité d\'un utilisateur (admin seulement)';

-- Créer une fonction pour obtenir les statistiques de vérification d'identité
CREATE OR REPLACE FUNCTION get_identity_verification_stats()
RETURNS TABLE (
    total_users BIGINT,
    verified_users BIGINT,
    pending_verifications BIGINT,
    rejected_verifications BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE identity_verified = TRUE) as verified_users,
        COUNT(*) FILTER (WHERE identity_verification_status = 'pending') as pending_verifications,
        COUNT(*) FILTER (WHERE identity_verification_status = 'rejected') as rejected_verifications
    FROM profiles
    WHERE is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions nécessaires à la fonction
GRANT EXECUTE ON FUNCTION get_identity_verification_stats() TO authenticated;

-- Commenter la fonction
COMMENT ON FUNCTION get_identity_verification_stats() IS 'Fonction pour obtenir les statistiques de vérification d\'identité';











