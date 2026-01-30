# Récapitulatif des cas d'application de la TVA (20%) sur les frais de service AkwaHome

## Règle à appliquer
**TVA de 20% sur TOUS les frais de service AkwaHome** :
- Frais de service voyageur/locataire (12% pour propriétés, 10% pour véhicules)
- Commission hôte/propriétaire (2%)

### Formule de calcul

#### Pour les frais de service voyageur/locataire :
```
Frais de service HT = Prix après réduction × Taux commission (12% ou 10%)
TVA sur frais de service = Frais de service HT × 20%
Frais de service TTC = Frais de service HT + TVA sur frais de service
```

#### Pour la commission hôte/propriétaire :
```
Commission hôte HT = Prix après réduction × 2%
TVA sur commission hôte = Commission hôte HT × 20%
Commission hôte TTC = Commission hôte HT + TVA sur commission hôte
```

---

## 1. CALCULS DE BASE (Fonctions utilitaires)

### 1.1 `src/lib/commissions.ts`
- **Fonction**: `getCommissionRates(serviceType)`
- **Usage**: Retourne les taux de commission
  - Propriétés: `travelerFeePercent: 12%`
  - Véhicules: `travelerFeePercent: 10%`
- **Modification nécessaire**: Aucune (les taux restent les mêmes)

### 1.2 `src/hooks/usePricing.ts`
- **Fonction**: `calculateFees(priceAfterDiscount, nights, serviceType, propertyFees)`
- **Ligne**: 143
- **Calcul actuel**: 
  ```typescript
  const serviceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  ```
- **Calcul à appliquer**:
  ```typescript
  // Frais de service voyageur avec TVA
  const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
  const serviceFee = serviceFeeHT + serviceFeeVAT;
  ```
- **Retour**: Doit inclure `serviceFeeHT`, `serviceFeeVAT`, `serviceFee` (TTC)

### 1.3 Nouvelle fonction à créer : `calculateHostCommission()`
- **Fonction**: `calculateHostCommission(priceAfterDiscount, serviceType)`
- **Calcul à appliquer**:
  ```typescript
  // Commission hôte avec TVA
  const hostCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  const hostCommissionVAT = Math.round(hostCommissionHT * 0.20);
  const hostCommission = hostCommissionHT + hostCommissionVAT;
  ```
- **Retour**: Doit inclure `hostCommissionHT`, `hostCommissionVAT`, `hostCommission` (TTC)

---

## 2. RÉSIDENCES MEUBLÉES - CÔTÉ VOYAGEUR (Locataire)

### 2.1 `src/components/InvoiceDisplay.tsx`
- **Type**: Facture voyageur (`type === 'traveler'`)
- **Service**: Propriété (`serviceType === 'property'`)
- **Ligne**: 167
- **Calcul actuel**:
  ```typescript
  const effectiveServiceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  ```
- **Affichage**: Ligne 310-315
  ```typescript
  <Text style={styles.financialLabel}>Frais de service Akwahome</Text>
  <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
  ```
- **Modification nécessaire**: 
  - Calculer TVA séparément
  - Afficher: "Frais de service Akwahome (HT)" + "TVA (20%)" + "Frais de service Akwahome (TTC)"
  - Inclure la TVA dans le total payé

### 2.2 `src/components/BookingCard.tsx`
- **Usage**: Carte de réservation dans la liste
- **Ligne**: 252
- **Calcul actuel**:
  ```typescript
  const effectiveServiceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  ```
- **Modification nécessaire**: Utiliser le nouveau calcul avec TVA

### 2.3 `src/screens/PropertyBookingDetailsScreen.tsx`
- **Usage**: Détails de réservation voyageur
- **Ligne**: 220
- **Calcul actuel**:
  ```typescript
  const effectiveServiceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  ```
- **Modification nécessaire**: Utiliser le nouveau calcul avec TVA

