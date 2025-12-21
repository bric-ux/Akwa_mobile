import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

export const useBookingCancellation = () => {
  const [loading, setLoading] = useState(false);

  const calculatePenalty = (checkInDate: string, pricePerNight: number) => {
    const now = new Date();
    const checkIn = new Date(checkInDate);
    const diffHours = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Pénalité d'1 nuitée si annulation < 48h avant l'arrivée
    return diffHours < 48 ? pricePerNight : 0;
  };

  const cancelBooking = async (
    bookingId: string,
    cancelledBy: string,
    reason: string,
    pricePerNight: number,
    checkInDate: string
  ) => {
    try {
      setLoading(true);

      // Calculer la pénalité
      const penaltyAmount = calculatePenalty(checkInDate, pricePerNight);

      // Mettre à jour la réservation
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancellation_penalty: penaltyAmount,
          cancelled_by: cancelledBy,
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select(`
          *,
          property:properties(
            title,
            price_per_night,
            host_id
          ),
          guest:profiles!guest_id(
            first_name,
            last_name,
            email
          )
        `)
        .single();

      if (error) {
        console.error('Error cancelling booking:', error);
        Alert.alert('Erreur', 'Impossible d\'annuler la réservation');
        return { success: false };
      }

      // Envoyer les emails de notification
      await sendCancellationEmails(data, penaltyAmount);

      Alert.alert(
        'Réservation annulée',
        penaltyAmount > 0 
          ? `Pénalité de ${penaltyAmount.toLocaleString()} FCFA appliquée`
          : 'Annulation gratuite (plus de 48h avant l\'arrivée)'
      );

      return { success: true, data, penaltyAmount };

    } catch (error) {
      console.error('Error in cancelBooking:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'annulation');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const sendCancellationEmails = async (bookingData: any, penaltyAmount: number) => {
    try {
      // Email à l'hôte
      if (bookingData.property?.host_id) {
        const { data: hostData } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('user_id', bookingData.property.host_id)
          .single();

        if (hostData?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_cancelled_host',
              to: hostData.email,
              data: {
                hostName: hostData.first_name,
                propertyTitle: bookingData.property.title,
                guestName: `${bookingData.guest.first_name} ${bookingData.guest.last_name}`,
                checkIn: bookingData.check_in_date,
                checkOut: bookingData.check_out_date,
                penaltyAmount: penaltyAmount,
                reason: bookingData.cancellation_reason
              }
            }
          });
        }
      }

      // Email au voyageur
      if (bookingData.guest?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'booking_cancelled_guest',
            to: bookingData.guest.email,
            data: {
              guestName: bookingData.guest.first_name,
              propertyTitle: bookingData.property.title,
              checkIn: bookingData.check_in_date,
              checkOut: bookingData.check_out_date,
              refundAmount: bookingData.total_price - penaltyAmount,
              penaltyAmount: penaltyAmount,
              reason: bookingData.cancellation_reason
            }
          }
        });
      }
    } catch (error) {
      console.error('Error sending cancellation emails:', error);
      // Ne pas faire échouer l'annulation si l'email échoue
    }
  };

  return {
    cancelBooking,
    calculatePenalty,
    loading
  };
};

