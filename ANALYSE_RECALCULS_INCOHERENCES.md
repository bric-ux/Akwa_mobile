# 🔍 ANALYSE DES RECALCULS - RISQUES D'INCOHÉRENCES

## ⚠️ PROBLÈME IDENTIFIÉ

Même si `total_price` et `host_net_amount` sont stockés en base, **plusieurs endroits recalculent ces valeurs** au lieu d'utiliser les valeurs stockées, ce qui peut créer des incohérences.

---

## 📍 ENDROITS QUI RECALCULENT `host_net_amount`

### 1. ✅ **InvoiceDisplay.tsx** (Mobile) - Lignes 624-673

**Statut**: ⚠️ **RECALCULE** mais avec fallback sur valeur stockée

```typescript:624:673:AkwaHomeMobile/src/components/InvoiceDisplay.tsx
// Utiliser host_net_amount stocké si disponible, sinon utiliser la fonction centralisée
let hostNetAmount: number;

// Pour les véhicules, le revenu net = prix avec chauffeur - commission (sans la caution)
if (serviceType === 'vehicle') {
  // RECALCUL au lieu d'utiliser la valeur stockée
  hostNetAmount = priceAfterDiscountWithDriver - hostCommission;
} else {
  // Pour les propriétés, utiliser la fonction centralisée (RECALCUL)
  const result = calculateHostNetAmountCentralized({...});
  hostNetAmount = result.hostNetAmount;
}
```

**Problème**: 
- Recalcule au lieu d'utiliser `booking.host_net_amount` stocké
- Pour les véhicules, le calcul peut différer si les données utilisées ne correspondent pas exactement à celles de la création

**Solution recommandée**: 
```typescript
// Utiliser la valeur stockée en priorité
hostNetAmount = (booking as any).host_net_amount ?? calculatedHostNetAmount;
```

---

### 2. ✅ **HostBookingsScreen.tsx** (Mobile) - Lignes 361-421

**Statut**: ⚠️ **RECALCULE** avec fallback

```typescript:361:421:AkwaHomeMobile/src/screens/HostBookingsScreen.tsx
// Utiliser host_net_amount stocké si disponible, sinon utiliser la fonction centralisée
const getHostNetAmount = (booking: HostBooking): number => {
  // Toujours recalculer pour vérifier la cohérence
  const calculated = calculateHostNetAmountCentralized({...});
  
  // Utilise la valeur stockée si disponible, sinon la valeur calculée
  return booking.host_net_amount ?? calculated.hostNetAmount;
}
```

**Problème**: 
- Recalcule systématiquement même si la valeur est stockée
- Logique de "vérification de cohérence" peut créer des différences d'affichage

**Solution recommandée**: 
```typescript
// Utiliser directement la valeur stockée
return booking.host_net_amount ?? 0;
```

---

### 3. ✅ **useVehicleBookings.ts** - Ligne 814-821

**Statut**: ✅ **CORRECT** - Utilise la valeur stockée avec fallback

```typescript:814:821:AkwaHomeMobile/src/hooks/useVehicleBookings.ts
// IMPORTANT: Utiliser host_net_amount stocké si disponible, sinon le calculer
let ownerNetRevenue: number;
if ((booking as any).host_net_amount !== undefined && (booking as any).host_net_amount !== null) {
  // ✅ Utilise la valeur stockée
  ownerNetRevenue = (booking as any).host_net_amount;
} else {
  // Fallback pour anciennes réservations
  const calculatedBasePriceWithDriver = Math.round((booking.total_price || 0) / 1.12);
  const hostCommissionData = calculateHostCommission(calculatedBasePriceWithDriver, 'vehicle');
  ownerNetRevenue = calculatedBasePriceWithDriver - hostCommissionData.hostCommission;
}
```

**Statut**: ✅ **BON** - Priorité à la valeur stockée

---

### 4. ✅ **HostVehicleBookingsScreen.tsx** - Lignes 228-233

**Statut**: ✅ **CORRECT** - Utilise directement la valeur stockée

```typescript:228:233:AkwaHomeMobile/src/screens/HostVehicleBookingsScreen.tsx
// IMPORTANT: Utiliser host_net_amount stocké directement au lieu de recalculer
const getHostNetAmount = (booking: VehicleBooking): number => {
  // Utiliser host_net_amount stocké si disponible, sinon 0
  return (booking as any).host_net_amount || 0;
}
```

