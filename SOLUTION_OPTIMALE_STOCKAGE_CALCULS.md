# 🎯 SOLUTION OPTIMALE - STOCKAGE COMPLET DES CALCULS

## 📊 ANALYSE ACTUELLE

### ✅ Ce qui est DÉJÀ stocké

#### Table `bookings` (Propriétés)
- `total_price` ✅
- `host_net_amount` ✅
- `discount_amount` ✅
- `discount_applied` ✅
- `original_total` ✅

#### Table `vehicle_bookings` (Véhicules)
- `total_price` ✅
- `host_net_amount` ✅
- `discount_amount` ✅
- `discount_applied` ✅
- `original_total` ✅
- `daily_rate` ✅
- `hourly_rate` ✅
- `rental_days` ✅
- `rental_hours` ✅
- `with_driver` ✅
- `security_deposit` ✅

---

### ❌ Ce qui est RECALCULÉ à chaque fois

#### Frais de service (voyageur)
- `serviceFee` (10% ou 12% + TVA)
- `serviceFeeHT` (hors taxes)
- `serviceFeeVAT` (TVA 20%)

#### Commission hôte
- `hostCommission` (2% + TVA)
- `hostCommissionHT` (hors taxes)
- `hostCommissionVAT` (TVA 20%)

#### Frais additionnels
- `effectiveCleaningFee` (avec logique `free_cleaning_min_days`)
- `effectiveTaxes` (taxe de séjour × nuits)

#### Prix intermédiaires
- `basePrice` (prix avant réduction)
- `priceAfterDiscount` (prix après réduction)
- `basePriceWithDriver` (prix avec chauffeur pour véhicules)
- `driverFee` (surplus chauffeur - parfois déduit)

---

## 🎯 SOLUTION OPTIMALE : TABLE DE DÉTAILS DE CALCUL

### Concept : "Snapshot" complet des calculs

**Idée** : Créer une table dédiée qui stocke **TOUS les détails de calcul** pour chaque réservation, comme un "snapshot" complet au moment de la création.

---

## 📋 SCHÉMA PROPOSÉ

### Option 1 : Colonnes supplémentaires dans les tables existantes

#### Table `bookings` (Propriétés)

```sql
-- Colonnes existantes
total_price INTEGER NOT NULL,
host_net_amount INTEGER,
discount_amount INTEGER,
discount_applied BOOLEAN,
original_total INTEGER,

-- NOUVELLES colonnes à ajouter
-- Prix de base
base_price INTEGER,                    -- Prix avant réduction (price_per_night × nights)
price_after_discount INTEGER,          -- Prix après réduction (base_price - discount_amount)

-- Frais de service (voyageur)
service_fee INTEGER,                   -- Frais de service TTC (12% pour propriétés)
service_fee_ht INTEGER,                -- Frais de service HT
service_fee_vat INTEGER,               -- TVA sur frais de service

-- Commission hôte
host_commission INTEGER,               -- Commission TTC (2% + TVA)
host_commission_ht INTEGER,            -- Commission HT
host_commission_vat INTEGER,           -- TVA sur commission

-- Frais additionnels
effective_cleaning_fee INTEGER,        -- Frais de ménage effectifs (avec free_cleaning_min_days)
effective_taxes INTEGER,               -- Taxe de séjour effectifs (taxes × nights)

-- Métadonnées de calcul
calculation_snapshot JSONB,            -- Snapshot complet des données utilisées pour le calcul
calculated_at TIMESTAMP WITH TIME ZONE -- Date/heure du calcul
```

#### Table `vehicle_bookings` (Véhicules)

```sql
-- Colonnes existantes
total_price INTEGER NOT NULL,
host_net_amount INTEGER,
discount_amount INTEGER,
discount_applied BOOLEAN,
original_total INTEGER,
daily_rate INTEGER,
hourly_rate INTEGER,
rental_days INTEGER,
rental_hours INTEGER,
with_driver BOOLEAN,
security_deposit INTEGER,

-- NOUVELLES colonnes à ajouter
-- Prix de base
base_price INTEGER,                    -- Prix avant réduction (jours + heures)
price_after_discount INTEGER,          -- Prix après réduction
base_price_with_driver INTEGER,       -- Prix avec chauffeur (si applicable)
driver_fee INTEGER,                   -- Surplus chauffeur

-- Frais de service (voyageur)
service_fee INTEGER,                   -- Frais de service TTC (12% pour véhicules)
service_fee_ht INTEGER,                -- Frais de service HT
service_fee_vat INTEGER,               -- TVA sur frais de service

-- Commission propriétaire
owner_commission INTEGER,             -- Commission TTC (2% + TVA)
owner_commission_ht INTEGER,          -- Commission HT
owner_commission_vat INTEGER,         -- TVA sur commission

-- Prix détaillés
days_price INTEGER,                    -- Prix des jours uniquement
hours_price INTEGER,                   -- Prix des heures uniquement
total_before_discount INTEGER,        -- Total avant réduction (jours + heures)

-- Métadonnées de calcul
calculation_snapshot JSONB,            -- Snapshot complet des données utilisées
calculated_at TIMESTAMP WITH TIME ZONE -- Date/heure du calcul
```

