# 🔍 ANALYSE DES INCOHÉRENCES - CALCULS LOCATION VÉHICULES

## 📋 Vue d'ensemble

Cette analyse compare les calculs de prix dans **4 endroits différents** pour les réservations de véhicules :

1. **Résumé popup** (`VehicleBookingScreen.tsx`) - Lignes 1080-1129
2. **Overview/Details** (`InvoiceDisplay.tsx`, `VehicleBookingDetailsModal.tsx`) - Lignes 400-600
3. **PDF Email** (`generateVehicleBookingPDF`) - Lignes 6642-7300
4. **Email texte** (`getVehicleEmailContent`) - Lignes 5988-6639

---

## 🔴 PROBLÈMES IDENTIFIÉS

### 1. CALCUL DU PRIX DE BASE (basePrice)

#### ✅ VehicleBookingScreen (Résumé popup)
```typescript
// Lignes 511-525
const priceCalculation = calculateVehiclePriceWithHours(
  basePricePerDay,
  rentalDays,
  remainingHours,
  hourlyRateValue,
  discountConfig,
  longStayDiscountConfig
);

const daysPrice = priceCalculation.daysPrice;
const hoursPrice = priceCalculation.hoursPrice;
const basePrice = priceCalculation.basePrice; // Prix après réduction (jours + heures)

// Ligne 540
const driverFee = (withDriver && useDriver === true && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
const basePriceWithDriver = basePrice + driverFee;
```

**✅ COHÉRENT** - `basePrice` = prix après réduction (jours + heures), puis ajout du chauffeur

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 410-417
const daysPrice = pricePerUnit * nights;
const driverFee = (serviceType === 'vehicle' && (booking as any).vehicle?.with_driver && (booking as any).vehicle?.driver_fee && (booking as any).with_driver) 
  ? (booking as any).vehicle.driver_fee 
  : 0;

const basePrice = daysPrice + hoursPrice + driverFee; // ⚠️ INCLUT LE CHAUFFEUR
```

**⚠️ INCOHÉRENCE** : `basePrice` inclut le chauffeur dans InvoiceDisplay, mais pas dans VehicleBookingScreen !

#### ✅ VehicleBookingDetailsModal (Overview/Details)
```typescript
// Lignes 179-194
const daysPrice = (booking.daily_rate || 0) * rentalDays;
const hoursPrice = rentalHours > 0 && hourlyRate > 0 ? rentalHours * hourlyRate : 0;
const basePrice = daysPrice + hoursPrice; // SANS chauffeur
const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
```

**✅ COHÉRENT** - `basePrice` = prix avant réduction (jours + heures), SANS chauffeur

#### ⚠️ PDF Email (generateVehicleBookingPDF)
```typescript
// Lignes 6656-6661
const daysPrice = dailyRate * rentalDays;
const hoursPrice = rentalHours > 0 && hourlyRate > 0 ? rentalHours * hourlyRate : 0;
const driverFee = bookingData.driverFee || ((bookingData.withDriver === true && bookingData.vehicleDriverFee) ? bookingData.vehicleDriverFee : 0);
const originalBasePrice = daysPrice + hoursPrice + driverFee; // ⚠️ INCLUT LE CHAUFFEUR

// Ligne 6668
const totalBeforeDiscount = daysPrice + hoursPrice; // SANS le chauffeur

// Ligne 6739
basePrice = originalBasePrice; // ⚠️ INCLUT LE CHAUFFEUR
```

**🔴 ERREUR CRITIQUE** : `basePrice` est réinitialisé à `originalBasePrice` qui inclut le chauffeur, mais la réduction s'applique sur `totalBeforeDiscount` (sans chauffeur) !

#### ⚠️ Email texte (getVehicleEmailContent)
```typescript
// Ligne 6186 (vehicle_booking_request)
<div class="detail-value" style="color: #059669; font-weight: bold; font-size: 18px;">
  ${(data.ownerNetRevenue !== undefined && data.ownerNetRevenue !== null ? data.ownerNetRevenue : (data.basePrice ? Math.round(data.basePrice * 0.976) : 0)).toLocaleString('fr-FR')} FCFA
