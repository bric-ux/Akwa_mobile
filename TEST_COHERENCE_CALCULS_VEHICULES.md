# 🧪 TEST DE COHÉRENCE - CALCULS LOCATION VÉHICULES

## 📊 DONNÉES DE TEST (depuis l'image)

- **Prix par jour** : 100 000 FCFA
- **Prix par heure** : 10 000 FCFA/h
- **Durée** : 5 jours et 2 heures
- **Réduction** : 10% (52 000 FCFA)
- **Surplus chauffeur** : 25 000 FCFA
- **Caution** : 100 000 FCFA

---

## ✅ CALCULS ATTENDUS

### 1. Calcul du prix de base (jours + heures)
```
Prix jours = 5 × 100 000 = 500 000 FCFA
Prix heures = 2 × 10 000 = 20 000 FCFA
Total avant réduction = 520 000 FCFA
```

### 2. Application de la réduction
```
Réduction 10% = 520 000 × 0.10 = 52 000 FCFA ✓
Prix après réduction = 520 000 - 52 000 = 468 000 FCFA ✓
```

### 3. Ajout du surplus chauffeur
```
Prix avec chauffeur = 468 000 + 25 000 = 493 000 FCFA
```

### 4. Calcul des frais de service (12% TTC)
```
Frais de service HT = 493 000 × 0.10 = 49 300 FCFA
Frais de service TVA = 49 300 × 0.20 = 9 860 FCFA
Frais de service TTC = 49 300 + 9 860 = 59 160 FCFA ✓
```

### 5. Total payé par le locataire
```
Total = 493 000 + 59 160 = 552 160 FCFA ✓
```

### 6. Calcul du revenu net propriétaire
```
Commission HT = 493 000 × 0.02 = 9 860 FCFA
Commission TVA = 9 860 × 0.20 = 1 972 FCFA
Commission TTC = 9 860 + 1 972 = 11 832 FCFA
Revenu net = 493 000 - 11 832 + 100 000 (caution) = 581 168 FCFA
```

---

## 📧 CE QUE LE LOCATAIRE DOIT RECEVOIR

### Email : `vehicle_booking_request_sent` (Demande envoyée)

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (lignes 6379-6415)

#### Contenu attendu :
- ✅ Véhicule : [Marque Modèle]
- ✅ Dates : [Date début] au [Date fin]
- ✅ Durée : 5 jours et 2 heures
- ✅ **Prix total : 552 160 FCFA**
- ✅ Caution : 100 000 FCFA (remboursable)
- ✅ Message : "Vous avez 24 heures pour répondre..."

#### ⚠️ VÉRIFICATION :
- Le prix total affiché doit être **552 160 FCFA** (inclut frais de service)
- Pas de détail du calcul dans l'email (les détails sont dans le PDF après confirmation)

---

## 📧 CE QUE LE PROPRIÉTAIRE DOIT RECEVOIR

### Email : `vehicle_booking_request` (Nouvelle demande)

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (lignes 6221-6281)

#### Contenu attendu :
- ✅ Locataire : [Nom]
- ✅ Téléphone : [Téléphone]
- ✅ Dates : [Date début] au [Date fin]
- ✅ Durée : 5 jours et 2 heures
- ✅ **💰 Revenu net estimé (après commission) : 581 168 FCFA** (UNIQUEMENT ce montant)
- ✅ Caution : 100 000 FCFA
- ✅ Message du locataire (si fourni)

#### ⚠️ VÉRIFICATIONS :
1. **Le propriétaire doit voir UNIQUEMENT le revenu net** (581 168 FCFA)
2. **PAS de "Prix total payé par le locataire"** (déjà retiré ✅)
3. **PAS de "Prix de base"** (déjà retiré ✅)

---

## 📱 CE QUI DOIT S'AFFICHER DANS L'OVERVIEW

### Fichier : `MyVehicleBookingsScreen.tsx` (lignes 290-310)

#### Calculs dans l'overview :
```typescript
// Lignes 291-302
const daysPrice = (booking.daily_rate || 0) * rentalDays; // 5 × 100 000 = 500 000
const hoursPrice = rentalHours > 0 && hourlyRate > 0 ? rentalHours * hourlyRate : 0; // 2 × 10 000 = 20 000
const basePrice = daysPrice + hoursPrice; // 520 000
const priceAfterDiscount = basePrice - (booking.discount_amount || 0); // 520 000 - 52 000 = 468 000
const driverFee = (booking.with_driver && booking.vehicle?.driver_fee) ? booking.vehicle.driver_fee : 0; // 25 000
const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee; // 468 000 + 25 000 = 493 000

// Lignes 306-309
const serviceFeeHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.travelerFeePercent / 100)); // 493 000 × 0.10 = 49 300
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20); // 49 300 × 0.20 = 9 860
const effectiveServiceFee = serviceFeeHT + serviceFeeVAT; // 59 160
const totalWithServiceFee = priceAfterDiscountWithDriver + effectiveServiceFee; // 493 000 + 59 160 = 552 160
```

#### Affichage attendu :
- ✅ Prix total : **552 160 FCFA**
- ✅ Dates : [Date début] - [Date fin]
- ✅ Statut : "En attente" / "Confirmée" / etc.

#### ⚠️ PROBLÈME DÉTECTÉ :
À la ligne 306, les frais de service sont calculés sur `priceAfterDiscount` au lieu de `priceAfterDiscountWithDriver` !

**Ligne actuelle** :
```typescript
const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
```

