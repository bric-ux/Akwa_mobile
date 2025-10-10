import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
}

// Cache global et système de listeners pour la synchronisation
let globalProfileCache: UserProfile | null = null;
let globalProfileListeners: Set<() => void> = new Set();

const notifyProfileListeners = () => {
  globalProfileListeners.forEach(listener => listener());
};

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(globalProfileCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Écouter les changements du cache global
  useEffect(() => {
    const listener = () => {
      setProfile(globalProfileCache);
      setCacheVersion(prev => prev + 1);
    };
    
    globalProfileListeners.add(listener);
    
    return () => {
      globalProfileListeners.delete(listener);
    };
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Erreur d\'authentification dans useUserProfile:', userError);
        setError('Session expirée. Veuillez vous reconnecter.');
        return;
      }
      
      if (!user) {
        console.log('Aucun utilisateur connecté dans useUserProfile');
        setError('Vous devez être connecté pour voir votre profil.');
        return;
      }
      
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        phone: user.user_metadata?.phone || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        bio: user.user_metadata?.bio || '',
      };
      
      // Mettre à jour le cache global et notifier tous les listeners
      globalProfileCache = userProfile;
      notifyProfileListeners();
      
      setProfile(userProfile);
    } catch (err: any) {
      console.error('Erreur lors du chargement du profil:', err);
      setError(err.message || 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  // Fonction pour mettre à jour le profil depuis l'extérieur
  const updateProfileCache = useCallback((newProfile: UserProfile) => {
    globalProfileCache = newProfile;
    notifyProfileListeners();
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile,
    loading,
    error,
    refreshProfile,
    updateProfileCache,
  };
};
