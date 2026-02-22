# 📧 DONNÉES À ENVOYER DANS LES EMAILS DE DEMANDE DE RÉSERVATION

## 🎯 Vue d'ensemble

Pour une réservation véhicule en statut **`pending`**, voici exactement ce qui doit être envoyé dans les emails de demande.

---

## 1. 📧 EMAIL AU LOCATAIRE (`vehicle_booking_request_sent`)

### ✅ Données à envoyer

```typescript
{
  // Informations de base
  renterName: string,              // Nom du locataire
  vehicleTitle: string,            // Titre du véhicule (marque + modèle)
  vehicleBrand: string,            // Marque du véhicule
  vehicleModel: string,            // Modèle du véhicule
  
  // Dates
  startDate: string,               // Date de début (format: "dd MMMM yyyy")
  endDate: string,                 // Date de fin (format: "dd MMMM yyyy")
  startDateTime?: string,           // Date/heure de début (ISO format) - OPTIONNEL
  endDateTime?: string,             // Date/heure de fin (ISO format) - OPTIONNEL
  
  // Durée
  rentalDays: number,               // Nombre de jours
  rentalHours?: number,             // Nombre d'heures (si applicable)
  
  // Prix
  totalPrice: number,               // ✅ TOTAL PAYÉ PAR LE LOCATAIRE (depuis booking_calculation_details.total_price)
  
  // Caution
  securityDeposit: number,          // Caution (si applicable)
  
  // Type de réservation
  isAutoBooking: boolean,           // true si réservation instantanée, false si sur demande
}
```

### 📋 Ce qui est affiché dans l'email

- ✅ Nom du véhicule (marque + modèle)
- ✅ Dates de location (début et fin)
- ✅ Durée (jours + heures si applicable)
- ✅ **Total à payer** : `totalPrice` (ce que le locataire paiera)
- ✅ Caution : `securityDeposit` (si applicable)
- ✅ Message informatif : "Le propriétaire a 24h pour répondre"

### ❌ Ce qui N'EST PAS affiché

- ❌ Détails financiers complets (frais de service, réductions détaillées, etc.)
- ❌ Commission propriétaire
- ❌ Revenu net propriétaire

---

## 2. 📧 EMAIL AU PROPRIÉTAIRE (`vehicle_booking_request`)

### ✅ Données à envoyer

```typescript
{
  // Informations de base
  ownerName: string,                // Nom du propriétaire
  renterName: string,               // Nom du locataire
  renterPhone?: string,             // Téléphone du locataire (si disponible)
  vehicleTitle: string,             // Titre du véhicule (marque + modèle)
  
  // Dates
  startDate: string,                // Date de début (format: "dd MMMM yyyy")
  endDate: string,                  // Date de fin (format: "dd MMMM yyyy")
  startDateTime?: string,            // Date/heure de début (ISO format) - OPTIONNEL
  endDateTime?: string,              // Date/heure de fin (ISO format) - OPTIONNEL
  
  // Durée
  rentalDays: number,                // Nombre de jours
  rentalHours?: number,              // Nombre d'heures (si applicable)
  
  // Prix
  basePrice?: number,                // Prix après réduction + chauffeur (pour calcul fallback)
  ownerNetRevenue: number,           // ✅ REVENU NET DU PROPRIÉTAIRE (depuis booking_calculation_details.host_net_amount)
  
  // Caution
  securityDeposit: number,           // Caution (si applicable)
  
  // Message
  message?: string,                  // Message du locataire (si fourni)
  
  // Informations permis
  hasLicense?: boolean,              // Le locataire a-t-il un permis ?
  licenseYears?: number,             // Années de permis (si applicable)
  
  // Chauffeur
  withDriver?: boolean,              // Location avec chauffeur ?
}
```

### 📋 Ce qui est affiché dans l'email

- ✅ Nom du locataire
- ✅ Téléphone du locataire (si disponible)
- ✅ Nom du véhicule (marque + modèle)
- ✅ Dates de location (début et fin)
- ✅ Durée (jours + heures si applicable)
- ✅ **Revenu net estimé** : `ownerNetRevenue` (ce que le propriétaire recevra)
- ✅ Caution : `securityDeposit` (si applicable)
- ✅ Message du locataire (si fourni)
- ✅ Informations permis de conduire (si fournies)
- ✅ Boutons d'action : Accepter / Refuser

### ❌ Ce qui N'EST PAS affiché

