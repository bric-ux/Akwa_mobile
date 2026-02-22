# 🔍 ANALYSE DES INCOHÉRENCES - CALCULS RÉSIDENCE MEUBLÉE

## 📋 Vue d'ensemble

Cette analyse compare les calculs de prix dans **4 endroits différents** pour les réservations de résidences meublées :

1. **Résumé popup** (`BookingModal.tsx`) - Lignes 1239-1304
2. **Overview/Details** (`InvoiceDisplay.tsx`) - Lignes 400-600
3. **PDF Email** (`generateInvoicePDFForEmail`) - Lignes 4987-5480
4. **Email texte** (`getEmailContent`) - Lignes 591-857

---

## 🔴 PROBLÈMES IDENTIFIÉS

### 1. CALCUL DU NOMBRE DE NUITS

#### ✅ BookingModal (Résumé popup)
```typescript
// Ligne ~410
const nights = calculateNights(); // Utilise checkIn/checkOut
// Fonction calculateNights() calcule correctement avec Math.ceil
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Ligne 194-197
const nights = Math.ceil(
  (new Date(booking.check_out_date).getTime() - 
   new Date(booking.check_in_date).getTime()) 
  / (1000 * 60 * 60 * 24)
);
```

#### ⚠️ PDF Email (generateInvoicePDFForEmail)
```typescript
// Lignes 5127-5132
let nights = 1;
if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
  const calculatedNights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  nights = calculatedNights > 0 ? calculatedNights : 1; // Minimum 1 nuit
}
```
**✅ COHÉRENT** - Utilise Math.ceil avec minimum de 1 nuit

#### ⚠️ Email texte (getEmailContent)
```typescript
// Ligne 684 (booking_confirmed_host)
const hostNights = data.nights || Math.ceil((new Date(data.checkOutDate || data.checkOut).getTime() - new Date(data.checkInDate || data.checkIn).getTime()) / (1000 * 60 * 60 * 24));
```
**⚠️ PROBLÈME** : Si `data.nights` n'est pas fourni, le calcul peut différer si les dates ne sont pas dans le bon format.

---

### 2. CALCUL DU PRIX DE BASE (basePrice)

#### ✅ BookingModal (Résumé popup)
```typescript
// Ligne 412
const basePrice = effectivePrice !== null ? effectivePrice : (property.price_per_night || 0);
// Puis utilise calculateTotalPrice(basePrice, nights, ...)
// Qui calcule: originalTotal = basePrice * nights
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Ligne 410
const daysPrice = pricePerUnit * nights;
const basePrice = daysPrice; // Pour propriétés, pas d'heures ni chauffeur
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5290
const pricePerNight = bookingData.pricePerNight || bookingData.property?.price_per_night || 0;
// Ligne 5359-5368
const hostNetAmountResult = calculateHostNetAmountForPDF({
  pricePerNight: pricePerNight,
  nights: nights,
  ...
});
// Ligne 5371
const basePrice = hostNetAmountResult.basePrice; // = pricePerNight * nights
```

#### ⚠️ Email texte (getEmailContent)
```typescript
// Ligne 694 (booking_confirmed_host)
const hostBasePrice = hostPricePerNight * hostNights;
```
**✅ COHÉRENT** - Même formule partout

---

### 3. CALCUL DE LA RÉDUCTION (discountAmount)

#### ✅ BookingModal (Résumé popup)
```typescript
// Lignes 414-448
const pricing = calculateFinalPrice(basePrice, nights, discountConfig, {
  cleaning_fee: property.cleaning_fee,
  service_fee: property.service_fee,
  taxes: property.taxes,
  free_cleaning_min_days: property.free_cleaning_min_days
}, longStayDiscountConfig, 'property');

// pricing.pricing.discountAmount contient la réduction calculée
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 421-451
// TOUJOURS utiliser la valeur stockée si elle existe (même si 0)
if (booking.discount_amount !== undefined && booking.discount_amount !== null) {
  discountAmount = booking.discount_amount;
} else {
  // Sinon, recalculer la réduction
  const pricing = calculateTotalPrice(pricePerUnit, nights, discountConfig, longStayDiscountConfig);
  discountAmount = pricing.discountAmount || 0;
}
```

