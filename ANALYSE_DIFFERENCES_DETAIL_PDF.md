# Analyse des différences : Onglet Détail vs PDFs envoyés par mail
## 🏠 RÉSIDENCES MEUBLÉES UNIQUEMENT

## 📋 Vue d'ensemble

Cette analyse compare les **calculs** et **informations** affichés dans :
1. **Onglet Détail** (mobile) : `InvoiceDisplay.tsx` dans `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`
2. **PDFs envoyés par mail** : `generateInvoicePDFForEmail()` dans `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**⚠️ Cette analyse concerne uniquement les résidences meublées (propriétés), pas les véhicules.**

---

## 🔍 COMPARAISON DES CALCULS

### 1. Calcul du nombre de nuits

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 384-387 (pour propriétés uniquement)
// Pour les propriétés: calcul standard
const calculatedNights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
nights = calculatedNights > 0 ? calculatedNights : 1; // Minimum 1 nuit
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 4936-4939
let nights = 0;
if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
  nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
}
```

**⚠️ DIFFÉRENCE IDENTIFIÉE :**
- **Onglet Détail** : Garantit un minimum de 1 nuit si le calcul donne 0
- **PDF Email** : Peut afficher 0 nuit si le calcul donne 0
- **Impact** : Pour les réservations d'une seule nuit, le PDF peut afficher 0 nuit au lieu de 1

---

### 2. Calcul de la réduction (discount_amount)

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 420-498
// Pour les propriétés, TOUJOURS utiliser la valeur stockée si elle existe (même si 0)
if (booking.discount_amount !== undefined && booking.discount_amount !== null) {
  discountAmount = booking.discount_amount;
} else {
  // Sinon, recalculer la réduction (pour les anciennes réservations)
  const pricing = calculateTotalPrice(pricePerUnit, nights, discountConfig, longStayDiscountConfig);
  discountAmount = pricing.discountAmount || 0;
}
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5098-5100
const discountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
  ? bookingData.discount_amount
  : (bookingData.discountAmount || 0);
```

**✅ COHÉRENT :** Les deux utilisent la valeur stockée en priorité

---

### 3. Calcul du prix de base (basePrice)

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 409-410 (pour propriétés uniquement)
const daysPrice = pricePerUnit * nights;
const basePrice = daysPrice; // Pour propriétés, pas d'heures ni chauffeur
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5122
const basePrice = hostNetAmountResult.basePrice;
// Calculé via calculateHostNetAmountForPDF qui fait:
// basePrice = pricePerNight * nights
```

**✅ COHÉRENT :** Les deux utilisent la même formule pour les propriétés : `pricePerNight * nights`

---

### 4. Calcul des frais de service avec TVA

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 526-529
const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5137-5141
const travelerFeePercent = 12; // 12% pour les propriétés
const serviceFeeHT = Math.round(priceAfterDiscount * (travelerFeePercent / 100));
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
const serviceFee = serviceFeeHT + serviceFeeVAT; // TTC
```

**✅ COHÉRENT :** Les deux utilisent la même formule (12% pour propriétés, 10% pour véhicules)

---

### 5. Calcul de la commission hôte avec TVA

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 531-535
const hostCommissionData = calculateHostCommission(priceAfterDiscount, serviceType);
const hostCommission = hostCommissionData.hostCommission;
const hostCommissionHT = hostCommissionData.hostCommissionHT;
const hostCommissionVAT = hostCommissionData.hostCommissionVAT;
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5126-5128
const hostCommissionHT = hostNetAmountResult.hostCommissionHT;
const hostCommissionVAT = hostNetAmountResult.hostCommissionVAT;
const hostCommission = hostNetAmountResult.hostCommission;
// Calculé via calculateHostNetAmountForPDF
```

**✅ COHÉRENT :** Les deux utilisent des fonctions centralisées pour le calcul

---

### 6. Calcul des frais de ménage (cleaning fee)

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 537-544
let effectiveCleaningFee = cleaningFee !== undefined ? cleaningFee : (booking.properties?.cleaning_fee || 0);

