# 🎯 Règles d'annulation recommandées pour la location de véhicules

## 📊 Analyse comparative

### Règles actuelles dans votre application

#### **Propriétés (résidences meublées)**
- **Hôte annule** : 28j / 48h → 0% / 20% / 40%
- **Voyageur annule** : Flexible (1j) / Modéré (5j) / Strict (7j) → 100% ou 50%

#### **Véhicules (actuel mobile)**
- **Locataire annule** : 7j / 3j → 0% / 10% / 20%
- **Propriétaire annule** : 7j / 3j → 0% / 10% / 20% (mais locataire toujours remboursé 100%)

#### **Véhicules (site web)**
- **Locataire annule** : 7j / 48h / 24h → 0% / 15% / 30% / 50%
- **Propriétaire annule** : 28j / 48h → 0% / 20% / 40%
- **En cours** : 50% (locataire) / 40% (propriétaire)

---

## ✅ Règles recommandées (basées sur les standards du marché)

### 🎯 **Principe général**
1. **Plus on s'approche de la date** → Plus la pénalité est élevée
2. **Propriétaire annule** → Pénalités plus élevées (impact plus fort sur le locataire)
3. **Annulation en cours** → Pénalités maximales (véhicule déjà utilisé)
4. **Cohérence** avec les règles des propriétés

---

## 📋 Règles recommandées détaillées

### 1️⃣ **Annulation par le LOCATAIRE** (avant le début)

| Délai avant le début | Pénalité | Remboursement | Justification |
|---------------------|----------|---------------|---------------|
| **Plus de 7 jours** | 0% | 100% | Délai raisonnable pour trouver un remplaçant |
| **Entre 3 et 7 jours** | 15% | 85% | Délai moyen, pénalité modérée |
| **Entre 24h et 3 jours** | 30% | 70% | Délai court, pénalité significative |
| **Moins de 24h** | 50% | 50% | Délai très court, pénalité importante |

**Logique** : Progression graduelle (0% → 15% → 30% → 50%) pour inciter à annuler tôt.

---

### 2️⃣ **Annulation par le PROPRIÉTAIRE** (avant le début)

| Délai avant le début | Pénalité propriétaire | Remboursement locataire | Justification |
|---------------------|----------------------|------------------------|---------------|
| **Plus de 28 jours** | 0% | 100% | Délai très long, pas d'impact |
| **Entre 7 et 28 jours** | 20% | 100% | Délai moyen, pénalité modérée |
| **Entre 48h et 7 jours** | 40% | 100% | Délai court, pénalité importante |
| **Moins de 48h** | 50% | 100% | Délai très court, pénalité maximale |

**Logique** : 
- Le locataire est **toujours remboursé à 100%** (protection du consommateur)
- Le propriétaire supporte une pénalité croissante (décourage les annulations tardives)
- Seuils plus stricts que pour le locataire (28j vs 7j) car impact plus fort

---

### 3️⃣ **Annulation EN COURS de location**

| Qui annule | Pénalité | Remboursement | Justification |
|-----------|----------|---------------|---------------|
| **Locataire** | 50% des jours restants | 50% des jours restants | Le véhicule est déjà utilisé |
| **Propriétaire** | 50% des jours restants | 100% des jours restants | Le locataire doit être protégé |

**Calcul** :
- Jours restants = Total jours - Jours déjà écoulés
- Montant jours restants = Jours restants × Tarif journalier

**Exemple** :
- Location 10 jours à 10 000 XOF/jour = 100 000 XOF
- Annulation après 3 jours
- Jours restants : 7 jours
- Montant restant : 70 000 XOF
- **Locataire annule** : Pénalité 35 000 XOF, Remboursement 35 000 XOF
- **Propriétaire annule** : Pénalité 35 000 XOF, Remboursement 70 000 XOF

---

### 4️⃣ **Réservations en attente (pending)**

| Statut | Pénalité | Remboursement | Justification |
|--------|----------|---------------|---------------|
| **Pending** | 0% | 0 XOF | Aucun paiement n'a été effectué |

