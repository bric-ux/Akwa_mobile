import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Vehicle } from '../types';

export interface SavedVehicle {
  id: string;
  user_id: string;
  vehicle_id: string;
  created_at: string;
  vehicles?: Vehicle;
}

// Cache global partagé entre toutes les instances du hook
let globalVehicleFavoritesCache: Set<string> = new Set();
let globalVehicleCacheListeners: Set<() => void> = new Set();

const notifyVehicleCacheListeners = () => {
  globalVehicleCacheListeners.forEach(listener => listener());
};

export const useVehicleFavorites = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const { user } = useAuth();

  // Charger le cache des favoris au démarrage
  useEffect(() => {
    if (user) {
      loadVehicleFavoritesCache();
    } else {
      globalVehicleFavoritesCache.clear();
      notifyVehicleCacheListeners();
    }
  }, [user]);

  // Écouter les changements du cache global
  useEffect(() => {
    const listener = () => {
      setCacheVersion(prev => prev + 1);
    };
    
    globalVehicleCacheListeners.add(listener);
    
    return () => {
      globalVehicleCacheListeners.delete(listener);
    };
  }, []);

  const loadVehicleFavoritesCache = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('saved_vehicles')
        .select('vehicle_id')
        .eq('user_id', user.id);

      globalVehicleFavoritesCache = new Set(data?.map(item => item.vehicle_id) || []);
      notifyVehicleCacheListeners();
    } catch (error) {
      console.error('Erreur lors du chargement du cache des favoris véhicules:', error);
    }
  };

  const toggleFavorite = async (vehicleId: string) => {
    if (!user) {
      throw new Error('Vous devez être connecté pour ajouter des favoris');
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier si déjà en favoris
      const { data: existing } = await supabase
        .from('saved_vehicles')
        .select('id')
        .eq('user_id', user.id)
        .eq('vehicle_id', vehicleId)
        .maybeSingle();

      if (existing) {
        // Retirer des favoris
        const { error } = await supabase
          .from('saved_vehicles')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        
        // Mettre à jour le cache global
        globalVehicleFavoritesCache.delete(vehicleId);
        notifyVehicleCacheListeners();
        
        return false; // Retiré des favoris
      } else {
        // Ajouter aux favoris
        const { error } = await supabase
          .from('saved_vehicles')
          .insert({ user_id: user.id, vehicle_id: vehicleId });

        if (error) throw error;
        
        // Mettre à jour le cache global
        globalVehicleFavoritesCache.add(vehicleId);
        notifyVehicleCacheListeners();
        
        return true; // Ajouté aux favoris
      }
    } catch (err: any) {
      console.error('Error toggling vehicle favorite:', err);
      setError(err.message || 'Impossible de modifier les favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getFavorites = async (): Promise<Vehicle[]> => {
    if (!user) {
      setError('Vous devez être connecté pour voir vos favoris');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('saved_vehicles')
        .select(`
          *,
          vehicles:vehicle_id (
            *,
            locations:location_id (
              id,
              name,
              type,
              latitude,
              longitude,
              parent_id
            ),
            vehicle_photos (
              id,
              url,
              is_main,
              created_at
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transformer les données pour correspondre à l'interface Vehicle
      const favorites = data?.map((item: any) => {
        const vehicle = item.vehicles;
        
        // Traiter les photos
        const vehiclePhotos = vehicle.vehicle_photos || [];
        const sortedPhotos = vehiclePhotos.sort((a: any, b: any) => (a.is_main ? 0 : 1) - (b.is_main ? 0 : 1));
        
        // Créer un tableau d'images pour la compatibilité
        const imageUrls = sortedPhotos.map((photo: any) => photo.url);
        
        // Si pas de photos, utiliser l'ancien système
        const fallbackImages = vehicle.images || [];
        const finalImages = imageUrls.length > 0 ? imageUrls : fallbackImages;
        
        return {
          ...vehicle,
          images: finalImages,
          vehicle_photos: sortedPhotos,
          location: vehicle.locations ? {
            id: vehicle.locations.id,
            name: vehicle.locations.name,
            type: vehicle.locations.type,
            latitude: vehicle.locations.latitude,
            longitude: vehicle.locations.longitude,
            parent_id: vehicle.locations.parent_id
          } : undefined,
        };
      }) || [];

      return favorites;
    } catch (err: any) {
      console.error('Error fetching vehicle favorites:', err);
      setError(err.message || 'Impossible de charger vos favoris');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const isFavorite = async (vehicleId: string): Promise<boolean> => {
    if (!user) return false;

    // Utiliser le cache d'abord pour une réponse rapide
    if (globalVehicleFavoritesCache.has(vehicleId)) {
      return true;
    }

    try {
      const { data } = await supabase
        .from('saved_vehicles')
        .select('id')
        .eq('user_id', user.id)
        .eq('vehicle_id', vehicleId)
        .maybeSingle();

      const isFav = !!data;
      
      // Mettre à jour le cache si nécessaire
      if (isFav) {
        globalVehicleFavoritesCache.add(vehicleId);
        notifyVehicleCacheListeners();
      }
      
      return isFav;
    } catch (error) {
      console.error('Error checking if vehicle is favorite:', error);
      return false;
    }
  };

  const removeFavorite = async (vehicleId: string) => {
    if (!user) {
      throw new Error('Vous devez être connecté pour retirer des favoris');
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('saved_vehicles')
        .delete()
        .eq('user_id', user.id)
        .eq('vehicle_id', vehicleId);

      if (error) throw error;
      
      // Mettre à jour le cache global
      globalVehicleFavoritesCache.delete(vehicleId);
      notifyVehicleCacheListeners();
    } catch (err: any) {
      console.error('Error removing vehicle favorite:', err);
      setError(err.message || 'Impossible de retirer des favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fonction synchrone pour vérifier les favoris (utilise le cache global)
  const isFavoriteSync = (vehicleId: string): boolean => {
    return globalVehicleFavoritesCache.has(vehicleId);
  };

  return {
    loading,
    error,
    toggleFavorite,
    getFavorites,
    isFavorite,
    isFavoriteSync,
    removeFavorite,
    refreshCache: loadVehicleFavoritesCache,
    cacheVersion // Exposer cacheVersion pour que les composants puissent réagir aux changements
  };
};

