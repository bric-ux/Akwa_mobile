import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface Neighborhood {
  id: string;
  name: string;
  commune: string;
  city_id?: string;
}

export const useNeighborhoods = () => {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNeighborhoods = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('neighborhoods')
          .select('id, name, commune, city_id')
          .order('commune', { ascending: true })
          .order('name', { ascending: true });
        
        if (error) {
          throw error;
        }

        setNeighborhoods(data || []);
      } catch (err) {
        console.error('Erreur lors du chargement des quartiers:', err);
        setError('Erreur lors du chargement des quartiers');
      } finally {
        setLoading(false);
      }
    };

    fetchNeighborhoods();
  }, []);

  return {
    neighborhoods,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      setNeighborhoods([]);
    }
  };
};

