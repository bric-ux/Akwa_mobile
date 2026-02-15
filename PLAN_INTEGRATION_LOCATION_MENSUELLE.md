# 📋 Plan d'Intégration - Location Mensuelle

## 🎯 Objectif

Intégrer la fonctionnalité de location mensuelle dans l'application AkwaHome de manière progressive, sans impacter le fonctionnement existant de la location courte durée.

---

## 📊 Vue d'Ensemble de l'Architecture

### Séparation des Fonctionnalités

```
┌─────────────────────────────────────────┐
│     Location Courte Durée (Existant)    │
│  - Réservations par nuit                │
│  - Paiement avant arrivée                │
│  - Commission sur chaque réservation    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│     Location Mensuelle (Nouveau)        │
│  - Abonnement mensuel propriétaire      │
│  - Demandes de visite                   │
│  - Demandes de location                 │
│  - Frais d'agence                       │
│  - Baux signés hors plateforme          │
└─────────────────────────────────────────┘
```

**Principe** : Les deux systèmes coexistent sans se chevaucher.

---

## 🗂️ Structure des Fichiers à Créer

### 1. Base de Données (Migrations)

```
supabase/migrations/
  └── YYYYMMDDHHMMSS_monthly_rental_subscriptions.sql
  └── YYYYMMDDHHMMSS_visit_requests.sql
  └── YYYYMMDDHHMMSS_monthly_rental_applications.sql
  └── YYYYMMDDHHMMSS_monthly_rental_leases.sql
  └── YYYYMMDDHHMMSS_add_monthly_rental_fields_to_properties.sql
```

### 2. Types TypeScript

```
src/types/
  └── monthlyRental.ts          (Types pour location mensuelle)
```

### 3. Hooks

```
src/hooks/
  └── useMonthlyRentalSubscriptions.ts
  └── useVisitRequests.ts
  └── useMonthlyRentalApplications.ts
  └── useMonthlyRentalProperties.ts
```

### 4. Écrans Mobile

```
src/screens/
  └── MonthlyRentalListScreen.tsx          (Liste des biens mensuels)
  └── MonthlyRentalDetailsScreen.tsx        (Détails d'un bien)
  └── RequestVisitScreen.tsx                (Demander une visite)
  └── MyVisitRequestsScreen.tsx             (Mes demandes de visite)
  └── MonthlyRentalApplicationScreen.tsx     (Faire une demande)
  └── MyMonthlyRentalApplicationsScreen.tsx (Mes demandes)
  └── MonthlyRentalPaymentScreen.tsx         (Payer frais d'agence)
  └── HostSubscriptionScreen.tsx            (Gérer abonnement)
  └── HostVisitRequestsScreen.tsx            (Demandes de visite)
  └── HostMonthlyRentalApplicationsScreen.tsx (Demandes de location)
  └── HostMonthlyRentalsScreen.tsx           (Locations actives)
  └── AdminMonthlyRentalPropertiesScreen.tsx (Validation annonces)
  └── AdminMonthlyRentalSubscriptionsScreen.tsx (Gestion abonnements)
```

### 5. Composants

```
src/components/
  └── MonthlyRentalPropertyCard.tsx         (Carte de bien mensuel)
  └── VisitRequestForm.tsx                 (Formulaire visite)
  └── MonthlyRentalApplicationForm.tsx     (Formulaire demande)
  └── SubscriptionStatusBadge.tsx         (Badge statut abonnement)
  └── MonthlyRentalFilters.tsx              (Filtres recherche)
```

### 6. Services/Utils

```
src/services/
  └── monthlyRentalService.ts              (Logique métier)
  └── subscriptionService.ts               (Gestion abonnements)
```

### 7. Navigation

```
src/navigation/
  └── AppNavigator.tsx                     (Ajouter nouvelles routes)
```

---

## 🚀 Phases de Développement

### Phase 1 : Fondations Base de Données (Semaine 1)

**Objectif** : Créer toutes les tables nécessaires sans impacter l'existant.

**Étapes** :
1. ✅ Créer table `monthly_rental_subscriptions`
2. ✅ Créer table `visit_requests`
3. ✅ Créer table `monthly_rental_applications`
4. ✅ Créer table `monthly_rental_leases`
5. ✅ Ajouter colonnes à `properties` pour location mensuelle :
   - `rental_type` (ENUM: 'short_term', 'monthly')
   - `monthly_rent_price` (INTEGER, nullable)
   - `security_deposit` (INTEGER, nullable)
   - `minimum_duration_months` (INTEGER, nullable)
   - `charges_included` (BOOLEAN, default false)
   - `is_monthly_rental` (BOOLEAN, default false)

**Important** : Toutes les nouvelles colonnes sont `nullable` pour ne pas casser l'existant.

---

### Phase 2 : Types et Services (Semaine 1-2)