**Statut**: ✅ **PARFAIT** - Utilise directement la valeur stockée

---

### 5. ⚠️ **PDF Email (send-email/index.ts)** - Lignes 5539-5544

**Statut**: ⚠️ **RECALCULE** avec tolérance

```typescript:5539:5544:cote-d-ivoire-stays/supabase/functions/send-email/index.ts
// Utiliser host_net_amount stocké seulement s'il correspond au calcul (tolérance de 1 FCFA)
const storedHostNetAmount = bookingData.host_net_amount ?? bookingData.booking?.host_net_amount;
const hostNetAmount = (storedHostNetAmount !== undefined && storedHostNetAmount !== null && Math.abs(storedHostNetAmount - hostNetAmountResult.hostNetAmount) <= 1)
  ? storedHostNetAmount
  : hostNetAmountResult.hostNetAmount;
```

**Problème**: 
- Recalcule toujours d'abord
- Utilise la valeur stockée seulement si elle correspond au calcul (tolérance de 1 FCFA)
- Peut créer des différences si le calcul diffère légèrement

**Solution recommandée**: 
```typescript
// Utiliser directement la valeur stockée en priorité
const hostNetAmount = storedHostNetAmount ?? hostNetAmountResult.hostNetAmount;
```

---

### 6. ⚠️ **HostStatsScreen.tsx** - Lignes 162-177

**Statut**: ⚠️ **RECALCULE** avec fallback

```typescript:162:177:AkwaHomeMobile/src/screens/HostStatsScreen.tsx
// Utiliser host_net_amount stocké si disponible, sinon utiliser la fonction centralisée
if ((booking as any).host_net_amount !== undefined && (booking as any).host_net_amount !== null) {
  return (booking as any).host_net_amount;
} else {
  // RECALCUL pour anciennes réservations
  return calculateHostNetAmount({...}).hostNetAmount;
}
```

**Statut**: ✅ **BON** - Priorité à la valeur stockée, fallback seulement si NULL

---

## 📍 ENDROITS QUI RECALCULENT `total_price`

### 1. ⚠️ **InvoiceDisplay.tsx** (Mobile) - Ligne 137

**Statut**: ⚠️ **RECALCULE** avec fallback

```typescript:137:137:AkwaHomeMobile/src/components/InvoiceDisplay.tsx
const totalPaidByTraveler = booking.total_price || (priceAfterDiscount + effectiveServiceFee + cleaningFee + effectiveTaxes);
```

**Problème**: 
- Recalcule si `total_price` est NULL ou 0
- Le calcul peut différer si les données utilisées ne correspondent pas exactement

**Solution recommandée**: 
```typescript
// Utiliser directement la valeur stockée
const totalPaidByTraveler = booking.total_price ?? 0;
```

---

### 2. ⚠️ **PDF Email (send-email/index.ts)** - Lignes 5553-5556

**Statut**: ⚠️ **RECALCULE** avec vérification

```typescript:5553:5556:cote-d-ivoire-stays/supabase/functions/send-email/index.ts
// Calculer le total payé par le voyageur
const totalPrice = bookingData.totalPrice || bookingData.total_price;
const calculatedTotal = priceAfterDiscount + serviceFee + effectiveCleaningFee + effectiveTaxes;

// Vérifier la cohérence de totalPrice avant de l'utiliser
```

**Problème**: 
- Recalcule toujours pour vérifier la cohérence
- Peut créer des différences si le calcul diffère

---

## 🔴 RISQUES D'INCOHÉRENCES IDENTIFIÉS

### 1. **Différences de calcul pour les véhicules**

**Problème**: 
- Lors de la création: `host_net_amount = basePriceWithDriver - commission`
- Lors de l'affichage: Recalcul avec `priceAfterDiscountWithDriver` qui peut différer si:
  - Les données du véhicule ont changé (`driver_fee`, `price_per_day`, etc.)
  - Les réductions sont recalculées différemment
  - Les heures sont recalculées différemment

