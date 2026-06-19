import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Amenity } from '../types';
import { getAmenityIcon } from '../utils/amenityIcons';

const TTL_MS = 10 * 60 * 1000;
let cachedAmenities: Amenity[] | null = null;
let cachedAt = 0;
let inflight: Promise<Amenity[]> | null = null;

async function fetchAmenitiesFromDb(): Promise<Amenity[]> {
  const { data, error } = await supabase
    .from('property_amenities')
    .select('*')
    .order('category', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((amenity) => ({
    ...amenity,
    icon: getAmenityIcon(amenity.name),
  }));
}

export async function preloadAmenitiesCatalog(): Promise<void> {
  try {
    await loadAmenitiesCatalog();
  } catch {
    // silencieux — le hook retentera à l'ouverture des filtres
  }
}

export async function loadAmenitiesCatalog(): Promise<Amenity[]> {
  if (cachedAmenities && Date.now() - cachedAt < TTL_MS) {
    return cachedAmenities;
  }
  if (inflight) return inflight;

  inflight = fetchAmenitiesFromDb()
    .then((data) => {
      cachedAmenities = data;
      cachedAt = Date.now();
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export const useAmenities = () => {
  const [amenities, setAmenities] = useState<Amenity[]>(cachedAmenities ?? []);
  const [loading, setLoading] = useState(!cachedAmenities);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await loadAmenitiesCatalog();
      setAmenities(data);
      setError(null);
    } catch (err) {
      console.error('Erreur lors du chargement des équipements:', err);
      setError('Erreur lors du chargement des équipements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groupedAmenities = amenities.reduce(
    (acc, amenity) => {
      const category = amenity.category || 'general';
      if (!acc[category]) acc[category] = [];
      acc[category].push(amenity);
      return acc;
    },
    {} as Record<string, Amenity[]>,
  );

  return {
    amenities,
    groupedAmenities,
    loading,
    error,
  };
};
