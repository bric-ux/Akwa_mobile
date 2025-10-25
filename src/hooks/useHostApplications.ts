import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

export interface HostApplicationData {
  propertyType: string;
  location: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  title: string;
  description: string;
  pricePerNight: number;
  fullName: string;
  email: string;
  phone: string;
  experience?: string;
  images?: string[];
  categorizedPhotos?: Array<{url: string, category: string, displayOrder: number}>;
  amenities?: string[];
  cleaningFee?: number;
  taxes?: number;
  minimumNights?: number;
  autoBooking?: boolean;
  cancellationPolicy?: string;
  hostGuide?: string;
  discountEnabled?: boolean;
  discountMinNights?: number;
  discountPercentage?: number;
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
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  admin_notes?: string;
  images?: string[];
  categorized_photos?: any;
  amenities?: string[];
  minimum_nights?: number;
  auto_booking?: boolean;
  cancellation_policy?: string;
  host_guide?: string;
  discount_enabled?: boolean;
  discount_min_nights?: number;
  discount_percentage?: number;
  cleaning_fee?: number;
  taxes?: number;
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
        setError('Erreur lors de la vérification des candidatures existantes');
        return { success: false };
      }

      if (existingApplication) {
        setError('Vous avez déjà une candidature en cours de traitement');
        return { success: false };
      }

      const { data, error } = await supabase
        .from('host_applications')
        .insert({
          user_id: user.id,
          property_type: applicationData.propertyType,
          location: applicationData.location,
          max_guests: applicationData.maxGuests,
          bedrooms: applicationData.bedrooms,
          bathrooms: applicationData.bathrooms,
          title: applicationData.title,
          description: applicationData.description,
          price_per_night: applicationData.pricePerNight,
          full_name: applicationData.fullName,
          email: applicationData.email,
          phone: applicationData.phone,
          experience: applicationData.experience,
          images: applicationData.images || [],
          categorized_photos: applicationData.categorizedPhotos || null,
          amenities: applicationData.amenities || [],
          minimum_nights: applicationData.minimumNights || 1,
          auto_booking: applicationData.autoBooking || false,
          cancellation_policy: applicationData.cancellationPolicy || 'flexible',
          host_guide: applicationData.hostGuide || null,
          discount_enabled: applicationData.discountEnabled || false,
          discount_min_nights: applicationData.discountMinNights || null,
          discount_percentage: applicationData.discountPercentage || null,
          cleaning_fee: applicationData.cleaningFee || 0,
          taxes: applicationData.taxes || 0,
        })
        .select()
        .single();

      if (error) {
        console.error('Erreur Supabase:', error);
        setError('Erreur lors de la soumission de la candidature');
        return { success: false };
      }

      console.log('✅ Candidature soumise avec succès:', data);
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Erreur lors de la soumission:', err);
      setError('Erreur lors de la soumission de la candidature');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getMyApplications = async () => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Erreur lors du chargement des candidatures');
        return [];
      }

      return data || [];
    } catch (err: any) {
      setError('Erreur lors du chargement des candidatures');
      return [];
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
        console.error('Erreur lors du chargement des équipements:', error);
        return [];
      }

      return data || [];
    } catch (err: any) {
      console.error('Erreur lors du chargement des équipements:', err);
      return [];
    }
  };

  const updateApplication = async (applicationId: string, applicationData: Partial<HostApplicationData>) => {
    if (!user) {
      setError('Vous devez être connecté pour modifier une candidature');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .update({
          property_type: applicationData.propertyType,
          location: applicationData.location,
          max_guests: applicationData.maxGuests,
          bedrooms: applicationData.bedrooms,
          bathrooms: applicationData.bathrooms,
          title: applicationData.title,
          description: applicationData.description,
          price_per_night: applicationData.pricePerNight,
          full_name: applicationData.fullName,
          email: applicationData.email,
          phone: applicationData.phone,
          experience: applicationData.experience,
          images: applicationData.images || [],
          categorized_photos: applicationData.categorizedPhotos || null,
          amenities: applicationData.amenities || [],
          minimum_nights: applicationData.minimumNights || 1,
          auto_booking: applicationData.autoBooking || false,
          cancellation_policy: applicationData.cancellationPolicy || 'flexible',
          host_guide: applicationData.hostGuide || null,
          discount_enabled: applicationData.discountEnabled || false,
          discount_min_nights: applicationData.discountMinNights || null,
          discount_percentage: applicationData.discountPercentage || null,
          cleaning_fee: applicationData.cleaningFee || 0,
          taxes: applicationData.taxes || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Erreur Supabase:', error);
        setError('Erreur lors de la mise à jour de la candidature');
        return { success: false };
      }

      console.log('✅ Candidature mise à jour avec succès:', data);
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Erreur lors de la mise à jour:', err);
      setError('Erreur lors de la mise à jour de la candidature');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getApplications = async () => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Erreur lors du chargement des candidatures');
        return [];
      }

      return data || [];
    } catch (err: any) {
      setError('Erreur lors du chargement des candidatures');
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    submitApplication,
    getMyApplications,
    getApplications,
    getAmenities,
    updateApplication,
    loading,
    error,
  };
};