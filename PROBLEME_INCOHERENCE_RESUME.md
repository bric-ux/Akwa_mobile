# ⚠️ PROBLÈME D'INCOHÉRENCE : Résumé vs Données Stockées

## 🔍 Problème identifié

L'écran de réservation (`VehicleBookingScreen`) affiche des montants **différents** de ceux stockés dans `booking_calculation_details`.

### 📊 Ce qui est affiché dans l'écran de réservation

D'après l'image fournie :
- **Surplus chauffeur** : 25 000 FCFA
- **Frais de service** : 59 160 FCFA
- **Total** : 552 160 FCFA

### 📊 Ce qui est stocké dans la base

D'après les données `booking_calculation_details` :
- **driver_fee** : 0 FCFA
- **service_fee** : 56 160 FCFA
- **total_price** : 524 160 FCFA

### ❌ Différences

| Élément | Affiché | Stocké | Différence |
|---------|---------|--------|------------|
| Surplus chauffeur | 25 000 | 0 | +25 000 |
| Frais de service | 59 160 | 56 160 | +3 000 |
| Total | 552 160 | 524 160 | +28 000 |

---

## 🔍 Analyse

### Calcul des frais de service

**Si surplus chauffeur = 25 000** :
- Base avec chauffeur : 468 000 + 25 000 = 493 000
- Service fee HT (10%) : 493 000 × 0.10 = 49 300
- Service fee TVA (20%) : 49 300 × 0.20 = 9 860
- Service fee TTC : 49 300 + 9 860 = 59 160 ✅ (correspond à l'affichage)

**Si surplus chauffeur = 0** (comme stocké) :
- Base avec chauffeur : 468 000 + 0 = 468 000
- Service fee HT (10%) : 468 000 × 0.10 = 46 800
- Service fee TVA (20%) : 46 800 × 0.20 = 9 360
- Service fee TTC : 46 800 + 9 360 = 56 160 ✅ (correspond aux données stockées)

### Conclusion

L'écran de réservation calcule avec `driver_fee = 25 000`, mais lors de la création, `driver_fee = 0` est stocké.

---

## 🐛 Cause probable

### Dans `VehicleBookingScreen.tsx` (ligne 539)

```typescript
const driverFee = (withDriver && useDriver === true && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
```

**Problème** : Le calcul dépend de `useDriver`, qui peut changer entre l'affichage et la soumission.

### Dans `useVehicleBookings.ts` (ligne 256)

```typescript
const driverFee = ((vehicle as any).with_driver && bookingData.useDriver === true && (vehicle as any).driver_fee) 
  ? (vehicle as any).driver_fee 
  : 0;
```

**Problème** : Si `bookingData.useDriver` n'est pas `true` lors de la soumission, `driverFee` sera 0, même si l'écran affichait 25 000.

---

## ✅ Solution

### Option 1 : S'assurer que `useDriver` est correctement passé

Vérifier que dans `handleSubmit` de `VehicleBookingScreen.tsx`, `useDriver` est bien passé à `createBooking` :

```typescript
useDriver: withDriver ? useDriver : undefined,
```

**Problème potentiel** : Si `useDriver` est `null` au moment de la soumission, il sera passé comme `undefined`, ce qui peut causer des problèmes.

### Option 2 : Utiliser les mêmes calculs partout

S'assurer que le calcul dans `VehicleBookingScreen` utilise **exactement** la même logique que `useVehicleBookings.createBooking`.

### Option 3 : Stocker les valeurs affichées

Lors de la création, utiliser les valeurs calculées dans l'écran de réservation plutôt que de recalculer.

---

## 🔧 Actions à prendre

1. ✅ Vérifier que `useDriver` est correctement initialisé et mis à jour
2. ✅ Vérifier que `useDriver` est correctement passé lors de la soumission
3. ✅ Ajouter des logs pour tracer la valeur de `useDriver` lors de la soumission
4. ✅ S'assurer que le calcul dans l'écran correspond au calcul lors de la création

---

## 📝 Vérification à faire

Dans `VehicleBookingScreen.tsx`, ligne 649 :

```typescript
useDriver: withDriver ? useDriver : undefined,
```

**Question** : Quelle est la valeur de `useDriver` au moment de la soumission ?

- Si `useDriver === true` → `driverFee` devrait être 25 000
- Si `useDriver === false` ou `null` → `driverFee` devrait être 0

**Hypothèse** : L'utilisateur a peut-être changé d'avis entre l'affichage du résumé et la soumission, ou `useDriver` n'est pas correctement synchronisé.