#### ⚠️ PDF Email (generateInvoicePDFForEmail)
```typescript
// Lignes 5299-5356
// BUG FIX: Recalculer la réduction pour garantir la cohérence
let discountAmount = 0;

if (serviceType === 'property' && bookingData.property && pricePerNight > 0 && nights > 0) {
  // Configuration de réduction normale
  const discountConfig = {
    enabled: bookingData.property.discount_enabled || false,
    minNights: bookingData.property.discount_min_nights || null,
    percentage: bookingData.property.discount_percentage || null
  };
  
  // Configuration de réduction long séjour
  const longStayDiscountConfig = bookingData.property.long_stay_discount_enabled ? {
    enabled: bookingData.property.long_stay_discount_enabled || false,
    minNights: bookingData.property.long_stay_discount_min_nights || null,
    percentage: bookingData.property.long_stay_discount_percentage || null
  } : undefined;
  
  try {
    discountAmount = calculateDiscountForPDF(pricePerNight, nights, discountConfig, longStayDiscountConfig);
    
    // BUG FIX: Si discountAmount est 0 mais qu'une réduction devrait s'appliquer, utiliser la valeur stockée
    if (discountAmount === 0 && (bookingData.discount_amount || bookingData.discountAmount)) {
      discountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
        ? bookingData.discount_amount
        : (bookingData.discountAmount || 0);
    }
  } catch (error) {
    // En cas d'erreur, utiliser la valeur stockée
    discountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
      ? bookingData.discount_amount
      : (bookingData.discountAmount || 0);
  }
} else {
  // Fallback : utiliser la valeur stockée
  discountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
    ? bookingData.discount_amount
    : (bookingData.discountAmount || 0);
}

// Lignes 5403-5411
// actualDiscountAmount pour l'affichage
const storedDiscountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
  ? bookingData.discount_amount
  : (bookingData.discountAmount || 0);

// Utiliser la valeur stockée si elle existe, sinon utiliser la valeur calculée
const actualDiscountAmount = (storedDiscountAmount > 0) ? storedDiscountAmount : discountAmount;
```

**⚠️ INCOHÉRENCE MAJEURE** :
- Le PDF **recalcule** toujours la réduction au lieu d'utiliser la valeur stockée en priorité
- Cela peut créer des différences si la logique de calcul a changé entre la création de la réservation et la génération du PDF
- InvoiceDisplay utilise la valeur stockée en priorité, mais le PDF recalcule

#### ⚠️ Email texte (getEmailContent)
```typescript
// Ligne 695 (booking_confirmed_host)
const hostDiscountAmount = data.discountAmount || 0;
```
**⚠️ PROBLÈME** : Utilise `data.discountAmount` (camelCase) mais pas `data.discount_amount` (snake_case). Peut être 0 si les données sont en snake_case.

---

### 4. CALCUL DU PRIX APRÈS RÉDUCTION (priceAfterDiscount)

#### ✅ BookingModal (Résumé popup)
```typescript
// Via calculateTotalPrice qui calcule:
// priceAfterDiscount = basePrice - discountAmount
// Affiché comme: pricing.totalPrice
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Ligne 503
const priceAfterDiscount = basePrice - discountAmount;
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5372
const priceAfterDiscount = hostNetAmountResult.priceAfterDiscount;
// Qui est calculé comme: basePrice - discountAmount
```

#### ✅ Email texte (getEmailContent)
```typescript
// Ligne 696 (booking_confirmed_host)
const hostPriceAfterDiscount = hostBasePrice - hostDiscountAmount;
```
**✅ COHÉRENT** - Même formule partout

---

### 5. CALCUL DES FRAIS DE SERVICE (serviceFee)

