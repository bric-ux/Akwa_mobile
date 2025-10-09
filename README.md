# AkwaHome Mobile - Application React Native

Application mobile native pour la plateforme de location de logements AkwaHome en Côte d'Ivoire.

## 🚀 Technologies utilisées

- **React Native** avec **Expo** - Framework mobile
- **TypeScript** - Langage de programmation
- **React Navigation** - Navigation entre écrans
- **Supabase** - Backend as a Service (authentification, base de données, stockage)
- **TanStack Query** - Gestion d'état serveur
- **React Native Vector Icons** - Icônes

## 📱 Fonctionnalités

- ✅ **Authentification** complète (inscription, connexion)
- ✅ **Accueil** avec liste des propriétés
- ✅ **Navigation** par onglets (Accueil, Recherche, Réservations, Profil)
- ✅ **Chargement des équipements** depuis la base de données
- ✅ **Interface mobile** optimisée
- 🔄 **En développement** : Recherche, Détails propriété, Réservation, etc.

## 🛠️ Installation et développement

### Prérequis
- Node.js 18+
- npm ou yarn
- Expo CLI (`npm install -g @expo/cli`)
- Expo Go app sur votre téléphone (pour tester)

### Installation
```bash
# Cloner le repository
git clone <repository-url>
cd AkwaHomeMobile

# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm start
```

### Configuration Supabase
1. Ouvrez `src/services/supabase.ts`
2. Remplacez `YOUR_SUPABASE_URL` et `YOUR_SUPABASE_ANON_KEY` par vos vraies valeurs
3. Assurez-vous que votre base de données contient les tables :
   - `profiles`
   - `properties`
   - `property_amenities`
   - `cities`

### Commandes disponibles
```bash
# Développement
npm start              # Serveur de développement Expo
npm run android        # Lancer sur Android (nécessite Android Studio)
npm run ios           # Lancer sur iOS (nécessite Xcode)
npm run web           # Lancer sur navigateur web

# Build
expo build:android    # Build APK pour Android
expo build:ios        # Build pour iOS (nécessite compte Apple Developer)
```

## 📱 Test sur device

### Avec Expo Go
1. Installez l'app **Expo Go** sur votre téléphone
2. Lancez `npm start`
3. Scannez le QR code avec Expo Go
4. L'app se lance sur votre téléphone !

### Avec émulateur
- **Android** : Installez Android Studio et lancez un émulateur
- **iOS** : Installez Xcode et lancez le simulateur iOS

## 🏗️ Structure du projet

```
src/
├── components/          # Composants réutilisables
├── hooks/              # Hooks personnalisés
│   ├── useProperties.ts
│   └── useAmenities.ts
├── navigation/         # Configuration de navigation
│   └── AppNavigator.tsx
├── screens/           # Écrans de l'application
│   ├── HomeScreen.tsx
│   ├── AuthScreen.tsx
│   ├── ProfileScreen.tsx
│   └── ...
├── services/          # Services et contexte
│   ├── supabase.ts
│   └── AuthContext.tsx
├── types/             # Types TypeScript
│   └── index.ts
└── utils/             # Utilitaires
```

## 🔄 Migration depuis la PWA

Cette application React Native reprend la logique métier de votre PWA `akwahome-mobile` :

- ✅ **Hooks migrés** : `useProperties`, `useAmenities`
- ✅ **Authentification** : Même logique Supabase
- ✅ **Types** : Interfaces identiques
- ✅ **Structure** : Organisation similaire

## 📦 Publication sur les stores

### Android (Play Store)
```bash
# Build de production
expo build:android

# Ou avec EAS Build (recommandé)
npx eas build --platform android
```

### iOS (App Store)
```bash
# Build de production
expo build:ios

# Ou avec EAS Build (recommandé)
npx eas build --platform ios
```

## 🎯 Prochaines étapes

1. **Configurer Supabase** avec vos vraies valeurs
2. **Tester l'authentification** 
3. **Développer les écrans manquants** (Recherche, Détails, Réservation)
4. **Ajouter les fonctionnalités avancées** (Upload d'images, Messagerie, etc.)
5. **Tester sur device réel**
6. **Préparer la publication** sur les stores

## 🆘 Support

- Documentation Expo : https://docs.expo.dev/
- Documentation React Navigation : https://reactnavigation.org/
- Documentation Supabase : https://supabase.com/docs

---

**Note** : Cette application est une migration de votre PWA vers React Native pour une expérience mobile native optimale ! 🚀
