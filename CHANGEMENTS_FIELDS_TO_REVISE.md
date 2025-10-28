# ✅ Correction: Migration de revision_fields vers fields_to_revise

## Problème identifié
L'application mobile utilisait `revision_fields` (type TEXT[]) alors que la base de données et le site web utilisent `fields_to_revise` (type JSONB/Record<string, boolean>).

**Erreur obtenue:**
```
ERROR  Supabase error: {"code": "PGRST204", "message": "Could not find the 'revision_fields' column of 'host_applications' in the schema cache"}
```

## Solution appliquée

### Changements dans les interfaces TypeScript

**useHostApplications.ts:**
```typescript
// Avant
revision_fields?: string[];

// INSER
fields_to_revise?: Record<string, boolean>;
```

**useAdmin.ts:**
```typescript
// Paramètre de fonction
fieldsToRevise?: Record<string, boolean>  // au lieu de revisionFields?: string[]

// Mise à jour dans updateData
if (fieldsToRevise && Object.keys(fieldsToRevise).length > 0) {
  updateData.fields_to_revise = fieldsToRevise;
}

// Logique de mise à jour de propriété
if (fullApplication?.fields_to_revise && Object.keys(fullApplication.fields_to_revise).length > 0) {
  const fieldsToUpdate = fullApplication.fields_to_revise;
  
  // Avant: if (fieldsToUpdate.includes('title'))
  // Maintenant:
  if (fieldsToUpdate.title === true) updates.title = fullApplication.title;
  // ... pour chaque champ
}
```

### Changements dans les écrans

**AdminApplicationsScreen.tsx:**
```typescript
// État
const [fieldsToRevise, setFieldsToRevise] = useState<Record<string, boolean>>({});

// Sélection d'un champ
onPress={() => {
  setFieldsToRevise(prev => ({
    ...prev,
    [field.key]: !prev[field.key]
  }));
}}

// Vérification
fieldsToRevise[field.key]  // au lieu de revisionFields.includes(field.key)
Object.keys(fieldsToRevise).filter(k => fieldsToRevise[k]).length  // pour compter les champs sélectionnés
```

**MyHostApplicationsScreen.tsx et ApplicationDetailsScreen.tsx:**
```typescript
// Affichage
{application.fields_to_revise && Object.keys(application.fields_to_revise).length > 0 && (
  Object.keys(application.fields_to_revise)
    .filter(field => application.fields_to_revise[field] === true)
    .map((field, index) => ...)
)}
```

**BecomeHostScreen.tsx:**
```typescript
// État
const [fieldsToRevise, setFieldsToRevise] = useState<Record<string, boolean>>({});

// Fonction shouldShowField
const shouldShowField = (fieldName: string) => {
  if (!isEditMode || Object.keys(fieldsToRevise).length === 0) return true;
  return fieldsToRevise[fieldName] === true;
};

// Chargement
if (application.fields_to_revise && application.status === 'reviewing') {
  setFieldsToRevise(application.fields_to_revise);
}
```

## Format des données

### Structure dans la base de données
```json
{
  "title": true,
  "description": true,
  "price_per_night": true
}
```

### Utilisation dans l'application
```typescript
// Créer l'objet
fieldsToRevise = {
  title: true,
  description: true
}

// Vérifier si un champ est sélectionné
if (fieldsToRevise.title === true) { ... }

// Compter les champs sélectionnés
Object.keys(fieldsToRevise).filter(k => fieldsToRevise[k]).length

// Itérer sur les champs sélectionnés
Object.keys(fieldsToRevise)
  .filter(field => fieldsToRevise[field] === true)
  .map(field => ...)
```

## Fichiers modifiés

1. ✅ `src/hooks/useHostApplications.ts`
2. ✅ `src/hooks/useAdmin.ts`
3. ✅ `src/screens/AdminApplicationsScreen.tsx`
4. ✅ `src/screens/MyHostApplicationsScreen.tsx`
5. ✅ `src/screens/ApplicationDetailsScreen.tsx`
6. ✅ `src/screens/BecomeHostScreen.tsx`

## Résultat

L'application mobile utilise maintenant le même format que le site web (`fields_to_revise` au lieu de `revision_fields`), ce qui permet:
- ✅ La compatibilité avec la base de données existante
- ✅ La cohérence entre l'application web et mobile
- ✅ Pas besoin de migrations de base de données supplémentaires

## Prochaines étapes

1. Tester la fonctionnalité de révision dans l'application mobile
2. Vérifier que les champs sont correctement sauvegardés
3. Confirmer que l'affichage des champs à modifier fonctionne côté host

