import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

let globalHotelFavoritesCache: Set<string> = new Set();
let globalHotelCacheListeners: Set<() => void> = new Set();

const notifyHotelCacheListeners = () => {
  globalHotelCacheListeners.forEach((listener) => listener());
};

export const useHotelFavorites = () => {
  const [loading, setLoading] = useState(false);
  const [, setCacheVersion] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      void loadFavoritesCache();
    } else {
      globalHotelFavoritesCache.clear();
      notifyHotelCacheListeners();
    }
  }, [user]);

  useEffect(() => {
    const listener = () => {
      setCacheVersion((prev) => prev + 1);
    };
    globalHotelCacheListeners.add(listener);
    return () => {
      globalHotelCacheListeners.delete(listener);
    };
  }, []);

  const loadFavoritesCache = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('saved_hotel_establishments')
        .select('hotel_establishment_id')
        .eq('user_id', user.id);

      globalHotelFavoritesCache = new Set(data?.map((item) => item.hotel_establishment_id) || []);
      notifyHotelCacheListeners();
    } catch (error) {
      console.error('Erreur chargement favoris hôtel:', error);
    }
  };

  const toggleFavorite = async (hotelEstablishmentId: string) => {
    if (!user) {
      throw new Error('Vous devez être connecté pour ajouter des favoris');
    }

    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('saved_hotel_establishments')
        .select('id')
        .eq('user_id', user.id)
        .eq('hotel_establishment_id', hotelEstablishmentId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('saved_hotel_establishments')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        globalHotelFavoritesCache.delete(hotelEstablishmentId);
        notifyHotelCacheListeners();
        return false;
      }

      const { error } = await supabase
        .from('saved_hotel_establishments')
        .insert({ user_id: user.id, hotel_establishment_id: hotelEstablishmentId });
      if (error) throw error;

      globalHotelFavoritesCache.add(hotelEstablishmentId);
      notifyHotelCacheListeners();
      return true;
    } finally {
      setLoading(false);
    }
  };

  const isFavoriteSync = (hotelEstablishmentId: string): boolean => {
    return globalHotelFavoritesCache.has(hotelEstablishmentId);
  };

  return {
    loading,
    toggleFavorite,
    isFavoriteSync,
    refreshCache: loadFavoritesCache,
  };
};
