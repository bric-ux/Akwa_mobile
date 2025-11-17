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
  revision_message?: string;
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
  fields_to_revise?: Record<string, boolean>;
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
      // Permettre plusieurs candidatures même si une autre est en attente
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
      console.log('🔄 Mise à jour de la candidature:', applicationId);
      
      // Récupérer l'ancienne version pour comparer
      const { data: oldApplication } = await supabase
        .from('host_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      // Détecter les changements
      const changes: string[] = [];
      if (oldApplication) {
        if (oldApplication.title !== applicationData.title) changes.push(`Titre: "${oldApplication.title}" → "${applicationData.title}"`);
        if (oldApplication.property_type !== applicationData.propertyType) changes.push(`Type: "${oldApplication.property_type}" → "${applicationData.propertyType}"`);
        if (oldApplication.location !== applicationData.location) changes.push(`Localisation: "${oldApplication.location}" → "${applicationData.location}"`);
        if (oldApplication.price_per_night !== applicationData.pricePerNight) changes.push(`Prix: ${oldApplication.price_per_night} → ${applicationData.pricePerNight} FCFA`);
        if (oldApplication.max_guests !== applicationData.maxGuests) changes.push(`Capacité: ${oldApplication.max_guests} → ${applicationData.maxGuests}`);
        if (oldApplication.bedrooms !== applicationData.bedrooms) changes.push(`Chambres: ${oldApplication.bedrooms} → ${applicationData.bedrooms}`);
        if (oldApplication.bathrooms !== applicationData.bathrooms) changes.push(`Salles de bain: ${oldApplication.bathrooms} → ${applicationData.bathrooms}`);
      }

      const changesText = changes.length > 0 
        ? `Modifications:\n${changes.join('\n')}` 
        : 'Candidature modifiée';
      
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
          status: 'reviewing',
          revision_message: changesText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erreur Supabase:', error);
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

  const getApplicationById = async (applicationId: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Chargement de la candidature:', applicationId);
      
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (error) {
        console.error('❌ Error fetching application:', error);
        setError('Erreur lors du chargement de la candidature');
        return null;
      }

      console.log('✅ Candidature chargée:', data);
      return data;
    } catch (err: any) {
      console.error('❌ Error in getApplicationById:', err);
      setError('Erreur lors du chargement de la candidature');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteApplication = async (applicationId: string) => {
    if (!user) {
      setError('Vous devez être connecté pour supprimer une candidature');
      return { success: false, error: 'Non connecté' };
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🗑️ Suppression de la candidature:', applicationId);
      
      // Vérifier que la candidature appartient à l'utilisateur
      const { data: application, error: fetchError } = await supabase
        .from('host_applications')
        .select('id, user_id, status')
        .eq('id', applicationId)
        .single();

      if (fetchError) {
        console.error('❌ Erreur lors de la vérification:', fetchError);
        setError('Candidature introuvable');
        return { success: false, error: 'Candidature introuvable' };
      }

      if (application.user_id !== user.id) {
        console.error('❌ Accès non autorisé');
        setError('Vous n\'êtes pas autorisé à supprimer cette candidature');
        return { success: false, error: 'Accès non autorisé' };
      }

      // Vérifier que la candidature peut être supprimée (seulement si pending ou rejected)
      if (application.status === 'approved') {
        setError('Vous ne pouvez pas supprimer une candidature approuvée');
        return { success: false, error: 'Impossible de supprimer une candidature approuvée' };
      }

      // Supprimer la candidature
      const { error: deleteError } = await supabase
        .from('host_applications')
        .delete()
        .eq('id', applicationId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('❌ Erreur lors de la suppression:', deleteError);
        setError('Erreur lors de la suppression de la candidature');
        return { success: false, error: deleteError.message || 'Erreur lors de la suppression' };
      }

      console.log('✅ Candidature supprimée avec succès');
      return { success: true };
    } catch (err: any) {
      console.error('❌ Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression de la candidature');
      return { success: false, error: err.message || 'Erreur lors de la suppression' };
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
    getApplicationById,
    deleteApplication,
    loading,
    error,
  };
};