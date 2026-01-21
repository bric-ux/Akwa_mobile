# 📧 Inventaire des Emails Manquants - AkwaHome Mobile

Ce document liste tous les endroits où des emails devraient être envoyés mais ne le sont pas actuellement.

## ✅ Emails Déjà Implémentés

### Authentification
- ✅ Email de bienvenue lors de l'inscription (`AuthContext.tsx`)
- ✅ Email de réinitialisation de mot de passe (`reset-password` function)

### Réservations de Propriétés
- ✅ Email de demande de réservation à l'hôte (`useBookings.ts` - `sendBookingRequest`)
- ✅ Email de confirmation de demande au voyageur (`useBookings.ts` - `sendBookingRequestSent`)
- ✅ Email d'annulation au voyageur (`useBookingCancellation.ts` - `booking_cancelled_guest`)
- ✅ Email d'annulation à l'hôte (`useBookingCancellation.ts` - `booking_cancelled_host`)

### Réservations de Véhicules
- ✅ Email de demande/confirmation au locataire (`useVehicleBookings.ts`)
- ✅ Email de demande/confirmation au propriétaire (`useVehicleBookings.ts`)
- ✅ Email d'annulation (`VehicleCancellationModal.tsx`)
- ✅ Email de confirmation de modification (`useVehicleBookingModifications.ts`)

### Messagerie
- ✅ Email de notification de nouveau message (`useMessaging.ts` - `sendNewMessage`)

### Candidatures Hôte
- ✅ Email d'approbation de candidature (`useAdmin.ts` - `host_application_approved`)
- ❌ Email de soumission de candidature (voir section 2.3)

---

## ❌ Emails Manquants

### 1. Réservations de Propriétés

#### 1.1. Confirmation de Réservation
**Fichier**: `src/hooks/useBookings.ts`
**Fonction**: `createBooking` (ligne 92)
**Problème**: Quand une réservation est créée avec `auto_booking: true`, elle est directement confirmée mais aucun email de confirmation n'est envoyé.

**Action requise**: 
- Envoyer `booking_confirmed` au voyageur
- Envoyer `booking_confirmed_host` à l'hôte
- Inclure le PDF de facture si disponible

**Code actuel** (lignes 255-307):
```typescript
// Envoie seulement booking_request et booking_request_sent
// Manque: booking_confirmed et booking_confirmed_host pour auto_booking
```

---

#### 1.2. Confirmation Manuelle par l'Hôte
**Fichier**: `src/hooks/useHostBookings.ts`
**Fonction**: `updateBookingStatus` (ligne 159)
**Statut**: ✅ **DÉJÀ IMPLÉMENTÉ**
**Note**: Les emails sont bien envoyés lors de la confirmation manuelle (lignes 285-400)

---

#### 1.3. Réservation Terminée (Completed)
**Fichier**: `src/hooks/useBookings.ts`
**Fonction**: `updateBookingStatuses` (ligne 381)
**Problème**: Quand une réservation passe automatiquement à "completed", aucun email n'est envoyé.

**Action requise**:
- Envoyer un email de rappel au voyageur pour laisser un avis
- Envoyer un email de rappel à l'hôte pour laisser un avis sur le voyageur
- Suggérer de laisser une évaluation

---

#### 1.4. Rejet de Réservation par l'Hôte
**Fichier**: `src/hooks/useHostBookings.ts`
**Fonction**: `updateBookingStatus` (ligne 159)
**Statut**: ⚠️ **PARTIELLEMENT IMPLÉMENTÉ**
**Problème**: Quand un hôte rejette une demande de réservation (status: 'cancelled' sur une réservation 'pending'), un email est envoyé mais il utilise le type `booking_response` avec status 'cancelled' (ligne 454). Il faudrait peut-être un type d'email spécifique pour le rejet vs l'annulation.

**Code actuel** (ligne 452-477):
```typescript
// Envoie booking_response avec status 'cancelled'
// Mais pas de distinction entre rejet et annulation
```

**Action requise**:
- Vérifier si un type d'email spécifique `booking_rejected` existe
- Si oui, l'utiliser pour les rejets de demandes en attente
- Si non, créer ce type d'email pour distinguer rejet vs annulation

---

### 2. Candidatures Hôte

#### 2.1. Rejet de Candidature
**Fichier**: `src/hooks/useAdmin.ts`
**Fonction**: `updateApplicationStatus` (ligne 58)
**Problème**: Quand une candidature est rejetée, aucun email n'est envoyé (contrairement à la version web qui l'envoie).

**Code actuel** (ligne 137-289):
```typescript
// Envoie seulement l'email d'approbation
// Manque: email de rejet (application_rejected)
```

