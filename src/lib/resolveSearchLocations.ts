/**
 * Résolution commune des lieux de recherche (logements, véhicules, mensuel) :
 * hiérarchie locations + secours OpenStreetMap → zone parente (Abobo, Bouaké…).
 */
import { supabase } from '../services/supabase';
import { calculateDistance } from '../utils/distance';
import {
  forwardGeocodeCombined,
  matchLocationNearCoords,
  reverseGeocodeNominatim,
  type MatchedLocation,
  type ReverseGeocodeResult,
} from './geolocation';
import {
  buildNameIlikeOrFilter,
  haystackMatchesAllTokens,
  tokenizeSearchQuery,
} from './locationTextSearch';

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
    const hits = await forwardGeocodeCombined(searchTerm, { limit: 1 });
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

  console.log('🔎 [resolve] start', {
    term,
    filtersCenter: { lat: filters?.centerLat ?? null, lng: filters?.centerLng ?? null },
    radiusKm: filters?.radiusKm ?? null,
  });

  // Multi-mots (« cocody angré ») : matcher nom + parent, pas la chaîne entière
  const tokens = tokenizeSearchQuery(term);
  if (tokens.length >= 2) {
    const orFilter = buildNameIlikeOrFilter(tokens);
    const { data: neighRows } = await supabase
      .from('locations')
      .select('id, name, type, parent_id, latitude, longitude')
      .eq('type', 'neighborhood')
      .or(orFilter!)
      .limit(40);

    if (neighRows?.length) {
      const parentIds = [
        ...new Set(neighRows.map((n) => n.parent_id).filter(Boolean) as string[]),
      ];
      const { data: parents } = await supabase
        .from('locations')
        .select('id, name, type, parent_id')
        .in('id', parentIds);
      const parentsById = (parents || []).reduce(
        (acc, p) => {
          acc[p.id] = p;
          return acc;
        },
        {} as Record<string, { id: string; name: string; type: string; parent_id?: string | null }>,
      );
      const gpIds = [
        ...new Set(
          (parents || []).map((p) => p.parent_id).filter(Boolean) as string[],
        ),
      ];
      let citiesById: Record<string, string> = {};
      if (gpIds.length) {
        const { data: cities } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', gpIds);
        citiesById = (cities || []).reduce((acc, c) => {
          acc[c.id] = c.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const matched = neighRows.filter((n) => {
        const p = n.parent_id ? parentsById[n.parent_id] : null;
        const cityName = p?.parent_id ? citiesById[p.parent_id] : '';
        const hay = `${n.name} ${p?.name || ''} ${cityName}`;
        return haystackMatchesAllTokens(hay, tokens);
      });

      if (matched.length > 0) {
        const expanded = await Promise.all(
          matched.map((row) => expandLocationIdsForMatch(row as MatchedLocation)),
        );
        const locationIds = [...new Set(expanded.flat())];
        const locationNames = await namesForLocationIds(locationIds);
        const withCoords = matched.find(
          (c) => c.latitude != null && c.longitude != null,
        );
        console.log('🔎 [resolve] match MULTI-TOKEN neighborhood', {
          tokens,
          matched: matched.map((m) => m.name),
          locationIdsCount: locationIds.length,
        });
        return {
          locationIds,
          geoSoftMatch: true,
          locationNames: [...matched.map((m) => m.name), ...locationNames],
          centerLat: withCoords?.latitude ?? filters?.centerLat,
          centerLng: withCoords?.longitude ?? filters?.centerLng,
        };
      }

      // Même logique pour communes (ex. « abidjan cocody »)
      const { data: communeRows } = await supabase
        .from('locations')
        .select('id, name, type, parent_id, latitude, longitude')
        .eq('type', 'commune')
        .or(orFilter!)
        .limit(40);
      if (communeRows?.length) {
        const cParentIds = [
          ...new Set(communeRows.map((c) => c.parent_id).filter(Boolean) as string[]),
        ];
        const { data: cParents } = cParentIds.length
          ? await supabase.from('locations').select('id, name').in('id', cParentIds)
          : { data: [] as { id: string; name: string }[] };
        const cParentNames = (cParents || []).reduce((acc, p) => {
          acc[p.id] = p.name;
          return acc;
        }, {} as Record<string, string>);
        const matchedCommunes = communeRows.filter((c) => {
          const hay = `${c.name} ${c.parent_id ? cParentNames[c.parent_id] || '' : ''}`;
          return haystackMatchesAllTokens(hay, tokens);
        });
        if (matchedCommunes.length > 0) {
          const expanded = await Promise.all(
            matchedCommunes.map((row) =>
              expandLocationIdsForMatch(row as MatchedLocation),
            ),
          );
          const locationIds = [...new Set(expanded.flat())];
          const locationNames = await namesForLocationIds(locationIds);
          const withCoords = matchedCommunes.find(
            (c) => c.latitude != null && c.longitude != null,
          );
          console.log('🔎 [resolve] match MULTI-TOKEN commune', {
            tokens,
            matched: matchedCommunes.map((m) => m.name),
          });
          return {
            locationIds,
            geoSoftMatch: true,
            locationNames: [...matchedCommunes.map((m) => m.name), ...locationNames],
            centerLat: withCoords?.latitude ?? filters?.centerLat,
            centerLng: withCoords?.longitude ?? filters?.centerLng,
          };
        }
      }
    }
  }

  const { data: cityData } = await supabase
    .from('locations')
    .select('id, name, latitude, longitude')
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
    const withCoords = cityData.find((c: any) => c.latitude != null && c.longitude != null);
    const result = {
      locationIds,
      geoSoftMatch: true,
      locationNames: cityData.map((c) => c.name),
      centerLat: withCoords?.latitude ?? filters?.centerLat,
      centerLng: withCoords?.longitude ?? filters?.centerLng,
    };
    console.log('🔎 [resolve] match CITY', {
      cities: cityData.map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
      })),
      communeCount: communeIds.length,
      neighborhoodCount: neighborhoodIds.length,
      locationIdsCount: locationIds.length,
      center: { lat: result.centerLat, lng: result.centerLng },
    });
    return result;
  }

  const { data: communeData } = await supabase
    .from('locations')
    .select('id, name, type, parent_id, latitude, longitude')
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
    const withCoords = communeData.find((c: any) => c.latitude != null && c.longitude != null);
    const result = {
      locationIds,
      geoSoftMatch: true,
      locationNames: communeData.map((c) => c.name),
      centerLat: withCoords?.latitude ?? filters?.centerLat,
      centerLng: withCoords?.longitude ?? filters?.centerLng,
    };
    console.log('🔎 [resolve] match COMMUNE', {
      communes: communeData.map((c) => ({
        id: c.id,
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
      })),
      neighborhoodCount: neighborhoodIds.length,
      locationIdsCount: locationIds.length,
      center: { lat: result.centerLat, lng: result.centerLng },
    });
    return result;
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
      const result = {
        locationIds,
        geoSoftMatch: true,
        locationNames: [...candidates.map((c) => c.name), ...locationNames],
        centerLat: filters?.centerLat,
        centerLng: filters?.centerLng,
      };
      console.log('🔎 [resolve] match NEIGHBORHOOD', {
        neighborhoods: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          lat: c.latitude,
          lng: c.longitude,
        })),
        locationIdsCount: locationIds.length,
        filteredByCenter40km: hasCenter,
        center: { lat: result.centerLat, lng: result.centerLng },
      });
      return result;
    }
  }

  console.log('🔎 [resolve] pas de match DB → off-catalog / OSM', { term });
  const off = await resolveOffCatalogLocationIds(term, filters);
  console.log('🔎 [resolve] off-catalog result', {
    locationIdsCount: off.locationIds?.length ?? 0,
    soft: off.geoSoftMatch,
    center: { lat: off.centerLat, lng: off.centerLng },
    names: off.locationNames,
  });
  return off;
}
