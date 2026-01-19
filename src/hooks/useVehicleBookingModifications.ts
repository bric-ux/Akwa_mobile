import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

export interface VehicleBookingModificationData {
  bookingId: string;
  requestedStartDate: string;
  requestedEndDate: string;
  requestedRentalDays: number;
  requestedTotalPrice: number;
  message?: string;
}

export const useVehicleBookingModifications = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modifyBooking = useCallback(async (data: VehicleBookingModificationData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Récupérer la réservation actuelle
      const { data: booking, error: bookingError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles!inner(
            id,
            owner_id,
            price_per_day,
            title,
            brand,
            model
          ),
          renter:profiles!vehicle_bookings_renter_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', data.bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error('Réservation introuvable');
      }

      // Vérifier que l'utilisateur est le locataire
      if (booking.renter_id !== user.id) {
        throw new Error('Vous n\'êtes pas autorisé à modifier cette réservation');
      }

      // Vérifier que la réservation peut être modifiée
      if (booking.status === 'cancelled' || booking.status === 'completed') {
        throw new Error('Cette réservation ne peut plus être modifiée');
      }

      // Vérifier la disponibilité des nouvelles dates
      const { data: conflictingBookings, error: conflictError } = await supabase
        .from('vehicle_bookings')
        .select('id, start_date, end_date, status')
        .eq('vehicle_id', booking.vehicle.id)
        .in('status', ['pending', 'confirmed', 'completed'])
        .neq('id', data.bookingId)
        .or(`and(start_date.lte.${data.requestedEndDate},end_date.gte.${data.requestedStartDate})`);

      if (conflictError) {
        console.error('Erreur vérification disponibilité:', conflictError);
      }

      if (conflictingBookings && conflictingBookings.length > 0) {
        throw new Error('Ces dates ne sont pas disponibles pour ce véhicule');
      }

      // Si la réservation est en attente (pending), mettre à jour directement
      if (booking.status === 'pending') {
        const { error: updateError } = await supabase
          .from('vehicle_bookings')
          .update({
            start_date: data.requestedStartDate,
            end_date: data.requestedEndDate,
            rental_days: data.requestedRentalDays,
            total_price: data.requestedTotalPrice,
            daily_rate: booking.vehicle.price_per_day,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.bookingId);

        if (updateError) {
          throw updateError;
        }

        // Envoyer les emails de notification pour modification de demande en attente
        try {
          const ownerProfile = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', booking.vehicle.owner_id)
            .single();

          const vehicleTitle = booking.vehicle.title || `${booking.vehicle.brand} ${booking.vehicle.model}`;
          const renterName = `${booking.renter?.first_name || ''} ${booking.renter?.last_name || ''}`.trim();

          // Email au propriétaire
          if (ownerProfile.data?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'pending_vehicle_booking_modified_owner',
                to: ownerProfile.data.email,
                data: {
                  ownerName: `${ownerProfile.data.first_name || ''} ${ownerProfile.data.last_name || ''}`.trim() || 'Cher propriétaire',
                  renterName: renterName || 'Un locataire',
                  vehicleTitle: vehicleTitle,
                  oldStartDate: new Date(booking.start_date).toLocaleDateString('fr-FR'),
                  oldEndDate: new Date(booking.end_date).toLocaleDateString('fr-FR'),
                  newStartDate: new Date(data.requestedStartDate).toLocaleDateString('fr-FR'),
                  newEndDate: new Date(data.requestedEndDate).toLocaleDateString('fr-FR'),
                  oldRentalDays: booking.rental_days,
                  newRentalDays: data.requestedRentalDays,
                  oldTotalPrice: booking.total_price,
                  newTotalPrice: data.requestedTotalPrice,
                  message: data.message || null,
                },
              },
            });
          }

          // Email au locataire
          if (booking.renter?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'pending_vehicle_booking_modified_renter',
                to: booking.renter.email,
                data: {
                  renterName: renterName || 'Cher client',
                  vehicleTitle: vehicleTitle,
                  oldStartDate: new Date(booking.start_date).toLocaleDateString('fr-FR'),
                  oldEndDate: new Date(booking.end_date).toLocaleDateString('fr-FR'),
                  newStartDate: new Date(data.requestedStartDate).toLocaleDateString('fr-FR'),
                  newEndDate: new Date(data.requestedEndDate).toLocaleDateString('fr-FR'),
                  oldRentalDays: booking.rental_days,
                  newRentalDays: data.requestedRentalDays,
                  oldTotalPrice: booking.total_price,
                  newTotalPrice: data.requestedTotalPrice,
                },
              },
            });
          }
        } catch (emailError) {
          console.error('Erreur envoi email modification:', emailError);
          // Ne pas faire échouer la modification si l'email échoue
        }

        return { success: true };
      }

      // Pour les réservations confirmées, créer une demande de modification
      // (On pourrait créer une table vehicle_booking_modification_requests, mais pour simplifier,
      // on va juste mettre à jour directement avec un message dans cancellation_reason temporairement)
      // Pour l'instant, on met à jour directement même pour les réservations confirmées
      const { error: updateError } = await supabase
        .from('vehicle_bookings')
        .update({
          start_date: data.requestedStartDate,
          end_date: data.requestedEndDate,
          rental_days: data.requestedRentalDays,
          total_price: data.requestedTotalPrice,
          daily_rate: booking.vehicle.price_per_day,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.bookingId);

      if (updateError) {
        throw updateError;
      }

      // Envoyer les emails de notification pour modification de réservation confirmée
      try {
        const ownerProfile = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('user_id', booking.vehicle.owner_id)
          .single();

        const vehicleTitle = booking.vehicle.title || `${booking.vehicle.brand} ${booking.vehicle.model}`;
        const renterName = `${booking.renter?.first_name || ''} ${booking.renter?.last_name || ''}`.trim();

        // Email au propriétaire
        if (ownerProfile.data?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_modification_requested',
              to: ownerProfile.data.email,
              data: {
                ownerName: `${ownerProfile.data.first_name || ''} ${ownerProfile.data.last_name || ''}`.trim() || 'Cher propriétaire',
                renterName: renterName || 'Un locataire',
                vehicleTitle: vehicleTitle,
                originalStartDate: new Date(booking.start_date).toLocaleDateString('fr-FR'),
                originalEndDate: new Date(booking.end_date).toLocaleDateString('fr-FR'),
                originalDays: booking.rental_days,
                originalPrice: booking.total_price,
                requestedStartDate: new Date(data.requestedStartDate).toLocaleDateString('fr-FR'),
                requestedEndDate: new Date(data.requestedEndDate).toLocaleDateString('fr-FR'),
                requestedDays: data.requestedRentalDays,
                requestedPrice: data.requestedTotalPrice,
                renterMessage: data.message || null,
                bookingId: booking.id,
                isPendingBooking: false,
              },
            },
          });
        }

        // Email au locataire pour l'informer de sa modification
        if (booking.renter?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_modification_requested',
              to: booking.renter.email,
              data: {
                renterName: renterName || 'Cher client',
                vehicleTitle: vehicleTitle,
                originalStartDate: new Date(booking.start_date).toLocaleDateString('fr-FR'),
                originalEndDate: new Date(booking.end_date).toLocaleDateString('fr-FR'),
                originalDays: booking.rental_days,
                originalPrice: booking.total_price,
                requestedStartDate: new Date(data.requestedStartDate).toLocaleDateString('fr-FR'),
                requestedEndDate: new Date(data.requestedEndDate).toLocaleDateString('fr-FR'),
                requestedDays: data.requestedRentalDays,
                requestedPrice: data.requestedTotalPrice,
                message: 'Votre demande de modification a été envoyée au propriétaire',
                bookingId: booking.id,
                isPendingBooking: false,
              },
            },
          });
        }
      } catch (emailError) {
        console.error('Erreur envoi email modification:', emailError);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors de la modification:', err);
      setError(err.message || 'Erreur lors de la modification');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    modifyBooking,
    loading,
    error,
  };
};