// Appliquer la logique free_cleaning_min_days si applicable
if (serviceType === 'property' && booking.properties?.free_cleaning_min_days && nights >= booking.properties.free_cleaning_min_days) {
  effectiveCleaningFee = 0;
}
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5124
const effectiveCleaningFee = hostNetAmountResult.effectiveCleaningFee;
// Calculé via calculateHostNetAmountForPDF qui applique free_cleaning_min_days
```

**✅ COHÉRENT :** Les deux appliquent la logique `free_cleaning_min_days`

---

### 7. Calcul de la taxe de séjour

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 505-509
const taxesPerNight = providedTaxes !== undefined 
  ? providedTaxes 
  : (booking.properties?.taxes || 0);
const effectiveTaxes = serviceType === 'property' ? taxesPerNight * nights : 0;
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5125
const effectiveTaxes = hostNetAmountResult.effectiveTaxes;
// Calculé via calculateHostNetAmountForPDF: taxesPerNight * nights
```

**✅ COHÉRENT :** Les deux multiplient la taxe par nuit par le nombre de nuits

---

### 8. Calcul du total payé par le voyageur

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 546-555 (pour propriétés uniquement)
const calculatedTotal = priceAfterDiscount + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;
const totalPaidByTraveler = (booking.total_price && Math.abs(booking.total_price - calculatedTotal) <= 100) 
  ? booking.total_price 
  : calculatedTotal;
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5144-5150
const totalPrice = bookingData.totalPrice || bookingData.total_price;
const calculatedTotal = priceAfterDiscount + serviceFee + effectiveCleaningFee + effectiveTaxes;
const totalPaidByTraveler = (totalPrice && Math.abs(totalPrice - calculatedTotal) <= 100)
  ? totalPrice
  : calculatedTotal;
```

**✅ COHÉRENT :** Les deux utilisent la même logique avec tolérance de 100 FCFA pour les propriétés

---

### 9. Calcul du revenu net de l'hôte (host_net_amount)

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 556-587
// Toujours recalculer pour garantir la cohérence
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

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5109-5135
const hostNetAmountResult = calculateHostNetAmountForPDF({
  pricePerNight: pricePerNight,
  nights: nights,
  discountAmount: discountAmount,
  cleaningFee: cleaningFeeRaw,
  taxesPerNight: taxesPerNight,
  freeCleaningMinDays: freeCleaningMinDays,
  status: status,
  serviceType: serviceType,
});

// Utiliser host_net_amount stocké seulement s'il correspond au calcul (tolérance de 1 FCFA)
const storedHostNetAmount = bookingData.host_net_amount ?? bookingData.booking?.host_net_amount;
const hostNetAmount = (storedHostNetAmount !== undefined && storedHostNetAmount !== null && Math.abs(storedHostNetAmount - hostNetAmountResult.hostNetAmount) <= 1)
  ? storedHostNetAmount
  : hostNetAmountResult.hostNetAmount;
```

**⚠️ DIFFÉRENCE IDENTIFIÉE :**
- **Onglet Détail** : Toujours recalcule (utilise toujours la valeur calculée)
- **PDF Email** : Utilise la valeur stockée si elle correspond au calcul (tolérance de 1 FCFA)
- **Impact** : Légère différence possible si la valeur stockée est légèrement différente

---

## 📊 COMPARAISON DES INFORMATIONS AFFICHÉES

### 1. Détails TVA

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 1042-1056
// Détails TVA pour frais de service
<View style={styles.vatDetailsContainer}>
  <View style={styles.vatDetailRow}>
    <Text>Frais de base (HT)</Text>
    <Text>{formatPriceFCFA(serviceFeeHT)}</Text>
  </View>
  <View style={styles.vatDetailRow}>
    <Text>TVA (20%)</Text>
    <Text>{formatPriceFCFA(serviceFeeVAT)}</Text>
  </View>
  <View style={styles.vatDetailRow}>
    <Text>Total (TTC)</Text>
    <Text>{formatPriceFCFA(effectiveServiceFee)}</Text>
  </View>
