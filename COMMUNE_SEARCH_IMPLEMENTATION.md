# Recherche par Commune - Documentation

## 🎯 Objectif
Permettre aux utilisateurs de rechercher des propriétés par commune en plus des villes et quartiers existants.

## 🔧 Modifications Apportées

### 1. Hook `useProperties.ts`
**Fichier:** `src/hooks/useProperties.ts`

**Améliorations:**
- Ajout d'une recherche directe dans le champ `commune` de la table `neighborhoods`
- Logique de recherche en cascade : Ville → Quartier → Commune
- Messages de log améliorés pour le débogage

**Code ajouté:**
```typescript
// Chercher directement dans les communes (priorité avant les quartiers)
const { data: communeExists } = await supabase
  .from('neighborhoods')
  .select('city_id, name, commune')
  .ilike('commune', searchTerm)
  .single();

if (communeExists) {
  cityId = communeExists.city_id;
  console.log(`✅ Commune trouvée: "${communeExists.commune}" pour la recherche "${searchTerm}"`);
}
```

### 2. Composant `AutoCompleteSearch.tsx`
**Fichier:** `src/components/AutoCompleteSearch.tsx`

**Améliorations:**
- Ajout du type `'commune'` dans l'interface `SearchSuggestion`
- Recherche dans les communes pour l'autocomplétion (priorité avant les quartiers)
- **Affichage simplifié des communes** : Juste le nom de la commune avec "Commune" comme sous-titre
- Suggestions distinctes pour les communes avec icône appropriée

**Code ajouté:**
```typescript
// Recherche dans les communes (priorité avant les quartiers)
const { data: communes, error: communesError } = await supabase
  .from('neighborhoods')
  .select('commune')
  .ilike('commune', `%${searchQuery}%`)
  .limit(5);

if (!communesError && communes) {
  // Éviter les doublons de communes en utilisant un Set
  const uniqueCommunes = [...new Set(communes.map(c => c.commune))];
  
  uniqueCommunes.forEach((communeName, index) => {
    suggestions.push({
      id: `commune_${index}`,
      text: communeName,
      type: 'commune',
      icon: 'location-outline',
      subtitle: 'Commune',
    });
  });
}
```

### 3. Hook `useLocationSearch.ts`
**Fichier:** `src/hooks/useLocationSearch.ts`

**Améliorations:**
- Ajout du type `'commune'` dans l'interface `LocationResult`
- Recherche intelligente dans les communes avec scoring
- Tri amélioré : Villes → Communes → Quartiers

**Code ajouté:**
```typescript
// Recherche intelligente dans les communes avec score
neighborhoods.forEach(neighborhood => {
  const communeScore = calculateRelevanceScore({ name: neighborhood.commune }, query, 'commune');
  if (communeScore > 0) {
    const existingResult = results.find(r => r.id === neighborhood.id);
    if (!existingResult) {
      results.push({
        id: `commune_${neighborhood.id}`,
        name: neighborhood.commune,
        type: 'commune' as const,
        commune: neighborhood.commune,
        city_id: neighborhood.city_id,
        score: communeScore
      });
    }
  }
});
```

## 🗄️ Structure de la Base de Données

### Table `neighborhoods`
```sql
CREATE TABLE neighborhoods (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,        -- Nom du quartier
  commune VARCHAR NOT NULL,     -- Nom de la commune
  city_id UUID REFERENCES cities(id)
);
```

## 🔍 Fonctionnalités de Recherche

### 1. Recherche en Cascade
La recherche suit cette logique :
1. **Villes** : Recherche exacte dans `cities.name`
2. **Communes** : Recherche dans `neighborhoods.commune` (priorité avant les quartiers)
3. **Quartiers** : Recherche dans `neighborhoods.name`

### 2. Autocomplétion Intelligente
- Suggestions triées par pertinence
- Types distincts : Ville, Commune, Quartier
- **Communes affichées simplement** : Juste le nom de la commune avec "Commune" comme sous-titre
- **Ordre de priorité** : Villes → Communes → Quartiers → Propriétés
- Icônes appropriées pour chaque type
- Limitation à 8 suggestions maximum

### 3. Scoring et Tri
- Score de pertinence basé sur la correspondance exacte/partielle
- Tri par : Score → Type → Nom alphabétique
- Ordre de priorité : Villes → Communes → Quartiers

## 🧪 Tests

### Script de Test
Un script de test a été créé : `test-commune-search.js`

**Pour l'exécuter :**
```bash
cd AkwaHomeMobile
node test-commune-search.js
```

**Tests inclus :**
- Recherche dans les communes
- Recherche dans les quartiers
- Recherche dans les villes
- Logique de recherche complète
- Vérification de la structure des données

## 📱 Utilisation

### Pour l'Utilisateur
1. Taper le nom d'une commune dans la barre de recherche
2. Les suggestions apparaissent avec le type "Commune"
3. Sélectionner une commune pour voir les propriétés disponibles

### Exemples de Recherche
- **"Cocody"** → Trouve toutes les propriétés de la commune de Cocody
- **"Angré"** → Trouve le quartier Angré dans Cocody
- **"Abidjan"** → Trouve toutes les propriétés d'Abidjan

## 🚀 Avantages

1. **Meilleure UX** : Recherche plus intuitive par commune
2. **Couverture étendue** : Plus de résultats de recherche
3. **Flexibilité** : Recherche par ville, quartier ou commune
4. **Performance** : Requêtes optimisées avec limites
5. **Débogage** : Logs détaillés pour le développement
6. **Pas de doublons** : Évite les suggestions multiples pour la même commune

## 🔧 Correction des Doublons

### Problème Identifié
Quand plusieurs quartiers appartiennent à la même commune (ex: Yopougon Sicogi, Yopougon Ananeraie), la recherche retournait plusieurs suggestions identiques "Yopougon".

### Solution Implémentée
- Utilisation d'un `Set` pour éliminer les doublons de noms de communes
- Modification de la requête pour ne sélectionner que le champ `commune`
- Logique de déduplication dans `useLocationSearch` avec un `Map`

### Code de Correction
```typescript
// Éviter les doublons de communes en utilisant un Set
const uniqueCommunes = [...new Set(communes.map(c => c.commune))];
```

## 🔧 Configuration Requise

- Supabase configuré avec les tables `cities` et `neighborhoods`
- Colonne `commune` remplie dans la table `neighborhoods`
- Relations correctes entre `neighborhoods.city_id` et `cities.id`

## 📝 Notes de Développement

- Les modifications sont rétrocompatibles
- Aucun changement de schéma de base de données requis
- Les logs de débogage peuvent être supprimés en production
- Le script de test peut être supprimé après validation
