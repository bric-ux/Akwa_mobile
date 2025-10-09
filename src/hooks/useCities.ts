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

      // Récupérer les statistiques des villes avec le nombre de propriétés
      const { data, error: queryError } = await supabase
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
      const cityCounts: { [key: string]: CityStats } = {};
      
      data?.forEach((property: any) => {
        const city = property.cities;
        if (city) {
          const cityId = city.id;
          if (cityCounts[cityId]) {
            cityCounts[cityId].propertiesCount += 1;
          } else {
            cityCounts[cityId] = {
              id: cityId,
              name: city.name,
              propertiesCount: 1,
              image: getCityImage(city.name), // Fonction pour obtenir l'image de la ville
              region: city.region,
              country: city.country,
            };
          }
        }
      });

      // Convertir en tableau et trier par nombre de propriétés
      const citiesArray = Object.values(cityCounts)
        .sort((a, b) => b.propertiesCount - a.propertiesCount)
        .slice(0, 6); // Limiter à 6 villes les plus populaires

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
      'Cocody': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
    };
    
    return cityImages[cityName] || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop';
  };

  return {
    cities,
    loading,
    error,
    refetch: fetchCitiesStats,
  };
};
