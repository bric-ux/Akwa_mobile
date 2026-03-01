# Paiement Stripe dans l’app mobile – Comment on sait si le paiement a réussi

## Flux actuel (redirection vers Stripe Checkout)

1. L’utilisateur choisit **Carte** et valide la réservation (logement ou véhicule).
2. L’app crée la réservation en base (statut `pending`) et appelle l’edge function **`create-checkout-session`**, qui renvoie une **URL Stripe Checkout**.
3. L’app ouvre cette URL avec **`Linking.openURL(url)`** → l’utilisateur quitte l’app et paie dans le **navigateur** (page hébergée Stripe).
4. Après paiement, Stripe redirige vers **ton site web** (`success_url`), pas vers l’app. L’utilisateur peut alors :
   - fermer l’onglet et **revenir à l’app** (manuellement), ou
   - rester sur la page web.
5. Côté serveur : Stripe envoie un **webhook** `checkout.session.completed` à ton backend, qui met à jour le paiement et la réservation (statut `confirmed`).
6. **Comment l’app sait que le paiement a réussi** : elle ne reçoit **pas** de callback direct de Stripe (car le paiement se fait dans le navigateur). Elle le déduit en **vérifiant le statut** côté backend.

---

## Comment on vérifie que le paiement a réussi

### 1. Edge function `check-payment-status`

- **Appel** : `POST /functions/v1/check-payment-status`  
  Body : `{ "booking_id": "<uuid>", "booking_type": "property" | "vehicle" }`  
  Headers : `Authorization: Bearer <session utilisateur>`
- **Réponse** : `{ payment_status, booking_status, is_confirmed: true/false }`
- La fonction lit en base :
  - pour **logement** : table `payments` + `bookings`
  - pour **véhicule** : table `vehicle_payments` + `vehicle_bookings`
- Après le webhook Stripe, le paiement est en `completed` et la réservation en `confirmed`, donc **`is_confirmed`** devient **`true`**.

### 2. Où c’est utilisé dans l’app

| Écran / composant | Rôle |
|-------------------|------|
| **BookingModal** (réservation logement) | Après avoir ouvert l’URL Stripe, on garde `pendingStripeBookingId`. On appelle `check-payment-status` (via `checkStripePaymentCompleted`) pour savoir si le paiement est confirmé. |
| **VehicleBookingScreen** (réservation véhicule) | Même principe avec `booking_type: 'vehicle'`. |

### 3. Quand on vérifie

- **Toutes les 5 secondes** : un `setInterval` appelle `verifyStripePaymentNow()` tant qu’il y a un `pendingStripeBookingId`.
- **Au retour dans l’app** : quand l’utilisateur revient (événement `AppState` `active` après `background`/`inactive`), on appelle `verifyStripePaymentNow()` tout de suite, puis **une seconde fois après 2 secondes** (pour laisser le temps au webhook Stripe).
- **Bouton « Vérifier le paiement »** : l’utilisateur peut déclencher la vérification à la main.

Dès que `check-payment-status` renvoie **`is_confirmed: true`** :

- On affiche une alerte « Paiement confirmé ».
- On réinitialise l’état Stripe (pending, timer, etc.) et on ferme le modal ou on redirige.

---

## Schéma du flux

```
[App] Clic "Réserver" (carte)
    → create-checkout-session
    → Linking.openURL(stripeCheckoutUrl)
[Utilisateur paie dans le navigateur]
    → Stripe envoie webhook → ton backend met à jour payments + booking (confirmed)
[Utilisateur revient dans l’app]
    → AppState 'active' → verifyStripePaymentNow()
    → OU poll toutes les 5 s
    → check-payment-status → is_confirmed: true
    → Alerte "Paiement confirmé" + reset + fermeture
```

---

## Points importants

1. **Pas de retour automatique dans l’app** : Stripe redirige vers ton **site web**. L’utilisateur doit rouvrir l’app. La vérification se fait au retour (AppState) et par le poll toutes les 5 s.
2. **Délai webhook** : il peut y avoir 1–3 secondes entre le paiement et la mise à jour en base. D’où la **deuxième vérification 2 s après le retour** dans l’app.
3. **Réservation déjà créée** : la réservation est en base avec statut `pending` avant l’ouverture de Stripe. Si l’utilisateur ne paie pas, elle reste en attente (timeout 10 min puis annulation possible).
4. **Véhicules** : même logique, avec les tables `vehicle_payments` et `vehicle_bookings` et `booking_type: 'vehicle'` dans `check-payment-status`.

---

## Si tu veux un retour “immédiat” dans l’app (optionnel)

Pour que l’utilisateur revienne **automatiquement** dans l’app après paiement :

- Configurer **`success_url`** (et éventuellement `cancel_url`) avec un **custom URL scheme** de ton app (ex. `akwahome://payment-success?session_id=...`).
- Sur iOS : déclarer le scheme dans le projet (Info.plist / Xcode).
- Sur Android : déclarer un intent filter pour ce scheme.
- Au retour sur cette URL, l’app s’ouvre ; tu peux alors appeler tout de suite `verifyStripePaymentNow()` (ou passer `session_id` en query et l’envoyer à `check-payment-status` si tu l’implémentes côté backend).

Aujourd’hui, **savoir si le paiement a réussi** repose entièrement sur **check-payment-status** (et donc sur la mise à jour faite par le webhook Stripe). Le poll + vérification au retour d’app suffisent pour que l’utilisateur voie la confirmation dès qu’il revient dans l’app.
