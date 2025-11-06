-- Script pour ajouter les colonnes de révision à la table host_applications
-- Permet aux admins de spécifier quels champs doivent être modifiés lors de la révision

-- 1. Ajouter les colonnes de révision à host_applications
ALTER TABLE public.host_applications 
ADD COLUMN IF NOT EXISTS revision_message TEXT,
ADD COLUMN IF NOT EXISTS revision_fields TEXT[];

-- 2. Ajouter un commentaire pour expliquer les champs
COMMENT ON COLUMN public.host_applications.revision_message IS 'Message de révision envoyé par l''admin à l''hôte avec les modifications requises';
COMMENT ON COLUMN public.host_applications.revision_fields IS 'Liste des champs spécifiques à modifier lors de la révision';

-- 3. Vérifier que les colonnes ont été ajout deanomédés
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'host_applications' 
AND column_name IN ('revision_message', 'revision_fields')
ORDER BY column_name;








