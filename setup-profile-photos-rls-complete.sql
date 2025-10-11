-- Script SQL pour configurer les politiques RLS du bucket profile-photos
-- À exécuter dans l'éditeur SQL de Supabase Dashboard

-- 1. Vérifier si RLS est activé sur storage.objects
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- 2. Activer RLS si nécessaire (décommentez si RLS n'est pas activé)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Allow public read access to profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own profile photos" ON storage.objects;

-- 4. Créer les nouvelles politiques

-- Politique pour permettre la lecture publique des photos de profil
CREATE POLICY "Allow public read access to profile photos" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-photos');

-- Politique pour permettre aux utilisateurs authentifiés d'uploader leurs propres photos
CREATE POLICY "Allow authenticated users to upload profile photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour permettre aux utilisateurs de mettre à jour leurs propres photos
CREATE POLICY "Allow users to update their own profile photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique pour permettre aux utilisateurs de supprimer leurs propres photos
CREATE POLICY "Allow users to delete their own profile photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Vérifier les politiques créées
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- 6. Test de la structure des fichiers existants
SELECT name, bucket_id, created_at, updated_at, metadata
FROM storage.objects 
WHERE bucket_id = 'profile-photos'
ORDER BY created_at DESC;

