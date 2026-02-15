# 📋 Cahier des Charges - Location Mensuelle (Longue Durée)

## 📌 Vue d'Ensemble

### Objectif
Permettre aux propriétaires de proposer leurs biens en location mensuelle (longue durée) sur la plateforme AkwaHome, avec un modèle économique basé sur un abonnement mensuel pour les propriétaires et des frais d'agence payés par les locataires à la signature du bail.

### Différences avec la Location Courte Durée (Airbnb)
| Aspect | Location Courte Durée | Location Mensuelle |
|--------|----------------------|-------------------|
| **Durée minimale** | 1 nuit | 1 mois (30 jours minimum) |
| **Paiement** | Avant l'arrivée | Caution + 1er mois à la signature |
| **Commission AkwaHome** | 2% HT + 20% TVA sur chaque réservation | Abonnement mensuel propriétaire |
| **Frais locataire** | Prix de la réservation | Frais d'agence (une fois) |
| **Visites** | Non prévues | Gratuites et obligatoires |
| **Bail** | Non | Oui (contrat de location) |
| **Gestion** | Automatique | Suivi administratif |

---

## 🎯 Fonctionnalités Principales

### 1. Gestion des Propriétés en Location Mensuelle

#### 1.1 Création/Modification d'une Annonce Mensuelle

**Acteur** : Propriétaire

**Prérequis** :
- Compte propriétaire actif
- Abonnement mensuel actif (voir section 2)
- Vérification d'identité complétée

**Fonctionnalités** :
- **Type de location** : Sélectionner "Location mensuelle" lors de la création
- **Prix mensuel** : Définir le loyer mensuel en FCFA
- **Caution** : Définir le montant de la caution (généralement 1-2 mois de loyer)
- **Durée minimale** : Durée minimale de location (1 mois, 3 mois, 6 mois, 12 mois)
- **Disponibilité** : Calendrier de disponibilité (dates de début/fin de disponibilité)
- **Équipements** : Liste des équipements inclus (meublé/non meublé, électroménager, etc.)
- **Charges** : Indiquer si les charges sont incluses ou non (eau, électricité, internet)
- **Photos** : Minimum 5 photos obligatoires
- **Description détaillée** : Description complète du bien, quartier, transports, etc.
- **Documents** : Possibilité d'ajouter des documents (certificat de propriété, etc.)

**Règles métier** :
- Le prix mensuel doit être supérieur à 50 000 FCFA
- La caution ne peut pas dépasser 3 mois de loyer
- L'annonce doit être validée par l'admin avant publication

**Écrans** :
- `EditPropertyScreen` : Ajouter un onglet "Location mensuelle"
- `PropertyManagementScreen` : Gestion spécifique pour location mensuelle

---

#### 1.2 Validation par l'Administrateur

**Acteur** : Administrateur

**Fonctionnalités** :
- Liste des annonces mensuelles en attente de validation
- Vérification des informations (photos, prix, description)
- Validation ou rejet avec commentaires
- Notification au propriétaire

**Écrans** :
- `AdminPropertiesScreen` : Filtre "Location mensuelle" + statut "En attente"
- Modal de validation avec commentaires

---

### 2. Système d'Abonnement Mensuel

#### 2.1 Souscription à l'Abonnement

**Acteur** : Propriétaire

**Fonctionnalités** :
- **Tarifs** :
  - **1 bien** : 15 000 FCFA/mois
  - **2-5 biens** : 12 000 FCFA/bien/mois
  - **6+ biens** : 10 000 FCFA/bien/mois
- **Période d'essai** : 14 jours gratuits pour nouveaux propriétaires
- **Méthodes de paiement** : Wave, Mobile Money, Carte bancaire
- **Renouvellement automatique** : Option activable/désactivable
- **Facturation** : Facture PDF générée chaque mois

**Règles métier** :
- L'abonnement est facturé par bien (pas par propriétaire)
- Si l'abonnement expire, les annonces sont masquées (pas supprimées)
- Possibilité de suspendre temporairement l'abonnement (vacances, travaux)

