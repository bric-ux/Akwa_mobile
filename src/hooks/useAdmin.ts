import { useState } from 'react';
import { supabase } from '../services/supabase';
import { bumpPublicPropertyListVersion } from '../utils/publicPropertyListVersion';
import { useAuth } from '../services/AuthContext';
import { HostApplication } from './useHostApplications';
import { Property } from './useProperties';
import type { MonthlyRentalListing, MonthlyRentalListingPayment } from '../types';

export interface MonthlyRentalListingWithOwner extends MonthlyRentalListing {
  owner_profile?: { first_name?: string; last_name?: string; email?: string } | null;
  payment?: MonthlyRentalListingPayment | null;
}

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
    adminNotes?: string,
    photoCategories?: {[key: number]: string},
    fieldsToRevise?: Record<string, boolean>
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
        // Si mise en révision, ajouter aussi dans revision_message
        if (status === 'reviewing') {
          updateData.revision_message = adminNotes;
        }
      }
      
      // Ajouter les champs de révision si fournis
      if (fieldsToRevise && Object.keys(fieldsToRevise).length > 0) {
        updateData.fields_to_revise = fieldsToRevise;
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

      // Si mise en révision, envoyer email de notification
      if (status === 'reviewing' && adminNotes && application?.email) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'application_revision',
              to: application.email,
              data: {
                firstName: application.full_name.split(' ')[0] || application.full_name,
                revisionMessage: adminNotes,
                propertyTitle: application.title,
                siteUrl: 'https://akwahome.com' // URL du site web
              }
            }
          });
          console.log('✅ Email de révision envoyé');
        } catch (emailError) {
          console.error('Erreur envoi email de révision:', emailError);
        }
      }

      // Si approuvé, mettre à jour le profil pour marquer comme hôte
      if (status === 'approved' && application) {
        // Récupérer les données complètes de l'application approuvée
        const { data: fullApplication } = await supabase
          .from('host_applications')
          .select('*')
          .eq('id', applicationId)
          .single();

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_host: true })
          .eq('user_id', application.user_id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
        
        // Si c'est une révision qui a été approuvée ET qu'il y a des champs de révision, mettre à jour la propriété existante
        if (fullApplication?.fields_to_revise && Object.keys(fullApplication.fields_to_revise).length > 0) {
          console.log('🔄 Mise à jour d\'une propriété existante suite à une révision approuvée');
          
          // Trouver la propriété correspondante
          const { data: existingProperty } = await supabase
            .from('properties')
            .select('*')
            .eq('host_id', application.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (existingProperty && fullApplication.fields_to_revise) {
            const fieldsToUpdate = fullApplication.fields_to_revise;
            const updates: any = {};
            
            // Mettre à jour uniquement les champs modifiés
            if (fieldsToUpdate.title === true) updates.title = fullApplication.title;
            if (fieldsToUpdate.description === true) updates.description = fullApplication.description;
            if (fieldsToUpdate.property_type === true) updates.property_type = fullApplication.property_type;
            if (fieldsToUpdate.price_per_night === true) updates.price_per_night = fullApplication.price_per_night;
            if (fieldsToUpdate.max_guests === true) updates.max_guests = fullApplication.max_guests;
            if (fieldsToUpdate.bedrooms === true) updates.bedrooms = fullApplication.bedrooms;
            if (fieldsToUpdate.bathrooms === true) updates.bathrooms = fullApplication.bathrooms;
            if (fieldsToUpdate.images === true) updates.images = fullApplication.images;
            if (fieldsToUpdate.amenities === true) updates.amenities = fullApplication.amenities;
            if (fieldsToUpdate.minimum_nights === true) updates.minimum_nights = fullApplication.minimum_nights;
            if (fieldsToUpdate.cancellation_policy === true) updates.cancellation_policy = fullApplication.cancellation_policy;
            
            if (Object.keys(updates).length > 0) {
              updates.updated_at = new Date().toISOString();
              
              const { error: updateError } = await supabase
                .from('properties')
                .update(updates)
                .eq('id', existingProperty.id);
              
              if (updateError) {
                console.error('❌ Erreur lors de la mise à jour de la propriété:', updateError);
              } else {
                console.log('✅ Propriété mise à jour avec succès:', Object.keys(updates));
              }
            }
          }
        }

                // Traiter les données de classification si fournies
                if (photoCategories && application.images) {
                  // Extraire les données de classification
                  const adminCategory = photoCategories[0] || 'standard'; // Utiliser la première photo pour la catégorie globale
                  const adminRating = parseInt(photoCategories[`rating_0`] || '3'); // Note par défaut 3
                  const isFeatured = photoCategories[`featured_0`] === 'true';

                  // Mettre à jour l'application avec les données de classification
                  await supabase
                    .from('host_applications')
                    .update({ 
                      admin_category: adminCategory,
                      admin_rating: adminRating,
                      is_featured: isFeatured,
                      classification_date: new Date().toISOString(),
                      classified_by: user.id
                    })
                    .eq('id', applicationId);

                  // Si une propriété est créée à partir de cette candidature, appliquer la classification
                  const { data: createdProperty } = await supabase
                    .from('properties')
                    .select('id')
                    .eq('host_id', application.user_id)
                    .eq('title', application.title)
                    .single();

                  if (createdProperty) {
                    await supabase
                      .from('properties')
                      .update({
                        admin_category: adminCategory,
                        admin_rating: adminRating,
                        is_featured: isFeatured,
                        classification_date: new Date().toISOString(),
                        classified_by: user.id
                      })
                      .eq('id', createdProperty.id);
                  }
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
          locations:location_id (
            id,
            name,
            type,
            latitude,
            longitude,
            parent_id
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
        .update(
          isActive
            ? { is_active: true, hidden_by_admin: false }
            : { is_active: false, hidden_by_admin: true }
        )
        .eq('id', propertyId);

      if (error) {
        console.error('Error updating property:', error);
        setError('Erreur lors de la mise à jour de la propriété');
        return { success: false };
      }

      bumpPublicPropertyListVersion();
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

      bumpPublicPropertyListVersion();
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

      // Villes populaires (via locations)
      const { data: popularLocations } = await supabase
        .from('properties')
        .select(`
          location_id,
          locations:location_id!inner(name, type),
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
        popularCities: popularLocations || [],
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

  const getMonthlyRentalListings = async (): Promise<MonthlyRentalListingWithOwner[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data: listings, error: err } = await supabase
        .from('monthly_rental_listings')
        .select('*')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (err) {
        setError(err.message);
        return [];
      }
      const list = (listings || []) as MonthlyRentalListing[];
      if (list.length === 0) return [];

      const ownerIds = [...new Set(list.map((l) => l.owner_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', ownerIds);

      const profileByUserId = new Map((profiles || []).map((p) => [p.user_id, p]));

      const { data: payments } = await supabase
        .from('monthly_rental_listing_payments')
        .select('*')
        .in('listing_id', list.map((l) => l.id));

      const paymentByListingId = new Map((payments || []).map((p) => [p.listing_id, p]));

      return list.map((l) => ({
        ...l,
        owner_profile: profileByUserId.get(l.owner_id) ?? null,
        payment: paymentByListingId.get(l.id) ?? null,
      })) as MonthlyRentalListingWithOwner[];
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateMonthlyRentalListingStatus = async (
    listingId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Non connecté' };
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('monthly_rental_listings')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_notes: adminNotes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId);

      if (err) {
        setError(err.message);
        return { success: false, error: err.message };
      }
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const deleteMonthlyRentalListing = async (listingId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Non connecté' };
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('monthly_rental_listings').delete().eq('id', listingId);
      if (err) {
        setError(err.message);
        return { success: false, error: err.message };
      }
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /** RLS : admin uniquement, statuts pending | reviewing (voir migration admin_delete_host_application). */
  const deleteHostApplication = async (
    applicationId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Non connecté' };
    setError(null);
    try {
      const { error: err } = await supabase.from('host_applications').delete().eq('id', applicationId);
      if (err) {
        setError(err.message);
        return { success: false, error: err.message };
      }
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  return {
    getAllHostApplications,
    updateApplicationStatus,
    deleteHostApplication,
    getAllProperties,
    updatePropertyStatus,
    deleteProperty,
    getAllUsers,
    updateUserRole,
    getIdentityDocument,
    getDashboardStats,
    getMonthlyRentalListings,
    updateMonthlyRentalListingStatus,
    deleteMonthlyRentalListing,
    loading,
    error,
  };
};
