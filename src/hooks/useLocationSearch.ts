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
  const calculateRelevanceScore = (item: any, query: string, type: 'city' | 'neighborhood'): number => {
    const normalizedQuery = normalizeText(query);
    const normalizedName = normalizeText(item.name);
    const normalizedRegion = type === 'city' ? normalizeText(item.region) : normalizeText(item.commune);
    
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
    // Score pour correspondance dans la région/commune (40 points)
    else if (normalizedRegion.includes(normalizedQuery)) {
      score += 40;
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
    
    // Bonus pour les villes (10 points)
    if (type === 'city') {
      score += 10;
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


      // Recherche intelligente dans les villes avec score
      cities.forEach(city => {
        const score = calculateRelevanceScore(city, query, 'city');
        if (score > 0) {
          results.push({
            id: city.id,
            name: city.name,
            type: 'city' as const,
            region: city.region,
            latitude: city.latitude,
            longitude: city.longitude,
            score
          });
        }
      });

      // Recherche intelligente dans les quartiers avec score
      neighborhoods.forEach(neighborhood => {
        const score = calculateRelevanceScore(neighborhood, query, 'neighborhood');
        if (score > 0) {
          results.push({
            id: neighborhood.id,
            name: neighborhood.name,
            type: 'neighborhood' as const,
            commune: neighborhood.type === 'commune' ? neighborhood.name : undefined,
            city_id: neighborhood.parent_id,
            latitude: neighborhood.latitude,
            longitude: neighborhood.longitude,
            score
          });
        }
      });

      // Recherche intelligente dans les communes avec score
      const communeMap = new Map<string, { score: number; location: any }>();
      
      neighborhoods.forEach(location => {
        if (location.type === 'commune') {
          const communeScore = calculateRelevanceScore(location, query, 'commune');
          if (communeScore > 0) {
            const communeName = location.name;
            // Garder le meilleur score pour chaque commune
            if (!communeMap.has(communeName) || communeMap.get(communeName)!.score < communeScore) {
              communeMap.set(communeName, { score: communeScore, location });
            }
          }
        }
      });

      // Ajouter les communes uniques avec leur meilleur score
      communeMap.forEach(({ score, location }) => {
        results.push({
          id: location.id,
          name: location.name,
          type: 'commune' as const,
          commune: location.name,
          city_id: location.parent_id,
          latitude: location.latitude,
          longitude: location.longitude,
          score
        });
      });

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
