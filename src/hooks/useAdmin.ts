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

export interface HotelEstablishmentWithOwner {
  id: string;
  host_id: string;
  title: string;
  establishment_type: string | null;
  address: string | null;
  city: string | null;
  status: string;
  hidden_by_admin?: boolean;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  admin_notes?: string | null;
  created_at: string;
  images?: string[] | null;
  owner_profile?: { first_name?: string; last_name?: string; email?: string } | null;
}

export interface AdminRecentBookingItem {
  kind: 'property' | 'vehicle';
  created_at: string;
  booking: any;
}

export interface DashboardStats {
  totalUsers: number;
  totalProperties: number;
  totalVehicles: number;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  pendingApplications: number;
  zipUniquePlayers: number;
  monthlyListingsTotal: number;
  monthlyListingsApproved: number;
  monthlyListingsPending: number;
  monthlyVisitRequestsTotal: number;
  monthlyVisitRequestsAccepted: number;
  monthlyVisitRequestsRejected: number;
  monthlyVisitRequestsPending: number;
  hotelEstablishmentsTotal: number;
  hotelEstablishmentsActive: number;
  hotelEstablishmentsPending: number;
  hotelBookingsTotal: number;
  /** File d’attente actuelle (non filtrée par période) */
  queueHotelPending: number;
  queueMonthlyPending: number;
  queueMonthlyVisitPending: number;
  period?: AdminStatsPeriod;
  periodLabel?: string;
  periodStart?: string | null;
  recentUsers: any[];
  recentBookings: AdminRecentBookingItem[];
  popularCities: any[];
}

export type AdminStatsPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export const ADMIN_STATS_PERIODS: { value: AdminStatsPeriod; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' },
];

function periodStartIso(period: AdminStatsPeriod): string | null {
  if (period === 'all') return null;
  const now = new Date();
  const start = new Date(now);
  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    const day = (start.getDay() + 6) % 7; // lundi = 0
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }
  return start.toISOString();
}

