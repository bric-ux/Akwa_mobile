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
      'Abidjan': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'Yamoussoukro': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'Grand-Bassam': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'San-Pédro': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'Bouaké': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'Korhogo': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'Man': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
      'Gagnoa': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
    };
    
    return cityImages[cityName] || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400';
  };

  return {
    cities,
    loading,
    error,
    refetch: fetchCitiesStats,
  };
};