**Objectif** : Créer les types TypeScript et services de base.

**Étapes** :
1. ✅ Créer `src/types/monthlyRental.ts` avec tous les types
2. ✅ Créer `src/services/monthlyRentalService.ts`
3. ✅ Créer `src/services/subscriptionService.ts`
4. ✅ Créer les hooks de base :
   - `useMonthlyRentalSubscriptions.ts`
   - `useVisitRequests.ts`
   - `useMonthlyRentalApplications.ts`
   - `useMonthlyRentalProperties.ts`

**Tests** : Vérifier que les hooks fonctionnent avec des données de test.

---

### Phase 3 : Abonnement Propriétaire (Semaine 2)

**Objectif** : Permettre aux propriétaires de souscrire à un abonnement.

**Écrans à créer** :
1. ✅ `HostSubscriptionScreen.tsx`
   - Voir statut abonnement
   - Souscrire à un abonnement
   - Voir historique des paiements
   - Gérer le renouvellement

**Fonctionnalités** :
- Calcul automatique du tarif selon nombre de biens
- Paiement via Wave/Mobile Money/Carte
- Génération de facture PDF
- Notifications d'expiration

**Intégration** :
- Ajouter un onglet "Abonnement" dans `HostAccountScreen.tsx`
- Ajouter la route dans `AppNavigator.tsx`

---

### Phase 4 : Création d'Annonces Mensuelles (Semaine 3)

**Objectif** : Permettre aux propriétaires de créer des annonces mensuelles.

**Modifications** :
1. ✅ Modifier `EditPropertyScreen.tsx` :
   - Ajouter un sélecteur "Type de location" (Courte durée / Mensuelle)
   - Afficher conditionnellement les champs selon le type
   - Si "Mensuelle" : afficher champs spécifiques (prix mensuel, caution, etc.)

2. ✅ Créer logique de validation :
   - Vérifier que l'abonnement est actif
   - Valider les champs obligatoires
   - Soumettre pour validation admin

**Fonctionnalités** :
- Toggle entre location courte durée et mensuelle
- Champs spécifiques à la location mensuelle
- Validation admin obligatoire

---

### Phase 5 : Recherche et Affichage (Semaine 3-4)

**Objectif** : Permettre aux locataires de rechercher et voir les biens mensuels.

**Modifications** :
1. ✅ Modifier `HomeScreen.tsx` :
   - Ajouter un onglet/filtre "Location mensuelle"
   - Filtrer les propriétés avec `is_monthly_rental = true`

2. ✅ Modifier `SearchScreen.tsx` :
   - Ajouter filtre "Type de location" (Courte durée / Mensuelle)
   - Filtrer selon le type sélectionné

3. ✅ Créer `MonthlyRentalListScreen.tsx` :
   - Liste dédiée aux biens mensuels
   - Utiliser `MonthlyRentalPropertyCard.tsx`

4. ✅ Créer `MonthlyRentalDetailsScreen.tsx` :
   - Afficher détails d'un bien mensuel
   - Boutons : "Demander une visite", "Faire une demande"
   - Différencier de `PropertyDetailsScreen.tsx` (courte durée)

**Navigation** :
- Ajouter route "MonthlyRentalList" dans `AppNavigator.tsx`
- Ajouter route "MonthlyRentalDetails" dans `AppNavigator.tsx`

---

### Phase 6 : Demandes de Visite (Semaine 4-5)

**Objectif** : Système de demandes de visite gratuit.

**Écrans à créer** :
1. ✅ `RequestVisitScreen.tsx` :
   - Formulaire de demande
   - 3 créneaux proposés
   - Message optionnel

2. ✅ `MyVisitRequestsScreen.tsx` (Locataire) :
   - Liste des demandes
   - Statuts : En attente, Confirmée, Annulée, Complétée

3. ✅ `HostVisitRequestsScreen.tsx` (Propriétaire) :
   - Liste des demandes reçues
   - Actions : Confirmer, Proposer autre date, Refuser
   - Calendrier des visites

**Fonctionnalités** :
- Notifications pour nouvelles demandes
- Notifications de confirmation
- Limite de 3 demandes par bien et par locataire

**Intégration** :
- Bouton "Demander une visite" dans `MonthlyRentalDetailsScreen.tsx`
- Ajouter routes dans `AppNavigator.tsx`

---

### Phase 7 : Demandes de Location (Semaine 5-6)

**Objectif** : Permettre aux locataires de faire des demandes avec documents.

