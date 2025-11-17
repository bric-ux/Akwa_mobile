// Hook pour récupérer les avis des propriétés d'un hôte
import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface Review {
  id: string;
  property_id: string;
  reviewer_id: string;
  booking_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  reviewer_name?: string;
  property_title?: string;
}

export const useHostReviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHostReviews = useCallback(async (hostId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 [useHostReviews] Récupération des avis pour hostId:', hostId);
      
      // Récupérer les avis approuvés des propriétés de l'hôte
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          properties!inner(
            id,
            title,
            host_id
          ),
          profiles!reviewer_id(
            first_name,
            last_name
          )
        `)
        .eq('properties.host_id', hostId)
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [useHostReviews] Erreur lors du chargement des avis:', error);
        throw error;
      }

      const enrichedReviews = (data || []).map(review => ({
        ...review,
        reviewer_name: review.profiles ? 
          `${review.profiles.first_name || ''} ${review.profiles.last_name || ''}`.trim() || 'Utilisateur' 
          : 'Utilisateur',
        property_title: review.properties?.title || 'Propriété'
      }));

      console.log('✅ [useHostReviews] Avis chargés:', enrichedReviews.length);
      setReviews(enrichedReviews);
      return enrichedReviews;
    } catch (err) {
      console.error('❌ [useHostReviews] Erreur lors du chargement des avis:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reviews,
    loading,
    error,
    getHostReviews,
  };
};

