# Location mensuelle – Base de données séparée et mode propriétaire

## Principe : ne pas mélanger avec le court séjour

Les annonces et candidatures en **location mensuelle (longue durée)** sont gérées dans des **tables dédiées**, distinctes de `properties` et `host_applications`. Aucun mélange avec les logements court séjour.

## Tables (migration à exécuter plus tard)

Fichier : `supabase/migrations/20250221100000_monthly_rental_separate_tables.sql`

- **monthly_rental_listings**  
  Logements en location mensuelle (annonces des propriétaires).  
  Champs : `host_id`, `title`, `description`, `location`, `property_type`, `surface_m2`, `number_of_rooms`, `bedrooms`, `bathrooms`, `is_furnished`, `monthly_rent_price`, `security_deposit`, `minimum_duration_months`, `charges_included`, `address_details`, `images`, `categorized_photos`, `amenities`, `status` (draft | active | hidden), etc.

- **monthly_rental_candidatures**  
  Candidatures des locataires sur un logement.  
  Champs : `listing_id` (FK → monthly_rental_listings), `tenant_id`, `full_name`, `email`, `phone`, `message`, `desired_move_in_date`, `duration_months`, `status` (pending | accepted | rejected), etc.

RLS : le propriétaire voit/modifie ses listings et les candidatures de ses listings ; lecture publique des annonces actives.

## Mode propriétaire location mensuelle (app)

Depuis l’espace hôte :

1. **Compte hôte** → **« Mes logements longue durée »**  
   Liste des annonces du propriétaire (table `monthly_rental_listings`).

2. **Gestion d’un logement**  
   - **Ajouter un logement** : formulaire dédié → création dans `monthly_rental_listings`.  
   - **Modifier** : édition du même logement.  
   - **Candidatures** : par logement, liste des candidatures avec Accepter / Refuser.

3. **Candidatures**  
   Écran **Candidatures** (par listing) : affichage des candidatures, statut (En attente / Acceptée / Refusée), actions Accepter / Refuser pour les candidatures en attente.

## Flux côté app

- **Propriétaire**  
  - Mes logements longue durée → liste (MyMonthlyRentalListingsScreen).  
  - Ajouter → AddMonthlyRentalListingScreen → `createListing` → table `monthly_rental_listings`.  
  - Modifier → EditMonthlyRentalListingScreen → `updateListing`.  
  - Candidatures → MonthlyRentalCandidaturesScreen → `getByListingId`, `acceptCandidature`, `rejectCandidature` sur `monthly_rental_candidatures`.

- **Locataire** (à brancher plus tard)  
  - Consultation des annonces actives (lecture publique des listings `status = 'active'`).  
  - Envoi d’une candidature → insert dans `monthly_rental_candidatures`.

## Fichiers concernés

- **Types** : `src/types/index.ts` (`MonthlyRentalListing`, `MonthlyRentalCandidature`).  
- **Hooks** : `useMonthlyRentalListings.ts`, `useMonthlyRentalCandidatures.ts`.  
- **Écrans** : `MyMonthlyRentalListingsScreen`, `AddMonthlyRentalListingScreen`, `EditMonthlyRentalListingScreen`, `MonthlyRentalCandidaturesScreen`.  
- **Navigation** : routes `MyMonthlyRentalListings`, `AddMonthlyRentalListing`, `EditMonthlyRentalListing`, `MonthlyRentalCandidatures` ; entrée menu **« Mes logements longue durée »** dans HostAccountScreen.

## Migration

Exécuter le fichier SQL lorsque vous êtes prêt. Les tables sont créées sans modifier `properties` ni `host_applications`.
