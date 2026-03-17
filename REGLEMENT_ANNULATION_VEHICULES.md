# Règles d'annulation pour la location de véhicules

## 📋 Vue d'ensemble

Les règles d'annulation varient selon :
- **Qui annule** : Propriétaire du véhicule ou Locataire
- **Quand** : Nombre de jours/heures avant le début de la location
- **Statut** : Réservation en attente (pending) ou confirmée

---

## 🔴 Règles actuelles dans l'application mobile

### 1. Réservations en attente (status = 'pending')
- **Pénalité** : 0 XOF
- **Remboursement** : 0 XOF (aucun paiement n'a encore été effectué)
- **Raison** : Le paiement n'a pas encore été traité

---

### 2. Annulation par le LOCATAIRE (avant le début)

#### Règle basée sur le nombre de jours avant le début :

| Délai avant le début | Pénalité | Remboursement |
|---------------------|----------|---------------|
| **7 jours ou plus** | 0% (0 XOF) | 100% du montant |
| **Entre 3 et 6 jours** | 10% du montant | 90% du montant |
| **Moins de 3 jours** | 20% du montant | 80% du montant |

**Exemple** :
- Réservation de 50 000 XOF
- Annulation 5 jours avant → Pénalité : 5 000 XOF, Remboursement : 45 000 XOF
- Annulation 2 jours avant → Pénalité : 10 000 XOF, Remboursement : 40 000 XOF

---

### 3. Annulation par le PROPRIÉTAIRE (avant le début)

#### Règle basée sur le nombre de jours avant le début :

| Délai avant le début | Pénalité | Remboursement au locataire |
|---------------------|----------|----------------------------|
| **7 jours ou plus** | 0% (0 XOF) | 100% du montant |
| **Entre 3 et 6 jours** | 10% du montant | 100% du montant |
| **Moins de 3 jours** | 20% du montant | 100% du montant |

**Note importante** : Le locataire est **toujours intégralement remboursé** quand le propriétaire annule. La pénalité est payée par le propriétaire.

**Exemple** :
- Réservation de 50 000 XOF
- Propriétaire annule 5 jours avant → Pénalité propriétaire : 5 000 XOF, Remboursement locataire : 50 000 XOF
- Propriétaire annule 2 jours avant → Pénalité propriétaire : 10 000 XOF, Remboursement locataire : 50 000 XOF

---

## 🌐 Règles sur le site web (plus détaillées)

Le site web utilise des règles **plus précises** basées sur les heures :

### Annulation par le LOCATAIRE (site web)

| Délai avant le début | Pénalité | Remboursement |
|---------------------|----------|---------------|
| **Plus de 7 jours** | 0% | 100% |
| **Entre 7 jours et 48h** | 15% | 85% |
| **Entre 48h et 24h** | 30% | 70% |
| **24h ou moins** | 50% | 50% |

### Annulation par le PROPRIÉTAIRE (site web)

| Délai avant le début | Pénalité | Remboursement au locataire |
|---------------------|----------|----------------------------|
| **Plus de 28 jours** | 0% | 100% |
| **Entre 28 jours et 48h** | 20% | 100% |
| **48h ou moins** | 40% | 100% |

### Annulation en cours de location (site web)

Si la location a déjà commencé :
- **Locataire annule** : Pénalité de 50% sur les jours restants
- **Propriétaire annule** : Pénalité de 40% sur les jours restants + remboursement intégral au locataire

---

## ⚠️ Différences entre mobile et web

| Aspect | Application Mobile | Site Web |
|--------|------------------|----------|
| **Précision** | Basée sur les jours | Basée sur les heures |
| **Seuils locataire** | 7j / 3j | 7j / 48h / 24h |
| **Seuils propriétaire** | 7j / 3j | 28j / 48h |
| **Annulation en cours** | Non gérée | Gérée (50% / 40%) |

---

## 💡 Recommandation

**Synchroniser les règles** entre l'application mobile et le site web pour une expérience cohérente. Le site web a des règles plus détaillées et précises.

---

## 📝 Calcul de la pénalité dans l'application mobile

L'app utilise la **politique d'annulation du véhicule** (`cancellation_policy` : flexible, moderate, strict, non_refundable), comme pour les résidences meublées.

### Annulation par le LOCATAIRE (véhicule)

- **Source** : `useBookingCancellation.calculateCancellationInfoForVehicle` → appelle `calculateCancellationInfo` avec la politique du véhicule.
- **Réservation en attente** : annulation gratuite, remboursement 100%.
- **Avant le début** (selon la politique du véhicule) :
  - **flexible** : gratuit si ≥ 24h avant ; sinon remboursement 80% du montant des jours + taxes au prorata.
  - **moderate** : gratuit si ≥ 5 jours avant ; sinon 50% du montant des jours + taxes au prorata.
  - **strict** : 100% si ≥ 28 jours ; 50% du total si 7–28 jours ; sinon taxes au prorata uniquement.
  - **non_refundable** : pas d'annulation possible (ou 0% remboursé).
- **En cours de location** : remboursement selon la politique (80% / 50% / taxes seules) sur les **jours restants** ; le reste = pénalité.

### Annulation par le PROPRIÉTAIRE (véhicule)

- **Source** : `useBookingCancellation.calculateVehicleOwnerCancellationPenalty`.
- **Réservation en attente** : pénalité 0, remboursement 100%.
- **Plus de 5 jours avant le début** : pénalité 0%, locataire remboursé 100%.
- **Entre 5 et 2 jours avant** : pénalité = 20% du montant de base (jours + heures), locataire remboursé 100%.
- **2 jours ou moins avant** : pénalité = 40% du montant de base, locataire remboursé 100%.
- **En cours de location** : pénalité = 40% du montant des **jours restants** ; locataire remboursé du restant des jours non consommés (au prorata du total payé).

La politique du véhicule est stockée sur la fiche véhicule (`vehicles.cancellation_policy`) et affichée dans le détail de la réservation (écran détail + facture).

---

## 📧 Notifications

Lors d'une annulation, des emails sont envoyés à :
- L'autre partie (locataire ou propriétaire)
- La partie qui annule (confirmation)
- L'administrateur (notification)

---

## 🔄 Statut après annulation

- Le statut de la réservation passe à `'cancelled'`
- Les champs suivants sont remplis :
  - `cancelled_at` : Date d'annulation
  - `cancelled_by` : ID de l'utilisateur qui a annulé
  - `cancellation_reason` : Raison de l'annulation
  - `cancellation_penalty` : Montant de la pénalité

















