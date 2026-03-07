# Analyse du bug : paiement par carte lors des modifications de réservation

## Résumé

Lors d’une modification de réservation avec surplus payé par carte, le flux peut aboutir à un **paiement Stripe réussi** et un **message de succès dans l’app**, alors qu’**aucune demande de modification** n’est créée en base. L’utilisateur a payé mais sa demande n’existe pas.

## Cause racine (backend – webhook Stripe)

Dans `cote-d-ivoire-stays/supabase/functions/stripe-webhook/index.ts` :

1. Après un paiement « surplus modification » réussi, le webhook :
   - insère le paiement dans `payments` ou `vehicle_payments` ;
   - récupère le draft dans `modification_surplus_drafts` ;
   - tente d’insérer la demande dans `booking_modification_requests` (logement) ou `vehicle_booking_modification_requests` (véhicule).

2. **Bug** : si cet `insert` échoue (contrainte, type, colonne manquante, etc.) :
   - l’erreur était seulement loguée (`console.error`) ;
   - le draft était **quand même supprimé** ;
   - le webhook renvoyait **200 OK**.

Conséquences :
- Le paiement est bien enregistré.
- Le draft est supprimé, donc on ne peut plus recréer la demande.
- L’app appelle `check-payment-status` : elle trouve le paiement `completed` et plus de draft → `is_confirmed: true`.
- L’app affiche succès et appelle `onPaymentComplete(stripeSessionId)` alors qu’**aucune demande de modification n’a été créée**.

## Correction appliquée (webhook)

Dans `stripe-webhook/index.ts` :

- Après l’insert dans `booking_modification_requests` ou `vehicle_booking_modification_requests`, on vérifie `modReqErr`.
- En cas d’erreur :
  - on **ne supprime pas** le draft (il reste pour un éventuel retry) ;
  - on renvoie **500** avec un message explicite, pour que Stripe réessaie le webhook.
- On ne supprime le draft que si l’insert a réussi.

Cela évite la situation « paiement pris, demande jamais créée » et permet à Stripe de réessayer en cas d’échec temporaire (ex. base indisponible).

## Autres points vérifiés (OK)

- **create-checkout-session** : pour `modification_surplus` / `vehicle_modification_surplus`, le body contient bien `modification_request` et un draft est créé dans `modification_surplus_drafts` avec le bon `session_id` après création de la session Stripe.
- **check-payment-status** : pour le surplus, on exige `stripe_session_id`, on cherche le paiement par `external_payment_id` / `payment_intent_id` et on considère que le paiement n’est pas confirmé tant que le draft existe (webhook pas encore passé).
- **Mobile** : `ModificationSurplusPaymentModal` et `VehicleModificationSurplusPaymentModal` envoient bien `modificationRequestPayload` à `createCheckoutSession` et utilisent `stripe_session_id` pour la vérification au retour.

## Recommandations

1. **Surveillance** : monitorer les logs du webhook Stripe (Supabase + Stripe Dashboard) pour les erreurs « booking_modification_requests insert from draft failed » ou « vehicle_booking_modification_requests insert from draft failed ». Si elles apparaissent, corriger la cause (schéma, contraintes, format du payload).
2. **Stripe** : s’assurer que les retries du webhook sont activés (par défaut Stripe réessaie plusieurs fois en cas de 500).
3. **Optionnel** : en cas de draft sans payload valide, envisager de logger un warning et éventuellement une alerte, sans renvoyer 500 (pour éviter des retries inutiles si le draft est invalide).
