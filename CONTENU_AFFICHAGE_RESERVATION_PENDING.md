# 📋 CONTENU À AFFICHER : Réservation en attente (PENDING)

## 🎯 Vue d'ensemble

Pour une réservation véhicule en statut **`pending`** (en attente de confirmation), voici ce qui doit être affiché dans chaque contexte.

---

## 1. 📧 EMAIL DE DEMANDE DE RÉSERVATION

### 👤 Email au Locataire (`vehicle_booking_request_sent`)

**Sujet** : "Demande de réservation envoyée pour [Véhicule]"

**Contenu à afficher** :
- ✅ Nom du véhicule (marque + modèle)
- ✅ Dates de location (début et fin)
- ✅ Durée (jours + heures si applicable)
- ✅ **Total à payer** : `total_price` (ce que le locataire paiera)
- ✅ Caution : `security_deposit` (si applicable)
- ✅ Message informatif : "Votre demande a été envoyée au propriétaire. Vous recevrez une réponse dans les 24 heures."

**❌ NE PAS afficher** :
- ❌ Détails financiers complets (frais de service, réductions, etc.)
- ❌ Commission propriétaire
- ❌ Revenu net propriétaire

### 🏢 Email au Propriétaire (`vehicle_booking_request`)

**Sujet** : "Nouvelle demande de réservation pour [Véhicule]"

**Contenu à afficher** :
- ✅ Nom du locataire
- ✅ Téléphone du locataire (si disponible)
- ✅ Nom du véhicule (marque + modèle)
- ✅ Dates de location (début et fin)
- ✅ Durée (jours + heures si applicable)
- ✅ **Revenu net** : `host_net_amount` (ce que le propriétaire recevra)
- ✅ Caution : `security_deposit` (si applicable)
- ✅ Message du locataire (si fourni)
- ✅ Informations permis de conduire (si fournies)
- ✅ Boutons d'action : Accepter / Refuser

