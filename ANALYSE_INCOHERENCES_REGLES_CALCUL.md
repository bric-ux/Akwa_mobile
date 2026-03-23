# 🔍 Analyse approfondie – Incohérences dans les règles de calcul

**Projet :** AkwaHomeMobile  
**Date :** 23 mars 2026

---

## 📋 Résumé exécutif

Plusieurs incohérences ont été identifiées entre les différentes implémentations des règles d'annulation et de modification. Certaines sont **critiques** (montants différents selon le flux), d'autres sont **conceptuelles** (texte vs code, base de calcul divergente).

---

## 🔴 INCOHÉRENCES CRITIQUES

### 1. Double logique d'annulation voyageur (résidence) – Prorata des taxes

**Fichiers concernés :**
- `src/hooks/useBookingCancellation.ts` (utilisé par CancellationDialog)
- `src/hooks/useBookings.ts` (fonction `cancelBooking` lignes 917–1160)

**Problème :** Deux implémentations différentes pour l'annulation par le voyageur.

| Cas | useBookingCancellation | useBookings |
|-----|------------------------|-------------|
| Flexible en cours / &lt; 24h | `refund = 0.8 × remainingNightsAmount` (sans taxes) | `refund = 0.8 × remainingNightsAmount + taxesProRata` |
| Moderate en cours / &lt; 5j | `refund = 0.5 × remainingNightsAmount` (sans taxes) | `refund = 0.5 × remainingNightsAmount + taxesProRata` |
| Strict &lt; 7j (avant) | `refund = 0` | `refund = taxesProRata` |

**Impact :**  
- `CancellationDialog` utilise `useBookingCancellation` → aucun prorata de taxes.  
- `useBookings.cancelBooking` n’est pas utilisé dans le flux actuel des écrans, mais reste présent avec une logique divergente.  
- En cas de future utilisation de `useBookings.cancelBooking`, les montants de remboursement différeraient.

**Recommandation :** Aligner les deux logiques. Choisir une règle unique (avec ou sans prorata de taxes) et la centraliser dans une seule fonction de calcul.

---

### 2. Texte politique « strict » vs implémentation

**Fichier :** `src/utils/cancellationPolicy.ts` (ligne 23)

```typescript
case 'strict':
  return "Annulation gratuite jusqu'à 7 jours avant l'arrivée. Après, 50% de pénalité.";
```

**Implémentation réelle :** `useBookingCancellation.ts` (lignes 84, 151–163)

- ≥ 28 jours avant : 100 % remboursé
- 7–28 jours avant : 50 % remboursé
- &lt; 7 jours avant : 0 % remboursé

**Impact :**  
Le texte indique « 7 jours » alors que la gratuité s’applique jusqu’à **28 jours**. Risque de litige et de mauvaise compréhension côté utilisateur.

**Recommandation :**  
Adapter le texte à la logique réelle, par exemple :  
*« Annulation gratuite jusqu’à 28 jours avant l’arrivée. Entre 7 et 28 jours : 50 % remboursé. Moins de 7 jours : aucun remboursement. »*

---

### 3. Base de calcul du remboursement : `price_per_night` vs montant réel payé

**Fichiers :**
- `src/components/CancellationDialog.tsx` (ligne 69)
- `src/hooks/useBookingCancellation.ts` (lignes 56–57, 132–133)

**Problème :**  
Le remboursement est calculé avec `pricePerNight = property.price_per_night` et `baseAmount = totalNights × pricePerNight`, alors que le voyageur a souvent payé un prix différent (réductions, tarification dynamique).

**Exemple :**
- `price_per_night` = 10 000 FCFA
- 8 nuits avec 15 % de réduction → montant réel ≈ 68 000 FCFA + frais
- Annulation flexible &lt; 24h : `refund = 0.8 × (8 × 10 000) = 64 000 FCFA`  
  → Le remboursement est calculé sur un montant non actualisé.

**Impact :**  
- Possible sur-remboursement si le prix effectif était plus bas.  
- Possible sous-remboursement si tarification dynamique plus élevée.

**Recommandation :**  
Utiliser un prix effectif par nuit dérivé du total payé (ex. via `inferOriginalSubtotal` comme dans `BookingModificationModal`), et non le seul `price_per_night`.

---

### 4. `refundPercentage` incohérent avec les montants (séjour en cours)

**Fichier :** `src/hooks/useBookingCancellation.ts` (ligne 67)

```typescript
refundPercentage = remainingNights > 0 ? 50 : 0; // utilisé pour affichage uniquement si calcul manuel
```

**Problème :**  
- En cours, politique flexible : remboursement réel = 80 % des nuitées restantes.  
- `refundPercentage` affiché = 50.  
- En cours, politique moderate : remboursement réel = 50 % (cohérent).  
- En cours, politique strict : remboursement réel = 0 % (cohérent).

**Impact :**  
Pour une politique flexible en cours, l’affichage peut montrer 50 % alors que le calcul applique 80 %.

**Recommandation :**  
Calculer `refundPercentage` en fonction de la politique (flexible = 80, moderate = 50, strict = 0) au lieu d’un 50 fixe.

---

## 🟠 INCOHÉRENCES IMPORTANTES

### 5. Remboursement en réduction de séjour : extrapolation d’une annulation totale

**Fichier :** `src/components/BookingModificationModal.tsx` (lignes 321–350)