#### ✅ BookingModal (Résumé popup)
```typescript
// Via calculateFees qui calcule:
// serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
// serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
// serviceFee = serviceFeeHT + serviceFeeVAT;
// Pour propriétés: 12% + 20% TVA = 14.4% TTC
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 526-529
const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Lignes 5386-5390
const travelerFeePercent = 12; // 12% pour les propriétés
const serviceFeeHT = Math.round(priceAfterDiscount * (travelerFeePercent / 100));
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
const serviceFee = serviceFeeHT + serviceFeeVAT; // TTC
```

#### ⚠️ Email texte (getEmailContent)
```typescript
// Ligne 871 (booking_confirmed_admin)
const adminTravelerFee = Math.round(adminPriceAfterDiscount * 0.12);
// ⚠️ MANQUE LA TVA ! Devrait être:
// const adminTravelerFeeHT = Math.round(adminPriceAfterDiscount * 0.12);
// const adminTravelerFeeVAT = Math.round(adminTravelerFeeHT * 0.20);
// const adminTravelerFee = adminTravelerFeeHT + adminTravelerFeeVAT;
```
**🔴 ERREUR MAJEURE** : L'email admin ne calcule pas la TVA sur les frais de service voyageur !

---

### 6. CALCUL DES FRAIS DE MÉNAGE (cleaningFee)

#### ✅ BookingModal (Résumé popup)
```typescript
// Via calculateFees qui applique free_cleaning_min_days:
const isFreeCleaningApplicable = propertyFees?.free_cleaning_min_days && nights >= propertyFees.free_cleaning_min_days;
const cleaningFee = isFreeCleaningApplicable ? 0 : baseCleaningFee;
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 539-544
let effectiveCleaningFee = cleaningFee !== undefined ? cleaningFee : (booking.properties?.cleaning_fee || 0);

// Appliquer la logique free_cleaning_min_days si applicable
if (serviceType === 'property' && booking.properties?.free_cleaning_min_days && nights >= booking.properties.free_cleaning_min_days) {
  effectiveCleaningFee = 0;
}
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5373
const effectiveCleaningFee = hostNetAmountResult.effectiveCleaningFee;
// Qui est calculé via calculateHostNetAmountForPDF avec la logique free_cleaning_min_days
```

#### ✅ Email texte (getEmailContent)
```typescript
// Lignes 686-692 (booking_confirmed_host)
const hostCleaningFeeRaw = data.property?.cleaning_fee || data.cleaningFee || 0;
const hostFreeCleaningMinDays = data.property?.free_cleaning_min_days || null;
let hostCleaningFee = hostCleaningFeeRaw;
if (hostFreeCleaningMinDays !== null && hostNights >= hostFreeCleaningMinDays) {
  hostCleaningFee = 0; // Frais de ménage gratuits
}
```
**✅ COHÉRENT** - Même logique partout

---

### 7. CALCUL DES TAXES (taxes)

#### ✅ BookingModal (Résumé popup)
```typescript
// Via calculateFees:
const taxesPerNight = propertyFees?.taxes || 0;
const taxes = taxesPerNight * nights;
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 506-509
const taxesPerNight = providedTaxes !== undefined 
  ? providedTaxes 
  : (booking.properties?.taxes || 0);
const effectiveTaxes = serviceType === 'property' ? taxesPerNight * nights : 0;
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5294
const taxesPerNight = bookingData.property?.taxes || 0;
// Ligne 5374
const effectiveTaxes = hostNetAmountResult.effectiveTaxes;
// Qui est calculé comme: taxesPerNight * nights (pour propriétés uniquement)
```

#### ✅ Email texte (getEmailContent)
```typescript
// Ligne 693 (booking_confirmed_host)
const hostTaxes = (data.property?.taxes || data.taxes || 0) * hostNights;
```
**✅ COHÉRENT** - Même formule partout

---

### 8. CALCUL DU TOTAL PAYÉ PAR LE VOYAGEUR (totalPaidByTraveler)