</div>
```

**⚠️ PROBLÈME** : Utilise `data.basePrice * 0.976` comme fallback, mais `basePrice` peut inclure ou non le chauffeur selon la source.

---

### 2. CALCUL DE LA RÉDUCTION (discountAmount)

#### ✅ VehicleBookingScreen (Résumé popup)
```typescript
// Lignes 511-525
const priceCalculation = calculateVehiclePriceWithHours(
  basePricePerDay,
  rentalDays,
  remainingHours,
  hourlyRateValue,
  discountConfig,
  longStayDiscountConfig
);

const discountAmount = priceCalculation.discountAmount; // Réduction sur (jours + heures)
```

**✅ COHÉRENT** - Réduction calculée sur (jours + heures) uniquement

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 452-494
if (serviceType === 'vehicle') {
  if (booking.discount_amount && booking.discount_amount > 0) {
    discountAmount = booking.discount_amount; // Utiliser la valeur stockée
  } else if (booking.vehicle) {
    // Recalculer avec calculateVehiclePriceWithHours
    const priceCalculation = calculateVehiclePriceWithHours(
      pricePerUnit,
      nights,
      rentalHours,
      hourlyRateValue,
      discountConfig,
      longStayDiscountConfig
    );
    discountAmount = priceCalculation.discountAmount;
  }
}
```

**✅ COHÉRENT** - Utilise la valeur stockée en priorité, sinon recalcule

#### ⚠️ PDF Email (generateVehicleBookingPDF)
```typescript
// Lignes 6669-6733
let discountAmount = bookingData.discountAmount || 0;

// Si discountAmount n'est pas fourni, recalculer selon les règles
if (!discountAmount || discountAmount === 0) {
  // Priorité absolue à la réduction long séjour si son seuil est atteint
  if (canApplyLongStay && bookingData.vehicleLongStayDiscountPercentage) {
    const discountPercentage = bookingData.vehicleLongStayDiscountPercentage / 100;
    discountAmount = Math.round(totalBeforeDiscount * discountPercentage);
  } else if (canApplyNormal && bookingData.vehicleDiscountPercentage) {
    const discountPercentage = bookingData.vehicleDiscountPercentage / 100;
    discountAmount = Math.round(totalBeforeDiscount * discountPercentage);
  }
} else {
  // Si discountAmount est déjà fourni, vérifier s'il est calculé correctement
  // Le discountAmount devrait être calculé sur (jours + heures) uniquement
  // Si le discountAmount semble être calculé uniquement sur les jours, recalculer
  if (daysPrice > 0 && hoursPrice === 0 && discountAmount <= daysPrice) {
    // Le discountAmount semble être calculé uniquement sur les jours
    // Recalculer le pourcentage et l'appliquer sur le total (jours + heures)
    const discountPercentage = discountAmount / daysPrice;
    discountAmount = Math.round(totalBeforeDiscount * discountPercentage);
  }
}
```

**⚠️ INCOHÉRENCE** : 
- Recalcule la réduction si `discountAmount` est 0, mais utilise la valeur stockée si elle existe
- Tente de "corriger" la réduction si elle semble être calculée uniquement sur les jours
- Cela peut créer des différences si la logique de calcul a changé

#### ⚠️ Email texte (getVehicleEmailContent)
```typescript
// Pas de calcul de réduction dans les emails texte
// Utilise directement data.totalPrice
```

**✅ COHÉRENT** - Les emails texte n'affichent pas la décomposition de la réduction

---

### 3. CALCUL DU PRIX APRÈS RÉDUCTION (priceAfterDiscount)