---

### Option 2 : Table séparée `booking_calculation_details` (RECOMMANDÉE)

**Avantage** : Séparation des responsabilités, plus flexible, ne modifie pas les tables existantes

```sql
CREATE TABLE booking_calculation_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  booking_type TEXT NOT NULL CHECK (booking_type IN ('property', 'vehicle')),
  
  -- Prix de base
  base_price INTEGER NOT NULL,
  price_after_discount INTEGER NOT NULL,
  base_price_with_driver INTEGER, -- Pour véhicules uniquement
  
  -- Réductions
  discount_amount INTEGER DEFAULT 0,
  discount_applied BOOLEAN DEFAULT false,
  original_total INTEGER NOT NULL,
  discount_type TEXT, -- 'normal' | 'long_stay'
  
  -- Frais de service (voyageur)
  service_fee INTEGER NOT NULL,        -- TTC
  service_fee_ht INTEGER NOT NULL,      -- HT
  service_fee_vat INTEGER NOT NULL,     -- TVA
  
  -- Commission hôte/propriétaire
  host_commission INTEGER NOT NULL,    -- TTC
  host_commission_ht INTEGER NOT NULL,  -- HT
  host_commission_vat INTEGER NOT NULL, -- TVA
  
  -- Frais additionnels (propriétés uniquement)
  effective_cleaning_fee INTEGER DEFAULT 0,
  effective_taxes INTEGER DEFAULT 0,
  
  -- Détails véhicules (si applicable)
  days_price INTEGER,
  hours_price INTEGER,
  driver_fee INTEGER,
  total_before_discount INTEGER,
  
  -- Totaux finaux
  total_price INTEGER NOT NULL,         -- Total payé par le voyageur
  host_net_amount INTEGER NOT NULL,    -- Revenu net hôte/propriétaire
  
  -- Snapshot des données utilisées pour le calcul
  calculation_snapshot JSONB NOT NULL, -- Toutes les données utilisées
  
  -- Métadonnées
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT fk_property_booking FOREIGN KEY (booking_id) 
    REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_vehicle_booking FOREIGN KEY (booking_id) 
    REFERENCES vehicle_bookings(id) ON DELETE CASCADE,
  CONSTRAINT check_booking_type_match CHECK (
    (booking_type = 'property' AND booking_id IN (SELECT id FROM bookings)) OR
    (booking_type = 'vehicle' AND booking_id IN (SELECT id FROM vehicle_bookings))
  )
);

-- Index pour performance
CREATE INDEX idx_booking_calc_details_booking_id ON booking_calculation_details(booking_id);
CREATE INDEX idx_booking_calc_details_type ON booking_calculation_details(booking_type);
```

---

## 📊 STRUCTURE DU `calculation_snapshot` (JSONB)

### Pour les propriétés

```json
{
  "serviceType": "property",
  "pricePerNight": 50000,
  "nights": 3,
  "discountConfig": {
    "enabled": true,
    "minNights": 3,
    "percentage": 10
  },
  "longStayDiscountConfig": {
    "enabled": false
  },
  "cleaningFee": 10000,
  "taxesPerNight": 500,
  "freeCleaningMinDays": 7,
  "commissionRates": {
    "travelerFeePercent": 12,
    "hostFeePercent": 2
  },
  "calculatedAt": "2025-01-30T10:00:00Z"
}
```

### Pour les véhicules

```json
{
  "serviceType": "vehicle",
  "dailyRate": 50000,
  "hourlyRate": 5000,
  "rentalDays": 3,
  "rentalHours": 5,
  "discountConfig": {
    "enabled": true,
    "minDays": 3,
    "percentage": 10
  },
  "longStayDiscountConfig": {
    "enabled": false
  },
  "withDriver": true,
  "driverFee": 15000,
  "securityDeposit": 100000,
  "commissionRates": {
    "travelerFeePercent": 12,
    "hostFeePercent": 2
  },
  "calculatedAt": "2025-01-30T10:00:00Z"
}
```

---

## ✅ AVANTAGES DE CETTE SOLUTION

### 1. **Zéro recalcul**
- Tous les montants sont stockés une seule fois
- Affichage direct sans calcul
- Performance optimale

