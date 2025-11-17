import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { Review } from './useReviews';

export const useAdminReviews = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getAllPendingReviews = async (): Promise<Review[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles!reviewer_id(first_name, last_name),
          properties(title, host_id),
          bookings(check_in_date, check_out_date)
        `)
        .eq('approved', false)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Erreur lors du chargement des avis en attente');
        return [];
      }

      return (data || []).map((review: any) => ({
        ...review,
        reviewer_name: review.profiles ? 
          `${review.profiles.first_name || ''} ${review.profiles.last_name || ''}`.trim() || 'Utilisateur' 
          : 'Utilisateur'
      }));
    } catch (err) {
      setError('Erreur lors du chargement des avis');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const approveReview = async (reviewId: string, adminNotes?: string) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          approved: true,
          admin_notes: adminNotes || null
        })
        .eq('id', reviewId);

      if (error) {
        setError('Erreur lors de l\'approbation de l\'avis');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      setError('Erreur lors de l\'approbation de l\'avis');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const rejectReview = async (reviewId: string, adminNotes: string) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        setError('Erreur lors du rejet de l\'avis');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      setError('Erreur lors du rejet de l\'avis');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getAllPendingReviews,
    approveReview,
    rejectReview
  };
};

