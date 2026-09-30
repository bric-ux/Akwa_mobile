import { calculateDistance } from '../utils/distance';
import { resolveLocationIdsForSearchTerm } from '../lib/resolveSearchLocations';

const DEFAULT_PLACE_RADIUS_KM = 25;

export type HotelGeoRow = {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
};

type CenterFilters = {
  city?: string;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
};

function coordsOf(row: { latitude?: number | null; longitude?: number | null }) {
  const lat = row.latitude != null ? Number(row.latitude) : NaN;
  const lng = row.longitude != null ? Number(row.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Résout centre + rayon pour une recherche hôtel (comme bail / résidences). */
export async function resolveHotelSearchCenter(filters?: CenterFilters): Promise<{
  centerLat?: number;
  centerLng?: number;
  mergeRadius: number;
  locationIds: string[] | null;
  locationNames: string[];
  nameTerms: string[];
}> {
  const city = filters?.city?.trim();
  let centerLat =
    filters?.centerLat != null && Number.isFinite(Number(filters.centerLat))
      ? Number(filters.centerLat)
      : undefined;
  let centerLng =
    filters?.centerLng != null && Number.isFinite(Number(filters.centerLng))
      ? Number(filters.centerLng)
      : undefined;
  let mergeRadius =
    filters?.radiusKm != null && filters.radiusKm > 0
      ? filters.radiusKm
      : DEFAULT_PLACE_RADIUS_KM;

  if (!city) {
    return {
      centerLat,
      centerLng,
      mergeRadius,
      locationIds: null,
      locationNames: [],
      nameTerms: [],
    };
  }

  const resolved = await resolveLocationIdsForSearchTerm(city, {
    centerLat,
    centerLng,
    radiusKm: filters?.radiusKm,
  });
  if (resolved.centerLat != null && resolved.centerLng != null) {
    centerLat = resolved.centerLat;
    centerLng = resolved.centerLng;
  }
  if (!(filters?.radiusKm != null && filters.radiusKm > 0)) {
    mergeRadius = DEFAULT_PLACE_RADIUS_KM;
  }

  if (centerLat == null || centerLng == null) {
    try {
      const { forwardGeocodeNominatim } = await import('./geolocation');
      const hits = await forwardGeocodeNominatim(`${city}, Côte d'Ivoire`);
      if (hits?.[0]) {
        centerLat = hits[0].latitude;
        centerLng = hits[0].longitude;
      }
    } catch {
      /* non bloquant */
    }
  }

  const nameTerms = [city, ...(resolved.locationNames || [])]
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
    .slice(0, 8);

  return {
    centerLat,
    centerLng,
    mergeRadius,
    locationIds: resolved.locationIds,
    locationNames: resolved.locationNames || [],
    nameTerms,
  };
}

/**
 * Fusionne des établissements proches (bbox ~25 km) hors arbre location_id.
 * Même logique que bail longue durée / Cocody → Faya.
 */
export async function mergeNearbyHotelEstablishments<T extends HotelGeoRow>(
  primary: T[],
  fetchNearby: (bbox: {
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  }) => Promise<T[]>,
  centerLat: number,
  centerLng: number,
  mergeRadius: number,
): Promise<T[]> {
  const latDelta = mergeRadius / 111;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const lngDelta = mergeRadius / (111 * Math.max(0.2, Math.abs(cosLat)));
  const bbox = {
    latMin: centerLat - latDelta,
    latMax: centerLat + latDelta,
    lngMin: centerLng - lngDelta,
    lngMax: centerLng + lngDelta,
  };

  console.log('🔎 [hotel] proximité bbox', {
    mergeRadius,
    center: { lat: centerLat, lng: centerLng },
    bbox,
    primaryCount: primary.length,
  });

  let nearby: T[] = [];
  try {
    nearby = await fetchNearby(bbox);
  } catch (e) {
    console.warn('🔎 [hotel] proximité fetch:', e);
    return primary;
  }

  console.log('🔎 [hotel] proximité réponse', {
    nearbyCount: nearby.length,
    sample: nearby.slice(0, 5).map((r) => ({
      id: r.id,
      lat: r.latitude,
      lng: r.longitude,
      title: (r as any).title,
    })),
  });

  const byId = new Map(primary.map((r) => [r.id, r]));
  let added = 0;
  for (const row of nearby) {
    if (byId.has(row.id)) continue;
    const c = coordsOf(row);
    if (!c) continue;
    const d = calculateDistance(centerLat, centerLng, c.lat, c.lng);
    if (d <= mergeRadius) {
      byId.set(row.id, row);
      added++;
    }
  }

  const merged = Array.from(byId.values());
  merged.sort((a, b) => {
    const ca = coordsOf(a);
    const cb = coordsOf(b);
    const da =
      ca != null
        ? calculateDistance(centerLat, centerLng, ca.lat, ca.lng)
        : Number.POSITIVE_INFINITY;
    const db =
      cb != null
        ? calculateDistance(centerLat, centerLng, cb.lat, cb.lng)
        : Number.POSITIVE_INFINITY;
    return da - db;
  });

  console.log('🔎 [hotel] après merge', { added, total: merged.length });
  return merged;
}