#### ✅ VehicleBookingScreen (Résumé popup)
```typescript
// Ligne 525
const basePrice = priceCalculation.basePrice; // Prix après réduction (jours + heures)
// Ligne 540
const basePriceWithDriver = basePrice + driverFee; // Prix après réduction + chauffeur
```

**✅ COHÉRENT** - Séparation claire entre prix après réduction et prix avec chauffeur

#### ⚠️ InvoiceDisplay (Overview/Details)
```typescript
// Ligne 503
const priceAfterDiscount = basePrice - discountAmount;
// ⚠️ PROBLÈME : basePrice inclut le chauffeur, donc priceAfterDiscount aussi !
```

**🔴 ERREUR CRITIQUE** : `priceAfterDiscount` inclut le chauffeur alors qu'il ne devrait pas !

#### ✅ VehicleBookingDetailsModal (Overview/Details)
```typescript
// Lignes 191-194
const basePrice = daysPrice + hoursPrice; // SANS chauffeur
const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
```

**✅ COHÉRENT** - `priceAfterDiscount` = prix après réduction (jours + heures), SANS chauffeur

#### ✅ PDF Email (generateVehicleBookingPDF)
```typescript
// Lignes 6735-6738
priceAfterDiscount = totalBeforeDiscount - discountAmount; // Prix après réduction (jours + heures)
const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee; // Prix après réduction + chauffeur
```

**✅ COHÉRENT** - Séparation claire entre `priceAfterDiscount` (sans chauffeur) et `priceAfterDiscountWithDriver` (avec chauffeur)

#### ⚠️ Email texte (getVehicleEmailContent)
```typescript
// Pas de calcul de priceAfterDiscount dans les emails texte
```

**✅ COHÉRENT** - Les emails texte n'affichent pas cette décomposition

---

### 4. CALCUL DES FRAIS DE SERVICE (serviceFee)

#### ✅ VehicleBookingScreen (Résumé popup)
```typescript
// Ligne 543
const fees = calculateFees(basePriceWithDriver, rentalDays, 'vehicle');
// calculateFees calcule: 10% HT + 20% TVA = 12% TTC sur basePriceWithDriver
```

**✅ COHÉRENT** - Frais de service calculés sur `basePriceWithDriver` (prix après réduction + chauffeur)

#### ⚠️ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 526-529
const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
```

**🔴 ERREUR CRITIQUE** : Les frais de service sont calculés sur `priceAfterDiscount` qui inclut le chauffeur (à cause de l'erreur précédente), mais la logique devrait être :
- `priceAfterDiscount` = prix après réduction (sans chauffeur)
- `priceAfterDiscountWithDriver` = prix après réduction + chauffeur
- Frais de service = 12% TTC sur `priceAfterDiscountWithDriver`

#### ✅ VehicleBookingDetailsModal (Overview/Details)
```typescript
// Lignes 196-199
const renterServiceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
const renterServiceFeeVAT = Math.round(renterServiceFeeHT * 0.20);
const renterServiceFee = renterServiceFeeHT + renterServiceFeeVAT;
```

**⚠️ INCOHÉRENCE** : Les frais de service sont calculés sur `priceAfterDiscount` (sans chauffeur), mais ils devraient être calculés sur `priceAfterDiscount + driverFee` !

#### ✅ PDF Email (generateVehicleBookingPDF)
```typescript
// Lignes 6741-6747
const renterFeePercent = 10; // 10% HT pour les véhicules
// IMPORTANT: Les frais de service et commission sont calculés sur le prix APRÈS réduction + chauffeur
const renterServiceFeeHT = Math.round(priceAfterDiscountWithDriver * (renterFeePercent / 100));
const renterServiceFeeVAT = Math.round(renterServiceFeeHT * 0.20);
const renterServiceFee = renterServiceFeeHT + renterServiceFeeVAT;
```

**✅ COHÉRENT** - Frais de service calculés sur `priceAfterDiscountWithDriver` (prix après réduction + chauffeur)

#### ⚠️ Email texte (getVehicleEmailContent)
```typescript
// Pas de calcul de serviceFee dans les emails texte
```

**✅ COHÉRENT** - Les emails texte n'affichent pas cette décomposition

---

### 5. CALCUL DE LA COMMISSION PROPRIÉTAIRE (ownerCommission)

#### ✅ VehicleBookingScreen (Résumé popup)
```typescript
// Non affiché dans le résumé popup (réservé au propriétaire)
```

#### ⚠️ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 531-535
const hostCommissionData = calculateHostCommission(priceAfterDiscount, serviceType);
// ⚠️ PROBLÈME : priceAfterDiscount inclut le chauffeur (à cause de l'erreur précédente)
```

