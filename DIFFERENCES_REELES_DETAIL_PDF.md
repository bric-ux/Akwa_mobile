# Différences réelles observées : Détails Mobile vs PDF Email
## 📱 Comparaison visuelle des écrans

## 🔍 ANALYSE DES DEUX ÉCRANS

### Données communes
- **Propriété** : Résidence H.Asso
- **Arrivée** : 01/03/2026 (1 mars 2026)
- **Départ** : 06/03/2026 (6 mars 2026)
- **Durée** : 5 nuits
- **Voyageurs** : 1
- **Prix initial (5 nuits)** : 75 000 FCFA (5 × 15 000 FCFA/nuit)
- **Total payé** : 89 084 FCFA ✅ (identique dans les deux)

---

## ⚠️ DIFFÉRENCES CRITIQUES IDENTIFIÉES

### 1. Réduction appliquée ❌

| Source | Montant |
|--------|---------|
| **Détails Mobile** | **-1 500 FCFA** |
| **PDF Email** | **-18 983 FCFA** |
| **Différence** | **17 483 FCFA** |

**Impact** : La réduction dans le PDF est **12,6 fois plus élevée** que dans les détails mobile !

---

### 2. Prix après réduction ❌

| Source | Montant |
|--------|---------|
| **Détails Mobile** | **73 500 FCFA** (75 000 - 1 500) |
| **PDF Email** | **56 017 FCFA** (75 000 - 18 983) |
| **Différence** | **17 483 FCFA** |

**Impact** : Le prix après réduction est beaucoup plus bas dans le PDF.

---

### 3. Taxe de séjour ❌

| Source | Montant |
|--------|---------|
| **Détails Mobile** | **5 000 FCFA** |
| **PDF Email** | **25 000 FCFA** |
| **Différence** | **20 000 FCFA** (5x plus) |

**Impact** : La taxe de séjour dans le PDF est **5 fois plus élevée** !

**Calcul attendu** : Si la taxe est de 5 000 FCFA pour 5 nuits, cela fait **1 000 FCFA par nuit**.

**Dans le PDF** : 25 000 FCFA pour 5 nuits = **5 000 FCFA par nuit** (5x plus que prévu)

---

### 4. Frais de service Akwahome ❌

| Source | Montant TTC | HT | TVA (20%) |
|--------|-------------|----|-----------| 
| **Détails Mobile** | **10 584 FCFA** | 8 820 FCFA | 1 764 FCFA |
| **PDF Email** | **8 066 FCFA** | 6 722 FCFA | 1 344 FCFA |
| **Différence** | **2 518 FCFA** | 2 098 FCFA | 420 FCFA |

**Impact** : Les frais de service sont différents car ils sont calculés sur le prix après réduction.

**Vérification** :
- **Mobile** : 73 500 × 12% = 8 820 HT → +20% TVA = 10 584 TTC ✅
- **PDF** : 56 017 × 12% = 6 722 HT → +20% TVA = 8 066 TTC ✅

**Conclusion** : Les frais de service sont correctement calculés dans chaque cas, mais basés sur des prix après réduction différents.

---

## 📊 RÉCAPITULATIF DES CALCULS

### Détails Mobile
```
Prix initial:           75 000 FCFA
Réduction:              -1 500 FCFA
Prix après réduction:   73 500 FCFA
Taxe de séjour:         +5 000 FCFA
Frais de service:       +10 584 FCFA
─────────────────────────────────
TOTAL PAYÉ:             89 084 FCFA ✅
```

### PDF Email
```
Prix initial:           75 000 FCFA
Réduction:              -18 983 FCFA
Prix après réduction:   56 017 FCFA
Taxe de séjour:         +25 000 FCFA
Frais de service:       +8 066 FCFA
─────────────────────────────────
TOTAL PAYÉ:             89 084 FCFA ✅
```

**Observation** : Les totaux sont identiques (89 084 FCFA), mais les montants intermédiaires sont très différents. Cela suggère que :
- Soit les données stockées en base sont incorrectes
- Soit il y a une incohérence dans la façon dont les données sont récupérées/calculées

---

