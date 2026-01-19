# Expiration automatique des réservations en attente

Ce document explique comment fonctionne l'expiration automatique des réservations et demandes de modification en attente pour l'application mobile AkwaHome.

## ✅ Configuration existante

Le système d'expiration automatique est **déjà configuré et fonctionnel** pour l'application mobile. La fonction `expire-pending-requests` est une **Supabase Edge Function** partagée entre le projet web et le projet mobile, puisqu'ils utilisent la même base de données Supabase.

**Localisation de la fonction** : `/home/dev_doctoome/dev_pers/cote-d-ivoire-stays/supabase/functions/expire-pending-requests/index.ts`

**Configuration** : Déjà configurée dans `cote-d-ivoire-stays/supabase/config.toml` avec `verify_jwt = false`

## Fonctionnalités

Le système expire automatiquement :
1. **Réservations de propriétés** en statut `pending` depuis plus de 24h
2. **Réservations de véhicules** en statut `pending` depuis plus de 24h
3. **Demandes de modification de réservation** (propriétés) en statut `pending` depuis plus de 24h
4. **Demandes de modification de réservation** (véhicules) en statut `pending` depuis plus de 24h

## Configuration du Cron Job

Le cron job est configuré dans Supabase Dashboard. Pour vérifier ou modifier la configuration :

1. Allez dans votre projet Supabase Dashboard
2. Naviguez vers **Database** > **Cron Jobs**
3. Vérifiez que le cron job `expire-pending-requests` existe et est actif
4. La fréquence recommandée est : `*/30 * * * *` (toutes les 30 minutes) ou `0 * * * *` (toutes les heures)

## Test manuel

Pour tester la fonction manuellement :

```bash
curl -X POST \
  'https://hqzgndjbxzgsyfoictgo.supabase.co/functions/v1/expire-pending-requests' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

## Comportement

Lorsqu'une réservation ou demande expire :

### 1. Réservations de propriétés

- Le statut passe de `pending` à `cancelled`
- Un message d'annulation est ajouté : "Réservation automatiquement annulée : aucune réponse du propriétaire sous 24h" (ou "la date de début est déjà passée")
- **Un email est envoyé au voyageur** (`booking_expired_auto_cancelled`) pour l'informer de l'annulation
- **Un email est envoyé à l'hôte** (`booking_expired_host_notification`) pour l'informer que la réservation a été annulée automatiquement

### 2. Réservations de véhicules

- Le statut passe de `pending` à `cancelled`
- Un message d'annulation est ajouté : "Réservation automatiquement annulée : aucune réponse du propriétaire sous 24h" (ou "la date de début est déjà passée")
- **Un email est envoyé au locataire** (`vehicle_booking_expired_auto_cancelled`) pour l'informer de l'annulation
- **Un email est envoyé au propriétaire** (`vehicle_booking_expired_owner_notification`) pour l'informer que la réservation a été annulée automatiquement

### 3. Demandes de modification de réservation (propriétés)

- Le statut passe de `pending` à `cancelled`
- **Un email est envoyé au voyageur** (`booking_modification_expired`) pour l'informer que sa demande a expiré
- **Un email est envoyé à l'hôte** (`modification_expired_host_notification`) pour l'informer que la demande a été annulée automatiquement

### 4. Demandes de modification de réservation (véhicules)

- Le statut passe de `pending` à `cancelled`
- **Un email est envoyé au locataire** (`vehicle_booking_modification_expired`) pour l'informer que sa demande a expiré
- **Un email est envoyé au propriétaire** (`vehicle_modification_expired_owner_notification`) pour l'informer que la demande a été annulée automatiquement

## Rappels avant expiration

La fonction envoie également des **rappels** aux hôtes/propriétaires 20h après la création d'une demande :

- **Rappels pour réservations de propriétés** : Email `booking_pending_reminder` à l'hôte
- **Rappels pour réservations de véhicules** : Email `vehicle_booking_pending_reminder` au propriétaire
- **Rappels pour modifications de propriétés** : Email `modification_pending_reminder` à l'hôte
- **Rappels pour modifications de véhicules** : Email `vehicle_modification_pending_reminder` au propriétaire

Ces rappels sont envoyés entre 20h et 24h après la création, pour donner 4h supplémentaires avant l'expiration automatique.

## Critères d'expiration

Une réservation ou demande expire si **l'un des critères suivants** est rempli :

1. **Créée il y a plus de 24h** : `created_at < (now - 24 heures)`
2. **Date de début déjà passée** : `start_date` ou `check_in_date` < aujourd'hui

## Logs

Les logs de la fonction sont disponibles dans :
- Supabase Dashboard > **Edge Functions** > **expire-pending-requests** > **Logs**

## Fréquence recommandée

- **Minimum** : Toutes les heures (`0 * * * *`)
- **Recommandé** : Toutes les 30 minutes (`*/30 * * * *`)
- **Maximum** : Toutes les 15 minutes (`*/15 * * * *`)

Note : Une fréquence trop élevée peut augmenter les coûts et la charge sur la base de données.

## Index de performance

Les index nécessaires pour optimiser les requêtes d'expiration sont déjà créés dans la base de données (via la migration `20260103125057_add_indexes_for_expiration.sql` du projet web).

## Vérification

Pour vérifier que le système fonctionne correctement :

1. Créez une réservation de test en statut `pending`
2. Attendez 24h (ou modifiez manuellement `created_at` dans la base de données pour simuler)
3. Vérifiez que le cron job s'exécute
4. Vérifiez les logs de la fonction Edge Function
5. Vérifiez que la réservation est passée en `cancelled`
6. Vérifiez que les emails ont été envoyés

## Notes importantes

- ⚠️ La fonction utilise la **clé de service Supabase** pour avoir accès à toutes les données
- ⚠️ Les réservations avec `auto_booking = true` ne passent jamais en `pending`, donc elles ne sont jamais expirées automatiquement
- ⚠️ Les réservations déjà `confirmed` ou `completed` ne sont pas affectées
- ⚠️ Les réservations `cancelled` ne sont pas traitées