**🔴 ERREUR CRITIQUE** : La commission est calculée sur `priceAfterDiscount` qui inclut le chauffeur, mais elle devrait être calculée sur `priceAfterDiscountWithDriver` !

#### ✅ VehicleBookingDetailsModal (Overview/Details)
```typescript
// Lignes 201-205
const ownerCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
const ownerCommissionVAT = Math.round(ownerCommissionHT * 0.20);
const ownerCommission = ownerCommissionHT + ownerCommissionVAT; // TTC
const ownerNetAmount = priceAfterDiscount - ownerCommission;
```

**⚠️ INCOHÉRENCE** : La commission est calculée sur `priceAfterDiscount` (sans chauffeur), mais elle devrait être calculée sur `priceAfterDiscount + driverFee` !

#### ✅ PDF Email (generateVehicleBookingPDF)
```typescript
// Lignes 6748-6751
const ownerCommissionHT = Math.round(priceAfterDiscountWithDriver * (ownerFeePercent / 100));
const ownerCommissionVAT = Math.round(ownerCommissionHT * 0.20);
const ownerCommission = ownerCommissionHT + ownerCommissionVAT;
```

**✅ COHÉRENT** - Commission calculée sur `priceAfterDiscountWithDriver` (prix après réduction + chauffeur)

#### ⚠️ Email texte (getVehicleEmailContent)
```typescript
// Ligne 6186 (vehicle_booking_request)
${(data.ownerNetRevenue !== undefined && data.ownerNetRevenue !== null ? data.ownerNetRevenue : (data.basePrice ? Math.round(data.basePrice * 0.976) : 0)).toLocaleString('fr-FR')} FCFA
```

**⚠️ PROBLÈME** : Utilise `data.basePrice * 0.976` comme fallback, mais `basePrice` peut inclure ou non le chauffeur selon la source.

---

### 6. CALCUL DU TOTAL PAYÉ PAR LE LOCATAIRE (totalPrice)

#### ✅ VehicleBookingScreen (Résumé popup)
```typescript
// Ligne 544
const totalPrice = basePriceWithDriver + fees.serviceFee;
// = (prix après réduction + chauffeur) + frais de service
```

**✅ COHÉRENT** - Total = prix après réduction + chauffeur + frais de service

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 546-555
const calculatedTotal = priceAfterDiscount + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;
const totalPaidByTraveler = (serviceType === 'vehicle') 
  ? calculatedTotal // Toujours utiliser le calcul pour inclure les frais de service
  : (booking.total_price && Math.abs(booking.total_price - calculatedTotal) <= 100) 
    ? booking.total_price 
    : calculatedTotal;
