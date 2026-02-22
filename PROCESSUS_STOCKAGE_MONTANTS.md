# ⏱️ PROCESSUS DE STOCKAGE DES MONTANTS

## 📋 Vue d'ensemble

Ce document détaille **le moment exact** dans le processus de création de réservation où `total_price` et `host_net_amount` sont **calculés** et **stockés** en base de données.

---

## 🚗 PROCESSUS POUR LES VÉHICULES

### Flux complet : `useVehicleBookings.ts` → `createBooking()`

#### **ÉTAPE 1 : Validations préalables** (lignes 31-89)
- ✅ Vérification authentification
- ✅ Vérification identité
- ✅ Validation dates/heures
- ❌ **Aucun calcul de prix à ce stade**

---

#### **ÉTAPE 2 : Récupération des données du véhicule** (lignes 94-102)
```typescript
const { data: vehicle } = await supabase
  .from('vehicles')
  .select('price_per_day, price_per_hour, ...')
  .eq('id', bookingData.vehicleId)
  .single();
```
- ✅ Récupère les tarifs du véhicule
- ❌ **Aucun calcul de prix à ce stade**

---

#### **ÉTAPE 3 : Calcul du prix de base** (lignes 193-249)
```typescript
// Calcul selon le type de location
if (rentalType === 'hourly') {
  basePrice = hourlyRate * rentalHours;
} else {
  const priceCalculation = calculateVehiclePriceWithHours(...);
  basePrice = priceCalculation.basePrice; // Prix APRÈS réduction
}
```
- ✅ **CALCUL** : `basePrice` (prix après réduction, jours + heures)
- ❌ **PAS ENCORE STOCKÉ**

---

#### **ÉTAPE 4 : Ajout du surplus chauffeur** (lignes 251-255)
```typescript
const driverFee = ...;
const basePriceWithDriver = basePrice + driverFee;
```
- ✅ **CALCUL** : `basePriceWithDriver`
- ❌ **PAS ENCORE STOCKÉ**

---

#### **ÉTAPE 5 : Calcul de `total_price`** (lignes 257-259)
```typescript
const fees = calculateFees(basePriceWithDriver, ...);
const totalPrice = basePriceWithDriver + fees.serviceFee; // ✅ CALCULÉ ICI
```
- ✅ **CALCUL** : `totalPrice` (prix avec chauffeur + frais de service)
- ❌ **PAS ENCORE STOCKÉ**

---

#### **ÉTAPE 6 : Calcul de `host_net_amount`** (lignes 261-265)
```typescript
const hostCommissionData = calculateHostCommission(basePriceWithDriver, 'vehicle');
const hostNetAmount = basePriceWithDriver - hostCommissionData.hostCommission; // ✅ CALCULÉ ICI
```
- ✅ **CALCUL** : `hostNetAmount` (revenu net du propriétaire)
- ❌ **PAS ENCORE STOCKÉ**

---

#### **ÉTAPE 7 : Préparation de l'objet d'insertion** (lignes 272-292)
```typescript
const bookingInsert: any = {
  vehicle_id: bookingData.vehicleId,
  renter_id: user.id,
  ...
  total_price: totalPrice,        // ✅ VALEUR CALCULÉE PRÊTE À STOCKER
  host_net_amount: hostNetAmount, // ✅ VALEUR CALCULÉE PRÊTE À STOCKER
  ...
};
```
- ✅ **PRÉPARATION** : Les valeurs calculées sont ajoutées à l'objet d'insertion
- ❌ **PAS ENCORE STOCKÉ EN BASE**

---

#### **ÉTAPE 8 : INSERTION EN BASE DE DONNÉES** (lignes 312-325)
```typescript
const { data: booking, error: bookingError } = await supabase
  .from('vehicle_bookings')
  .insert(bookingInsert)  // ✅ STOCKAGE ICI
  .select()
  .single();
```
- ✅ **STOCKAGE** : `total_price` et `host_net_amount` sont **insérés en base**
- ✅ **MOMENT EXACT** : Lors de l'exécution de `.insert(bookingInsert)`

---

#### **ÉTAPE 9 : Post-traitement** (lignes 331-546)
- Sauvegarde document permis
- Envoi d'emails
- ❌ **Aucun recalcul** des montants

---

## 🏠 PROCESSUS POUR LES PROPRIÉTÉS

### Flux complet : `useBookings.ts` → `createBooking()`

#### **ÉTAPE 1-5 : Validations et récupération** (lignes 92-231)
- Validations préalables
- Récupération données propriété
- Vérification disponibilité
- ❌ **Aucun calcul de prix à ce stade**

---

#### **ÉTAPE 6 : Calcul de `host_net_amount`** (lignes 237-274)
```typescript
const { calculateHostNetAmount } = await import('../lib/hostNetAmount');
const hostNetAmountResult = calculateHostNetAmount({
  pricePerNight: propertyData.price_per_night,
  nights: nights,
  discountAmount: bookingData.discountAmount || 0,
  cleaningFee: propertyData.cleaning_fee || 0,
  taxesPerNight: propertyData.taxes || 0,
  freeCleaningMinDays: propertyData.free_cleaning_min_days || null,
  status: initialStatus,
  serviceType: 'property',
}); // ✅ CALCULÉ ICI
```
- ✅ **CALCUL** : `hostNetAmountResult.hostNetAmount`
- ❌ **PAS ENCORE STOCKÉ**

