/**
 * Aligné sur le web `CitiesHorizontalSections.tsx` :
 * sections horizontales par ville, petites villes regroupées par paires.
 */

export const PER_CITY_LIMIT = 12;
export const MIN_PER_CITY = 1;
export const MAX_CITY_SECTIONS = 8;
/** Villes avec moins d’annonces sont regroupées (mobile + desktop web). */
export const SMALL_CITY_MAX_EXCLUSIVE = 3;

const humanize = (slug: string) =>
  slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

export const CITY_LABELS: Record<string, string> = {
  abidjan: 'Abidjan',
  assinie: 'Assinie',
  'grand-bassam': 'Grand-Bassam',
  yamoussoukro: 'Yamoussoukro',
  bouake: 'Bouaké',
  'san-pedro': 'San Pedro',
  korhogo: 'Korhogo',
  daloa: 'Daloa',
};

export const cityLabel = (slug: string) => CITY_LABELS[slug] || humanize(slug);

export type CityGroup<T = unknown> = {
  citySlug: string;
  cityName: string;
  totalCount: number;
  properties: T[];
};

export type LayoutSection<T = unknown> =
  | { kind: 'large'; group: CityGroup<T> }
  | { kind: 'paired'; groups: CityGroup<T>[] };

export function isSmallCity<T>(g: CityGroup<T>): boolean {
  return g.totalCount < SMALL_CITY_MAX_EXCLUSIVE;
}

export function buildLayoutSections<T>(groups: CityGroup<T>[]): LayoutSection<T>[] {
  const large = groups.filter((g) => !isSmallCity(g));
  const small = groups.filter((g) => isSmallCity(g));
  const pairedChunks: CityGroup<T>[][] = [];
  for (let i = 0; i < small.length; i += 2) {
    pairedChunks.push(small.slice(i, i + 2));
  }
  if (pairedChunks.length >= 2) {
    const last = pairedChunks[pairedChunks.length - 1];
    if (last.length === 1) {
      const orphan = pairedChunks.pop()![0];
      pairedChunks[pairedChunks.length - 1].push(orphan);
    }
  }
  return [
    ...large.map((group) => ({ kind: 'large' as const, group })),
    ...pairedChunks.map((chunk) => ({ kind: 'paired' as const, groups: chunk })),
  ];
}
