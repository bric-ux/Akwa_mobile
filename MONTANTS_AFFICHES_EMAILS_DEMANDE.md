# 💰 MONTANTS À AFFICHER DANS LES EMAILS DE DEMANDE

## 🎯 Vue d'ensemble

Pour une réservation véhicule en statut **`pending`** (en attente), voici exactement quels montants doivent être affichés dans chaque email.

---

## 1. 📧 EMAIL AU LOCATAIRE (`vehicle_booking_request_sent`)

### ✅ Montant à afficher

**UNIQUEMENT** :
- **Total à payer** : `totalPrice` (depuis `booking_calculation_details.total_price` ou `booking.total_price`)
- **Caution** : `securityDeposit` (si applicable, affichée séparément)

### 📋 Exemple d'affichage dans l'email

```
┌─────────────────────────────────────┐
│ Récapitulatif de votre demande     │
├─────────────────────────────────────┤
│ Véhicule: Peugeot 208              │
│ Du: 15 février 2025                 │
│ Au: 20 février 2025                 │
│ Durée: 5 jours et 2 heures         │
│                                      │
│ Prix total: 552 160 FCFA           │
│                                      │
│ Caution à prévoir: 100 000 FCFA    │
│ (À payer en espèces)                │
└─────────────────────────────────────┘
```

### ❌ NE PAS afficher

- ❌ Détails de calcul (jours × prix, heures × prix, réduction, chauffeur, frais de service)
- ❌ Sous-totaux intermédiaires
- ❌ Commission propriétaire
- ❌ Revenu net propriétaire

**Raison** : Le locataire n'a besoin que de savoir combien il va payer au total.

---

## 2. 📧 EMAIL AU PROPRIÉTAIRE (`vehicle_booking_request`)

### ✅ Montant à afficher

**UNIQUEMENT** :
- **Revenu net estimé** : `ownerNetRevenue` (depuis `booking_calculation_details.host_net_amount` ou `booking.host_net_amount`)
- **Caution** : `securityDeposit` (si applicable, affichée séparément)

### 📋 Exemple d'affichage dans l'email

```
┌─────────────────────────────────────┐
│ Détails de la demande              │
├─────────────────────────────────────┤
│ Locataire: Jean Dupont             │
│ 📞 Téléphone: +225 07 12 34 56 78  │
│                                      │
│ Prise du véhicule: 15 février 2025 │
│ Rendu du véhicule: 20 février 2025 │
│ Durée: 5 jours et 2 heures         │
│                                      │
│ 💰 Revenu net estimé               │
│ (après commission):                 │
│ 481 168 FCFA                        │
│                                      │
│ 💰 Caution: 100 000 FCFA            │
│ (À recevoir en espèces)             │
└─────────────────────────────────────┘
```

### ❌ NE PAS afficher

- ❌ Total payé par le locataire (sauf si nécessaire pour contexte)
- ❌ Détails de calcul (jours × prix, heures × prix, réduction, chauffeur)
- ❌ Frais de service locataire
- ❌ Détails de la commission (montant exact)

**Raison** : Le propriétaire n'a besoin que de savoir combien il va recevoir au net.

---

## 🔍 UTILISATION DES DONNÉES STOCKÉES

### ✅ Priorité : `booking_calculation_details`

```typescript
// Récupérer les données stockées
const { data: calcDetails } = await supabase
  .from('booking_calculation_details')
  .select('total_price, host_net_amount')
  .eq('booking_id', booking.id)
  .eq('booking_type', 'vehicle')
  .single();

// Pour l'email locataire
const totalPrice = calcDetails?.total_price || booking.total_price;

// Pour l'email propriétaire
const hostNetAmount = calcDetails?.host_net_amount || booking.host_net_amount;
```

### ⚠️ Fallback

Si `booking_calculation_details` n'existe pas :
- Utiliser `booking.total_price` pour le locataire
- Utiliser `booking.host_net_amount` pour le propriétaire

---

## 📝 CODE ACTUEL DANS LES EMAILS

### Email Locataire (`vehicle_booking_request_sent`)

**Ligne actuelle** :
```typescript
<li style="padding: 8px 0;"><strong>Prix total:</strong> ${data.totalPrice?.toLocaleString('fr-FR')} FCFA</li>
```

**✅ CORRECT** : Affiche uniquement le total à payer.

### Email Propriétaire (`vehicle_booking_request`)

**Ligne actuelle** :
```typescript
<div class="detail-label">💰 Revenu net estimé (après commission)</div>
<div class="detail-value">${data.ownerNetRevenue?.toLocaleString('fr-FR')} FCFA</div>
```

**✅ CORRECT** : Affiche uniquement le revenu net.

---

## ✅ RÉSUMÉ

| Email | Montant affiché | Source de données |
|-------|----------------|-------------------|
| **Locataire** (`vehicle_booking_request_sent`) | **Total à payer** | `booking_calculation_details.total_price` ou `booking.total_price` |
| **Propriétaire** (`vehicle_booking_request`) | **Revenu net** | `booking_calculation_details.host_net_amount` ou `booking.host_net_amount` |

**Les deux emails affichent également la caution séparément** (si applicable).

---

## 🎯 RÈGLES IMPORTANTES

1. **Simplicité** : Un seul montant principal par email
2. **Clarté** : Le locataire voit ce qu'il paie, le propriétaire voit ce qu'il reçoit
3. **Cohérence** : Utiliser les données stockées, pas de recalcul
4. **Caution** : Toujours affichée séparément (payée/reçue en espèces)




