# 🔍 Diagnostic : Problème d'envoi d'email de vérification

## Problèmes possibles et solutions

### 1. ❌ Variable d'environnement `RESEND_API_KEY` manquante

**Symptôme :** Les emails ne sont pas envoyés, erreur "RESEND_API_KEY n'est pas définie"

**Solution :**
1. Connectez-vous à votre compte Resend : https://resend.com/api-keys
2. Créez ou récupérez votre clé API
3. Dans Supabase Dashboard :
   - Allez dans **Settings** > **Edge Functions** > **Secrets**
   - Ajoutez la variable `RESEND_API_KEY` avec votre clé API
   - Redéployez les fonctions Edge

### 2. ❌ Clé API Resend invalide ou expirée

**Symptôme :** Erreur "Invalid API key" ou "Unauthorized"

**Solution :**
1. Vérifiez votre clé API sur https://resend.com/api-keys
2. Générez une nouvelle clé si nécessaire
3. Mettez à jour `RESEND_API_KEY` dans Supabase Dashboard
4. Redéployez les fonctions Edge

### 3. ❌ Domaine d'envoi non vérifié

**Symptôme :** Erreur liée au domaine, emails non envoyés

**Solution :**
1. Vérifiez vos domaines sur https://resend.com/domains
2. Si vous utilisez `onboarding@resend.dev`, c'est un domaine de test qui fonctionne uniquement pour les emails de test
3. Pour la production, vous devez :
   - Ajouter et vérifier votre propre domaine dans Resend
   - Modifier le `from` dans `send-email/index.ts` pour utiliser votre domaine vérifié

### 4. ❌ Fonctions Edge non déployées

**Symptôme :** Erreur "Function not found" ou 404

**Solution :**
```bash
cd cote-d-ivoire-stays
supabase functions deploy generate-verification-code
supabase functions deploy send-email
```

### 5. ❌ Emails dans les spams

**Symptôme :** Les emails sont envoyés mais n'arrivent pas dans la boîte de réception

**Solution :**
1. Vérifiez le dossier spam/courrier indésirable
2. Utilisez un domaine vérifié au lieu de `onboarding@resend.dev`
3. Configurez SPF, DKIM et DMARC pour votre domaine dans Resend

## 🔧 Étapes de diagnostic

### Étape 1 : Vérifier les logs des fonctions Edge

```bash
cd cote-d-ivoire-stays
supabase functions logs send-email --tail
supabase functions logs generate-verification-code --tail
```

### Étape 2 : Tester l'envoi d'email manuellement

Créez un script de test ou utilisez l'interface Supabase pour appeler directement la fonction `send-email`.

### Étape 3 : Vérifier la configuration Resend

1. **Clé API :** https://resend.com/api-keys
2. **Domaines :** https://resend.com/domains
3. **Logs d'envoi :** https://resend.com/emails (pour voir les emails envoyés)

## 📝 Modifications apportées

J'ai amélioré la gestion des erreurs dans les fonctions Edge :

1. **`send-email/index.ts`** :
   - Vérification de la présence de `RESEND_API_KEY`
   - Vérification du statut de la réponse Resend
   - Messages d'erreur plus explicites

2. **`generate-verification-code/index.ts`** :
   - Meilleure gestion des erreurs d'envoi d'email
   - Vérification de la réponse de `send-email`

## 🚀 Prochaines étapes

1. **Redéployez les fonctions Edge** avec les corrections :
   ```bash
   cd cote-d-ivoire-stays
   supabase functions deploy send-email
   supabase functions deploy generate-verification-code
   ```

2. **Vérifiez la configuration Resend** :
   - Clé API valide
   - Domaine vérifié (pour la production)

3. **Testez l'envoi d'email** avec un email réel

4. **Vérifiez les logs** pour identifier les erreurs spécifiques

## 📧 Configuration recommandée pour la production

1. **Ajoutez votre propre domaine** dans Resend
2. **Vérifiez le domaine** (SPF, DKIM, DMARC)
3. **Modifiez le `from`** dans `send-email/index.ts` :
   ```typescript
   from: "AkwaHome <noreply@votre-domaine.com>",
   ```

## 🔗 Liens utiles

- [Documentation Resend](https://resend.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Configuration des secrets Supabase](https://supabase.com/docs/guides/functions/secrets)






