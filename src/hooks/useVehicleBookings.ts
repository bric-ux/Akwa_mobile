import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { VehicleBooking, VehicleBookingStatus } from '../types';
import { useIdentityVerification } from './useIdentityVerification';

export interface VehicleBookingData {
  vehicleId: string;
  startDate: string;
  endDate: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  messageToOwner?: string;
  specialRequests?: string;
  licenseDocumentUrl?: string;
}

export const useVehicleBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasUploadedIdentity, isVerified, loading: identityLoading } = useIdentityVerification();

  const createBooking = useCallback(async (bookingData: VehicleBookingData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Vous devez être connecté pour effectuer une réservation');
      }

      // Vérifier si l'identité est vérifiée (même logique que le site web)
      if (identityLoading) {
        setError('Vérification de l\'identité en cours...');
        return { success: false, error: 'Vérification de l\'identité en cours...' };
      }

      if (!hasUploadedIdentity) {
        setError('IDENTITY_REQUIRED');
        return { success: false, error: 'IDENTITY_REQUIRED' };
      }

      if (!isVerified) {
        setError('IDENTITY_NOT_VERIFIED');
        return { success: false, error: 'IDENTITY_NOT_VERIFIED' };
      }

      // Calculer le nombre de jours (comme sur le site web: différence + 1)
      const start = new Date(bookingData.startDate);
      const end = new Date(bookingData.endDate);
      const rentalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (rentalDays <= 1) {
        throw new Error('La date de fin doit être après la date de début');
      }

      // Récupérer les informations du véhicule pour calculer le prix
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('price_per_day, minimum_rental_days, auto_booking')
        .eq('id', bookingData.vehicleId)
        .single();

      if (vehicleError || !vehicle) {
        throw new Error('Véhicule introuvable');
      }

      if (rentalDays < (vehicle.minimum_rental_days || 1)) {
        throw new Error(`La location minimum est de ${vehicle.minimum_rental_days || 1} jour(s)`);
      }

      // Vérifier la disponibilité (pending, confirmed, completed - comme sur le site web)
      const { data: existingBookings, error: availabilityError } = await supabase
        .from('vehicle_bookings')
        .select('id, start_date, end_date, status')
        .eq('vehicle_id', bookingData.vehicleId)
        .in('status', ['pending', 'confirmed', 'completed'])
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (availabilityError) {
        throw availabilityError;
      }

      // Vérifier les dates bloquées manuellement
      const { data: blockedDates, error: blockedError } = await supabase
        .from('vehicle_blocked_dates')
        .select('start_date, end_date, reason')
        .eq('vehicle_id', bookingData.vehicleId)
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (blockedError) {
        console.error('Blocked dates check error:', blockedError);
      }

      // Vérifier les conflits avec les réservations existantes
      const bookingStart = new Date(bookingData.startDate);
      const bookingEnd = new Date(bookingData.endDate);
      
      const hasBookingConflict = existingBookings?.some(booking => {
        const existingStart = new Date(booking.start_date);
        const existingEnd = new Date(booking.end_date);
        
        return (
          (bookingStart <= existingEnd && bookingEnd >= existingStart)
        );
      });

      if (hasBookingConflict) {
        throw new Error('Ce véhicule n\'est pas disponible pour ces dates');
      }

      // Vérifier les conflits avec les dates bloquées
      const hasBlockedConflict = blockedDates?.some(({ start_date, end_date }) => {
        const blockedStart = new Date(start_date);
        const blockedEnd = new Date(end_date);
        
        return (
          (bookingStart <= blockedEnd && bookingEnd >= blockedStart)
        );
      });

      if (hasBlockedConflict) {
        throw new Error('Ces dates sont bloquées par le propriétaire');
      }

      // Calculer le prix total
      const dailyRate = vehicle.price_per_day;
      const totalPrice = dailyRate * rentalDays;

      // Déterminer le statut initial en fonction de auto_booking
      const initialStatus = (vehicle as any).auto_booking === true ? 'confirmed' : 'pending';

      // Créer la réservation
      const { data: booking, error: bookingError } = await supabase
        .from('vehicle_bookings')
        .insert({
          vehicle_id: bookingData.vehicleId,
          renter_id: user.id,
          start_date: bookingData.startDate,
          end_date: bookingData.endDate,
          rental_days: rentalDays,
          daily_rate: dailyRate,
          total_price: totalPrice,
          pickup_location: bookingData.pickupLocation || null,
          dropoff_location: bookingData.dropoffLocation || null,
          message_to_owner: bookingData.messageToOwner || null,
          special_requests: bookingData.specialRequests || null,
          license_document_url: bookingData.licenseDocumentUrl || null,
          status: initialStatus,
        })
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images
          )
        `)
        .single();

      if (bookingError) {
        throw bookingError;
      }

      return { success: true, booking };
    } catch (err: any) {
      console.error('Erreur lors de la création de la réservation:', err);
      setError(err.message || 'Erreur lors de la création de la réservation');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [hasUploadedIdentity, isVerified, identityLoading]);

  const getMyBookings = useCallback(async (): Promise<VehicleBooking[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { data, error: queryError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images,
            location:locations (
              id,
              name
            ),
            vehicle_photos (
              id,
              url,
              is_main
            )
          )
        `)
        .eq('renter_id', user.id)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      return (data || []) as VehicleBooking[];
    } catch (err: any) {
      console.error('Erreur lors du chargement des réservations:', err);
      setError(err.message || 'Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getVehicleBookings = useCallback(async (vehicleId: string): Promise<VehicleBooking[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Vérifier que l'utilisateur est le propriétaire du véhicule
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('id', vehicleId)
        .single();

      if (vehicleError || !vehicle) {
        throw new Error('Véhicule introuvable');
      }

      if (vehicle.owner_id !== user.id) {
        throw new Error('Vous n\'êtes pas autorisé à voir ces réservations');
      }

      const { data, error: queryError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          renter:profiles!renter_id (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      return (data || []) as VehicleBooking[];
    } catch (err: any) {
      console.error('Erreur lors du chargement des réservations:', err);
      setError(err.message || 'Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBookingStatus = useCallback(async (
    bookingId: string,
    status: VehicleBookingStatus
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from('vehicle_bookings')
        .update({ status })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return { success: true, booking: data };
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du statut:', err);
      setError(err.message || 'Erreur lors de la mise à jour du statut');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelBooking = useCallback(async (bookingId: string, reason?: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { data, error: updateError } = await supabase
        .from('vehicle_bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: reason || null,
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return { success: true, booking: data };
    } catch (err: any) {
      console.error('Erreur lors de l\'annulation:', err);
      setError(err.message || 'Erreur lors de l\'annulation');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllOwnerBookings = useCallback(async (): Promise<VehicleBooking[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Récupérer tous les véhicules du propriétaire
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('owner_id', user.id);

      if (vehiclesError) {
        throw vehiclesError;
      }

      if (!vehicles || vehicles.length === 0) {
        return [];
      }

      const vehicleIds = vehicles.map(v => v.id);

      // Récupérer toutes les réservations pour ces véhicules
      const { data, error: queryError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images,
            vehicle_photos (
              id,
              url,
              is_main
            )
          ),
          renter:profiles!renter_id (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          )
        `)
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      return (data || []) as VehicleBooking[];
    } catch (err: any) {
      console.error('Erreur lors du chargement des réservations:', err);
      setError(err.message || 'Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createBooking,
    getMyBookings,
    getVehicleBookings,
    getAllOwnerBookings,
    updateBookingStatus,
    cancelBooking,
  };
};





