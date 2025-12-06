import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { VehicleBooking, VehicleBookingStatus } from '../types';

export interface VehicleBookingData {
  vehicleId: string;
  startDate: string;
  endDate: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  messageToOwner?: string;
  specialRequests?: string;
}

export const useVehicleBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useCallback(async (bookingData: VehicleBookingData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Vous devez être connecté pour effectuer une réservation');
      }

      // Calculer le nombre de jours
      const start = new Date(bookingData.startDate);
      const end = new Date(bookingData.endDate);
      const rentalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (rentalDays <= 0) {
        throw new Error('La date de fin doit être après la date de début');
      }

      // Récupérer les informations du véhicule pour calculer le prix
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('price_per_day, minimum_rental_days')
        .eq('id', bookingData.vehicleId)
        .single();

      if (vehicleError || !vehicle) {
        throw new Error('Véhicule introuvable');
      }

      if (rentalDays < (vehicle.minimum_rental_days || 1)) {
        throw new Error(`La location minimum est de ${vehicle.minimum_rental_days || 1} jour(s)`);
      }

      // Vérifier la disponibilité
      const { data: existingBookings, error: availabilityError } = await supabase
        .from('vehicle_bookings')
        .select('id')
        .eq('vehicle_id', bookingData.vehicleId)
        .in('status', ['pending', 'confirmed'])
        .or(`start_date.lte.${bookingData.endDate},end_date.gte.${bookingData.startDate}`);

      if (availabilityError) {
        throw availabilityError;
      }

      if (existingBookings && existingBookings.length > 0) {
        throw new Error('Ce véhicule n\'est pas disponible pour ces dates');
      }

      // Calculer le prix total
      const dailyRate = vehicle.price_per_day;
      const totalPrice = dailyRate * rentalDays;

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
          status: 'pending',
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
  }, []);

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
            first_name,
            last_name,
            email,
            phone
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

  return {
    loading,
    error,
    createBooking,
    getMyBookings,
    getVehicleBookings,
    updateBookingStatus,
    cancelBooking,
  };
};



