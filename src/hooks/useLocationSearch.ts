import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useCities } from './useCities';
import { useNeighborhoods } from './useNeighborhoods';

export interface LocationResult {
  id: string;
  name: string;
  type: 'city' | 'neighborhood' | 'commune';
  region?: string;
  commune?: string;
  city_id?: string;
  latitude?: number;
  longitude?: number;
}

export const useLocationSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { cities, loading: citiesLoading } = useCities();
  const { neighborhoods, loading: neighborhoodsLoading } = useNeighborhoods();

  // Fonction utilitaire pour normaliser le texte (supprimer accents, tirets, etc.)
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[-\s]/g, '') // Supprimer tirets et espaces
      .replace(/['"]/g, ''); // Supprimer apostrophes et guillemets
  };

  // Fonction de calcul de score de pertinence
  const calculateRelevanceScore = (item: any, query: string, type: 'city' | 'neighborhood' | 'commune'): number => {
    const normalizedQuery = normalizeText(query);
    const normalizedName = normalizeText(item.name);
    
    let score = 0;
    
    // Score pour correspondance exacte du nom (100 points)
    if (normalizedName === normalizedQuery) {
      score += 100;
    }
    // Score pour début du nom (80 points)
    else if (normalizedName.startsWith(normalizedQuery)) {
      score += 80;
    }
    // Score pour inclusion dans le nom (60 points)
    else if (normalizedName.includes(normalizedQuery)) {
      score += 60;
    }
    // Score pour correspondance partielle (20 points)
    else {
      const words = normalizedName.split('');
      const queryWords = normalizedQuery.split('');
      let partialMatches = 0;
      
      for (let i = 0; i < Math.min(words.length, queryWords.length); i++) {
        if (words[i] === queryWords[i]) {
          partialMatches++;
        }
      }
      
      if (partialMatches > 0) {
        score += (partialMatches / Math.max(words.length, queryWords.length)) * 20;
      }
    }
    
    return score;
  };

  const searchLocations = async (query: string): Promise<LocationResult[]> => {
    if (!query || query.length < 2) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const searchLower = query.toLowerCase().trim();
      const results: Array<LocationResult & { score: number }> = [];

      console.log('🔍 [useLocationSearch] Recherche pour:', query);

      // Recherche directe dans la base de données pour garantir les résultats
      // 1. Rechercher les villes
      const { data: citiesData, error: citiesError } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude, type')
        .eq('type', 'city')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (!citiesError && citiesData) {
        citiesData.forEach(city => {
          const score = calculateRelevanceScore(city, query, 'city');
          if (score > 0) {
            results.push({
              id: city.id,
              name: city.name,
              type: 'city' as const,
              latitude: city.latitude,
              longitude: city.longitude,
              score: score + 100 // Bonus pour les villes
            });
          }
        });
      }

      // 2. Rechercher les communes
      const { data: communesData, error: communesError } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude, type, parent_id')
        .eq('type', 'commune')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (!communesError && communesData) {
        communesData.forEach(commune => {
          const score = calculateRelevanceScore(commune, query, 'commune');
          if (score > 0) {
            results.push({
              id: commune.id,
              name: commune.name,
              type: 'commune' as const,
              commune: commune.name,
              city_id: commune.parent_id,
              latitude: commune.latitude,
              longitude: commune.longitude,
              score: score + 50 // Bonus pour les communes
            });
          }
        });
      }

      // 3. Rechercher les quartiers
      const { data: neighborhoodsData, error: neighborhoodsError } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude, type, parent_id')
        .eq('type', 'neighborhood')
        .ilike('name', `%${query}%`)
        .limit(10);

      if (!neighborhoodsError && neighborhoodsData && neighborhoodsData.length > 0) {
        const parentIds = neighborhoodsData.map(n => n.parent_id).filter(Boolean) as string[];
        let parentNames: { [key: string]: string } = {};
        let parentParentIds: string[] = [];
        if (parentIds.length > 0) {
          const { data: parents } = await supabase
            .from('locations')
            .select('id, name, type, parent_id')
            .in('id', parentIds);
          if (parents) {
            parentNames = parents.reduce((acc, p) => {
              acc[p.id] = p.name;
              return acc;
            }, {} as { [key: string]: string });
            parentParentIds = parents.map(p => p.parent_id).filter(Boolean) as string[];
          }
        }
        let cityNames: Record<string, string> = {};
        if (parentParentIds.length > 0) {
          const { data: cityRows } = await supabase
            .from('locations')
            .select('id, name')
            .in('id', parentParentIds);
          if (cityRows) cityNames = cityRows.reduce((acc, r) => { acc[r.id] = r.name; return acc; }, {} as Record<string, string>);
        }

        const communeToCityId = parentIds.length > 0 && parents
          ? (parents as { id: string; parent_id?: string }[]).reduce((acc, p) => {
              if (p.parent_id) acc[p.id] = p.parent_id;
              return acc;
            }, {} as Record<string, string>)
          : {};

        neighborhoodsData.forEach(neighborhood => {
          const score = calculateRelevanceScore(neighborhood, query, 'neighborhood');
          if (score > 0) {
            const communeName = neighborhood.parent_id ? parentNames[neighborhood.parent_id] : undefined;
            const cityId = neighborhood.parent_id ? communeToCityId[neighborhood.parent_id] : undefined;
            const cityName = cityId ? cityNames[cityId] : undefined;
            results.push({
              id: neighborhood.id,
              name: neighborhood.name,
              type: 'neighborhood' as const,
              cityName,
              commune: communeName,
              city_id: neighborhood.parent_id,
              latitude: neighborhood.latitude,
              longitude: neighborhood.longitude,
              score
            });
          }
        });
      }

      // Trier par score décroissant, puis par type, puis par nom
      results.sort((a, b) => {
        // D'abord par score
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        
        // Puis par type (villes d'abord, puis communes, puis quartiers)
        if (a.type !== b.type) {
          const typeOrder = { city: 0, commune: 1, neighborhood: 2 };
          return typeOrder[a.type] - typeOrder[b.type];
        }
        
        // Enfin par nom alphabétique
        return a.name.localeCompare(b.name);
      });

      // Supprimer le score des résultats finaux
      const finalResults = results.map(({ score, ...result }) => result);

      console.log('✅ [useLocationSearch] Résultats trouvés:', finalResults.length);
      console.log('📋 [useLocationSearch] Premiers résultats:', finalResults.slice(0, 5).map(r => `${r.name} (${r.type})`));

      // Limiter à 20 résultats pour les performances
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
      // Récupérer simplement les villes disponibles avec coordonnées
      const { data, error } = await supabase
        .from('locations')
        .select('id, name, latitude, longitude')
        .eq('type', 'city')
        .limit(8);

      if (error) {
        console.error('Erreur lors du chargement des villes:', error);
        return [];
      }

      return (data || []).map(city => ({
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
