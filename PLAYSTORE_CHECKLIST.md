# Checklist publication Google Play Store

Modifications techniques effectuées :
- ✅ `targetSdkVersion` 35 (expo-build-properties)
- ✅ Politique de confidentialité : URLs mises à jour vers `/privacy`
- ✅ Token Supabase retiré des fichiers MD (à régénérer si déjà exposé)
- ✅ SupabaseTest masqué en production (visible uniquement en `__DEV__`)

---

## Actions manuelles requises avant soumission

### 1. Politique de confidentialité (obligatoire)
Créer et publier une vraie politique de confidentialité à :
- **Page web** : https://akwahome.com/privacy
- **PDF** (optionnel) : https://akwahome.com/documents/privacy-policy.pdf

Contenu à inclure : collecte, utilisation, partage et conservation des données (Supabase, identité, documents, etc.).

### 2. Token Supabase exposé
Si le token `sbp_...` était déjà poussé en public : le **révoquer** dans le dashboard Supabase et en générer un nouveau.

### 3. Play Console
- **Data Safety** : formulaire complet (types de données, objectif, partage)
- **Classement du contenu** : questionnaire IARC
- **Politique de confidentialité** : URL `https://akwahome.com/privacy` dans la fiche
- **Feature graphic** : 1024×500 px
- **Captures d’écran** : 2 à 8 par type d’appareil