#### ✅ BookingModal (Résumé popup)
```typescript
// Ligne 451
let finalTotal = pricing.finalTotal;
// Qui est: pricing.totalPrice + fees.totalFees
// = priceAfterDiscount + serviceFee + cleaningFee + taxes
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 546-555
const calculatedTotal = priceAfterDiscount + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;
const totalPaidByTraveler = (serviceType === 'vehicle') 
  ? calculatedTotal // Toujours utiliser le calcul pour véhicules
  : (booking.total_price && Math.abs(booking.total_price - calculatedTotal) <= 100) 
    ? booking.total_price 
    : calculatedTotal;
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Lignes 5392-5399
const totalPrice = bookingData.totalPrice || bookingData.total_price;
const calculatedTotal = priceAfterDiscount + serviceFee + effectiveCleaningFee + effectiveTaxes;

// Vérifier la cohérence de totalPrice avant de l'utiliser (comme dans l'application)
const totalPaidByTraveler = (totalPrice && Math.abs(totalPrice - calculatedTotal) <= 100)
  ? totalPrice
  : calculatedTotal;
```

#### ⚠️ Email texte (getEmailContent)
```typescript
// Ligne 653 (booking_confirmed)
<div class="price">${data.totalPrice.toLocaleString('fr-FR')} FCFA</div>
// ⚠️ Utilise directement data.totalPrice sans vérification de cohérence
```

**⚠️ INCOHÉRENCE** : L'email texte utilise directement `data.totalPrice` sans vérifier s'il correspond au calcul. Si les données sont incorrectes, l'email affichera un montant erroné.

---

### 9. CALCUL DE LA COMMISSION HÔTE (hostCommission)

#### ✅ BookingModal (Résumé popup)
```typescript
// Non affiché dans le résumé popup (réservé à l'hôte)
```

#### ✅ InvoiceDisplay (Overview/Details)
```typescript
// Lignes 531-535
const hostCommissionData = calculateHostCommission(priceAfterDiscount, serviceType);
const hostCommission = hostCommissionData.hostCommission;
// = 2% HT + 20% TVA = 2.4% TTC
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Lignes 5375-5377
const hostCommissionHT = hostNetAmountResult.hostCommissionHT;
const hostCommissionVAT = hostNetAmountResult.hostCommissionVAT;
const hostCommission = hostNetAmountResult.hostCommission;
```

#### ⚠️ Email texte (getEmailContent)
```typescript
// Lignes 702-704 (booking_confirmed_host)
const hostCommissionHT = Math.round(hostPriceAfterDiscount * 0.02);
const hostCommissionVAT = Math.round(hostCommissionHT * 0.20);
const hostCommissionAmount = hostCommissionHT + hostCommissionVAT; // TTC
```
**✅ COHÉRENT** - Même formule partout

#### ⚠️ Email texte (getEmailContent - booking_confirmed_admin)
```typescript
// Ligne 872
const adminHostCommission = Math.round(adminPriceAfterDiscount * 0.02);
// ⚠️ MANQUE LA TVA ! Devrait être:
// const adminHostCommissionHT = Math.round(adminPriceAfterDiscount * 0.02);
// const adminHostCommissionVAT = Math.round(adminHostCommissionHT * 0.20);
// const adminHostCommission = adminHostCommissionHT + adminHostCommissionVAT;
```
**🔴 ERREUR MAJEURE** : L'email admin ne calcule pas la TVA sur la commission hôte !

---

### 10. CALCUL DU MONTANT NET HÔTE (hostNetAmount)

#### ✅ BookingModal (Résumé popup)
```typescript
// Non affiché dans le résumé popup (réservé à l'hôte)
```

#### ✅ InvoiceDisplay (Overview/Details)
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
// = priceAfterDiscount + effectiveCleaningFee + effectiveTaxes - hostCommission
```

#### ✅ PDF Email (generateInvoicePDFForEmail)
```typescript
// Lignes 5379-5384
const storedHostNetAmount = bookingData.host_net_amount ?? bookingData.booking?.host_net_amount;
const hostNetAmount = (storedHostNetAmount !== undefined && storedHostNetAmount !== null && Math.abs(storedHostNetAmount - hostNetAmountResult.hostNetAmount) <= 1)
  ? storedHostNetAmount
  : hostNetAmountResult.hostNetAmount;
