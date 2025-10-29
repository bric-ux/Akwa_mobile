# 🔄 Résumé de la Logique de Révision des Candidatures

## Vue d'ensemble

Cette documentation décrit la logique de révision des candidatures d'hôtes implémentée dans l'application mobile AkwaHome, similaire au site web.

## 📊 Architecture de la Révision

### États d'une candidature
- **pending** : En attente d'examen
- **reviewing** : En révision (modifications requises)
- **approved** : Approuvée
- **rejected** : Refusée

### Colonnes de base de données
- `revision_message` : Message envoyé par l'admin expliquant les modifications nécessaires
- `revision_fields` : Liste des champs spécifiques à modifier (array de strings)
- `status` : Statut actuel de la candidature
- `reviewed_at` : Date de la dernière révision
- `admin_notes` : Notes internes pour les admins

## 👤 Côté Admin (AdminApplicationsScreen)

### Fonctionnalités
1. **Vue des candidatures** : Liste avec filtres par statut
2. **Mise en révision** : Action pour mettre une candidature en révision
3. **Sélection des champs** : Admin peut sélectionner quels champs doivent être modifiés
4. **Message de révision** : Admin peut ajouter un message explicatif
5. **Envoi d'email** : Notification automatique envoyée à l'hôte

### Workflow Admin
```
1. Admin ouvre la candidature
2. Sélectionne les champs à modifier dans la liste déroulante
3. Entre un message de révision (OBLIGATOIRE)
4. Clique sur "Mettre en révision"
5. Status change → 'reviewing'
6. Email envoyé à l'hôte
```

### Code clé (AdminApplicationsScreen.tsx)
```typescript
// État pour les champs de révision
const [revisionFields, setRevisionFields] = useState<string[]>([]);
const [revisionMessage, setRevisionMessage] = useState('');

// Mise à jour de statut
const handleStatusUpdate = async (applicationId, status) => {
  const revisionFieldsToSend = status === 'reviewing' ? revisionFields : undefined;
  const result = await updateApplicationStatus(
    applicationId, 
    status, 
    revisionMessage, 
    undefined, 
    revisionFieldsToSend
  );
};
```

## 🏠 Côté Host (MyHostApplicationsScreen + BecomeHostScreen)

### Fonctionnalités
1. **Visualisation** : L'hôte voit les candidatures en révision
2. **Message de révision** : Affichage du message de l'admin
3. **Champs à modifier** : Seuls les champs sélectionnés par l'admin sont éditables
4. **Modification** : Hôte peut modifier les champs demandés
5. **Re-soumission** : Status reste "reviewing" après modification

### Workflow Host
```
1. Hôte voit notification de révision
2. Ouvre la candidature en révision
3. Voit le message explicatif
4. Clique sur "Modifier la candidature"
5. Seuls les champs demandés sont affichés
6. Modifie les champs
7. Sauvegarde
8. Status reste "reviewing" (re-examen nécessaire)
```

### Code clé (BecomeHostScreen.tsx)
```typescript
// Fonction pour afficher seulement les champs à modifier
const shouldShowField = (fieldName: string) => {
  if (!isEditMode || revisionFields.length === 0) return true;
  return revisionFields.includes(fieldName);
};

// Chargement des champs de révision
if (application.revision_fields && application.status === 'reviewing') {
  setRevisionFields(application.revision_fields);
}
```

### Affichage dans MyHostApplicationsScreen
```typescript
// Encart pour modifications requises
{application.status === 'reviewing' && application.revision_message && 
 !application.revision_message.startsWith('Modifications:') && (
  <View style={styles.revisionContainer}>
    <Text>⚠️ Modifications requises</Text>
    <Text>{application.revision_message}</Text>
    <Button>Modifier la candidature</Button>
  </View>
)}

// Encart pour modifications soumises
{application.status === 'reviewing' && 
 application.revision_message?.startsWith('Modifications:') && (
  <View style={styles.revisionSubmittedContainer}>
    <Text>✅ Modifications soumises</Text>
    <Text>{application.revision_message}</Text>
  </View>
)}
```

## 📝 Champs pouvant être révisés

Les champs suivants peuvent être sélectionnés pour révision :

