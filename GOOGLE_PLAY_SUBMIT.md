# Soumettre l'app Android sur Google Play (EAS Submit)

## Fichier requis : `google-service-account.json`

EAS est configuré pour utiliser le fichier **`google-service-account.json`** à la racine du projet (`AkwaHomeMobile/`). Tant que ce fichier n'existe pas, la commande affichera "File does not exist".

### Étapes à suivre

**1. Créer et télécharger la clé (Google Cloud)**

1. Va sur **[Google Cloud Console](https://console.cloud.google.com/)** (même compte que la Play Console).
2. Choisis le projet lié à ton app.
3. **IAM et administration** → **Comptes de service** → **Créer un compte de service** (ex. nom : `eas-submit`) → **Créer et continuer** → **Terminer**.
4. Clique sur le compte créé → onglet **Clés** → **Ajouter une clé** → **Créer une clé** → **JSON** → **Créer**.  
   Un fichier JSON est téléchargé (nom du type `ton-projet-xxxxx.json`).

**2. Donner accès à la Play Console**

1. **[Play Console](https://play.google.com/console)** → **Paramètres** (engrenage) → **Utilisateurs et autorisations**.
2. **Inviter des utilisateurs** (ou **Comptes API**) et ajoute l'**email du compte de service** (ex. `xxx@xxx.iam.gserviceaccount.com`, visible dans le JSON).
3. Rôle : **Admin** (ou au moins accès pour publier). Enregistre.

**3. Placer le fichier dans le projet**

- Renomme le fichier JSON téléchargé en : **`google-service-account.json`**
- Place-le **à la racine du projet** :  
  `~/dev_pers/AkwaHomeMobile/google-service-account.json`

Exemple en ligne de commande (remplace par le vrai chemin du fichier téléchargé) :

```bash
cp ~/Downloads/ton-projet-xxxxx-xxxxx.json ~/dev_pers/AkwaHomeMobile/google-service-account.json
```

**4. Lancer la soumission**

```bash
cd ~/dev_pers/AkwaHomeMobile
eas submit --platform android --profile internal --latest
```

EAS lira automatiquement `./google-service-account.json` ; tu n'as rien à saisir au prompt.

**Important** : `google-service-account.json` est dans `.gitignore` — ne le committe pas.
