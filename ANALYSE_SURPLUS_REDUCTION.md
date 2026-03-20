# Analyse : Surplus demandé lors de la réduction de séjour

## Contexte
Lorsqu'on réduit une réservation (ex: 8 jours → 7 jours), le système demande parfois un surplus à payer. C'est **illogique** : réduire = moins de nuits = prix moins élevé ou égal.

---

## Causes identifiées

### 1. **Propriété (logement) – `BookingModificationModal`**

#### A. Perte de réduction (discount)
- **Exemple** : `discount_min_nights = 8` (15% si ≥ 8 nuits)
- Original 8 nuits : 8 × 10 000 × 0,85 = **68 000 FCFA**
- Nouveau 7 nuits : 7 × 10 000 = **70 000 FCFA** (plus de réduction)
- **Résultat** : Le total augmente malgré moins de nuits.

#### B. Perte du ménage gratuit (`free_cleaning_min_days`)
- **Exemple** : `free_cleaning_min_days = 8`, `cleaning_fee = 15 000`
- Original 8 nuits : ménage gratuit
- Nouveau 7 nuits : ménage payant (+15 000)
- Si l’économie sur 1 nuit (ex: 10 000) < 15 000 → **total augmente**.

#### C. Tarification dynamique
- Si les 7 nouvelles nuits ont un prix moyen plus élevé (ex: week-ends) que les 8 nuits d’origine, le total peut augmenter.

---

### 2. **Véhicule – `VehicleModificationModal`**

Le calcul actuel :
- `additionalDaysPrice = daysDiff > 0 ? daysDiff * dailyRate : 0`
- `additionalHoursPrice = hoursDiff > 0 ? hoursDiff * hourlyRate : 0`

**En cas de réduction** (`daysDiff < 0`, `hoursDiff < 0`), on obtient `additionalPrice = 0`, donc le nouveau total est gardé égal à l’ancien. Le surplus devrait être 0.

**Problème possible** : l’ancien total (`currentTotalPrice`) est recalculé à partir des valeurs courantes, pas de `booking.total_price`. Un écart (chauffeur, arrondis) peut donner un surplus artificiel.

---

## Règle métier à respecter

**Quand l’utilisateur réduit son séjour, il ne doit jamais avoir à payer de surplus.**

Même si le calcul brut donne un surplus (perte de réduction, ménage payant, etc.), on ne doit pas demander de paiement supplémentaire.

---

## Corrections appliquées

1. **BookingModificationModal** : Si `finalNights < originalNights` et `rawPriceDifference > 0`, on force `finalPriceDifference = 0` (pas de surplus).
2. **VehicleModificationModal** : Si `daysDiff < 0` ou `hoursDiff < 0`, on force le surplus à 0.
