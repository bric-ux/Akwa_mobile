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
  images: string[];
  amenities: string[];
  minimumNights?: number;
  autoBooking?: boolean;
  cancellationPolicy?: string;
  hostGuide?: string;
  cleaningFee?: number;
  taxes?: number;
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
  images: string[];
  amenities: string[];
  minimum_nights: number;
  auto_booking: boolean;
  cancellation_policy: string;
  host_guide?: string;
  cleaning_fee?: number;
  taxes?: number;
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
      return { success: false, error: 'Non authentifié' };
    }

    setLoading(true);
    setError(null);

    try {

      // Validation des données
      if (!applicationData.propertyType || !applicationData.location || 
          !applicationData.title || !applicationData.description || 
          !applicationData.pricePerNight || !applicationData.fullName || 
          !applicationData.email || !applicationData.phone) {
        throw new Error('Tous les champs obligatoires doivent être remplis');
      }

      if (applicationData.images.length === 0) {
        throw new Error('Au moins une photo est requise');
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
          experience: applicationData.experience || null,
          images: applicationData.images || [],
          amenities: applicationData.amenities || [],
          minimum_nights: applicationData.minimumNights || 1,
          auto_booking: applicationData.autoBooking || false,
          cancellation_policy: applicationData.cancellationPolicy || 'flexible',
          host_guide: applicationData.hostGuide || null,
          cleaning_fee: applicationData.cleaningFee || 0,
          taxes: applicationData.taxes || 0,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erreur lors de la soumission: ${error.message}`);
      }

      // Envoyer emails asynchrones
      try {
        await sendApplicationEmails(data);
      } catch (emailError) {
        console.warn('⚠️ Erreur lors de l\'envoi des emails:', emailError);
        // Ne pas faire échouer la soumission pour une erreur d'email
      }

      return { success: true, data };

    } catch (err: any) {
      console.error('❌ Erreur lors de la soumission de la candidature:', err);
      setError(err.message || 'Une erreur est survenue lors de la soumission');
      return { success: false, error: err.message || 'Erreur inconnue' };
    } finally {
      setLoading(false);
    }
  };

  const sendApplicationEmails = async (application: HostApplication) => {
    try {
      // Email de confirmation à l'hôte
      const { error: hostEmailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: application.email,
          subject: 'Confirmation de candidature hôte - AkwaHome',
          template: 'host_application_confirmation',
          data: {
            hostName: application.full_name,
            propertyTitle: application.title,
            applicationId: application.id,
            status: application.status,
          },
        },
      });

      if (hostEmailError) {
        console.error('Erreur email hôte:', hostEmailError);
      }

      // Email de notification à l'admin
      const { error: adminEmailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'admin@akwahome.com', // Remplacer par l'email admin réel
          subject: 'Nouvelle candidature hôte - AkwaHome',
          template: 'admin_new_application',
          data: {
            hostName: application.full_name,
            hostEmail: application.email,
            propertyTitle: application.title,
            propertyType: application.property_type,
            location: application.location,
            pricePerNight: application.price_per_night,
            applicationId: application.id,
            applicationUrl: `https://akwahome.com/admin/applications/${application.id}`,
          },
        },
      });

      if (adminEmailError) {
        console.error('Erreur email admin:', adminEmailError);
      }

    } catch (error) {
      console.error('Erreur lors de l\'envoi des emails:', error);
      throw error;
    }
  };

  const getApplications = async (): Promise<HostApplication[]> => {
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
        throw new Error(`Erreur lors du chargement: ${error.message}`);
      }

      return data || [];

    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des candidatures:', err);
      setError(err.message || 'Erreur lors du chargement');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getApplicationById = async (id: string): Promise<HostApplication | null> => {
    if (!user) {
      setError('Vous devez être connecté');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Candidature non trouvée
        }
        throw new Error(`Erreur lors du chargement: ${error.message}`);
      }

      return data;

    } catch (err: any) {
      console.error('❌ Erreur lors du chargement de la candidature:', err);
      setError(err.message || 'Erreur lors du chargement');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateApplication = async (id: string, updates: Partial<HostApplicationData>) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false, error: 'Non authentifié' };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier que la candidature appartient à l'utilisateur et est en statut pending
      const { data: existingApp, error: fetchError } = await supabase
        .from('host_applications')
        .select('status')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error('Candidature non trouvée');
      }

      if (existingApp.status !== 'pending') {
        throw new Error('Seules les candidatures en attente peuvent être modifiées');
      }

      const { data, error } = await supabase
        .from('host_applications')
        .update({
          property_type: updates.propertyType,
          location: updates.location,
          max_guests: updates.maxGuests,
          bedrooms: updates.bedrooms,
          bathrooms: updates.bathrooms,
          title: updates.title,
          description: updates.description,
          price_per_night: updates.pricePerNight,
          full_name: updates.fullName,
          email: updates.email,
          phone: updates.phone,
          experience: updates.experience,
          images: updates.images,
          amenities: updates.amenities,
          minimum_nights: updates.minimumNights,
          auto_booking: updates.autoBooking,
          cancellation_policy: updates.cancellationPolicy,
          host_guide: updates.hostGuide,
          cleaning_fee: updates.cleaningFee,
          taxes: updates.taxes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
      }

      return { success: true, data };

    } catch (err: any) {
      console.error('❌ Erreur lors de la mise à jour:', err);
      setError(err.message || 'Erreur lors de la mise à jour');
      return { success: false, error: err.message || 'Erreur inconnue' };
    } finally {
      setLoading(false);
    }
  };

  const deleteApplication = async (id: string) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false, error: 'Non authentifié' };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier que la candidature appartient à l'utilisateur et est en statut pending
      const { data: existingApp, error: fetchError } = await supabase
        .from('host_applications')
        .select('status')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error('Candidature non trouvée');
      }

      if (existingApp.status !== 'pending') {
        throw new Error('Seules les candidatures en attente peuvent être supprimées');
      }

      const { error } = await supabase
        .from('host_applications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Erreur lors de la suppression: ${error.message}`);
      }

      return { success: true };

    } catch (err: any) {
      console.error('❌ Erreur lors de la suppression:', err);
      setError(err.message || 'Erreur lors de la suppression');
      return { success: false, error: err.message || 'Erreur inconnue' };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    submitApplication,
    getApplications,
    getApplicationById,
    updateApplication,
    deleteApplication,
  };
};