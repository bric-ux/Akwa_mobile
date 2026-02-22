# 🔍 ANALYSE COMPLÈTE - RÉSERVATION DE LOCATION DE VÉHICULE

## 📋 TABLE DES MATIÈRES
1. [Informations stockées dans la réservation](#informations-stockées)
2. [Opérations basées sur la réservation](#opérations-basées-sur-réservation)
3. [Flux de création de réservation](#flux-création)
4. [Gestion des statuts](#gestion-statuts)
5. [Calculs basés sur la réservation](#calculs-basés-sur-réservation)

---

## 📊 INFORMATIONS STOCKÉES DANS LA RÉSERVATION

### Table `vehicle_bookings` - Structure complète

#### Identifiants et relations
- `id` (UUID) - Identifiant unique de la réservation
- `vehicle_id` (UUID) - Référence au véhicule loué
- `renter_id` (UUID) - Référence au locataire (profiles.user_id)

#### Dates et durée
- `start_date` (DATE) - Date de début de location (pour compatibilité)
- `end_date` (DATE) - Date de fin de location (pour compatibilité)
- `start_datetime` (TIMESTAMP WITH TIME ZONE) - **Date et heure de début** (obligatoire)
- `end_datetime` (TIMESTAMP WITH TIME ZONE) - **Date et heure de fin** (obligatoire)
- `rental_type` (ENUM: 'daily' | 'hourly') - Type de location
- `rental_days` (INTEGER) - Nombre de jours complets de location
- `rental_hours` (INTEGER, nullable) - Nombre d'heures (pour location par heure ou heures restantes)

#### Tarification
- `daily_rate` (INTEGER) - Tarif journalier utilisé pour cette réservation
- `hourly_rate` (INTEGER, nullable) - Tarif horaire utilisé (si applicable)
- `total_price` (INTEGER) - **Prix total payé** (inclut frais de service 10% + TVA)
- `security_deposit` (INTEGER) - Montant de la caution (payée en espèces, non inclus dans revenu net)
- `host_net_amount` (INTEGER, nullable) - **Revenu net du propriétaire** (stocké pour éviter recalculs)

#### Réductions
- `discount_applied` (BOOLEAN) - Indique si une réduction a été appliquée
- `discount_amount` (INTEGER) - Montant de la réduction en FCFA
- `original_total` (INTEGER, nullable) - Prix total original avant réduction

#### Statut et workflow
- `status` (ENUM: 'pending' | 'confirmed' | 'cancelled' | 'completed')
  - `pending`: Réservation en attente de confirmation par le propriétaire
  - `confirmed`: Réservation confirmée (peut être calculée comme `in_progress` dynamiquement)
  - `cancelled`: Réservation annulée
  - `completed`: Réservation terminée (calculée dynamiquement si `end_date < today`)

#### Informations complémentaires
- `pickup_location` (TEXT, nullable) - Lieu de prise du véhicule
- `dropoff_location` (TEXT, nullable) - Lieu de rendu du véhicule
- `message_to_owner` (TEXT, nullable) - Message du locataire au propriétaire
- `special_requests` (TEXT, nullable) - Demandes spéciales

#### Permis de conduire
- `has_license` (BOOLEAN) - Le locataire possède un permis
- `license_years` (INTEGER, nullable) - Années d'expérience du permis
- `license_number` (TEXT, nullable) - Numéro de permis du locataire

#### Chauffeur
- `with_driver` (BOOLEAN) - **Indique si le locataire a choisi le chauffeur**
  - Si `true`: le surplus chauffeur (`driver_fee`) est ajouté au prix de base
  - La commission est calculée sur `basePrice + driverFee`

#### Annulation
- `cancelled_at` (TIMESTAMP WITH TIME ZONE, nullable) - Date d'annulation
- `cancelled_by` (UUID, nullable) - Utilisateur qui a annulé
- `cancellation_reason` (TEXT, nullable) - Raison de l'annulation
- `cancellation_penalty` (INTEGER) - Pénalité d'annulation

#### Métadonnées
- `created_at` (TIMESTAMP WITH TIME ZONE) - Date de création
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Date de dernière mise à jour
- `reminder_sent` (TIMESTAMP WITH TIME ZONE, nullable) - Date d'envoi du rappel

---

## 🔄 OPÉRATIONS BASÉES SUR LA RÉSERVATION

### 1. **Vérification de disponibilité**

#### Fonction SQL: `check_vehicle_hourly_availability`
- **Paramètres**:
  - `p_vehicle_id`: ID du véhicule
  - `p_start_datetime`: Date/heure de début
  - `p_end_datetime`: Date/heure de fin
  - `p_exclude_booking_id`: ID de réservation à exclure (pour modifications)

- **Logique**:
  - Vérifie les conflits avec les réservations existantes (`status IN ('pending', 'confirmed')`)
  - Prend en compte les créneaux horaires (`start_datetime`, `end_datetime`)
  - Vérifie les dates bloquées manuellement (`vehicle_blocked_dates`)
  - Utilise `tstzrange` pour détecter les chevauchements

- **Utilisée dans**:
  - `useVehicleBookings.createBooking()` - Avant création
  - Modifications de réservation

### 2. **Gestion du calendrier de disponibilité**

#### Table `vehicle_blocked_dates`
- Dates bloquées manuellement par le propriétaire
- Peut chevaucher ou remplacer les réservations

#### Calcul des dates indisponibles
```typescript
// Réservations qui bloquent les dates
status IN ('pending', 'confirmed')
// Les réservations 'completed' ne bloquent plus (end_date < today)
```

- **Réservations `pending`**: Bloquent temporairement (en attente de confirmation)
- **Réservations `confirmed`**: Bloquent définitivement
- **Réservations `completed`**: Ne bloquent plus (véhicule disponible)

### 3. **Envoi d'emails basé sur le statut**

#### Création de réservation
- **Si `auto_booking = true`** (réservation automatique):
  - `vehicle_booking_confirmed_renter` → Locataire (avec PDF)
  - `vehicle_booking_confirmed_owner` → Propriétaire (avec PDF)
  - `vehicle_booking_confirmed_admin` → Admin

- **Si `auto_booking = false`** (réservation sur demande):
  - `vehicle_booking_request_sent` → Locataire
  - `vehicle_booking_request` → Propriétaire

#### Confirmation manuelle (`updateBookingStatus`)
- Quand `status` passe de `pending` à `confirmed`:
  - `vehicle_booking_confirmed_renter` → Locataire (avec PDF)
  - `vehicle_booking_confirmed_owner` → Propriétaire (avec PDF)
  - `vehicle_booking_confirmed_admin` → Admin

#### Annulation
- `vehicle_booking_cancelled_renter` → Locataire
- `vehicle_booking_cancelled_owner` → Propriétaire

### 4. **Calcul du revenu net du propriétaire**

#### Formule de calcul
```typescript
// 1. Prix de base (après réduction)
basePrice = (daily_rate * rental_days) + (hourly_rate * rental_hours) - discount_amount

// 2. Ajouter le surplus chauffeur si applicable
basePriceWithDriver = basePrice + driverFee

// 3. Calculer la commission (2% HT + 20% TVA = 2.4% TTC)
hostCommissionHT = basePriceWithDriver * 0.02
hostCommissionVAT = hostCommissionHT * 0.20
hostCommission = hostCommissionHT + hostCommissionVAT

// 4. Revenu net (sans la caution, payée en espèces)
host_net_amount = basePriceWithDriver - hostCommission
```

#### Stockage
- `host_net_amount` est **calculé et stocké** lors de la création
- Évite les recalculs multiples et garantit la cohérence
- Utilisé pour:
  - Affichage dans les écrans propriétaire
  - Génération des PDFs de facture
  - Statistiques de revenus

### 5. **Gestion des statuts dynamiques**

#### Statuts calculés (non stockés en base)
- `in_progress`: Calculé dynamiquement si `start_date <= today <= end_date` ET `status = 'confirmed'`
- `completed`: Calculé dynamiquement si `end_date < today` ET `status != 'cancelled'`

#### Logique de calcul
```typescript
function getVehicleBookingStatus(booking: VehicleBooking): string {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'pending') return 'pending';
  
  if (booking.status === 'confirmed') {
    const today = new Date();
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);
    
    if (endDate < today) return 'completed';
    if (startDate <= today && today <= endDate) return 'in_progress';
    return 'confirmed';
  }
  
  return booking.status || 'pending';
}
```

### 6. **Gestion des documents de permis**

#### Table `license_documents`
- Stocke les documents de permis uploadés par le locataire
- Lié à la réservation via `vehicle_booking_id`
- Champs:
  - `user_id`: Propriétaire du document
  - `vehicle_booking_id`: Réservation associée
  - `document_url`: URL du document
  - `document_type`: Type (ex: 'driving_license')
  - `verified`: Statut de vérification
  - `verified_at`: Date de vérification

### 7. **Modifications de réservation**

#### Table `vehicle_booking_modification_requests`
- Permet de demander une modification de dates
- Champs:
  - `original_start_date`, `original_end_date`: Dates originales
  - `requested_start_date`, `requested_end_date`: Nouvelles dates demandées
  - `status`: 'pending' | 'accepted' | 'rejected'

- **Impact sur disponibilité**:
  - Les dates **originales** restent bloquées tant que la modification est `pending`
  - Les dates **demandées** sont vérifiées pour disponibilité

---

## 🚀 FLUX DE CRÉATION DE RÉSERVATION

### Étape 1: Validation des prérequis
1. ✅ Vérification de l'authentification (`user` doit exister)
2. ✅ Vérification de l'identité:
   - `hasUploadedIdentity` = true
   - `isVerified` = true OU `verificationStatus` = 'pending'
   - Blocage si `verificationStatus` = 'rejected'

### Étape 2: Validation des dates et heures
1. ✅ `start_datetime` et `end_datetime` doivent être fournis
2. ✅ `end_datetime` > `start_datetime`
3. ✅ `end_date` > `start_date` (pas le même jour)

### Étape 3: Détermination du type de location
- Si `rentalType === 'hourly'`:
  - Vérifie `hourly_rental_enabled = true`
  - Vérifie `price_per_hour` > 0
  - Calcule `rental_hours` (arrondi à l'heure supérieure)
  - Vérifie `rental_hours >= minimum_rental_hours`

- Si `rentalType === 'daily'`:
  - Calcule `rental_days` à partir des heures totales
  - Si `totalHours < 24`: nécessite `hourly_rental_enabled`
  - Calcule `rental_hours` (heures restantes après jours complets)
  - Vérifie `rental_days >= minimum_rental_days`

### Étape 4: Vérification de disponibilité
```typescript
const { data: isAvailable } = await supabase
  .rpc('check_vehicle_hourly_availability', {
    p_vehicle_id: vehicleId,
    p_start_datetime: startDateTime,
    p_end_datetime: endDateTime,
    p_exclude_booking_id: null
  });
```

### Étape 5: Calcul du prix
1. **Prix de base**:
   - Location par heure: `hourly_rate * rental_hours`
   - Location par jour: `daily_rate * rental_days + hourly_rate * rental_hours`

2. **Application des réductions** (si location par jour):
   - Réduction standard (`discount_enabled`, `discount_min_days`, `discount_percentage`)
   - Réduction longue durée (`long_stay_discount_enabled`, etc.)

3. **Ajout du surplus chauffeur**:
   - Si `with_driver = true` ET `vehicle.with_driver = true`:
     - `basePriceWithDriver = basePrice + driver_fee`

4. **Calcul des frais de service**:
   - `serviceFee = basePriceWithDriver * 0.10 * 1.20` (10% + 20% TVA = 12%)
   - `total_price = basePriceWithDriver + serviceFee`

5. **Calcul du revenu net**:
   - `hostCommission = basePriceWithDriver * 0.024` (2% HT + 20% TVA)
   - `host_net_amount = basePriceWithDriver - hostCommission`

### Étape 6: Détermination du statut initial
- Si `vehicle.auto_booking = true`: `status = 'confirmed'`
- Sinon: `status = 'pending'`

### Étape 7: Insertion en base de données
```typescript
const bookingInsert = {
  vehicle_id,
  renter_id,
  rental_type,
  start_date,
  end_date,
  start_datetime,
  end_datetime,
  rental_days,
  rental_hours,
  daily_rate,
  hourly_rate,
  total_price,
  host_net_amount,
  security_deposit,
  discount_applied,
  discount_amount,
  original_total,
  with_driver,
  status,
  // ... autres champs
};
```

### Étape 8: Sauvegarde du document de permis
- Si `licenseDocumentUrl` fourni:
  - Insertion dans `license_documents` avec `vehicle_booking_id`

### Étape 9: Envoi des emails
- Selon le statut initial (`confirmed` ou `pending`)
- Inclut les PDFs de facture pour les confirmations

---

## 📈 CALCULS BASÉS SUR LA RÉSERVATION

### 1. **Statistiques propriétaire**

#### Par véhicule
- Total de réservations
- Réservations `pending`
- Réservations `confirmed`
- Réservations `in_progress` (calculé)
- Réservations `completed` (calculé)
- Réservations `cancelled`
- Revenu total (somme des `host_net_amount`)

#### Disponibilité
- Véhicule actuellement loué si `in_progress` existe
- Dates bloquées par réservations `pending` ou `confirmed`

### 2. **Statistiques locataire**

#### Mes réservations
- Toutes les réservations où `renter_id = user.id`
- Triées par `created_at DESC`
- Statuts calculés dynamiquement

#### Possibilité de modification
- `canModify`: `status IN ('pending', 'confirmed')` ET `end_date >= today`
- `canCancel`: `status NOT IN ('cancelled', 'completed')` ET `end_date >= today`

### 3. **Génération de PDFs**

#### Données utilisées depuis la réservation
- Dates: `start_date`, `end_date`, `start_datetime`, `end_datetime`
- Durée: `rental_days`, `rental_hours`
- Tarifs: `daily_rate`, `hourly_rate`
- Prix: `total_price`, `discount_amount`, `original_total`
- Revenu net: `host_net_amount`
- Chauffeur: `with_driver`, `driver_fee`
- Caution: `security_deposit`

---

## 🔐 RÈGLES MÉTIER IMPORTANTES

### 1. **Disponibilité**
- Les réservations `pending` et `confirmed` bloquent les dates
- Les réservations `completed` ne bloquent plus
- Les dates bloquées manuellement ont priorité
- Les modifications en attente gardent les dates originales bloquées

### 2. **Calcul du prix**
- La commission est calculée sur `basePrice + driverFee` (si chauffeur)
- La caution n'est PAS incluse dans le revenu net (payée en espèces)
- Les frais de service (10% + TVA) sont ajoutés au prix de base
- `host_net_amount` est stocké pour éviter les recalculs

### 3. **Statuts**
- `pending` → `confirmed`: Confirmation manuelle par propriétaire
- `pending` → `cancelled`: Annulation
- `confirmed` → `in_progress`: Calculé automatiquement (pas stocké)
- `confirmed` → `completed`: Calculé automatiquement (pas stocké)

### 4. **Validation**
- Vérification d'identité obligatoire avant réservation
- Vérification de disponibilité avant création
- Validation des dates (pas le même jour pour début/fin)
- Validation des durées minimales (jours/heures)

---

## 📝 NOTES IMPORTANTES

1. **Heures obligatoires**: Même pour les locations par jour, `start_datetime` et `end_datetime` sont obligatoires
2. **Revenu net stocké**: `host_net_amount` est calculé une fois et stocké pour garantir la cohérence
3. **Statuts dynamiques**: `in_progress` et `completed` sont calculés côté client, pas stockés en base
4. **Chauffeur**: Le surplus chauffeur est inclus dans le calcul de commission mais pas la caution
5. **Modifications**: Les dates originales restent bloquées tant que la modification est en attente

---

## 🔗 FICHIERS CLÉS

- **Hook principal**: `src/hooks/useVehicleBookings.ts`
- **Types**: `src/types/index.ts` (interface `VehicleBooking`)
- **Migrations**: `supabase/migrations/20251128211423_*.sql`
- **Calendrier**: `src/hooks/useVehicleAvailabilityCalendar.ts`
- **Calculs**: `src/lib/hostNetAmount.ts`, `src/hooks/usePricing.ts`




