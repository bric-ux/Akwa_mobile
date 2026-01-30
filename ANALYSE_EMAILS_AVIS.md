# Analyse du système d'emails pour les avis

## Vue d'ensemble du système d'avis

Le système d'avis fonctionne en mode **mutuel** : un avis n'est publié qu'après que la partie concernée ait répondu.

### Types d'avis dans l'application

1. **Avis voyageur sur propriété** (`reviews`)
   - Table: `reviews`
   - Voyageur → Hôte
   - Publié quand l'hôte répond (via `review_responses`)

2. **Avis hôte sur voyageur** (`guest_reviews`)
   - Table: `guest_reviews`
   - Hôte → Voyageur
   - Publié quand le voyageur répond (via `guest_review_responses`)

3. **Avis locataire sur véhicule** (`vehicle_reviews`)
   - Table: `vehicle_reviews`
   - Locataire → Propriétaire
   - Publié quand le propriétaire répond (via `vehicle_review_responses`)

4. **Avis propriétaire sur locataire** (`vehicle_renter_reviews`)
   - Table: `vehicle_renter_reviews`
   - Propriétaire → Locataire
   - Publié quand le locataire répond (via `vehicle_renter_review_responses`)

---

## Emails à envoyer - État actuel

### ✅ 1. Avis voyageur sur propriété (`reviews`)

#### 1.1. Voyageur soumet un avis → Email à l'hôte
- **Type d'email**: `new_property_review`
- **Statut**: ✅ **DÉJÀ IMPLÉMENTÉ**
- **Fichier**: `useReviews.ts` ligne 202
- **Fonction**: `sendNewPropertyReview()`
- **Destinataire**: Hôte de la propriété
- **Contenu**: Notification qu'un voyageur a laissé un avis sur sa propriété

#### 1.2. Hôte répond à l'avis → Email au voyageur
- **Type d'email**: `new_property_review_response`
- **Statut**: ❌ **MANQUANT**
- **Fichier**: `useReviewResponses.ts` ligne 35-61
- **Action**: Quand l'hôte soumet une réponse via `submitResponse()`
- **Destinataire**: Voyageur qui a laissé l'avis
- **Contenu**: Notification que l'hôte a répondu à son avis

#### 1.3. Avis publié (après réponse) → Email au voyageur
- **Type d'email**: `property_review_published`
- **Statut**: ❌ **MANQUANT**
- **Déclencheur**: Trigger SQL `trigger_publish_property_review_on_response` (migration 20260119201548)
- **Destinataire**: Voyageur qui a laissé l'avis
- **Contenu**: Confirmation que son avis est maintenant publié et visible

---

### ✅ 2. Avis hôte sur voyageur (`guest_reviews`)

#### 2.1. Hôte soumet un avis → Email au voyageur
- **Type d'email**: `new_guest_review`
- **Statut**: ✅ **DÉJÀ IMPLÉMENTÉ**
- **Fichier**: `useGuestReviews.ts` ligne 245
- **Fonction**: `sendNewGuestReview()`
- **Destinataire**: Voyageur
- **Contenu**: Notification qu'un hôte a laissé un avis sur lui

#### 2.2. Voyageur répond à l'avis → Email à l'hôte
- **Type d'email**: `new_guest_review_response`
- **Statut**: ❌ **MANQUANT**
- **Fichier**: `MyGuestReviewsScreen.tsx` ligne 230-278
- **Fonction**: `handleSubmitResponse()` (pour les avis propriétés)
- **Action**: Quand le voyageur soumet une réponse via `guest_review_responses`
- **Destinataire**: Hôte qui a laissé l'avis
- **Contenu**: Notification que le voyageur a répondu à son avis

#### 2.3. Avis publié (après réponse) → Email à l'hôte
- **Type d'email**: `guest_review_published`
- **Statut**: ❌ **MANQUANT**
- **Déclencheur**: Trigger SQL `trigger_publish_guest_review` (migration 20260118124115)
- **Destinataire**: Hôte qui a laissé l'avis
- **Contenu**: Confirmation que son avis est maintenant publié et visible

---

### ✅ 3. Avis locataire sur véhicule (`vehicle_reviews`)

#### 3.1. Locataire soumet un avis → Email au propriétaire
- **Type d'email**: `new_vehicle_review`
- **Statut**: ✅ **DÉJÀ IMPLÉMENTÉ**
- **Fichier**: `useVehicleReviews.ts` ligne 138
- **Fonction**: `sendNewVehicleReview()`
- **Destinataire**: Propriétaire du véhicule
- **Contenu**: Notification qu'un locataire a laissé un avis sur son véhicule

#### 3.2. Propriétaire répond à l'avis → Email au locataire
- **Type d'email**: `new_vehicle_review_response`
- **Statut**: ❌ **MANQUANT**
- **Fichier**: `VehicleReviewsScreen.tsx` ligne 148-187
- **Action**: Quand le propriétaire soumet une réponse via `handleSubmitResponse()`
- **Destinataire**: Locataire qui a laissé l'avis
- **Contenu**: Notification que le propriétaire a répondu à son avis

#### 3.3. Avis publié (après réponse) → Email au locataire
- **Type d'email**: `vehicle_review_published`
- **Statut**: ❌ **MANQUANT**
- **Déclencheur**: Trigger SQL `trigger_publish_vehicle_review` (migration 20260119195452)
- **Destinataire**: Locataire qui a laissé l'avis
- **Contenu**: Confirmation que son avis est maintenant publié et visible

---

### ✅ 4. Avis propriétaire sur locataire (`vehicle_renter_reviews`)

