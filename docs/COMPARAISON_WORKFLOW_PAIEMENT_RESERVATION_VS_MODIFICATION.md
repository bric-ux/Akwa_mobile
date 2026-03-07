# Comparaison : workflow paiement et vérification

## Réservation initiale vs modification de réservation (surplus par carte)

---

## 1. Réservation initiale (logement – BookingModal)

### Création de la session
- **Qui** : `BookingModal` (paiement carte).
- **Comment** : `createCheckoutSession` avec **checkout_token** (UUID généré côté client), **pas de booking_id**.
- **Backend** : `create-checkout-session` détecte le **flux draft** (`checkout_token` + pas de `booking_id` + `payment_type: booking`).
  - Insert dans `stripe_checkout_drafts` avec un `session_id` temporaire.
  - Création de la session Stripe.
  - Mise à jour du draft avec le vrai `session_id` Stripe.
- **Réservation en base** : **aucune** avant paiement. La résa est créée **uniquement dans le webhook** après `checkout.session.completed`.

### URL de succès Stripe (redirect)
- `akwahomemobile://payment-success?checkout_token=xxx&booking_type=property&session_id={CHECKOUT_SESSION_ID}`

### Vérification du paiement
- **Où** : dans le **même écran** (BookingModal) :
  - **Polling** : `setInterval(verifyStripePaymentNow, 2000)` tant que le modal est ouvert avec un pending (checkout_token ou booking_id).
  - **Retour app** : `AppState` `active` après `background`/`inactive` → `verifyStripePaymentNow()` immédiat + une fois après 2 s.
  - **Bouton** : « Vérifier le paiement » appelle `verifyStripePaymentNow`.
- **Paramètres envoyés à** `check-payment-status` :
  - `booking_type: 'property'`
  - `checkout_token` (pas de `booking_id` tant que la résa n’existe pas).
- **Backend** : avec `checkout_token` seul, il résout le `booking_id` via la table `bookings` (`stripe_checkout_token = checkout_token`) **une fois la résa créée par le webhook**. Pas de `payment_type` ni `stripe_session_id` → branche « résa classique » (dernier paiement pour ce booking).

### Résumé résa initiale logement
| Étape | Acteur | Donnée clé |
|-------|--------|------------|
| Ouverture Stripe | BookingModal | `checkout_token` |
| Pas de résa avant paiement | Backend | Draft dans `stripe_checkout_drafts` |
| Après paiement | Webhook | Crée `bookings` + `payments`, supprime draft |
| Vérification | BookingModal (poll + AppState) | `checkout_token` → backend résout `booking_id` |

---

## 2. Réservation initiale (véhicule – VehicleBookingScreen / useVehicleBookings)

### Création de la session
- **Qui** : `useVehicleBookings.createBooking` (paiement carte).
- **Comment** : même idée que logement : **flux draft** avec `checkout_token`, pas de `booking_id`, payload complet (dates, véhicule, etc.).
- **Backend** : draft dans `stripe_checkout_drafts`, puis webhook crée `vehicle_bookings` + `vehicle_payments`.

### URL de succès
- `akwahomemobile://payment-success?checkout_token=xxx&booking_type=vehicle&session_id={CHECKOUT_SESSION_ID}`

### Vérification
- **Où** : dans **VehicleBookingScreen** (polling + AppState + bouton), comme BookingModal.
- **Paramètres** : `booking_type: 'vehicle'`, `checkout_token` (ou `booking_id` une fois résolu).
- **Backend** : résolution par `stripe_checkout_token` sur `vehicle_bookings`, puis dernier paiement.

---

## 3. Modification de réservation avec surplus (logement – ModificationSurplusPaymentModal)

### Création de la session
- **Qui** : `ModificationSurplusPaymentModal` (bouton Payer avec carte).
- **Comment** : `createCheckoutSession` avec **booking_id** (résa existante), **amount** (surplus), **modification_request** (payload complet de la demande).
- **Backend** : `create-checkout-session` détecte **modification_surplus** (`payment_type: modification_surplus`).
  - **Pas** de draft dans `stripe_checkout_drafts` (ce n’est pas une résa initiale).
  - Insert dans **modification_surplus_drafts** (session_id temporaire, puis mis à jour avec le vrai session_id Stripe).
  - Pas d’insert dans `payments` avant paiement (le paiement est créé dans le webhook).

### URL de succès
- `akwahomemobile://payment-success?booking_id=xxx&booking_type=property&session_id={CHECKOUT_SESSION_ID}`

### Vérification du paiement
- **Où** : **uniquement dans le modal** ModificationSurplusPaymentModal (pas le StripeReturnHandler global pour la logique stricte).
- **Données gardées** : `pendingStripeSessionId` + `sessionIdRef` / `bookingIdRef` (pour survivre au retour de l’app).
- **Polling** : tant que le modal est ouvert et qu’une session est en attente, un `setInterval` appelle `checkPaymentStatusFull(sessionId, bookingId)` toutes les 2,5 s.
- **Retour app** : `AppState` `active` → `verifyStripePaymentNow()` qui utilise les refs (session_id + booking_id).
- **Paramètres envoyés à** `check-payment-status` :
  - `booking_id`
  - `booking_type: 'property'`
  - **payment_type: 'modification_surplus'**
  - **stripe_session_id** (obligatoire pour ce flux).
- **Backend** : branche **surplus** :
  - Cherche un paiement avec `booking_id` + `payment_type: modification_surplus` + `external_payment_id` ou `payment_intent_id` = session_id.
  - Si le **draft** existe encore dans `modification_surplus_drafts` pour ce session_id → considère que le webhook n’a pas fini → **is_confirmed: false** (pour éviter de valider trop tôt).

