import { useState, useCallback } from 'react';
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

  const calculateCancellationInfo = useCallback(async (
    bookingId: string,
    checkInDate: string,
    checkOutDate: string,
    totalPrice: number,
    pricePerNight: number,
    cancellationPolicy: string | null,
    status: string,
    /** Pour véhicule : forcer le nombre de "nuits" (jours de location) au lieu de le déduire des dates */
    optionalTotalNights?: number
  ): Promise<CancellationInfo | null> => {
    try {
      const policy = cancellationPolicy || 'flexible';
      const isPending = status === 'pending';
      let canCancel = false;
      let refundPercentage = 0;
      let isInProgress = false;
      let remainingNights = 0;
      let remainingNightsAmount = 0;
      let totalNights = 0;

      const checkIn = new Date(checkInDate);
      const checkOut = checkOutDate ? new Date(checkOutDate) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      checkIn.setHours(0, 0, 0, 0);
      if (checkOut) {
        checkOut.setHours(0, 0, 0, 0);
      }

      if (optionalTotalNights !== undefined && optionalTotalNights !== null) {
        totalNights = Math.max(1, optionalTotalNights);
      } else if (checkOut) {
        totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      }
      const baseAmount = totalNights * pricePerNight;
      const feesAndTaxes = Math.max(0, totalPrice - baseAmount);

      // Vérifier si la réservation est en cours
      if (checkOut && checkIn <= today && today <= checkOut) {
        isInProgress = true;
        const nightsElapsed = Math.max(0, Math.ceil((today.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
        remainingNights = Math.max(0, totalNights - nightsElapsed);
        remainingNightsAmount = remainingNights * pricePerNight;
        canCancel = true;
        refundPercentage = remainingNights > 0 ? 50 : 0; // utilisé pour affichage uniquement si calcul manuel
      } else if (isPending) {
        canCancel = true;
        refundPercentage = 100;
      } else {
        const daysUntilCheckIn = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntilCheckIn = (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60);
        canCancel = true;
        switch (policy) {
          case 'flexible':
            refundPercentage = hoursUntilCheckIn >= 24 ? 100 : 50;
            break;
          case 'moderate':
            refundPercentage = daysUntilCheckIn >= 5 ? 100 : 50;
            break;
          case 'strict':
            refundPercentage = daysUntilCheckIn >= 28 ? 100 : daysUntilCheckIn >= 7 ? 50 : 0;
            break;
          case 'non_refundable':
            canCancel = false;
            refundPercentage = 0;
            break;
          default:
            refundPercentage = hoursUntilCheckIn >= 24 ? 100 : 50;
        }
      }

      // Calcul des montants selon les nouvelles règles (8.1, 8.2, 8.3)
      let refundAmount = 0;
      let penaltyAmount = 0;

      if (isPending) {
        refundAmount = totalPrice;
        penaltyAmount = 0;
      } else if (isInProgress) {
        if (remainingNights <= 0) {
          refundAmount = 0;
          penaltyAmount = totalPrice;
        } else {
          // Pour véhicule: on ne proratiste plus les taxes/frais sur la partie non consommée.
          // Cela évite un remboursement trop proche du total (et donc une pénalité affichée à 0).
          const taxesProRata = 0;
          switch (policy) {
            case 'flexible':
              refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
              break;
            case 'moderate':
              refundAmount = Math.round(0.5 * remainingNightsAmount + taxesProRata);
              break;
            case 'strict':
              refundAmount = Math.round(taxesProRata);
              break;
            default:
              refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
          }
          penaltyAmount = Math.max(0, totalPrice - refundAmount);
        }
      } else {
        // Avant le début
        const daysUntilCheckIn = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntilCheckIn = (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60);
        remainingNights = totalNights;
        remainingNightsAmount = baseAmount;

        switch (policy) {
          case 'flexible':
            if (hoursUntilCheckIn >= 24) {
              refundAmount = totalPrice;
              penaltyAmount = 0;
            } else {
              const taxesProRata = 0;
              refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
              penaltyAmount = Math.max(0, totalPrice - refundAmount);
            }
            break;
          case 'moderate':
            if (daysUntilCheckIn >= 5) {
              refundAmount = totalPrice;
              penaltyAmount = 0;
            } else {
              const taxesProRata = 0;
              refundAmount = Math.round(0.5 * remainingNightsAmount + taxesProRata);
              penaltyAmount = Math.max(0, totalPrice - refundAmount);
            }
            break;
          case 'strict':
            if (daysUntilCheckIn >= 28) {
              refundAmount = totalPrice;
              penaltyAmount = 0;
            } else if (daysUntilCheckIn >= 7) {
              refundAmount = Math.round(0.5 * totalPrice);
              penaltyAmount = totalPrice - refundAmount;
            } else {
              const taxesProRata = 0;
              refundAmount = Math.round(taxesProRata);
              penaltyAmount = Math.max(0, totalPrice - refundAmount);
            }
            break;
          case 'non_refundable':
            refundAmount = 0;
            penaltyAmount = totalPrice;
            break;
          default:
            if (hoursUntilCheckIn >= 24) {
              refundAmount = totalPrice;
              penaltyAmount = 0;
            } else {
              const taxesProRata = 0;
              refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
              penaltyAmount = Math.max(0, totalPrice - refundAmount);
            }
        }
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
  }, []);

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

  /**
   * Calcule les infos d'annulation pour une location véhicule (locataire qui annule).
   * Mêmes règles que résidence meublée : politiques flexible, moderate, strict, non_refundable.
   * @param startDate date/heure de début de location
   * @param endDate date/heure de fin
   * @param totalPrice montant total payé (inclut frais de service)
   * @param basePrice montant de base (jours + heures, sans frais de service)
   * @param rentalDays nombre de jours de location
   * @param cancellationPolicy politique (défaut 'flexible')
   * @param status statut de la réservation
   */
  const calculateCancellationInfoForVehicle = useCallback(async (
    startDate: string,
    endDate: string,
    totalPrice: number,
    basePrice: number,
    rentalDays: number,
    cancellationPolicy: string | null,
    status: string
  ): Promise<CancellationInfo | null> => {
    const totalNights = Math.max(1, rentalDays);
    const pricePerNight = totalNights > 0 ? basePrice / totalNights : basePrice;
    return calculateCancellationInfo(
      '',
      startDate,
      endDate,
      totalPrice,
      pricePerNight,
      cancellationPolicy || 'flexible',
      status,
      totalNights
    );
  }, [calculateCancellationInfo]);

  /**
   * Pénalité quand le propriétaire du véhicule annule (à partir de 5 jours avant le début).
   * - > 5 jours avant : 0%
   * - entre 5 et 2 jours avant : 20% du montant de base
   * - ≤ 2 jours avant : 40% du montant de base
   * - en cours de location : 40% sur les jours restants (locataire remboursé 100% des jours restants)
   */
  const calculateVehicleOwnerCancellationPenalty = useCallback((
    startDate: string,
    endDate: string,
    totalPrice: number,
    basePrice: number,
    rentalDays: number,
    status: string
  ): { penalty: number; refundAmount: number; description: string } => {
    if (status === 'pending') {
      return { penalty: 0, refundAmount: totalPrice, description: 'Aucune pénalité (demande en attente)' };
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    const totalNights = Math.max(1, rentalDays);
    const pricePerNight = basePrice / totalNights;
    const isInProgress = start <= now && now <= end;

    if (isInProgress) {
      const nightsElapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingNights = Math.max(0, totalNights - nightsElapsed);
      const remainingBaseAmount = remainingNights * pricePerNight;
      const penalty = Math.round(remainingBaseAmount * 0.40);
      // Remboursement = restant des jours non consommés (au prorata du total payé)
      const refundAmount = totalNights > 0 ? Math.round((remainingNights / totalNights) * totalPrice) : 0;
      return {
        penalty,
        refundAmount,
        description: `Annulation en cours de location (40% de pénalité sur ${remainingNights} jour(s) restant(s)). Le locataire sera remboursé du restant des jours non consommés.`,
      };
    }
    // Pénalité à partir de 5 jours avant le début de la location
    if (daysUntilStart > 5) {
      return {
        penalty: 0,
        refundAmount: totalPrice,
        description: 'Annulation gratuite (plus de 5 jours avant le début). Le locataire sera remboursé intégralement.',
      };
    }
    if (daysUntilStart > 2 && daysUntilStart <= 5) {
      const penalty = Math.round(basePrice * 0.20);
      return {
        penalty,
        refundAmount: totalPrice,
        description: 'Annulation entre 5 et 2 jours avant le début (20% de pénalité). Le locataire sera remboursé intégralement.',
      };
    }
    const penalty = Math.round(basePrice * 0.40);
    return {
      penalty,
      refundAmount: totalPrice,
      description: 'Annulation 2 jours ou moins avant le début (40% de pénalité). Le locataire sera remboursé intégralement.',
    };
  }, []);

  return {
    cancelBooking,
    calculateCancellationInfo,
    calculateCancellationInfoForVehicle,
    calculateVehicleOwnerCancellationPenalty,
    loading
  };
};
