# 🐛 BUG IDENTIFIÉ : Différences entre Détails Mobile et PDF Email

## 📋 RÉSUMÉ DU BUG

Les montants affichés dans le **PDF email** sont différents de ceux affichés dans les **détails mobile** pour la même réservation :
- **Réduction** : -18 983 FCFA (PDF) vs -1 500 FCFA (Mobile) ❌
- **Taxe de séjour** : 25 000 FCFA (PDF) vs 5 000 FCFA (Mobile) ❌
- **Total payé** : 89 084 FCFA (identique dans les deux) ✅

---

## 🔍 ANALYSE DU CODE

### Bug #1 : Taxe de séjour incorrecte

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`  
**Ligne** : 5104

```typescript
const taxesPerNight = bookingData.property?.taxes || bookingData.taxes || 0;
```

**PROBLÈME** :
- Le PDF utilise `bookingData.taxes` comme fallback
- `bookingData.taxes` pourrait contenir le **montant total** (déjà multiplié par le nombre de nuits) au lieu de la **taxe par nuit**
- Ensuite, le calcul `taxesPerNight * nights` multiplie à nouveau, ce qui donne un montant incorrect

**Exemple** :
- Si `bookingData.taxes = 25 000` (total pour 5 nuits) au lieu de `5 000` (par nuit)
- Le calcul devient : `25 000 * 5 = 125 000` ❌
- Mais dans le PDF on voit 25 000, donc il semble que `bookingData.taxes` contient déjà le total

**SOLUTION** :
- Ne jamais utiliser `bookingData.taxes` comme fallback
- Toujours utiliser `bookingData.property?.taxes` qui est la taxe par nuit depuis la table `properties`
- Si `bookingData.taxes` est fourni, vérifier s'il est déjà multiplié par le nombre de nuits

---

### Bug #2 : Réduction incorrecte

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`  
**Ligne** : 5098-5100

```typescript
const discountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
  ? bookingData.discount_amount
  : (bookingData.discountAmount || 0);
```

**PROBLÈME** :
- Le PDF utilise directement `bookingData.discount_amount` stocké en base
- Cette valeur pourrait être **incorrecte** ou **obsolète**
- Le mobile recalcule toujours la réduction pour garantir la cohérence

**Exemple** :
- Mobile : Recalcule la réduction → -1 500 FCFA ✅
- PDF : Utilise `discount_amount` stocké → -18 983 FCFA ❌

**SOLUTION** :
- Comme dans le mobile, **toujours recalculer** la réduction au lieu d'utiliser la valeur stockée
- Utiliser la fonction `calculateTotalPrice()` pour recalculer la réduction
- Utiliser la valeur stockée uniquement comme fallback si le recalcul échoue

---

## 🔧 CORRECTIONS À APPORTER

### Correction #1 : Taxe de séjour

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`  
**Ligne** : 5104

**AVANT** :
```typescript
const taxesPerNight = bookingData.property?.taxes || bookingData.taxes || 0;
```

**APRÈS** :
```typescript
// Ne jamais utiliser bookingData.taxes comme fallback car il pourrait être le total
// Toujours utiliser bookingData.property?.taxes qui est la taxe par nuit
const taxesPerNight = bookingData.property?.taxes || 0;

// Si bookingData.taxes est fourni et que property.taxes n'est pas disponible,
// vérifier s'il est déjà multiplié par le nombre de nuits
if (!taxesPerNight && bookingData.taxes && nights > 0) {
  // Si bookingData.taxes semble être le total (trop élevé), diviser par nights
  const potentialTaxPerNight = bookingData.taxes / nights;
  // Vérifier si c'est raisonnable (entre 0 et 10 000 FCFA par nuit)
  if (potentialTaxPerNight >= 0 && potentialTaxPerNight <= 10000) {
    taxesPerNight = potentialTaxPerNight;
  }
}
```

**OU SIMPLEMENT** :
```typescript
// Ne jamais utiliser bookingData.taxes comme fallback
const taxesPerNight = bookingData.property?.taxes || 0;
```

---

### Correction #2 : Réduction

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`  
**Ligne** : 5098-5100

**AVANT** :
```typescript
const discountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
  ? bookingData.discount_amount
  : (bookingData.discountAmount || 0);
```

