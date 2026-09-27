import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { MonthlyRentalListing } from '../types';

let globalMonthlyFavoritesCache: Set<string> = new Set();
let globalMonthlyCacheListeners: Set<() => void> = new Set();

const notifyMonthlyCacheListeners = () => {
  globalMonthlyCacheListeners.forEach((listener) => listener());
};

/** Favoris locations longue durée (`monthly_rental_listing_favorites`). */
export const useMonthlyFavorites = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      void loadMonthlyFavoritesCache();
    } else {
      globalMonthlyFavoritesCache.clear();
      notifyMonthlyCacheListeners();
    }
  }, [user]);

  useEffect(() => {
    const listener = () => setCacheVersion((prev) => prev + 1);
    globalMonthlyCacheListeners.add(listener);
    return () => {
      globalMonthlyCacheListeners.delete(listener);
    };
  }, []);

  const loadMonthlyFavoritesCache = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('monthly_rental_listing_favorites')
        .select('listing_id')
        .eq('user_id', user.id);
      globalMonthlyFavoritesCache = new Set(data?.map((item) => item.listing_id) || []);
      notifyMonthlyCacheListeners();
    } catch (e) {
      console.error('Erreur cache favoris longue durée:', e);
    }
  };

  const toggleFavorite = async (listingId: string) => {
    if (!user) {
      throw new Error('Vous devez être connecté pour ajouter des favoris');
    }
    setLoading(true);
    setError(null);
    try {
      const { data: existing } = await supabase
        .from('monthly_rental_listing_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .maybeSingle();

      if (existing) {
        const { error: err } = await supabase
          .from('monthly_rental_listing_favorites')
          .delete()
          .eq('id', existing.id);
        if (err) throw err;
        globalMonthlyFavoritesCache.delete(listingId);
        notifyMonthlyCacheListeners();
        return false;
      }

      const { error: err } = await supabase.from('monthly_rental_listing_favorites').insert({
        user_id: user.id,
        listing_id: listingId,
      });
      if (err) throw err;
      globalMonthlyFavoritesCache.add(listingId);
      notifyMonthlyCacheListeners();
      return true;
    } catch (err: any) {
      console.error('Error toggling monthly favorite:', err);
      setError(err.message || 'Impossible de modifier les favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getFavorites = async (): Promise<MonthlyRentalListing[]> => {
    if (!user) {
      setError('Vous devez être connecté pour voir vos favoris');
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('monthly_rental_listing_favorites')
        .select(
          `
          listing_id,
          monthly_rental_listings:listing_id (*)
        `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;

      return (
        data
          ?.map((item: any) => item.monthly_rental_listings)
          .filter(Boolean)
          .map((listing: any) => ({
            ...listing,
            images: Array.isArray(listing.images) ? listing.images : [],
            amenities: Array.isArray(listing.amenities) ? listing.amenities : [],
          })) || []
      );
    } catch (err: any) {
      console.error('Error fetching monthly favorites:', err);
      setError(err.message || 'Impossible de charger vos favoris');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (listingId: string) => {
    if (!user) throw new Error('Vous devez être connecté pour retirer des favoris');
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('monthly_rental_listing_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);
      if (err) throw err;
      globalMonthlyFavoritesCache.delete(listingId);
      notifyMonthlyCacheListeners();
    } catch (err: any) {
      setError(err.message || 'Impossible de retirer des favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const isFavoriteSync = (listingId: string): boolean =>
    globalMonthlyFavoritesCache.has(listingId);

  return {
    loading,
    error,
    toggleFavorite,
    getFavorites,
    isFavoriteSync,
    removeFavorite,
    refreshCache: loadMonthlyFavoritesCache,
    cacheVersion,
  };
};
