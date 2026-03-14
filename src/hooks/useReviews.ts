import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';

export interface Review {
  id: string;
  property_id: string;
  reviewer_id: string;
  booking_id: string;
  rating: number;
  location_rating: number | null;
  cleanliness_rating: number | null;
  value_rating: number | null;
  communication_rating: number | null;
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
  const { sendNewPropertyReview, sendPropertyReviewPublished, sendGuestReviewPublished } = useEmailService();

  const getPropertyReviews = async (propertyId: string): Promise<Review[]> => {
    setLoading(true);
    setError(null);

    try {
      // Récupérer les avis (les RLS policies filtrent automatiquement pour ne montrer que les avis approuvés)
      // Comme dans le web, on laisse les RLS policies gérer le filtrage
      console.log('🔍 [useReviews] Chargement des avis pour propertyId:', propertyId);
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
        console.error('❌ [useReviews] Erreur Supabase:', error);
        setError('Erreur lors du chargement des avis');
        return [];
      }

      console.log('📊 [useReviews] Données brutes récupérées:', data?.length || 0, 'avis');
      if (data && data.length > 0) {
        console.log('📊 [useReviews] Premier avis:', {
          id: data[0].id,
          approved: data[0].approved,
          rating: data[0].rating,
          reviewer_id: data[0].reviewer_id
        });
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
    locationRating: number;
    cleanlinessRating: number;
    valueRating: number;
    communicationRating: number;
    comment?: string;
  }) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    if (reviewData.locationRating === 0 || reviewData.cleanlinessRating === 0 || 
        reviewData.valueRating === 0 || reviewData.communicationRating === 0) {
      setError('Veuillez noter tous les critères');
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
          location_rating: reviewData.locationRating,
          cleanliness_rating: reviewData.cleanlinessRating,
          value_rating: reviewData.valueRating,
          communication_rating: reviewData.communicationRating,
          comment: reviewData.comment || null
        } as any);

      if (error) {
        console.error("❌ [useReviews] Erreur lors de la soumission de l'avis:", error);
        
        let errorMessage = "Impossible de soumettre votre avis. Veuillez réessayer.";
        
        if (error.message.includes("violates row-level security policy")) {
          errorMessage = "Vous ne pouvez laisser un avis que pour une réservation confirmée et terminée.";
        } else if (error.message.includes("duplicate key")) {
          errorMessage = "Vous avez déjà laissé un avis pour cette réservation.";
        } else if (error.code === "23503") {
          errorMessage = "Réservation introuvable. Veuillez contacter le support.";
        }
        
        setError(errorMessage);
        return { success: false };
      }

      // Envoyer un email de notification à l'hôte
      try {
        // Récupérer les informations de la propriété et de l'hôte
        const { data: propertyData } = await supabase
          .from('properties')
          .select(`
            title,
            host_id,
            profiles!properties_host_id_fkey(
              first_name,
              last_name,
              email
            )
          `)
          .eq('id', reviewData.propertyId)
          .single();

        const hostProfile = propertyData?.profiles != null
          ? (Array.isArray(propertyData.profiles) ? propertyData.profiles[0] : propertyData.profiles)
          : null;
        if (propertyData && hostProfile && (hostProfile as any).email) {
          const hostName = `${(hostProfile as any).first_name || ''} ${(hostProfile as any).last_name || ''}`.trim() || 'Hôte';
          const guestName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Voyageur';
          const averageRating = (
            reviewData.locationRating +
            reviewData.cleanlinessRating +
            reviewData.valueRating +
            reviewData.communicationRating
          ) / 4;

          await sendNewPropertyReview(
            (hostProfile as any).email,
            hostName,
            guestName,
            propertyData.title,
            averageRating,
            reviewData.comment
          );

          console.log('✅ [useReviews] Email de notification envoyé à l\'hôte');
        } else if (propertyData && !hostProfile) {
          console.warn('⚠️ [useReviews] Profil hôte non trouvé (profiles manquant ou vide)');
        }
      } catch (emailError) {
        console.error('❌ [useReviews] Erreur envoi email notification:', emailError);
      }

      // Si l'hôte a déjà noté le voyageur, les deux avis viennent d'être publiés (trigger) → envoyer les emails "avis publié"
      try {
        const { data: guestReviewRow } = await supabase
          .from('guest_reviews')
          .select('id, rating, comment')
          .eq('booking_id', reviewData.bookingId)
          .maybeSingle();

        if (guestReviewRow) {
          const avgRating = (
            reviewData.locationRating +
            reviewData.cleanlinessRating +
            reviewData.valueRating +
            reviewData.communicationRating
          ) / 4;
          const guestName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Voyageur';
          const { data: userProfile } = await supabase.from('profiles').select('email').eq('user_id', user.id).single();
          const { data: propData } = await supabase.from('properties').select('title, host_id').eq('id', reviewData.propertyId).single();
          const { data: hostProfile } = propData?.host_id ? await supabase.from('profiles').select('first_name, last_name, email').eq('user_id', propData.host_id).single() : { data: null };
          const hostName = hostProfile ? `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim() || 'Hôte' : 'Hôte';
          if (userProfile?.email) await sendPropertyReviewPublished(userProfile.email, guestName, hostName, propData?.title || 'Votre réservation', Math.round(avgRating * 10) / 10, reviewData.comment || undefined);
          if (hostProfile?.email) await sendGuestReviewPublished(hostProfile.email, hostName, guestName, propData?.title || 'Votre propriété', guestReviewRow.rating, guestReviewRow.comment || undefined);
        }
      } catch (e) {
        console.error('❌ [useReviews] Erreur envoi emails avis publiés:', e);
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

