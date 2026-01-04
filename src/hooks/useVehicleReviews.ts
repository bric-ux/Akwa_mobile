import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

export interface VehicleReview {
  id: string;
  vehicle_id: string;
  booking_id: string;
  renter_id: string;
  rating: number;
  comment: string | null;
  condition_rating: number | null;
  cleanliness_rating: number | null;
  value_rating: number | null;
  communication_rating: number | null;
  approved: boolean;
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
}

export const useVehicleReviews = () => {
  const [loading, setLoading] = useState(false);

  const getVehicleReviews = useCallback(async (vehicleId: string): Promise<VehicleReview[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicle_reviews')
        .select(`
          *,
          renter:profiles!vehicle_reviews_renter_id_fkey(
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('vehicle_id', vehicleId)
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((review: any) => ({
        ...review,
        reviewer_name: review.renter
          ? `${review.renter.first_name || ''} ${review.renter.last_name || ''}`.trim() || 'Anonyme'
          : 'Anonyme',
        reviewer_avatar: review.renter?.avatar_url,
      }));
    } catch (error: any) {
      console.error('Erreur lors du chargement des avis:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    getVehicleReviews,
    loading,
  };
};