**APRÈS** :
```typescript
// Toujours recalculer la réduction pour garantir la cohérence (comme dans le mobile)
let discountAmount = 0;

// Si les données de réduction sont disponibles, recalculer
if (bookingData.property) {
  const discountConfig = {
    enabled: bookingData.property.discount_enabled || false,
    minNights: bookingData.property.discount_min_nights || null,
    percentage: bookingData.property.discount_percentage || null
  };
  
  const longStayDiscountConfig = bookingData.property.long_stay_discount_enabled ? {
    enabled: bookingData.property.long_stay_discount_enabled || false,
    minNights: bookingData.property.long_stay_discount_min_nights || null,
    percentage: bookingData.property.long_stay_discount_percentage || null
  } : undefined;
  
  try {
    // Utiliser la fonction de calcul de prix (à importer ou recréer)
    const basePrice = pricePerNight * nights;
    // Calculer la réduction selon les règles
    // ... (logique de calcul de réduction)
    
    // Pour l'instant, utiliser la valeur stockée comme fallback
    discountAmount = bookingData.discount_amount || bookingData.discountAmount || 0;
  } catch (error) {
    console.error('Erreur calcul réduction PDF:', error);
    discountAmount = bookingData.discount_amount || bookingData.discountAmount || 0;
  }
} else {
  // Fallback : utiliser la valeur stockée
  discountAmount = bookingData.discount_amount || bookingData.discountAmount || 0;
}
```

**OU PLUS SIMPLE** (en utilisant la fonction centralisée) :
```typescript
// Utiliser la valeur stockée en priorité, mais vérifier sa cohérence
const storedDiscountAmount = bookingData.discount_amount !== undefined && bookingData.discount_amount !== null
  ? bookingData.discount_amount
  : (bookingData.discountAmount || 0);

// Pour l'instant, utiliser la valeur stockée
// TODO: Recalculer la réduction pour garantir la cohérence
const discountAmount = storedDiscountAmount;
```

---

## 📊 VÉRIFICATION DES DONNÉES ENVOYÉES

### Depuis InvoiceDisplay.tsx (ligne 661)

```typescript
taxes: taxesPerNight, // Utiliser taxesPerNight (par nuit), pas effectiveTaxes
```

✅ **Correct** : Le mobile envoie bien `taxesPerNight` (taxe par nuit)

### Depuis InvoiceDisplay.tsx (ligne 648-650)

```typescript
discountApplied: actualDiscountAmount > 0,
discountAmount: actualDiscountAmount,
discount_amount: actualDiscountAmount, // Utiliser snake_case
```

✅ **Correct** : Le mobile envoie bien `actualDiscountAmount` (valeur recalculée)

---

## 🎯 CAUSE RACINE

Le problème vient probablement de **données incorrectes stockées en base de données** :

1. **Réduction** : La valeur `discount_amount` stockée dans la table `bookings` est incorrecte (18 983 au lieu de 1 500)
2. **Taxe de séjour** : La valeur `taxes` dans `bookingData.taxes` pourrait être le total au lieu de la taxe par nuit

**Vérification SQL nécessaire** :
```sql
-- Vérifier la réservation
SELECT 
  id,
  discount_amount,
  total_price,
  check_in_date,
  check_out_date
FROM bookings
WHERE id LIKE '%91e15a1f%';

-- Vérifier la propriété
SELECT 
  id,
  title,
  taxes,
  price_per_night
FROM properties
WHERE title LIKE '%H.Asso%';
```

---

## ✅ SOLUTION RECOMMANDÉE

### Solution immédiate (Quick Fix)

1. **Taxe de séjour** : Ne jamais utiliser `bookingData.taxes` comme fallback
   ```typescript
   const taxesPerNight = bookingData.property?.taxes || 0;
   ```

2. **Réduction** : Utiliser la valeur stockée mais ajouter un log pour vérifier
   ```typescript
   const discountAmount = bookingData.discount_amount || bookingData.discountAmount || 0;
   console.log('🔍 [PDF] discount_amount utilisé:', discountAmount);
   ```

### Solution à long terme

1. **Recalculer la réduction** dans le PDF (comme dans le mobile)
2. **Créer une fonction centralisée** pour tous les calculs
3. **Ajouter des validations** pour vérifier la cohérence des données
4. **Corriger les données incorrectes** en base de données

---

## 📝 FICHIERS À MODIFIER

1. **`cote-d-ivoire-stays/supabase/functions/send-email/index.ts`**
   - Ligne 5104 : Corriger le calcul de `taxesPerNight`
   - Ligne 5098-5100 : Améliorer le calcul de `discountAmount` (recalculer si possible)

2. **Vérifier les données en base de données**
   - Table `bookings` : Vérifier `discount_amount`
   - Table `properties` : Vérifier `taxes`

---

## 🚨 IMPACT

- **Confiance utilisateur** : Les différences créent de la confusion
- **Conformité légale** : Les factures doivent être cohérentes
- **Support client** : Plus de questions sur les différences de montants

---

## ✅ VALIDATION

Après correction, vérifier que :
1. ✅ La taxe de séjour est identique dans les deux (5 000 FCFA)
2. ✅ La réduction est identique dans les deux (-1 500 FCFA)
3. ✅ Le total payé reste identique (89 084 FCFA)