```

**⚠️ INCOHÉRENCE** : `calculatedTotal` utilise `priceAfterDiscount` qui inclut le chauffeur (à cause de l'erreur précédente), mais la formule est correcte.

#### ✅ VehicleBookingDetailsModal (Overview/Details)
```typescript
// Non affiché dans le modal (réservé au propriétaire)
```

#### ✅ PDF Email (generateVehicleBookingPDF)
```typescript
// Ligne 6752
const totalWithServiceFee = priceAfterDiscountWithDriver + renterServiceFee;
```

**✅ COHÉRENT** - Total = prix après réduction + chauffeur + frais de service

#### ⚠️ Email texte (getVehicleEmailContent)
```typescript
// Lignes 6244, 6293, 6333, 6383 (vehicle_booking_confirmed, vehicle_booking_request_sent)
<li style="padding: 8px 0;"><strong>Prix total:</strong> ${data.totalPrice?.toLocaleString('fr-FR')} FCFA</li>
```

**⚠️ PROBLÈME** : Utilise directement `data.totalPrice` sans vérification de cohérence.

---

### 7. CALCUL DU REVENU NET PROPRIÉTAIRE (ownerNetAmount)

#### ✅ VehicleBookingScreen (Résumé popup)
```typescript
// Non affiché dans le résumé popup (réservé au propriétaire)
```

#### ⚠️ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 570-581
const result = calculateHostNetAmountCentralized({
  pricePerNight: pricePerUnit,
  nights: nights,
  discountAmount: actualDiscountAmount,
  cleaningFee: effectiveCleaningFee,
  taxesPerNight: taxesPerNight,
  freeCleaningMinDays: booking.properties?.free_cleaning_min_days || null,
  status: booking.status || 'confirmed',
  serviceType: serviceType,
});
hostNetAmount = result.hostNetAmount;
```

**⚠️ PROBLÈME** : `calculateHostNetAmountCentralized` est conçue pour les propriétés, pas pour les véhicules. Elle ne prend pas en compte le chauffeur et les heures.

#### ✅ VehicleBookingDetailsModal (Overview/Details)
```typescript
// Lignes 194-205
const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
const ownerCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
const ownerCommissionVAT = Math.round(ownerCommissionHT * 0.20);
const ownerCommission = ownerCommissionHT + ownerCommissionVAT; // TTC
const ownerNetAmount = priceAfterDiscount - ownerCommission;
```

**⚠️ INCOHÉRENCE** : `ownerNetAmount` ne prend pas en compte le chauffeur ! Il devrait être :
- `priceAfterDiscountWithDriver = priceAfterDiscount + driverFee`
- `ownerCommission` calculée sur `priceAfterDiscountWithDriver`
- `ownerNetAmount = priceAfterDiscountWithDriver - ownerCommission + securityDeposit`

#### ✅ PDF Email (generateVehicleBookingPDF)
```typescript
// Lignes 6753-6756
const securityDeposit = bookingData.securityDeposit || bookingData.security_deposit || 0;
const ownerNetAmount = priceAfterDiscountWithDriver - ownerCommission + securityDeposit;
```

**✅ COHÉRENT** - Revenu net = prix après réduction + chauffeur - commission + caution

#### ⚠️ Email texte (getVehicleEmailContent)
```typescript
// Ligne 6186 (vehicle_booking_request)
${(data.ownerNetRevenue !== undefined && data.ownerNetRevenue !== null ? data.ownerNetRevenue : (data.basePrice ? Math.round(data.basePrice * 0.976) : 0)).toLocaleString('fr-FR')} FCFA
```

**⚠️ PROBLÈME** : Utilise `data.basePrice * 0.976` comme fallback, mais `basePrice` peut inclure ou non le chauffeur selon la source.

---

## 📊 RÉSUMÉ DES INCOHÉRENCES

### 🔴 ERREURS CRITIQUES

1. **InvoiceDisplay - `basePrice` inclut le chauffeur** :
   - ❌ `basePrice = daysPrice + hoursPrice + driverFee` (ligne 417)
   - **Impact** : Tous les calculs suivants sont faussés car `priceAfterDiscount` inclut le chauffeur

