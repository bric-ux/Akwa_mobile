# Configuration Supabase pour AkwaHome Mobile

## 🔧 Configuration requise

Pour que l'application fonctionne, vous devez configurer Supabase avec vos vraies valeurs.

### 1. Ouvrir le fichier de configuration
```bash
nano src/services/supabase.ts
```

### 2. Remplacer les valeurs par défaut
```typescript
// Remplacez ces valeurs par vos vraies valeurs Supabase
const supabaseUrl = 'YOUR_SUPABASE_URL';        // ← Votre URL Supabase
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // ← Votre clé anonyme
```

### 3. Obtenir vos valeurs Supabase
1. Allez sur [supabase.com](https://supabase.com)
2. Connectez-vous à votre projet
3. Allez dans **Settings** > **API**
4. Copiez :
   - **Project URL** → `supabaseUrl`
   - **anon public** → `supabaseAnonKey`

### 4. Vérifier les tables requises
Assurez-vous que votre base de données contient ces tables :
- `profiles`
- `properties` 
- `property_amenities`
- `cities`

## 🚀 Test de l'application

Une fois configuré, vous pouvez tester l'application :

### Sur téléphone (recommandé)
1. Installez **Expo Go** sur votre téléphone
2. Lancez `npm start`
3. Scannez le QR code avec Expo Go

### Sur émulateur
```bash
# Android
npm run android

# iOS (macOS uniquement)
npm run ios
```

## 📱 Fonctionnalités disponibles

✅ **Écran d'accueil** avec liste des propriétés
✅ **Recherche et filtres** avancés
✅ **Détails de propriété** avec galerie d'images
✅ **Authentification** (inscription/connexion)
✅ **Navigation** par onglets
✅ **Chargement des équipements** depuis la base de données

## 🔄 Prochaines étapes

1. **Configurer Supabase** (voir ci-dessus)
2. **Tester l'authentification**
3. **Tester la navigation** entre les écrans
4. **Développer les fonctionnalités manquantes** :
   - Système de réservation
   - Messagerie
   - Upload d'images
   - Gestion des profils

## 🆘 Dépannage

### Erreur de connexion Supabase
- Vérifiez que vos URL et clé sont correctes
- Vérifiez que votre projet Supabase est actif

### Erreur de navigation
- Vérifiez que les paramètres de navigation sont corrects
- Vérifiez que les types TypeScript sont bien définis

### Erreur de chargement des données
- Vérifiez que les tables existent dans Supabase
- Vérifiez les permissions RLS (Row Level Security)


