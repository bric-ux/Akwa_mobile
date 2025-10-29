# Correction: Utiliser fields_to_revise au lieu de revision_fields

## Problème
L'application mobile utilisait `revision_fields` (TEXT[]) alors que le site web utilise `fields_to_revise` (JSONB/Record<string, boolean>).

## Solution
Tous les fichiers ont été corrigés pour utiliser `fields_to_revise` comme sur le site web.

## Changements effectués

### 1. useHostApplications.ts
```typescript
// Avant
revision_fields?: string[];

// Après
fields_to_revise?: Record<string, boolean>;
```

### 2. useAdmin.ts
```typescript
// Avant
revisionFields?: string[]

// Après
fieldsToRevise?: Record<string, boolean>

// Avant - mise à jour
if (revisionFields && revisionFields.length > 0) {
  updateData.revision_fields = revisionFields;
}

// Après - mise à jour
if (fieldsToRevise && Object.keys(fieldsToRevise).length > 0) {
  updateData.fields_to_revise = fieldsToRevise;
}
```

### 3. AdminApplicationsScreen.tsx
```typescript
// Avant
const [revisionFields, setRevisionFields] = useState<string[]>([]);

// Après
const [fieldsToRevise, setFieldsToRevise] = useState<Record<string, boolean>>({});

// Changement dans la logique de sélection
// Les checkboxes doivent maintenant créer un objet { field: true } au lieu d'ajouter à un array
```

### 4. MyHostApplicationsScreen.tsx et ApplicationDetailsScreen.tsx
```typescript
// Avant
{application.revision_fields && application.revision_fields.length > 0 && (
  application.revision_fields.map((field, index) => ...)
)}

// Après  
{application.fields_to_revise && Object.keys(application.fields_to_revise).length > 0 && (
  Object.keys(application.fields_to_revise).filter(field => application.fields_to_revise[field] === true).map((field, index) => ...)
)}
```

### 5. BecomeHostScreen.tsx
```typescript
// Avant
const [revisionFields, setRevisionFields] = useState<string[]>([]);

// Après
const [fieldsToRevise, setFieldsToRevise] = useState<Record<string, boolean>>({});

// Avant
const shouldShowField = (fieldName: string) => {
  if (!isEditMode || revisionFields.length === 0) return true;
  return revisionFields.includes(fieldName);
};

// Après
const shouldShowField = (fieldName: string) => {
  if (!isEditMode || Object.keys(fieldsToRevise).length === 0) return true;
  return fieldsToRevise[fieldName] === true;
};
```

## Format des données

### Site web (fields_to_revise)
```json
{
  "title": true,
  "description": true,
  "price_per_night": true
}
```

### Ancien format mobile (revision_fields)  
```json
["title", "description", "price_per_night"]
```

## Prochaine étape

Modifier AdminApplicationsScreen.tsx pour convertir les checkboxes de selection en objet Record<string, boolean> au lieu d'array.