---

## 🔄 Comparaison avec les standards du marché

### **Turo** (location de véhicules entre particuliers)
- Annulation par hôte : Remboursement 100% + pénalité
- Annulation par locataire : 0% à 7j, 25% à 48h, 50% à 24h
- **Notre recommandation** : Plus équilibrée et protectrice

### **Getaround** (location courte durée)
- Annulation par hôte : Remboursement 100% + pénalité
- Annulation par locataire : 0% à 7j, pénalités progressives
- **Notre recommandation** : Alignée avec ces standards

### **Airbnb** (résidences)
- Annulation par hôte : Remboursement 100% + pénalité
- Annulation par voyageur : Flexible/Modéré/Strict
- **Notre recommandation** : Cohérente avec l'approche Airbnb

---

## 💡 Avantages de ces règles

### ✅ **Pour le locataire**
- Délai de grâce de 7 jours (annulation gratuite)
- Protection totale si le propriétaire annule
- Pénalités progressives et prévisibles

### ✅ **Pour le propriétaire**
- Protection contre les annulations de dernière minute
- Pénalités décourageant les annulations tardives
- Délai de 28 jours pour annulation sans pénalité

### ✅ **Pour la plateforme**
- Règles claires et transparentes
- Cohérence entre propriétés et véhicules
- Équilibre entre protection des deux parties

---

## 📊 Tableau récapitulatif

### **Annulation par LOCATAIRE**

```
┌─────────────────────┬──────────┬──────────────┐
│ Délai avant début   │ Pénalité │ Remboursement│
├─────────────────────┼──────────┼──────────────┤
│ > 7 jours           │    0%    │     100%     │
│ 3-7 jours           │   15%    │      85%     │
│ 24h-3 jours         │   30%    │      70%     │
│ < 24h               │   50%    │      50%     │
│ En cours            │   50%*   │     50%*     │
└─────────────────────┴──────────┴──────────────┘
* Sur les jours restants uniquement
```

### **Annulation par PROPRIÉTAIRE**

```
┌─────────────────────┬──────────┬──────────────┐
│ Délai avant début   │ Pénalité │ Remboursement│
│                     │ (proprio)│  (locataire) │
├─────────────────────┼──────────┼──────────────┤
│ > 28 jours          │    0%    │     100%     │
│ 7-28 jours          │   20%    │     100%     │
│ 48h-7 jours         │   40%    │     100%     │
│ < 48h               │   50%    │     100%     │
│ En cours            │   50%*   │    100%*     │
└─────────────────────┴──────────┴──────────────┘
* Sur les jours restants uniquement
```

---

## 🎯 Recommandation finale

**Adopter les règles du site web** (qui sont plus détaillées) et les **synchroniser avec l'application mobile** :

1. ✅ **Précision** : Basée sur les heures (plus juste)
2. ✅ **Cohérence** : Alignée avec les règles des propriétés
3. ✅ **Protection** : Locataire toujours remboursé si propriétaire annule
4. ✅ **Équité** : Pénalités progressives et prévisibles
5. ✅ **Standards** : Conforme aux pratiques du marché

---

## 🔧 Implémentation

### Code à modifier :
- `VehicleCancellationModal.tsx` (mobile)
- Synchroniser avec `VehicleCancellationDialog.tsx` (web)

### Points clés :
- Utiliser les **heures** plutôt que les jours pour plus de précision
- Gérer le cas **"en cours de location"**
- Calculer les **jours restants** pour les annulations en cours
- Assurer la **cohérence** entre mobile et web

---

## 📝 Notes importantes

1. **Réservations en attente** : Toujours 0% de pénalité (pas de paiement)
2. **Annulation en cours** : Toujours possible mais avec pénalités importantes
3. **Réservations terminées** : Impossible d'annuler
4. **Calcul de base** : `daily_rate × rental_days` (ou `total_price` si disponible)













