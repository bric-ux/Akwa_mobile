import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { HostApplication } from './useHostApplications';
import { Property } from './useProperties';

export interface DashboardStats {
  totalUsers: number;
  totalProperties: number;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  pendingApplications: number;
  recentUsers: any[];
  recentBookings: any[];
  popularCities: any[];
}

export interface AdminProperty extends Property {
  host_info?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export const useAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getAllHostApplications = async (): Promise<HostApplication[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('host_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching applications:', error);
        setError('Erreur lors du chargement des candidatures');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Erreur lors du chargement des candidatures');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (
    applicationId: string,
    status: 'pending' | 'reviewing' | 'approved' | 'rejected',
    adminNotes?: string
  ) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Updating application:', { applicationId, status, adminNotes });
      
      // Récupérer d'abord les infos de l'application
      const { data: application } = await supabase
        .from('host_applications')
        .select('user_id, email, full_name, title, property_type, location')
        .eq('id', applicationId)
        .single();

      const updateData: any = { 
        status,
        reviewed_at: new Date().toISOString()
      };
      
      if (adminNotes) {
        updateData.admin_notes = adminNotes;
      }

      const { data, error } = await supabase
        .from('host_applications')
        .update(updateData)
        .eq('id', applicationId)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        setError('Erreur lors de la mise à jour: ' + error.message);
        return { success: false, error: error.message };
      }

      console.log('Application updated successfully:', data);

      // Si approuvé, mettre à jour le profil pour marquer comme hôte
      if (status === 'approved' && application) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_host: true })
          .eq('user_id', application.user_id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }

        // Envoyer email de confirmation d'approbation
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'host_application_approved',
              to: application.email,
              data: {
                hostName: application.full_name,
                propertyTitle: application.title,
                propertyType: application.property_type,
                location: application.location
              }
            }
          });
        } catch (emailError) {
          console.error('Error sending approval email:', emailError);
        }
      }

      // Si refusé, envoyer email de refus
      if (status === 'rejected' && application) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'host_application_rejected',
              to: application.email,
              data: {
                hostName: application.full_name,
                propertyTitle: application.title,
                adminNotes: adminNotes || 'Aucune raison spécifiée'
              }
            }
          });
        } catch (emailError) {
          console.error('Error sending rejection email:', emailError);
        }
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

  const getAllProperties = async (): Promise<AdminProperty[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          cities (
            id,
            name,
            region,
            country
          ),
          profiles!properties_host_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        setError('Erreur lors du chargement des propriétés');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Erreur lors du chargement des propriétés');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updatePropertyStatus = async (propertyId: string, isActive: boolean) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('properties')
        .update({ is_active: isActive })
        .eq('id', propertyId);

      if (error) {
        console.error('Error updating property:', error);
        setError('Erreur lors de la mise à jour de la propriété');
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

  const deleteProperty = async (propertyId: string) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier s'il y a des réservations en cours
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('property_id', propertyId)
        .in('status', ['pending', 'confirmed']);

      if (bookingsError) {
        console.error('Error checking bookings:', bookingsError);
        setError('Erreur lors de la vérification des réservations');
        return { success: false };
      }

      if (bookings && bookings.length > 0) {
        setError('Impossible de supprimer une propriété avec des réservations en cours');
        return { success: false };
      }

      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      if (error) {
        console.error('Error deleting property:', error);
        setError('Erreur lors de la suppression de la propriété');
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

  const getAllUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        setError('Erreur lors du chargement des utilisateurs');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Erreur lors du chargement des utilisateurs');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: 'user' | 'admin') => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating user role:', error);
        setError('Erreur lors de la mise à jour du rôle');
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

  const getIdentityDocument = async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('identity_documents')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching identity document:', error);
        setError('Erreur lors du chargement du document d\'identité');
        return null;
      }

      return data;
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Erreur lors du chargement du document d\'identité');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getDashboardStats = async (): Promise<DashboardStats> => {
    setLoading(true);
    setError(null);

    try {
      // Statistiques utilisateurs
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Statistiques propriétés
      const { count: totalProperties } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });

      // Statistiques réservations
      const { count: totalBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });

      // Revenus totaux
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('status', 'confirmed');

      const totalRevenue = bookingsData?.reduce((sum, booking) => sum + (booking.total_price || 0), 0) || 0;

      // Note moyenne
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating');

      const averageRating = reviewsData?.length 
        ? reviewsData.reduce((sum, review) => sum + review.rating, 0) / reviewsData.length
        : 0;

      // Candidatures en attente
      const { count: pendingApplications } = await supabase
        .from('host_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Utilisateurs récents
      const { data: recentUsers } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, created_at, role, is_host')
        .order('created_at', { ascending: false })
        .limit(5);

      // Réservations récentes
      const { data: recentBookings } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in_date,
          check_out_date,
          total_price,
          status,
          created_at,
          properties!inner(title),
          profiles!inner(first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Villes populaires
      const { data: popularCities } = await supabase
        .from('properties')
        .select(`
          cities!inner(name, region),
          bookings!inner(id)
        `)
        .eq('is_active', true);

      const stats: DashboardStats = {
        totalUsers: totalUsers || 0,
        totalProperties: totalProperties || 0,
        totalBookings: totalBookings || 0,
        totalRevenue,
        averageRating: Math.round(averageRating * 10) / 10,
        pendingApplications: pendingApplications || 0,
        recentUsers: recentUsers || [],
        recentBookings: recentBookings || [],
        popularCities: popularCities || [],
      };

      return stats;
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Erreur lors du chargement des statistiques');
      return {
        totalUsers: 0,
        totalProperties: 0,
        totalBookings: 0,
        totalRevenue: 0,
        averageRating: 0,
        pendingApplications: 0,
        recentUsers: [],
        recentBookings: [],
        popularCities: [],
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    getAllHostApplications,
    updateApplicationStatus,
    getAllProperties,
    updatePropertyStatus,
    deleteProperty,
    getAllUsers,
    updateUserRole,
    getIdentityDocument,
    getDashboardStats,
    loading,
    error,
  };
};
