import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface City {
  id: string;
  name: string;
  region: string;
}

export const useCities = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('cities')
          .select('id, name, region')
          .order('name');
        
        if (error) {
          throw error;
        }

        // Supprimer les doublons par nom
        const uniqueCities = data?.filter((city, index, arr) => 
          arr.findIndex(c => c.name === city.name) === index
        ) || [];

        setCities(uniqueCities);
      } catch (err) {
        console.error('Erreur lors du chargement des villes:', err);
        setError('Erreur lors du chargement des villes');
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, []);

  const getPopularDestinations = async (limit: number = 8) => {
    try {
      // Récupérer les villes avec le nombre de propriétés en utilisant une requête avec agrégation
      const { data, error } = await supabase
        .from('properties')
        .select(`
          city_id,
          cities!inner(
            id,
            name,
            region
          )
        `)
        .eq('is_active', true)
        .not('city_id', 'is', null);

      console.log('Données brutes des propriétés:', data);
      console.log('Nombre de propriétés trouvées:', data?.length || 0);

      // Compter le nombre de propriétés par ville
      const cityCounts: { [key: string]: { city: any; count: number } } = {};
      
      data?.forEach((property: any) => {
        const cityId = property.city_id;
        const city = property.cities;
        
        if (cityId && city) {
          if (!cityCounts[cityId]) {
            cityCounts[cityId] = {
              city: city,
              count: 0
            };
          }
          cityCounts[cityId].count++;
        }
      });

      // Convertir en tableau et trier par nombre de propriétés
      const popularDestinations = Object.values(cityCounts)
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map(item => ({
          ...item.city,
          propertyCount: item.count
        }));

      console.log('Destinations populaires trouvées:', popularDestinations);
      
      // Si aucune destination trouvée, utiliser les villes disponibles
      if (popularDestinations.length === 0) {
        console.log('Aucune destination populaire trouvée, utilisation des villes disponibles');
        return cities.slice(0, limit);
      }
      
      return popularDestinations;
    } catch (err) {
      console.error('Erreur lors de la récupération des destinations populaires:', err);
      // Fallback vers les premières villes si erreur
      return cities.slice(0, limit);
    }
  };

  return {
    cities,
    loading,
    error,
    getPopularDestinations,
    refetch: () => {
      setLoading(true);
      setCities([]);
    }
  };
};