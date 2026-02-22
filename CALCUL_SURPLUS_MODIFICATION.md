# Calcul du Surplus pour Modification de Réservation Véhicule

## Problème identifié

Quand on ajoute 1 heure à 10 000 FCFA, l'utilisateur se retrouve à payer 69 440 FCFA au lieu d'environ 11 200 FCFA (10 000 + frais de service).

## Logique actuelle (INCORRECTE)

1. Calcul du nouveau prix avec `calculateVehiclePriceWithHours`
2. La réduction est appliquée sur le total (jours + heures) avec un pourcentage calculé sur les jours
3. Si on ajoute 1 heure, la réduction augmente aussi (car appliquée sur un total plus grand)

## Logique correcte

Le surplus doit être calculé de manière simple :
- **Surplus = Nouveau total - Ancien total**

Le breakdown doit montrer :
1. Différence de prix des jours (si changement de jours)
2. Différence de prix des heures (si changement d'heures)
3. Différence de réduction (peut changer si le nombre de jours change)
4. Différence de prix après réduction
5. Différence de frais de service
6. **Total = somme de tout ça = nouveau total - ancien total**

## Correction à apporter

1. Simplifier le calcul du surplus
2. Corriger l'affichage du breakdown
3. S'assurer que le surplus total = nouveau total - ancien total