function periodLabelFr(period: AdminStatsPeriod): string {
  switch (period) {
    case 'day':
      return "Aujourd'hui";
    case 'week':
      return 'Cette semaine';
    case 'month':
      return 'Ce mois';
    case 'year':
      return 'Cette année';
    default:
      return 'Tout';
  }
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

  /** Masquer/afficher uniquement sur l'accueil (Home/Explorer), sans impacter la recherche. */
  const updatePropertyHomeVisibility = async (propertyId: string, showOnHome: boolean) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('properties')
        .update({ hide_from_home: !showOnHome })
        .eq('id', propertyId);

      if (error) {
        console.error('Error updating property home visibility:', error);
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

  /** Mettre en avant sur l’accueil (première carte de la ville sur Explorer). */
  const updatePropertyHomeFeatured = async (propertyId: string) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          home_featured_at: new Date().toISOString(),
          hide_from_home: false,
        })
        .eq('id', propertyId);

      if (error) {
        console.error('Error updating property home featured:', error);
        setError('Erreur lors de la mise en avant');
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

  const getDashboardStats = async (
    period: AdminStatsPeriod = 'all',
  ): Promise<DashboardStats> => {
    setLoading(true);
    setError(null);

    const empty: DashboardStats = {
      totalUsers: 0,
      totalProperties: 0,
      totalVehicles: 0,
      totalBookings: 0,
      totalRevenue: 0,
      averageRating: 0,
      pendingApplications: 0,
      zipUniquePlayers: 0,
      monthlyListingsTotal: 0,
      monthlyListingsApproved: 0,
      monthlyListingsPending: 0,
      monthlyVisitRequestsTotal: 0,
      monthlyVisitRequestsAccepted: 0,
      monthlyVisitRequestsRejected: 0,
      monthlyVisitRequestsPending: 0,
      hotelEstablishmentsTotal: 0,
      hotelEstablishmentsActive: 0,
      hotelEstablishmentsPending: 0,
      hotelBookingsTotal: 0,
      queueHotelPending: 0,
      queueMonthlyPending: 0,
      queueMonthlyVisitPending: 0,
      period,
      periodLabel: periodLabelFr(period),
      periodStart: periodStartIso(period),
      recentUsers: [],
      recentBookings: [],
      popularCities: [],
    };

    try {
      const since = periodStartIso(period);
      const usePeriodRpc = period !== 'all';

      let recentPropertyQuery = supabase
        .from('bookings')
        .select(`
              id,
              booking_code,
              total_price,
              status,
              check_in_date,
              check_out_date,
              guests_count,
              created_at,
              payment_method,
              special_requests,
              property:properties(
                id,
                title,
                address,
                images,
                host:profiles!properties_host_id_fkey(user_id, first_name, last_name, email, phone)
              ),
              guest:profiles!bookings_guest_id_fkey(user_id, first_name, last_name, email, phone)
            `)
        .order('created_at', { ascending: false })
        .limit(8);
      let recentVehicleQuery = supabase
        .from('vehicle_bookings')
        .select(`
              id,
              vehicle_booking_code,
              total_price,
              status,
              start_date,
              end_date,
              created_at,
              payment_method,
              special_requests,
              with_driver,
              daily_rate,
              vehicle:vehicles(
                id,
                brand,
                model,
                title,
                images,
                owner:profiles!vehicles_owner_id_fkey(user_id, first_name, last_name, email, phone)
              ),
              renter:profiles!vehicle_bookings_renter_id_fkey(user_id, first_name, last_name, email, phone)
            `)
        .order('created_at', { ascending: false })
        .limit(8);

      if (since) {
        recentPropertyQuery = recentPropertyQuery.gte('created_at', since);
        recentVehicleQuery = recentVehicleQuery.gte('created_at', since);
      }

      const [overviewResult, recentPropertyBookingsResult, recentVehicleBookingsResult] =
        await Promise.all([
          usePeriodRpc
            ? supabase.rpc('admin_dashboard_period_stats', { p_period: period })
            : supabase.rpc('admin_dashboard_overview'),
          recentPropertyQuery,
          recentVehicleQuery,
        ]);

      let overview = overviewResult.data as Record<string, unknown> | null;
      if (overviewResult.error || !overview) {
        console.warn(
          '[useAdmin] admin stats RPC:',
          overviewResult.error?.message,
        );

        const countSince = async (table: string) => {
          let q = supabase.from(table).select('id', { count: 'exact', head: true });
          if (since) q = q.gte('created_at', since);
          const { count } = await q;
          return count ?? 0;
        };

        const [
          usersRes,
          propertiesRes,
          vehiclesRes,
          bookingsRes,
          pendingRes,
          revenueRes,
          zipRes,
          monthlyRes,
          hotelsRes,
          hotelPendingRes,
          monthlyPendingRes,
          monthlyVisitPendingRes,
        ] = await Promise.all([
          countSince('profiles'),
          countSince('properties'),
          countSince('vehicles'),
          countSince('bookings'),
          supabase
            .from('host_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          since
            ? supabase
                .from('bookings')
                .select('total_price')
                .eq('status', 'confirmed')
                .gte('created_at', since)
            : supabase.rpc('admin_confirmed_revenue_sum'),
          supabase.rpc('count_zip_unique_players'),
          countSince('monthly_rental_listings'),
          countSince('hotel_establishments'),
          supabase
            .from('hotel_establishments')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('monthly_rental_listings')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('monthly_rental_candidatures')
            .select('id', { count: 'exact', head: true })
            .in('status', ['sent', 'viewed']),
        ]);

        let revenue = 0;
        if (since && Array.isArray(revenueRes.data)) {
          revenue = (revenueRes.data as { total_price?: number }[]).reduce(
            (sum, row) => sum + (Number(row.total_price) || 0),
            0,
          );
        } else {
          revenue = Number(revenueRes.data) || 0;
        }

        overview = {
          total_users: usersRes,
          total_properties: propertiesRes,
          total_vehicles: vehiclesRes,
          total_bookings: bookingsRes,
          total_revenue: revenue,
          average_rating: 0,
          pending_applications: pendingRes.count ?? 0,
          zip_unique_players: typeof zipRes.data === 'number' ? zipRes.data : 0,
          monthly_listings_total: monthlyRes,
          hotel_establishments_total: hotelsRes,
          current_hotel_pending: hotelPendingRes.count ?? 0,
          current_monthly_pending: monthlyPendingRes.count ?? 0,
          current_monthly_visit_pending: monthlyVisitPendingRes.count ?? 0,
          period_label: periodLabelFr(period),
          period_start: since,
          period,
        };
      }

      const recentPropertyBookings = recentPropertyBookingsResult.data || [];
      const recentVehicleBookings = recentVehicleBookingsResult.data || [];

      // Si la RPC overview n’a pas encore les champs inventaire (migration manquante),
      // on complète avec des counts directs.
      const needsVehicleCount =
        overview.total_vehicles == null || Number.isNaN(Number(overview.total_vehicles));
      const needsMonthlyCount =
        overview.monthly_listings_total == null ||
        Number.isNaN(Number(overview.monthly_listings_total));
      const needsHotelCount =
        overview.hotel_establishments_total == null ||
        Number.isNaN(Number(overview.hotel_establishments_total));

      if (needsVehicleCount || needsMonthlyCount || needsHotelCount) {
        const [vRes, mRes, hRes] = await Promise.all([
          needsVehicleCount
            ? (() => {
                let q = supabase.from('vehicles').select('id', { count: 'exact', head: true });
                if (since) q = q.gte('created_at', since);
                return q;
              })()
            : Promise.resolve(null),
          needsMonthlyCount
            ? (() => {
                let q = supabase
                  .from('monthly_rental_listings')
                  .select('id', { count: 'exact', head: true });
                if (since) q = q.gte('created_at', since);
                return q;
              })()
            : Promise.resolve(null),
          needsHotelCount
            ? (() => {
                let q = supabase
                  .from('hotel_establishments')
                  .select('id', { count: 'exact', head: true });
                if (since) q = q.gte('created_at', since);
                return q;
              })()
            : Promise.resolve(null),
        ]);
        if (vRes && typeof vRes.count === 'number') {
          overview.total_vehicles = vRes.count;
        }
        if (mRes && typeof mRes.count === 'number') {
          overview.monthly_listings_total = mRes.count;
        }
        if (hRes && typeof hRes.count === 'number') {
          overview.hotel_establishments_total = hRes.count;
        }
      }

      const recentBookings: AdminRecentBookingItem[] = [
        ...recentPropertyBookings.map((booking) => ({
          kind: 'property' as const,
          created_at: booking.created_at,
          booking,
        })),
        ...recentVehicleBookings.map((booking) => ({
          kind: 'vehicle' as const,
          created_at: booking.created_at,
          booking,
        })),
      ]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 8);

      return {
        totalUsers: Number(overview.total_users) || 0,
        totalProperties: Number(overview.total_properties) || 0,
        totalVehicles: Number(overview.total_vehicles) || 0,
        totalBookings: Number(overview.total_bookings) || 0,
        totalRevenue: Number(overview.total_revenue) || 0,
        averageRating: Number(overview.average_rating) || 0,
        pendingApplications: Number(overview.pending_applications) || 0,
        zipUniquePlayers: Number(overview.zip_unique_players) || 0,
        monthlyListingsTotal: Number(overview.monthly_listings_total) || 0,
        monthlyListingsApproved: Number(overview.monthly_listings_approved) || 0,
        monthlyListingsPending: Number(overview.monthly_listings_pending) || 0,
        monthlyVisitRequestsTotal: Number(overview.monthly_visit_requests_total) || 0,
        monthlyVisitRequestsAccepted: Number(overview.monthly_visit_requests_accepted) || 0,
        monthlyVisitRequestsRejected: Number(overview.monthly_visit_requests_rejected) || 0,
        monthlyVisitRequestsPending: Number(overview.monthly_visit_requests_pending) || 0,
        hotelEstablishmentsTotal: Number(overview.hotel_establishments_total) || 0,
        hotelEstablishmentsActive: Number(overview.hotel_establishments_active) || 0,
        hotelEstablishmentsPending: Number(overview.hotel_establishments_pending) || 0,
        hotelBookingsTotal: Number(overview.hotel_bookings_total) || 0,
        queueHotelPending:
          Number(overview.current_hotel_pending ?? overview.hotel_establishments_pending) || 0,
        queueMonthlyPending:
          Number(overview.current_monthly_pending ?? overview.monthly_listings_pending) || 0,
        queueMonthlyVisitPending:
          Number(
            overview.current_monthly_visit_pending ?? overview.monthly_visit_requests_pending,
          ) || 0,
        period: (overview.period as AdminStatsPeriod) || period,
        periodLabel: String(overview.period_label || periodLabelFr(period)),
        periodStart: overview.period_start
          ? String(overview.period_start)
          : since,
        recentUsers: [],
        recentBookings,
        popularCities: [],
      };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Erreur lors du chargement des statistiques');
      return empty;
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

  const getHotelEstablishments = async (): Promise<HotelEstablishmentWithOwner[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from('hotel_establishments')
        .select('*')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (err) {
        setError(err.message);
        return [];
      }
      const list = (rows || []) as HotelEstablishmentWithOwner[];
      if (list.length === 0) return [];
      const hostIds = [...new Set(list.map((l) => l.host_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', hostIds);
      const byId = new Map((profiles || []).map((p) => [p.user_id, p]));
      return list.map((l) => ({
        ...l,
        owner_profile: byId.get(l.host_id) ?? null,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateHotelEstablishmentStatus = async (
    establishmentId: string,
    status: 'active' | 'rejected' | 'hidden',
    adminNotes?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Non connecté' };
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        admin_notes: adminNotes ?? null,
        updated_at: new Date().toISOString(),
      };
      if (status === 'active') {
        payload.hidden_by_admin = false;
      }
      if (status === 'hidden') {
        payload.hidden_by_admin = true;
      }
      const { error: err } = await supabase
        .from('hotel_establishments')
        .update(payload)
        .eq('id', establishmentId);
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
    updatePropertyHomeVisibility,
    updatePropertyHomeFeatured,
    deleteProperty,
    getAllUsers,
    updateUserRole,
    getIdentityDocument,
    getDashboardStats,
    getMonthlyRentalListings,
    updateMonthlyRentalListingStatus,
    deleteMonthlyRentalListing,
    getHotelEstablishments,
    updateHotelEstablishmentStatus,
    loading,
    error,
  };
};
