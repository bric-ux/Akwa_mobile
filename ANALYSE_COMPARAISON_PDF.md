# Analyse comparative : PDF email vs PDF détails vs Affichage mobile

## 📋 Vue d'ensemble

Il existe **3 systèmes différents** pour afficher les factures :

1. **PDF envoyé par email** (Edge Function `send-email`)
2. **PDF téléchargeable depuis les détails** (site web - `invoicePdfGenerator.ts`)
3. **Affichage visuel dans les détails** (mobile - `InvoiceDisplay.tsx`)

---

## 🔍 1. PDF ENVOYÉ PAR EMAIL

### Fichier : `cote-d-ivoire-stays/supabase/functions/send-email/index.ts`
### Fonction : `generateInvoicePDFForEmail()`

#### Technologie
- **Bibliothèque** : jsPDF (génération côté serveur)
- **Format** : PDF binaire (ArrayBuffer)
- **Génération** : Edge Function Supabase (Deno)

#### Informations affichées

**✅ Inclus :**
- Logo AkwaHome
- Numéro de facture (8 premiers caractères du booking ID)
- Type de service (Hébergement / Location de véhicule)
- Titre de la propriété/véhicule
- Dates (arrivée/départ ou début/fin)
- Durée (nuits/jours)
- Nombre de voyageurs (propriétés uniquement)
- **Section financière** :
  - Prix initial
  - Réduction (si applicable)
  - Prix après réduction
  - Frais de ménage (si > 0)
  - **Frais de service Akwahome** (12% pour propriétés, 10% pour véhicules)
  - **Total payé**
- Mode de paiement
- **Informations importantes** (si disponibles) :
  - Heure d'arrivée
  - Heure de départ
  - **Règlement intérieur** (house_rules)
  - **Politique d'annulation** (cancellation_policy)
- Date de réservation
- Pied de page avec logo

#### ❌ MANQUANT dans le PDF email :
- **Détails TVA** (HT, TVA 20%, TTC) pour les frais de service
- **Section "Politique AkwaHome"** (pour voyageur uniquement)
- **Contact hôte/voyageur** (téléphone, email)
- **Détails de la commission hôte** (pour le justificatif hôte)

