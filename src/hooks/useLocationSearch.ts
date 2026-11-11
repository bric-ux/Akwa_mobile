import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useCities } from './useCities';
import { useNeighborhoods } from './useNeighborhoods';
import { forwardGeocodeCombined, formatForwardGeocodeLabel } from '../lib/geolocation';
import {
  buildNameIlikeOrFilter,
  haystackMatchesAllTokens,
  scoreTokenMatch,
  tokenizeSearchQuery,
  normalizeSearchText,
} from '../lib/locationTextSearch';

export interface LocationResult {
  id: string;
  name: string;
  type: 'city' | 'neighborhood' | 'commune';
  region?: string;
  commune?: string;
  city_id?: string;
  cityName?: string;
  latitude?: number;
  longitude?: number;
  /** Suggestion OpenStreetMap (hors table locations) */
  fromMap?: boolean;
}

type LocRow = {
  id: string;
  name: string;
  type: string;
  latitude?: number | null;
  longitude?: number | null;
  parent_id?: string | null;
};

export const useLocationSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loading: citiesLoading } = useCities();
  const { loading: neighborhoodsLoading } = useNeighborhoods();

  const searchLocations = async (query: string): Promise<LocationResult[]> => {
    if (!query || query.length < 2) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const tokens = tokenizeSearchQuery(query);
      if (!tokens.length) return [];

      const orFilter = buildNameIlikeOrFilter(tokens);
      const results: Array<LocationResult & { score: number }> = [];

      console.log('🔍 [useLocationSearch] Recherche pour:', query, 'tokens:', tokens);

      const fetchType = async (type: 'city' | 'commune' | 'neighborhood') => {
        let q = supabase
          .from('locations')
          .select('id, name, latitude, longitude, type, parent_id')
          .eq('type', type)
          .limit(40);
        q = orFilter ? q.or(orFilter) : q.ilike('name', `%${query}%`);
        const { data, error: err } = await q;
        if (err) {
          console.warn(`[useLocationSearch] ${type}:`, err.message);
          return [] as LocRow[];
        }
        return (data || []) as LocRow[];
      };

      const [citiesData, communesData, neighborhoodsData] = await Promise.all([
        fetchType('city'),
        fetchType('commune'),
        fetchType('neighborhood'),
      ]);

      // Parents pour communes / quartiers
      const parentIds = [
        ...communesData.map((c) => c.parent_id),
        ...neighborhoodsData.map((n) => n.parent_id),
      ].filter(Boolean) as string[];

      let parentsById: Record<
        string,
        { id: string; name: string; type?: string; parent_id?: string | null }
      > = {};
      if (parentIds.length) {
        const { data: parents } = await supabase
          .from('locations')
          .select('id, name, type, parent_id')
          .in('id', [...new Set(parentIds)]);
        parentsById = (parents || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as typeof parentsById);
      }

      const grandParentIds = Object.values(parentsById)
        .map((p) => p.parent_id)
        .filter(Boolean) as string[];
      let citiesById: Record<string, string> = {};
      if (grandParentIds.length) {
        const { data: cityRows } = await supabase
          .from('locations')
          .select('id, name')
          .in('id', [...new Set(grandParentIds)]);
        citiesById = (cityRows || []).reduce((acc, r) => {
          acc[r.id] = r.name;
          return acc;
        }, {} as Record<string, string>);
      }

      for (const city of citiesData) {
        const hay = city.name;
        if (!haystackMatchesAllTokens(hay, tokens) && tokens.length > 1) continue;
        if (tokens.length === 1 && !haystackMatchesAllTokens(hay, tokens)) continue;
        const score = scoreTokenMatch(city.name, tokens, query) + 100;
        if (score <= 0) continue;
        results.push({
          id: city.id,
          name: city.name,
          type: 'city',
          latitude: city.latitude ?? undefined,
          longitude: city.longitude ?? undefined,
          score,
        });
      }

      for (const commune of communesData) {
        const parentName = commune.parent_id ? parentsById[commune.parent_id]?.name : '';
        const hay = `${commune.name} ${parentName || ''}`;
        if (!haystackMatchesAllTokens(hay, tokens)) continue;
        const score = scoreTokenMatch(commune.name, tokens, query) + 50;
        results.push({
          id: commune.id,
          name: commune.name,
          type: 'commune',
          commune: commune.name,
          city_id: commune.parent_id ?? undefined,
          cityName: parentName || undefined,
          latitude: commune.latitude ?? undefined,
          longitude: commune.longitude ?? undefined,
          score,
        });
      }

      for (const neighborhood of neighborhoodsData) {
        const parent = neighborhood.parent_id ? parentsById[neighborhood.parent_id] : null;
        const communeName = parent?.name;
        const cityName =
          parent?.parent_id != null ? citiesById[parent.parent_id] : undefined;
        // Cocody peut être type commune ou city selon la hiérarchie
        const parentAsCity =
          parent?.type === 'city' || parent?.type === 'commune' ? parent.name : undefined;
        const hay = `${neighborhood.name} ${communeName || ''} ${cityName || ''} ${parentAsCity || ''}`;
        if (!haystackMatchesAllTokens(hay, tokens)) continue;
        const score = scoreTokenMatch(neighborhood.name, tokens, query);
        results.push({
          id: neighborhood.id,
          name: neighborhood.name,
          type: 'neighborhood',
          cityName: cityName || parentAsCity,
          commune: communeName,
          city_id: neighborhood.parent_id ?? undefined,
          latitude: neighborhood.latitude ?? undefined,
          longitude: neighborhood.longitude ?? undefined,
          score,
        });
      }

      results.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.type !== b.type) {
          const typeOrder = { city: 0, commune: 1, neighborhood: 2 };
          return typeOrder[a.type] - typeOrder[b.type];
        }
        return a.name.localeCompare(b.name);
      });

      let finalResults = results.map(({ score: _s, ...result }) => result);

      // OSM : toujours si multi-mots ou si peu de résultats DB
      const shouldOsm = tokens.length > 1 || finalResults.length < 5;
      if (shouldOsm) {
        try {
          const osmHits = await forwardGeocodeCombined(query.trim(), { limit: 8 });
          for (const hit of osmHits) {
            const label = formatForwardGeocodeLabel(hit);
            const already = finalResults.some(
              (r) =>
                normalizeSearchText(r.name) === normalizeSearchText(hit.shortName) ||
                normalizeSearchText(r.name) === normalizeSearchText(label),
            );
            if (already) continue;
            finalResults.push({
              id: `osm_${hit.placeId}`,
              name: label,
              type: hit.typeHint,
              latitude: hit.latitude,
              longitude: hit.longitude,
              fromMap: true,
            });
          }
        } catch (e) {
          console.warn('[useLocationSearch] Nominatim:', e);
        }
      }

      console.log(
        '✅ [useLocationSearch] Résultats:',
        finalResults.length,
        finalResults.slice(0, 5).map((r) => `${r.name} (${r.type}${r.fromMap ? '/map' : ''})`),
      );

      return finalResults.slice(0, 20);
    } catch (err: any) {
      console.error('❌ Erreur lors de la recherche de localisation:', err);
      setError(err.message || 'Erreur lors de la recherche');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getPopularLocations = async (): Promise<LocationResult[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: qErr } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude')
        .eq('type', 'city')
        .limit(8);

      if (qErr) {
        console.error('Erreur lors du chargement des villes:', qErr);
        return [];
      }

      return (data || []).map((city) => ({
        id: city.id,
        name: city.name,
        type: 'city' as const,
        latitude: city.latitude,
        longitude: city.longitude,
      }));
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des villes:', err);
      setError(err.message || 'Erreur lors du chargement');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading: loading || citiesLoading || neighborhoodsLoading,
    error,
    searchLocations,
    getPopularLocations,
  };
};