### 2.4 `src/components/BookingModal.tsx`
- **Usage**: Modal de réservation (avant confirmation)
- **Ligne**: 443-448
- **Calcul actuel**: Utilise `calculateFinalPrice()` qui appelle `calculateFees()`
- **Affichage**: Affiche les frais dans le récapitulatif avant réservation
- **Modification nécessaire**: 
  - Utiliser le nouveau `calculateFees()` avec TVA
  - Afficher la TVA séparément dans le récapitulatif

---

## 3. RÉSIDENCES MEUBLÉES - CÔTÉ PROPRIÉTAIRE (Hôte)

### 3.1 `src/components/InvoiceDisplay.tsx`
- **Type**: Justificatif hôte (`type === 'host'`)
- **Service**: Propriété (`serviceType === 'property'`)
- **Ligne**: 173
- **Calcul actuel**:
  ```typescript
  const hostCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  ```
- **Calcul à appliquer**:
  ```typescript
  const hostCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  const hostCommissionVAT = Math.round(hostCommissionHT * 0.20);
  const hostCommission = hostCommissionHT + hostCommissionVAT;
  ```
- **Affichage**: 
  - Afficher: "Commission Akwahome (HT)" + "TVA (20%)" + "Commission Akwahome (TTC)"
  - Le montant net reçu par l'hôte = `priceAfterDiscount - hostCommission` (TTC)
- **Modification nécessaire**: 
  - Calculer TVA sur commission hôte
  - Afficher la TVA séparément
  - Le montant déduit de l'hôte inclut la TVA

### 3.2 `src/components/HostBookingDetailsModal.tsx`
- **Usage**: Modal de détails de réservation pour l'hôte
- **Modification nécessaire**: Vérifier si les frais de service sont affichés ici

### 3.3 `src/screens/HostBookingsScreen.tsx`
- **Usage**: Liste des réservations de l'hôte
- **Modification nécessaire**: 
  - Vérifier les calculs de revenus nets
  - La commission déduite doit inclure la TVA

### 3.4 `src/screens/HostStatsScreen.tsx`
- **Usage**: Statistiques de l'hôte
- **Ligne**: 149 (calcul de `hostCommission`)
- **Calcul actuel**:
  ```typescript
  const hostCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  return priceAfterDiscount - hostCommission;
  ```
- **Modification nécessaire**: 
  - Calculer la TVA sur la commission hôte
  - Le revenu net = `priceAfterDiscount - hostCommissionTTC`

---

## 4. LOCATIONS DE VÉHICULES - CÔTÉ LOCATAIRE

### 4.1 `src/screens/VehicleBookingScreen.tsx`
- **Usage**: Écran de réservation de véhicule
- **Ligne**: 293
- **Calcul actuel**:
  ```typescript
  const fees = calculateFees(basePrice, rentalDays, 'vehicle');
  const totalPrice = basePrice + fees.serviceFee;
  ```
- **Modification nécessaire**: Utiliser le nouveau `calculateFees()` avec TVA

### 4.2 `src/components/VehicleBookingDetailsModal.tsx`
- **Usage**: Modal de détails de réservation véhicule (côté locataire)
- **Modification nécessaire**: Vérifier l'affichage des frais de service et ajouter la TVA

### 4.3 `src/screens/MyVehicleBookingsScreen.tsx`
- **Usage**: Liste des réservations de véhicules du locataire
- **Modification nécessaire**: Vérifier l'affichage des montants totaux

### 4.4 `src/components/InvoiceDisplay.tsx`
- **Type**: Facture voyageur (`type === 'traveler'`)
- **Service**: Véhicule (`serviceType === 'vehicle'`)
- **Ligne**: 167 (même calcul que pour les propriétés)
- **Modification nécessaire**: Même traitement que pour les propriétés

---

## 5. LOCATIONS DE VÉHICULES - CÔTÉ PROPRIÉTAIRE

### 5.1 `src/screens/HostVehicleBookingsScreen.tsx`
- **Usage**: Liste des réservations de véhicules du propriétaire
- **Ligne**: 219 (calcul de `ownerCommission`)
- **Calcul actuel**:
  ```typescript
  const ownerCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  return priceAfterDiscount - ownerCommission;
  ```