</View>
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5379-5394
// Détails TVA pour frais de service (section grise comme sur mobile)
doc.setFillColor(249, 250, 251); // Gris clair #f9fafb
doc.rect(15, yPosition, 180, 20, 'F');
doc.text("Frais de base (HT)", 20, yPosition + 6);
doc.text(formatPriceForPDF(serviceFeeHT), 170, yPosition + 6, { align: 'right' });
doc.text("TVA (20%)", 20, yPosition + 12);
doc.text(formatPriceForPDF(serviceFeeVAT), 170, yPosition + 12, { align: 'right' });
doc.text("Total (TTC)", 20, yPosition + 18);
doc.text(formatPriceForPDF(serviceFee), 170, yPosition + 18, { align: 'right' });
```

**✅ COHÉRENT :** Les deux affichent les détails TVA pour les frais de service

---

### 2. Contact hôte/voyageur

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 1082-1091
{hostName && hostPhone && (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed') && (
  <View style={styles.contactSection}>
    <View style={styles.contactHeader}>
      <Ionicons name="call-outline" size={16} color="#333" />
      <Text style={styles.contactTitle}>Contact de l'hôte</Text>
    </View>
    <Text style={styles.contactName}>{hostName}</Text>
    <Text style={styles.contactPhone}>{hostPhone}</Text>
  </View>
)}
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5492-5534
// Contact hôte/voyageur (comme sur mobile)
if (pdfType === 'traveler' && bookingData.host?.phone) {
  doc.text("Contact de l'hôte", 15, yPosition);
  doc.text(hostName, 15, yPosition);
  doc.text(`Téléphone: ${bookingData.host.phone}`, 15, yPosition);
} else if (pdfType === 'host' && bookingData.guest?.phone) {
  doc.text("Contact du voyageur", 15, yPosition);
  doc.text(guestName, 15, yPosition);
  doc.text(`Téléphone: ${bookingData.guest.phone}`, 15, yPosition);
}
```

**✅ COHÉRENT :** Les deux affichent le contact, mais le PDF ne vérifie pas le statut de la réservation

---

### 3. Règlement intérieur (house_rules)

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 1487-1495
{serviceType === 'property' && booking.properties?.house_rules && (
  <View style={styles.rulesSection}>
    <View style={styles.rulesHeader}>
      <Ionicons name="document-text-outline" size={18} color="#2563eb" />
      <Text style={styles.rulesTitle}>Règlement intérieur</Text>
    </View>
    <Text style={styles.rulesText}>{booking.properties.house_rules}</Text>
  </View>
)}
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5576-5595
// Règlement intérieur (section colorée bleue comme sur mobile)
if (bookingData.property?.house_rules) {
  doc.setFillColor(240, 249, 255); // #f0f9ff
  doc.setDrawColor(37, 99, 235); // #2563eb
  doc.text("Règlement intérieur", 20, yPosition + 8);
  doc.text(rulesText, 20, yPosition);
}
```

**✅ COHÉRENT :** Les deux affichent le règlement intérieur avec un style similaire

---

### 4. Politique d'annulation

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 1472-1484
<View style={styles.cancellationSection}>
  <View style={styles.cancellationHeader}>
    <Ionicons name="information-circle-outline" size={18} color="#f59e0b" />
    <Text style={styles.cancellationTitle}>Politique d'annulation</Text>
  </View>
  <Text style={styles.cancellationText}>
    {getCancellationPolicyText(
      serviceType === 'property' ? booking.properties?.cancellation_policy : undefined,
      serviceType
    )}
  </Text>
</View>
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 5550-5573
if (bookingData.property?.cancellation_policy) {
  // Section colorée jaune comme sur mobile
  doc.setFillColor(255, 251, 235); // #fffbeb
  doc.setDrawColor(245, 158, 11); // #f59e0b
  doc.text("Politique d'annulation", 20, yPosition + 8);
  doc.text(splitPolicy, 20, yPosition);
}
```

**✅ COHÉRENT :** Les deux affichent la politique d'annulation avec un style similaire

---

### 5. Prolongement de séjour (modifications approuvées)

#### Onglet Détail (InvoiceDisplay.tsx)
```typescript
// Ligne 854-914
{approvedModification && (
  <View style={styles.extensionSection}>
    <View style={styles.extensionHeader}>
      <Ionicons name="calendar-outline" size={20} color="#2563eb" />
      <Text style={styles.extensionTitle}>Prolongement de séjour</Text>
    </View>
    {/* Affiche dates originales, nouvelles dates, surplus payé */}
  </View>
)}
```

