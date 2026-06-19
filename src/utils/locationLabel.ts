export type LocationNode = {
  name?: string | null;
  type?: string | null;
  parent?: LocationNode | null;
  commune?: string | null;
  cityName?: string | null;
};

/** Fragment Supabase pour résoudre ville / commune depuis un quartier. */
export const LOCATION_WITH_PARENT_SELECT = `
  id,
  name,
  type,
  latitude,
  longitude,
  parent_id,
  parent:parent_id (
    id,
    name,
    type,
    parent:parent_id (id, name, type)
  )
`.trim();

function resolveCityName(loc: LocationNode): string | undefined {
  if (loc.cityName?.trim()) return loc.cityName.trim();
  if (loc.type === 'city' && loc.name?.trim()) return loc.name.trim();

  const parent = loc.parent;
  if (!parent) return undefined;
  if (parent.type === 'city' && parent.name?.trim()) return parent.name.trim();

  const grandParent = parent.parent;
  if (grandParent?.type === 'city' && grandParent.name?.trim()) {
    return grandParent.name.trim();
  }

  return undefined;
}

function formatFromNode(loc: LocationNode): string {
  const name = loc.name?.trim();
  if (!name) return '';

  const type = loc.type;
  if (type === 'city' || type === 'region' || type === 'country') return name;

  if (type === 'neighborhood' || type === 'commune') {
    const city = resolveCityName(loc);
    if (city && city !== name) return `${name}, ${city}`;

    const commune = loc.commune?.trim();
    if (commune && commune !== name) return `${name}, ${commune}`;
  }

  return name;
}

function formatFromString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const [first, ...rest] = parts;
    return `${rest.join(', ')}, ${first}`;
  }

  return trimmed;
}

/** Affichage carte / liste : « Quartier, Ville » (ou ville seule). */
export function formatCardLocationLabel(
  input?: string | LocationNode | null,
): string {
  if (input == null) return '';
  if (typeof input === 'string') return formatFromString(input);
  if (typeof input === 'object') return formatFromNode(input);
  return '';
}

export function getPropertyCardLocationLabel(property: {
  location?: string | LocationNode | null;
  locations?: LocationNode | null;
}): string {
  if (typeof property.location === 'object' && property.location !== null) {
    return formatCardLocationLabel(property.location);
  }
  if (property.locations) {
    return formatCardLocationLabel(property.locations);
  }
  if (typeof property.location === 'string') {
    return formatCardLocationLabel(property.location);
  }
  return '';
}

export function getEstablishmentCardLocationLabel(establishment: {
  locations?: LocationNode | null;
  address?: string | null;
}): string {
  if (establishment.locations) {
    const label = formatCardLocationLabel(establishment.locations);
    if (label) return label;
  }
  return establishment.address?.trim() || '';
}