**Exemple**:
```typescript
// Création (useVehicleBookings.ts)
basePriceWithDriver = basePrice + driverFee; // Calculé avec données du moment
host_net_amount = basePriceWithDriver - commission;

// Affichage (InvoiceDisplay.tsx)
priceAfterDiscountWithDriver = priceAfterDiscount + driverFee; // Recalculé avec données actuelles
hostNetAmount = priceAfterDiscountWithDriver - hostCommission; // Peut différer !
```

### 2. **Différences d'arrondi**

**Problème**: 
- Les arrondis peuvent différer entre le calcul initial et les recalculs
- Exemple: `Math.round()` peut donner des résultats différents selon l'ordre des opérations

### 3. **Données manquantes ou modifiées**

**Problème**: 
- Si les données du véhicule/propriété ont changé après la réservation
- Le recalcul utilisera les nouvelles valeurs au lieu des valeurs historiques

**Exemple**:
- Véhicule: `driver_fee` modifié après réservation
- Propriété: `price_per_night` modifié après réservation
- Les recalculs utiliseront les nouvelles valeurs

---

## ✅ RECOMMANDATIONS

### 1. **Toujours utiliser les valeurs stockées en priorité**

```typescript
// ✅ BON
const hostNetAmount = booking.host_net_amount ?? 0;
const totalPrice = booking.total_price ?? 0;

// ❌ MAUVAIS
const hostNetAmount = calculateHostNetAmount({...}).hostNetAmount;
const totalPrice = calculateTotal({...});
```

### 2. **Fallback seulement pour anciennes réservations**

```typescript
// ✅ BON - Fallback seulement si NULL (anciennes réservations)
if (booking.host_net_amount !== null && booking.host_net_amount !== undefined) {
  return booking.host_net_amount;
} else {
  // Fallback pour anciennes réservations sans valeur stockée
  return calculateHostNetAmount({...}).hostNetAmount;
}
```

### 3. **Ne pas recalculer pour "vérifier la cohérence"**

```typescript
// ❌ MAUVAIS - Recalcule toujours
const calculated = calculateHostNetAmount({...});
return booking.host_net_amount ?? calculated.hostNetAmount;

// ✅ BON - Utilise directement la valeur stockée
return booking.host_net_amount ?? 0;
```

### 4. **Pour les PDFs et emails**

```typescript
// ✅ BON - Utiliser directement la valeur stockée
const hostNetAmount = bookingData.host_net_amount ?? bookingData.booking?.host_net_amount ?? 0;
const totalPrice = bookingData.totalPrice ?? bookingData.total_price ?? 0;

// ❌ MAUVAIS - Recalculer avec tolérance
const calculated = calculateHostNetAmount({...});
const hostNetAmount = (Math.abs(stored - calculated) <= 1) ? stored : calculated;
```

---

## 📋 FICHIERS À CORRIGER

### Priorité HAUTE (créent des incohérences)

1. ✅ **InvoiceDisplay.tsx** (Mobile)
   - Ligne 624-673: Recalcule `host_net_amount` au lieu d'utiliser la valeur stockée
   - Ligne 137: Recalcule `total_price` au lieu d'utiliser la valeur stockée

2. ✅ **HostBookingsScreen.tsx** (Mobile)
   - Ligne 361-421: Recalcule systématiquement même si valeur stockée

3. ✅ **PDF Email (send-email/index.ts)**
   - Ligne 5539-5544: Recalcule avec tolérance au lieu d'utiliser directement

### Priorité MOYENNE (fallback correct mais peut être amélioré)

4. ✅ **HostStatsScreen.tsx**
   - Ligne 162-177: Fallback correct mais peut être simplifié

---

## 🎯 CONCLUSION

**Oui, il y a plusieurs endroits qui recalculent ces montants** au lieu d'utiliser les valeurs stockées, ce qui peut créer des incohérences :

1. **InvoiceDisplay.tsx** : Recalcule `host_net_amount` et `total_price`
2. **HostBookingsScreen.tsx** : Recalcule systématiquement pour "vérifier"
3. **PDF Email** : Recalcule avec tolérance au lieu d'utiliser directement

**Solution**: Modifier ces fichiers pour utiliser directement les valeurs stockées (`booking.host_net_amount` et `booking.total_price`) en priorité, avec fallback seulement pour les anciennes réservations sans valeur stockée.