#### PDF Email (generateInvoicePDFForEmail)
```typescript
// Ligne 4994-5080
// Section Prolongement de séjour (si modification approuvée)
if (bookingData.bookingId) {
  const { data: modification } = await supabaseClient
    .from('booking_modification_requests')
    .select('*')
    .eq('booking_id', bookingData.bookingId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (modification) {
    // Affiche dates originales, nouvelles dates, surplus payé
  }
}
```

**✅ COHÉRENT :** Les deux récupèrent et affichent les modifications approuvées

---


## 🎯 RÉSUMÉ DES DIFFÉRENCES (RÉSIDENCES MEUBLÉES)

### Différences de calculs

1. **Nombre de nuits** ⚠️
   - Onglet Détail : Garantit un minimum de 1 nuit (si calcul = 0, affiche 1)
   - PDF Email : Peut afficher 0 nuit si le calcul donne 0
   - **Impact** : Pour les réservations d'une seule nuit, le PDF peut afficher 0 nuit au lieu de 1

2. **Revenu net hôte (host_net_amount)** ⚠️
   - Onglet Détail : Toujours recalcule (utilise toujours la valeur calculée)
   - PDF Email : Utilise valeur stockée si cohérente (tolérance 1 FCFA)
   - **Impact** : Légère différence possible si la valeur stockée est légèrement différente

### Différences d'informations

1. **Contact hôte/voyageur** ⚠️
   - Onglet Détail : Affiche seulement si réservation confirmée/en cours/terminée
   - PDF Email : Affiche toujours si disponible (ne vérifie pas le statut)
   - **Impact** : Le PDF peut afficher le contact même pour les réservations en attente

---

## 📝 RECOMMANDATIONS (RÉSIDENCES MEUBLÉES)

### 1. Harmoniser le calcul des nuits
- **Action** : Garantir un minimum de 1 nuit dans le PDF email aussi
- **Suggestion** : Modifier la ligne 4938 dans `generateInvoicePDFForEmail` pour ajouter `Math.max(1, nights)`

### 2. Harmoniser le calcul du revenu net hôte
- **Action** : Toujours recalculer dans le PDF email (comme dans l'onglet détail)
- **Suggestion** : Utiliser uniquement la valeur calculée, pas la valeur stockée (ligne 5130-5135)

### 3. Harmoniser l'affichage du contact
- **Action** : Vérifier le statut de la réservation dans le PDF email avant d'afficher le contact
- **Suggestion** : Utiliser la même condition que dans l'onglet détail (ligne 5492-5534)

---

## 🔧 FICHIERS À MODIFIER (RÉSIDENCES MEUBLÉES)

1. `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`
   - **Ligne 4936-4939** : Garantir un minimum de 1 nuit (ajouter `Math.max(1, nights)`)
   - **Ligne 5130-5135** : Toujours utiliser la valeur calculée pour hostNetAmount (pas la valeur stockée)
   - **Ligne 5492-5534** : Vérifier le statut de la réservation avant d'afficher le contact (comme dans l'onglet détail)

2. `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`
   - Vérifier que tous les calculs utilisent les fonctions centralisées
   - S'assurer que la logique est cohérente avec le PDF email

---

## ✅ POINTS COHÉRENTS

Les éléments suivants sont **déjà cohérents** entre l'onglet détail et le PDF email :

1. ✅ Calcul de la réduction (utilise valeur stockée)
2. ✅ Calcul des frais de service avec TVA (même formule)
3. ✅ Calcul de la commission hôte avec TVA (fonctions centralisées)
4. ✅ Calcul des frais de ménage (logique free_cleaning_min_days)
5. ✅ Calcul de la taxe de séjour (multiplié par nuits)
6. ✅ Calcul du total payé (même logique avec tolérance)
7. ✅ Affichage des détails TVA (section grise)
8. ✅ Affichage du règlement intérieur (section bleue)
9. ✅ Affichage de la politique d'annulation (section jaune)
10. ✅ Affichage du prolongement de séjour (modifications approuvées)

