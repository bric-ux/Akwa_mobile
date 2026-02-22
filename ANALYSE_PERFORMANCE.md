# Analyse des problèmes de performance - AkwaHomeMobile

## 🔴 Problèmes critiques (impact majeur sur les performances)

### 1. Requêtes API en boucle pour vérifier la disponibilité des véhicules
**Fichier**: `src/hooks/useVehicles.ts` (lignes 280-308)

**Problème**: 
- Un `Promise.all` fait un appel RPC `check_vehicle_hourly_availability` pour **chaque véhicule individuellement**
- Avec 10 véhicules = 10 requêtes en parallèle
- Avec 50 véhicules = 50 requêtes en parallèle
- Cela peut saturer la connexion et ralentir considérablement

**Solution recommandée**:
- Créer une fonction SQL qui vérifie la disponibilité de plusieurs véhicules en une seule requête
- Ou limiter le nombre de requêtes parallèles avec un batch processing (max 5-10 à la fois)

```typescript
// Au lieu de:
const availabilityChecks = await Promise.all(
  availableVehicles.map(async (vehicle) => {
    const { data } = await supabase.rpc('check_vehicle_hourly_availability', {...});
  })
);

// Utiliser:
const { data } = await supabase.rpc('check_multiple_vehicles_availability', {
  p_vehicle_ids: availableVehicles.map(v => v.id),
  p_start_datetime: startDateTime,
  p_end_datetime: endDateTime
});
```

---

### 2. Calculs de rating en boucle pour chaque propriété
**Fichier**: `src/hooks/useProperties.ts` (lignes 1079-1085)

**Problème**:
- Un `Promise.all` calcule le rating pour **chaque propriété individuellement**
- Chaque calcul fait une requête SQL pour récupérer les avis
- Avec 20 propriétés = 20 requêtes SQL supplémentaires

**Solution recommandée**:
- Calculer tous les ratings en une seule requête SQL avec GROUP BY
- Ou mettre en cache les ratings calculés et les rafraîchir périodiquement

```typescript
// Au lieu de:
const transformedData = await Promise.all(
  data.map(async (property) => {
    const calculatedRating = await calculateRatingFromReviews(property.id);
  })
);

// Utiliser une requête SQL groupée:
const { data: ratingsData } = await supabase
  .from('reviews')
  .select('property_id, rating')
  .eq('approved', true)
  .then(groupByPropertyId);
```

---

### 3. Calculs lourds dans le render (pas de memoization)
**Fichiers**: 
- `src/components/BookingCard.tsx` (lignes 218-271)
- `src/components/InvoiceDisplay.tsx`
- `src/screens/PropertyBookingDetailsScreen.tsx`

**Problème**:
- `calculateTotalAmount()` est appelé à **chaque render** du composant
- Ces calculs incluent des opérations complexes (calculs de réductions, frais, taxes)
- Pas de `useMemo` pour mettre en cache les résultats

**Solution recommandée**:
```typescript
// Dans BookingCard.tsx
const totalAmount = useMemo(() => {
  return calculateTotalAmount();
}, [booking, booking.properties, nights]);

const discountAmount = useMemo(() => {
  return calculateDiscountAmount();
}, [booking, booking.properties, nights]);
```

---

### 4. Requêtes séquentielles en boucle dans MyBookingsScreen
**Fichier**: `src/screens/MyBookingsScreen.tsx` (lignes 154-168)

