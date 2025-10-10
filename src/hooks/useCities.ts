import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface CityStats {
  id: string;
  name: string;
  propertiesCount: number;
  image: string;
  region: string;
  country: string;
}

export const useCities = () => {
  const [cities, setCities] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCitiesStats();
  }, []);

  const fetchCitiesStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer TOUTES les villes de la table cities
      const { data: allCities, error: citiesError } = await supabase
        .from('cities')
        .select('id, name, region, country');

      if (citiesError) {
        throw citiesError;
      }

      // Récupérer les statistiques des villes avec le nombre de propriétés
      const { data: propertiesData, error: queryError } = await supabase
        .from('properties')
        .select(`
          cities!inner(
            id,
            name,
            region,
            country
          )
        `)
        .not('cities', 'is', null);

      if (queryError) {
        throw queryError;
      }

      // Compter les propriétés par ville
      const cityCounts: { [key: string]: number } = {};
      
      propertiesData?.forEach((property: any) => {
        const city = property.cities;
        if (city) {
          const cityId = city.id;
          cityCounts[cityId] = (cityCounts[cityId] || 0) + 1;
        }
      });

      // Créer la liste finale avec TOUTES les villes (sans limitation par propriétés)
      const citiesArray = (allCities || []).map(city => ({
        id: city.id,
        name: city.name,
        propertiesCount: cityCounts[city.id] || 0,
        image: getCityImage(city.name),
        region: city.region,
        country: city.country,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Trier alphabétiquement par nom

      setCities(citiesArray);
    } catch (err) {
      console.error('Erreur lors du chargement des villes:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour obtenir l'image de la ville
  const getCityImage = (cityName: string): string => {
    const cityImages: { [key: string]: string } = {
      'Abidjan': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Yamoussoukro': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Grand-Bassam': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'San-Pédro': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Bouaké': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Korhogo': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Man': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Gagnoa': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Daloa': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Divo': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Anyama': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
      'Bingerville': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
    };
    
    return cityImages[cityName] || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop';
  };

  // Fonction pour obtenir les destinations populaires (triées par nombre de propriétés)
  const getPopularDestinations = (limit: number = 8): CityStats[] => {
    return cities
      .filter(city => city.propertiesCount > 0) // Filtrer seulement les villes avec au moins 1 propriété
      .sort((a, b) => b.propertiesCount - a.propertiesCount) // Trier par nombre de propriétés
      .slice(0, limit); // Limiter au nombre demandé
  };

  return {
    cities,
    loading,
    error,
    refetch: fetchCitiesStats,
    getPopularDestinations,
  };
};
