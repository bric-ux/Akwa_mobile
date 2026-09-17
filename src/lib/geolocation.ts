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

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trouve la location AkwaHome la plus pertinente pour des coords
 * (priorité quartier > commune > ville, puis distance).
 */
export async function matchLocationNearCoords(
  coords: GeoCoords,
  reverse?: ReverseGeocodeResult | null,
): Promise<MatchedLocation | null> {
  const nameCandidates = [
    reverse?.neighbourhood,
    reverse?.suburb,
    reverse?.city,
    reverse?.town,
    reverse?.village,
    reverse?.county,
    reverse?.state,
  ]
    .filter(Boolean)
    .map((s) => String(s));

  // 1) Match par nom (quartier / commune / ville)
  for (const type of ['neighborhood', 'commune', 'city'] as const) {
    for (const candidate of nameCandidates) {
      const norm = normalizeName(candidate);
      if (norm.length < 2) continue;
      const { data } = await supabase
        .from('locations')
        .select('id, name, type, parent_id, latitude, longitude')
        .eq('type', type)
        .ilike('name', `%${candidate}%`)
        .limit(8);
      if (!data?.length) continue;

      const scored = data
        .map((row) => {
          const nameNorm = normalizeName(row.name);
          const exact = nameNorm === norm || nameNorm.includes(norm) || norm.includes(nameNorm);
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

      if (scored[0] && scored[0].dist < 40) {
        return scored[0].row as MatchedLocation;
      }
      if (scored[0] && type !== 'neighborhood') {
        return scored[0].row as MatchedLocation;
      }
    }
  }

  // 2) Plus proche par distance parmi locations avec coords
  const { data: withCoords } = await supabase
    .from('locations')
    .select('id, name, type, parent_id, latitude, longitude')
    .in('type', ['neighborhood', 'commune', 'city'])
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(500);

  if (!withCoords?.length) return null;

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
    .sort((a, b) => a.dist - b.dist || a.typeRank - b.typeRank);

  const best = ranked[0];
  if (!best || best.dist > 25) return null;
  return best.row as MatchedLocation;
}

export function buildAddressDetailsSuggestion(
  reverse: ReverseGeocodeResult | null,
): string | undefined {
  if (!reverse) return undefined;
  const parts = [reverse.road, reverse.neighbourhood || reverse.suburb].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export function buildLocationLabel(
  matched: MatchedLocation | null,
  reverse: ReverseGeocodeResult | null,
): string {
  if (matched?.name) return matched.name;
  if (reverse?.city || reverse?.town || reverse?.village) {
    return String(reverse.city || reverse.town || reverse.village);
  }
  if (reverse?.displayName) {
    return reverse.displayName.split(',').slice(0, 2).join(',').trim();
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
): Promise<PreciseLocationResult> {
  const reverse = await reverseGeocodeNominatim(coords);
  const matchedLocation = await matchLocationNearCoords(coords, reverse);
  return {
    coords,
    addressLabel: buildLocationLabel(matchedLocation, reverse),
    addressDetailsSuggestion: buildAddressDetailsSuggestion(reverse),
    matchedLocation,
    reverse,
  };
}

export { CI_DEFAULT };