```

#### ⚠️ Email texte (getEmailContent)
```typescript
// Lignes 698-706 (booking_confirmed_host)
let hostNetRevenue = data.host_net_amount;
if (hostNetRevenue === undefined || hostNetRevenue === null) {
  // Recalculer pour les anciennes réservations
  const hostCommissionHT = Math.round(hostPriceAfterDiscount * 0.02);
  const hostCommissionVAT = Math.round(hostCommissionHT * 0.20);
  const hostCommissionAmount = hostCommissionHT + hostCommissionVAT; // TTC
  hostNetRevenue = hostTotalAmount - hostCommissionAmount;
}
```
**✅ COHÉRENT** - Utilise la valeur stockée en priorité, sinon recalcule

---

## 📊 RÉSUMÉ DES INCOHÉRENCES

### 🔴 ERREURS CRITIQUES

1. **Email admin (`booking_confirmed_admin`)** :
   - ❌ Ne calcule pas la TVA sur les frais de service voyageur (ligne 871)
   - ❌ Ne calcule pas la TVA sur la commission hôte (ligne 872)
   - **Impact** : Les revenus Akwahome affichés dans l'email admin sont incorrects

2. **PDF Email - Calcul de la réduction** :
   - ⚠️ Recalcule toujours la réduction au lieu d'utiliser la valeur stockée en priorité
   - **Impact** : Si la logique de calcul a changé, le PDF peut afficher une réduction différente de celle affichée dans l'overview

3. **Email texte - Utilisation de `data.totalPrice`** :
   - ⚠️ Utilise directement `data.totalPrice` sans vérification de cohérence
   - **Impact** : Si les données sont incorrectes, l'email affichera un montant erroné

### ⚠️ INCOHÉRENCES MINEURES

1. **Email texte - `discountAmount`** :
   - Utilise `data.discountAmount` (camelCase) mais pas `data.discount_amount` (snake_case)
   - **Impact** : Peut être 0 si les données sont en snake_case

2. **Email texte - Calcul de `nights`** :
   - Si `data.nights` n'est pas fourni, le calcul peut différer selon le format des dates
   - **Impact** : Calcul incorrect du nombre de nuits si les dates ne sont pas dans le bon format

---

## ✅ RECOMMANDATIONS

### 1. CORRIGER L'EMAIL ADMIN

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Ligne 871** - Ajouter la TVA sur les frais de service voyageur :
```typescript
// AVANT
const adminTravelerFee = Math.round(adminPriceAfterDiscount * 0.12);

// APRÈS
const adminTravelerFeeHT = Math.round(adminPriceAfterDiscount * 0.12);
const adminTravelerFeeVAT = Math.round(adminTravelerFeeHT * 0.20);
const adminTravelerFee = adminTravelerFeeHT + adminTravelerFeeVAT;
```

**Ligne 872** - Ajouter la TVA sur la commission hôte :
```typescript
// AVANT
const adminHostCommission = Math.round(adminPriceAfterDiscount * 0.02);

// APRÈS
const adminHostCommissionHT = Math.round(adminPriceAfterDiscount * 0.02);
const adminHostCommissionVAT = Math.round(adminHostCommissionHT * 0.20);
const adminHostCommission = adminHostCommissionHT + adminHostCommissionVAT;
```

**Ligne 875** - Corriger le calcul des revenus Akwahome :
```typescript
// AVANT
const adminAkwahomeRevenue = adminTravelerFee + adminHostCommission;

// APRÈS (déjà correct si on corrige les lignes précédentes)
const adminAkwahomeRevenue = adminTravelerFee + adminHostCommission;
```

### 2. CORRIGER LE PDF EMAIL - PRIORISER LA VALEUR STOCKÉE

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Lignes 5299-5356** - Modifier pour utiliser la valeur stockée en priorité :
```typescript
// AVANT : Recalcule toujours
let discountAmount = 0;
if (serviceType === 'property' && bookingData.property && pricePerNight > 0 && nights > 0) {
  // ... recalcul ...
}