**Écrans** :
- `HostSubscriptionScreen` : Nouvel écran pour gérer l'abonnement
- `HostAccountScreen` : Section "Abonnement" avec statut et renouvellement

**Tables base de données** :
```sql
CREATE TABLE monthly_rental_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES profiles(user_id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  status TEXT CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')) DEFAULT 'active',
  plan_type TEXT CHECK (plan_type IN ('single', 'multi_2_5', 'multi_6_plus')) NOT NULL,
  monthly_price INTEGER NOT NULL, -- Prix en FCFA
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  trial_end_date TIMESTAMP WITH TIME ZONE, -- Pour période d'essai
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(host_id, property_id)
);
```

---

#### 2.2 Gestion de l'Abonnement

**Acteur** : Propriétaire

**Fonctionnalités** :
- **Tableau de bord** : Statut de l'abonnement, date de renouvellement
- **Historique des paiements** : Liste des factures
- **Modification** : Changer de plan, suspendre, annuler
- **Notifications** : Alertes avant expiration (7 jours, 3 jours, 1 jour)
- **Renouvellement** : Paiement automatique ou manuel

**Écrans** :
- `HostSubscriptionScreen` : Vue principale
- `SubscriptionHistoryScreen` : Historique des paiements
- `SubscriptionInvoiceScreen` : Détails d'une facture

---

#### 2.3 Facturation Automatique

**Acteur** : Système

**Fonctionnalités** :
- **Cron job** : Vérification quotidienne des abonnements à renouveler
- **Génération de facture** : PDF automatique
- **Tentative de paiement** : Paiement automatique si carte enregistrée
- **Notifications** : Email au propriétaire en cas de succès/échec
- **Suspension** : Masquage automatique des annonces si paiement échoue

**Workflow** :
1. 3 jours avant renouvellement : Notification au propriétaire
2. Jour J : Tentative de paiement automatique
3. Si succès : Facture générée, abonnement prolongé
4. Si échec : Notification + 3 jours de grâce
5. Après 3 jours : Suspension de l'abonnement

---

### 3. Système de Visites Gratuites

#### 3.1 Demande de Visite

**Acteur** : Locataire potentiel

**Fonctionnalités** :
- **Bouton "Demander une visite"** : Sur la page de détails du bien
- **Formulaire de demande** :
  - Nom et prénom
  - Numéro de téléphone
  - Email
  - Date et heure souhaitées (3 créneaux proposés)
  - Message optionnel
- **Confirmation** : Notification au propriétaire
- **Calendrier** : Le propriétaire peut voir toutes les demandes

**Règles métier** :
- Maximum 3 demandes de visite par locataire et par bien
- Les visites sont gratuites (pas de frais)
- Le propriétaire doit répondre dans les 48h
- Si pas de réponse : Notification de rappel

**Écrans** :
- `PropertyDetailsScreen` : Bouton "Demander une visite" (si location mensuelle)
- `RequestVisitModal` : Modal de demande de visite
- `HostVisitRequestsScreen` : Nouvel écran pour gérer les demandes

