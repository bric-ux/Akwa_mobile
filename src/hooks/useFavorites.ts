import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Property } from '../types';

export interface SavedProperty {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
  properties?: Property;
}

// Cache global partagé entre toutes les instances du hook
let globalFavoritesCache: Set<string> = new Set();
let globalCacheListeners: Set<() => void> = new Set();

const notifyCacheListeners = () => {
  globalCacheListeners.forEach(listener => listener());
};

export const useFavorites = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);
  const { user } = useAuth();

  // Charger le cache des favoris au démarrage
  useEffect(() => {
    if (user) {
      loadFavoritesCache();
    } else {
      globalFavoritesCache.clear();
      notifyCacheListeners();
    }
  }, [user]);

  // Écouter les changements du cache global
  useEffect(() => {
    const listener = () => {
      setCacheVersion(prev => prev + 1);
    };
    
    globalCacheListeners.add(listener);
    
    return () => {
      globalCacheListeners.delete(listener);
    };
  }, []);

  const loadFavoritesCache = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('saved_properties')
        .select('property_id')
        .eq('user_id', user.id);

      globalFavoritesCache = new Set(data?.map(item => item.property_id) || []);
      notifyCacheListeners();
    } catch (error) {
      console.error('Erreur lors du chargement du cache des favoris:', error);
    }
  };

  const toggleFavorite = async (propertyId: string) => {
    if (!user) {
      throw new Error('Vous devez être connecté pour ajouter des favoris');
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier si déjà en favoris
      const { data: existing } = await supabase
        .from('saved_properties')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existing) {
        // Retirer des favoris
        const { error } = await supabase
          .from('saved_properties')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        
        // Mettre à jour le cache global
        globalFavoritesCache.delete(propertyId);
        notifyCacheListeners();
        
        return false; // Retiré des favoris
      } else {
        // Ajouter aux favoris
        const { error } = await supabase
          .from('saved_properties')
          .insert({ user_id: user.id, property_id: propertyId });

        if (error) throw error;
        
        // Mettre à jour le cache global
        globalFavoritesCache.add(propertyId);
        notifyCacheListeners();
        
        return true; // Ajouté aux favoris
      }
    } catch (err: any) {
      console.error('Error toggling favorite:', err);
      setError(err.message || 'Impossible de modifier les favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getFavorites = async (): Promise<Property[]> => {
    if (!user) {
      setError('Vous devez être connecté pour voir vos favoris');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('saved_properties')
        .select(`
          *,
          properties:property_id (
            *,
            cities:city_id (
              id,
              name,
              region
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transformer les données pour correspondre à l'interface Property
      const favorites = data?.map((item: any) => ({
        ...item.properties,
        cities: item.properties.cities
      })) || [];

      return favorites;
    } catch (err: any) {
      console.error('Error fetching favorites:', err);
      setError(err.message || 'Impossible de charger vos favoris');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const isFavorite = async (propertyId: string): Promise<boolean> => {
    if (!user) return false;

    // Utiliser le cache d'abord pour une réponse rapide
    if (favoritesCache.has(propertyId)) {
      return true;
    }

    try {
      const { data } = await supabase
        .from('saved_properties')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      const isFav = !!data;
      
      // Mettre à jour le cache si nécessaire
      if (isFav) {
        setFavoritesCache(prev => {
          const newCache = new Set(prev);
          newCache.add(propertyId);
          return newCache;
        });
      }
      
      return isFav;
    } catch (error) {
      console.error('Error checking if property is favorite:', error);
      return false;
    }
  };

  const removeFavorite = async (propertyId: string) => {
    if (!user) {
      throw new Error('Vous devez être connecté pour retirer des favoris');
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('saved_properties')
        .delete()
        .eq('user_id', user.id)
        .eq('property_id', propertyId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error removing favorite:', err);
      setError(err.message || 'Impossible de retirer des favoris');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fonction synchrone pour vérifier les favoris (utilise le cache global)
  const isFavoriteSync = (propertyId: string): boolean => {
    return globalFavoritesCache.has(propertyId);
  };

  return {
    loading,
    error,
    toggleFavorite,
    getFavorites,
    isFavorite,
    isFavoriteSync,
    removeFavorite,
    refreshCache: loadFavoritesCache
  };
};
