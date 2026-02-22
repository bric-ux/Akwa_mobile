# 📋 OVERVIEW RÉSERVATION EN ATTENTE (PENDING)

## 🎯 Vue d'ensemble

Pour une réservation véhicule en statut **`pending`** (en attente de confirmation), voici ce qui doit être affiché dans l'overview pour le **locataire** et le **propriétaire**.

---

## 👤 VUE LOCATAIRE (Renter/Traveler)

### ✅ Ce qui DOIT être affiché

L'overview doit montrer **exactement** ce que le locataire va payer :

#### 1. **Détails de la location**
- Prix par jour : `daily_rate` (ex: 100 000 FCFA)
- Durée : `rental_days` jours + `rental_hours` heures (ex: 5 jours et 2 heures)
- Prix des jours : `daily_rate × rental_days` (ex: 500 000 FCFA)
- Prix des heures : `hourly_rate × rental_hours` (si applicable, ex: 20 000 FCFA)

#### 2. **Réductions** (si applicable)
- Réduction appliquée : `-discount_amount` (ex: -52 000 FCFA)
- Type de réduction : normale ou long séjour
- Pourcentage : selon le type

#### 3. **Sous-total**
- Prix après réduction : `base_price` (jours + heures - réduction)
- Ex: 468 000 FCFA

#### 4. **Surplus chauffeur** (si applicable)
- Surplus chauffeur : `driver_fee` (ex: 25 000 FCFA)
- **Note** : Affiché seulement si `with_driver = true`

#### 5. **Frais de service Akwahome**
- Frais de service : `service_fee` (TTC)
- **Important** : Pour véhicules, c'est 10% HT + 20% TVA = 12% TTC sur `base_price_with_driver`
- Ex: 59 160 FCFA

#### 6. **Total à payer**
- **Total** : `total_price` (ce que le locataire paie)
- Ex: 552 160 FCFA
- **Note** : Ce montant inclut TOUT (jours + heures - réduction + chauffeur + frais de service)

#### 7. **Caution** (si applicable)
- Caution : `security_deposit` (ex: 100 000 FCFA)
- **Note** : À payer en espèces lors de la récupération du véhicule

### ❌ Ce qui NE DOIT PAS être affiché

- ❌ Commission propriétaire
- ❌ Revenu net propriétaire
- ❌ Détails TVA (HT, TVA, TTC) - sauf si facture détaillée demandée

---

## 🏢 VUE PROPRIÉTAIRE (Owner/Host)

### ✅ Ce qui DOIT être affiché

L'overview doit montrer **exactement** ce que le propriétaire va recevoir :

#### 1. **Détails de la location**
- Prix par jour : `daily_rate` (ex: 100 000 FCFA)
- Durée : `rental_days` jours + `rental_hours` heures (ex: 5 jours et 2 heures)
- Prix des jours : `daily_rate × rental_days` (ex: 500 000 FCFA)
- Prix des heures : `hourly_rate × rental_hours` (si applicable, ex: 20 000 FCFA)

#### 2. **Réductions** (si applicable)
- Réduction appliquée : `-discount_amount` (ex: -52 000 FCFA)
- Type de réduction : normale ou long séjour

#### 3. **Sous-total**
- Prix après réduction : `base_price` (jours + heures - réduction)
- Ex: 468 000 FCFA

#### 4. **Surplus chauffeur** (si applicable)
- Surplus chauffeur : `driver_fee` (ex: 25 000 FCFA)
- **Note** : Affiché seulement si `with_driver = true`

#### 5. **Commission Akwahome**
- Commission : `host_commission` (TTC)
- **Important** : Pour véhicules, c'est 2% HT + 20% TVA = 2.4% TTC sur `base_price_with_driver`
- Ex: 11 832 FCFA

#### 6. **Revenu net**
- **Vous recevez** : `host_net_amount` (ce que le propriétaire reçoit)
- Ex: 481 168 FCFA
- **Note** : Ce montant = `base_price_with_driver - host_commission`
- **Important** : La caution n'est PAS incluse dans le revenu net (payée en espèces)

