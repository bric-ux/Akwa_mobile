/**
 * Résolution commune des lieux de recherche (logements, véhicules, mensuel) :
 * hiérarchie locations + secours OpenStreetMap → zone parente (Abobo, Bouaké…).
 */
import { supabase } from '../services/supabase';
import { calculateDistance } from '../utils/distance';
import {
  forwardGeocodeNominatim,
  matchLocationNearCoords,
  reverseGeocodeNominatim,
  type MatchedLocation,
  type ReverseGeocodeResult,
} from './geolocation';

export type ResolveLocationFilters = {
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
};

export type ResolvedSearchLocations = {
  locationIds: string[] | null;
  /** Lieu hors catalogue ou quartier élargi : pas d’exclusion rayon stricte côté client */
  geoSoftMatch: boolean;
  centerLat?: number;
  centerLng?: number;
  /** Noms utiles pour ILIKE (mensuel.location texte) */
  locationNames: string[];
};

/** Élargit ville / commune / quartier à sa sous-arborescence. */
export async function expandLocationIdsForMatch(
  matched: MatchedLocation,
): Promise<string[]> {
  let root = matched;

  if (matched.type === 'neighborhood' && matched.parent_id) {
    const { data: parent } = await supabase
      .from('locations')
      .select('id, name, type, parent_id, latitude, longitude')
      .eq('id', matched.parent_id)
      .maybeSingle();
    if (parent?.id) {
      root = parent as MatchedLocation;
    }
  }

  if (root.type === 'city') {
    const cityIds = [root.id];
    const { data: communes } = await supabase
      .from('locations')
      .select('id')
      .in('parent_id', cityIds)
      .eq('type', 'commune');
    const communeIds = (communes || []).map((l) => l.id);
    let neighborhoodIds: string[] = [];
    if (communeIds.length > 0) {
      const { data: neighborhoods } = await supabase
        .from('locations')
        .select('id')
        .in('parent_id', communeIds)
        .eq('type', 'neighborhood');
      neighborhoodIds = (neighborhoods || []).map((l) => l.id);
    }
    return [...cityIds, ...communeIds, ...neighborhoodIds];
  }

  if (root.type === 'commune') {
    const communeIds = [root.id];
    const { data: neighborhoods } = await supabase
      .from('locations')
      .select('id')
      .in('parent_id', communeIds)
      .eq('type', 'neighborhood');
    const neighborhoodIds = (neighborhoods || []).map((l) => l.id);
    return [...communeIds, ...neighborhoodIds];
  }

  return [root.id];
}

async function namesForLocationIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from('locations').select('name').in('id', ids);
  return (data || [])
    .map((r) => (typeof r.name === 'string' ? r.name.trim() : ''))
    .filter(Boolean);
}

/** Géocode + rattache à Abobo / Bouaké / etc. */
export async function resolveOffCatalogLocationIds(
  searchTerm: string,
  filters?: ResolveLocationFilters,
): Promise<ResolvedSearchLocations> {
  let centerLat =
    filters?.centerLat != null && Number.isFinite(filters.centerLat)
      ? Number(filters.centerLat)
      : undefined;
  let centerLng =
    filters?.centerLng != null && Number.isFinite(filters.centerLng)
      ? Number(filters.centerLng)
      : undefined;
  let reverseHint: ReverseGeocodeResult | null = null;

  if (centerLat == null || centerLng == null) {
    const hits = await forwardGeocodeNominatim(searchTerm, { limit: 1 });
    if (hits[0]) {
      centerLat = hits[0].latitude;
      centerLng = hits[0].longitude;
      const nameParts = hits[0].displayName
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      reverseHint = {
        displayName: hits[0].displayName,
        neighbourhood: hits[0].shortName,
        suburb: nameParts[1],
        city:
          nameParts.find((p) =>
            /abidjan|bouaké|bouake|yamoussoukro|bassam|san[-\s]?p[eé]dro/i.test(p),
          ) || nameParts[2],
        town: nameParts[2],
        county: nameParts[1],
        state: nameParts[nameParts.length - 2],
        country: nameParts[nameParts.length - 1],
        raw: {},
      };
    }
  } else {
    reverseHint = await reverseGeocodeNominatim({
      latitude: centerLat,
      longitude: centerLng,
    });
  }

  if (centerLat == null || centerLng == null) {
    return { locationIds: null, geoSoftMatch: false, locationNames: [] };
  }

  const matched = await matchLocationNearCoords(
    { latitude: centerLat, longitude: centerLng },
    reverseHint,
  );

  if (matched?.id) {
    const locationIds = await expandLocationIdsForMatch(matched);
    const locationNames = await namesForLocationIds(locationIds);
    if (__DEV__) {
      console.log(
        `📍 Lieu "${searchTerm}" hors base → rattaché à ${matched.name} (${matched.type}), ${locationIds.length} location(s)`,
      );
    }
    return {
      locationIds,
      geoSoftMatch: true,
      centerLat,
      centerLng,
      locationNames: [matched.name, searchTerm, ...locationNames].filter(Boolean),
    };
  }

  if (filters?.radiusKm != null && filters.radiusKm > 0) {
    return {
      locationIds: null,
      geoSoftMatch: false,
      centerLat,
      centerLng,
      locationNames: [searchTerm],
    };
  }

  return {
    locationIds: null,
    geoSoftMatch: false,
    centerLat,
    centerLng,
    locationNames: [searchTerm],
  };
}

