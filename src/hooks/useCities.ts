import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface City {
  id: string;
  name: string;
  region?: string;
  latitude?: number;
  longitude?: number;
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
          .from('locations')
          .select('id, name, latitude, longitude')
          .eq('type', 'city')
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
          location_id,
          locations:location_id(
            id,
            name,
            type,
            parent_id
          )
        `)
        .eq('is_active', true)
        .not('location_id', 'is', null);

      console.log('Données brutes des propriétés:', data);
      console.log('Nombre de propriétés trouvées:', data?.length || 0);

      // Compter le nombre de propriétés par ville (en remontant la hiérarchie)
      const cityCounts: { [key: string]: { city: any; count: number } } = {};
      
      // Pour chaque propriété, trouver la ville parente
      for (const property of data || []) {
        const location = property.locations;
        if (!location || !location.id) continue;
        
        let cityId = location.id;
        let cityName = location.name;
        
        // Si c'est une commune ou un quartier, remonter jusqu'à la ville
        if (location.type === 'commune' || location.type === 'neighborhood') {
          if (location.parent_id) {
            // Récupérer la ville parente
            const { data: parentLocation } = await supabase
              .from('locations')
              .select('id, name, type, parent_id')
              .eq('id', location.parent_id)
              .single();
            
            if (parentLocation) {
              if (parentLocation.type === 'city') {
                cityId = parentLocation.id;
                cityName = parentLocation.name;
              } else if (parentLocation.type === 'commune' && parentLocation.parent_id) {
                // Remonter encore une fois si nécessaire
                const { data: grandParent } = await supabase
                  .from('locations')
                  .select('id, name')
                  .eq('id', parentLocation.parent_id)
                  .eq('type', 'city')
                  .single();
                
                if (grandParent) {
                  cityId = grandParent.id;
                  cityName = grandParent.name;
                }
              }
            }
          }
        }
        
        // Ne compter que les villes
        if (location.type === 'city' || cityId) {
          if (!cityCounts[cityId]) {
            cityCounts[cityId] = {
              city: { id: cityId, name: cityName },
              count: 0
            };
          }
          cityCounts[cityId].count++;
        }
      }

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