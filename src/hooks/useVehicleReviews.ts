import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Alert } from 'react-native';

export interface VehicleReview {
  id: string;
  vehicle_id: string;
  booking_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  cleanliness_rating: number | null;
  communication_rating: number | null;
  condition_rating: number | null;
  value_rating: number | null;
  is_published: boolean;
  created_at: string;
}

export const useVehicleReviews = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get reviews for a vehicle
  const getVehicleReviews = async (vehicleId: string): Promise<VehicleReview[]> => {
    try {
      const { data, error } = await (supabase as any)
        .from('vehicle_reviews')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vehicle reviews:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching vehicle reviews:', error);
      return [];
    }
  };

  // Check if user can review a vehicle booking
  const canReviewVehicle = async (bookingId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Check if booking is completed
      const { data: booking } = await supabase
        .from('vehicle_bookings')
        .select('status, renter_id, end_date')
        .eq('id', bookingId)
        .single();

      if (!booking) return false;
      if (booking.renter_id !== user.id) return false;
      
      // Check if booking is completed or end_date has passed
      if (booking.status !== 'completed') {
        const endDate = new Date(booking.end_date);
        const today = new Date();
        if (endDate > today) return false;
      }

      // Check if already reviewed
      const { data: existingReview } = await (supabase as any)
        .from('vehicle_reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();

      return !existingReview;
    } catch (error) {
      console.error('Error checking if can review vehicle:', error);
      return false;
    }
  };

  // Create review
  const createReview = async (reviewData: {
    vehicle_id: string;
    booking_id: string;
    rating: number;
    comment?: string;
    condition_rating?: number;
    cleanliness_rating?: number;
    communication_rating?: number;
    value_rating?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('vehicle_reviews')
        .insert({
          vehicle_id: reviewData.vehicle_id,
          booking_id: reviewData.booking_id,
          reviewer_id: user.id,
          rating: reviewData.rating,
          condition_rating: reviewData.condition_rating || null,
          cleanliness_rating: reviewData.cleanliness_rating || null,
          communication_rating: reviewData.communication_rating || null,
          value_rating: reviewData.value_rating || null,
          comment: reviewData.comment?.trim() || null,
          is_published: false, // Sera publié quand le propriétaire répondra
        });

      if (error) {
        console.error('Error creating vehicle review:', error);
        Alert.alert('Erreur', error.message || "Impossible de soumettre l'avis");
        return { success: false, error: error.message };
      }

      Alert.alert('Avis envoyé', 'Votre avis sera publié lorsque le propriétaire y aura répondu');
      return { success: true };
    } catch (error: any) {
      console.error('Error creating vehicle review:', error);
      Alert.alert('Erreur', error.message || "Impossible de soumettre l'avis");
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getVehicleReviews,
    canReviewVehicle,
    createReview,
  };
};
