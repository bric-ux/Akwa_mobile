# 📧 Analyse des déclencheurs d'emails sur le site web

## 🔍 Moments d'envoi d'emails identifiés

### 1. **Inscription d'utilisateur** (`AuthContext.tsx` + `AuthPage.tsx`)
- **Déclencheur** : `signUp()` réussi
- **Email envoyé** : `welcome` 
- **Destinataire** : Nouvel utilisateur
- **Données** : `{ firstName }`
- **Moment** : Immédiatement après création du compte

### 2. **Candidature hôte** (`useHostApplications.ts`)
- **Déclencheur** : Soumission de candidature hôte
- **Emails envoyés** :
  - `host_application_submitted` → Candidat
  - `host_application_received` → Admins
- **Moment** : Après insertion en base de données

### 3. **Réservation créée** (`useBookings.ts`)
- **Déclencheur** : Création de réservation
- **Emails envoyés** :
  - `booking_request` → Hôte
  - `booking_request_sent` → Voyageur
- **Moment** : Après insertion de la réservation

### 4. **Changement de statut réservation** (`useMyBookings.ts`)
- **Déclencheur** : Confirmation/Annulation de réservation
- **Emails envoyés** :
  - `booking_confirmed` / `booking_cancelled` → Voyageur
  - `booking_confirmed_host` / `booking_cancelled_host` → Hôte
- **Moment** : Après mise à jour du statut

### 5. **Génération PDF réservation** (`useBookingPDF.ts`)
- **Déclencheur** : Confirmation de réservation avec PDF
- **Email envoyé** : `booking_confirmed` avec PDF en pièce jointe
- **Destinataire** : Voyageur
- **Moment** : Après génération du PDF

### 6. **Réinitialisation mot de passe** (Edge Function)
- **Déclencheur** : Demande de reset password
- **Email envoyé** : `password_reset`
- **Destinataire** : Utilisateur demandeur
- **Moment** : Via `supabase.auth.resetPasswordForEmail()`

## 📋 Types d'emails supportés

```typescript
type EmailType = 
  | 'welcome'                    // Inscription
  | 'email_confirmation'         // Confirmation email
  | 'booking_request'            // Demande de réservation → Hôte
  | 'booking_request_sent'       // Demande de réservation → Voyageur
  | 'booking_response'           // Réponse à réservation
  | 'booking_confirmed'          // Réservation confirmée → Voyageur
  | 'booking_confirmed_host'     // Réservation confirmée → Hôte
  | 'booking_cancelled'          // Réservation annulée → Voyageur
  | 'booking_cancelled_host'     // Réservation annulée → Hôte
  | 'booking_completed'          // Séjour terminé → Voyageur
  | 'booking_completed_host'     // Séjour terminé → Hôte
  | 'password_reset'             // Reset mot de passe
  | 'new_message'                // Nouveau message
  | 'host_application_submitted' // Candidature soumise → Candidat
  | 'host_application_received'  // Candidature reçue → Admin
  | 'host_application_approved'  // Candidature approuvée → Candidat
```

## 🔧 Implémentation technique

### Service d'email
- **Fonction Supabase** : `send-email`
- **API** : Resend
- **Templates** : HTML intégrés dans la fonction
- **Pièces jointes** : Support PDF

### Gestion d'erreurs
- **Try/catch** autour de chaque envoi
- **Logs** des erreurs mais pas de blocage
- **Continuité** du processus même si email échoue

## 🎯 Points clés pour l'app mobile

1. **Inscription** : Email de bienvenue automatique
2. **Réservations** : Emails bidirectionnels hôte/voyageur
3. **Candidatures** : Notifications admin + candidat
4. **Messages** : Notifications de nouveaux messages
5. **Reset password** : Via fonction native Supabase

## ✅ État de l'implémentation mobile

- ✅ Emails de candidature hôte
- ✅ Emails de réservation
- ✅ Email de bienvenue (à implémenter)
- ✅ Email de reset password (à implémenter)
- ❌ Emails de messages (à implémenter)
- ❌ Emails de changement de statut (à implémenter)