#### Format visuel
- Style simple et épuré
- Couleurs : Orange (#F97316) pour les titres, noir pour le texte
- Pas de sections colorées ou de boîtes
- Texte linéaire avec alignement à droite pour les montants

---

## 🔍 2. PDF TÉLÉCHARGEABLE (SITE WEB)

### Fichier : `cote-d-ivoire-stays/src/lib/invoicePdfGenerator.ts`
### Fonction : `generateInvoicePDF()`

#### Technologie
- **Bibliothèque** : HTML/CSS avec `window.print()`
- **Format** : HTML → Impression navigateur → PDF
- **Génération** : Côté client (navigateur)

#### Informations affichées

**✅ Inclus :**
- Logo AkwaHome
- Numéro de facture
- Type de service
- Titre de la propriété/véhicule
- Dates
- Durée
- Nombre de voyageurs
- **Section financière** :
  - Prix initial
  - Réduction (si applicable)
  - Prix après réduction
  - Frais de ménage (si > 0)
  - Frais de service Akwahome
  - Total payé
- Mode de paiement
- **Section "Informations importantes"** :
  - Heure d'arrivée
  - Heure de départ
  - **Règlement intérieur** (house_rules)
  - **Politique d'annulation** (cancellation_policy)
- **Section "Politique AkwaHome"** (pour voyageur uniquement) :
  - Réservations soumises à confirmation
  - Justificatif d'identité
  - Service client
  - Frais de service non remboursables
- Date de réservation
- Pied de page avec logo

#### ❌ MANQUANT dans le PDF téléchargeable :
- **Détails TVA** (HT, TVA 20%, TTC) pour les frais de service
- **Contact hôte/voyageur** (téléphone, email)

#### Format visuel
- Style HTML/CSS avec sections colorées
- Boîtes colorées pour les informations importantes (fond jaune clair)
- Boîte bleue pour la politique AkwaHome
- Tableaux avec bordures
- Design plus moderne et structuré

---

## 🔍 3. AFFICHAGE DANS LES DÉTAILS (MOBILE)

### Fichier : `AkwaHomeMobile/src/components/InvoiceDisplay.tsx`
### Composant : `InvoiceDisplay`

#### Technologie
- **Framework** : React Native
- **Format** : Composants React Native (View, Text, etc.)
- **Affichage** : Directement dans l'application mobile

#### Informations affichées

**✅ Inclus :**
- Logo AkwaHome
- Numéro de facture
- Type de service
- Titre de la propriété/véhicule
- Dates
- Durée
- Nombre de voyageurs
- **Section financière DÉTAILLÉE** :
  - Prix initial
  - Réduction (si applicable)
  - Prix après réduction
  - Frais de ménage (si > 0)
  - **Frais de service Akwahome** avec **DÉTAILS TVA** :
    - Frais de base (HT)
    - TVA (20%)
    - Total (TTC)
  - Taxes locales (si > 0)
  - **Total payé**
- Mode de paiement
- **Contact hôte/voyageur** (téléphone) - si réservation confirmée/en cours/terminée
- **Section "Règlement intérieur"** (fond bleu clair, bordure bleue) :
  - Règlement intérieur complet (house_rules)
- **Section "Politique d'annulation"** (fond jaune clair, bordure orange) :
  - Conditions d'annulation détaillées
- Date de réservation
- Pied de page avec logo
- **Bouton "Voir facture avec TVA"** → Modal avec facture détaillée TVA

#### ✅ AVANTAGES de l'affichage mobile :
- **Détails TVA complets** (HT, TVA 20%, TTC)
- **Contact hôte/voyageur** visible
- **Règles et conditions d'annulation** bien visibles avec sections colorées
- **Modal facture avec TVA** avec informations émetteur/destinataire

#### Format visuel
- Design moderne avec sections colorées
- Sections distinctes avec icônes
- Détails TVA dans une boîte grise claire
- Boutons d'action (envoyer par email, voir facture TVA)

---

## 📊 COMPARAISON DÉTAILLÉE

### Informations communes (présentes dans les 3)
✅ Logo AkwaHome
✅ Numéro de facture
✅ Type de service
✅ Titre propriété/véhicule
✅ Dates (arrivée/départ)
✅ Durée
✅ Nombre de voyageurs
✅ Prix initial
✅ Réduction (si applicable)
✅ Prix après réduction
✅ Frais de ménage
✅ Frais de service Akwahome
✅ Total payé
✅ Mode de paiement
✅ Règlement intérieur (house_rules)
✅ Politique d'annulation
✅ Date de réservation
✅ Pied de page

### Informations UNIQUEMENT dans le PDF email
❌ Aucune (toutes les infos sont aussi ailleurs)

### Informations UNIQUEMENT dans le PDF téléchargeable (site web)
✅ Section "Politique AkwaHome" (pour voyageur)

### Informations UNIQUEMENT dans l'affichage mobile
✅ **Détails TVA** (HT, TVA 20%, TTC) pour frais de service
✅ **Contact hôte/voyageur** (téléphone)
✅ **Modal facture avec TVA** complète
✅ **Sections colorées** pour règles et annulation

---

## 🎨 DIFFÉRENCES VISUELLES

### PDF Email (jsPDF)
- **Style** : Simple, linéaire
- **Couleurs** : Orange pour titres, noir pour texte
- **Structure** : Texte aligné, pas de boîtes colorées
- **Règles/Annulation** : Section "Informations importantes" simple

### PDF Téléchargeable (HTML/CSS)
- **Style** : Moderne, structuré
- **Couleurs** : Sections colorées (jaune pour règles, bleu pour politique)
- **Structure** : Boîtes avec bordures, tableaux
- **Règles/Annulation** : Section "Informations importantes" avec fond jaune

### Affichage Mobile (React Native)
- **Style** : Très moderne, interactif
- **Couleurs** : Sections distinctes (bleu pour règles, orange pour annulation)
- **Structure** : Sections avec icônes, boîtes colorées, détails TVA
- **Règles/Annulation** : Sections séparées avec styles distincts

---

## ⚠️ PROBLÈMES IDENTIFIÉS

### 1. **Incohérence des détails TVA**
- ❌ **PDF email** : Pas de détails TVA
- ❌ **PDF téléchargeable** : Pas de détails TVA
- ✅ **Affichage mobile** : Détails TVA complets (HT, TVA 20%, TTC)

### 2. **Incohérence des règles et conditions d'annulation**
- ✅ **PDF email** : Inclus dans "Informations importantes"
- ✅ **PDF téléchargeable** : Inclus dans "Informations importantes"
- ✅ **Affichage mobile** : Sections séparées et colorées (AJOUTÉ RÉCEMMENT)

### 3. **Contact hôte/voyageur**
- ❌ **PDF email** : Non inclus
- ❌ **PDF téléchargeable** : Non inclus
- ✅ **Affichage mobile** : Inclus (téléphone de l'hôte/voyageur)

### 4. **Politique AkwaHome**
- ❌ **PDF email** : Non inclus
- ✅ **PDF téléchargeable** : Inclus (pour voyageur uniquement)
- ❌ **Affichage mobile** : Non inclus

### 5. **Modal facture avec TVA**
- ❌ **PDF email** : Non disponible
- ❌ **PDF téléchargeable** : Non disponible
- ✅ **Affichage mobile** : Disponible avec informations émetteur/destinataire

---

## 📝 RÉSUMÉ

### Visuellement identique ?
**NON** - Les 3 systèmes ont des styles différents :
- PDF email : Style simple et linéaire
- PDF téléchargeable : Style HTML/CSS avec sections colorées
- Affichage mobile : Style React Native moderne avec sections distinctes

### Mêmes informations ?
**PARTIELLEMENT** - Il y a des différences :
- ✅ **Règles et conditions d'annulation** : Présentes dans les 3 (mais format différent)
- ❌ **Détails TVA** : Uniquement dans l'affichage mobile
- ❌ **Contact hôte/voyageur** : Uniquement dans l'affichage mobile
- ❌ **Politique AkwaHome** : Uniquement dans le PDF téléchargeable
- ❌ **Modal facture TVA** : Uniquement dans l'affichage mobile

### Recommandations
1. **Ajouter les détails TVA** dans les PDFs (email et téléchargeable)
2. **Ajouter le contact hôte/voyageur** dans les PDFs
3. **Harmoniser le style** des règles et conditions d'annulation
4. **Ajouter la politique AkwaHome** dans le PDF email et l'affichage mobile
5. **Uniformiser** le format visuel entre les 3 systèmes