#### 7. **Caution** (si applicable)
- Caution : `security_deposit` (ex: 100 000 FCFA)
- **Note** : À recevoir en espèces lors de la remise du véhicule

### ❌ Ce qui NE DOIT PAS être affiché

- ❌ Frais de service locataire (ce n'est pas le problème du propriétaire)
- ❌ Total payé par le locataire (sauf si nécessaire pour contexte)

---

## 📊 UTILISATION DES DONNÉES STOCKÉES

### ✅ Pour les nouvelles réservations (avec `booking_calculation_details`)

**Tous les montants doivent être récupérés depuis `booking_calculation_details`** :

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
  const daysPrice = calcDetails.days_price;
  const hoursPrice = calcDetails.hours_price;
  const discountAmount = calcDetails.discount_amount;
  const basePrice = calcDetails.base_price;
  const driverFee = calcDetails.driver_fee;
  const serviceFee = calcDetails.service_fee; // Pour locataire
  const hostCommission = calcDetails.host_commission; // Pour propriétaire
  const totalPrice = calcDetails.total_price; // Pour locataire
  const hostNetAmount = calcDetails.host_net_amount; // Pour propriétaire
}
```

### ⚠️ Pour les anciennes réservations (sans `booking_calculation_details`)

**Fallback sur recalcul** uniquement si les données stockées n'existent pas.

---

## 🎨 EXEMPLE D'AFFICHAGE

### Vue Locataire (Pending)

```
┌─────────────────────────────────────┐
│ Résumé                              │
├─────────────────────────────────────┤
│ Prix par jour        100 000 FCFA  │
│ Durée                5 jours et 2h │
│                                      │
│ 5 jours × 100 000    500 000 FCFA  │
│ 2 heures × 10 000     20 000 FCFA  │
│ Réduction (10%)      -52 000 FCFA  │
│ ─────────────────────────────────── │
│ Sous-total            468 000 FCFA  │
│ Surplus chauffeur      25 000 FCFA  │
│ Frais de service       59 160 FCFA  │
│ ─────────────────────────────────── │
│ Total                 552 160 FCFA  │
│                                      │
│ Caution               100 000 FCFA  │
│ (À payer en espèces)                │
└─────────────────────────────────────┘
```

### Vue Propriétaire (Pending)

```
┌─────────────────────────────────────┐
│ Votre versement                     │
├─────────────────────────────────────┤
│ Prix par jour        100 000 FCFA  │
│ Durée                5 jours et 2h │
│                                      │
│ 5 jours × 100 000    500 000 FCFA  │
│ 2 heures × 10 000     20 000 FCFA  │
│ Réduction (10%)      -52 000 FCFA  │
│ ─────────────────────────────────── │
│ Sous-total            468 000 FCFA  │
│ Surplus chauffeur      25 000 FCFA  │
│ Commission Akwahome     11 832 FCFA │
│ ─────────────────────────────────── │
│ Vous recevez          481 168 FCFA  │
│                                      │
│ Caution               100 000 FCFA  │
│ (À recevoir en espèces)             │
└─────────────────────────────────────┘
```

---

## ✅ RÈGLES IMPORTANTES

1. **Pour les réservations PENDING** :
   - ✅ Afficher tous les montants calculés (même si pas encore confirmés)
   - ✅ Utiliser les données stockées dans `booking_calculation_details` si disponibles
   - ✅ Les montants sont fixes et ne changeront pas après confirmation

2. **Cohérence** :
   - ✅ Les montants affichés doivent correspondre EXACTEMENT aux montants stockés
   - ✅ Aucun recalcul ne doit être fait si les données stockées existent

3. **Différence Locataire vs Propriétaire** :
   - **Locataire** voit : Total payé (avec frais de service)
   - **Propriétaire** voit : Revenu net (après commission)

---

## 🔍 VÉRIFICATION

Pour vérifier que l'affichage est correct :

1. Créer une réservation véhicule avec chauffeur et réduction
2. Vérifier que `booking_calculation_details` est créé
3. Vérifier l'overview locataire : doit afficher `total_price`
4. Vérifier l'overview propriétaire : doit afficher `host_net_amount`
5. Vérifier que les montants correspondent aux données stockées




