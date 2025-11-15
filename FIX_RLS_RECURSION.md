# 🔧 Correction de la récursion infinie dans les politiques RLS pour profiles

## ❌ Problème

L'erreur suivante se produit lors de la mise à jour du profil ou de la vérification du code :
```
ERROR: infinite recursion detected in policy for relation "profiles"
```

## 🔍 Cause

La fonction `check_user_role` est utilisée dans les politiques RLS de la table `profiles`. Quand une politique RLS appelle `check_user_role`, cette fonction lit depuis `profiles`, ce qui déclenche à nouveau les politiques RLS, créant une récursion infinie.

## ✅ Solution

Le script `fix-profiles-rls-recursion.sql` modifie la fonction `check_user_role` pour qu'elle contourne complètement RLS en :
1. Utilisant `SECURITY DEFINER` pour exécuter avec les permissions du propriétaire
2. Désactivant temporairement RLS avec `SET LOCAL row_security = off`
3. Utilisant `plpgsql` au lieu de `sql` pour pouvoir désactiver RLS

## 📋 Instructions d'application

### Option 1 : Via le Dashboard Supabase (Recommandé)

1. Ouvrez votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête
4. Copiez-collez le contenu du fichier `fix-profiles-rls-recursion.sql`
5. Cliquez sur **Run** pour exécuter le script

### Option 2 : Via Supabase CLI

```bash
# Si vous avez Supabase CLI installé
supabase db execute --file fix-profiles-rls-recursion.sql
```

## 🔍 Diagnostic

Si l'erreur persiste après avoir appliqué la correction, utilisez le script de diagnostic :

1. Exécutez `check-rls-function.sql` dans le SQL Editor de Supabase
2. Vérifiez que la fonction utilise bien `plpgsql` et contient `SET LOCAL row_security = off`
3. Si la fonction n'est pas correctement corrigée, exécutez `force-fix-rls-function.sql`

## 🧪 Vérification

Après avoir exécuté le script, testez :

1. **Mise à jour du profil** : Essayez de mettre à jour votre profil dans l'application
2. **Vérification du code** : Essayez de vérifier un code de vérification email

Les erreurs de récursion infinie ne devraient plus apparaître.

**Note** : L'application mobile a été modifiée pour gérer gracieusement l'erreur RLS si elle se produit, donc même si l'erreur apparaît dans les logs, l'application continue de fonctionner normalement.

## 📝 Notes

- Ce script modifie la fonction `check_user_role` qui est utilisée dans plusieurs politiques RLS
- La fonction continue de fonctionner de la même manière, mais sans causer de récursion
- Les permissions restent les mêmes (authenticated et anon peuvent exécuter la fonction)

## 🔗 Références

- Migration originale : `cote-d-ivoire-stays/supabase/migrations/20250924121704_b26cadc8-e6ad-468a-807b-d403425c45dc.sql`
- Documentation Supabase RLS : https://supabase.com/docs/guides/auth/row-level-security

