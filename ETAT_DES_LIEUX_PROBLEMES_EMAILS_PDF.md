# 🔍 ÉTAT DES LIEUX - PROBLÈMES EMAILS ET PDFS

## 📊 DONNÉES DE TEST
- Prix par jour : 100 000 FCFA
- Prix par heure : 10 000 FCFA/h
- Durée : 5 jours et 2 heures
- Réduction : 10% (52 000 FCFA)
- Surplus chauffeur : 25 000 FCFA
- Caution : 100 000 FCFA

## ✅ CALCULS CORRECTS ATTENDUS

### Pour le locataire :
- Prix jours : 5 × 100 000 = 500 000 FCFA
- Prix heures : 2 × 10 000 = 20 000 FCFA
- Total avant réduction : 520 000 FCFA
- Réduction 10% : -52 000 FCFA
- Prix après réduction : 468 000 FCFA
- **Surplus chauffeur : +25 000 FCFA**
- Prix avec chauffeur : 493 000 FCFA
- Frais de service (12% TTC) : 59 160 FCFA
- **Total payé par le locataire : 552 160 FCFA**

### Pour le propriétaire :
- Prix avec chauffeur : 493 000 FCFA
- Commission HT : 493 000 × 0.02 = 9 860 FCFA
- Commission TVA : 9 860 × 0.20 = 1 972 FCFA
- Commission TTC : 11 832 FCFA
- **Revenu net : 493 000 - 11 832 = 481 168 FCFA** (sans la caution)

---

## ❌ PROBLÈMES IDENTIFIÉS

### 1. EMAIL DEMANDE DE RÉSERVATION - PROPRIÉTAIRE

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (ligne ~6286)

**Problème** :
- ❌ Revenu net affiché : **556 768 FCFA**
- ✅ Revenu net attendu : **481 168 FCFA**
- **Différence : +75 600 FCFA**

**Cause** : Le calcul inclut probablement la caution ou utilise un mauvais montant de base.

**Calcul incorrect probable** :
```
556 768 = 468 000 (prix après réduction SANS chauffeur) - commission + caution
         = 468 000 - 11 232 + 100 000
         = 556 768 FCFA
```

**Calcul correct** :
```
481 168 = 493 000 (prix avec chauffeur) - 11 832 (commission)
```

---

### 2. EMAIL DEMANDE DE RÉSERVATION - LOCATAIRE

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (ligne ~6421)

**Problème** :
- ❌ Prix total affiché : **524 160 FCFA**
- ✅ Prix total attendu : **552 160 FCFA**
- **Différence : -28 000 FCFA**

**Cause** : Le surplus chauffeur n'est pas inclus dans le calcul.

**Calcul incorrect** :
```
524 160 = 468 000 (prix après réduction) + 56 160 (frais de service sur 468 000)
```

**Calcul correct** :
```
552 160 = 493 000 (prix avec chauffeur) + 59 160 (frais de service sur 493 000)
```

---

### 3. EMAIL CONFIRMATION - LOCATAIRE

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (ligne ~6333)

**Problème** :
- ❌ Prix total affiché : **524 160 FCFA**
- ✅ Prix total attendu : **552 160 FCFA**
- **Différence : -28 000 FCFA**

**Cause** : Même problème que #2 - le surplus chauffeur n'est pas inclus.

---

### 4. PDF JUSTIFICATIF - LOCATAIRE

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (fonction `generateVehicleBookingPDF`)

**Problèmes multiples** :

#### 4.1. Frais de service incorrects
- ❌ Frais de service affichés : **62 400 FCFA**
- ✅ Frais de service attendus : **59 160 FCFA**
- **Différence : +3 240 FCFA**

**Calcul incorrect probable** :
```
62 400 = 520 000 (prix initial) × 0.12
```

**Calcul correct** :
```
59 160 = 493 000 (prix avec chauffeur) × 0.12
```

#### 4.2. Total à payer incorrect
- ❌ Total affiché : **682 400 FCFA**
- ✅ Total attendu : **552 160 FCFA**
- **Différence : +130 240 FCFA**

**Calcul incorrect** :
```
682 400 = 520 000 (prix initial) + 62 400 (frais service) + 100 000 (caution)
```

**Problèmes** :
1. Utilise le prix initial (520 000) au lieu du prix avec chauffeur (493 000)
2. Frais de service calculés sur le mauvais montant
3. **Inclut la caution dans le total** (la caution est payée séparément en espèces)

**Calcul correct** :
```
552 160 = 493 000 (prix avec chauffeur) + 59 160 (frais de service)
         (sans la caution, payée séparément)
```

#### 4.3. Manque le surplus chauffeur dans le détail
- Le PDF ne montre pas le surplus chauffeur dans la ligne de détail

---

### 5. EMAIL CONFIRMATION - PROPRIÉTAIRE

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (ligne ~6537)