```typescript
const revisionFieldsOptions = [
  { key: 'title', label: 'Titre' },
  { key: 'description', label: 'Description' },
  { key: 'property_type', label: 'Type de propriété' },
  { key: 'location', label: 'Localisation' },
  { key: 'price_per_night', label: 'Prix par nuit' },
  { key: 'max_guests', label: 'Capacité' },
  { key: 'bedrooms', label: 'Chambres' },
  { key: 'bathrooms', label: 'Salles de bain' },
  { key: 'images', label: 'Photos' },
  { key: 'amenities', label: 'Équipements' },
  { key: 'minimum_nights', label: 'Nuitées minimum' },
  { key: 'cancellation_policy', label: 'Politique d\'annulation' },
];
```

## 🔔 Notifications Email

### Email de révision
```typescript
// Envoyé automatiquement lors de la mise en révision
{
  type: 'application_revision',
  to: host_email,
  data: {
    firstName: host_first_name,
    revisionMessage: revision_message,
    propertyTitle: application_title
  }
}
```

## 🔄 Cycle de vie complet

```
1. Soumission initiale
   └─ Status: pending

2. Admin met en révision
   ├─ Status: reviewing
   ├─ revision_fields: ['title', 'description']
   ├─ revision_message: "Veuillez améliorer le titre..."
   └─ Email envoyé à l'hôte

3. Hôte modifie
   ├─ Seulement les champs de revision_fields sont affichés
   ├─ Sauvegarde les modifications
   └─ revision_message devient: "Modifications:\nTitre: ..."

4. Admin re-examine
   ├─ Status: reste reviewing
   ├─ Peut voir les modifications effectuées
   └─ Peut approuver ou demander d'autres modifications

5. Approbation finale
   └─ Status: approved
```

## 🎨 Interface Utilisateur

### Côté Admin
- **Liste des candidatures** avec badges colorés par statut
- **Modal de détails** avec tous les champs
- **Sélecteur de champs** avec checkboxes
- **Zone de message** avec validation
- **Boutons d'action** : Mettre en révision, Approuver, Refuser

### Côté Host
- **Carte de candidature** avec statut visible
- **Encart de révision** jaune avec message
- **Bouton "Modifier"** pour accéder à l'édition
- **Formulaire filtré** montrant seulement les champs à modifier
- **Confirmation** après sauvegarde

## ✅ Points forts de l'implémentation

1. **Flexibilité** : Admin peut sélectionner exactement les champs à modifier
2. **Transparence** : Hôte voit clairement ce qui est demandé
3. **Traçabilité** : Historique des modifications conservé
4. **Sécurité** : Validation côté client et serveur
5. **UX** : Interface claire et intuitive
6. **Notifications** : Emails automatiques pour informer les parties

## 🚀 Améliorations possibles

1. **Rich text** : Permettre le formatage dans les messages de révision
2. **Pièces jointes** : Admin pourrait joindre des exemples ou références
3. **Deadline** : Ajouter une date limite pour les modifications
4. **Historique** : Log de toutes les révisions successives
5. **Templates** : Messages de révision pré-définis
6. **Champs de révision dynamiques** : Permettre à l'admin de créer des champs personnalisés

## 📚 Fichiers modifiés

- `src/hooks/useAdmin.ts` : Logique admin de gestion des révisions
- `src/hooks/useHostApplications.ts` : Récupération et mise à jour des candidatures
- `src/screens/AdminApplicationsScreen.tsx` : Interface admin
- `src/screens/MyHostApplicationsScreen.tsx` : Liste des candidatures host
- `src/screens/BecomeHostScreen.tsx` : Formulaire d'édition
- `src/screens/ApplicationDetailsScreen.tsx` : Détails d'une candidature
- `add-revision-columns.sql` : Migration de base de données

## 🔗 Comparaison avec le site web

| Fonctionnalité | Site Web | Mobile | Status |
|----------------|----------|---------|--------|
| Mise en révision par admin | ✅ | ✅ | Identique |
| Sélection des champs | ✅ | ✅ | Identique |
| Message de révision | ✅ | ✅ | Identique |
| Affichage côté host | ✅ | ✅ | Identique |
| Édition filtrée | ✅ | ✅ | Identique |
| Re-soumission | ✅ | ✅ | Identique |
| Emails | ✅ | ✅ | Identique |
| Historique | ✅ | ✅ | Identique |

## 📝 Notes techniques

- La mobile app utilise `revision_fields` (array) tandis que le web utilise `fields_to_revise` (object)
- Les deux approches fonctionnent, mais le format array est plus simple
- La détection des modifications est faite côté client dans `updateApplication`
- Le message "Modifications:" est un préfixe pour distinguer les messages de l'admin et de l'hôte