**Note** : Pour les propriétés, `total_price` est **calculé AVANT** l'appel à `createBooking()` (dans le composant qui appelle cette fonction) et passé via `bookingData.totalPrice`.

---

#### **ÉTAPE 7 : Préparation de l'objet d'insertion** (lignes 288-309)
```typescript
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .insert({
    property_id: bookingData.propertyId,
    guest_id: user.id,
    ...
    total_price: bookingData.totalPrice,              // ✅ VALEUR CALCULÉE PRÊTE À STOCKER
    host_net_amount: hostNetAmountResult.hostNetAmount, // ✅ VALEUR CALCULÉE PRÊTE À STOCKER
    ...
  })
```
- ✅ **PRÉPARATION** : Les valeurs sont ajoutées à l'objet d'insertion
- ❌ **PAS ENCORE STOCKÉ EN BASE**

---

#### **ÉTAPE 8 : INSERTION EN BASE DE DONNÉES** (lignes 288-317)
```typescript
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .insert({...})  // ✅ STOCKAGE ICI
  .select()
  .single();
```
- ✅ **STOCKAGE** : `total_price` et `host_net_amount` sont **insérés en base**
- ✅ **MOMENT EXACT** : Lors de l'exécution de `.insert({...})`

---

## 📊 RÉSUMÉ CHRONOLOGIQUE

### Pour les VÉHICULES

```
1. Validations                    → ❌ Pas de calcul
2. Récupération véhicule         → ❌ Pas de calcul
3. Calcul basePrice              → ✅ Calculé (pas stocké)
4. Ajout chauffeur               → ✅ Calculé (pas stocké)
5. Calcul total_price            → ✅ CALCULÉ (ligne 259)
6. Calcul host_net_amount        → ✅ CALCULÉ (ligne 265)
7. Préparation bookingInsert      → ✅ Valeurs prêtes (lignes 280-281)
8. INSERT EN BASE                → ✅ STOCKÉ (ligne 314)
9. Post-traitement               → ❌ Pas de recalcul
```

### Pour les PROPRIÉTÉS

```
1. Validations                    → ❌ Pas de calcul
2. Récupération propriété        → ❌ Pas de calcul
3. Vérification disponibilité    → ❌ Pas de calcul
4. Calcul host_net_amount        → ✅ CALCULÉ (ligne 262)
5. Préparation insert            → ✅ Valeurs prêtes (lignes 299-300)
6. INSERT EN BASE                → ✅ STOCKÉ (ligne 289)
7. Post-traitement               → ❌ Pas de recalcul
```

---

## ⚠️ POINTS IMPORTANTS

### 1. **Ordre de calcul**
- Pour les véhicules : `total_price` est calculé **AVANT** `host_net_amount`
- Pour les propriétés : `host_net_amount` est calculé **AVANT** l'insertion (mais `total_price` est calculé avant l'appel)

### 2. **Moment de stockage**
- **Les deux valeurs sont stockées EN MÊME TEMPS** lors de l'insertion en base
- **Une seule opération SQL** : `.insert({ total_price, host_net_amount, ... })`
- **Transaction atomique** : Si l'insertion échoue, aucune des deux valeurs n'est stockée

### 3. **Pas de recalcul après stockage**
- Une fois stockées, ces valeurs **ne sont plus recalculées** dans le processus de création
- Les valeurs stockées sont utilisées pour les emails, PDFs, etc.

### 4. **Cohérence garantie**
- Les deux valeurs sont calculées avec les **mêmes données** au même moment
- Pas de risque d'incohérence entre `total_price` et `host_net_amount` lors de la création

---

## 🔍 CODE EXACT DU STOCKAGE

### Véhicules (useVehicleBookings.ts)

```typescript:312:314:AkwaHomeMobile/src/hooks/useVehicleBookings.ts
const { data: booking, error: bookingError } = await supabase
  .from('vehicle_bookings')
  .insert(bookingInsert)  // ← STOCKAGE ICI
```

Où `bookingInsert` contient :
```typescript:280:281:AkwaHomeMobile/src/hooks/useVehicleBookings.ts
total_price: totalPrice,        // ← Valeur calculée ligne 259
host_net_amount: hostNetAmount, // ← Valeur calculée ligne 265
```

### Propriétés (useBookings.ts)

```typescript:288:300:AkwaHomeMobile/src/hooks/useBookings.ts
const { data: booking, error: bookingError } = await supabase
  .from('bookings')
  .insert({
    ...
    total_price: bookingData.totalPrice,              // ← Valeur calculée avant l'appel
    host_net_amount: hostNetAmountResult.hostNetAmount, // ← Valeur calculée ligne 262
    ...
  })
```

---

## ✅ CONCLUSION

**Les deux données sont stockées :**
1. **Au même moment** : Lors de l'exécution de `.insert()`
2. **Dans la même transaction** : Opération atomique
3. **Après tous les calculs** : Toutes les validations et calculs sont terminés
4. **Avant tout post-traitement** : Emails, PDFs utilisent les valeurs stockées

**Moment exact** : **Ligne 314** (véhicules) ou **Ligne 289** (propriétés) lors de l'exécution de `.insert()`




