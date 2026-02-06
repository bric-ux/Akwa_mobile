# 📧 UTILISATION DES DONNÉES STOCKÉES DANS LES EMAILS ET PDFS

## 🎯 PRINCIPE

Avec la solution optimale (`booking_calculation_details`), **tous les emails et PDFs utilisent directement les données stockées** au lieu de recalculer.

---

## 📊 AVANT vs APRÈS

### ❌ AVANT (Actuel) - Recalcul à chaque fois

#### Email/PDF actuel
```typescript
// ❌ Recalcul de TOUS les montants
const basePrice = pricePerNight * nights;
const discountAmount = calculateDiscount(...);
const priceAfterDiscount = basePrice - discountAmount;
const serviceFee = calculateServiceFee(priceAfterDiscount);
const hostCommission = calculateHostCommission(priceAfterDiscount);
const hostNetAmount = priceAfterDiscount - hostCommission;
// ... etc
```

**Problèmes** :
- ⚠️ Recalcul à chaque génération
- ⚠️ Risque d'incohérence si données changent
- ⚠️ Performance moins bonne
- ⚠️ Arrondis peuvent différer

---

### ✅ APRÈS (Solution optimale) - Utilisation directe

#### Email/PDF avec données stockées
```typescript
// ✅ Récupérer les données stockées
const { data: calcDetails } = await supabase
  .from('booking_calculation_details')
  .select('*')
  .eq('booking_id', booking.id)
  .single();

if (calcDetails) {
  // ✅ Utiliser DIRECTEMENT les valeurs stockées
  const invoiceData = {
    basePrice: calcDetails.base_price,
    priceAfterDiscount: calcDetails.price_after_discount,
    discountAmount: calcDetails.discount_amount,
    serviceFee: calcDetails.service_fee,
    serviceFeeHT: calcDetails.service_fee_ht,
    serviceFeeVAT: calcDetails.service_fee_vat,
    hostCommission: calcDetails.host_commission,
    hostCommissionHT: calcDetails.host_commission_ht,
    hostCommissionVAT: calcDetails.host_commission_vat,
    effectiveCleaningFee: calcDetails.effective_cleaning_fee,
    effectiveTaxes: calcDetails.effective_taxes,
    totalPrice: calcDetails.total_price,
    hostNetAmount: calcDetails.host_net_amount,
    // Pour véhicules
    driverFee: calcDetails.driver_fee,
    daysPrice: calcDetails.days_price,
    hoursPrice: calcDetails.hours_price,
  };
  
  // ✅ Générer le PDF avec les données stockées
  generatePDF(invoiceData);
} else {
  // ⚠️ Fallback : recalculer (anciennes réservations uniquement)
  const calculated = calculateAllAmounts(booking);
  generatePDF(calculated);
}
```

**Avantages** :
- ✅ Zéro recalcul
- ✅ Cohérence garantie
- ✅ Performance optimale
- ✅ Même valeurs partout

---

## 📧 EXEMPLE : EMAIL DE CONFIRMATION

### Code actuel (recalcul)

```typescript
// ❌ ACTUEL - Recalcul dans send-email/index.ts
async function generateVehicleBookingPDF(bookingData: any) {
  // Recalculer tous les montants
  const basePrice = dailyRate * rentalDays + hourlyRate * rentalHours;
  const discountAmount = calculateDiscount(...);
  const priceAfterDiscount = basePrice - discountAmount;
  const driverFee = ...;
  const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee;
  const serviceFee = calculateServiceFee(priceAfterDiscountWithDriver);
  const hostCommission = calculateHostCommission(priceAfterDiscountWithDriver);
  const hostNetAmount = priceAfterDiscountWithDriver - hostCommission;
  
  // Générer le PDF avec valeurs recalculées
  generatePDF({
    basePrice,
    priceAfterDiscount,
    serviceFee,
    hostCommission,
    hostNetAmount,
    // ...
  });
}
```

### Code avec données stockées

