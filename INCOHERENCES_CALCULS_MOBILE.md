# 🔴 INCOHÉRENCES DANS LES CALCULS DE RÉSERVATION VÉHICULES (MOBILE)

## 📋 RÉSUMÉ DES PROBLÈMES IDENTIFIÉS DANS `/home/dev_doctoome/dev_pers/AkwaHomeMobile`

### ❌ **PROBLÈME #1 : Calcul des frais de service sans tenir compte du chauffeur**
**Fichier** : `src/screens/MyVehicleBookingsScreen.tsx` (lignes 220-228)

**Code actuel** :
```typescript
const basePrice = daysPrice + hoursPrice;
const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
```

**Problème** :
- Les frais de service sont calculés sur `priceAfterDiscount` (sans chauffeur)
- Mais les frais de service devraient être calculés sur `priceAfterDiscount + driverFee`
- Le `driverFee` n'est pas récupéré depuis `booking.with_driver` et `vehicle.driver_fee`

**Impact** : Les frais de service sont sous-calculés quand un chauffeur est utilisé.

**Correction nécessaire** :
```typescript
const driverFee = (booking.with_driver && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee;
const serviceFeeHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.travelerFeePercent / 100));
```

---

### ❌ **PROBLÈME #2 : Calcul des frais de service sans tenir compte du chauffeur (détails)**
**Fichier** : `src/screens/VehicleBookingDetailsScreen.tsx` (lignes 310-311)

**Code actuel** :
```typescript
const basePrice = daysPrice + hoursPrice - (booking.discount_amount || 0);
const renterServiceFee = Math.round(basePrice * (commissionRates.travelerFeePercent / 100));
```

**Problème** :
- Même problème que #1 : les frais de service ne tiennent pas compte du chauffeur
- `basePrice` est le prix après réduction SANS chauffeur
- Les frais de service devraient être calculés sur `basePrice + driverFee`

**Impact** : Les frais de service affichés sont incorrects.

**Correction nécessaire** :
```typescript
const basePrice = daysPrice + hoursPrice - (booking.discount_amount || 0);
const driverFee = (booking.with_driver && booking.vehicle?.driver_fee) ? booking.vehicle.driver_fee : 0;
const basePriceWithDriver = basePrice + driverFee;
const renterServiceFeeHT = Math.round(basePriceWithDriver * (commissionRates.travelerFeePercent / 100));
const renterServiceFeeVAT = Math.round(renterServiceFeeHT * 0.20);
const renterServiceFee = renterServiceFeeHT + renterServiceFeeVAT;
```

---

### ❌ **PROBLÈME #3 : Calcul incorrect du `basePrice` et `discountAmount` dans les modifications**
**Fichier** : `src/hooks/useVehicleBookingModifications.ts` (lignes 559-587)

**Code actuel** :
```typescript
const calculatedBasePrice = Math.round((request.requested_total_price || 0) / 1.12);
const hostCommissionData = calculateHostCommission(calculatedBasePrice, 'vehicle');
const ownerNetRevenue = calculatedBasePrice - hostCommissionData.hostCommission + securityDeposit;

const emailData = {
  // ...
  basePrice: calculatedBasePrice,
  totalPrice: request.requested_total_price,
  discountAmount: request.requested_total_price - calculatedBasePrice, // ❌ INCORRECT
  // ...
};
```

**Problème** :
- `calculatedBasePrice = requested_total_price / 1.12` suppose que `requested_total_price` inclut les frais de service (12%)
- Mais `discountAmount = requested_total_price - calculatedBasePrice` est incorrect car :
  - `requested_total_price` = prix après réduction + chauffeur + frais de service
  - `calculatedBasePrice` = prix après réduction + chauffeur (sans frais de service)
  - Donc `discountAmount` = frais de service, pas la réduction !
- Le `discountAmount` devrait être recalculé correctement en utilisant les données du véhicule

**Impact** : Le `discountAmount` dans le PDF est incorrect, ce qui fausse l'affichage.

**Correction nécessaire** :
```typescript
// Calculer correctement le prix après réduction + chauffeur (sans service fee)
const calculatedBasePriceWithDriver = Math.round((request.requested_total_price || 0) / 1.12);

// Récupérer le driverFee depuis bookingData ou vehicle
const driverFee = (bookingData?.with_driver && vehicle?.driver_fee) ? vehicle.driver_fee : 0;

// Calculer le prix après réduction (sans chauffeur)
const calculatedBasePrice = calculatedBasePriceWithDriver - driverFee;

// Recalculer le discountAmount correctement
const daysPrice = (bookingData?.daily_rate || vehicle?.price_per_day || 0) * request.requested_rental_days;
const hoursPrice = (request.requested_rental_hours || 0) * (bookingData?.hourly_rate || vehicle?.price_per_hour || 0);
const totalBeforeDiscount = daysPrice + hoursPrice;
const discountAmount = totalBeforeDiscount - calculatedBasePrice;

// Commission sur basePriceWithDriver
const hostCommissionData = calculateHostCommission(calculatedBasePriceWithDriver, 'vehicle');
const ownerNetRevenue = calculatedBasePriceWithDriver - hostCommissionData.hostCommission + securityDeposit;
```

---

### ❌ **PROBLÈME #4 : Calcul de la commission sans tenir compte du chauffeur**
**Fichier** : `src/screens/HostVehicleBookingsScreen.tsx` (lignes 246-252)

**Code actuel** :
```typescript
const basePrice = daysPrice + hoursPrice;
const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
const hostCommissionData = calculateHostCommission(priceAfterDiscount, 'vehicle');
const hostCommission = hostCommissionData.hostCommission;
return priceAfterDiscount - hostCommission;
```