**Logique actuelle :**
```typescript
refundRate = info.refundAmount / originalTotal;  // taux d'une annulation TOTALE
reductionRefundAmount = refundRate × amountSaved;
```

**Problème :**  
La politique stricte applique des seuils sur la réservation totale (ex. 50 % du total entre 7 et 28 jours), pas au prorata des nuits. En cas de réduction de 1 nuit sur 10, appliquer le même taux à `amountSaved` est une approximation qui ne correspond pas exactement à la règle d’annulation totale.

**Recommandation :**  
Documenter clairement cette approximation ou définir des règles spécifiques pour la réduction partielle (ex. proportionnalité stricte par nuit).

---

### 6. Fallback `booking.status || 'pending'` dans CancellationDialog

**Fichier :** `src/components/CancellationDialog.tsx` (ligne 121)

```typescript
booking.status || 'pending'
```

**Problème :**  
Si `status` est `undefined` ou vide, on considère la réservation comme `pending` → 100 % remboursé. Pour une réservation confirmée avec `status` manquant, le remboursement affiché serait trop favorable.

**Recommandation :**  
Utiliser un fallback plus conservateur, par exemple `status || 'confirmed'`, ou garantir que `status` est toujours défini correctement.

---

### 7. Fallback politique dans `cancellationPolicy.ts`

**Fichier :** `src/utils/cancellationPolicy.ts` (lignes 11–12)

```typescript
const fallbackProperty = "Annulation gratuite jusqu'à 1 jour avant l'arrivée. Remboursement intégral.";
const fallbackVehicle = "Annulation gratuite jusqu'à 24h avant le début. Remboursement intégral.";
```

**Problème :**  
Le fallback propriété parle de « 1 jour » alors que la politique flexible utilise **24 h**. Incohérence avec les politiques réelles.

**Recommandation :**  
Harmoniser les fallbacks avec la politique flexible (24 h).

---

### 8. Véhicule – Base pour le remboursement : chauffeur inclus ou non

**Constat :**  
Pour les véhicules, `basePrice` dans `VehicleCancellationModal` = `daysPrice + hoursPrice` (sans chauffeur).  
Le `totalPrice` peut inclure les frais de chauffeur.  
La cohérence dépend de la façon dont `calculateCancellationInfoForVehicle` utilise ces montants.

**Recommandation :**  
Vérifier que la base de calcul du remboursement (jours/heures) correspond bien à ce qui a été facturé (avec ou sans chauffeur) et documenter la convention.

---

## 🟡 INCOHÉRENCES MINEURES

### 9. Hôte vs propriétaire – Seuils identiques mais contextes différents

Les seuils (5 jours, 2 jours, 40 %) sont les mêmes pour l’hôte (résidence) et le propriétaire (véhicule).  
C’est cohérent, mais à confirmer si les produits et usages souhaitent des règles différenciées.

---

### 10. `penalty_tracking` – Nommage du type « guest_cancellation »

**Fichier :** `src/hooks/useBookingCancellation.ts` (lignes 291–298)

En cas d’annulation par le voyageur, on insère un enregistrement avec `penalty_type: 'guest_cancellation'` et `penalty_amount: hostReimbursementAmount`.  
Le montant correspond en réalité au **reversement dû par l’hôte**, pas à une pénalité du voyageur.

**Recommandation :**  
Clarifier le nommage (ex. `host_reimbursement_due`) ou la documentation pour éviter les malentendus.

---

## 📊 Synthèse par priorité

| Priorité | Incohérence | Fichiers | Action suggérée |
|----------|-------------|----------|------------------|
| 🔴 Critique | Prorata taxes (double logique) | useBookingCancellation, useBookings | Unifier la logique d’annulation |
| 🔴 Critique | Texte strict (7j vs 28j) | cancellationPolicy.ts | Corriger le texte |
| 🔴 Critique | Base price_per_night vs montant réel | CancellationDialog, useBookingCancellation | Utiliser un prix effectif |
| 🔴 Critique | refundPercentage 50 vs 80 (flexible) | useBookingCancellation | Calculer selon la politique |
| 🟠 Important | Remboursement réduction | BookingModificationModal | Documenter ou ajuster la règle |
| 🟠 Important | status \|\| 'pending' | CancellationDialog | Remplacer par un fallback plus sûr |
| 🟠 Important | Fallback « 1 jour » | cancellationPolicy.ts | Harmoniser avec 24 h |
| 🟠 Important | Base véhicule (chauffeur) | VehicleCancellationModal | Vérifier et documenter |
| 🟡 Mineur | Nommage penalty_tracking | useBookingCancellation | Clarifier la doc / nommage |

---

## 📁 Fichiers principaux à modifier

1. **`src/hooks/useBookingCancellation.ts`** – Logique centrale d’annulation
2. **`src/hooks/useBookings.ts`** – Alignement avec useBookingCancellation ou suppression de la duplication
3. **`src/utils/cancellationPolicy.ts`** – Textes des politiques
4. **`src/components/CancellationDialog.tsx`** – Prix effectif, fallback de status
5. **`src/components/BookingModificationModal.tsx`** – Remboursement en réduction

---

## ✅ Points déjà cohérents

- Hôte et propriétaire : mêmes seuils (5j, 2j, 40 %)
- Politiques voyageur / locataire : même grille pour résidence et véhicule
- Règle « pas de surplus en réduction » : appliquée dans BookingModificationModal et VehicleModificationModal
- Remboursement locataire quand le propriétaire annule : 100 % (cohérent avec l’hôte)
