# Analyse architecture – Module Location Mensuelle (Longue Durée)

## 1. Architecture actuelle (ce qu’on ne touche pas)

### Tables critiques (à ne pas modifier)
- **profiles** – Utilisateurs, rôles (admin, etc.)
- **properties** – Logements court séjour
- **property_photos**, **property_amenities** – Données liées aux propriétés
- **host_applications** – Candidatures « devenir hôte » (court séjour)
- **bookings**, **blocked_dates**, **booking_calculation_details** – Réservations court séjour
- **conversations** – Messagerie (colonnes : property_id, vehicle_id optionnels ; guest_id, host_id, title)
- **conversation_messages** – Messages (liés à une conversation)
- **locations** – Hiérarchie géographique
- **vehicles**, **vehicle_bookings**, **saved_vehicles** – Module véhicules
- **host_payment_info**, **host_payouts**, **payments** – Paiements / virements hôtes
- **reviews** – Avis

### Modes utilisateur existants
- **Voyageur** – Recherche propriétés, réservations, messagerie, favoris
- **Hôte** – Propriétés court séjour, réservations, statistiques, compte
- **Propriétaire véhicule** – Véhicules, réservations véhicules, stats

### Messagerie
- Une conversation = `guest_id` + `host_id` + optionnellement `property_id` ou `vehicle_id` + `title`.
- Création possible avec uniquement `guest_id`, `host_id`, `title` (sans property_id ni vehicle_id).
- **Conclusion** : on peut réutiliser la messagerie pour la location mensuelle en créant des conversations avec seulement guest_id, host_id et title = titre de l’offre. **Aucune modification de schéma des tables conversations / conversation_messages.**

### Favoris existants
- **saved_vehicles** – Favoris véhicules (user_id, vehicle_id).
- Favoris propriétés : logique similaire (table dédiée ou équivalent).
- **Conclusion** : le module location mensuelle aura sa propre table de favoris (user_id, listing_id), sans toucher aux tables existantes.

---

## 2. Contraintes du cahier des charges

- Ne pas modifier les tables critiques.
- Module isolé : tables dédiées, pas de mélange avec properties / host_applications.
- Paiement 200 FCFA par bien, obligatoire avant soumission ; 1 paiement = 1 bien ; historique côté propriétaire.
- Statuts bien : draft → pending → approved | rejected | archived. Un bien non approuvé n’est jamais visible publiquement.
- Candidature : 1 par utilisateur par bien ; snapshot du profil au moment de la candidature ; statuts sent / viewed / accepted / rejected.
- À la candidature : création automatique d’une conversation (titre = titre de l’offre), réutilisation du système de messagerie existant.
- Admin : onglet « Locations mensuelles » (liste, détail, approuver, refuser, supprimer, voir propriétaire, voir paiements).
- Côté locataire : liste / détail, liker, contacter, candidater ; espace « Mes candidatures » avec accès à la conversation.
- Côté propriétaire : dashboard (mes biens, ajouter, candidatures reçues, paiements).

---

## 3. Logique retenue

### Isolation
- Toutes les données du module sont dans des tables préfixées ou dédiées (ex. `monthly_rental_*`).
- Aucune FK vers `properties` ou `host_applications`.
- Référence uniquement `auth.users` (owner_id, tenant_id) et éventuellement `locations` (référence partagée, non critique).

### Workflow bien
1. **draft** – Le propriétaire remplit le formulaire (bien non soumis).
2. Paiement 200 FCFA enregistré et accepté → le propriétaire peut passer en **pending** (soumission).
3. **pending** – En attente de validation admin. Non visible publiquement.
4. **approved** – Visible publiquement (liste, détail, candidatures, contact).
5. **rejected** – Refusé par l’admin. Non visible.
6. **archived** – Archivé par le propriétaire ou l’admin. Non visible.

Règle métier : un bien n’est visible que si `status = 'approved'`.