**Tables base de données** :
```sql
CREATE TABLE visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) NOT NULL,
  tenant_id UUID REFERENCES profiles(user_id) NOT NULL,
  requested_date TIMESTAMP WITH TIME ZONE NOT NULL,
  alternative_dates TIMESTAMP WITH TIME ZONE[], -- 2 dates alternatives
  status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')) DEFAULT 'pending',
  tenant_name TEXT NOT NULL,
  tenant_phone TEXT NOT NULL,
  tenant_email TEXT,
  message TEXT,
  confirmed_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

#### 3.2 Gestion des Visites (Propriétaire)

**Acteur** : Propriétaire

**Fonctionnalités** :
- **Liste des demandes** : Toutes les demandes de visite en attente/confirmées
- **Confirmation** : Accepter une date proposée ou proposer une autre
- **Annulation** : Possibilité d'annuler (avec notification au locataire)
- **Marquer comme complétée** : Après la visite
- **Notes** : Possibilité d'ajouter des notes privées sur le locataire potentiel

**Écrans** :
- `HostVisitRequestsScreen` : Liste des demandes
- `VisitRequestDetailsScreen` : Détails d'une demande avec actions

---

#### 3.3 Suivi des Visites (Locataire)

**Acteur** : Locataire potentiel

**Fonctionnalités** :
- **Mes demandes de visite** : Liste de toutes les demandes
- **Statut** : En attente, Confirmée, Annulée, Complétée
- **Notifications** : Alertes pour confirmations, rappels
- **Annulation** : Possibilité d'annuler sa demande

**Écrans** :
- `MyVisitRequestsScreen` : Nouvel écran pour les locataires

---

### 4. Processus de Location Mensuelle

#### 4.1 Demande de Location

**Acteur** : Locataire potentiel

**Prérequis** :
- Visite effectuée (recommandé mais pas obligatoire)
- Vérification d'identité complétée
- Documents justificatifs (pièce d'identité, justificatif de revenus)

**Fonctionnalités** :
- **Bouton "Faire une demande"** : Sur la page de détails
- **Formulaire de demande** :
  - Informations personnelles
  - Justificatifs de revenus (upload de documents)
  - Garant (nom, téléphone, email) - optionnel mais recommandé
  - Date de début souhaitée
  - Durée de location souhaitée
  - Message au propriétaire
- **Documents requis** :
  - Pièce d'identité (CNI, passeport)
  - Justificatif de revenus (3 derniers bulletins de salaire ou attestation)
  - Garantie (si demandée par le propriétaire)

**Règles métier** :
- Le locataire peut faire plusieurs demandes pour différents biens
- Le propriétaire reçoit une notification
- Le statut initial est "En attente de réponse"

**Écrans** :
- `PropertyDetailsScreen` : Bouton "Faire une demande de location"
- `MonthlyRentalApplicationScreen` : Formulaire de demande

**Tables base de données** :
```sql
CREATE TABLE monthly_rental_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) NOT NULL,
  tenant_id UUID REFERENCES profiles(user_id) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')) DEFAULT 'pending',
  
  -- Informations de la demande
  requested_start_date DATE NOT NULL,
  requested_duration_months INTEGER NOT NULL, -- Durée en mois
  monthly_rent INTEGER NOT NULL, -- Loyer mensuel
  security_deposit INTEGER NOT NULL, -- Caution
  
  -- Documents
  identity_document_url TEXT,
  income_proof_url TEXT,
  guarantor_name TEXT,
  guarantor_phone TEXT,
  guarantor_email TEXT,
  guarantor_document_url TEXT,
  
  -- Communication
  message_to_owner TEXT,
  owner_response TEXT,
  
  -- Dates
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- Expire après 7 jours si pas de réponse
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

#### 4.2 Traitement de la Demande (Propriétaire)

**Acteur** : Propriétaire

**Fonctionnalités** :
- **Liste des demandes** : Toutes les demandes reçues
- **Détails de la demande** :
  - Profil du locataire
  - Documents fournis
  - Historique des visites (si applicable)
  - Avis précédents (si locataire a déjà loué)
- **Actions** :
  - **Accepter** : La demande passe en "Acceptée"
  - **Rejeter** : Avec message optionnel
  - **Demander plus d'informations** : Message au locataire
- **Notifications** : Alertes pour nouvelles demandes

**Règles métier** :
- Le propriétaire a 7 jours pour répondre
- Si pas de réponse : La demande expire automatiquement
- Le propriétaire peut accepter plusieurs demandes (pour choisir)

**Écrans** :
- `HostMonthlyRentalApplicationsScreen` : Liste des demandes
- `MonthlyRentalApplicationDetailsScreen` : Détails d'une demande

---

#### 4.3 Signature du Bail et Paiement des Frais d'Agence

**Acteur** : Locataire (après acceptation de la demande)