**Devrait être** :
```typescript
const serviceFeeHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.travelerFeePercent / 100));
```

---

## 🔍 RÉSUMÉ DES VÉRIFICATIONS

| Point d'affichage | Prix total attendu | Revenu net propriétaire | Statut |
|-------------------|---------------------|--------------------------|--------|
| Résumé popup | 552 160 FCFA | - | ✅ Correct |
| Email locataire (demande) | 552 160 FCFA | - | ✅ Correct |
| Email propriétaire (demande) | - | 581 168 FCFA | ✅ Correct (uniquement revenu net) |
| Overview (`MyVehicleBookingsScreen`) | 552 160 FCFA | - | ⚠️ **BUG** : Frais service calculés sur mauvais montant |

---

## 🐛 BUG À CORRIGER

### Fichier : `AkwaHomeMobile/src/screens/MyVehicleBookingsScreen.tsx`

**Ligne 306** : Les frais de service sont calculés sur `priceAfterDiscount` au lieu de `priceAfterDiscountWithDriver`.

**Impact** :
- Avec les données de test : frais de service calculés sur 468 000 au lieu de 493 000
- Frais de service incorrects : 468 000 × 0.12 = 56 160 FCFA (au lieu de 59 160 FCFA)
- Total incorrect : 468 000 + 25 000 + 56 160 = 549 160 FCFA (au lieu de 552 160 FCFA)
- **Différence : -3 000 FCFA**

**Correction nécessaire** :
```typescript
// AVANT (incorrect)
const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));

// APRÈS (correct)
const serviceFeeHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.travelerFeePercent / 100));
```

---

## 📋 CHECKLIST DE VÉRIFICATION

### ✅ Résumé popup (`VehicleBookingScreen.tsx`)
- [x] Prix jours : 500 000 FCFA
- [x] Prix heures : 20 000 FCFA
- [x] Réduction : -52 000 FCFA
- [x] Sous-total : 468 000 FCFA
- [x] Surplus chauffeur : 25 000 FCFA
- [x] Frais de service : 59 160 FCFA (calculés sur 493 000)
- [x] Total : 552 160 FCFA
- [x] Caution : 100 000 FCFA

### ✅ Email locataire (`vehicle_booking_request_sent`)
- [x] Prix total : 552 160 FCFA
- [x] Durée : 5 jours et 2 heures
- [x] Caution : 100 000 FCFA

### ✅ Email propriétaire (`vehicle_booking_request`)
- [x] Revenu net : 581 168 FCFA (uniquement ce montant)
- [x] Pas de "Prix total payé par le locataire"
- [x] Pas de "Prix de base"
- [x] Durée : 5 jours et 2 heures

### ⚠️ Overview (`MyVehicleBookingsScreen.tsx`)
- [x] Prix total : 552 160 FCFA ✅ **CORRIGÉ**
- [x] Dates affichées correctement
- [x] Surplus chauffeur inclus dans le calcul ✅ **CORRIGÉ**
- [x] Frais de service calculés sur le bon montant ✅ **CORRIGÉ**

### ✅ Overview Web (`GuestVehicleBookingsPage.tsx`)
- [x] Prix total : Utilise `booking.total_price` directement (déjà calculé et stocké) ✅ Correct

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Bug corrigé dans `MyVehicleBookingsScreen.tsx`

**Problème** : Les frais de service étaient calculés sur `priceAfterDiscount` au lieu de `priceAfterDiscountWithDriver`, et le surplus chauffeur n'était pas inclus dans le total.

**Correction** :
```typescript
// Ajout du calcul du surplus chauffeur
const driverFee = (booking.with_driver && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
const priceAfterDiscountWithDriver = priceAfterDiscount + driverFee;

// Frais de service calculés sur le bon montant (inclut le chauffeur)
const serviceFeeHT = Math.round(priceAfterDiscountWithDriver * (commissionRates.travelerFeePercent / 100));
const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
const totalWithServiceFee = priceAfterDiscountWithDriver + effectiveServiceFee;
```

**Résultat** : Le total affiché dans l'overview est maintenant correct (552 160 FCFA avec les données de test).

---

## 🎯 RÉSUMÉ FINAL

### ✅ Tous les calculs sont maintenant cohérents :

1. **Résumé popup** (`VehicleBookingScreen.tsx`) : ✅ 552 160 FCFA
2. **Email locataire** (`vehicle_booking_request_sent`) : ✅ 552 160 FCFA
3. **Email propriétaire** (`vehicle_booking_request`) : ✅ 581 168 FCFA (revenu net uniquement)
4. **Overview mobile** (`MyVehicleBookingsScreen.tsx`) : ✅ 552 160 FCFA (corrigé)
5. **Overview web** (`GuestVehicleBookingsPage.tsx`) : ✅ Utilise `total_price` stocké (correct)

### 📊 Calculs détaillés validés :

- Prix jours : 500 000 FCFA ✅
- Prix heures : 20 000 FCFA ✅
- Réduction 10% : -52 000 FCFA ✅
- Prix après réduction : 468 000 FCFA ✅
- Surplus chauffeur : 25 000 FCFA ✅
- Prix avec chauffeur : 493 000 FCFA ✅
- Frais de service (12% TTC) : 59 160 FCFA ✅
- **Total locataire : 552 160 FCFA** ✅
- Commission propriétaire (2.4% TTC) : 11 832 FCFA ✅
- **Revenu net propriétaire : 581 168 FCFA** ✅