### 2. **Cohérence garantie**
- Une seule source de vérité
- Pas de différences entre affichages
- Pas de problèmes d'arrondi

### 3. **Traçabilité complète**
- `calculation_snapshot` contient toutes les données utilisées
- Possibilité de recalculer si nécessaire (audit)
- Historique préservé même si les règles changent

### 4. **Flexibilité**
- Table séparée = pas de modification des tables existantes
- Facile à ajouter/retirer des champs
- Compatible avec anciennes réservations (fallback)

### 5. **Audit et debugging**
- Voir exactement ce qui a été calculé
- Comparer avec les règles actuelles
- Détecter les incohérences

---

## 🔄 MIGRATION PROGRESSIVE

### Phase 1 : Créer la table
```sql
CREATE TABLE booking_calculation_details (...);
```

### Phase 2 : Remplir pour nouvelles réservations
- Modifier `createBooking()` pour remplir la table
- Toutes les nouvelles réservations ont les détails complets

### Phase 3 : Remplir pour anciennes réservations (optionnel)
- Script de migration pour recalculer et remplir
- Ou laisser NULL et utiliser fallback

### Phase 4 : Modifier l'affichage
- Utiliser les valeurs stockées au lieu de recalculer
- Fallback sur recalcul si `calculation_details` est NULL

---

## 📝 EXEMPLE D'UTILISATION

### Lors de la création

```typescript
// Calculer tous les montants
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
  calculation_snapshot: {
    serviceType: 'vehicle',
    dailyRate: dailyRate,
    rentalDays: rentalDays,
    // ... toutes les données utilisées
  }
};

// Insérer la réservation
const booking = await supabase.from('vehicle_bookings').insert({...});

// Insérer les détails de calcul
await supabase.from('booking_calculation_details').insert({
  booking_id: booking.id,
  booking_type: 'vehicle',
  ...calculationDetails
});
```

### Lors de l'affichage

```typescript
// Récupérer les détails de calcul
const { data: calcDetails } = await supabase
  .from('booking_calculation_details')
  .select('*')
  .eq('booking_id', booking.id)
  .single();

if (calcDetails) {
  // ✅ Utiliser directement les valeurs stockées
  return {
    totalPrice: calcDetails.total_price,
    hostNetAmount: calcDetails.host_net_amount,
    serviceFee: calcDetails.service_fee,
    hostCommission: calcDetails.host_commission,
    // ... tous les autres montants
  };
} else {
  // ⚠️ Fallback : recalculer (anciennes réservations)
  return calculateAllAmounts(booking);
}
```

---

## 🎯 RECOMMANDATION FINALE

### **Option 2 : Table séparée `booking_calculation_details`**

**Pourquoi ?**
1. ✅ Ne modifie pas les tables existantes
2. ✅ Plus flexible et extensible
3. ✅ Séparation des responsabilités
4. ✅ Facile à migrer progressivement
5. ✅ Compatible avec anciennes réservations

### Structure minimale recommandée

```sql
CREATE TABLE booking_calculation_details (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL,
  booking_type TEXT NOT NULL,
  
  -- Totaux finaux (essentiels)
  total_price INTEGER NOT NULL,
  host_net_amount INTEGER NOT NULL,
  
  -- Détails de calcul (pour affichage détaillé)
  base_price INTEGER,
  price_after_discount INTEGER,
  service_fee INTEGER,
  service_fee_ht INTEGER,
  service_fee_vat INTEGER,
  host_commission INTEGER,
  host_commission_ht INTEGER,
  host_commission_vat INTEGER,
  
  -- Snapshot pour audit
  calculation_snapshot JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 📋 PLAN D'IMPLÉMENTATION

### Étape 1 : Créer la migration
- Créer `booking_calculation_details`
- Ajouter les contraintes et index

### Étape 2 : Modifier `createBooking()`
- Calculer tous les montants
- Insérer dans `booking_calculation_details`
- Nouvelles réservations = complètes

### Étape 3 : Modifier les composants d'affichage
- `InvoiceDisplay.tsx` : Utiliser `calculation_details` si disponible
- `HostBookingsScreen.tsx` : Utiliser valeurs stockées
- PDFs : Utiliser valeurs stockées

### Étape 4 : Migration des anciennes réservations (optionnel)
- Script pour recalculer et remplir
- Ou laisser NULL avec fallback

---

## 💡 CONCLUSION

**Solution optimale** : Table séparée `booking_calculation_details` qui stocke **TOUS** les détails de calcul.

**Bénéfices** :
- ✅ Zéro recalcul
- ✅ Cohérence garantie
- ✅ Performance optimale
- ✅ Traçabilité complète
- ✅ Migration progressive possible

**Prochaine étape** : Créer la migration et modifier `createBooking()` pour remplir cette table.



