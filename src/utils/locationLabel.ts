export type LocationNode = {
  name?: string | null;
  type?: string | null;
  parent?: LocationNode | null;
  /** Alias parfois utilisé dans les selects véhicule (grand-parent). */
  city?: LocationNode | null;
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

function normalizePart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_COMMUNE_PARTS = new Set([
  'cocody',
  'koumassi',
  'yopougon',
  'marcory',
  'treichville',
  'plateau',
  'adjame',
  'abobo',
  'port-bouet',
  'port bouet',
  'bingerville',
  'anyama',
  'songon',
  'attecoube',
]);

function isKnownCommunePart(value: string): boolean {
  const n = normalizePart(value);
  return KNOWN_COMMUNE_PARTS.has(n) || n.startsWith('port bou');
}

/**
 * Évite « Port-Bouët, Koumassi, Abidjan » (commune + commune + ville).
 * Si deux communes se suivent, on drop la première.
 */
export function sanitizeHierarchyLabel(label: string): string {
  const parts = label
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return label.trim();

  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev && isKnownCommunePart(prev) && isKnownCommunePart(part)) {
      // remplace la commune précédente par la nouvelle (plus proche du match DB)
      out[out.length - 1] = part;
      continue;
    }
    if (out.some((o) => normalizePart(o) === normalizePart(part))) continue;
    out.push(part);
    if (out.length >= 3) break;
  }
  return out.join(', ');
}

/** Fusionne plusieurs libellés en « lieu, commune, ville » (max 3). */
export function mergeLocationLabelParts(
  ...sources: Array<string | null | undefined>
): string {
  const skip = /^(cote\s*d.?ivoire|ivory\s*coast)$/i;
  const out: string[] = [];
  for (const src of sources) {
    if (!src?.trim()) continue;
    for (const raw of src.split(',')) {
      const part = raw.trim();
      if (!part || skip.test(normalizePart(part))) continue;
      if (out.some((o) => normalizePart(o) === normalizePart(part))) continue;
      out.push(part);
      if (out.length >= 3) break;
    }
  }
  return sanitizeHierarchyLabel(out.join(', '));
}

function resolveCityName(loc: LocationNode): string | undefined {
  if (loc.cityName?.trim()) return loc.cityName.trim();
  if (loc.type === 'city' && loc.name?.trim()) return loc.name.trim();

  const parent = loc.parent;
  if (!parent) return undefined;
  if (parent.type === 'city' && parent.name?.trim()) return parent.name.trim();

  const viaCityAlias = parent.city;
  if (viaCityAlias?.type === 'city' && viaCityAlias.name?.trim()) {
    return viaCityAlias.name.trim();
  }
  if (viaCityAlias?.name?.trim() && viaCityAlias.type !== 'commune') {
    return viaCityAlias.name.trim();
  }

  const grandParent = parent.parent;
  if (grandParent?.type === 'city' && grandParent.name?.trim()) {
    return grandParent.name.trim();
  }
  if (grandParent?.name?.trim()) return grandParent.name.trim();

  return undefined;
}

function resolveCommuneName(loc: LocationNode): string | undefined {
  if (loc.commune?.trim()) return loc.commune.trim();
  if (loc.type === 'commune' && loc.name?.trim()) return loc.name.trim();

  const parent = loc.parent;
  if (!parent) return undefined;
  if (parent.type === 'commune' && parent.name?.trim()) return parent.name.trim();
  return undefined;
}

function formatFromNode(loc: LocationNode): string {
  const name = loc.name?.trim();
  if (!name) return '';

  const type = loc.type;
  if (type === 'city' || type === 'region' || type === 'country') return name;

  if (type === 'neighborhood') {
    const commune = resolveCommuneName(loc);
    const city = resolveCityName(loc);
    return (
      mergeLocationLabelParts(
        name,
        commune && commune !== name ? commune : null,
        city && city !== name && city !== commune ? city : null,
      ) || name
    );
  }

  if (type === 'commune') {
    const city = resolveCityName(loc);
    if (city && city !== name) return `${name}, ${city}`;
    return name;
  }

  // Type inconnu : remonter parent + ville si possible
  const commune = resolveCommuneName(loc);
  const city = resolveCityName(loc);
  return (
    mergeLocationLabelParts(
      name,
      commune && commune !== name ? commune : null,
      city && city !== name && city !== commune ? city : null,
    ) || name
  );
}

function formatFromString(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Déjà hiérarchique « A, B, C » → garder l’ordre naturel
  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return mergeLocationLabelParts(...parts) || trimmed;
  }

  return trimmed;
}

/** Affichage carte / liste : « Quartier, Commune, Ville » (ou ville seule). */
export function formatCardLocationLabel(
  input?: string | LocationNode | null,
): string {
  if (input == null) return '';
  if (typeof input === 'string') return formatFromString(input);
  if (typeof input === 'object') return formatFromNode(input);
  return '';
}

function isGenericPlaceName(value: string): boolean {
  const n = normalizePart(value);
  if (!n) return true;
  if (isKnownCommunePart(value)) return true;
  return (
    n === 'abidjan' ||
    n === 'bouake' ||
    n === 'yamoussoukro' ||
    n === 'san pedro' ||
    n === 'san-pedro' ||
    n === 'grand bassam' ||
    n === 'grand-bassam' ||
    n === 'bassam' ||
    n === 'assinie'
  );
}

/** Rue, lot, immeuble : on ne les affiche pas à la place du quartier. */
function looksLikeStreetAddress(value: string): boolean {
  return /^(rue|avenue|av\.?|boulevard|bd\.?|route|rt\.?|lot|ilot|îlot|cite|cité|immeuble)\b/i.test(
    value.trim(),
  );
}

/** Premier segment = lieu nommé (Saint Viateur), pas la commune seule. */
function specificPlaceLabel(raw: string): string {
  const cleaned = sanitizeHierarchyLabel(raw);
  const first = cleaned.split(',')[0]?.trim() || '';
  if (!first || isGenericPlaceName(first) || looksLikeStreetAddress(first)) return '';
  return cleaned;
}

export function getPropertyCardLocationLabel(property: {
  location?: string | LocationNode | null;
  locations?: LocationNode | null;
  /** Libellé précis hors catalogue (ex. quartier OSM non présent en DB) */
  location_label?: string | null;
  /** Lieu saisi à la candidature (Saint Viateur, Restaurant Bar Marie…). */
  address?: string | null;
  address_details?: string | null;
}): string {
  const label = property.location_label?.trim() || '';

  let catalog = '';
  if (typeof property.location === 'object' && property.location !== null) {
    catalog = formatCardLocationLabel(property.location);
  } else if (property.locations) {
    catalog = formatCardLocationLabel(property.locations);
  } else if (typeof property.location === 'string') {
    catalog = formatCardLocationLabel(property.location);
  }

  const precise = specificPlaceLabel(label) || specificPlaceLabel(property.address?.trim() || '');
  if (precise) {
    return mergeLocationLabelParts(precise, catalog) || precise;
  }

  // Libellé présent mais sans lieu plus fin : ne pas coller une commune catalogue fausse.
  if (label) {
    const cleaned = sanitizeHierarchyLabel(label);
    const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return mergeLocationLabelParts(...parts);
    const cityOnly =
      (typeof property.location === 'object' && property.location
        ? resolveCityName(property.location)
        : undefined) ||
      (property.locations ? resolveCityName(property.locations) : undefined);
    return mergeLocationLabelParts(cleaned, cityOnly) || cleaned;
  }
  return catalog;
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
