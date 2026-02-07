# 🔧 CORRECTION INCOHÉRENCE APRÈS MODIFICATION

## 🔴 PROBLÈME IDENTIFIÉ

Après modification d'une réservation véhicule, les montants affichés dans les détails et dans les PDF ne sont pas cohérents.

### Causes identifiées :

1. **Dans `updateVehicleBookingCalculationDetails`** :
   - Le calcul utilisait `basePrice = totalBeforeDiscount - discountAmount`
   - Mais `totalBeforeDiscount` était calculé avec les NOUVELLES valeurs (nouveaux jours/heures)
   - Alors que `discountAmount` était l'ANCIEN montant de réduction
   - Cela créait une incohérence car on soustrayait l'ancienne réduction du nouveau total

2. **Dans `VehicleModificationModal.tsx`** :
   - Le calcul du `totalPrice` ne prenait PAS en compte le `driverFee`
   - Si la réservation originale avait un chauffeur, le nouveau `totalPrice` était incorrect

---

## ✅ CORRECTIONS APPLIQUÉES

### **CORRECTION #1 : Préservation de la réduction dans `updateVehicleBookingCalculationDetails`**

**Fichier** : `updateBookingCalculationDetails.ts`

**Avant** :
```typescript
basePrice = totalBeforeDiscount - discountAmount; // ❌ Incohérent
```

**Après** :
```typescript
// Récupérer l'ancien price_after_discount depuis booking_calculation_details
const { data: oldCalculationDetails } = await supabase
  .from('booking_calculation_details')
  .select('price_after_discount, days_price, hours_price, discount_amount')
  .eq('booking_id', bookingId)
  .eq('booking_type', 'vehicle')
  .single();

if (oldPriceAfterDiscount !== null && (rentalDays !== oldRentalDays || rentalHours !== oldRentalHours)) {
  // C'est une modification : préserver la réduction
  const additionalDaysPrice = (rentalDays - oldRentalDays) > 0 ? (rentalDays - oldRentalDays) * dailyRate : 0;
  const additionalHoursPrice = (rentalHours - oldRentalHours) > 0 ? (rentalHours - oldRentalHours) * hourlyRate : 0;
  const additionalPrice = additionalDaysPrice + additionalHoursPrice;
  
  // Le nouveau prix après réduction = ancien prix après réduction + prix supplémentaires (sans réduction)
  basePrice = oldPriceAfterDiscount + additionalPrice;
  
  // La réduction reste la même
  discountAmount = oldCalculationDetails?.discount_amount || discountAmount;
}
```

✅ **Résultat** : La réduction est préservée correctement, comme dans `VehicleModificationModal.tsx`

---

### **CORRECTION #2 : Inclusion du `driverFee`` dans le calcul du `totalPrice` du modal**

**Fichier** : `VehicleModificationModal.tsx`

**Avant** :
```typescript
const basePrice = currentPriceAfterDiscount + additionalPrice;
const totalPrice = basePrice + effectiveServiceFee; // ❌ Pas de driverFee
```

**Après** :
```typescript
const basePrice = currentPriceAfterDiscount + additionalPrice;
// ✅ Ajouter le driverFee si applicable (préservé de l'ancienne réservation)
const driverFee = (booking.with_driver && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
const basePriceWithDriver = basePrice + driverFee;

// ✅ Les frais de service sont calculés sur basePriceWithDriver (inclut le chauffeur)
const serviceFeeHT = Math.round(basePriceWithDriver * (commissionRates.travelerFeePercent / 100));
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
const totalPrice = basePriceWithDriver + effectiveServiceFee; // ✅ Total correct
```

✅ **Résultat** : Le `totalPrice` inclut maintenant correctement le `driverFee` si applicable

---

## 📊 VÉRIFICATIONS

### 1. **Les données sont-elles récupérées depuis la base ?**

✅ **OUI** :
- `InvoiceDisplay.tsx` : Récupère `booking_calculation_details` et utilise les valeurs stockées
- `VehicleBookingDetailsModal.tsx` : Récupère `booking_calculation_details` et utilise les valeurs stockées
- `send-email/index.ts` (PDF) : Récupère `booking_calculation_details` et utilise les valeurs stockées

### 2. **Les données sont-elles mises à jour après modification ?**

✅ **OUI** :
- `approveModificationRequest` appelle `updateVehicleBookingCalculationDetails`
- `updateVehicleBookingCalculationDetails` met à jour `booking_calculation_details` avec les nouvelles valeurs
- Les nouvelles valeurs préservent correctement la réduction

### 3. **La cohérence est-elle garantie ?**

✅ **OUI** (après corrections) :
- Le calcul dans le modal préserve la réduction
- Le calcul dans `updateVehicleBookingCalculationDetails` préserve la réduction
- Les deux utilisent la même logique : `ancienPriceAfterDiscount + prixSupplémentaires`
- Le `driverFee` est inclus dans les deux calculs

---

## 🎯 RÉSULTAT ATTENDU

Après ces corrections :
1. ✅ Les montants dans les détails correspondent aux montants dans les PDF
2. ✅ Les montants sont récupérés depuis `booking_calculation_details` (données stockées)
3. ✅ La réduction est préservée lors de la modification
4. ✅ Le `driverFee` est inclus dans tous les calculs

---

## 📝 NOTES

- Les anciennes réservations (sans `booking_calculation_details`) utiliseront le fallback de recalcul
- Les nouvelles réservations et modifications utiliseront les données stockées
- La cohérence est garantie car tous les calculs utilisent la même logique de préservation de la réduction

