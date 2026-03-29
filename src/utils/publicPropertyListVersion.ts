/**
 * Compteur global : après suppression / masquage / modération d'une propriété,
 * les écrans « catalogue » (accueil, recherche) comparent ce numéro au dernier
 * traité et appellent refreshProperties si besoin.
 */
let publicPropertyListVersion = 0;

export function bumpPublicPropertyListVersion(): void {
  publicPropertyListVersion += 1;
}

export function getPublicPropertyListVersion(): number {
  return publicPropertyListVersion;
}