/**
 * Résout un terme de recherche destination → location_ids (ville/commune/quartier élargi).
 * Gère le cas « Kennedy » vide en base → zone parente ou carte.
 */
export async function resolveLocationIdsForSearchTerm(
  searchTerm: string,
  filters?: ResolveLocationFilters,
): Promise<ResolvedSearchLocations> {
  const term = searchTerm.trim();
  if (!term) {
    return { locationIds: null, geoSoftMatch: false, locationNames: [] };
  }

  const { data: cityData } = await supabase
    .from('locations')
    .select('id, name')
    .eq('type', 'city')
    .ilike('name', `%${term}%`);

  if (cityData && cityData.length > 0) {
    const cityIds = cityData.map((c) => c.id);
    const { data: communeLocations } = await supabase
      .from('locations')
      .select('id')
      .in('parent_id', cityIds)
      .eq('type', 'commune');
    const communeIds = (communeLocations || []).map((l) => l.id);
    let neighborhoodIds: string[] = [];
    if (communeIds.length > 0) {
      const { data: neighborhoodLocations } = await supabase
        .from('locations')
        .select('id')
        .in('parent_id', communeIds)
        .eq('type', 'neighborhood');
      neighborhoodIds = (neighborhoodLocations || []).map((l) => l.id);
    }
    const locationIds = [...cityIds, ...communeIds, ...neighborhoodIds];
    return {
      locationIds,
      geoSoftMatch: false,
      locationNames: cityData.map((c) => c.name),
      centerLat: filters?.centerLat,
      centerLng: filters?.centerLng,
    };
  }

  const { data: communeData } = await supabase
    .from('locations')
    .select('id, name, type, parent_id')
    .eq('type', 'commune')
    .ilike('name', `%${term}%`);

  if (communeData && communeData.length > 0) {
    const communeIds = communeData.map((c) => c.id);
    const { data: neighborhoodLocations } = await supabase
      .from('locations')
      .select('id')
      .in('parent_id', communeIds)
      .eq('type', 'neighborhood');
    const neighborhoodIds = (neighborhoodLocations || []).map((l) => l.id);
    const locationIds = [...communeIds, ...neighborhoodIds];
    return {
      locationIds,
      geoSoftMatch: false,
      locationNames: communeData.map((c) => c.name),
      centerLat: filters?.centerLat,
      centerLng: filters?.centerLng,
    };
  }

  const { data: neighborhoodData } = await supabase
    .from('locations')
    .select('id, name, type, parent_id, latitude, longitude')
    .eq('type', 'neighborhood')
    .ilike('name', `%${term}%`);

  if (neighborhoodData && neighborhoodData.length > 0) {
    let candidates = neighborhoodData;
    const hasCenter =
      filters?.centerLat != null &&
      filters?.centerLng != null &&
      Number.isFinite(Number(filters.centerLat)) &&
      Number.isFinite(Number(filters.centerLng));

    if (hasCenter) {
      candidates = candidates.filter((n) => {
        if (n.latitude == null || n.longitude == null) return false;
        return (
          calculateDistance(
            Number(filters!.centerLat),
            Number(filters!.centerLng),
            Number(n.latitude),
            Number(n.longitude),
          ) <= 40
        );
      });
    }

    if (candidates.length > 0) {
      const expanded = await Promise.all(
        candidates.map((row) => expandLocationIdsForMatch(row as MatchedLocation)),
      );
      const locationIds = [...new Set(expanded.flat())];
      const locationNames = await namesForLocationIds(locationIds);
      return {
        locationIds,
        geoSoftMatch: true,
        locationNames: [...candidates.map((c) => c.name), ...locationNames],
        centerLat: filters?.centerLat,
        centerLng: filters?.centerLng,
      };
    }
  }

  return resolveOffCatalogLocationIds(term, filters);
}
