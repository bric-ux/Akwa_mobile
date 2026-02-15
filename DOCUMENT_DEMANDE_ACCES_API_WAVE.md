# 📄 DOCUMENT DE DEMANDE D'ACCÈS À L'API WAVE
## AkwaHome - Plateforme de Location de Résidences Meublées et Véhicules

---

## 🏢 INFORMATIONS SUR L'ENTREPRISE

**Nom de l'entreprise :** AkwaHome  
**Type d'activité :** Plateforme de location de résidences meublées et véhicules  
**Zone géographique :** Côte d'Ivoire (extension prévue en Afrique de l'Ouest)  
**Site web :** [À compléter]  
**Contact :** [À compléter]

---

## 🎯 OBJECTIF DE L'INTÉGRATION

AkwaHome souhaite intégrer l'API Wave pour permettre à ses utilisateurs de payer les réservations de résidences meublées et de véhicules via Wave, une solution de paiement mobile largement utilisée en Côte d'Ivoire et en Afrique de l'Ouest.

---

## 👥 TYPES D'UTILISATEURS ET PARCOURS

### 1. 👤 **VOYAGEUR / LOCATAIRE** (Utilisateur final)

#### **Parcours de réservation de résidence meublée :**

1. **Recherche et sélection**
   - Consultation du catalogue de propriétés
   - Filtrage par critères (localisation, prix, équipements)
   - Visualisation des détails et disponibilités

