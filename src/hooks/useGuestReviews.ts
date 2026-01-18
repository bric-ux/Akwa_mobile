import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface GuestReview {
  id: string;
  booking_id: string;
  guest_id: string;
  host_id: string;
  property_id: string;
  rating: number;
  cleanliness_rating: number | null;
  communication_rating: number | null;
  respect_rules_rating: number | null;
  comment: string | null;
  created_at: string;
  is_published?: boolean;
  guest?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  property?: {
    title: string;
  };
  response?: {
    id: string;
    response: string;
    created_at: string;
  };
}

export const useGuestReviews = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Get reviews written by a host for guests
  const getGuestReviewsByHost = async (hostId: string): Promise<GuestReview[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('guest_reviews')
        .select(`
          *,
          guest:profiles!guest_reviews_guest_id_fkey(first_name, last_name, avatar_url),
          property:properties(title)
        `)
        .eq('host_id', hostId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching guest reviews:', fetchError);
        setError('Erreur lors du chargement des avis');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error fetching guest reviews:', err);
      setError('Erreur lors du chargement des avis');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Get reviews for a specific guest (only published ones for public view)
  const getReviewsForGuest = async (guestId: string, includeUnpublished = false): Promise<GuestReview[]> => {
    setLoading(true);
    setError(null);
    
    try {
      let query = (supabase as any)
        .from('guest_reviews')
        .select(`
          *,
          property:properties(title)
        `)
        .eq('guest_id', guestId);
      
      if (!includeUnpublished) {
        query = query.eq('is_published', true);
      }
      
      const { data: reviews, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching reviews for guest:', fetchError);
        setError('Erreur lors du chargement des avis');
        return [];
      }

      if (!reviews || reviews.length === 0) {
        return [];
      }

      // Récupérer les réponses pour ces avis
      const reviewIds = reviews.map((r: any) => r.id);
      const { data: responses, error: responsesError } = await (supabase as any)
        .from('guest_review_responses')
        .select('*')
        .in('guest_review_id', reviewIds);

      if (responsesError) {
        console.error('Error fetching responses:', responsesError);
        // Continuer même si les réponses ne peuvent pas être chargées
      }

      // Créer un map des réponses par review_id
      const responsesMap = new Map();
      (responses || []).forEach((resp: any) => {
        responsesMap.set(resp.guest_review_id, {
          id: resp.id,
          response: resp.response,
          created_at: resp.created_at,
        });
      });

      // Ajouter les réponses aux avis
      const reviewsWithResponses = reviews.map((review: any) => ({
        ...review,
        response: responsesMap.get(review.id),
      }));

      return reviewsWithResponses;
    } catch (err) {
      console.error('Error fetching reviews for guest:', err);
      setError('Erreur lors du chargement des avis');
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  // Get published reviews for a specific guest (for GuestProfileDialog - visible by others)
  const getPublishedReviewsForGuest = async (guestId: string): Promise<GuestReview[]> => {
    return getReviewsForGuest(guestId, false);
  };

  // Check if host can review a guest for a specific booking
  const canReviewGuest = async (bookingId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Check if booking is completed
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, status, check_out_date, property_id, guest_id, properties!inner(host_id)')
        .eq('id', bookingId)
        .single();

      if (!booking) return false;
      
      const property = booking.properties as any;
      if (property?.host_id !== user.id) return false;
      
      // Check if stay is completed
      const checkOutDate = new Date(booking.check_out_date);
      checkOutDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (checkOutDate > today) return false;

      // Check if already reviewed
      const { data: existingReview } = await (supabase as any)
        .from('guest_reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('host_id', user.id)
        .maybeSingle();

      return !existingReview;
    } catch (err) {
      console.error('Error checking if can review guest:', err);
      return false;
    }
  };

  // Submit a review for a guest
  const submitGuestReview = async (reviewData: {
    bookingId: string;
    guestId: string;
    propertyId: string;
    rating: number;
    cleanlinessRating?: number;
    communicationRating?: number;
    respectRulesRating?: number;
    comment?: string;
  }) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await (supabase as any)
        .from('guest_reviews')
        .insert({
          booking_id: reviewData.bookingId,
          guest_id: reviewData.guestId,
          host_id: user.id,
          property_id: reviewData.propertyId,
          rating: reviewData.rating,
          cleanliness_rating: reviewData.cleanlinessRating || null,
          communication_rating: reviewData.communicationRating || null,
          respect_rules_rating: reviewData.respectRulesRating || null,
          comment: reviewData.comment || null
        });

      if (insertError) {
        console.error('Error submitting guest review:', insertError);
        setError(insertError.message || "Impossible de publier l'avis");
        return { success: false };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error submitting guest review:', err);
      setError(err.message || "Impossible de publier l'avis");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getGuestReviewsByHost,
    getReviewsForGuest,
    getPublishedReviewsForGuest,
    canReviewGuest,
    submitGuestReview
  };
};

