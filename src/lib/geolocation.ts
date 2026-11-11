/**
 * Géolocalisation précise : GPS device + reverse geocoding (Nominatim) +
 * rattachement à la hiérarchie `locations` (quartier / commune / ville).
 */
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';

export type GeoCoords = { latitude: number; longitude: number };

export type MatchedLocation = {
  id: string;
  name: string;
  type: 'country' | 'region' | 'city' | 'commune' | 'neighborhood';
  parent_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  region?: string;
  commune?: string;
  city_id?: string;
};

export type ReverseGeocodeResult = {
  displayName: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  raw: Record<string, string>;
};

export type PreciseLocationResult = {
  coords: GeoCoords;
  addressLabel: string;
  addressDetailsSuggestion?: string;
  matchedLocation: MatchedLocation | null;
  reverse: ReverseGeocodeResult | null;
};

const CI_DEFAULT: GeoCoords = { latitude: 5.36, longitude: -4.0083 };
const NOMINATIM_UA = 'AkwaHome/1.1 (https://akwahome.com; contact@akwahome.com)';

function haversineKm(a: GeoCoords, b: GeoCoords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function requestForegroundLocationPermission(): Promise<boolean> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === 'granted') return true;
  if (existing === 'denied') {
    // Déjà refusé : on ne re-prompt pas silencieusement — le caller affichera un message.
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Demande d’autorisation avec explication avant le prompt système.
 * Retourne true si l’utilisateur accepte et que la permission est accordée.
 */
export function explainAndRequestLocationPermission(
  reason = 'AkwaHome a besoin de votre position pour afficher les logements autour de vous ou placer précisément votre annonce. Votre position n’est pas partagée avec d’autres utilisateurs.',
): Promise<boolean> {
  return new Promise(async (resolve) => {
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    if (existing === 'granted') {
      resolve(true);
      return;
    }

    Alert.alert('Autoriser la localisation ?', reason, [
      {
        text: 'Pas maintenant',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: 'Autoriser',
        onPress: async () => {
          const granted = await requestForegroundLocationPermission();
          resolve(granted);
        },
      },
    ]);
  });
}

export async function getDeviceCoords(): Promise<GeoCoords> {
  const granted = await explainAndRequestLocationPermission();
  if (!granted) {
    throw new Error('Permission de localisation refusée');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

export async function reverseGeocodeNominatim(
  coords: GeoCoords,
): Promise<ReverseGeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}` +
    `&lon=${coords.longitude}&accept-language=fr&addressdetails=1&zoom=18`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': NOMINATIM_UA,
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const addr = (json.address || {}) as Record<string, string>;
    return {
      displayName: String(json.display_name || ''),
      road: addr.road || addr.pedestrian || addr.footway,
      suburb: addr.suburb,
      neighbourhood: addr.neighbourhood || addr.quarter || addr.residential,
      city: addr.city,
      town: addr.town,
      village: addr.village,
      county: addr.county,
      state: addr.state,
      country: addr.country,
      raw: addr,
    };
  } catch {
    return null;
  }
}

export type ForwardGeocodeHit = {
  placeId: string;
  displayName: string;
  shortName: string;
  latitude: number;
  longitude: number;
  typeHint: 'city' | 'commune' | 'neighborhood';
};

function dedupeForwardHits(hits: ForwardGeocodeHit[], limit: number): ForwardGeocodeHit[] {
  const out: ForwardGeocodeHit[] = [];
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  for (const hit of hits) {
    const key = norm(hit.shortName);
    const dup = out.some((o) => {
      if (norm(o.shortName) === key) return true;
      const dLat = Math.abs(o.latitude - hit.latitude);
      const dLng = Math.abs(o.longitude - hit.longitude);
      return dLat < 0.002 && dLng < 0.002 && norm(o.shortName).includes(key.slice(0, 4));
    });
    if (!dup) out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Recherche texte → suggestions OpenStreetMap (Nominatim), limitée à la Côte d'Ivoire.
 */
export async function forwardGeocodeNominatim(
  query: string,
  options?: { limit?: number; countryCodes?: string },
): Promise<ForwardGeocodeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const limit = options?.limit ?? 6;
  const country = options?.countryCodes ?? 'ci';
  const searchQ = /côte\s*d['’]?ivoire|ivory\s*coast|\bci\b/i.test(q)
    ? q
    : `${q}, Côte d'Ivoire`;

  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2` +
    `&q=${encodeURIComponent(searchQ)}` +
    `&countrycodes=${country}` +
    `&accept-language=fr&addressdetails=1&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': NOMINATIM_UA,
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as Array<{
      place_id?: number | string;
      display_name?: string;
      lat?: string;
      lon?: string;
      type?: string;
      class?: string;
      address?: Record<string, string>;
      name?: string;
    }>;

    if (!Array.isArray(json)) return [];

    const hits: ForwardGeocodeHit[] = [];
    for (const row of json) {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const addr = row.address || {};
      const shortName =
        row.name ||
        addr.neighbourhood ||
        addr.suburb ||
        addr.quarter ||
        addr.village ||
        addr.town ||
        addr.city ||
        addr.municipality ||
        addr.county ||
        String(row.display_name || '')
          .split(',')[0]
          ?.trim() ||
        q;

      const typeHint = inferForwardTypeHint(row.type, row.class, addr);
      hits.push({
        placeId: String(row.place_id ?? `${lat}_${lng}`),
        displayName: String(row.display_name || shortName),
        shortName: String(shortName).trim(),
        latitude: lat,
        longitude: lng,
        typeHint,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

/**
 * Photon (Komoot) — autocomplete OSM gratuit, souvent plus riche que Nominatim.
 * Filtré Côte d'Ivoire (bbox + countrycode).
 */
export async function forwardGeocodePhoton(
  query: string,
  options?: { limit?: number },
): Promise<ForwardGeocodeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const limit = options?.limit ?? 6;
  // Bias Abidjan + bbox approximative CI
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&lang=fr&limit=${Math.min(limit + 4, 12)}` +
    `&lat=${CI_DEFAULT.latitude}&lon=${CI_DEFAULT.longitude}` +
    `&bbox=-8.7,4.2,-2.4,10.8`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': NOMINATIM_UA,
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: number[] };
        properties?: Record<string, string | number | null | undefined>;
      }>;
    };

    const hits: ForwardGeocodeHit[] = [];
    for (const feat of json.features || []) {
      const coords = feat.geometry?.coordinates;
      const props = feat.properties || {};
      const lng = Number(coords?.[0]);
      const lat = Number(coords?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const cc = String(props.countrycode || props.country || '')
        .toLowerCase()
        .trim();
      if (cc && cc !== 'ci' && cc !== 'civ' && !/ivoire|ivory/i.test(cc)) {
        continue;
      }

      const shortName = String(
        props.name ||
          props.street ||
          props.city ||
          props.district ||
          props.county ||
          props.state ||
          q,
      ).trim();
      if (!shortName) continue;

      const parts = [
        shortName,
        props.district,
        props.city,
        props.county,
        props.state,
        props.country,
      ]
        .map((p) => (p != null ? String(p).trim() : ''))
        .filter(Boolean);
      const displayName = [...new Set(parts)].join(', ');

      const osmType = String(props.type || props.osm_value || props.osm_key || '');
      hits.push({
        placeId: `photon_${props.osm_id ?? `${lat}_${lng}`}`,
        displayName,
        shortName,
        latitude: lat,
        longitude: lng,
        typeHint: inferForwardTypeHint(osmType, String(props.osm_key || ''), {
          city: props.city != null ? String(props.city) : undefined,
          suburb: props.district != null ? String(props.district) : undefined,
          neighbourhood:
            /suburb|neighbourhood|quarter|district|locality/i.test(osmType)
              ? shortName
              : undefined,
        } as Record<string, string>),
      });
    }
    return dedupeForwardHits(hits, limit);
  } catch {
    return [];
  }
}

/**
 * Nominatim + Photon en parallèle, dédoublonnés (meilleure couverture gratuite).
 */
export async function forwardGeocodeCombined(
  query: string,
  options?: { limit?: number; countryCodes?: string },
): Promise<ForwardGeocodeHit[]> {
  const limit = options?.limit ?? 8;
  const [nominatim, photon] = await Promise.all([
    forwardGeocodeNominatim(query, { ...options, limit }),
    forwardGeocodePhoton(query, { limit }),
  ]);
  // Photon souvent meilleur en autocomplete → en tête
  return dedupeForwardHits([...photon, ...nominatim], limit);
}

function inferForwardTypeHint(
  type?: string,
  klass?: string,
  addr?: Record<string, string>,
): 'city' | 'commune' | 'neighborhood' {
  const t = `${type || ''} ${klass || ''}`.toLowerCase();
  if (
    addr?.neighbourhood ||
    addr?.suburb ||
    addr?.quarter ||
    addr?.residential ||
    t.includes('suburb') ||
    t.includes('neighbourhood') ||
    t.includes('quarter')
  ) {
    return 'neighborhood';
  }
  if (
    t.includes('city') ||
    t.includes('town') ||
    addr?.city ||
    addr?.town
  ) {
    return 'city';
  }
  return 'commune';
}

/** UUID v4-ish — pour ne pas envoyer un id OSM comme location_id */
export function isLocationUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id.trim(),
  );
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Communes Abidjan / grandes villes CI — souvent dans display_name OSM mais pas dans suburb. */
const CI_KNOWN_COMMUNES = [
  'cocody',
  'koumassi',
  'yopougon',
  'marcory',
  'treichville',
  'plateau',
  'adjame',
  'adjamé',
  'abobo',
  'port-bouet',
  'port bouet',
  'port-bouët',
  'attingue',
  'attingié',
  'songon',
  'bingerville',
  'anyama',
  'brofodoume',
  'brofodoumè',
  'bouake',
  'bouaké',
  'yamoussoukro',
  'san-pedro',
  'san pedro',
  'korhogo',
  'daloa',
  'gagnoa',
  'man',
];

function isKnownCiCommuneName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = normalizeName(name);
  return CI_KNOWN_COMMUNES.some((c) => n === normalizeName(c) || n.includes(normalizeName(c)));
}

/**
 * Nominatim met souvent la commune (Cocody) seulement dans display_name,
 * alors que suburb = micro-quartier (Djorogobité, Riviera Bonoumin…).
 */
export function extractKnownCommuneName(
  reverse?: ReverseGeocodeResult | null,
  extraTexts: Array<string | null | undefined> = [],
): string | null {
  const candidates: string[] = [
    reverse?.raw?.city_district,
    reverse?.raw?.municipality,
    reverse?.raw?.district,
    reverse?.county,
    reverse?.suburb,
    reverse?.neighbourhood,
    ...(reverse?.displayName ? reverse.displayName.split(',') : []),
    ...extraTexts,
  ]
    .map((s) => (s != null ? String(s).trim() : ''))
    .filter(Boolean);

  for (const c of candidates) {
    if (isKnownCiCommuneName(c)) {
      // Retourner la forme canonique connue si possible
      const n = normalizeName(c);
      const known = CI_KNOWN_COMMUNES.find((k) => n === normalizeName(k) || n.includes(normalizeName(k)));
      if (known) {
        // Préférer le token tel qu’il apparaît dans OSM (casse d’origine)
        return c.split(/\s+/).length <= 3 ? c : known.replace(/\b\w/g, (ch) => ch.toUpperCase());
      }
      return c;
    }
  }
  return null;
}

async function matchByNameAndType(
  coords: GeoCoords,
  type: 'neighborhood' | 'commune' | 'city',
  candidates: string[],
  maxDistKm: number,
  options?: { parentId?: string | null },
): Promise<MatchedLocation | null> {
  for (const candidate of candidates) {
    const norm = normalizeName(candidate);
    if (norm.length < 2) continue;
    let query = supabase
      .from('locations')
      .select('id, name, type, parent_id, latitude, longitude')
      .eq('type', type)
      .ilike('name', `%${candidate}%`)
      .limit(12);
    if (options?.parentId) {
      query = query.eq('parent_id', options.parentId);
    }
    const { data } = await query;
    if (!data?.length) continue;

    const scored = data
      .map((row) => {
        const nameNorm = normalizeName(row.name);
        const exact =
          nameNorm === norm || nameNorm.includes(norm) || norm.includes(nameNorm);
        let dist = 999;
        if (row.latitude != null && row.longitude != null) {
          dist = haversineKm(coords, {
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
          });
        }
        return { row, exact, dist };
      })
      .filter((x) => x.exact)
      .sort((a, b) => a.dist - b.dist);

    if (scored[0] && scored[0].dist <= maxDistKm) {
      return scored[0].row as MatchedLocation;
    }
  }
  return null;
}

/**
 * Trouve la location AkwaHome la plus pertinente pour des coords
 * (priorité commune OSM connue > quartier nommé > proximité sous la commune).
 */
export async function matchLocationNearCoords(
  coords: GeoCoords,
  reverse?: ReverseGeocodeResult | null,
): Promise<MatchedLocation | null> {
  const knownCommune = extractKnownCommuneName(reverse);
  const neighborhoodNames = [reverse?.neighbourhood, reverse?.suburb]
    .filter(Boolean)
    .map((s) => String(s))
    // Ne pas traiter une commune connue comme nom de quartier
    .filter((s) => !isKnownCiCommuneName(s));
  const communeNames = [
    knownCommune,
    reverse?.village,
    reverse?.county,
    reverse?.suburb,
  ]
    .filter(Boolean)
    .map((s) => String(s));
  const cityNames = [reverse?.city, reverse?.town, reverse?.village, reverse?.state]
    .filter(Boolean)
    .map((s) => String(s));

  // 1) Commune officielle d’abord (évite Cocody → quartier Koumassi « le plus proche »)
  const byCommune = await matchByNameAndType(coords, 'commune', communeNames, 25);
  const communeMatch =
    byCommune ||
    (knownCommune
      ? await matchByNameAndType(coords, 'commune', [knownCommune], 40)
      : null);

  // 2) Quartier nommé, de préférence sous la commune trouvée
  if (neighborhoodNames.length) {
    const byNeighborhoodUnderCommune = communeMatch
      ? await matchByNameAndType(coords, 'neighborhood', neighborhoodNames, 8, {
          parentId: communeMatch.id,
        })
      : null;
    if (byNeighborhoodUnderCommune) return byNeighborhoodUnderCommune;

    const byNeighborhood = await matchByNameAndType(
      coords,
      'neighborhood',
      neighborhoodNames,
      5,
    );
    // N’accepter un quartier hors commune connue que s’il est vraiment proche
    if (byNeighborhood) {
      if (!communeMatch || byNeighborhood.parent_id === communeMatch.id) {
        return byNeighborhood;
      }
    }
  }

  if (communeMatch) {
    // 3) Quartier le plus proche UNIQUEMENT sous cette commune
    const { data: children } = await supabase
      .from('locations')
      .select('id, name, type, parent_id, latitude, longitude')
      .eq('type', 'neighborhood')
      .eq('parent_id', communeMatch.id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(200);

    if (children?.length) {
      const nearestChild = children
        .map((row) => ({
          row,
          dist: haversineKm(coords, {
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
          }),
        }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (nearestChild && nearestChild.dist <= 4) {
        return nearestChild.row as MatchedLocation;
      }
    }
    return communeMatch;
  }

  // 4) Pas de commune connue : proximité globale (rayons serrés)
  const { data: withCoords } = await supabase
    .from('locations')
    .select('id, name, type, parent_id, latitude, longitude')
    .in('type', ['neighborhood', 'commune', 'city'])
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(800);

  if (withCoords?.length) {
    const ranked = withCoords
      .map((row) => ({
        row,
        dist: haversineKm(coords, {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        }),
        typeRank:
          row.type === 'neighborhood' ? 0 : row.type === 'commune' ? 1 : 2,
      }))
      .sort((a, b) => a.typeRank - b.typeRank || a.dist - b.dist);

    const nearestNeighborhood = ranked.find(
      (x) => x.row.type === 'neighborhood' && x.dist <= 2.5,
    );
    if (nearestNeighborhood) return nearestNeighborhood.row as MatchedLocation;

    const nearestCommune = ranked.find(
      (x) => x.row.type === 'commune' && x.dist <= 8,
    );
    if (nearestCommune) return nearestCommune.row as MatchedLocation;

    const nearestCity = ranked.find((x) => x.row.type === 'city' && x.dist <= 25);
    if (nearestCity) return nearestCity.row as MatchedLocation;
  }

  return matchByNameAndType(coords, 'city', cityNames, 40);
}

export function buildAddressDetailsSuggestion(
  reverse: ReverseGeocodeResult | null,
): string | undefined {
  if (!reverse) return undefined;
  const parts = [reverse.road, reverse.neighbourhood || reverse.suburb].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function normalizeLabelPart(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** « Rond-point Ado, Cocody, Abidjan » — max 3 niveaux, sans pays/région bruitée. */
export function buildHierarchyLabel(
  parts: Array<string | null | undefined>,
  max = 3,
): string {
  const skip =
    /^(cote\s*d.?ivoire|ivory\s*coast|lagunes|district\s*autonome.*|region|r[eé]gion)$/i;
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    if (skip.test(normalizeLabelPart(trimmed))) continue;
    if (out.some((o) => normalizeLabelPart(o) === normalizeLabelPart(trimmed))) continue;
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out.join(', ');
}

/**
 * Libellé OSM forward : shortName + commune + ville (depuis displayName / address).
 */
export function formatForwardGeocodeLabel(hit: ForwardGeocodeHit): string {
  const fromDisplay = hit.displayName
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const commune =
    fromDisplay.find((p) => isKnownCiCommuneName(p)) || null;
  const city =
    fromDisplay.find((p) => {
      const n = normalizeLabelPart(p);
      return (
        n === 'abidjan' ||
        n === 'yamoussoukro' ||
        n === 'bouake' ||
        n === 'bouaké' ||
        (n.length > 2 &&
          !isKnownCiCommuneName(p) &&
          normalizeLabelPart(hit.shortName) !== n &&
          !/avenue|rue|boulevard|place|route|bd\b/i.test(p))
      );
    }) || null;
  // Préférer ville = Abidjan si présent
  const cityPreferred =
    fromDisplay.find((p) => normalizeLabelPart(p) === 'abidjan') || city;
  return (
    buildHierarchyLabel([hit.shortName, commune, cityPreferred], 3) ||
    hit.shortName
  );
}

export function buildLocationLabel(
  matched: MatchedLocation | null,
  reverse: ReverseGeocodeResult | null,
  preferredPlaceName?: string | null,
): string {
  const neighbourhood = reverse?.neighbourhood?.trim() || null;
  const suburb = reverse?.suburb?.trim() || null;
  const knownCommune = extractKnownCommuneName(reverse, [
    preferredPlaceName,
    matched?.name,
    matched?.commune,
  ]);
  const city =
    reverse?.city?.trim() ||
    reverse?.town?.trim() ||
    reverse?.village?.trim() ||
    (matched?.type === 'city' ? matched.name : null) ||
    null;

  const preferred = preferredPlaceName?.trim() || null;
  // Lieu précis : sélection utilisateur > micro-quartier OSM (pas la commune)
  let place: string | null =
    preferred ||
    neighbourhood ||
    (suburb && !isKnownCiCommuneName(suburb) ? suburb : null) ||
    (matched?.type === 'neighborhood' ? matched.name : null);

  let commune: string | null =
    knownCommune ||
    (matched?.type === 'commune' ? matched.name : null) ||
    matched?.commune ||
    null;

  // Si place = commune (ex. sélection « Cocody »), ne pas dupliquer
  if (
    place &&
    commune &&
    normalizeLabelPart(place) === normalizeLabelPart(commune)
  ) {
    place = null;
  }

  const hierarchical = buildHierarchyLabel([place, commune, city], 3);
  if (hierarchical) return hierarchical;

  if (matched?.name) {
    return (
      buildHierarchyLabel([matched.name, matched.commune, city], 3) || matched.name
    );
  }
  if (city) return String(city);
  if (reverse?.displayName) {
    return (
      buildHierarchyLabel(reverse.displayName.split(','), 3) ||
      reverse.displayName.split(',').slice(0, 2).join(',').trim()
    );
  }
  return 'Position actuelle';
}

/** Pipeline complet : GPS → reverse → match locations */
export async function resolvePreciseLocationFromDevice(): Promise<PreciseLocationResult> {
  const coords = await getDeviceCoords();
  return resolvePreciseLocationFromCoords(coords);
}

export async function resolvePreciseLocationFromCoords(
  coords: GeoCoords,
  options?: { preferredPlaceName?: string | null },
): Promise<PreciseLocationResult> {
  const reverse = await reverseGeocodeNominatim(coords);
  const matchedLocation = await matchLocationNearCoords(coords, reverse);
  return {
    coords,
    addressLabel: buildLocationLabel(
      matchedLocation,
      reverse,
      options?.preferredPlaceName,
    ),
    addressDetailsSuggestion: buildAddressDetailsSuggestion(reverse),
    matchedLocation,
    reverse,
  };
}

export { CI_DEFAULT };