```typescript
// ✅ NOUVEAU - Utilisation directe
async function generateVehicleBookingPDF(bookingData: any) {
  // Récupérer les données stockées
  const { data: calcDetails } = await supabase
    .from('booking_calculation_details')
    .select('*')
    .eq('booking_id', bookingData.bookingId)
    .eq('booking_type', 'vehicle')
    .single();
  
  if (calcDetails) {
    // ✅ Utiliser DIRECTEMENT les valeurs stockées
    generatePDF({
      basePrice: calcDetails.base_price,
      priceAfterDiscount: calcDetails.price_after_discount,
      basePriceWithDriver: calcDetails.base_price_with_driver,
      driverFee: calcDetails.driver_fee,
      daysPrice: calcDetails.days_price,
      hoursPrice: calcDetails.hours_price,
      discountAmount: calcDetails.discount_amount,
      serviceFee: calcDetails.service_fee,
      serviceFeeHT: calcDetails.service_fee_ht,
      serviceFeeVAT: calcDetails.service_fee_vat,
      hostCommission: calcDetails.host_commission,
      hostCommissionHT: calcDetails.host_commission_ht,
      hostCommissionVAT: calcDetails.host_commission_vat,
      totalPrice: calcDetails.total_price,
      hostNetAmount: calcDetails.host_net_amount,
    });
  } else {
    // ⚠️ Fallback pour anciennes réservations
    const calculated = calculateAllAmounts(bookingData);
    generatePDF(calculated);
  }
}
```

---

## 📄 EXEMPLE : PDF DE FACTURE

### Code actuel (recalcul)

```typescript
// ❌ ACTUEL - Recalcul dans invoicePdfGenerator.ts
export const generateInvoicePDF = async (data: InvoicePDFData) => {
  const basePrice = pricePerNight * nights;
  const discountAmount = calculateDiscount(...);
  const priceAfterDiscount = basePrice - discountAmount;
  const serviceFee = calculateServiceFee(priceAfterDiscount);
  const hostCommission = calculateHostCommission(priceAfterDiscount);
  const hostNetAmount = calculateHostNetAmount(...);
  
  // Générer le PDF avec valeurs recalculées
  // ...
};
```

### Code avec données stockées

```typescript
// ✅ NOUVEAU - Utilisation directe
export const generateInvoicePDF = async (data: InvoicePDFData) => {
  // Récupérer les données stockées
  const { data: calcDetails } = await supabase
    .from('booking_calculation_details')
    .select('*')
    .eq('booking_id', data.booking.id)
    .eq('booking_type', data.serviceType)
    .single();
  
  if (calcDetails) {
    // ✅ Utiliser DIRECTEMENT les valeurs stockées
    const invoiceData = {
      basePrice: calcDetails.base_price,
      priceAfterDiscount: calcDetails.price_after_discount,
      discountAmount: calcDetails.discount_amount,
      serviceFee: calcDetails.service_fee,
      serviceFeeHT: calcDetails.service_fee_ht,
      serviceFeeVAT: calcDetails.service_fee_vat,
      effectiveCleaningFee: calcDetails.effective_cleaning_fee,
      effectiveTaxes: calcDetails.effective_taxes,
      hostCommission: calcDetails.host_commission,
      hostCommissionHT: calcDetails.host_commission_ht,
      hostCommissionVAT: calcDetails.host_commission_vat,
      totalPrice: calcDetails.total_price,
      hostNetAmount: calcDetails.host_net_amount,
    };
    
    // Générer le PDF avec données stockées
    generatePDFContent(invoiceData);
  } else {
    // ⚠️ Fallback pour anciennes réservations
    const calculated = calculateAllAmounts(data);
    generatePDFContent(calculated);
  }
};
```

---

## 🔄 FLUX COMPLET

### 1. Création de réservation

```typescript
// Dans useVehicleBookings.ts ou useBookings.ts
const createBooking = async (bookingData) => {
  // 1. Calculer TOUS les montants
  const calculationDetails = {
    base_price: basePrice,
    price_after_discount: priceAfterDiscount,
    service_fee: fees.serviceFee,
    service_fee_ht: fees.serviceFeeHT,
    service_fee_vat: fees.serviceFeeVAT,
    host_commission: hostCommissionData.hostCommission,
    host_commission_ht: hostCommissionData.hostCommissionHT,
    host_commission_vat: hostCommissionData.hostCommissionVAT,
    total_price: totalPrice,
    host_net_amount: hostNetAmount,
    // ... tous les autres montants
    calculation_snapshot: {
      // Toutes les données utilisées
    }
  };
  
  // 2. Insérer la réservation
  const booking = await supabase.from('vehicle_bookings').insert({...});
  
  // 3. Insérer les détails de calcul
  await supabase.from('booking_calculation_details').insert({
    booking_id: booking.id,
    booking_type: 'vehicle',
    ...calculationDetails
  });
  
  // 4. Envoyer l'email (utilise les données stockées)
  await sendConfirmationEmail(booking.id);
};
```

### 2. Génération d'email/PDF

