import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface Neighborhood {
  id: string;
  name: string;
  commune?: string;
  parent_id?: string;
  type?: 'neighborhood' | 'commune';
  latitude?: number;
  longitude?: number;
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
          .from("locations")
          .select("id, name, type, parent_id, latitude, longitude")
          .in("type", ["neighborhood", "commune"])
          .order("name", { ascending: true });

        if (error) {
          throw error;
        }

        setNeighborhoods(data || []);
      } catch (err) {
        console.error("Erreur lors du chargement des quartiers:", err);
        setError("Erreur lors du chargement des quartiers");
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