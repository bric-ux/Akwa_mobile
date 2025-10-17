# 🚀 Déploiement de la page de réinitialisation de mot de passe

## 📋 Étapes à suivre

### 1. **Configurer Supabase**
- Remplacez `your-project.supabase.co` par votre vraie URL Supabase
- Remplacez `your-anon-key` par votre vraie clé anonyme Supabase

### 2. **Héberger la page**
- Uploadez `reset-password.html` sur votre serveur web
- Assurez-vous qu'elle soit accessible via `https://akwahome.com/reset-password.html`

### 3. **Configurer les redirections dans Supabase**
- Allez dans votre dashboard Supabase
- Section "Authentication" → "URL Configuration"
- Ajoutez `https://akwahome.com/reset-password.html` dans "Site URL" et "Redirect URLs"

### 4. **Tester le flux complet**
1. Utilisateur clique "Réinitialiser le mot de passe" dans l'app
2. Email envoyé avec le lien vers votre page web
3. Utilisateur clique sur le lien
4. Page web s'ouvre avec le formulaire
5. Utilisateur saisit son nouveau mot de passe
6. Mot de passe mis à jour dans Supabase
7. Redirection vers l'app mobile

## 🔧 Configuration requise

### Variables à modifier dans `reset-password.html` :
```javascript
const supabaseUrl = 'https://votre-projet.supabase.co';
const supabaseKey = 'votre-cle-anonyme';
```

### URL de redirection dans l'app mobile :
```javascript
redirectTo: 'https://akwahome.com/reset-password.html'
```

## ✅ Avantages de cette approche

1. **Sécurité** : Token géré par Supabase
2. **UX** : Interface web dédiée et professionnelle
3. **Flexibilité** : Facile à personnaliser et maintenir
4. **Compatibilité** : Fonctionne sur tous les appareils
5. **Intégration** : Se connecte directement à votre base Supabase

## 🎯 Fonctionnalités de la page

- ✅ Validation des mots de passe
- ✅ Interface responsive
- ✅ Gestion d'erreurs
- ✅ Loading states
- ✅ Redirection vers l'app mobile
- ✅ Design cohérent avec votre marque