- ❌ Frais de service locataire (ce n'est pas le problème du propriétaire)
- ❌ Total payé par le locataire (sauf si nécessaire pour contexte)
- ❌ Détails de calcul de la commission

---

## 🔍 UTILISATION DES DONNÉES STOCKÉES

### ✅ Priorité : Utiliser `booking_calculation_details`

**Lors de la création de la réservation**, les données suivantes doivent être récupérées depuis `booking_calculation_details` :

```typescript
// Récupérer les détails stockés
const { data: calcDetails } = await supabase
  .from('booking_calculation_details')
  .select('*')
  .eq('booking_id', booking.id)
  .eq('booking_type', 'vehicle')
  .single();

if (calcDetails) {
  // ✅ Utiliser DIRECTEMENT les valeurs stockées
  const totalPrice = calcDetails.total_price;        // Pour locataire
  const hostNetAmount = calcDetails.host_net_amount;  // Pour propriétaire
}
```

### ⚠️ Fallback : Utiliser les valeurs calculées

Si `booking_calculation_details` n'existe pas encore (anciennes réservations), utiliser :
- `booking.total_price` pour le locataire
- `booking.host_net_amount` pour le propriétaire
- Ou recalculer si nécessaire

---

## 📝 EXEMPLE DE CODE

### Dans `useVehicleBookings.ts` (Mobile)

```typescript
// Après création de la réservation et insertion de booking_calculation_details
const { data: calcDetails } = await supabase
  .from('booking_calculation_details')
  .select('*')
  .eq('booking_id', booking.id)
  .eq('booking_type', 'vehicle')
  .single();

const emailData = {
  bookingId: booking.id,
  vehicleTitle: vehicleTitle,
  vehicleBrand: vehicleInfo.brand || '',
  vehicleModel: vehicleInfo.model || '',
  vehicleYear: vehicleInfo.year || '',
  fuelType: vehicleInfo.fuel_type || '',
  
  // Informations locataire
  renterName: renterName,
  renterEmail: user.email || '',
  renterPhone: renterProfile?.phone || '',
  
  // Informations propriétaire
  ownerName: ownerName,
  ownerEmail: ownerProfile?.email || '',
  ownerPhone: ownerProfile?.phone || '',
  
  // Dates
  startDate: bookingData.startDate,
  endDate: bookingData.endDate,
  startDateTime: bookingData.startDateTime,
  endDateTime: bookingData.endDateTime,
  
  // Durée
  rentalDays: rentalDays,
  rentalHours: rentalHours || 0,
  
  // Prix
  dailyRate: booking.daily_rate || vehicle?.price_per_day || 0,
  hourlyRate: hourlyRate || vehicle?.price_per_hour || 0,
  
  // ✅ UTILISER LES DONNÉES STOCKÉES
  totalPrice: calcDetails?.total_price || booking.total_price,  // Pour locataire
  ownerNetRevenue: calcDetails?.host_net_amount || booking.host_net_amount,  // Pour propriétaire
  
  // Autres
  securityDeposit: vehicle?.security_deposit ?? booking.security_deposit ?? 0,
  driverFee: driverFee,
  withDriver: bookingData.useDriver === true,
  pickupLocation: bookingData.pickupLocation || '',
  message: bookingData.messageToOwner || '',
  isInstantBooking: false,
  discountAmount: discountAmount || 0,
};

// Email au locataire
await supabase.functions.invoke('send-email', {
  body: {
    type: 'vehicle_booking_request_sent',
    to: user.email,
    data: {
      renterName: renterName,
      vehicleTitle: vehicleTitle,
      vehicleBrand: vehicleInfo.brand || '',
      vehicleModel: vehicleInfo.model || '',
      startDate: formatDate(bookingData.startDate),
      endDate: formatDate(bookingData.endDate),
      startDateTime: bookingData.startDateTime,
      endDateTime: bookingData.endDateTime,
      rentalDays: rentalDays,
      rentalHours: rentalHours || 0,
      totalPrice: calcDetails?.total_price || booking.total_price,  // ✅ Utiliser données stockées
      securityDeposit: vehicle?.security_deposit ?? 0,
      isAutoBooking: false,
    }
  }
});

// Email au propriétaire
await supabase.functions.invoke('send-email', {
  body: {
    type: 'vehicle_booking_request',
    to: ownerProfile?.email,
    data: {
      ownerName: ownerName,
      renterName: renterName,
      renterPhone: renterProfile?.phone || '',
      vehicleTitle: vehicleTitle,
      startDate: formatDate(bookingData.startDate),
      endDate: formatDate(bookingData.endDate),
      startDateTime: bookingData.startDateTime,
      endDateTime: bookingData.endDateTime,
      rentalDays: rentalDays,
      rentalHours: rentalHours || 0,
      basePrice: calcDetails?.base_price_with_driver || basePriceWithDriver,  // Pour calcul fallback
      ownerNetRevenue: calcDetails?.host_net_amount || booking.host_net_amount,  // ✅ Utiliser données stockées
      securityDeposit: vehicle?.security_deposit ?? 0,
      message: bookingData.messageToOwner || '',
      hasLicense: bookingData.hasLicense,
      licenseYears: bookingData.licenseYears,
      withDriver: bookingData.useDriver === true,
    }
  }
});
```

---

## ✅ RÈGLES IMPORTANTES

1. **Utiliser les données stockées** :
   - ✅ Toujours récupérer `booking_calculation_details` après création de la réservation
   - ✅ Utiliser `total_price` pour le locataire
   - ✅ Utiliser `host_net_amount` pour le propriétaire

2. **Fallback** :
   - ⚠️ Si `booking_calculation_details` n'existe pas, utiliser `booking.total_price` et `booking.host_net_amount`
   - ⚠️ Si ces valeurs n'existent pas non plus, recalculer (anciennes réservations)

3. **Cohérence** :
   - ✅ Les montants dans les emails doivent correspondre EXACTEMENT aux montants stockés
   - ✅ Aucun recalcul ne doit être fait si les données stockées existent

---

## 🔍 VÉRIFICATIONS

Pour vérifier que tout est correct :

1. ✅ Créer une réservation véhicule avec chauffeur et réduction
2. ✅ Vérifier que `booking_calculation_details` est créé
3. ✅ Vérifier l'email au locataire : doit afficher `total_price` depuis `booking_calculation_details`
4. ✅ Vérifier l'email au propriétaire : doit afficher `host_net_amount` depuis `booking_calculation_details`
5. ✅ Vérifier que les montants correspondent aux données stockées




