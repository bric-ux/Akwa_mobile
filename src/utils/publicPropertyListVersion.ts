/**
 * Compteur global : après suppression / masquage / modération d'une propriété,
 * les écrans « catalogue » (accueil, recherche) comparent ce numéro au dernier
 * traité et appellent refreshProperties si besoin.
 */
import { invalidateExploreHomeCache } from './exploreHomeCache';
import { invalidateExploreHotelsMemoryCache } from './exploreHomeStorage';

let publicPropertyListVersion = 0;

export function bumpPublicPropertyListVersion(): void {
  publicPropertyListVersion += 1;
  invalidateExploreHomeCache();
  invalidateExploreHotelsMemoryCache();
}

export function getPublicPropertyListVersion(): number {
  return publicPropertyListVersion;
}
