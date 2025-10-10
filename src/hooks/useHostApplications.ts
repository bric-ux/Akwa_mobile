import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface HostApplicationData {
  property_type: 'apartment' | 'house' | 'villa' | 'studio' | 'guesthouse';
  location: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  title: string;
  description: string;
  price_per_night: number;
  full_name: string;
  email: string;
  phone: string;
  experience?: string;
  address_details?: string;
  cleaning_fee?: number;
  taxes?: number;
  amenities?: string[];
  images?: string[];
}

export interface HostApplication {
  id: string;
  user_id: string;
  property_type: string;
  location: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  title: string;
  description: string;
  price_per_night: number;
  full_name: string;
  email: string;
  phone: string;
  experience?: string;
  address_details?: string;
  cleaning_fee?: number;
  taxes?: number;
  amenities?: string[];
  images?: string[];
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
}

export const useHostApplications = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const submitApplication = async (applicationData: HostApplicationData) => {
    if (!user) {
      setError('Vous devez être connecté pour soumettre une candidature');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier si l'utilisateur a déjà une candidature en cours
      const { data: existingApplication, error: checkError } = await supabase
        .from('host_applications')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'reviewing'])
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing applications:', checkError);
        setError('Erreur lors de la vérification des candidatures existantes');
        return { success: false };
      }

      if (existingApplication) {
        setError('Vous avez déjà une candidature en cours de traitement');
        return { success: false };
      }

      // Soumettre la candidature
      const { data, error } = await supabase
        .from('host_applications')
        .insert({
          user_id: user.id,
          ...applicationData,
        })
        .select()
        .single();

      if (error) {
        console.error('Error submitting application:', error);
        setError('Erreur lors de la soumission de la candidature');
        return { success: false };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getUserApplications = async (): Promise<HostApplication[]> => {
    if (!user) {
      setError('Vous devez être connecté');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching applications:', error);
        setError('Erreur lors du chargement des candidatures');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateApplication = async (applicationId: string, updates: Partial<HostApplicationData>) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('host_applications')
        .update(updates)
        .eq('id', applicationId)
        .eq('user_id', user.id)
        .eq('status', 'pending'); // Seulement les candidatures en attente peuvent être modifiées

      if (error) {
        console.error('Error updating application:', error);
        setError('Erreur lors de la mise à jour de la candidature');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getAmenities = async () => {
    try {
      const { data, error } = await supabase
        .from('property_amenities')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching amenities:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error:', err);
      return [];
    }
  };

  return {
    submitApplication,
    getUserApplications,
    updateApplication,
    getAmenities,
    loading,
    error,
  };
};
