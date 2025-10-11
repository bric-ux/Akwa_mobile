import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface HostProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  bio?: string;
  phone?: string;
  email: string;
  created_at: string;
}

export const useHostProfile = () => {
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHostProfile = useCallback(async (hostId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 [useHostProfile] Chargement du profil pour hostId:', hostId);
      console.log('🔄 [useHostProfile] Type de hostId:', typeof hostId);
      console.log('🔄 [useHostProfile] Longueur de hostId:', hostId?.length);
      
      // D'abord, vérifions si des profils existent dans la table profiles
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .limit(5);
      console.log('🔍 [useHostProfile] Tous les profils (échantillon):', allProfiles);
      
      // Vérifions aussi dans host_public_info
      const { data: allHostInfo, error: allHostInfoError } = await supabase
        .from('host_public_info')
        .select('user_id, first_name, last_name')
        .limit(5);
      console.log('🔍 [useHostProfile] Tous les host_public_info (échantillon):', allHostInfo);
      
      // Cherchons d'abord dans host_public_info (table principale pour les hôtes)
      const { data, error } = await supabase
        .from('host_public_info')
        .select('*')
        .eq('user_id', hostId)
        .single();
      
      console.log('🔍 [useHostProfile] Requête profiles - Data:', data, 'Error:', error);

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️ [useHostProfile] Aucun profil trouvé dans host_public_info, essai dans profiles...');
          
          // Essayer dans la table profiles comme fallback
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', hostId)
            .single();
          
          if (profileError) {
            console.log('⚠️ [useHostProfile] Aucun profil trouvé non plus dans profiles pour hostId:', hostId);
            // Créer un profil par défaut si aucun profil n'existe
            const defaultProfile = {
              id: hostId,
              first_name: 'Hôte',
              last_name: 'AkwaHome',
              avatar_url: null,
              bio: null,
              phone: null,
              email: 'hote@akwahome.com',
              created_at: new Date().toISOString(),
            };
            setHostProfile(defaultProfile);
            return defaultProfile;
          } else {
            console.log('✅ [useHostProfile] Profil trouvé dans profiles:', profileData);
            setHostProfile(profileData);
            return profileData;
          }
        }
        throw error;
      }

      console.log('✅ [useHostProfile] Profil chargé:', data);
      setHostProfile(data);
      return data;
    } catch (err) {
      console.error('❌ [useHostProfile] Erreur lors du chargement du profil hôte:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    hostProfile,
    loading,
    error,
    getHostProfile,
  };
};