### Après succès
- `onPaymentComplete(stripeSessionId)` est appelé (demande déjà créée par le webhook).
- Le parent (BookingModificationModal) ferme et rafraîchit ; il ne crée pas la demande lui‑même.

### Résumé modification logement
| Étape | Acteur | Donnée clé |
|-------|--------|------------|
| Ouverture Stripe | ModificationSurplusPaymentModal | `booking_id` + `modification_request` |
| Avant paiement | Backend | Draft dans `modification_surplus_drafts` |
| Après paiement | Webhook | Insert `payments` (payment_type modification_surplus), crée la ligne dans `booking_modification_requests`, supprime le draft |
| Vérification | ModificationSurplusPaymentModal (poll + AppState) | **booking_id + stripe_session_id + payment_type: modification_surplus** |

---

## 4. Modification de réservation avec surplus (véhicule – VehicleModificationSurplusPaymentModal)

- Même principe que modification logement, avec :
  - `booking_type: 'vehicle'`
  - `payment_type: 'vehicle_modification_surplus'`
  - Tables : `vehicle_payments`, `vehicle_booking_modification_requests`, même table de drafts `modification_surplus_drafts`.

---

## 5. StripeReturnHandler (global)

- **Rôle** : intercepte le **deep link** au retour (e.g. `akwahomemobile://payment-success?...`).
- **Parsing** : extrait uniquement **checkout_token** ou **booking_id** + **booking_type**. **N’utilise pas session_id** ni **payment_type**.
- **Vérification** : appelle `checkPaymentStatus` avec `booking_type` + (`checkout_token` ou `booking_id`).
  - Pour une **résa initiale** (checkout_token) : cohérent avec le flux draft.
  - Pour une **modification** (booking_id seul, sans payment_type ni session_id) : le backend reçoit une requête **sans** payment_type → il traite en « dernier paiement pour ce booking ». Si le dernier paiement est bien le surplus modification (completed), il peut renvoyer **is_confirmed: true** et afficher un message générique (« Paiement confirmé ! Votre modification a bien été enregistrée »). Donc le StripeReturnHandler peut servir de **secours** pour la modification, mais la vérification **stricte** (session_id + draft consommé) reste dans le modal.

---

## 6. Tableau récapitulatif

| Critère | Réservation initiale (logement / véhicule) | Modification (surplus logement / véhicule) |
|---------|-------------------------------------------|-------------------------------------------|
| **Identifiant avant paiement** | `checkout_token` | `booking_id` (résa déjà existante) |
| **Résa / demande en base avant paiement** | Aucune (draft seulement) | Résa existante ; **demande** créée seulement après paiement (via draft) |
| **Table de drafts** | `stripe_checkout_drafts` | `modification_surplus_drafts` |
| **Création résa / demande** | Webhook crée la résa + le paiement | Webhook crée le paiement + la **demande** de modification |
| **Paramètres de vérification** | `checkout_token` (ou `booking_id` une fois résolu), `booking_type` | **booking_id + stripe_session_id + payment_type** (modification_surplus / vehicle_modification_surplus) |
| **Où la vérification est faite** | Dans le modal/écran de résa (BookingModal / VehicleBookingScreen) + StripeReturnHandler | Dans le modal de paiement surplus (ModificationSurplusPaymentModal / VehicleModificationSurplusPaymentModal) ; StripeReturnHandler uniquement si l’URL contient booking_id **et** session_id (pas de succès basé sur un ancien paiement) |
| **Condition « confirmé » côté backend** | Paiement completed + résa trouvée (par token ou id) | Paiement surplus completed **pour ce session_id** + draft **supprimé** (webhook passé) |

---

## 7. Workflow actuel en chaîne

### Réservation initiale (ex. logement)
1. Utilisateur clique Réserver (carte) → `createCheckoutSession` (checkout_token + payload).
2. Backend : draft dans `stripe_checkout_drafts` → session Stripe → redirect URL avec checkout_token.
3. `Linking.openURL` → utilisateur paie dans le navigateur.
4. Stripe envoie `checkout.session.completed` → webhook crée `bookings` + `payments`, supprime le draft.
5. Utilisateur revient dans l’app (deep link ou rouvre l’app).
6. BookingModal (poll / AppState) ou StripeReturnHandler appelle `check-payment-status` avec checkout_token.
7. Backend résout booking_id via `stripe_checkout_token`, trouve le paiement → `is_confirmed: true`.
8. UI : succès, fermeture, rafraîchissement.

### Modification avec surplus (ex. logement)
1. Utilisateur valide la modification (surplus > 0) → ouverture ModificationSurplusPaymentModal → Payer (carte).
2. `createCheckoutSession` (booking_id, amount, modification_request).
3. Backend : draft dans `modification_surplus_drafts` → session Stripe → redirect avec booking_id + session_id.
4. Utilisateur paie → webhook : insert `payments` (payment_type modification_surplus), crée la ligne dans `booking_modification_requests`, supprime le draft.
5. Utilisateur revient dans l’app (modal souvent encore ouvert).
6. Modal (poll / AppState) appelle `check-payment-status` avec **booking_id + stripe_session_id + payment_type: modification_surplus**.
7. Backend : paiement trouvé pour ce session_id + pas de draft restant → `is_confirmed: true`.
8. `onPaymentComplete(sessionId)` → parent ferme, rafraîchit ; la demande a déjà été créée par le webhook.

---

*Document généré pour clarifier la différence entre les deux flux et éviter les confusions (résa initiale vs modification).*
