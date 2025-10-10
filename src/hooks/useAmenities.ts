import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Amenity } from '../types';
import { getAmenityIcon } from '../utils/amenityIcons';

export const useAmenities = () => {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAmenities = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('property_amenities')
          .select('*')
          .order('category', { ascending: true });

        if (error) {
          throw error;
        }

        if (data) {
          // Ajouter les icônes appropriées à chaque équipement
          const amenitiesWithIcons = data.map(amenity => ({
            ...amenity,
            icon: getAmenityIcon(amenity.name)
          }));
          setAmenities(amenitiesWithIcons);
        }
      } catch (err) {
        console.error('Erreur lors du chargement des équipements:', err);
        setError('Erreur lors du chargement des équipements');
      } finally {
        setLoading(false);
      }
    };

    fetchAmenities();
  }, []);

  // Grouper les équipements par catégorie
  const groupedAmenities = amenities.reduce((acc, amenity) => {
    const category = amenity.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(amenity);
    return acc;
  }, {} as Record<string, Amenity[]>);

  return {
    amenities,
    groupedAmenities,
    loading,
    error
  };
};
