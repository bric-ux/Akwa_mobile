# Configuration du bucket profile-photos

## Problème actuel
Le bucket `profile-photos` existe mais les politiques RLS (Row Level Security) empêchent l'upload des photos de profil.

## Solution

### 1. Exécuter le script SQL
Copiez et exécutez le contenu du fichier `setup-profile-photos-rls.sql` dans l'éditeur SQL de Supabase :

```sql
-- Politique pour permettre aux utilisateurs authentifiés de voir toutes les photos de profil
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
```

### 2. Structure des fichiers
Les photos de profil seront organisées par utilisateur :
```
profile-photos/
├── {user_id_1}/
│   ├── avatar-1234567890.jpg
│   └── avatar-1234567891.png
├── {user_id_2}/
│   └── avatar-1234567892.jpg
└── ...
```

### 3. Fonctionnement
- **Lecture** : Tous les utilisateurs peuvent voir toutes les photos de profil (pour l'affichage)
- **Upload** : Seuls les utilisateurs authentifiés peuvent uploader dans leur propre dossier
- **Modification** : Les utilisateurs peuvent modifier/supprimer uniquement leurs propres photos

### 4. Test
Après avoir exécuté le script SQL, l'upload des photos de profil devrait fonctionner dans l'application mobile.

## Alternative temporaire
Si les politiques RLS ne peuvent pas être configurées immédiatement, l'application utilise actuellement l'URI locale de l'image, qui est stockée dans les métadonnées utilisateur de Supabase Auth.