**Action requise**:
- Ajouter l'envoi d'email `application_rejected` avec la raison du rejet
- Vérifier que le statut 'rejected' déclenche bien l'envoi d'email

---

#### 2.2. Demande de Révision
**Fichier**: `src/hooks/useAdmin.ts`
**Fonction**: `updateApplicationStatus` (ligne 58)
**Statut**: ⚠️ **À VÉRIFIER**
**Problème**: Un email est envoyé (ligne 133) mais il faut vérifier s'il est bien implémenté dans la version mobile.

**Action requise**:
- Vérifier que l'email `host_application_revision_requested` est bien envoyé
- S'assurer que les champs à réviser sont inclus dans l'email

---

#### 2.3. Soumission de Candidature
**Fichier**: `src/hooks/useHostApplications.ts`
**Fonction**: `submitApplication` (ligne 82)
**Problème**: Quand un utilisateur soumet une candidature, aucun email de confirmation n'est envoyé à l'utilisateur.

**Code actuel** (ligne 82-190):
```typescript
// Crée la candidature mais n'envoie pas d'email de confirmation
```

**Action requise**:
- Envoyer un email de confirmation à l'utilisateur (`host_application_submitted`)
- Envoyer un email de notification aux administrateurs (`admin_new_host_application`)

---

### 3. Avis/Reviews

#### 3.1. Nouvel Avis sur une Propriété
**Fichier**: `src/hooks/useReviews.ts`
**Fonction**: `submitReview` (ligne 117)
**Problème**: Quand un voyageur laisse un avis sur une propriété, l'hôte n'est pas notifié par email.

**Action requise**:
- Envoyer un email à l'hôte avec le contenu de l'avis
- Type d'email: `new_property_review` ou `property_review_received`

---

#### 3.2. Nouvel Avis sur un Voyageur
**Fichier**: `src/hooks/useGuestReviews.ts`
**Fonction**: `submitGuestReview`
**Problème**: Quand un hôte laisse un avis sur un voyageur, le voyageur n'est pas notifié par email.

**Action requise**:
- Envoyer un email au voyageur avec le contenu de l'avis
- Type d'email: `new_guest_review` ou `guest_review_received`

---

#### 3.3. Nouvel Avis sur un Véhicule
**Fichier**: `src/hooks/useVehicleReviews.ts`
**Fonction**: `createReview`
**Problème**: Quand un locataire laisse un avis sur un véhicule, le propriétaire n'est pas notifié.

**Action requise**:
- Envoyer un email au propriétaire du véhicule
- Type d'email: `new_vehicle_review`

---

#### 3.4. Nouvel Avis sur un Locataire
**Fichier**: `src/hooks/useVehicleRenterReviews.ts`
**Fonction**: `createReview`
**Problème**: Quand un propriétaire laisse un avis sur un locataire, le locataire n'est pas notifié.

**Action requise**:
- Envoyer un email au locataire
- Type d'email: `new_renter_review`

---

### 4. Modifications de Réservation

#### 4.1. Modification de Réservation de Propriété
**Fichier**: Fonction manquante
**Problème**: Il n'existe pas de système de modification de réservation pour les propriétés (contrairement aux véhicules).

**Action requise**:
- Créer un système de modification de réservation
- Envoyer `booking_modification_request` à l'hôte
- Envoyer `booking_modification_requested` au voyageur
- Envoyer `booking_modification_approved` ou `booking_modification_rejected` selon la réponse

---

### 5. Authentification

#### 5.1. Confirmation de Changement de Mot de Passe
**Fichier**: `src/screens/SettingsScreen.tsx`
**Fonction**: `handlePasswordReset` (ligne 114)
**Problème**: Quand un utilisateur change son mot de passe avec succès, aucun email de confirmation n'est envoyé.

**Action requise**:
- Envoyer un email de confirmation après changement de mot de passe réussi
- Type d'email: `password_changed` ou `password_change_confirmation`
- Inclure la date/heure du changement et l'adresse IP si disponible

---

#### 5.2. Changement d'Email
**Fichier**: Fonction manquante
**Problème**: Il n'existe pas de fonctionnalité pour changer l'email, mais si elle est ajoutée, un email de confirmation devrait être envoyé.

**Action requise**:
- Créer une fonctionnalité de changement d'email
- Envoyer un email de confirmation à l'ancienne adresse
- Envoyer un email de confirmation à la nouvelle adresse
- Demander confirmation avant le changement

---

### 6. Notifications Administrateur

#### 6.1. Nouvelle Réservation (pour Admin)
**Fichier**: `src/hooks/useBookings.ts`
**Fonction**: `createBooking` (ligne 92)
**Problème**: Les administrateurs ne sont pas notifiés des nouvelles réservations.