// APRÈS : Utiliser la valeur stockée en priorité (comme InvoiceDisplay)
let discountAmount = 0;

// Utiliser la valeur stockée en priorité (comme InvoiceDisplay)
if (bookingData.discount_amount !== undefined && bookingData.discount_amount !== null) {
  discountAmount = bookingData.discount_amount;
  console.log('📊 [PDF] Utilisation discount_amount stocké:', discountAmount);
} else if (serviceType === 'property' && bookingData.property && pricePerNight > 0 && nights > 0) {
  // Sinon, recalculer la réduction (pour les anciennes réservations)
  console.log('⚠️ [PDF] discount_amount non disponible, recalcul...');
  const discountConfig = {
    enabled: bookingData.property.discount_enabled || false,
    minNights: bookingData.property.discount_min_nights || null,
    percentage: bookingData.property.discount_percentage || null
  };
  
  const longStayDiscountConfig = bookingData.property.long_stay_discount_enabled ? {
    enabled: bookingData.property.long_stay_discount_enabled || false,
    minNights: bookingData.property.long_stay_discount_min_nights || null,
    percentage: bookingData.property.long_stay_discount_percentage || null
  } : undefined;
  
  try {
    discountAmount = calculateDiscountForPDF(pricePerNight, nights, discountConfig, longStayDiscountConfig);
    console.log('📊 [PDF] Réduction recalculée:', discountAmount);
  } catch (error) {
    console.error('❌ [PDF] Erreur calcul réduction:', error);
    discountAmount = 0;
  }
} else {
  // Fallback : utiliser la valeur stockée si disponible
  discountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
    ? bookingData.discount_amount
    : (bookingData.discountAmount || 0);
}
```

### 3. CORRIGER L'EMAIL TEXTE - VÉRIFIER LA COHÉRENCE DU TOTAL

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Ligne 653** (booking_confirmed) - Ajouter une vérification :
```typescript
// Calculer le total attendu
const expectedTotal = hostPriceAfterDiscount + adminTravelerFee + hostCleaningFee + hostTaxes;
const totalPrice = (data.totalPrice && Math.abs(data.totalPrice - expectedTotal) <= 100)
  ? data.totalPrice
  : expectedTotal;

// Puis utiliser totalPrice au lieu de data.totalPrice
<div class="price">${totalPrice.toLocaleString('fr-FR')} FCFA</div>
```

### 4. CORRIGER L'EMAIL TEXTE - SUPPORT SNAKE_CASE POUR discountAmount

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Ligne 695** (booking_confirmed_host) :
```typescript
// AVANT
const hostDiscountAmount = data.discountAmount || 0;

// APRÈS
const hostDiscountAmount = data.discount_amount !== undefined && data.discount_amount !== null
  ? data.discount_amount
  : (data.discountAmount || 0);
```

---

## 🎯 PRIORITÉS

1. **🔴 URGENT** : Corriger l'email admin (TVA manquante)
2. **🟡 IMPORTANT** : Corriger le PDF email (prioriser la valeur stockée)
3. **🟡 IMPORTANT** : Corriger l'email texte (vérifier la cohérence du total)
4. **🟢 MOYEN** : Support snake_case pour discountAmount dans les emails

---

## 📝 NOTES

- Les calculs dans `BookingModal` et `InvoiceDisplay` sont **cohérents** entre eux
- Le PDF email utilise une logique similaire mais **recalcule** la réduction au lieu d'utiliser la valeur stockée
- L'email texte utilise directement les valeurs sans vérification de cohérence
- L'email admin a des **erreurs critiques** dans le calcul des commissions (TVA manquante)

---

**Date de l'analyse** : $(date)
**Auteur** : Analyse automatique
**Version** : 1.0