```typescript
// Dans send-email/index.ts ou invoicePdfGenerator.ts
async function sendConfirmationEmail(bookingId: string) {
  // 1. Récupérer la réservation
  const booking = await getBooking(bookingId);
  
  // 2. Récupérer les détails de calcul stockés
  const { data: calcDetails } = await supabase
    .from('booking_calculation_details')
    .select('*')
    .eq('booking_id', bookingId)
    .single();
  
  // 3. Utiliser les données stockées pour l'email
  const emailData = {
    bookingId: booking.id,
    totalPrice: calcDetails.total_price,        // ✅ Stocké
    hostNetAmount: calcDetails.host_net_amount, // ✅ Stocké
    serviceFee: calcDetails.service_fee,         // ✅ Stocké
    hostCommission: calcDetails.host_commission, // ✅ Stocké
    // ... tous les autres montants depuis calcDetails
  };
  
  // 4. Générer le PDF avec données stockées
  const pdf = await generatePDF(calcDetails);
  
  // 5. Envoyer l'email avec PDF
  await sendEmail({
    to: user.email,
    subject: 'Confirmation de réservation',
    attachments: [{ filename: 'invoice.pdf', content: pdf }],
    data: emailData
  });
}
```

---

## 📋 FICHIERS À MODIFIER

### 1. Edge Function `send-email`

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`

**Modifications** :
- `generateVehicleBookingPDF()` : Utiliser `calculation_details` au lieu de recalculer
- `generateInvoicePDFForEmail()` : Utiliser `calculation_details` au lieu de recalculer
- `getVehicleEmailContent()` : Utiliser valeurs stockées
- `getPropertyEmailContent()` : Utiliser valeurs stockées

### 2. PDF Generator (Web)

**Fichier** : `cote-d-ivoire-stays/src/lib/invoicePdfGenerator.ts`

**Modifications** :
- `generateInvoicePDF()` : Utiliser `calculation_details` au lieu de recalculer

### 3. InvoiceDisplay (Mobile)

**Fichier** : `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`

**Modifications** :
- Utiliser `calculation_details` au lieu de recalculer
- Fallback sur recalcul si NULL

### 4. InvoiceDisplay (Web)

**Fichier** : `cote-d-ivoire-stays/src/components/InvoiceDisplay.tsx`

**Modifications** :
- Utiliser `calculation_details` au lieu de recalculer
- Fallback sur recalcul si NULL

---

## ✅ AVANTAGES CONCRETS

### Performance
- **Avant** : Recalcul à chaque génération d'email/PDF (plusieurs calculs)
- **Après** : Simple SELECT depuis la base (une requête)

### Cohérence
- **Avant** : Risque de différences entre email, PDF, affichage
- **Après** : Mêmes valeurs partout (email = PDF = affichage)

### Simplicité
- **Avant** : Logique de calcul dupliquée dans plusieurs endroits
- **Après** : Une seule source de vérité

### Traçabilité
- **Avant** : Impossible de savoir exactement ce qui a été calculé
- **Après** : `calculation_snapshot` contient toutes les données utilisées

---

## 🔄 FALLBACK POUR ANCIENNES RÉSERVATIONS

```typescript
// Fonction helper pour récupérer les données
async function getCalculationDetails(bookingId: string, bookingType: 'property' | 'vehicle') {
  // 1. Essayer de récupérer les données stockées
  const { data: calcDetails } = await supabase
    .from('booking_calculation_details')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('booking_type', bookingType)
    .single();
  
  if (calcDetails) {
    // ✅ Utiliser les données stockées
    return calcDetails;
  } else {
    // ⚠️ Fallback : recalculer (anciennes réservations)
    const booking = await getBooking(bookingId);
    return calculateAllAmounts(booking);
  }
}
```

---

## 📊 RÉSUMÉ

| Élément | Avant | Après |
|---------|-------|-------|
| **Email** | ❌ Recalcul | ✅ Données stockées |
| **PDF** | ❌ Recalcul | ✅ Données stockées |
| **Affichage** | ❌ Recalcul | ✅ Données stockées |
| **Cohérence** | ⚠️ Risque d'incohérence | ✅ Garantie |
| **Performance** | ⚠️ Plusieurs calculs | ✅ Une requête SQL |
| **Traçabilité** | ❌ Aucune | ✅ Snapshot complet |

---

## 🎯 CONCLUSION

**Oui, avec la solution optimale, tous les emails et PDFs utilisent directement les données stockées** au lieu de recalculer.

**Bénéfices** :
- ✅ Zéro recalcul dans les emails/PDFs
- ✅ Cohérence garantie entre tous les supports
- ✅ Performance optimale
- ✅ Code plus simple et maintenable

**Prochaine étape** : Implémenter la table `booking_calculation_details` et modifier les fonctions de génération d'emails/PDFs pour utiliser les données stockées.

