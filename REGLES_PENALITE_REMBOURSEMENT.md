# 📋 RÈGLES DE PÉNALITÉ ET REMBOURSEMENT

## 🎯 Vue d'ensemble

L'application AkwaHome applique des règles de pénalité et de remboursement différentes selon :
- Le type de réservation (propriété meublée ou véhicule)
- Le rôle de la personne qui annule (locataire/voyageur ou propriétaire/hôte)
- Le délai avant le début de la réservation
- Le statut de la réservation (pending, confirmed, in_progress)

---

## 🏠 RÉSERVATIONS DE PROPRIÉTÉS MEUBLÉES

### 📌 **Politiques d'annulation disponibles**

Les propriétés peuvent avoir différentes politiques d'annulation :
- **`flexible`** : Annulation gratuite jusqu'à 24h avant l'arrivée. Remboursement intégral.
- **`moderate`** : Annulation gratuite jusqu'à 5 jours avant l'arrivée. Après, 50% de pénalité.
- **`strict`** : Annulation gratuite jusqu'à 7 jours avant l'arrivée. Après, 50% de pénalité.
- **`non_refundable`** : Aucun remboursement en cas d'annulation.

### 👤 **ANNULATION PAR LE VOYAGEUR (Locataire)**

#### **Réservation en statut `pending`**
- ✅ **Pénalité** : 0 FCFA
- ✅ **Remboursement** : 100% (le paiement n'a pas encore été effectué)

#### **Réservation confirmée (avant le début)**

**Politique `flexible`** :
- **≥ 1 jour avant** : 100% remboursé (0% pénalité)
- **< 1 jour avant** : 50% remboursé (50% pénalité)

**Politique `moderate`** :
- **≥ 5 jours avant** : 100% remboursé (0% pénalité)
- **< 5 jours avant** : 50% remboursé (50% pénalité)

**Politique `strict`** :
- **≥ 7 jours avant** : 100% remboursé (0% pénalité)
- **< 7 jours avant** : 50% remboursé (50% pénalité)

**Politique `non_refundable`** :
- ❌ **Annulation impossible** : Aucun remboursement

#### **Réservation en cours (`in_progress`)**
- **Remboursement** : 50% des nuitées restantes
- **Pénalité** : 50% des nuitées restantes

---

### 🏡 **ANNULATION PAR L'HÔTE (Propriétaire)**

#### **Réservation en statut `pending`**
- ✅ **Pénalité** : 0 FCFA
- ✅ **Remboursement voyageur** : 100% (le paiement n'a pas encore été effectué)

#### **Réservation confirmée (avant le début)**

**Règles de pénalité pour l'hôte** :
- **> 28 jours avant l'arrivée** : 
  - ✅ **Pénalité hôte** : 0% (annulation gratuite)
  - ✅ **Remboursement voyageur** : 100% du montant total
  - 📝 **Exception** : Réservations > 30 jours → annulation gratuite si > 28 jours avant

- **Entre 28 jours et 48h avant l'arrivée** :
  - ⚠️ **Pénalité hôte** : 20% du montant de base (prix par nuit × nombre de nuits)
  - ✅ **Remboursement voyageur** : 100% du montant total

- **≤ 48h avant l'arrivée** :
  - ⚠️ **Pénalité hôte** : 40% du montant de base (prix par nuit × nombre de nuits)
  - ✅ **Remboursement voyageur** : 100% du montant total

**Important** : Quand l'hôte annule, le voyageur est **toujours remboursé à 100%**, mais l'hôte doit payer une pénalité selon le délai.

#### **Réservation en cours (`in_progress`)**
- ⚠️ **Pénalité hôte** : 50% sur les jours restants
- ✅ **Remboursement voyageur** : 100% des nuitées restantes

---

## 🚗 RÉSERVATIONS DE VÉHICULES

### 👤 **ANNULATION PAR LE LOCATAIRE**

#### **Réservation en statut `pending`**
- ✅ **Pénalité** : 0 FCFA
- ✅ **Remboursement** : 0 FCFA (le paiement n'a pas encore été effectué)

#### **Réservation confirmée (avant le début)**

**Règles de pénalité** :
- **> 7 jours avant le départ** :
  - ✅ **Pénalité** : 0% (annulation gratuite)
  - ✅ **Remboursement** : 100% du montant total

- **Entre 3 et 7 jours avant le départ** :
  - ⚠️ **Pénalité** : 15% du montant de base (prix jours + heures)
  - ✅ **Remboursement** : 85% du montant total

- **Entre 24h et 3 jours avant le départ** :
  - ⚠️ **Pénalité** : 30% du montant de base
  - ✅ **Remboursement** : 70% du montant total

- **≤ 24h avant le départ** :
  - ⚠️ **Pénalité** : 50% du montant de base
  - ✅ **Remboursement** : 50% du montant total

#### **Réservation en cours (`in_progress`)**
- ⚠️ **Pénalité** : 50% sur les jours restants
- ✅ **Remboursement** : 50% des jours restants

**Exemple** :
- Réservation de 5 jours à 100 000 FCFA/jour = 500 000 FCFA
- Annulation après 2 jours utilisés
- Jours restants : 3 jours = 300 000 FCFA
- Pénalité : 50% de 300 000 = 150 000 FCFA
- Remboursement : 150 000 FCFA

---

### 🚗 **ANNULATION PAR LE PROPRIÉTAIRE**

#### **Réservation en statut `pending`**
- ✅ **Pénalité** : 0 FCFA
- ✅ **Remboursement locataire** : 100% (le paiement n'a pas encore été effectué)

#### **Réservation confirmée (avant le début)**

**Règles de pénalité pour le propriétaire** :
- **> 28 jours avant le départ** :
  - ✅ **Pénalité propriétaire** : 0% (annulation gratuite)
  - ✅ **Remboursement locataire** : 100% du montant total

- **Entre 7 et 28 jours avant le départ** :
  - ⚠️ **Pénalité propriétaire** : 20% du montant de base
  - ✅ **Remboursement locataire** : 100% du montant total

- **Entre 48h et 7 jours avant le départ** :
  - ⚠️ **Pénalité propriétaire** : 40% du montant de base
  - ✅ **Remboursement locataire** : 100% du montant total

- **≤ 48h avant le départ** :
  - ⚠️ **Pénalité propriétaire** : 50% du montant de base
  - ✅ **Remboursement locataire** : 100% du montant total

**Important** : Quand le propriétaire annule, le locataire est **toujours remboursé à 100%**, mais le propriétaire doit payer une pénalité selon le délai.

#### **Réservation en cours (`in_progress`)**
- ⚠️ **Pénalité propriétaire** : 50% sur les jours restants
- ✅ **Remboursement locataire** : 100% des jours restants

---

## 📊 TABLEAU RÉCAPITULATIF

### **Propriétés - Annulation par le voyageur**

| Délai avant arrivée | Politique Flexible | Politique Moderate | Politique Strict | Non Refundable |
|---------------------|-------------------|-------------------|------------------|----------------|
| ≥ 7 jours | 100% remboursé | 100% remboursé | 100% remboursé | ❌ Impossible |
| ≥ 5 jours | 100% remboursé | 100% remboursé | 100% remboursé | ❌ Impossible |
| ≥ 1 jour | 100% remboursé | 50% remboursé | 50% remboursé | ❌ Impossible |
| < 1 jour | 50% remboursé | 50% remboursé | 50% remboursé | ❌ Impossible |
| En cours | 50% nuits restantes | 50% nuits restantes | 50% nuits restantes | ❌ Impossible |

### **Propriétés - Annulation par l'hôte**

| Délai avant arrivée | Pénalité hôte | Remboursement voyageur |
|---------------------|---------------|------------------------|
| > 28 jours | 0% | 100% |
| 28 jours - 48h | 20% | 100% |
| ≤ 48h | 40% | 100% |
| En cours | 50% jours restants | 100% jours restants |

### **Véhicules - Annulation par le locataire**

| Délai avant départ | Pénalité | Remboursement |
|---------------------|----------|---------------|
| > 7 jours | 0% | 100% |
| 3-7 jours | 15% | 85% |
| 24h-3 jours | 30% | 70% |
| ≤ 24h | 50% | 50% |
| En cours | 50% jours restants | 50% jours restants |

### **Véhicules - Annulation par le propriétaire**

| Délai avant départ | Pénalité propriétaire | Remboursement locataire |
|---------------------|----------------------|-------------------------|
| > 28 jours | 0% | 100% |
| 7-28 jours | 20% | 100% |
| 48h-7 jours | 40% | 100% |
| ≤ 48h | 50% | 100% |
| En cours | 50% jours restants | 100% jours restants |

---

## 💰 CALCUL DES MONTANTS

### **Propriétés**

**Montant de base** = `prix_par_nuit × nombre_de_nuits`

**Pénalité** = `montant_de_base × pourcentage_pénalité`

**Remboursement** = `montant_total_payé - pénalité` (ou 100% si hôte annule)

### **Véhicules**

**Montant de base** = `(prix_par_jour × nombre_jours) + (prix_par_heure × nombre_heures)`

**Pénalité** = `montant_de_base × pourcentage_pénalité`

**Remboursement** = `montant_total_payé - pénalité` (ou 100% si propriétaire annule)

---

## 📝 NOTES IMPORTANTES

1. **Réservations `pending`** : Aucune pénalité car le paiement n'a pas encore été effectué
2. **Annulation par hôte/propriétaire** : Le voyageur/locataire est toujours remboursé à 100%, mais l'hôte/propriétaire doit payer une pénalité
3. **Réservations en cours** : Le remboursement se base sur les jours/nuits restants, pas sur le montant total
4. **Politique `non_refundable`** : L'annulation est impossible pour les propriétés avec cette politique
5. **Frais de service** : Les frais de service (10% + TVA) ne sont généralement pas remboursés, sauf si l'annulation est gratuite

---

## 🔍 FICHIERS DE RÉFÉRENCE

- **Propriétés - Locataire** : `useBookingCancellation.ts` (ligne 19-119)
- **Propriétés - Hôte** : `useHostBookings.ts` (ligne 528-586), `HostCancellationDialog.tsx` (ligne 60-85)
- **Véhicules - Locataire** : `VehicleCancellationModal.tsx` (ligne 63-200)
- **Véhicules - Propriétaire** : `VehicleCancellationModal.tsx` (ligne 139-168)
- **Affichage politique** : `InvoiceDisplay.tsx` (ligne 149-168)

