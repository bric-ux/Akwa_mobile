import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

export interface CancellationInfo {
  canCancel: boolean;
  refundPercentage: number;
  policy: string;
  isInProgress?: boolean;
  remainingNights?: number;
  remainingNightsAmount?: number;
  penaltyAmount?: number;
  refundAmount?: number;
}

export const useBookingCancellation = () => {
  const [loading, setLoading] = useState(false);

  const calculateCancellationInfo = async (
    bookingId: string,
    checkInDate: string,
    checkOutDate: string,
    totalPrice: number,
    pricePerNight: number,
    cancellationPolicy: string | null,
    status: string
  ): Promise<CancellationInfo | null> => {
    try {
      const policy = cancellationPolicy || 'flexible';
      const isPending = status === 'pending';
      let canCancel = false;
      let refundPercentage = 0;
      let isInProgress = false;
      let remainingNights = 0;
      let remainingNightsAmount = 0;

      const checkIn = new Date(checkInDate);
      const checkOut = checkOutDate ? new Date(checkOutDate) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      checkIn.setHours(0, 0, 0, 0);
      if (checkOut) {
        checkOut.setHours(0, 0, 0, 0);
      }

      // Vérifier si la réservation est en cours
      if (checkOut && checkIn <= today && today <= checkOut) {
        isInProgress = true;
        // Calculer les nuitées restantes
        const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const nightsElapsed = Math.max(0, Math.ceil((today.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
        remainingNights = Math.max(0, totalNights - nightsElapsed);
        remainingNightsAmount = remainingNights * pricePerNight;
        
        canCancel = true;
        // Pour les réservations en cours, on rembourse 50% des nuitées restantes
        refundPercentage = remainingNights > 0 ? 50 : 0;
      } else if (isPending) {
        // Réservations pending : 100% remboursement
        canCancel = true;
        refundPercentage = 100;
      } else {
        // Pour les réservations confirmées, appliquer la politique d'annulation
        const daysUntilCheckIn = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Toutes les politiques permettent l'annulation, mais avec des remboursements différents
        canCancel = true;
        switch (policy) {
          case 'flexible':
            // 100% remboursés au moins 1 jour avant, 50% moins de 1 jour avant
            refundPercentage = daysUntilCheckIn >= 1 ? 100 : 50;
            break;
          case 'moderate':
            // 100% remboursés au moins 5 jours avant, 50% moins de 5 jours avant
            refundPercentage = daysUntilCheckIn >= 5 ? 100 : 50;
            break;
          case 'strict':
            // 100% remboursés au moins 7 jours avant, 50% moins de 7 jours avant
            refundPercentage = daysUntilCheckIn >= 7 ? 100 : 50;
            break;
          case 'non_refundable':
            canCancel = false;
            refundPercentage = 0;
            break;
          default:
            // Par défaut, politique flexible
            refundPercentage = daysUntilCheckIn >= 1 ? 100 : 50;
        }
      }

      // Calculer les montants
      let refundAmount = 0;
      let penaltyAmount = 0;

      if (isInProgress && remainingNightsAmount !== undefined) {
        // Pour les réservations en cours, rembourser 50% des nuitées restantes
        refundAmount = Math.round(remainingNightsAmount * 0.50);
        penaltyAmount = totalPrice - refundAmount;
      } else {
        // Pour les autres cas, calculer selon le pourcentage
        refundAmount = Math.round((totalPrice * refundPercentage) / 100);
        penaltyAmount = totalPrice - refundAmount;
      }

      return {
        canCancel,
        refundPercentage,
        policy,
        isInProgress,
        remainingNights,
        remainingNightsAmount,
        penaltyAmount,
        refundAmount,
      };
    } catch (error) {
      console.error('Error calculating cancellation info:', error);
      return null;
    }
  };

  const cancelBooking = async (
    bookingId: string,
    cancelledBy: string,
    reason: string,
    checkInDate: string,
    checkOutDate: string,
    totalPrice: number,
    pricePerNight: number,
    cancellationPolicy: string | null,
    status: string
  ) => {
    try {
      setLoading(true);

      // Calculer les informations d'annulation
      const cancellationInfo = await calculateCancellationInfo(
        bookingId,
        checkInDate,
        checkOutDate,
        totalPrice,
        pricePerNight,
        cancellationPolicy,
        status
      );

      if (!cancellationInfo || !cancellationInfo.canCancel) {
        Alert.alert(
          'Annulation impossible',
          'Cette réservation ne peut pas être annulée selon la politique de la propriété.'
        );
        return { success: false };
      }

      const penaltyAmount = cancellationInfo.penaltyAmount || 0;

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
          properties!inner(
            title,
            price_per_night,
            host_id,
            cancellation_policy
          ),
          profiles!bookings_guest_id_fkey(
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
      await sendCancellationEmails(data, penaltyAmount, cancellationInfo.refundAmount || 0);

      Alert.alert(
        'Réservation annulée',
        penaltyAmount > 0 
          ? `Pénalité de ${penaltyAmount.toLocaleString('fr-FR')} FCFA appliquée. Remboursement de ${(cancellationInfo.refundAmount || 0).toLocaleString('fr-FR')} FCFA.`
          : 'Annulation gratuite. Remboursement intégral.'
      );

      return { success: true, data, penaltyAmount, refundAmount: cancellationInfo.refundAmount };

    } catch (error) {
      console.error('Error in cancelBooking:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'annulation');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const sendCancellationEmails = async (bookingData: any, penaltyAmount: number, refundAmount: number) => {
    try {
      // Email à l'hôte
      if (bookingData.properties?.host_id) {
        const { data: hostData } = await supabase
          .from('profiles')
          .select('email, first_name')
          .eq('user_id', bookingData.properties.host_id)
          .single();

        if (hostData?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_cancelled_host',
              to: hostData.email,
              data: {
                hostName: hostData.first_name || 'Hôte',
                propertyTitle: bookingData.properties.title,
                guestName: `${bookingData.profiles?.first_name || ''} ${bookingData.profiles?.last_name || ''}`.trim(),
                checkIn: bookingData.check_in_date,
                checkOut: bookingData.check_out_date,
                guests: bookingData.guests_count || 1,
                totalPrice: bookingData.total_price,
                penaltyAmount: penaltyAmount,
                reason: bookingData.cancellation_reason || 'Annulation par le voyageur',
                siteUrl: 'https://akwahome.com'
              }
            }
          });
          console.log('✅ Email d\'annulation envoyé à l\'hôte');
        }
      }

      // Email au voyageur
      if (bookingData.profiles?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'booking_cancelled_guest',
            to: bookingData.profiles.email,
            data: {
              guestName: `${bookingData.profiles.first_name || ''} ${bookingData.profiles.last_name || ''}`.trim(),
              propertyTitle: bookingData.properties.title,
              checkIn: bookingData.check_in_date,
              checkOut: bookingData.check_out_date,
              guests: bookingData.guests_count || 1,
              totalPrice: bookingData.total_price,
              refundAmount: refundAmount,
              penaltyAmount: penaltyAmount,
              reason: bookingData.cancellation_reason || 'Annulation par le voyageur',
              siteUrl: 'https://akwahome.com'
            }
          }
        });
        console.log('✅ Email d\'annulation envoyé au voyageur');
      }
    } catch (error) {
      console.error('Error sending cancellation emails:', error);
      // Ne pas faire échouer l'annulation si l'email échoue
    }
  };

  return {
    cancelBooking,
    calculateCancellationInfo,
    loading
  };
};
