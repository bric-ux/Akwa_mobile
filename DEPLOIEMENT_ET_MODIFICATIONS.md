# 📋 DÉPLOIEMENT ET GESTION DES MODIFICATIONS

## ✅ 1. DÉPLOIEMENT DES EDGE FUNCTIONS

### ⚠️ OUI, IL FAUT DÉPLOYER

Les Edge Functions **DOIVENT** être déployées car nous avons modifié :
- `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`
  - `generateVehicleBookingPDF()` : Utilise maintenant `booking_calculation_details`
  - `generateInvoicePDFForEmail()` : Utilise maintenant `booking_calculation_details`

### Commandes de déploiement

```bash
# Depuis le répertoire du projet
cd cote-d-ivoire-stays

# Déployer la fonction send-email
supabase functions deploy send-email
```

## ✅ 2. GESTION DES MODIFICATIONS DE RÉSERVATION

### Problème identifié

Lors d'une modification de réservation (prolongement, changement de dates, etc.), les hooks mettaient à jour :
- ✅ `total_price` dans `bookings` ou `vehicle_bookings`
- ✅ `host_net_amount` dans certains cas
- ❌ **MAIS PAS** `booking_calculation_details`

### Solution implémentée

#### 1. Fonction helper créée

**Fichier** : `AkwaHomeMobile/src/lib/updateBookingCalculationDetails.ts`

Deux fonctions :
- `updatePropertyBookingCalculationDetails()` : Pour les propriétés
- `updateVehicleBookingCalculationDetails()` : Pour les véhicules

Ces fonctions :
- Recalculent tous les montants (frais, commissions, etc.)
- Mettent à jour ou créent l'enregistrement dans `booking_calculation_details`
- Utilisent la même logique que lors de la création pour garantir la cohérence

#### 2. Hooks modifiés

**Fichiers modifiés** :
- ✅ `AkwaHomeMobile/src/hooks/useBookingModifications.ts`
  - `approveModificationRequest()` : Appelle maintenant `updatePropertyBookingCalculationDetails()`
  
- ✅ `AkwaHomeMobile/src/hooks/useVehicleBookingModifications.ts`
  - `approveModificationRequest()` : Appelle maintenant `updateVehicleBookingCalculationDetails()`

### Flux de modification

```
1. Voyageur demande modification
   ↓
2. Hôte approuve la modification
   ↓
3. Hook met à jour la réservation :
   - Dates, prix, etc.
   - host_net_amount
   ↓
4. Hook appelle updateBookingCalculationDetails() :
   - Recalcule TOUS les montants
   - Met à jour booking_calculation_details
   ↓
5. ✅ Toutes les données sont cohérentes
```

## ✅ 3. VÉRIFICATIONS POST-DÉPLOIEMENT

### Vérifier que les Edge Functions sont déployées

```bash
# Vérifier le statut des fonctions
supabase functions list
```

### Tester une modification de réservation

1. Créer une réservation
2. Vérifier que `booking_calculation_details` est créé
3. Modifier la réservation (dates, etc.)
4. Vérifier que `booking_calculation_details` est mis à jour :

```sql
SELECT * FROM booking_calculation_details 
WHERE booking_id = 'ID_DE_LA_RESERVATION'
ORDER BY updated_at DESC;
```

### Vérifier les PDFs générés

1. Générer un PDF après modification
2. Vérifier que les montants correspondent aux données stockées dans `booking_calculation_details`

## 📊 RÉSUMÉ

| Action | Statut | Notes |
|--------|--------|-------|
| Migration BDD | ✅ Fait | Table `booking_calculation_details` créée |
| Stockage création | ✅ Fait | `useBookings.ts` et `useVehicleBookings.ts` |
| Utilisation affichage | ✅ Fait | `InvoiceDisplay.tsx` utilise les données stockées |
| Utilisation PDFs | ✅ Fait | Edge Functions modifiées |
| **Déploiement Edge Functions** | ⚠️ **À FAIRE** | **NÉCESSAIRE** |
| **Mise à jour modifications** | ✅ Fait | Hooks modifiés pour mettre à jour `booking_calculation_details` |

## 🎯 PROCHAINES ÉTAPES

1. ✅ Déployer les Edge Functions
2. ✅ Tester une modification de réservation
3. ✅ Vérifier que `booking_calculation_details` est mis à jour
4. ✅ Vérifier que les PDFs utilisent les bonnes données




