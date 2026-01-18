import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Alert } from 'react-native';

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