**Problème** :
- La commission est calculée sur `priceAfterDiscount` (sans chauffeur)
- Mais la commission devrait être calculée sur `priceAfterDiscount + driverFee`
- Le `driverFee` n'est pas récupéré

**Impact** : La commission est sous-calculée, le revenu net du propriétaire est sur-évalué.

**Correction nécessaire** :
```typescript
const basePrice = daysPrice + hoursPrice;
const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
const driverFee = (booking.with_driver && booking.vehicle?.driver_fee) ? booking.vehicle.driver_fee : 0;
const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee;
const hostCommissionData = calculateHostCommission(priceAfterDiscountWithDriver, 'vehicle');
const hostCommission = hostCommissionData.hostCommission;
const securityDeposit = booking.security_deposit || 0;
return priceAfterDiscountWithDriver - hostCommission + securityDeposit; // Inclure la caution
```

---

### ❌ **PROBLÈME #5 : Calcul du `basePrice` depuis `totalPrice` sans données complètes**
**Fichier** : `src/hooks/useVehicleBookings.ts` (ligne 801)

**Code actuel** :
```typescript
const calculatedBasePrice = Math.round((booking.total_price || 0) / 1.12);
const hostCommissionData = calculateHostCommission(calculatedBasePrice, 'vehicle');
const ownerNetRevenue = calculatedBasePrice - hostCommissionData.hostCommission + (booking.security_deposit || 0);
```

**Problème** :
- Cette formule suppose que `total_price = basePriceWithDriver * 1.12`
- Mais il manque les informations nécessaires pour le PDF :
  - `discountAmount` n'est pas recalculé
  - `driverFee` n'est pas séparé
  - Le PDF ne peut pas afficher correctement la décomposition

**Impact** : Le PDF ne peut pas afficher correctement la décomposition prix (jours, heures, réduction, chauffeur).

**Correction nécessaire** :
```typescript
// Calculer basePriceWithDriver depuis totalPrice
const calculatedBasePriceWithDriver = Math.round((booking.total_price || 0) / 1.12);

// Récupérer driverFee depuis booking ou vehicle
const driverFee = (booking.with_driver && booking.vehicle?.driver_fee) ? booking.vehicle.driver_fee : 0;

// Calculer basePrice (sans chauffeur)
const calculatedBasePrice = calculatedBasePriceWithDriver - driverFee;

// Recalculer discountAmount si nécessaire
// (utiliser booking.discount_amount si disponible, sinon recalculer)

// Commission sur basePriceWithDriver
const hostCommissionData = calculateHostCommission(calculatedBasePriceWithDriver, 'vehicle');
const ownerNetRevenue = calculatedBasePriceWithDriver - hostCommissionData.hostCommission + (booking.security_deposit || 0);
```

---

## ✅ **ORDRE DES CALCULS CORRECT**

1. **Prix de base** :
   - `daysPrice = dailyRate * rentalDays`
   - `hoursPrice = hourlyRate * rentalHours`
   - `totalBeforeDiscount = daysPrice + hoursPrice` (SANS chauffeur)

2. **Réduction** :
   - `discountAmount = totalBeforeDiscount * discountPercentage` (si applicable)
   - `priceAfterDiscount = totalBeforeDiscount - discountAmount` (SANS chauffeur)

3. **Chauffeur** :
   - `driverFee = (withDriver) ? vehicle.driver_fee : 0`
   - `priceAfterDiscountWithDriver = priceAfterDiscount + driverFee`

4. **Frais de service** :
   - `serviceFeeHT = priceAfterDiscountWithDriver * 0.10` (10% HT)
   - `serviceFeeVAT = serviceFeeHT * 0.20` (20% TVA)
   - `serviceFee = serviceFeeHT + serviceFeeVAT` (12% TTC)
   - `totalPrice = priceAfterDiscountWithDriver + serviceFee`

5. **Commission propriétaire** :
   - `ownerCommissionHT = priceAfterDiscountWithDriver * 0.02` (2% HT)
   - `ownerCommissionVAT = ownerCommissionHT * 0.20` (20% TVA)
   - `ownerCommission = ownerCommissionHT + ownerCommissionVAT` (2.4% TTC)

6. **Revenu net propriétaire** :
   - `ownerNetRevenue = priceAfterDiscountWithDriver - ownerCommission + securityDeposit`

---

## 🎯 **PRIORITÉS DE CORRECTION**

1. **URGENT** : Corriger `MyVehicleBookingsScreen.tsx` (problème #1)
2. **URGENT** : Corriger `VehicleBookingDetailsScreen.tsx` (problème #2)
3. **URGENT** : Corriger `HostVehicleBookingsScreen.tsx` (problème #4)
4. **IMPORTANT** : Corriger `useVehicleBookingModifications.ts` (problème #3)
5. **IMPORTANT** : Améliorer `useVehicleBookings.ts` (problème #5)

---

## 📝 **RÈGLE GÉNÉRALE**

**TOUJOURS** :
- Calculer les frais de service sur `priceAfterDiscount + driverFee`
- Calculer la commission sur `priceAfterDiscount + driverFee`
- Inclure la `securityDeposit` dans le revenu net du propriétaire
- Séparer `driverFee` du `basePrice` pour l'affichage

**JAMAIS** :
- Calculer les frais de service ou la commission sur `priceAfterDiscount` seul (sans chauffeur)
- Oublier de récupérer `driverFee` depuis `booking.with_driver` et `vehicle.driver_fee`
- Mélanger `totalPrice` (avec service fee) et `basePrice` (sans service fee) dans les calculs


