# 📅 HISTORIQUE DE STOCKAGE DES MONTANTS

## 📊 RÉSUMÉ

| Donnée | Table `bookings` | Table `vehicle_bookings` | Statut |
|--------|------------------|--------------------------|--------|
| `total_price` | ✅ Depuis le début (2025-09-24) | ✅ Depuis le début (2025-11-28) | **Toujours stocké** |
| `host_net_amount` | ⚠️ Depuis le 30 janvier 2025 | ⚠️ Depuis le 30 janvier 2025 | **NULL pour anciennes réservations** |

---

## 1. `total_price` - Stocké depuis le début

### Table `bookings` (Propriétés)
- **Migration initiale**: `20250924100041_2179be05-4cf3-462d-b271-918b0651e2be.sql`
- **Date**: 24 septembre 2025
- **Champ créé**:
```sql
CREATE TABLE public.bookings (
  ...
  total_price INTEGER NOT NULL,  -- ✅ Créé dès le début
  ...
);
```

**Statut**: ✅ **Toutes les réservations** ont `total_price` stocké (champ obligatoire `NOT NULL`)

---

### Table `vehicle_bookings` (Véhicules)
- **Migration initiale**: `20251128211423_4e06bab1-98b6-4e70-843e-39a40bd0955d.sql`
- **Date**: 28 novembre 2025
- **Champ créé**:
```sql
CREATE TABLE IF NOT EXISTS vehicle_bookings (
  ...
  total_price INTEGER NOT NULL,  -- ✅ Créé dès le début
  ...
);
```

**Statut**: ✅ **Toutes les réservations** ont `total_price` stocké (champ obligatoire `NOT NULL`)

---

## 2. `host_net_amount` - Ajouté plus tard

### Migration d'ajout
- **Fichier**: `20250130000000_add_host_net_amount_to_bookings.sql`
- **Date**: 30 janvier 2025
- **Action**:
```sql
-- 1. Ajouter host_net_amount à la table bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS host_net_amount INTEGER;

-- 2. Ajouter host_net_amount à la table vehicle_bookings
ALTER TABLE public.vehicle_bookings
ADD COLUMN IF NOT EXISTS host_net_amount INTEGER;
```

**Note importante**:
```sql
-- 4. Note: Les valeurs existantes seront NULL
--    Elles pourront être recalculées via un script de migration si nécessaire
--    Pour l'instant, on laisse NULL pour les anciennes réservations et on calcule pour les nouvelles
```

---

## 📅 CHRONOLOGIE

### Avant le 30 janvier 2025
- ✅ `total_price` : **Stocké** pour toutes les réservations
- ❌ `host_net_amount` : **N'existe pas** (colonne n'existe pas encore)

### Après le 30 janvier 2025 (migration appliquée)

#### Réservations créées AVANT le 30 janvier 2025
- ✅ `total_price` : **Stocké** (existe depuis le début)
- ⚠️ `host_net_amount` : **NULL** (colonne ajoutée après, pas remplie pour les anciennes)

#### Réservations créées APRÈS le 30 janvier 2025
- ✅ `total_price` : **Stocké** (calculé et stocké lors de la création)
- ✅ `host_net_amount` : **Stocké** (calculé et stocké lors de la création)

---

## 🔍 COMMENT IDENTIFIER LES RÉSERVATIONS

### Réservations avec `host_net_amount` NULL (anciennes)
```sql
-- Réservations créées avant le 30 janvier 2025
SELECT id, created_at, total_price, host_net_amount
FROM bookings
WHERE host_net_amount IS NULL
ORDER BY created_at DESC;
```

### Réservations avec `host_net_amount` rempli (nouvelles)
```sql
-- Réservations créées après le 30 janvier 2025
SELECT id, created_at, total_price, host_net_amount
FROM bookings
WHERE host_net_amount IS NOT NULL
ORDER BY created_at DESC;
```

---

## 🔄 RECALCUL POUR LES ANCIENNES RÉSERVATIONS

### Script de migration disponible
- **Fichier**: `20250131000000_recalculate_host_net_amount.sql`
- **Fonction**: `recalculate_host_net_amount_for_all_bookings()`
- **Action**: Recalcule et met à jour `host_net_amount` pour toutes les réservations existantes

**Note**: Ce script n'a peut-être pas été exécuté, donc certaines anciennes réservations peuvent encore avoir `host_net_amount = NULL`.

---

## 📋 IMPACT SUR LE CODE

### Code actuel (avec fallback)
Le code actuel gère les deux cas :

```typescript
// ✅ BON - Fallback pour anciennes réservations
if (booking.host_net_amount !== null && booking.host_net_amount !== undefined) {
  // Utiliser la valeur stockée (réservations créées après le 30 janvier 2025)
  return booking.host_net_amount;
} else {
  // Recalculer pour anciennes réservations (créées avant le 30 janvier 2025)
  return calculateHostNetAmount({...}).hostNetAmount;
}
```

### Code recommandé (après migration complète)
Une fois que toutes les réservations ont `host_net_amount` rempli :

```typescript
// ✅ SIMPLIFIÉ - Utiliser directement la valeur stockée
return booking.host_net_amount ?? 0;
```

---

## ✅ RÉSUMÉ

| Période | `total_price` | `host_net_amount` |
|---------|---------------|-------------------|
| **Avant le 30 janvier 2025** | ✅ Stocké | ❌ N'existe pas |
| **Après le 30 janvier 2025** | ✅ Stocké | ✅ Stocké (nouvelles réservations) |
| **Anciennes réservations** | ✅ Stocké | ⚠️ NULL (sauf si recalculé) |

---

## 🎯 RECOMMANDATION

Pour garantir la cohérence :

1. **Exécuter le script de recalcul** (`20250131000000_recalculate_host_net_amount.sql`) pour remplir `host_net_amount` pour toutes les anciennes réservations
2. **Modifier le code** pour utiliser directement `booking.host_net_amount` au lieu de recalculer
3. **Vérifier** qu'il n'y a plus de réservations avec `host_net_amount = NULL`

