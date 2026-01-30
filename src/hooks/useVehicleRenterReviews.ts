import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';
import { Alert } from 'react-native';

export interface VehicleRenterReview {
  id: string;
  booking_id: string;
  vehicle_id: string;
  renter_id: string;
  owner_id: string;
  rating: number;
  comment: string | null;
  vehicle_care_rating: number | null;
  punctuality_rating: number | null;
  communication_rating: number | null;
  respect_rules_rating: number | null;
  is_published: boolean;
  created_at: string;
  renter?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  renter_name?: string;
  vehicle?: {
    title?: string;
    brand?: string;
    model?: string;
  };
  owner?: {
    first_name: string | null;
    last_name: string | null;
  };
  response?: {
    id: string;
    response: string;
    created_at: string;
  };
}

export const useVehicleRenterReviews = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { sendNewRenterReview, sendNewVehicleRenterReviewResponse, sendVehicleRenterReviewPublished } = useEmailService();

  // Vérifier si le propriétaire peut laisser un avis pour une réservation
  const canReviewBooking = async (bookingId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Vérifier que la réservation est terminée et appartient au propriétaire
      const { data: booking } = await (supabase as any)
        .from('vehicle_bookings')
        .select('status, renter_id, end_date, vehicle:vehicles(owner_id)')
        .eq('id', bookingId)
        .single();

      if (!booking) return false;
      
      const vehicleData = booking.vehicle as any;
      if (vehicleData?.owner_id !== user.id) return false;
      
      if (booking.status !== 'completed') {
        // Aussi autoriser si end_date est passée
        if (new Date(booking.end_date) > new Date()) return false;
      }

      // Vérifier si déjà noté
      const { data: existingReview } = await (supabase as any)
        .from('vehicle_renter_reviews')
        .select('id')
        .eq('booking_id', bookingId)
        .maybeSingle();

      return !existingReview;
    } catch (err) {
      console.error('Error checking if can review booking:', err);
      return false;
    }
  };

  // Créer un avis sur un locataire
  const createReview = async (reviewData: {
    booking_id: string;
    vehicle_id: string;
    renter_id: string;
    rating: number;
    comment?: string;
    vehicle_care_rating?: number;
    punctuality_rating?: number;
    communication_rating?: number;
    respect_rules_rating?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await (supabase as any)
        .from('vehicle_renter_reviews')
        .insert({
          ...reviewData,
          owner_id: user.id,
          is_published: false, // Sera publié quand le locataire répondra
        });

      if (insertError) {
        console.error('Error creating renter review:', insertError);
        setError(insertError.message || "Impossible de soumettre l'avis");
        Alert.alert('Erreur', insertError.message || "Impossible de soumettre l'avis");
        return { success: false, error: insertError.message };
      }

      // Envoyer un email de notification au locataire
      try {
        // Récupérer les informations du locataire et du véhicule
        const { data: renterData } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', reviewData.renter_id)
          .single();

        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('title')
          .eq('id', reviewData.vehicle_id)
          .single();

        if (renterData && vehicleData) {
          const renterName = `${renterData.first_name} ${renterData.last_name}`;
          const ownerName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Propriétaire';
          
          await sendNewRenterReview(
            renterData.email,
            renterName,
            ownerName,
            vehicleData.title,
            reviewData.rating,
            reviewData.comment
          );

          console.log('✅ [useVehicleRenterReviews] Email de notification envoyé au locataire');
        }
      } catch (emailError) {
        console.error('❌ [useVehicleRenterReviews] Erreur envoi email notification:', emailError);
        // Ne pas faire échouer la soumission de l'avis si l'email échoue
      }

      Alert.alert('Avis envoyé', 'Votre avis sera publié lorsque le locataire y aura répondu');
      return { success: true };
    } catch (err: any) {
      console.error('Error creating renter review:', err);
      setError(err.message || "Impossible de soumettre l'avis");
      Alert.alert('Erreur', err.message || "Impossible de soumettre l'avis");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les avis publiés sur un locataire (pour affichage public)
  const getPublishedReviewsForRenter = async (renterId: string): Promise<VehicleRenterReview[]> => {
    setLoading(true);
    setError(null);
    
    try {
      // Charger les avis publiés
      const { data, error: fetchError } = await (supabase as any)
        .from('vehicle_renter_reviews')
        .select('*')
        .eq('renter_id', renterId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching renter reviews:', fetchError);
        setError('Erreur lors du chargement des avis');
        return [];
      }

      if (!data || data.length === 0) return [];

      // Charger les informations du locataire séparément
      const { data: renterData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .eq('user_id', renterId)
        .maybeSingle();

      // Charger les réponses
      const reviewIds = data.map((r: any) => r.id);
      const { data: responses } = await (supabase as any)
        .from('vehicle_renter_review_responses')
        .select('*')
        .in('vehicle_renter_review_id', reviewIds);

      return data.map((review: any) => ({
        ...review,
        renter: renterData 
          ? { first_name: renterData.first_name, last_name: renterData.last_name, avatar_url: renterData.avatar_url }
          : undefined,
        renter_name: renterData 
          ? `${renterData.first_name || ''} ${renterData.last_name || ''}`.trim() || 'Anonyme'
          : 'Anonyme',
        response: (responses || []).find((r: any) => r.vehicle_renter_review_id === review.id)
      }));
    } catch (err) {
      console.error('Error fetching renter reviews:', err);
      setError('Erreur lors du chargement des avis');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les avis sur moi en tant que locataire (tous, pas seulement publiés)
  const getReviewsAboutMe = async (): Promise<VehicleRenterReview[]> => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      // Charger les avis avec les véhicules
      const { data: reviewsData, error: fetchError } = await (supabase as any)
        .from('vehicle_renter_reviews')
        .select(`
          *,
          vehicle:vehicles(title, brand, model)
        `)
        .eq('renter_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching reviews about me:', fetchError);
        setError('Erreur lors du chargement des avis');
        return [];
      }

      if (!reviewsData || reviewsData.length === 0) return [];

      // Charger les informations des propriétaires séparément
      const ownerIds = [...new Set(reviewsData.map((r: any) => r.owner_id))];
      const { data: ownersData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', ownerIds);

      const ownersMap = new Map((ownersData || []).map((o: any) => [o.user_id, o]));

      // Charger les réponses
      const reviewIds = reviewsData.map((r: any) => r.id);
      const { data: responses } = await (supabase as any)
        .from('vehicle_renter_review_responses')
        .select('*')
        .in('vehicle_renter_review_id', reviewIds);

      return reviewsData.map((review: any) => ({
        ...review,
        owner: ownersMap.get(review.owner_id) 
          ? { first_name: ownersMap.get(review.owner_id).first_name, last_name: ownersMap.get(review.owner_id).last_name }
          : undefined,
        response: (responses || []).find((r: any) => r.vehicle_renter_review_id === review.id)
      }));
    } catch (err) {
      console.error('Error fetching reviews about me:', err);
      setError('Erreur lors du chargement des avis');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Répondre à un avis (pour les locataires)
  const createResponse = async (reviewId: string, response: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await (supabase as any)
        .from('vehicle_renter_review_responses')
        .insert({
          vehicle_renter_review_id: reviewId,
          renter_id: user.id,
          response: response.trim()
        });

      if (insertError) {
        console.error('Error creating response:', insertError);
        setError(insertError.message || "Impossible de publier la réponse");
        Alert.alert('Erreur', insertError.message || "Impossible de publier la réponse");
        return { success: false, error: insertError.message };
      }

      // Envoyer un email de notification au propriétaire
      try {
        // Récupérer les informations de l'avis, du propriétaire et du véhicule
        const { data: reviewData } = await (supabase as any)
          .from('vehicle_renter_reviews')
          .select(`
            owner_id,
            vehicle_id,
            rating,
            comment,
            vehicles!vehicle_renter_reviews_vehicle_id_fkey(
              title
            ),
            profiles!vehicle_renter_reviews_owner_id_fkey(first_name, last_name, email)
          `)
          .eq('id', reviewId)
          .single();

        if (reviewData && reviewData.profiles && reviewData.vehicles) {
          const ownerProfile = reviewData.profiles as any;
          const vehicleData = reviewData.vehicles as any;

          const ownerEmail = ownerProfile.email;
          const ownerName = `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'Propriétaire';
          const renterName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Locataire';
          const vehicleTitle = vehicleData.title || 'Votre véhicule';

          await sendNewVehicleRenterReviewResponse(
            ownerEmail,
            ownerName,
            renterName,
            vehicleTitle,
            response.trim()
          );

          // Envoyer aussi l'email de publication (l'avis est automatiquement publié par le trigger SQL)
          await sendVehicleRenterReviewPublished(
            ownerEmail,
            ownerName,
            renterName,
            vehicleTitle,
            reviewData.rating || 0,
            reviewData.comment || undefined
          );

          console.log('✅ [useVehicleRenterReviews] Emails de notification envoyés au propriétaire');
        }
      } catch (emailError) {
        console.error('❌ [useVehicleRenterReviews] Erreur envoi email notification:', emailError);
        // Ne pas faire échouer la soumission de la réponse si l'email échoue
      }

      Alert.alert('Succès', 'Votre réponse a été ajoutée et l\'avis est maintenant publié');
      return { success: true };
    } catch (err: any) {
      console.error('Error creating response:', err);
      setError(err.message || "Impossible de publier la réponse");
      Alert.alert('Erreur', err.message || "Impossible de publier la réponse");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    canReviewBooking,
    createReview,
    getPublishedReviewsForRenter,
    getReviewsAboutMe,
    createResponse,
  };
};