### Paiement
- Table **monthly_rental_listing_payments** : un enregistrement par paiement (owner_id, listing_id, amount_fcfa = 200, status, paid_at).
- Règle : un bien ne peut être soumis (draft → pending) que si un paiement réussi est lié à ce bien (1 paiement = 1 bien pour le référencement).
- Pas de réutilisation de la table `payments` (réservations) pour éviter tout couplage.

### Candidature
- Une seule candidature par (listing_id, tenant_id) : contrainte UNIQUE.
- Snapshot : stockage en JSONB (ou colonnes dédiées) des données profil au moment de la candidature (nom, prénom, email, téléphone, etc.) pour ne pas dépendre du profil « live ».
- À la création de la candidature : création d’une conversation (guest_id = tenant, host_id = owner, title = titre du listing) et stockage de `conversation_id` sur la candidature.
- Statuts : **sent** → **viewed** (quand le propriétaire ouvre) → **accepted** | **rejected**.

### Messagerie
- Réutilisation de la table **conversations** sans ajout de colonne : insertion avec `guest_id`, `host_id`, `title` uniquement (property_id et vehicle_id à NULL).
- L’app devra pouvoir créer une conversation avec seulement ces champs (extension mineure du hook existant).

### Admin
- Nouvel onglet « Locations mensuelles » qui interroge uniquement les tables du module (listings, payments, candidatures) et profiles pour afficher le propriétaire.
- Aucune modification des tables admin existantes.

### Mode propriétaire longue durée
- Structuré comme les autres modes (onglets / stack dédiée) mais entièrement branché sur les tables `monthly_rental_*` : mes biens, ajouter un bien, candidatures reçues, paiements.

---

## 4. Tables à créer (résumé)

| Table | Rôle |
|-------|------|
| **monthly_rental_listings** | Annonces (biens) en location mensuelle. Statuts : draft, pending, approved, rejected, archived. Champs : owner, titre, description, localisation, caractéristiques, prix mensuel, photos, équipements, etc. |
| **monthly_rental_listing_payments** | Paiements de référencement (200 FCFA par bien). Lien owner_id, listing_id, amount_fcfa, status, paid_at. Historique visible côté propriétaire. |
| **monthly_rental_candidatures** | Candidatures locataires. Snapshot profil (JSONB), listing_id, tenant_id, conversation_id, statuts sent/viewed/accepted/rejected. UNIQUE(listing_id, tenant_id). |
| **monthly_rental_listing_favorites** | Favoris (likes) des utilisateurs sur les annonces. (user_id, listing_id). |

Les tables **conversations** et **conversation_messages** ne sont pas modifiées ; on les utilise en lecture/écriture avec les règles existantes.

---

## 5. Migration proposée

Fichier : **`supabase/migrations/20250222100000_monthly_rental_module_complete.sql`**

- **monthly_rental_listings** : statuts `draft | pending | approved | rejected | archived`. Champs `submitted_at`, `reviewed_at`, `reviewed_by`, `admin_notes` pour le workflow admin.
- **monthly_rental_listing_payments** : 200 FCFA par bien, `listing_id` unique (1 paiement = 1 bien), `status` (pending, completed, failed, refunded), `paid_at`.
- **monthly_rental_candidatures** : `UNIQUE(listing_id, tenant_id)`, `snapshot` JSONB, `conversation_id` (FK vers `conversations`), statuts `sent | viewed | accepted | rejected`.
- **monthly_rental_listing_favorites** : `UNIQUE(user_id, listing_id)`.

Première migration sur ce module : création directe des 4 tables (aucune suppression).

RLS : propriétaire (owner) gère ses biens et paiements ; lecture publique des biens `approved` ; locataire voit/pose ses candidatures ; admin (profil `role = 'admin'`) peut tout voir en lecture.

## 6. Prochaine étape

Une fois cette analyse et la migration validées, l’implémentation du code (hooks, écrans, navigation, admin, messagerie, paiement 200 FCFA) pourra commencer.
