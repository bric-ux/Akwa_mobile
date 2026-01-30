import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Alert } from 'react-native';
import { useEmailService } from './useEmailService';

export interface ReviewResponse {
  id: string;
  review_id: string;
  host_id: string;
  response: string;
  created_at: string;
  updated_at: string;
}

export const useReviewResponses = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { sendNewPropertyReviewResponse, sendPropertyReviewPublished } = useEmailService();

  const getReviewResponse = async (reviewId: string): Promise<ReviewResponse | null> => {
    try {
      const { data, error } = await supabase
        .from('review_responses')
        .select('*')
        .eq('review_id', reviewId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching review response:', error);
      return null;
    }
  };

  const submitResponse = async (reviewId: string, response: string) => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('review_responses')
        .insert({
          review_id: reviewId,
          host_id: user.id,
          response
        });

      if (error) throw error;

      // Envoyer un email de notification au voyageur
      try {
        // Récupérer les informations de l'avis, du voyageur et de la propriété
        const { data: reviewData } = await supabase
          .from('reviews')
          .select(`
            reviewer_id,
            property_id,
            location_rating,
            cleanliness_rating,
            value_rating,
            communication_rating,
            comment,
            properties!reviews_property_id_fkey(
              title,
              host_id,
              profiles!properties_host_id_fkey(first_name, last_name)
            ),
            profiles!reviews_reviewer_id_fkey(first_name, last_name, email)
          `)
          .eq('id', reviewId)
          .single();

        if (reviewData && reviewData.profiles && reviewData.properties) {
          const guestProfile = reviewData.profiles as any;
          const propertyData = reviewData.properties as any;
          const hostProfile = propertyData.profiles as any;

          const guestEmail = guestProfile.email;
          const guestName = `${guestProfile.first_name || ''} ${guestProfile.last_name || ''}`.trim() || 'Voyageur';
          const hostName = `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim() || 'Hôte';
          const propertyTitle = propertyData.title || 'Votre réservation';
          
          // Calculer la note moyenne
          const avgRating = reviewData.location_rating && reviewData.cleanliness_rating && reviewData.value_rating && reviewData.communication_rating
            ? Math.round(((reviewData.location_rating + reviewData.cleanliness_rating + reviewData.value_rating + reviewData.communication_rating) / 4) * 10) / 10
            : 0;

          await sendNewPropertyReviewResponse(
            guestEmail,
            guestName,
            hostName,
            propertyTitle,
            response
          );

          // Envoyer aussi l'email de publication (l'avis est automatiquement publié par le trigger SQL)
          await sendPropertyReviewPublished(
            guestEmail,
            guestName,
            hostName,
            propertyTitle,
            avgRating,
            reviewData.comment || undefined
          );

          console.log('✅ [useReviewResponses] Emails de notification envoyés au voyageur');
        }
      } catch (emailError) {
        console.error('❌ [useReviewResponses] Erreur envoi email notification:', emailError);
        // Ne pas faire échouer la soumission de la réponse si l'email échoue
      }

      Alert.alert('Succès', 'Réponse publiée avec succès');
      return { success: true };
    } catch (error: any) {
      console.error('Error submitting response:', error);
      Alert.alert('Erreur', error.message || 'Erreur lors de la publication de la réponse');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const updateResponse = async (reviewId: string, response: string) => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('review_responses')
        .update({ response })
        .eq('review_id', reviewId)
        .eq('host_id', user.id);

      if (error) throw error;
      Alert.alert('Succès', 'Réponse mise à jour avec succès');
      return { success: true };
    } catch (error: any) {
      console.error('Error updating response:', error);
      Alert.alert('Erreur', error.message || 'Erreur lors de la mise à jour de la réponse');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const deleteResponse = async (reviewId: string) => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('review_responses')
        .delete()
        .eq('review_id', reviewId)
        .eq('host_id', user.id);

      if (error) throw error;
      Alert.alert('Succès', 'Réponse supprimée avec succès');
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting response:', error);
      Alert.alert('Erreur', error.message || 'Erreur lors de la suppression de la réponse');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getReviewResponse,
    submitResponse,
    updateResponse,
    deleteResponse
  };
};