## 🔍 CAUSES PROBABLES

### 1. Réduction (discount_amount) incorrecte dans le PDF

**Hypothèse** : Le PDF utilise une valeur de `discount_amount` stockée en base qui est incorrecte (18 983 au lieu de 1 500).

**Vérification nécessaire** :
- Vérifier la valeur de `discount_amount` stockée dans la table `bookings` pour cette réservation
- Vérifier si le PDF utilise bien la valeur stockée ou s'il recalcule

### 2. Taxe de séjour incorrecte dans le PDF

**Hypothèse** : Le PDF multiplie la taxe par nuit par le nombre de nuits, mais utilise une valeur de taxe incorrecte.

**Calcul attendu** :
- Mobile : 5 000 FCFA pour 5 nuits = **1 000 FCFA/nuit**
- PDF : 25 000 FCFA pour 5 nuits = **5 000 FCFA/nuit**

**Vérification nécessaire** :
- Vérifier la valeur de `taxes` stockée dans la table `properties` pour cette propriété
- Vérifier si le PDF utilise bien `taxes * nights` ou une autre formule

---

## 🎯 ACTIONS À PRENDRE

### 1. Vérifier les données en base de données
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
  price_per_night,
  taxes,
  cleaning_fee
FROM properties
WHERE title LIKE '%H.Asso%';
```

### 2. Vérifier le code de génération du PDF
- **Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`
- **Fonction** : `generateInvoicePDFForEmail()`
- **Lignes à vérifier** :
  - Ligne 5098-5100 : Calcul de `discountAmount`
  - Ligne 5104 : Calcul de `taxesPerNight`
  - Ligne 5125 : Calcul de `effectiveTaxes`

### 3. Vérifier le code de l'onglet détail
- **Fichier** : `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`
- **Lignes à vérifier** :
  - Ligne 420-498 : Calcul de `discountAmount`
  - Ligne 505-509 : Calcul de `effectiveTaxes`

---

## 📝 RECOMMANDATIONS

### 1. Harmoniser le calcul de la réduction
- **Problème** : Le PDF utilise une valeur de réduction incorrecte (18 983 au lieu de 1 500)
- **Solution** : S'assurer que le PDF utilise la même logique que l'onglet détail pour calculer/obtenir la réduction

### 2. Harmoniser le calcul de la taxe de séjour
- **Problème** : Le PDF affiche 25 000 FCFA au lieu de 5 000 FCFA
- **Solution** : Vérifier que le PDF utilise bien `taxesPerNight * nights` avec la bonne valeur de `taxesPerNight`

### 3. Ajouter des logs de débogage
- Ajouter des `console.log` dans le PDF pour voir quelles valeurs sont utilisées
- Comparer avec les valeurs dans l'onglet détail

### 4. Créer une fonction centralisée
- Extraire tous les calculs dans une fonction partagée
- Utiliser cette fonction dans les deux endroits (PDF et mobile)

---

## ✅ POINTS POSITIFS

1. ✅ Le **total payé** est identique dans les deux (89 084 FCFA)
2. ✅ Le **prix initial** est identique (75 000 FCFA)
3. ✅ Les **frais de service** sont correctement calculés (basés sur le prix après réduction)
4. ✅ Les **détails TVA** sont affichés correctement dans les deux

---

## 🚨 PROBLÈMES CRITIQUES

1. ❌ **Réduction** : Différence de 17 483 FCFA (12,6x plus dans le PDF)
2. ❌ **Taxe de séjour** : Différence de 20 000 FCFA (5x plus dans le PDF)
3. ⚠️ **Confiance utilisateur** : Ces différences peuvent créer de la confusion et de la méfiance

---

## 📋 PROCHAINES ÉTAPES

1. **Immédiat** : Vérifier les données en base de données pour cette réservation
2. **Court terme** : Corriger le calcul de la réduction dans le PDF
3. **Court terme** : Corriger le calcul de la taxe de séjour dans le PDF
4. **Moyen terme** : Créer une fonction centralisée pour tous les calculs
5. **Long terme** : Ajouter des tests unitaires pour vérifier la cohérence des calculs



