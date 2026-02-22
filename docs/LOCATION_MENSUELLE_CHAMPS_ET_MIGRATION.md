# Informations pour la création d’une location mensuelle

## Champs utilisés dans l’app (création / édition)

Lors de l’activation « Proposer ce bien en location mensuelle » dans **Modifier l’annonce**, les informations suivantes sont demandées :

| Champ | Obligatoire | Description | Exemple |
|-------|-------------|-------------|---------|
| **Loyer mensuel (FCFA)** | Oui | Prix du loyer par mois demandé au locataire | 150 000 |
| **Caution (FCFA)** | Non | Montant de la caution à l’entrée (souvent 1 ou 2 mois de loyer) | 300 000 |
| **Durée minimale (mois)** | Non | Engagement minimum en mois | 3, 6, 12 |
| **Charges incluses** | Non (switch) | Eau, électricité, etc. inclus dans le loyer | Oui / Non |

En plus de ces champs spécifiques mensuels, l’annonce réutilise les infos déjà renseignées pour le bien (titre, description, photos, équipements, localisation, etc.).

---

## Colonnes à prévoir en base (migration plus tard)

Sur la table **`properties`**, ajouter (si pas déjà fait) :

```sql
-- Déjà prévus dans supabase/migrations/20250221000000_...
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_monthly_rental BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rental_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_rent_price INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS security_deposit INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS minimum_duration_months INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS charges_included BOOLEAN DEFAULT false;
```

- **is_monthly_rental** : le bien est proposé en location mensuelle.
- **monthly_rent_price** : loyer mensuel (FCFA).
- **security_deposit** : caution (FCFA).
- **minimum_duration_months** : durée minimale en mois.
- **charges_included** : charges incluses (true/false).
- **rental_type** : optionnel, pour distinguer `short_term` / `monthly` si besoin.

Le code envoie déjà ces champs à la sauvegarde ; une fois la migration exécutée, ils seront bien persistés.
