-- Script SQL pour configurer les politiques RLS du bucket profile-photos
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Activer RLS sur le bucket profile-photos (si pas déjà fait)
-- ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 2. Politique pour permettre aux utilisateurs authentifiés de voir toutes les photos de profil
CREATE POLICY "Allow public read access to profile photos" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-photos');

-- 3. Politique pour permettre aux utilisateurs authentifiés d'uploader leurs propres photos
CREATE POLICY "Allow authenticated users to upload profile photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Politique pour permettre aux utilisateurs de mettre à jour leurs propres photos
CREATE POLICY "Allow users to update their own profile photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Politique pour permettre aux utilisateurs de supprimer leurs propres photos
CREATE POLICY "Allow users to delete their own profile photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: Les fichiers seront organisés par utilisateur dans des dossiers
-- Format: profile-photos/{user_id}/{filename}