**Écrans à créer** :
1. ✅ `MonthlyRentalApplicationScreen.tsx` :
   - Formulaire complet
   - Upload documents (pièce d'identité, justificatifs)
   - Informations garant (optionnel)
   - Date de début souhaitée
   - Durée souhaitée

2. ✅ `MyMonthlyRentalApplicationsScreen.tsx` (Locataire) :
   - Liste des demandes
   - Statuts : En attente, Acceptée, Rejetée, Expirée

3. ✅ `HostMonthlyRentalApplicationsScreen.tsx` (Propriétaire) :
   - Liste des demandes reçues
   - Voir documents du locataire
   - Actions : Accepter, Rejeter, Demander infos

**Fonctionnalités** :
- Upload sécurisé de documents (Supabase Storage)
- Expiration automatique après 7 jours
- Notifications pour chaque changement de statut

**Intégration** :
- Bouton "Faire une demande" dans `MonthlyRentalDetailsScreen.tsx`
- Ajouter routes dans `AppNavigator.tsx`

---

### Phase 8 : Paiement Frais d'Agence (Semaine 6-7)

**Objectif** : Paiement des frais d'agence après acceptation.

**Écrans à créer** :
1. ✅ `MonthlyRentalPaymentScreen.tsx` :
   - Affichage du montant (1 mois de loyer)
   - Sélection méthode de paiement
   - Processus de paiement
   - Génération reçu PDF

**Fonctionnalités** :
- Intégration avec système de paiement existant (Wave/Mobile Money)
- Génération automatique de reçu
- Mise en contact après paiement
- Notifications

**Intégration** :
- Appelé depuis `MyMonthlyRentalApplicationsScreen.tsx` quand demande acceptée
- Utiliser le système de paiement existant (`usePayments.ts`)

---

### Phase 9 : Validation Admin (Semaine 7)

**Objectif** : Permettre à l'admin de valider les annonces mensuelles.

**Modifications** :
1. ✅ Modifier `AdminPropertiesScreen.tsx` :
   - Ajouter filtre "Type" (Courte durée / Mensuelle)
   - Afficher statut "En attente" pour annonces mensuelles
   - Actions : Valider, Rejeter avec commentaires

2. ✅ Créer `AdminMonthlyRentalPropertiesScreen.tsx` (optionnel) :
   - Vue dédiée aux annonces mensuelles
   - Liste des annonces en attente
   - Validation avec commentaires

**Fonctionnalités** :
- Notification au propriétaire après validation/rejet
- Possibilité de corriger et resoumettre

---

### Phase 10 : Gestion Abonnements Admin (Semaine 7-8)

**Objectif** : Permettre à l'admin de gérer les abonnements.

**Écrans à créer** :
1. ✅ `AdminMonthlyRentalSubscriptionsScreen.tsx` :
   - Liste des abonnements actifs/suspendus/expirés
   - Actions : Suspendre, Réactiver, Voir historique
   - Statistiques : Revenus mensuels, nombre d'abonnements

**Fonctionnalités** :
- Vue d'ensemble des abonnements
- Rapports de revenus
- Gestion des suspensions

**Intégration** :
- Ajouter dans le menu admin
- Route dans `AppNavigator.tsx`

---

### Phase 11 : Locations Actives (Semaine 8)

**Objectif** : Suivi des locations actives (après signature bail hors plateforme).

**Écrans à créer** :
1. ✅ `MyMonthlyRentalsScreen.tsx` (Locataire) :
   - Liste des locations actives
   - Informations du bail
   - Communication avec propriétaire

2. ✅ `HostMonthlyRentalsScreen.tsx` (Propriétaire) :
   - Liste des locations actives
   - Informations des locataires
   - Communication

**Fonctionnalités** :
- Affichage des informations de location
- Messagerie intégrée
- Demandes de maintenance (optionnel)

**Note** : Les paiements de loyer se font hors plateforme, donc pas de gestion de paiement ici.

---

### Phase 12 : Notifications (Semaine 8-9)

**Objectif** : Ajouter toutes les notifications nécessaires.

**Notifications à créer** :
- Nouvelle demande de visite (propriétaire)
- Confirmation de visite (locataire)
- Nouvelle demande de location (propriétaire)
- Réponse à demande (locataire)
- Expiration abonnement (propriétaire)
- Frais d'agence payés (propriétaire et locataire)
- Rappels de paiement frais d'agence (locataire)

**Intégration** :
- Utiliser le système de notifications existant
- Ajouter les nouveaux types de notifications

---

### Phase 13 : Tests et Optimisations (Semaine 9)

**Objectif** : Tests complets et corrections.

**Étapes** :
1. ✅ Tests end-to-end de tous les workflows
2. ✅ Tests de paiement
3. ✅ Tests de notifications
4. ✅ Vérification de la séparation avec location courte durée
5. ✅ Optimisations de performance
6. ✅ Corrections de bugs

---

## 🔗 Points d'Intégration avec l'Existant

### 1. Système de Paiement

**Réutilisation** :
- `usePayments.ts` : Pour paiement frais d'agence
- Système Wave/Mobile Money existant
- Génération de reçus PDF

**Nouveau** :
- Type de paiement "agency_fee" à ajouter
- Logique spécifique pour frais d'agence

---

### 2. Système de Notifications

**Réutilisation** :
- Infrastructure de notifications existante
- Templates d'emails existants

**Nouveau** :
- Nouveaux types de notifications
- Nouveaux templates d'emails

---

### 3. Système de Messagerie

**Réutilisation** :
- `MessagingScreen.tsx` existant
- Infrastructure de messagerie

**Nouveau** :
- Utilisation pour communication propriétaire/locataire après paiement frais d'agence

---

### 4. Système d'Upload de Documents

**Réutilisation** :
- Supabase Storage existant
- Système d'upload de photos

**Nouveau** :
- Upload de documents (pièce d'identité, justificatifs)
- Gestion des permissions d'accès

---

### 5. Navigation

**Modifications** :
- Ajouter nouvelles routes dans `AppNavigator.tsx`
- Ajouter liens dans les menus existants :
  - `HostAccountScreen.tsx` : Lien vers abonnement
  - `HomeScreen.tsx` : Onglet "Location mensuelle"
  - `SearchScreen.tsx` : Filtre type de location

---

## 🛡️ Sécurité et Validation

### Règles à Implémenter

1. **Abonnement actif requis** :
   - Vérifier que l'abonnement est actif avant de créer une annonce
   - Masquer les annonces si abonnement expiré

2. **Validation admin** :
   - Toutes les annonces mensuelles doivent être validées
   - Pas de publication automatique

3. **Limites** :
   - Maximum 3 demandes de visite par bien et par locataire
   - Expiration des demandes après 7 jours

4. **Permissions** :
   - Seuls les propriétaires avec abonnement peuvent créer des annonces mensuelles
   - Seuls les locataires vérifiés peuvent faire des demandes
   - Admin seul peut valider les annonces

---

## 📝 Checklist de Développement

### Phase 1 : Base de Données
- [ ] Migration subscriptions
- [ ] Migration visit_requests
- [ ] Migration applications
- [ ] Migration leases
- [ ] Migration colonnes properties

### Phase 2 : Types et Services
- [ ] Types TypeScript
- [ ] Services de base
- [ ] Hooks de base

### Phase 3 : Abonnement
- [ ] Écran abonnement propriétaire
- [ ] Logique de paiement
- [ ] Génération factures

### Phase 4 : Création Annonces
- [ ] Modification EditPropertyScreen
- [ ] Validation admin
- [ ] Logique de soumission

### Phase 5 : Recherche
- [ ] Liste biens mensuels
- [ ] Détails bien mensuel
- [ ] Filtres recherche

### Phase 6 : Visites
- [ ] Demande de visite
- [ ] Gestion côté propriétaire
- [ ] Gestion côté locataire

### Phase 7 : Demandes Location
- [ ] Formulaire demande
- [ ] Upload documents
- [ ] Traitement propriétaire

### Phase 8 : Paiement
- [ ] Écran paiement frais d'agence
- [ ] Intégration paiement
- [ ] Génération reçu

### Phase 9 : Validation Admin
- [ ] Écran validation
- [ ] Actions admin

### Phase 10 : Gestion Abonnements Admin
- [ ] Écran gestion abonnements
- [ ] Statistiques

### Phase 11 : Locations Actives
- [ ] Écran locataire
- [ ] Écran propriétaire

### Phase 12 : Notifications
- [ ] Toutes les notifications
- [ ] Templates emails

### Phase 13 : Tests
- [ ] Tests complets
- [ ] Corrections bugs

---

## 🎯 Principes de Développement

### 1. Non-Régression
- Ne jamais modifier le code existant de location courte durée
- Tester que la location courte durée fonctionne toujours après chaque modification

### 2. Séparation Claire
- Code séparé pour location mensuelle
- Pas de mélange avec location courte durée
- Fichiers dédiés quand possible

### 3. Réutilisation
- Réutiliser les systèmes existants (paiement, notifications, messagerie)
- Éviter la duplication de code

### 4. Progressive Enhancement
- Développer phase par phase
- Tester chaque phase avant de passer à la suivante
- Possibilité de désactiver la fonctionnalité si problème

---

## 📊 Ordre de Priorité

### MVP (Minimum Viable Product)
1. ✅ Abonnement propriétaire
2. ✅ Création annonces mensuelles
3. ✅ Recherche et affichage
4. ✅ Demandes de visite
5. ✅ Demandes de location
6. ✅ Paiement frais d'agence
7. ✅ Validation admin

### Phase 2 (Après MVP)
- Gestion abonnements admin
- Locations actives
- Notifications avancées
- Statistiques

---

**Document créé le** : 2025-02-08  
**Version** : 1.0