**Action requise**:
- Envoyer un email aux administrateurs pour chaque nouvelle réservation
- Type d'email: `admin_new_booking`
- Inclure les détails de la réservation

---

#### 6.2. Nouvelle Candidature Hôte (pour Admin)
**Fichier**: `src/hooks/useHostApplications.ts`
**Fonction**: `submitApplication`
**Problème**: Les administrateurs ne sont pas notifiés des nouvelles candidatures.

**Action requise**:
- Envoyer un email aux administrateurs pour chaque nouvelle candidature
- Type d'email: `admin_new_host_application`
- Inclure les détails de la candidature

---

#### 6.3. Annulation de Réservation (pour Admin)
**Fichier**: `src/hooks/useBookingCancellation.ts`
**Fonction**: `cancelBooking` (ligne 121)
**Problème**: Les administrateurs ne sont pas notifiés des annulations.

**Action requise**:
- Envoyer un email aux administrateurs pour chaque annulation
- Type d'email: `admin_booking_cancelled`
- Inclure les détails de l'annulation et la raison

---

### 7. Rappels et Notifications

#### 7.1. Rappel de Check-in (24h avant)
**Fichier**: Fonction manquante (cron job ou trigger)
**Problème**: Aucun rappel n'est envoyé aux voyageurs avant leur arrivée.

**Action requise**:
- Créer un système de rappels automatiques
- Envoyer un email 24h avant le check-in
- Type d'email: `check_in_reminder`
- Inclure les détails de la propriété et les instructions

---

#### 7.2. Rappel de Check-out (jour J)
**Fichier**: Fonction manquante (cron job ou trigger)
**Problème**: Aucun rappel n'est envoyé aux voyageurs le jour du check-out.

**Action requise**:
- Envoyer un email le jour du check-out
- Type d'email: `check_out_reminder`
- Inclure les instructions de départ

---

#### 7.3. Rappel pour Laisser un Avis (après check-out)
**Fichier**: Fonction manquante (cron job ou trigger)
**Problème**: Aucun rappel n'est envoyé pour encourager les avis après le séjour.

**Action requise**:
- Envoyer un email 1-2 jours après le check-out
- Type d'email: `review_reminder`
- Inclure un lien direct pour laisser un avis

---

### 8. Véhicules

#### 8.1. Rappel de Récupération de Véhicule
**Fichier**: Fonction manquante (cron job ou trigger)
**Problème**: Aucun rappel n'est envoyé avant la récupération du véhicule.

**Action requise**:
- Envoyer un email 24h avant le début de la location
- Type d'email: `vehicle_pickup_reminder`
- Inclure les détails du véhicule et le lieu de récupération

---

#### 8.2. Rappel de Retour de Véhicule
**Fichier**: Fonction manquante (cron job ou trigger)
**Problème**: Aucun rappel n'est envoyé avant le retour du véhicule.

**Action requise**:
- Envoyer un email 24h avant la fin de la location
- Type d'email: `vehicle_return_reminder`
- Inclure les instructions de retour

---

## 📊 Résumé par Priorité

### 🔴 Priorité Haute (Impact Utilisateur Élevé)
1. Confirmation de réservation (auto_booking) - **Section 1.1**
2. ~~Confirmation manuelle par l'hôte~~ ✅ **DÉJÀ IMPLÉMENTÉ**
3. Rejet de réservation par l'hôte - **Section 1.4**
4. Rejet de candidature hôte - **Section 2.1**
5. Nouvel avis sur propriété/voyageur - **Section 3**
6. Soumission de candidature (confirmation) - **Section 2.3**

### 🟡 Priorité Moyenne (Amélioration UX)
6. Réservation terminée (rappel avis)
7. Changement de mot de passe confirmé
8. Rappels check-in/check-out
9. Rappel pour laisser un avis

### 🟢 Priorité Basse (Nice to Have)
10. Notifications admin
11. Rappels véhicules
12. Changement d'email

---

## 📝 Notes Techniques

- Tous les emails doivent utiliser le service `useEmailService` ou `supabase.functions.invoke('send-email')`
- Les emails doivent être envoyés de manière asynchrone et ne pas bloquer les opérations principales
- En cas d'erreur d'envoi d'email, logger l'erreur mais ne pas faire échouer l'opération
- Vérifier que les templates d'email existent dans `supabase/functions/send-email/index.ts`
- Ajouter les nouveaux types d'email dans `useEmailService.ts` si nécessaire

---

**Date de création**: 2025-01-27
**Dernière mise à jour**: 2025-01-27

