# Bugs fonctionnels — suivi

Dernière analyse : 2026-09-21  
Projet : `app/` (+ edge `website/supabase/functions/send-push`)

---

## Priorité haute

### H1 — Véhicules + lieu carte/OSM → résultats vides
- **Fichier :** `app/src/hooks/useVehicles.ts`
- **Problème :** si `resolveLocationIdsForSearchTerm` ne trouve pas de `locationIds`, on vide la liste. Pas de secours rayon.
- **Fix :** secours rayon 12 km sur coords location liée.
- **Statut :** ✅ corrigé (2026-09-21)

### H2 — Pull-to-refresh recherche logements ignore des filtres
- **Fichier :** `app/src/hooks/useProperties.ts` (`refreshProperties`)
- **Problème :** refresh ne réappliquait pas dates, rayon, etc.
- **Fix :** `refreshProperties` → `fetchProperties(..., { forceRefresh: true })`.
- **Statut :** ✅ corrigé (2026-09-21)

---

## Priorité moyenne

### M1 — Badge icône écrasé par le push
- **Fichiers :** `website/supabase/functions/send-push/index.ts`, `TabNotificationBadgesContext.tsx`
- **Problème :** push mettait un badge partiel (messages / 1) qui écrasait le total app.
- **Fix :** ne plus envoyer `badge` dans le push ; l’app synchronise l’icône (messages + résas). `channelId: default` conservé.
- **Statut :** ✅ corrigé (2026-09-21) — **redéployer** `send-push`

### M2 — Rayon logement hors base : limite 100 moins chers
- **Fichier :** `app/src/hooks/useProperties.ts`
- **Problème :** sans `locationIds`, 100 moins chers puis filtre rayon client.
- **Impact :** logements proches plus chers absents.
- **Fix :** RPC/PostGIS ou élargir / trier par distance avant `limit`.
- **Statut :** 🔲 à faire

### M3 — Recherche mensuelle ignore le rayon carte
- **Fichier :** `app/src/hooks/useApprovedMonthlyRentalListings.ts`
- **Problème :** pas de filtre distance après resolve zone.
- **Fix :** filtrer par distance après fetch.
- **Statut :** 🔲 à faire

### M4 — Hôte « Occupée » le jour du checkout
- **Fichier :** `app/src/screens/HostBookingsScreen.tsx`
- **Problème :** `checkOut >= today` → jour de départ encore Occupée.
- **Fix :** `checkOut > today` (checkout exclusif).
- **Statut :** ✅ corrigé (2026-09-21)

### M5 — Véhicules : dates skew timezone
- **Fichier :** `app/src/hooks/useVehicles.ts`
- **Problème :** `new Date('YYYY-MM-DD')` décale selon le fuseau.
- **Fix :** `localDayBoundsIso` (parties année/mois/jour en local).
- **Statut :** ✅ corrigé (2026-09-21)

---

## Priorité basse

### L1 — Prix inventé si `price_per_night` manquant
- **Fichier :** `app/src/hooks/useProperties.ts`
- **Problème :** prix aléatoire.
- **Fix :** `price_per_night ?? 0`.
- **Statut :** ✅ corrigé (2026-09-21)

---

## Hors scope (OK)

- Historique recherches récentes (AsyncStorage)
- Guard `isLocationUuid` / formulaires OSM
- « Disponible » hôte = pas occupé maintenant