- **Modification nécessaire**: 
  - Calculer la TVA sur la commission propriétaire
  - Le revenu net = `priceAfterDiscount - ownerCommissionTTC`

### 5.2 `src/screens/VehicleOwnerStatsScreen.tsx`
- **Usage**: Statistiques du propriétaire de véhicule
- **Ligne**: 173 (calcul de `ownerCommission`)
- **Calcul actuel**:
  ```typescript
  const ownerCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  return priceAfterDiscount - ownerCommission;
  ```
- **Modification nécessaire**: 
  - Calculer la TVA sur la commission propriétaire
  - Le revenu net = `priceAfterDiscount - ownerCommissionTTC`

---

## 6. ADMINISTRATION

### 6.1 `src/screens/AdminRevenueScreen.tsx`
- **Usage**: Calcul des revenus AkwaHome
- **Ligne**: 118-119
- **Calcul actuel**:
  ```typescript
  const serviceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  const hostCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  const totalRevenue = serviceFee + hostCommission;
  ```
- **Calcul à appliquer**:
  ```typescript
  // Frais de service voyageur avec TVA
  const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
  const serviceFee = serviceFeeHT + serviceFeeVAT;
  
  // Commission hôte avec TVA
  const hostCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  const hostCommissionVAT = Math.round(hostCommissionHT * 0.20);
  const hostCommission = hostCommissionHT + hostCommissionVAT;
  
  // Revenu total HT (sans TVA car la TVA est collectée mais n'est pas un revenu)
  const totalRevenueHT = serviceFeeHT + hostCommissionHT;
  // TVA totale collectée
  const totalVAT = serviceFeeVAT + hostCommissionVAT;
  ```
- **Modification nécessaire**: 
  - Calculer la TVA sur les frais de service ET la commission hôte
  - Le revenu total HT = `serviceFeeHT + hostCommissionHT`
  - Afficher séparément: `serviceFeeHT`, `serviceFeeVAT`, `hostCommissionHT`, `hostCommissionVAT`, `totalRevenueHT`, `totalVAT`

### 6.2 `src/screens/AdminDashboardScreen.tsx`
- **Usage**: Tableau de bord admin
- **Modification nécessaire**: Vérifier les calculs de revenus globaux

---

## 7. MODIFICATIONS DE RÉSERVATIONS

### 7.1 `src/components/BookingModificationModal.tsx`
- **Usage**: Modal de modification de réservation (propriétés)
- **Modification nécessaire**: Recalculer les frais avec TVA lors des modifications

### 7.2 `src/components/VehicleModificationModal.tsx`
- **Usage**: Modal de modification de réservation (véhicules)
- **Modification nécessaire**: Recalculer les frais avec TVA lors des modifications

---

## 8. GÉNÉRATION DE PDF

### 8.1 `src/hooks/useBookingPDF.ts`
- **Usage**: Génération de PDF de facture
- **Modification nécessaire**: Inclure la TVA dans le PDF généré

---

## RÉSUMÉ DES MODIFICATIONS À EFFECTUER

### Priorité 1 - Fonctions de base (impact global)
1. ✅ `src/hooks/usePricing.ts` - `calculateFees()` - **CRITIQUE**
   - Ajouter calcul TVA
   - Retourner `serviceFeeHT`, `serviceFeeVAT`, `serviceFee` (TTC)

### Priorité 2 - Affichages voyageur (propriétés)
2. ✅ `src/components/InvoiceDisplay.tsx` - Facture voyageur propriété
3. ✅ `src/components/BookingCard.tsx` - Carte de réservation
4. ✅ `src/screens/PropertyBookingDetailsScreen.tsx` - Détails réservation
5. ✅ `src/components/BookingModal.tsx` - Modal de réservation

