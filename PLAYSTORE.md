# Publier AkwaHome Mobile sur le Google Play Store

Ce guide décrit les étapes pour publier l’application **AkwaHomeMobile** (Expo / EAS) sur le Google Play Store.

---

## 1. Prérequis

### 1.1 Compte Google Play Developer
- Créer un compte sur [Google Play Console – Inscription](https://play.google.com/apps/publish/signup/).
- Frais uniques : **25 USD**.

### 1.2 Créer l’application dans la Play Console
- Aller sur [Google Play Console](https://play.google.com/console/).
- Cliquer sur **Créer une application**.
- Renseigner le nom (ex. « AkwaHome »), la langue par défaut et le type (Application).
- L’identifiant du package doit être : **`com.jeanbrice270.AkwaHomeMobile`** (déjà défini dans `app.json`).

### 1.3 Compte de service Google (Service Account)
EAS a besoin d’une clé de compte de service pour envoyer les builds au Play Store.

1. **Projet Google Cloud**  
   - [Créer un projet](https://console.cloud.google.com/projectcreate) (ou en utiliser un existant).

2. **Créer un compte de service**  
   - [Comptes de service](https://console.cloud.google.com/iam-admin/serviceaccounts) → **Créer un compte de service**.  
   - Nom (ex. « EAS Play Store ») → **Terminé**.  
   - Copier l’**adresse e-mail** du compte (ex. `eas-play@mon-projet.iam.gserviceaccount.com`).

3. **Créer une clé JSON**  
   - Sur le compte de service → **Gérer les clés** → **Créer une nouvelle clé** → **JSON** → **Créer**.  
   - Télécharger le fichier `.json` et le conserver en lieu sûr (ne pas le commiter).

4. **Activer l’API Google Play**  
   - [API Google Play Android Developer](https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com) → **Activer**.

5. **Inviter le compte de service dans la Play Console**  
   - Play Console → [Utilisateurs et autorisations](https://play.google.com/console/users-and-permissions) → **Inviter un nouvel utilisateur**.  
   - E-mail : celui du compte de service (étape 2).  
   - Onglet **Autorisations des applications** : sélectionner l’app AkwaHome (ou « Toutes les applications »).  
   - Cocher au minimum : **Gérer les versions en production**, **Gérer les versions en test**, **Voir les informations de l’application**.  
   - **Inviter l’utilisateur**.

6. **Enregistrer la clé dans EAS**  
   - [Tableau de bord EAS](https://expo.dev) → projet **AkwaHomeMobile** → **Credentials** → **Android** → identifiant `com.jeanbrice270.AkwaHomeMobile`.  
   - **Changer la clé du compte de service Google** → **Téléverser une nouvelle clé** → sélectionner le fichier JSON téléchargé.

---

## 2. Build de production

À la racine du projet :

```bash
cd /home/dev_doctoome/dev_pers/AkwaHomeMobile
eas build --platform android --profile production
```

- Le build est fait sur les serveurs EAS (ou en local avec `--local` si configuré).
- À la fin, un **AAB** (Android App Bundle) est généré et disponible sur expo.dev.

Option : build + envoi direct au Play Store :

```bash
eas build --platform android --profile production --auto-submit
```

(Pour que `--auto-submit` fonctionne, la clé du compte de service doit déjà être configurée dans EAS.)

---

## 3. Première soumission (obligatoire : manuelle)

Google impose **au moins une** mise en ligne manuelle avant d’utiliser l’API (donc avant d’utiliser uniquement `eas submit`).

1. Télécharger l’AAB depuis [expo.dev](https://expo.dev) → projet → onglet **Builds** → dernier build Android → **Download**.
2. Dans la [Play Console](https://play.google.com/console/) → votre app → **Production** (ou **Test interne** pour commencer) → **Créer une nouvelle version**.
3. Glisser-déposer l’AAB ou le sélectionner.
4. Renseigner les **notes de version** (texte pour les utilisateurs).
5. Enregistrer et lancer la mise en production (ou en test) selon votre choix.

Une fois cette première version publiée manuellement, les suivantes peuvent être faites avec `eas submit`.

---

## 4. Soumissions suivantes avec EAS Submit

Quand un build de production est prêt :

```bash
eas submit --platform android --profile production
```

Ou en ciblant un build précis :

```bash
eas submit --platform android --profile production --id <BUILD_ID>
```

Le profil **production** dans `eas.json` envoie sur la piste **production** avec `releaseStatus: "completed"` (soumission directe en production). Pour envoyer en test interne ou bêta, vous pouvez ajouter d’autres profils dans `eas.json` (ex. `submit.preview` avec `track: "internal"`).

---

## 5. Fiche Play Store (obligatoire avant publication)

Dans la Play Console, compléter au minimum :

| Élément | Où / Comment |
|--------|----------------|
| **Nom de l’application** | Fiche « Fiche de la boutique » |
| **Description courte** (80 caractères) | Idem |
| **Description complète** (jusqu’à 4000 caractères) | Idem |
| **Icône** 512×512 px | Idem |
| **Graphique de fonctionnalité** 1024×500 px | Idem |
| **Captures d’écran** (téléphone, 2 à 8) | Idem |
| **Politique de confidentialité** | URL publique obligatoire |
| **Classification du contenu** | Questionnaire dans la Play Console |
| **Public cible** (âge) | Idem |
| **Cible et contenu de l’app** (annonces, achats in-app, etc.) | Idem |

Sans ces éléments, la fiche ne pourra pas être validée et la production ne pourra pas être lancée.

---

## 6. Mises à jour après la première publication

Une fois la **première** version publiée manuellement, toutes les **versions suivantes** se font via EAS, sans repasser par la Play Console pour uploader l’AAB :

1. Incrémenter la version dans `app.json` (ex. `1.0.0` → `1.0.1`).
2. Lancer un build :  
   `eas build --platform android --profile production`
3. Soumettre :  
   `eas submit --platform android --profile production`  
   ou en une commande :  
   `eas build --platform android --profile production --auto-submit`

Le `versionCode` Android est incrémenté automatiquement par EAS ; vous n’avez rien à modifier à la main. Vous pourrez ainsi continuer à mettre à jour l’app autant de fois que nécessaire.

---

## 7. Résumé des commandes utiles

```bash
# Connexion EAS
eas login

# Build Android production
eas build --platform android --profile production

# Build + soumission automatique
eas build --platform android --profile production --auto-submit

# Soumettre le dernier build
eas submit --platform android --profile production

# Voir les builds
eas build:list --platform android
```

---

## 8. Configuration actuelle du projet

- **Package Android** : `com.jeanbrice270.AkwaHomeMobile` (`app.json`)
- **Version** : `1.0.0` (`app.json`)
- **EAS** : profil `production` avec incrément automatique de version (`eas.json`)
- **Soumission** : profil `submit.production` avec piste **production** et statut **completed** (`eas.json`)

Pour les mises à jour, incrémenter `version` dans `app.json` (ex. `1.0.1`) avant de lancer un nouveau build ; EAS peut gérer l’incrément du `versionCode` Android via `autoIncrement` déjà configuré.