2. **Création de la réservation**
   - Sélection des dates d'arrivée et de départ
   - Indication du nombre de voyageurs
   - Calcul automatique du prix total (prix par nuit, frais de ménage, frais de service, taxes, réductions)
   - **💳 POINT DE PAIEMENT #1 : Paiement de la réservation**
     - Montant : `total_price` (inclut tous les frais)
     - Méthodes de paiement : Wave, Orange Money, MTN Money, Moov Money, Carte bancaire
     - Statut initial : `pending` (en attente de confirmation par l'hôte)

3. **Confirmation de la réservation**
   - Si `auto_booking = true` : Réservation confirmée automatiquement
   - Si `auto_booking = false` : Attente de confirmation par l'hôte
   - Envoi d'email de confirmation avec justificatif PDF

4. **Modification de réservation** (si nécessaire)
   - Demande de modification des dates ou du nombre de voyageurs
   - Calcul du surplus à payer (si augmentation)
   - **💳 POINT DE PAIEMENT #2 : Paiement du surplus de modification**
     - Montant : Différence entre nouveau total et ancien total
     - Méthodes : Wave, Orange Money, MTN Money, Moov Money, Carte bancaire

5. **Annulation de réservation** (si nécessaire)
   - Calcul du remboursement selon la politique d'annulation
   - **💸 POINT DE REMBOURSEMENT #1 : Remboursement partiel ou total**
     - Montant : Selon la politique (flexible, moderate, strict)
     - Méthode : Remboursement via la méthode de paiement originale

6. **Fin de séjour**
   - Évaluation de la propriété et de l'hôte
   - Réception du revenu net par l'hôte

---

#### **Parcours de réservation de véhicule :**

1. **Recherche et sélection**
   - Consultation du catalogue de véhicules
   - Filtrage par type, prix, disponibilité
   - Visualisation des détails (marque, modèle, équipements)

2. **Création de la réservation**
   - Sélection des dates et heures de prise et de rendu
   - Choix optionnel : "Avec chauffeur" ou "Conduire moi-même"
   - Calcul automatique du prix total (prix par jour, prix par heure, frais chauffeur, frais de service, réductions)
   - **💳 POINT DE PAIEMENT #3 : Paiement de la réservation véhicule**
     - Montant : `total_price` (inclut tous les frais)
     - Méthodes : Wave, Orange Money, MTN Money, Moov Money, Carte bancaire
     - Statut initial : `pending` (en attente de confirmation par le propriétaire)

3. **Confirmation de la réservation**
   - Si `auto_booking = true` : Réservation confirmée automatiquement
   - Si `auto_booking = false` : Attente de confirmation par le propriétaire
   - Envoi d'email de confirmation avec justificatif PDF

4. **Modification de réservation** (si nécessaire)
   - Demande de modification des dates/heures
   - Calcul du surplus à payer (si augmentation)
   - **💳 POINT DE PAIEMENT #4 : Paiement du surplus de modification véhicule**
     - Montant : Différence entre nouveau total et ancien total
     - Méthodes : Wave, Orange Money, MTN Money, Moov Money, Carte bancaire

5. **Annulation de réservation** (si nécessaire)
   - Calcul du remboursement selon les règles d'annulation
   - **💸 POINT DE REMBOURSEMENT #2 : Remboursement partiel ou total**
     - Montant : Selon le délai d'annulation
     - Méthode : Remboursement via la méthode de paiement originale

6. **Fin de location**
   - Évaluation du véhicule et du propriétaire
   - Réception du revenu net par le propriétaire

---

### 2. 🏠 **HÔTE** (Propriétaire de résidence meublée)

#### **Parcours de gestion de réservation :**

1. **Réception de demande de réservation**
   - Notification d'une nouvelle demande (`pending`)
   - Consultation des détails (dates, voyageurs, message)
   - Visualisation du montant net à recevoir (`host_net_amount`)

2. **Décision sur la demande**
   - **Option A : Confirmation**
     - Acceptation de la réservation
     - Réservation passée en statut `confirmed`
     - **💰 POINT DE RECEPTION #1 : Réception du revenu net**
       - Montant : `host_net_amount` (prix de base - commission AkwaHome)
       - Méthode de versement : Virement bancaire ou mobile money (selon préférences)
   - **Option B : Refus**
     - Rejet de la réservation
     - Réservation passée en statut `cancelled`
     - **💸 POINT DE REMBOURSEMENT #3 : Remboursement intégral au voyageur**
       - Montant : `total_price` (100% remboursé)
       - Méthode : Remboursement via la méthode de paiement originale

3. **Gestion des modifications de réservation**
   - Réception de demande de modification
   - Décision d'approbation ou de refus
   - Si approbation avec surplus : Réception du surplus net

4. **Gestion des annulations**
   - **Annulation par l'hôte** : Paiement d'une pénalité selon le délai
     - **💳 POINT DE PAIEMENT #5 : Paiement de pénalité d'annulation (hôte)**
       - Montant : 20% à 50% du montant selon délai
       - Méthodes : Wave, Orange Money, MTN Money, Moov Money
   - **Annulation par le voyageur** : Remboursement partiel ou total selon politique

5. **Fin de séjour**
   - Réception du revenu net (si pas déjà reçu)
   - Évaluation du voyageur

---

### 3. 🚗 **PROPRIÉTAIRE DE VÉHICULE**

#### **Parcours de gestion de réservation :**

1. **Réception de demande de réservation**
   - Notification d'une nouvelle demande (`pending`)
   - Consultation des détails (dates, heures, avec/sans chauffeur)
   - Visualisation du montant net à recevoir (`host_net_amount`)

2. **Décision sur la demande**
   - **Option A : Confirmation**
     - Acceptation de la réservation
     - Réservation passée en statut `confirmed`
     - **💰 POINT DE RECEPTION #2 : Réception du revenu net**
       - Montant : `host_net_amount` (prix de base - commission AkwaHome)
       - Méthode de versement : Virement bancaire ou mobile money
   - **Option B : Refus**
     - Rejet de la réservation
     - Réservation passée en statut `cancelled`
     - **💸 POINT DE REMBOURSEMENT #4 : Remboursement intégral au locataire**
       - Montant : `total_price` (100% remboursé)
       - Méthode : Remboursement via la méthode de paiement originale

3. **Gestion des modifications de réservation**
   - Réception de demande de modification
   - Décision d'approbation ou de refus
   - Si approbation avec surplus : Réception du surplus net

4. **Gestion des annulations**
   - **Annulation par le propriétaire** : Paiement d'une pénalité selon le délai
     - **💳 POINT DE PAIEMENT #6 : Paiement de pénalité d'annulation (propriétaire)**
       - Montant : 20% à 50% du montant selon délai
       - Méthodes : Wave, Orange Money, MTN Money, Moov Money
   - **Annulation par le locataire** : Remboursement partiel ou total selon délai

5. **Fin de location**
   - Réception du revenu net (si pas déjà reçu)
   - Évaluation du locataire

---

## 💳 POINTS DE PAIEMENT IDENTIFIÉS

### **Paiements entrants (Voyageurs/Locataires → AkwaHome)**

| # | Type de paiement | Montant | Fréquence | Description |
|---|------------------|---------|-----------|-------------|
| 1 | Réservation résidence | `total_price` | À chaque réservation | Paiement initial de la réservation |
| 2 | Surplus modification résidence | Différence | Sur demande | Paiement du surplus lors d'une modification |
| 3 | Réservation véhicule | `total_price` | À chaque réservation | Paiement initial de la location |
| 4 | Surplus modification véhicule | Différence | Sur demande | Paiement du surplus lors d'une modification |
| 5 | Pénalité annulation (hôte) | 20-50% | Sur annulation | Paiement de pénalité par l'hôte |
| 6 | Pénalité annulation (propriétaire) | 20-50% | Sur annulation | Paiement de pénalité par le propriétaire |

### **Paiements sortants (AkwaHome → Hôtes/Propriétaires)**

| # | Type de paiement | Montant | Fréquence | Description |
|---|------------------|---------|-----------|-------------|
| 1 | Revenu net hôte | `host_net_amount` | Après confirmation | Versement du revenu net à l'hôte |
| 2 | Revenu net propriétaire | `host_net_amount` | Après confirmation | Versement du revenu net au propriétaire |
| 3 | Surplus net modification | Surplus net | Après approbation modification | Versement du surplus net |

### **Remboursements (AkwaHome → Voyageurs/Locataires)**

| # | Type de remboursement | Montant | Fréquence | Description |
|---|----------------------|---------|-----------|-------------|
| 1 | Remboursement résidence | 0-100% | Sur annulation | Remboursement selon politique |
| 2 | Remboursement véhicule | 0-100% | Sur annulation | Remboursement selon délai |
| 3 | Remboursement refus hôte | 100% | Sur refus | Remboursement intégral |
| 4 | Remboursement refus propriétaire | 100% | Sur refus | Remboursement intégral |

---

## 🔄 FLUX DE PAIEMENT DÉTAILLÉS

### **Flux 1 : Réservation avec paiement Wave**

```
1. Voyageur sélectionne une propriété/véhicule
2. Voyageur remplit les détails (dates, voyageurs, etc.)
3. Système calcule le total_price
4. Voyageur sélectionne "Wave" comme méthode de paiement
5. Appel API Wave pour initier le paiement
6. Redirection vers l'interface Wave ou QR code
7. Voyageur confirme le paiement via Wave
8. Webhook Wave notifie AkwaHome du paiement réussi
9. Réservation créée avec statut "pending"
10. Hôte/Propriétaire confirme → Réservation "confirmed"
11. Versement du host_net_amount à l'hôte/propriétaire
```

### **Flux 2 : Modification avec surplus**

```
1. Voyageur/Locataire demande modification
2. Système calcule le surplus (nouveau total - ancien total)
3. Si surplus > 0 :
   a. Voyageur sélectionne "Wave" pour payer le surplus
   b. Appel API Wave pour initier le paiement
   c. Webhook Wave confirme le paiement
   d. Modification approuvée
   e. Versement du surplus net à l'hôte/propriétaire
```

### **Flux 3 : Annulation avec remboursement**

```
1. Voyageur/Locataire annule la réservation
2. Système calcule le remboursement selon politique
3. Si remboursement > 0 :
   a. Appel API Wave pour initier le remboursement
   b. Wave traite le remboursement vers le compte Wave du voyageur
   c. Webhook Wave confirme le remboursement
   d. Réservation passée en statut "cancelled"
```

### **Flux 4 : Pénalité d'annulation (hôte/propriétaire)**

```
1. Hôte/Propriétaire annule une réservation
2. Système calcule la pénalité (20-50% selon délai)
3. Hôte/Propriétaire sélectionne "Wave" pour payer
4. Appel API Wave pour initier le paiement
5. Webhook Wave confirme le paiement
6. Remboursement intégral au voyageur/locataire
```

---

## 📊 VOLUMES ESTIMÉS

### **Transactions mensuelles estimées :**

- **Réservations résidences meublées :** 200-500/mois
- **Réservations véhicules :** 100-300/mois
- **Modifications :** 20-50/mois
- **Annulations :** 10-30/mois
- **Total transactions :** 330-880/mois

### **Montants moyens :**

- **Réservation résidence :** 50 000 - 500 000 FCFA
- **Réservation véhicule :** 30 000 - 300 000 FCFA
- **Surplus modification :** 10 000 - 100 000 FCFA
- **Pénalité annulation :** 10 000 - 200 000 FCFA

### **Volume financier estimé :**

- **Chiffre d'affaires mensuel :** 20 000 000 - 200 000 000 FCFA
- **Part Wave (estimée) :** 30-50% des transactions
- **Volume Wave mensuel :** 6 000 000 - 100 000 000 FCFA

---

## 🔧 BESOINS TECHNIQUES

### **Fonctionnalités requises de l'API Wave :**

1. **Initiation de paiement**
   - Création de demande de paiement
   - Génération de lien de paiement ou QR code
   - Gestion des montants en FCFA

2. **Vérification de statut**
   - Vérification en temps réel du statut de paiement
   - Polling ou webhooks pour notifications

3. **Webhooks**
   - Notification automatique des paiements réussis
   - Notification automatique des paiements échoués
   - Notification des remboursements

4. **Remboursements**
   - Initiation de remboursement partiel ou total
   - Vérification du statut de remboursement
   - Historique des remboursements

5. **Versements (Payouts)**
   - Versement aux hôtes/propriétaires
   - Vérification du statut de versement
   - Historique des versements

6. **Sécurité**
   - Authentification sécurisée (API keys, tokens)
   - Validation des signatures de webhooks
   - Chiffrement des données sensibles

---

## 🛡️ SÉCURITÉ ET CONFORMITÉ

### **Mesures de sécurité :**

- Authentification multi-facteurs pour les comptes administrateurs
- Chiffrement des données de paiement
- Validation des webhooks avec signatures
- Logs d'audit pour toutes les transactions
- Conformité RGPD pour la protection des données

### **Gestion des erreurs :**

- Retry automatique en cas d'échec de paiement
- Notifications aux utilisateurs en cas d'échec
- Gestion des timeouts et erreurs réseau
- Rollback automatique en cas d'échec critique

---

## 📈 PLAN D'INTÉGRATION

### **Phase 1 : Intégration initiale (Semaine 1-2)**
- Configuration de l'environnement de test
- Intégration de l'API Wave pour les paiements entrants
- Tests des flux de paiement de base

### **Phase 2 : Fonctionnalités avancées (Semaine 3-4)**
- Intégration des remboursements
- Intégration des versements aux hôtes/propriétaires
- Tests des webhooks

### **Phase 3 : Tests et validation (Semaine 5-6)**
- Tests de charge
- Tests de sécurité
- Validation avec utilisateurs beta

### **Phase 4 : Déploiement production (Semaine 7)**
- Passage en production
- Monitoring et support

---

## 📝 INFORMATIONS COMPLÉMENTAIRES

### **Structure de données de paiement :**

```typescript
interface Payment {
  id: string;
  booking_id: string;
  booking_type: 'property' | 'vehicle';
  amount: number; // En FCFA
  currency: 'XOF';
  payment_method: 'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'card';
  payment_provider: 'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'stripe';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  wave_transaction_id?: string;
  wave_payment_link?: string;
  created_at: string;
  updated_at: string;
}
```

### **Exemples de cas d'usage :**

1. **Réservation résidence : 5 nuits à 100 000 FCFA/nuit**
   - Prix de base : 500 000 FCFA
   - Frais de service (12%) : 60 000 FCFA
   - Total payé : 560 000 FCFA
   - Revenu net hôte : 490 000 FCFA (après commission 2%)

2. **Modification véhicule : Ajout de 2 heures**
   - Ancien total : 200 000 FCFA
   - Nouveau total : 222 400 FCFA
   - Surplus à payer : 22 400 FCFA
   - Surplus net propriétaire : 19 600 FCFA

3. **Annulation avec remboursement**
   - Total payé : 300 000 FCFA
   - Politique : Flexible, annulation 3 jours avant
   - Remboursement : 100% = 300 000 FCFA

---

## ✅ ENGAGEMENTS

AkwaHome s'engage à :

- Respecter les conditions d'utilisation de l'API Wave
- Maintenir la sécurité et la confidentialité des données
- Fournir un support technique pour les utilisateurs
- Respecter les réglementations locales en matière de paiement
- Maintenir un système de logs et d'audit complet

---

## 📞 CONTACT

**Nom :** [À compléter]  
**Fonction :** [À compléter]  
**Email :** [À compléter]  
**Téléphone :** [À compléter]  
**Adresse :** [À compléter]

---

**Date de la demande :** [Date actuelle]  
**Version du document :** 1.0



