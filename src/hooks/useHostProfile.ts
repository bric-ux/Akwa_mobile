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
  properties?: {
    id: string;
    title: string;
    rating?: number;
    review_count?: number;
  }[];
  total_reviews?: number;
  average_rating?: number;
  total_properties?: number;
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
      
      // Récupérer les propriétés de l'hôte séparément
      console.log('🔍 [useHostProfile] Récupération des propriétés pour hostId:', hostId);
      
      // D'abord, vérifier la structure de la table properties
      const { data: propertiesStructure, error: structureError } = await supabase
        .from('properties')
        .select('*')
        .limit(1);
      
      if (structureError) {
        console.error('❌ [useHostProfile] Erreur structure properties:', structureError);
      } else {
        console.log('🔍 [useHostProfile] Colonnes properties disponibles:', Object.keys(propertiesStructure[0] || {}));
      }
      
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, title, rating, review_count, host_id')
        .eq('host_id', hostId)
        .eq('is_active', true);
      
      if (propertiesError) {
        console.error('❌ [useHostProfile] Erreur lors du chargement des propriétés:', propertiesError);
        console.log('🔍 [useHostProfile] Détails de l\'erreur:', propertiesError);
      } else {
        console.log('✅ [useHostProfile] Propriétés chargées:', properties?.length || 0);
        console.log('🔍 [useHostProfile] Détails des propriétés:', properties);
      }
      
      // Récupérer tous les avis approuvés pour toutes les propriétés de l'hôte
      const propertiesList = properties || [];
      const propertyIds = propertiesList.map(p => p.id);
      
      let totalReviews = 0;
      let averageRating = 0;
      
      if (propertyIds.length > 0) {
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('rating, approved')
          .in('property_id', propertyIds)
          .eq('approved', true);
        
        if (reviewsError) {
          console.error('❌ [useHostProfile] Erreur lors du chargement des avis:', reviewsError);
          // Fallback sur les données des propriétés si les avis ne peuvent pas être chargés
          totalReviews = propertiesList.reduce((sum, prop) => sum + (prop.review_count || 0), 0);
          const propertiesWithRating = propertiesList.filter(prop => prop.rating && prop.rating > 0);
          averageRating = propertiesWithRating.length > 0
            ? propertiesWithRating.reduce((sum, prop) => sum + (prop.rating || 0), 0) / propertiesWithRating.length
            : 0;
        } else {
          // Calculer à partir des avis réels
          const approvedReviews = reviews || [];
          totalReviews = approvedReviews.length;
          averageRating = totalReviews > 0
            ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
            : 0;
        }
      }
      
      const totalProperties = propertiesList.length;

      const enrichedProfile = {
        ...data,
        properties: propertiesList,
        total_reviews: totalReviews,
        average_rating: Math.round(averageRating * 10) / 10, // Arrondir à 1 décimale
        total_properties: totalProperties
      };

      console.log('📊 [useHostProfile] Statistiques calculées:', {
        totalProperties,
        totalReviews,
        averageRating: enrichedProfile.average_rating
      });

      setHostProfile(enrichedProfile);
      return enrichedProfile;
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