### Priorité 3 - Affichages voyageur (véhicules)
6. ✅ `src/screens/VehicleBookingScreen.tsx` - Écran de réservation
7. ✅ `src/components/VehicleBookingDetailsModal.tsx` - Détails réservation
8. ✅ `src/components/InvoiceDisplay.tsx` - Facture voyageur véhicule

### Priorité 4 - Affichages propriétaire
9. ✅ `src/components/InvoiceDisplay.tsx` - Justificatif hôte (TVA sur commission hôte)
10. ✅ `src/screens/HostStatsScreen.tsx` - Statistiques hôte (TVA sur commission)
11. ✅ `src/screens/HostVehicleBookingsScreen.tsx` - Réservations véhicules hôte (TVA sur commission)
12. ✅ `src/screens/VehicleOwnerStatsScreen.tsx` - Statistiques propriétaire véhicule (TVA sur commission)

### Priorité 5 - Administration
12. ✅ `src/screens/AdminRevenueScreen.tsx` - Calcul revenus admin
13. ⚠️ `src/screens/AdminDashboardScreen.tsx` - Dashboard admin

### Priorité 6 - Modifications et PDF
14. ✅ `src/components/BookingModificationModal.tsx` - Modifications propriétés
15. ✅ `src/components/VehicleModificationModal.tsx` - Modifications véhicules
16. ⚠️ `src/hooks/useBookingPDF.ts` - Génération PDF

---

## EXEMPLE DE CALCUL

### Cas: Réservation propriété
- Prix par nuit: 15,000 FCFA
- Nombre de nuits: 5
- Prix de base: 75,000 FCFA
- Réduction: 0 FCFA
- Prix après réduction: 75,000 FCFA

**Calcul actuel (SANS TVA)**:
- Frais de service: 75,000 × 12% = 9,000 FCFA
- Total: 75,000 + 9,000 = 84,000 FCFA

**Calcul nouveau (AVEC TVA)**:
- Prix après réduction: 75,000 FCFA

**Côté voyageur**:
- Frais de service HT: 75,000 × 12% = 9,000 FCFA
- TVA sur frais de service (20%): 9,000 × 20% = 1,800 FCFA
- Frais de service TTC: 9,000 + 1,800 = 10,800 FCFA
- Total payé par voyageur: 75,000 + 10,800 = 85,800 FCFA

**Côté hôte**:
- Commission hôte HT: 75,000 × 2% = 1,500 FCFA
- TVA sur commission hôte (20%): 1,500 × 20% = 300 FCFA
- Commission hôte TTC: 1,500 + 300 = 1,800 FCFA
- Montant net reçu par hôte: 75,000 - 1,800 = 73,200 FCFA

**Côté admin**:
- Revenu total HT: 9,000 + 1,500 = 10,500 FCFA
- TVA totale collectée: 1,800 + 300 = 2,100 FCFA

---

## NOTES IMPORTANTES

1. **La TVA s'applique sur TOUS les frais de service AkwaHome** :
   - Frais de service voyageur/locataire (12% ou 10%)
   - Commission hôte/propriétaire (2%)

2. **La TVA doit être affichée séparément dans toutes les factures** :
   - Facture voyageur : afficher frais de service HT + TVA + TTC
   - Justificatif hôte : afficher commission HT + TVA + TTC
   - Facture admin : afficher tous les montants HT et TVA séparément

3. **Le total payé par le voyageur doit inclure la TVA** sur les frais de service

4. **Le montant déduit de l'hôte/propriétaire doit inclure la TVA** sur la commission

5. **Les revenus admin doivent distinguer** :
   - Revenu HT (sans TVA) = `serviceFeeHT + hostCommissionHT`
   - TVA collectée = `serviceFeeVAT + hostCommissionVAT`
   - La TVA est collectée mais n'est pas un revenu pour AkwaHome

6. **Tous les calculs de revenus nets doivent utiliser les montants TTC** :
   - Revenu net hôte = `priceAfterDiscount - hostCommissionTTC`
   - Revenu net propriétaire véhicule = `priceAfterDiscount - ownerCommissionTTC`

