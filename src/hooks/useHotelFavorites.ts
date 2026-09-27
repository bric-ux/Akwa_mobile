import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { HotelEstablishmentPublic } from './useApprovedHotelEstablishments';

let globalHotelFavoritesCache: Set<string> = new Set();
let globalHotelCacheListeners: Set<() => void> = new Set();

const notifyHotelCacheListeners = () => {
  globalHotelCacheListeners.forEach((listener) => listener());
};

/** Favoris établissements hôteliers (`saved_hotel_establishments`). */
export const useHotelFavorites = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      void loadHotelFavoritesCache();
    } else {
      globalHotelFavoritesCache.clear();
      notifyHotelCacheListeners();
    }
  }, [user]);

  useEffect(() => {
    const listener = () => setCacheVersion((prev) => prev + 1);
    globalHotelCacheListeners.add(listener);
    return () => {
      globalHotelCacheListeners.delete(listener);
    };
  }, []);

  const loadHotelFavoritesCache = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('saved_hotel_establishments')
        .select('hotel_establishment_id')
        .eq('user_id', user.id);
      globalHotelFavoritesCache = new Set(
        data?.map((item) => item.hotel_establishment_id) || [],
      );
      notifyHotelCacheListeners();
    } catch (e) {
      console.error('Erreur cache favoris hôtels:', e);
    }
  };

  const toggleFavorite = async (establishmentId: string) => {
    if (!user) {
      throw new Error('Vous devez être connecté pour ajouter des favoris');
    }
    setLoading(true);
    setError(null);
    try {
      const { data: existing } = await supabase
        .from('saved_hotel_establishments')
        .select('id')
        .eq('user_id', user.id)
        .eq('hotel_establishment_id', establishmentId)
        .maybeSingle();

      if (existing) {
        const { error: err } = await supabase
          .from('saved_hotel_establishments')
          .delete()
          .eq('id', existing.id);
        if (err) throw err;
        globalHotelFavoritesCache.delete(establishmentId);
        notifyHotelCacheListeners();
        return false;
      }

      const { error: err } = await supabase.from('saved_hotel_establishments').insert({
        user_id: user.id,
        hotel_establishment_id: establishmentId,
      });
      if (err) throw err;
      globalHotelFavoritesCache.add(establishmentId);
      notifyHotelCacheListeners();
      return true;
    } catch (err: any) {
      console.error('Error toggling hotel favorite:', err);
      setError(err.message || 'Impossible de modifier les favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getFavorites = async (): Promise<HotelEstablishmentPublic[]> => {
    if (!user) {
      setError('Vous devez être connecté pour voir vos favoris');
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('saved_hotel_establishments')
        .select(
          `
          hotel_establishment_id,
          hotel_establishments:hotel_establishment_id (
            id, title, description, address, establishment_type, star_rating,
            rating, review_count, images, amenities, location_id, latitude, longitude,
            status, hide_from_home, created_at, updated_at
          )
        `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;

      return (
        data
          ?.map((item: any) => item.hotel_establishments)
          .filter(Boolean)
          .map((est: any) => ({
            ...est,
            images: Array.isArray(est.images) ? est.images : [],
            amenities: Array.isArray(est.amenities) ? est.amenities : [],
          })) || []
      );
    } catch (err: any) {
      console.error('Error fetching hotel favorites:', err);
      setError(err.message || 'Impossible de charger vos favoris');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (establishmentId: string) => {
    if (!user) throw new Error('Vous devez être connecté pour retirer des favoris');
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('saved_hotel_establishments')
        .delete()
        .eq('user_id', user.id)
        .eq('hotel_establishment_id', establishmentId);
      if (err) throw err;
      globalHotelFavoritesCache.delete(establishmentId);
      notifyHotelCacheListeners();
    } catch (err: any) {
      setError(err.message || 'Impossible de retirer des favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const isFavoriteSync = (establishmentId: string): boolean =>
    globalHotelFavoritesCache.has(establishmentId);

  return {
    loading,
    error,
    toggleFavorite,
    getFavorites,
    isFavoriteSync,
    removeFavorite,
    refreshCache: loadHotelFavoritesCache,
    cacheVersion,
  };
};