2. **InvoiceDisplay - Frais de service calculés sur le mauvais montant** :
   - ❌ Calculés sur `priceAfterDiscount` qui inclut le chauffeur (à cause de l'erreur #1)
   - **Impact** : Les frais de service sont incorrects

3. **InvoiceDisplay - Commission calculée sur le mauvais montant** :
   - ❌ Calculée sur `priceAfterDiscount` qui inclut le chauffeur (à cause de l'erreur #1)
   - **Impact** : La commission est incorrecte

4. **VehicleBookingDetailsModal - Commission et revenu net sans chauffeur** :
   - ❌ Commission calculée sur `priceAfterDiscount` (sans chauffeur)
   - ❌ `ownerNetAmount` ne prend pas en compte le chauffeur
   - **Impact** : Le revenu net du propriétaire est sous-évalué

5. **PDF Email - `basePrice` réinitialisé incorrectement** :
   - ❌ `basePrice = originalBasePrice` (ligne 6739) qui inclut le chauffeur
   - **Impact** : `basePrice` dans le PDF ne correspond pas à la valeur réelle utilisée pour les calculs

### ⚠️ INCOHÉRENCES MINEURES

1. **PDF Email - Recalcul de la réduction** :
   - Recalcule la réduction si `discountAmount` est 0, mais utilise la valeur stockée si elle existe
   - Tente de "corriger" la réduction si elle semble être calculée uniquement sur les jours
   - **Impact** : Peut créer des différences si la logique de calcul a changé

2. **Email texte - Utilisation de `data.totalPrice`** :
   - Utilise directement `data.totalPrice` sans vérification de cohérence
   - **Impact** : Montant erroné si les données sont incorrectes

3. **Email texte - Fallback `basePrice * 0.976`** :
   - Utilise `data.basePrice * 0.976` comme fallback pour `ownerNetRevenue`
   - **Impact** : Peut être incorrect si `basePrice` inclut ou non le chauffeur selon la source

---

## ✅ RECOMMANDATIONS

### 1. CORRIGER InvoiceDisplay - Séparer basePrice et driverFee

**Fichier** : `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`

**Ligne 417** - Modifier pour séparer basePrice et driverFee :
```typescript
// AVANT
const basePrice = daysPrice + hoursPrice + driverFee;

// APRÈS
const basePrice = daysPrice + hoursPrice; // SANS chauffeur
const basePriceWithDriver = basePrice + driverFee; // AVEC chauffeur
```

**Ligne 503** - Modifier priceAfterDiscount :
```typescript
// AVANT
const priceAfterDiscount = basePrice - discountAmount;

// APRÈS
const priceAfterDiscount = basePrice - discountAmount; // Prix après réduction (sans chauffeur)
const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee; // Prix après réduction + chauffeur
```

**Lignes 526-529** - Modifier le calcul des frais de service :
```typescript
// AVANT
const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));

// APRÈS
const serviceFeeHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.travelerFeePercent / 100));
```

**Lignes 531-535** - Modifier le calcul de la commission :
```typescript
// AVANT
const hostCommissionData = calculateHostCommission(priceAfterDiscount, serviceType);

// APRÈS
const hostCommissionData = calculateHostCommission(priceAfterDiscountWithDriver, serviceType);
```

**Ligne 547** - Modifier le calcul du total :
```typescript
// AVANT
const calculatedTotal = priceAfterDiscount + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;

// APRÈS
const calculatedTotal = priceAfterDiscountWithDriver + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;
```

### 2. CORRIGER VehicleBookingDetailsModal - Ajouter le chauffeur

**Fichier** : `AkwaHomeMobile/src/components/VehicleBookingDetailsModal.tsx`

**Lignes 194-205** - Modifier pour inclure le chauffeur :
```typescript
// AVANT
const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
const ownerCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
const ownerCommissionVAT = Math.round(ownerCommissionHT * 0.20);
const ownerCommission = ownerCommissionHT + ownerCommissionVAT; // TTC
const ownerNetAmount = priceAfterDiscount - ownerCommission;

// APRÈS
const priceAfterDiscount = basePrice - (booking.discount_amount || 0); // Prix après réduction (sans chauffeur)
const driverFee = (booking.vehicle?.with_driver && booking.vehicle?.driver_fee && booking.with_driver) 
  ? booking.vehicle.driver_fee 
  : 0;
const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee; // Prix après réduction + chauffeur
const ownerCommissionHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.hostFeePercent / 100));
const ownerCommissionVAT = Math.round(ownerCommissionHT * 0.20);
const ownerCommission = ownerCommissionHT + ownerCommissionVAT; // TTC
const securityDeposit = booking.security_deposit || 0;
const ownerNetAmount = priceAfterDiscountWithDriver - ownerCommission + securityDeposit;
```

### 3. CORRIGER PDF Email - Ne pas réinitialiser basePrice

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Ligne 6739** - Modifier pour ne pas réinitialiser basePrice :
```typescript
// AVANT
basePrice = originalBasePrice; // Garder le prix original pour l'affichage

// APRÈS
// Ne pas réinitialiser basePrice - utiliser priceAfterDiscountWithDriver pour l'affichage
// basePrice reste originalBasePrice pour référence historique, mais les calculs utilisent priceAfterDiscountWithDriver
```

### 4. CORRIGER PDF Email - Prioriser la valeur stockée pour discountAmount

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Lignes 6669-6733** - Modifier pour utiliser la valeur stockée en priorité :
```typescript
// AVANT : Recalcule si discountAmount est 0
let discountAmount = bookingData.discountAmount || 0;
if (!discountAmount || discountAmount === 0) {
  // ... recalcul ...
}

// APRÈS : Utiliser la valeur stockée en priorité (comme InvoiceDisplay)
let discountAmount = 0;

// Utiliser la valeur stockée en priorité
if (bookingData.discount_amount !== undefined && bookingData.discount_amount !== null) {
  discountAmount = bookingData.discount_amount;
  console.log('📊 [PDF Véhicule] Utilisation discount_amount stocké:', discountAmount);
} else if (!bookingData.discountAmount || bookingData.discountAmount === 0) {
  // Sinon, recalculer la réduction (pour les anciennes réservations)
  console.log('⚠️ [PDF Véhicule] discount_amount non disponible, recalcul...');
  // ... recalcul ...
} else {
  discountAmount = bookingData.discountAmount;
}
```

### 5. CORRIGER Email texte - Vérifier la cohérence du total

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Lignes 6244, 6293, 6333, 6383** - Ajouter une vérification :
```typescript
// Calculer le total attendu
const expectedTotal = priceAfterDiscountWithDriver + renterServiceFee;
const totalPrice = (data.totalPrice && Math.abs(data.totalPrice - expectedTotal) <= 100)
  ? data.totalPrice
  : expectedTotal;

// Puis utiliser totalPrice au lieu de data.totalPrice
<li style="padding: 8px 0;"><strong>Prix total:</strong> ${totalPrice.toLocaleString('fr-FR')} FCFA</li>
```

---

## 🎯 PRIORITÉS

1. **🔴 URGENT** : Corriger InvoiceDisplay (basePrice inclut le chauffeur)
2. **🔴 URGENT** : Corriger VehicleBookingDetailsModal (commission sans chauffeur)
3. **🟡 IMPORTANT** : Corriger PDF Email (ne pas réinitialiser basePrice)
4. **🟡 IMPORTANT** : Corriger PDF Email (prioriser valeur stockée pour discountAmount)
5. **🟢 MOYEN** : Corriger Email texte (vérifier cohérence du total)

---

## 📝 NOTES

- Les calculs dans `VehicleBookingScreen` sont **cohérents** avec la logique attendue
- `InvoiceDisplay` a des **erreurs critiques** dans le calcul de `basePrice` (inclut le chauffeur)
- `VehicleBookingDetailsModal` ne prend pas en compte le chauffeur dans la commission
- Le PDF email utilise la bonne logique mais réinitialise incorrectement `basePrice`
- Les emails texte utilisent directement les valeurs sans vérification de cohérence

---

**Date de l'analyse** : $(date)
**Auteur** : Analyse automatique
**Version** : 1.0