**❌ NE PAS afficher** :
- ❌ Frais de service locataire (ce n'est pas le problème du propriétaire)
- ❌ Total payé par le locataire (sauf si nécessaire pour contexte)

---

## 2. 📄 PDF DE RÉSERVATION

### ⚠️ IMPORTANT : Pas de PDF pour les réservations PENDING

**Les PDFs sont générés UNIQUEMENT pour les réservations CONFIRMÉES** :
- `vehicle_booking_confirmed_renter` → PDF facture locataire
- `vehicle_booking_confirmed_owner` → PDF justificatif propriétaire

**Pour les réservations PENDING** :
- ❌ Aucun PDF n'est généré
- ✅ Les détails sont dans l'email uniquement

---

## 3. ✅ CONFIRMATION DE RÉSERVATION (Détails)

### 👤 Vue Locataire (`vehicle_booking_confirmed_renter`)

**Email avec PDF attaché** :

**Contenu email** :
- ✅ Confirmation de réservation
- ✅ Nom du véhicule
- ✅ Dates de location
- ✅ Durée
- ✅ **Total payé** : `total_price`
- ✅ Caution (si applicable)
- ✅ Instructions de récupération

**PDF Facture Locataire** :
- ✅ Tous les détails financiers :
  - Prix par jour × nombre de jours
  - Prix des heures × nombre d'heures (si applicable)
  - Réduction appliquée (si applicable)
  - Sous-total
  - Surplus chauffeur (si applicable)
  - Frais de service Akwahome (avec détails TVA)
  - **Total payé** : `total_price`
  - Caution (si applicable)

### 🏢 Vue Propriétaire (`vehicle_booking_confirmed_owner`)

**Email avec PDF attaché** :

**Contenu email** :
- ✅ Confirmation de réservation
- ✅ Nom du locataire
- ✅ Nom du véhicule
- ✅ Dates de location
- ✅ Durée
- ✅ **Revenu net** : `host_net_amount`
- ✅ Caution (si applicable)

**PDF Justificatif Propriétaire** :
- ✅ Tous les détails financiers :
  - Prix par jour × nombre de jours
  - Prix des heures × nombre d'heures (si applicable)
  - Réduction appliquée (si applicable)
  - Sous-total
  - Surplus chauffeur (si applicable)
  - Commission Akwahome (avec détails TVA)
  - **Vous recevez** : `host_net_amount`
  - Caution (si applicable)

---

## 4. 📊 OVERVIEW (Résumé dans l'application)

### 👤 Vue Locataire

**Dans les détails de réservation (pending)** :

```
┌─────────────────────────────────────┐
│ Récapitulatif financier             │
├─────────────────────────────────────┤
│ Prix par jour        100 000 FCFA  │
│ × 5 jours            500 000 FCFA  │
│                                      │
│ Prix par heure         10 000 FCFA  │
│ × 2 heures              20 000 FCFA │
│                                      │
│ Réduction (10%)      -52 000 FCFA  │
│ ─────────────────────────────────── │
│ Sous-total            468 000 FCFA │
│ Surplus chauffeur       25 000 FCFA │
│ Frais de service       59 160 FCFA │
│ ─────────────────────────────────── │
│ Total                 552 160 FCFA │
│                                      │
│ Caution               100 000 FCFA │
│ (À payer en espèces)                │
└─────────────────────────────────────┘
```

### 🏢 Vue Propriétaire

**Dans les détails de réservation (pending)** :

```
┌─────────────────────────────────────┐
│ Votre versement                     │
├─────────────────────────────────────┤
│ Prix par jour        100 000 FCFA  │
│ × 5 jours            500 000 FCFA  │
│                                      │
│ Prix par heure         10 000 FCFA  │
│ × 2 heures              20 000 FCFA │
│                                      │
│ Réduction (10%)      -52 000 FCFA  │
│ ─────────────────────────────────── │
│ Sous-total            468 000 FCFA │
│ Surplus chauffeur       25 000 FCFA │
│ Commission Akwahome     11 832 FCFA │
│ ─────────────────────────────────── │
│ Vous recevez          481 168 FCFA │
│                                      │
│ Caution               100 000 FCFA │
│ (À recevoir en espèces)             │
└─────────────────────────────────────┘
```

---

## ✅ UTILISATION DES DONNÉES STOCKÉES

### Priorité d'utilisation

1. **Priorité 1** : `booking_calculation_details` (table dédiée)
2. **Priorité 2** : `total_price` et `host_net_amount` dans `vehicle_bookings`
3. **Fallback** : Recalcul uniquement si aucune donnée stockée

### Exemple de code

```typescript
// Récupérer les données stockées
const { data: calcDetails } = await supabase
  .from('booking_calculation_details')
  .select('*')
  .eq('booking_id', booking.id)
  .eq('booking_type', 'vehicle')
  .single();

if (calcDetails) {
  // ✅ Utiliser DIRECTEMENT les valeurs stockées
  const totalPrice = calcDetails.total_price; // Pour locataire
  const hostNetAmount = calcDetails.host_net_amount; // Pour propriétaire
  const serviceFee = calcDetails.service_fee;
  const hostCommission = calcDetails.host_commission;
  // ...
} else {
  // ⚠️ Fallback : Recalculer (anciennes réservations)
  // ...
}
```

---

## 📋 RÉCAPITULATIF PAR CONTEXTE

| Contexte | Locataire voit | Propriétaire voit |
|----------|----------------|-------------------|
| **Email demande (pending)** | Total à payer | Revenu net |
| **PDF** | ❌ Pas de PDF pour pending | ❌ Pas de PDF pour pending |
| **Email confirmation** | Total payé + PDF facture | Revenu net + PDF justificatif |
| **Overview app (pending)** | Détails complets + Total | Détails complets + Revenu net |

---

## 🎯 RÈGLES IMPORTANTES

1. **Pour PENDING** :
   - ✅ Afficher les montants calculés (même si pas encore confirmés)
   - ✅ Utiliser les données stockées dans `booking_calculation_details`
   - ✅ Les montants sont fixes et ne changeront pas après confirmation

2. **Pour CONFIRMED** :
   - ✅ PDFs générés automatiquement avec les emails
   - ✅ Utiliser les données stockées dans `booking_calculation_details`
   - ✅ Afficher tous les détails financiers

3. **Cohérence** :
   - ✅ Tous les montants doivent correspondre EXACTEMENT aux données stockées
   - ✅ Aucun recalcul ne doit être fait si les données stockées existent

---

## ✅ VÉRIFICATIONS

Pour vérifier que tout est correct :

1. ✅ Créer une réservation véhicule avec chauffeur et réduction
2. ✅ Vérifier que `booking_calculation_details` est créé
3. ✅ Vérifier l'email au locataire : doit afficher `total_price`
4. ✅ Vérifier l'email au propriétaire : doit afficher `host_net_amount`
5. ✅ Vérifier l'overview dans l'app : doit utiliser les données stockées
6. ✅ Confirmer la réservation
7. ✅ Vérifier les PDFs générés : doivent utiliser les données stockées