**Problème**:
- Une boucle `for` fait des requêtes **séquentielles** (une après l'autre) pour chaque réservation
- Si vous avez 10 réservations = 10 requêtes qui s'exécutent l'une après l'autre
- Très lent !

**Solution recommandée**:
```typescript
// Au lieu de:
for (const booking of userVehicleBookings) {
  const request = await getVehicleBookingPendingRequest(booking.id);
}

// Utiliser Promise.all:
const vehicleRequestsPromises = userVehicleBookings.map(booking => 
  booking.id ? getVehicleBookingPendingRequest(booking.id) : Promise.resolve(null)
);
const vehicleRequestsResults = await Promise.all(vehicleRequestsPromises);
```

---

## 🟡 Problèmes moyens (impact modéré)

### 5. FlatList non optimisées
**Fichiers**: Tous les écrans avec FlatList

**Problème**:
- Aucune FlatList n'utilise les optimisations de performance:
  - `getItemLayout` (pour les items de taille fixe)
  - `removeClippedSubviews` (pour libérer la mémoire)
  - `maxToRenderPerBatch` (limiter le nombre d'items rendus)
  - `windowSize` (réduire la fenêtre de rendu)

**Solution recommandée**:
```typescript
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  // Optimisations:
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
  initialNumToRender={10}
/>
```

---

### 6. Pas de memoization des composants
**Problème**:
- Très peu de composants utilisent `React.memo`
- Les composants se re-rendent même si leurs props n'ont pas changé

**Fichiers concernés**:
- `PropertyCard.tsx`
- `VehicleCard.tsx`
- `BookingCard.tsx`
- Tous les composants de liste

**Solution recommandée**:
```typescript
export default React.memo(PropertyCard, (prevProps, nextProps) => {
  return prevProps.property.id === nextProps.property.id &&
         prevProps.property.price_per_night === nextProps.property.price_per_night;
});
```

---

### 7. Beaucoup de console.log en production
**Problème**:
- Plus de 100 fichiers contiennent des `console.log`
- Les console.log ralentissent l'application, surtout sur les anciens appareils

**Solution recommandée**:
- Utiliser une bibliothèque de logging conditionnelle (ex: `__DEV__`)
- Ou créer un utilitaire de logging qui désactive les logs en production

```typescript
// utils/logger.ts
export const log = (...args: any[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};
```

---

### 8. Images non optimisées
**Problème**:
- Pas de lazy loading visible
- Pas de dimensions fixes pour les images
- Pas de cache d'images explicite

**Solution recommandée**:
- Utiliser `react-native-fast-image` pour le cache d'images
- Définir des dimensions fixes pour éviter les recalculs de layout
- Utiliser `resizeMode` approprié

---

## 🟢 Problèmes mineurs (impact faible mais à améliorer)

### 9. useEffect avec dépendances manquantes ou incorrectes
**Problème**:
- Certains `useEffect` peuvent se déclencher trop souvent
- Ou ne pas se déclencher quand nécessaire

**Solution**: Auditer tous les `useEffect` et vérifier les dépendances

---

### 10. Pas de debounce sur les recherches
**Fichiers**: 
- `CitySearchInput.tsx`
- `AutoCompleteSearch.tsx`

**Problème**:
- Les recherches se déclenchent à chaque frappe
- Peut faire beaucoup de requêtes inutiles

**Solution recommandée**:
```typescript
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    searchSuggestions(query);
  }, 300),
  []
);
```

---

## 📊 Priorités d'optimisation

### Priorité 1 (À faire immédiatement):
1. ✅ Optimiser les requêtes de disponibilité des véhicules (batch)
2. ✅ Optimiser les calculs de rating (requête groupée)
3. ✅ Memoization des calculs dans BookingCard et InvoiceDisplay
4. ✅ Paralléliser les requêtes dans MyBookingsScreen

### Priorité 2 (À faire rapidement):
5. ✅ Optimiser les FlatList
6. ✅ Memoization des composants de liste
7. ✅ Supprimer/désactiver les console.log en production

### Priorité 3 (Améliorations continues):
8. ✅ Optimiser le chargement des images
9. ✅ Debounce sur les recherches
10. ✅ Audit des useEffect

---

## 🎯 Impact estimé

- **Avant optimisations**: Temps de chargement initial ~3-5 secondes avec 20+ items
- **Après optimisations prioritaires**: Temps de chargement initial ~1-2 secondes
- **Amélioration estimée**: **60-70% plus rapide**

---

## 📝 Notes

- Les problèmes les plus critiques sont les requêtes en boucle
- Commencer par optimiser les requêtes API avant d'optimiser le rendu
- Tester les performances sur des appareils réels (pas seulement simulateur)




