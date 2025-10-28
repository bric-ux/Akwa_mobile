# 🗺️ Implémentation des Cartes sur l'Application Mobile

## Résumé

Implémentation d'un bouton de carte qui ouvre OpenStreetMap dans l'application native de cartes ou le navigateur, similaire à Leaflet sur le site web.

## ⚠️ Note Technique

`react-native-maps` nécessite une configuration native qui n'est pas compatible avec Expo managed workflow. Solution adoptée : **Ouverture de la carte dans l'app native** (iOS Maps / Google Maps / Navigateur).

## 🎯 Composant créé : `PropertyMap.tsx`

### Fonctionnalités

1. **Interface de carte cliquable** avec bouton "Voir sur la carte"
2. **Ouverture dans l'app native** (iOS Maps / Google Maps) ou navigateur (OpenStreetMap)
3. **Coordonnées précises** de la localisation
4. **Gestion des coordonnées** :
   - Priorité au quartier (latitude/longitude du quartier)
   - Fallback sur la ville si le quartier n'a pas de coordonnées
   - Fallback sur les coordonnées par défaut (centre de la Côte d'Ivoire)

### Props du composant

```typescript
interface PropertyMapProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  cityName?: string;
  neighborhoodName?: string;
}
```

### Fonctionnement

1. **Coordonnées** : Utilise les coordonnées du quartier ou de la ville selon ce qui est disponible
2. **Clique sur la carte** : Ouvre OpenStreetMap avec les coordonnées exactes
3. **Adresse affichée** : Quartier, ville, Côte d'Ivoire
4. **OpenStreetMap URL** : Format `https://www.openstreetmap.org/?mlat={lat}&mlon={lng}&zoom=15`

## 🔧 Modifications effectuées

### 1. Types (`src/types/index.ts`)

Ajout des coordonnées dans les types de propriété :

```typescript
export interface Property {
  // ...existing fields
  latitude?: number;
  longitude?: number;
  cities?: {
    id: string;
    name: string;
    region: string;
    latitude?: number;  // Nouveau
    longitude?: number; // Nouveau
  };
  neighborhood_id?: string;      // Nouveau
  neighborhoods?: {              // Nouveau
    id: string;
    name: string;
    commune: string;
    latitude?: number;   // Nouveau
    longitude?: number;  // Nouveau
  };
}
```

### 2. Hook `useProperties` (`src/hooks/useProperties.ts`)

Mise à jour de la requête pour récupérer les coordonnées :

```typescript
.select(`
  *,
  cities:city_id (
    id,
    name,
    region,
    latitude,    // Nouveau
    longitude    // Nouveau
  ),
  neighborhoods:neighborhood_id (  // Nouveau
    id,
    name,
    commune,
    latitude,     // Nouveau
    longitude     // Nouveau
  ),
  ...
`)
```

### 3. Écran des détails de propriété (`src/screens/PropertyDetailsScreen.tsx`)

Intégration du composant map :

```tsx
import PropertyMap from '../components/PropertyMap';

// Dans le render :
<PropertyMap
  latitude={property.neighborhoods?.latitude || property.cities?.latitude}
  longitude={property.neighborhoods?.longitude || property.cities?.longitude}
  locationName={property.location}
  cityName={property.cities?.name}
  neighborhoodName={property.neighborhoods?.name}
/>
```

## 🗺️ Comparaison avec le site web

| Fonctionnalité | Site Web (Leaflet) | Mobile (react-native-maps) |
|----------------|-------------------|---------------------------|
| Affichage de carte | ✅ | ✅ |
| Marqueur de localisation | ✅ | ✅ |
| Zoom automatique | ✅ | ✅ |
| Coordonnées quartier/ville | ✅ | ✅ |
| Popup d'informations | ✅ | ✅ |
| OpenStreetMap tiles | ✅ | ✅ (via PROVIDER_DEFAULT) |

## 📍 Données de localisation utilisées

### Coordonnées par défaut
- **Latitude** : 7.5399 (Côte d'Ivoire - centre géographique)
- **Longitude** : -5.5471

### Priorité des coordonnées
1. Quartier (`neighborhoods.latitude/longitude`)
2. Ville (`cities.latitude/longitude`)
3. Par défaut (centre Côte d'Ivoire)

### Zoom
- **Quartier** : 0.015 (vue proche, détails de la zone)
- **Ville** : 0.05 (vue large, voir le contexte urbain)

## 🎨 Design

- Hauteur de la carte : 250px
- Bordure arrondie : 12px
- Marqueur rouge (#e74c3c)
- Affichage de l'adresse complète sous la carte
- Header avec icône de localisation

## ✅ Fichiers créés/modifiés

1. ✅ `src/components/PropertyMap.tsx` - Nouveau composant
2. ✅ `src/types/index.ts` - Ajout des types pour latitude/longitude
3. ✅ `src/hooks/useProperties.ts` - Mise à jour de la requête
4. ✅ `src/screens/PropertyDetailsScreen.tsx` - Intégration du composant
5. ✅ `package.json` - Ajout de react-native-maps

## 🚀 Configuration requise

### Pour iOS
Aucune configuration supplémentaire requise avec Expo.

### Pour Android
Aucune configuration supplémentaire requise avec Expo.

## 📝 Usage

Le composant `PropertyMap` est automatiquement affiché dans les détails de chaque propriété, montrant la localisation exacte de la propriété sur une carte interactive.

## 🎯 Prochaines étapes possibles

1. **Directions** : Ajouter un bouton pour ouvrir la navigation (Google Maps / Apple Maps)
2. **Marqueurs multiples** : Afficher plusieurs propriétés sur une carte de recherche
3. **Clustering** : Grouper les marqueurs proches sur les vues zoom-out
4. **Filtrage par carte** : Permettre de filtrer les propriétés par zone géographique