**Problème** :
- ❌ Revenu net affiché : **556 768 FCFA**
- ✅ Revenu net attendu : **481 168 FCFA**
- **Différence : +75 600 FCFA**

**Cause** : Même problème que #1 - calcul incorrect du revenu net.

---

### 6. PDF JUSTIFICATIF - PROPRIÉTAIRE

**Fichier** : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts` (fonction `generateVehicleBookingPDF`)

**Problèmes multiples** :

#### 6.1. Commission incorrecte
- ❌ Commission affichée : **-12 480 FCFA**
- ✅ Commission attendue : **-11 832 FCFA**
- **Différence : +648 FCFA**

**Calcul incorrect probable** :
```
12 480 = 520 000 (prix initial) × 0.024
```

**Calcul correct** :
```
11 832 = 493 000 (prix avec chauffeur) × 0.024
```

#### 6.2. Revenu net incorrect
- ❌ Revenu net affiché : **607 520 FCFA**
- ✅ Revenu net attendu : **481 168 FCFA**
- **Différence : +126 352 FCFA**

**Calcul incorrect probable** :
```
607 520 = 520 000 (prix initial) - 12 480 (commission) + 100 000 (caution)
```

**Problèmes** :
1. Utilise le prix initial (520 000) au lieu du prix avec chauffeur (493 000)
2. Commission calculée sur le mauvais montant
3. **Inclut la caution dans le revenu net** (la caution est payée séparément)

**Calcul correct** :
```
481 168 = 493 000 (prix avec chauffeur) - 11 832 (commission)
         (sans la caution, payée séparément)
```

---

## 🔍 ANALYSE DES CAUSES RACINES

### Problème principal : Le surplus chauffeur n'est pas inclus dans les calculs

Les emails et PDFs utilisent probablement :
- `basePrice` ou `priceAfterDiscount` (468 000 FCFA) au lieu de `basePriceWithDriver` (493 000 FCFA)
- Ou `totalPrice` qui n'inclut pas le chauffeur

### Problème secondaire : La caution est incluse dans les totaux

- Dans le PDF locataire : la caution est ajoutée au total à payer
- Dans le PDF propriétaire : la caution est ajoutée au revenu net
- **La caution doit être affichée séparément** car elle est payée en espèces et remboursable

### Problème tertiaire : Calculs de fallback incorrects

Les calculs de fallback dans les templates d'email utilisent probablement :
- `data.basePrice` au lieu de `data.basePriceWithDriver`
- Ou recalculent depuis `data.totalPrice` sans tenir compte du chauffeur

---

## 📋 RÉSUMÉ DES CORRECTIONS NÉCESSAIRES

### 1. Email demande de réservation - Propriétaire
- [ ] Utiliser `basePriceWithDriver` pour calculer le revenu net
- [ ] Exclure la caution du revenu net
- [ ] Vérifier que `ownerNetRevenue` envoyé depuis `useVehicleBookings.ts` est correct

### 2. Email demande de réservation - Locataire
- [ ] Utiliser `totalPrice` qui inclut le chauffeur et les frais de service
- [ ] Vérifier que `totalPrice` envoyé depuis `useVehicleBookings.ts` est correct (552 160 FCFA)

### 3. Email confirmation - Locataire
- [ ] Même correction que #2

### 4. PDF justificatif - Locataire
- [ ] Inclure le surplus chauffeur dans le détail
- [ ] Calculer les frais de service sur `basePriceWithDriver` (493 000)
- [ ] Exclure la caution du total à payer (affichée séparément)
- [ ] Total à payer = prix avec chauffeur + frais de service (sans caution)

### 5. Email confirmation - Propriétaire
- [ ] Même correction que #1

### 6. PDF justificatif - Propriétaire
- [ ] Calculer la commission sur `basePriceWithDriver` (493 000)
- [ ] Exclure la caution du revenu net (affichée séparément)
- [ ] Revenu net = prix avec chauffeur - commission (sans caution)

---

## 🎯 PRIORITÉS

1. **URGENT** : Corriger les calculs dans `generateVehicleBookingPDF` pour inclure le chauffeur
2. **URGENT** : Exclure la caution des totaux dans les PDFs
3. **IMPORTANT** : Vérifier que `useVehicleBookings.ts` envoie les bonnes valeurs (`basePriceWithDriver`, `totalPrice`, `ownerNetRevenue`)
4. **IMPORTANT** : Corriger les calculs de fallback dans les templates d'email

---

## 📝 NOTES

- Les overviews affichent maintenant les bons montants (552 160 FCFA locataire, 481 168 FCFA propriétaire)
- Le problème vient donc des emails et PDFs qui utilisent des calculs différents ou des données incorrectes
- Il faut s'assurer que les mêmes données sont utilisées partout



