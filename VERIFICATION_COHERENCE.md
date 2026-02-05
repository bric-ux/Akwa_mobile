# 🔍 Vérification de cohérence - AkwaHomeMobile

## ✅ COHÉRENCE GLOBALE

### 1. Données de réduction envoyées au PDF

#### ✅ Propriétés
- **InvoiceDisplay.tsx** (lignes 664-669) : Toutes les données de réduction sont envoyées
  - `discount_enabled`, `discount_min_nights`, `discount_percentage`
  - `long_stay_discount_enabled`, `long_stay_discount_min_nights`, `long_stay_discount_percentage`

#### ✅ Véhicules
- **InvoiceDisplay.tsx** (lignes 719-724) : Toutes les données de réduction sont envoyées
  - `vehicleDiscountEnabled`, `vehicleDiscountMinDays`, `vehicleDiscountPercentage`
  - `vehicleLongStayDiscountEnabled`, `vehicleLongStayDiscountMinDays`, `vehicleLongStayDiscountPercentage`

---

### 2. Calcul de réduction

#### ✅ Propriétés
- Utilise `calculateTotalPrice()` (ligne 443)
- Priorité à la réduction long séjour si applicable
- Utilise la valeur stockée `discount_amount` en priorité (ligne 424-426)

#### ✅ Véhicules
- Utilise `calculateVehiclePriceWithHours()` (ligne 477)
- Priorité à la réduction long séjour si applicable
- Applique la réduction sur le total (jours + heures)

---

### 3. Calcul de `nights` / `rentalDays`

#### ⚠️ INCOHÉRENCE POTENTIELLE

**InvoiceDisplay.tsx** (ligne 377-388) :
```typescript
if (serviceType === 'vehicle' && (booking as any).rental_days) {
  nights = (booking as any).rental_days; // ✅ Utilise la valeur stockée
} else if (checkIn && checkOut) {
  if (serviceType === 'vehicle') {
    // ⚠️ Ajoute +1 pour les véhicules
    nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } else {
    // Propriétés : calcul standard
    nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
  }
}
```

**Problème** : Si `rental_days` n'est pas disponible, le calcul ajoute +1, ce qui peut être différent du calcul lors de la création.

**Solution** : Le code utilise `rental_days` stocké en priorité (ligne 377), donc c'est cohérent. Le +1 n'est utilisé que si `rental_days` n'est pas disponible.

---

### 4. Données manquantes pour les véhicules

#### ⚠️ PROBLÈME IDENTIFIÉ

**InvoiceDisplay.tsx** (ligne 727) :
```typescript
withDriver: booking.vehicle?.with_driver || false,
```

**Problème** : On vérifie `booking.vehicle?.with_driver` mais pas `booking.with_driver` (qui pourrait être stocké dans la réservation).

**Correction nécessaire** :
```typescript
withDriver: (booking as any).with_driver || booking.vehicle?.with_driver || false,
```

#### ⚠️ PROBLÈME IDENTIFIÉ

**InvoiceDisplay.tsx** (ligne 728) : `vehicleDriverFee` n'est PAS envoyé au PDF.

**Correction nécessaire** : Ajouter `vehicleDriverFee` dans les données envoyées :
```typescript
vehicleDriverFee: booking.vehicle?.driver_fee || 0,
```

---

## 📊 RÉSUMÉ DES PROBLÈMES

### ❌ Problèmes identifiés

1. **`withDriver`** : Vérifie seulement `booking.vehicle?.with_driver`, pas `booking.with_driver`
2. **`vehicleDriverFee`** : N'est pas envoyé au PDF (mais est utilisé dans le calcul local)

### ✅ Points cohérents

1. ✅ Données de réduction envoyées pour propriétés et véhicules
2. ✅ Calcul de réduction cohérent
3. ✅ Utilisation de `rental_days` stocké en priorité
4. ✅ Calcul de `driverFee` local correct

---

## 🔧 CORRECTIONS NÉCESSAIRES

### Correction #1 : `withDriver`

**Fichier** : `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`  
**Ligne** : 727

**AVANT** :
```typescript
withDriver: booking.vehicle?.with_driver || false,
```

**APRÈS** :
```typescript
withDriver: (booking as any).with_driver || booking.vehicle?.with_driver || false,
```

### Correction #2 : `vehicleDriverFee`

**Fichier** : `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`  
**Ligne** : 728 (après `withDriver`)

**AJOUTER** :
```typescript
vehicleDriverFee: booking.vehicle?.driver_fee || 0,
```

---

## ✅ VALIDATION FINALE

Après corrections :
- [x] Données de réduction complètes pour propriétés
- [x] Données de réduction complètes pour véhicules
- [x] Calcul de réduction cohérent
- [ ] `withDriver` vérifie la bonne source
- [ ] `vehicleDriverFee` envoyé au PDF



