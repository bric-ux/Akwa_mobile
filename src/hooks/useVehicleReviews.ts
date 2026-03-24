import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';
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
  const { sendNewVehicleReview, sendVehicleReviewPublished, sendVehicleRenterReviewPublished } = useEmailService();

  // Get reviews for a vehicle (public : publiés uniquement ; propriétaire : tous pour pouvoir répondre)
  const getVehicleReviews = async (
    vehicleId: string,
    options?: { includeUnpublished?: boolean }
  ): Promise<VehicleReview[]> => {
    try {
      let q = (supabase as any)
        .from('vehicle_reviews')
        .select('*')
        .eq('vehicle_id', vehicleId);
      if (!options?.includeUnpublished) {
        q = q.eq('is_published', true);
      }
      const { data, error } = await q.order('created_at', { ascending: false });

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
          is_published: false, // Sera publié quand le propriétaire aura répondu à l'avis, ou après 48h
        });

      if (error) {
        console.error('Error creating vehicle review:', error);
        Alert.alert('Erreur', error.message || "Impossible de soumettre l'avis");
        return { success: false, error: error.message };
      }

      // Envoyer un email de notification au propriétaire
      try {
        // Récupérer les informations du véhicule et du propriétaire
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('title, owner_id, profiles!vehicles_owner_id_fkey(first_name, last_name, email)')
          .eq('id', reviewData.vehicle_id)
          .single();

        if (vehicleData && vehicleData.profiles) {
          const ownerProfile = vehicleData.profiles;
          const ownerName = `${ownerProfile.first_name} ${ownerProfile.last_name}`;
          const renterName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Locataire';
          
          await sendNewVehicleReview(
            ownerProfile.email,
            ownerName,
            renterName,
            vehicleData.title,
            reviewData.rating,
            reviewData.comment
          );

        }
      } catch (emailError) {
        console.error('❌ [useVehicleReviews] Erreur envoi email notification:', emailError);
      }

      // Si le propriétaire a déjà noté le locataire, les deux avis viennent d'être publiés (trigger) → envoyer les emails "avis publié"
      try {
        const { data: renterReview } = await supabase.from('vehicle_renter_reviews').select('id, rating, comment, renter_id, owner_id').eq('booking_id', reviewData.booking_id).maybeSingle();
        if (renterReview) {
          const { data: renterProfile } = await supabase.from('profiles').select('first_name, last_name, email').eq('user_id', renterReview.renter_id).single();
          const { data: ownerProfile } = await supabase.from('profiles').select('first_name, last_name, email').eq('user_id', renterReview.owner_id).single();
          const { data: vehicle } = await supabase.from('vehicles').select('title').eq('id', reviewData.vehicle_id).single();
          const renterName = renterProfile ? `${renterProfile.first_name || ''} ${renterProfile.last_name || ''}`.trim() || 'Locataire' : 'Locataire';
          const ownerName = ownerProfile ? `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'Propriétaire' : 'Propriétaire';
          const vehicleTitle = vehicle?.title || 'Votre location';
          if (renterProfile?.email) await sendVehicleReviewPublished(renterProfile.email, renterName, ownerName, vehicleTitle, reviewData.rating || 0, reviewData.comment || undefined);
          if (ownerProfile?.email) await sendVehicleRenterReviewPublished(ownerProfile.email, ownerName, renterName, vehicleTitle, renterReview.rating, renterReview.comment || undefined);
        }
      } catch (e) {
        console.error('❌ [useVehicleReviews] Erreur envoi emails avis publiés:', e);
      }

      Alert.alert('Avis envoyé', 'Votre avis sera publié lorsque le propriétaire aura répondu à l\'avis, ou au plus tard sous 48 h');
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