#### 4.1. Propriétaire soumet un avis → Email au locataire
- **Type d'email**: `new_vehicle_renter_review` (ou `new_renter_review`)
- **Statut**: ✅ **DÉJÀ IMPLÉMENTÉ**
- **Fichier**: `useVehicleRenterReviews.ts` ligne 140
- **Fonction**: `sendNewRenterReview()`
- **Destinataire**: Locataire
- **Contenu**: Notification qu'un propriétaire a laissé un avis sur lui

#### 4.2. Locataire répond à l'avis → Email au propriétaire
- **Type d'email**: `new_vehicle_renter_review_response`
- **Statut**: ❌ **MANQUANT**
- **Fichier**: `useVehicleRenterReviews.ts` ligne 282-317
- **Action**: Quand le locataire soumet une réponse via `createResponse()`
- **Destinataire**: Propriétaire qui a laissé l'avis
- **Contenu**: Notification que le locataire a répondu à son avis

#### 4.3. Avis publié (après réponse) → Email au propriétaire
- **Type d'email**: `vehicle_renter_review_published`
- **Statut**: ❌ **MANQUANT**
- **Déclencheur**: Trigger SQL `trigger_publish_vehicle_renter_review` (migration 20260119195452)
- **Destinataire**: Propriétaire qui a laissé l'avis
- **Contenu**: Confirmation que son avis est maintenant publié et visible

---

## Résumé des emails manquants

### Emails à créer dans l'Edge Function `send-email`

1. ❌ `new_property_review_response` - Hôte répond à avis voyageur → Email au voyageur
2. ❌ `property_review_published` - Avis voyageur publié → Email au voyageur
3. ❌ `new_guest_review_response` - Voyageur répond à avis hôte → Email à l'hôte
4. ❌ `guest_review_published` - Avis hôte publié → Email à l'hôte
5. ❌ `new_vehicle_review_response` - Propriétaire répond à avis locataire → Email au locataire
6. ❌ `vehicle_review_published` - Avis locataire publié → Email au locataire
7. ❌ `new_vehicle_renter_review_response` - Locataire répond à avis propriétaire → Email au propriétaire
8. ❌ `vehicle_renter_review_published` - Avis propriétaire publié → Email au propriétaire

**Total: 8 emails manquants**

---

## Points d'intégration dans le code mobile

### 1. Réponse hôte à avis voyageur (`review_responses`)
- **Fichier**: `useReviewResponses.ts`
- **Fonction**: `submitResponse()` ligne 35
- **Action**: Ajouter appel à `sendEmail()` avec type `new_property_review_response`

### 2. Réponse voyageur à avis hôte (`guest_review_responses`)
- **Fichier**: `MyGuestReviewsScreen.tsx` ligne 230-278
- **Fonction**: `handleSubmitResponse()` (section `selectedReviewType === 'property'`)
- **Action**: Ajouter appel à `sendEmail()` avec type `new_guest_review_response` après l'insert/update

### 3. Réponse propriétaire à avis locataire (`vehicle_review_responses`)
- **Fichier**: `VehicleReviewsScreen.tsx`
- **Fonction**: `handleSubmitResponse()` ligne 148
- **Action**: Ajouter appel à `sendEmail()` avec type `new_vehicle_review_response`

### 4. Réponse locataire à avis propriétaire (`vehicle_renter_review_responses`)
- **Fichier**: `useVehicleRenterReviews.ts`
- **Fonction**: `createResponse()` ligne 282
- **Action**: Ajouter appel à `sendEmail()` avec type `new_vehicle_renter_review_response`

### 5. Triggers SQL pour emails de publication
- Les triggers SQL existent déjà et mettent à jour `is_published = true`
- **Action**: Créer des triggers supplémentaires ou utiliser des webhooks Supabase pour envoyer les emails de publication
- **Alternative**: Utiliser un Edge Function déclenché par les triggers

---

## Recommandations

### Option 1: Webhooks Supabase (Recommandé)
- Créer des webhooks Supabase qui se déclenchent sur les INSERT dans les tables de réponses
- Les webhooks appellent l'Edge Function `send-email` avec le bon type

### Option 2: Edge Function déclenchée par trigger
- Créer une Edge Function `handle-review-publication` qui est appelée par les triggers SQL
- Cette fonction envoie les emails appropriés

### Option 3: Vérification côté client après réponse
- Après chaque soumission de réponse, vérifier si l'avis est publié
- Si oui, envoyer l'email de publication immédiatement

**Recommandation**: Option 1 (Webhooks) pour garantir que les emails sont envoyés même si l'utilisateur ferme l'app avant la fin de la requête.

---

## Données nécessaires pour chaque email

### Pour les emails de réponse (`*_response`)
- Nom de la personne qui a répondu
- Nom de la personne qui a reçu la réponse
- Titre de la propriété/véhicule
- Contenu de la réponse
- Note de l'avis original (optionnel)

### Pour les emails de publication (`*_published`)
- Nom de la personne qui a laissé l'avis
- Nom de la personne qui a répondu
- Titre de la propriété/véhicule
- Note de l'avis
- Commentaire de l'avis (optionnel)
- Lien vers l'avis publié (optionnel)

---

## Prochaines étapes

1. ✅ Valider cette analyse avec l'utilisateur
2. Créer les 8 templates d'email dans l'Edge Function `send-email`
3. Ajouter les appels d'email dans les hooks/fichiers identifiés
4. Configurer les webhooks Supabase ou créer les triggers pour les emails de publication
5. Tester chaque scénario d'email