**Fonctionnalités** :
- **Génération du bail** : PDF automatique avec les termes de la location
- **Frais d'agence** :
  - **Calcul** : 1 mois de loyer (ou montant personnalisé par l'admin)
  - **Paiement** : Obligatoire avant signature
  - **Méthodes** : Wave, Mobile Money, Carte bancaire
- **Signature électronique** : Signature du bail via l'application
- **Documents** :
  - Bail signé (PDF)
  - Reçu de paiement des frais d'agence
  - État des lieux (à compléter)

**Règles métier** :
- Les frais d'agence sont payés une seule fois à la signature
- Le bail est généré automatiquement avec les informations de la demande
- Le locataire et le propriétaire reçoivent une copie du bail signé
- Le statut passe à "Bail signé" après signature

**Écrans** :
- `MonthlyRentalLeaseScreen` : Affichage du bail + signature
- `MonthlyRentalPaymentScreen` : Paiement des frais d'agence
- `LeaseSignedConfirmationScreen` : Confirmation après signature

**Tables base de données** :
```sql
CREATE TABLE monthly_rental_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES monthly_rental_applications(id) NOT NULL,
  property_id UUID REFERENCES properties(id) NOT NULL,
  tenant_id UUID REFERENCES profiles(user_id) NOT NULL,
  owner_id UUID REFERENCES profiles(user_id) NOT NULL,
  
  -- Informations du bail
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent INTEGER NOT NULL,
  security_deposit INTEGER NOT NULL,
  charges_included BOOLEAN DEFAULT false,
  
  -- Documents
  lease_document_url TEXT, -- PDF du bail
  tenant_signature_url TEXT, -- Signature du locataire
  owner_signature_url TEXT, -- Signature du propriétaire
  signed_at TIMESTAMP WITH TIME ZONE,
  
  -- Paiement des frais d'agence
  agency_fee INTEGER NOT NULL, -- Frais d'agence en FCFA
  agency_fee_paid BOOLEAN DEFAULT false,
  agency_fee_payment_id UUID REFERENCES payments(id),
  agency_fee_paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Statut
  status TEXT CHECK (status IN ('draft', 'pending_signature', 'signed', 'active', 'terminated', 'expired')) DEFAULT 'draft',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

#### 4.4 Gestion de la Location Active

**Acteur** : Locataire et Propriétaire

**Fonctionnalités** :
- **Tableau de bord locataire** :
  - Informations du bail
  - Historique des paiements de loyer
  - Demandes de maintenance
  - Communication avec le propriétaire
- **Tableau de bord propriétaire** :
  - Liste des locations actives
  - Suivi des paiements de loyer
  - Demandes de maintenance
  - Communication avec le locataire
- **Paiement du loyer** :
  - Rappels automatiques (5 jours avant échéance)
  - Paiement via l'application (Wave, Mobile Money)
  - Reçu automatique
- **Renouvellement** : Renégociation du bail avant expiration

**Écrans** :
- `MyMonthlyRentalsScreen` : Pour locataires
- `HostMonthlyRentalsScreen` : Pour propriétaires
- `MonthlyRentalDetailsScreen` : Détails d'une location active

**Tables base de données** :
```sql
CREATE TABLE monthly_rental_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID REFERENCES monthly_rental_leases(id) NOT NULL,
  month INTEGER NOT NULL, -- Mois (1-12)
  year INTEGER NOT NULL, -- Année
  amount INTEGER NOT NULL, -- Montant du loyer
  status TEXT CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')) DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_id UUID REFERENCES payments(id),
  late_fee INTEGER DEFAULT 0, -- Frais de retard
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(lease_id, month, year)
);
```

---

### 5. Modèle Économique

#### 5.1 Revenus AkwaHome

**Sources de revenus** :

1. **Abonnements mensuels propriétaires** :
   - 1 bien : 15 000 FCFA/mois
   - 2-5 biens : 12 000 FCFA/bien/mois
   - 6+ biens : 10 000 FCFA/bien/mois

2. **Frais d'agence** :
   - 1 mois de loyer (ou montant personnalisé par l'admin)
   - Payés par le locataire à la signature du bail
   - 100% des frais reviennent à AkwaHome

**Exemple de calcul** :
- Propriétaire avec 3 biens : 3 × 12 000 = 36 000 FCFA/mois
- Location d'un bien à 200 000 FCFA/mois : Frais d'agence = 200 000 FCFA (une fois)
- **Revenu total** : 36 000 FCFA/mois (abonnement) + 200 000 FCFA (frais d'agence)

---

#### 5.2 Coûts et Frais

**Pour le propriétaire** :
- Abonnement mensuel (voir tarifs ci-dessus)
- Pas de commission sur les loyers
- Visites gratuites (illimitées)

**Pour le locataire** :
- Frais d'agence : 1 mois de loyer (une fois à la signature)
- Loyer mensuel : Payé directement au propriétaire (via l'app ou hors app)
- Pas de frais supplémentaires

---

### 6. Architecture Technique

#### 6.1 Modifications Base de Données

**Nouvelles tables** :
1. `monthly_rental_subscriptions` : Abonnements des propriétaires
2. `visit_requests` : Demandes de visite
3. `monthly_rental_applications` : Demandes de location
4. `monthly_rental_leases` : Baux signés
5. `monthly_rental_payments` : Paiements de loyer

**Modifications tables existantes** :
1. `properties` :
   - Ajouter `rental_type` : `'short_term'` ou `'monthly'`
   - Ajouter `monthly_rent_price` : Prix mensuel (si location mensuelle)
   - Ajouter `security_deposit` : Caution
   - Ajouter `minimum_duration_months` : Durée minimale
   - Ajouter `charges_included` : Charges incluses ou non

2. `bookings` :
   - Utiliser uniquement pour location courte durée
   - Créer `monthly_rental_leases` pour location mensuelle

---

#### 6.2 Nouveaux Écrans Mobile

**Pour les locataires** :
- `MonthlyRentalListScreen` : Liste des biens en location mensuelle
- `MonthlyRentalDetailsScreen` : Détails d'un bien
- `RequestVisitModal` : Demander une visite
- `MyVisitRequestsScreen` : Mes demandes de visite
- `MonthlyRentalApplicationScreen` : Formulaire de demande
- `MyMonthlyRentalApplicationsScreen` : Mes demandes
- `MonthlyRentalLeaseScreen` : Signature du bail
- `MyMonthlyRentalsScreen` : Mes locations actives
- `MonthlyRentalPaymentScreen` : Paiement du loyer

**Pour les propriétaires** :
- `HostSubscriptionScreen` : Gestion de l'abonnement
- `HostVisitRequestsScreen` : Demandes de visite
- `HostMonthlyRentalApplicationsScreen` : Demandes de location
- `HostMonthlyRentalsScreen` : Locations actives
- `EditMonthlyRentalPropertyScreen` : Créer/modifier annonce mensuelle

**Pour l'admin** :
- `AdminMonthlyRentalSubscriptionsScreen` : Gestion des abonnements
- `AdminMonthlyRentalPropertiesScreen` : Validation des annonces
- `AdminMonthlyRentalLeasesScreen` : Suivi des baux

---

#### 6.3 Nouveaux Composants

- `MonthlyRentalPropertyCard` : Carte de bien en location mensuelle
- `VisitRequestForm` : Formulaire de demande de visite
- `LeaseDocumentViewer` : Visualiseur de bail PDF
- `SignaturePad` : Composant de signature électronique
- `SubscriptionStatusBadge` : Badge de statut d'abonnement
- `MonthlyRentalPaymentSchedule` : Calendrier de paiement

---

#### 6.4 Edge Functions Supabase

**Nouvelles fonctions** :
1. `create-monthly-subscription` : Créer un abonnement
2. `renew-monthly-subscription` : Renouveler automatiquement
3. `generate-lease-pdf` : Générer le PDF du bail
4. `process-agency-fee-payment` : Traiter le paiement des frais d'agence
5. `send-visit-request-notification` : Notifier une demande de visite
6. `send-lease-reminder` : Rappel de paiement de loyer

**Modifications fonctions existantes** :
- `send-email` : Ajouter les templates pour location mensuelle

---

### 7. Workflow Complet

#### 7.1 Workflow Propriétaire

```
1. S'inscrire comme propriétaire
2. Compléter la vérification d'identité
3. Souscrire à l'abonnement mensuel
4. Créer une annonce de location mensuelle
5. Attendre validation admin
6. Recevoir des demandes de visite
7. Confirmer/planifier les visites
8. Recevoir des demandes de location
9. Examiner les dossiers (documents, garant)
10. Accepter/Rejeter les demandes
11. Signature du bail (après acceptation)
12. Gérer la location active (suivi des paiements)
```

---

#### 7.2 Workflow Locataire

```
1. Rechercher un bien en location mensuelle
2. Consulter les détails
3. Demander une visite (optionnel mais recommandé)
4. Effectuer la visite
5. Faire une demande de location
6. Uploader les documents requis
7. Attendre la réponse du propriétaire
8. Si accepté : Payer les frais d'agence
9. Signer le bail électroniquement
10. Payer la caution + 1er mois de loyer
11. Emménager
12. Payer le loyer chaque mois
13. Gérer la location (maintenance, communication)
```

---

### 8. Règles Métier Détaillées

#### 8.1 Abonnement

- **Période d'essai** : 14 jours gratuits pour nouveaux propriétaires
- **Renouvellement** : Automatique si `auto_renew = true`
- **Suspension** : Si paiement échoue, 3 jours de grâce avant suspension
- **Annulation** : Possible à tout moment, pas de remboursement du mois en cours
- **Multi-propriétés** : Tarif dégressif selon le nombre de biens

---

#### 8.2 Visites

- **Gratuites** : Aucun frais pour le locataire
- **Limite** : Maximum 3 demandes par locataire et par bien
- **Délai de réponse** : 48h pour le propriétaire
- **Annulation** : Possible jusqu'à 24h avant la visite

---

#### 8.3 Demandes de Location

- **Durée de validité** : 7 jours (expire si pas de réponse)
- **Documents requis** : Pièce d'identité + justificatif de revenus
- **Garant** : Optionnel mais recommandé
- **Multiples demandes** : Le locataire peut faire plusieurs demandes

---

#### 8.4 Frais d'Agence

- **Montant** : 1 mois de loyer (ou montant personnalisé par l'admin)
- **Paiement** : Obligatoire avant signature du bail
- **Non remboursable** : Même en cas d'annulation après signature
- **Exception** : Remboursement si le propriétaire annule avant l'emménagement

---

#### 8.5 Bail et Location

- **Durée minimale** : 1 mois (30 jours)
- **Renouvellement** : Automatique ou renégociation
- **Résiliation** : Selon les termes du bail (préavis, etc.)
- **Paiement loyer** : Via l'app ou hors app (au choix)

---

### 9. Notifications

#### 9.1 Pour les Propriétaires

- Nouvelle demande de visite
- Nouvelle demande de location
- Expiration prochaine de l'abonnement (7j, 3j, 1j)
- Paiement d'abonnement réussi/échoué
- Signature du bail par le locataire
- Paiement de loyer reçu
- Demande de maintenance

---

#### 9.2 Pour les Locataires

- Confirmation de visite
- Réponse à la demande de location
- Demande de paiement des frais d'agence
- Bail prêt à signer
- Rappel de paiement de loyer (5 jours avant)
- Loyer payé (confirmation)
- Communication du propriétaire

---

### 10. Sécurité et Conformité

#### 10.1 Vérifications

- **Propriétaires** : Vérification d'identité obligatoire
- **Locataires** : Vérification d'identité + justificatifs de revenus
- **Documents** : Stockage sécurisé (Supabase Storage)
- **Baux** : Signature électronique avec horodatage

---

#### 10.2 Protection des Données

- **RGPD** : Conformité avec la protection des données
- **Documents** : Accès restreint (propriétaire, locataire, admin uniquement)
- **Paiements** : Conformité PCI-DSS (via Stripe/Wave)

---

### 11. Reporting et Analytics

#### 11.1 Pour AkwaHome

- Nombre d'abonnements actifs
- Revenus mensuels (abonnements + frais d'agence)
- Taux de conversion (visites → demandes → signatures)
- Durée moyenne des locations
- Taux de renouvellement des abonnements

---

#### 11.2 Pour les Propriétaires

- Nombre de visites demandées
- Nombre de demandes de location
- Taux de conversion
- Revenus générés (loyers)
- Statistiques de paiement

---

### 12. Phase de Développement

#### Phase 1 : Fondations (2 semaines)
- ✅ Modifications base de données
- ✅ Système d'abonnement (création, paiement)
- ✅ Création/modification d'annonces mensuelles
- ✅ Validation admin

#### Phase 2 : Visites (1 semaine)
- ✅ Système de demandes de visite
- ✅ Gestion côté propriétaire
- ✅ Notifications

#### Phase 3 : Demandes de Location (2 semaines)
- ✅ Formulaire de demande
- ✅ Upload de documents
- ✅ Traitement par le propriétaire
- ✅ Notifications

#### Phase 4 : Baux et Paiements (2 semaines)
- ✅ Génération de bail PDF
- ✅ Signature électronique
- ✅ Paiement des frais d'agence
- ✅ Gestion des locations actives

#### Phase 5 : Paiements de Loyer (1 semaine)
- ✅ Système de paiement mensuel
- ✅ Rappels automatiques
- ✅ Historique des paiements

#### Phase 6 : Tests et Optimisations (1 semaine)
- ✅ Tests end-to-end
- ✅ Corrections de bugs
- ✅ Optimisations performances

**Total estimé : 9 semaines**

---

### 13. Priorités et MVP

#### MVP (Minimum Viable Product)

**Fonctionnalités essentielles** :
1. ✅ Création d'annonces mensuelles
2. ✅ Abonnement mensuel (paiement manuel)
3. ✅ Demandes de visite (basique)
4. ✅ Demandes de location
5. ✅ Génération de bail (template simple)
6. ✅ Paiement des frais d'agence
7. ✅ Signature électronique

**Fonctionnalités à différer** :
- Paiement automatique de loyer (faire manuel d'abord)
- Renouvellement automatique d'abonnement
- Système de garantie avancé
- Reporting avancé

---

### 14. Questions et Points à Clarifier

1. **Frais d'agence** : Montant fixe (1 mois) ou personnalisable par bien ?
2. **Période d'essai** : 14 jours gratuits pour tous ou seulement nouveaux ?
3. **Garant** : Obligatoire ou optionnel ?
4. **Paiement loyer** : Via l'app obligatoire ou optionnel ?
5. **Commission sur loyers** : AkwaHome prend-il une commission sur les loyers mensuels ?
6. **Résiliation** : Conditions de résiliation du bail ?
7. **Maintenance** : Système de demande de maintenance à inclure ?
8. **État des lieux** : Gestion électronique de l'état des lieux ?

---

## 📝 Conclusion

Ce cahier des charges définit un système complet de location mensuelle avec :
- **Modèle économique clair** : Abonnement propriétaires + frais d'agence locataires
- **Processus structuré** : De la visite à la signature du bail
- **Fonctionnalités complètes** : Gestion des visites, demandes, baux, paiements
- **Architecture technique** : Tables, écrans, composants, fonctions

**Prochaines étapes** :
1. Valider le cahier des charges avec l'équipe
2. Clarifier les points ouverts
3. Commencer le développement Phase 1

---

**Document créé le** : 2025-02-08  
**Version** : 1.0  
**Auteur** : Équipe AkwaHome

