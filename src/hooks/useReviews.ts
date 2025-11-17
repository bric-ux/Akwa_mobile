import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface Review {
  id: string;
  property_id: string;
  reviewer_id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name?: string;
  approved?: boolean;
  admin_notes?: string;
}

export const useReviews = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getPropertyReviews = async (propertyId: string): Promise<Review[]> => {
    setLoading(true);
    setError(null);

    try {
      // Récupérer uniquement les avis approuvés par l'admin
      // Les RLS policies filtrent déjà, mais on ajoute le filtre explicite pour être sûr
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles!reviewer_id(first_name, last_name)
        `)
        .eq('property_id', propertyId)
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Erreur lors du chargement des avis');
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

  const canUserReviewProperty = async (propertyId: string, bookingId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Vérifier si l'utilisateur a une réservation confirmée ou terminée pour cette propriété
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, status, check_out_date')
        .eq('id', bookingId)
        .eq('property_id', propertyId)
        .eq('guest_id', user.id)
        .in('status', ['confirmed', 'completed'])
        .maybeSingle();

      if (!booking) {
        return false;
      }

      // Vérifier que le séjour est terminé (date de checkout passée)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkOutDate = new Date(booking.check_out_date);
      checkOutDate.setHours(0, 0, 0, 0);

      if (checkOutDate >= today) {
        return false; // Le séjour n'est pas encore terminé
      }

      // Vérifier si l'utilisateur a déjà laissé un avis pour cette réservation
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('reviewer_id', user.id)
        .maybeSingle();

      return !existingReview;
    } catch (err) {
      return false;
    }
  };

  const submitReview = async (reviewData: {
    propertyId: string;
    bookingId: string;
    rating: number;
    comment?: string;
  }) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          property_id: reviewData.propertyId,
          reviewer_id: user.id,
          booking_id: reviewData.bookingId,
          rating: reviewData.rating,
          comment: reviewData.comment || null
        });

      if (error) {
        setError('Erreur lors de la soumission de l\'avis');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      setError('Erreur lors de la soumission de l\'avis');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getPropertyReviews,
    canUserReviewProperty,
    submitReview
  };
};

