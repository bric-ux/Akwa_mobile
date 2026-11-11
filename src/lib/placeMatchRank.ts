function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

type PlaceFields = {
  title?: string | null;
  address?: string | null;
  address_details?: string | null;
  location_label?: string | null;
  locations?: { name?: string | null } | null;
  location?: { name?: string | null } | null;
  neighborhoods?: { name?: string | null } | null;
  distance?: number | null;
  _distance?: number | null;
};

/** 0 = lieu demandé, 1 = titre ou adresse, 2 = alentours. */
export function placeMatchRank(item: PlaceFields, term: string): number {
  const needle = fold(term);
  if (needle.length < 2) return 2;
  const placeNames = [
    item.locations?.name,
    item.location?.name,
    item.neighborhoods?.name,
    item.location_label,
  ]
    .filter((value): value is string => !!value)
    .map(fold);
  const hitPlace = placeNames.some(
    (name) =>
      name === needle ||
      name.includes(needle) ||
      (name.length >= 4 && needle.includes(name)),
  );
  if (hitPlace) return 0;
  const texts = [item.address, item.address_details, item.title]
    .filter((value): value is string => !!value)
    .map(fold);
  if (texts.some((text) => text.includes(needle))) return 1;
  return 2;
}

/** Annonces du lieu cherché d'abord, puis les alentours (distance conservée dans chaque groupe). */
export function sortByPlaceMatch<T extends PlaceFields>(
  items: T[],
  term: string | null | undefined,
): T[] {
  const query = term?.trim();
  if (!query || items.length < 2) return items;
  return [...items].sort((a, b) => {
    const rank = placeMatchRank(a, query) - placeMatchRank(b, query);
    if (rank !== 0) return rank;
    const left = a.distance ?? a._distance ?? Number.POSITIVE_INFINITY;
    const right = b.distance ?? b._distance ?? Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return 0;
  });
}
