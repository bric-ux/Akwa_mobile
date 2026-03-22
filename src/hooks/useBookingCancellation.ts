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
  /** Nuitées déjà consommées (résidence meublée en cours) */
  consumedNightsAmount?: number;
  /** Frais d'annulation (part non remboursée hors nuitées consommées) */
  cancellationFeeAmount?: number;
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
      // Résidence meublée : pas de prorata de taxes dans le calcul d'annulation

      // Vérifier si la réservation est en cours
      if (checkOut && checkIn <= today && today <= checkOut) {
        isInProgress = true;
        // Nuitées écoulées = nuits complètement consommées (floor)
        const nightsElapsed = Math.max(0, Math.floor((today.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
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
      let consumedNightsAmount = 0;
      let cancellationFeeAmount = 0;

      if (isPending) {
        refundAmount = totalPrice;
        penaltyAmount = 0;
      } else if (isInProgress) {
        if (remainingNights <= 0) {
          refundAmount = 0;
          penaltyAmount = totalPrice;
        } else {
          // Résidence meublée : remboursement basé uniquement sur les nuitées restantes (sans prorata taxes)
          switch (policy) {
            case 'flexible':
              refundAmount = Math.round(0.8 * remainingNightsAmount);
              break;
            case 'moderate':
              refundAmount = Math.round(0.5 * remainingNightsAmount);
              break;
            case 'strict':
              refundAmount = 0;
              break;
            default:
              refundAmount = Math.round(0.8 * remainingNightsAmount);
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
              refundAmount = Math.round(0.8 * remainingNightsAmount);
              penaltyAmount = Math.max(0, totalPrice - refundAmount);
            }
            break;
          case 'moderate':
            if (daysUntilCheckIn >= 5) {
              refundAmount = totalPrice;
              penaltyAmount = 0;
            } else {
              refundAmount = Math.round(0.5 * remainingNightsAmount);
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
              refundAmount = 0;
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
              refundAmount = Math.round(0.8 * remainingNightsAmount);
              penaltyAmount = Math.max(0, totalPrice - refundAmount);
            }
        }
      }

      // Répartition pénalité = nuit(s) consommée(s) + frais d'annulation (résidence meublée)
      if (penaltyAmount > 0 && isInProgress && remainingNights !== undefined) {
        const nightsElapsed = totalNights - remainingNights;
        consumedNightsAmount = Math.round((nightsElapsed / totalNights) * totalPrice);
        cancellationFeeAmount = Math.max(0, penaltyAmount - consumedNightsAmount);
      } else if (penaltyAmount > 0) {
        cancellationFeeAmount = penaltyAmount;
      }

      return {
        canCancel,
        refundPercentage,
        policy,
        isInProgress,
        remainingNights,
        remainingNightsAmount,
        consumedNightsAmount,
        cancellationFeeAmount,
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

      // Si le voyageur a payé via CB/Wave et l'hôte a déjà perçu (48h après check-in),
      // l'hôte doit rembourser AkwaHome (car c'est AkwaHome qui rembourse le voyageur)
      const refundAmount = cancellationInfo.refundAmount || 0;
      const totalPrice = data?.total_price ?? 1;
      const hostNetAmount = data?.host_net_amount ?? data?.total_price ?? refundAmount;
      /** L'hôte reverse le montant net qu'il a perçu (au prorata si remboursement partiel). */
      const hostReimbursementAmount = refundAmount > 0 && totalPrice > 0
        ? Math.round((refundAmount / totalPrice) * hostNetAmount)
        : refundAmount;
      const guestPaidViaPlatform = data?.payment_method === 'card' || data?.payment_method === 'wave';
      const hostHasReceivedMoney = data?.check_in_date
        ? new Date(data.check_in_date).getTime() + 48 * 60 * 60 * 1000 <= Date.now()
        : false;

      if (refundAmount > 0 && guestPaidViaPlatform && hostHasReceivedMoney && data?.properties?.host_id) {
        try {
          await supabase.from('penalty_tracking').insert({
            booking_id: bookingId,
            host_id: data.properties.host_id,
            guest_id: data.guest_id,
            penalty_amount: hostReimbursementAmount,
            penalty_type: 'guest_cancellation',
            payment_method: null,
            status: 'pending',
            service_type: 'property',
          });
        } catch (e) {
          console.error('Erreur création penalty_tracking (remboursement hôte):', e);
        }
      }

      // Envoyer les emails de notification (avec indication si hôte doit rembourser directement en cas de paiement espèces)
      const hostMustReimburseDirectly = refundAmount > 0 && !guestPaidViaPlatform;
      await sendCancellationEmails(data, penaltyAmount, refundAmount, hostMustReimburseDirectly);

      Alert.alert(
        'Réservation annulée',
        penaltyAmount > 0 
          ? `Nuit(s) consommée(s) + frais d'annulation : ${penaltyAmount.toLocaleString('fr-FR')} FCFA. Remboursement : ${refundAmount.toLocaleString('fr-FR')} FCFA.`
          : 'Annulation gratuite. Remboursement intégral.'
      );

      return { success: true, data, penaltyAmount, refundAmount };

    } catch (error) {
      console.error('Error in cancelBooking:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'annulation');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const sendCancellationEmails = async (bookingData: any, penaltyAmount: number, refundAmount: number, hostMustReimburseDirectly = false) => {
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
                refundAmount: refundAmount,
                hostMustReimburseDirectly: hostMustReimburseDirectly,
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
  /**
   * @param ownerNetAmountOption Si fourni, la pénalité est calculée sur ce montant net (au lieu de basePrice)
   */
  const calculateVehicleOwnerCancellationPenalty = useCallback((
    startDate: string,
    endDate: string,
    totalPrice: number,
    basePrice: number,
    rentalDays: number,
    status: string,
    ownerNetAmountOption?: number
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
    const totalNights = Math.max(1, rentalDays);
    const pricePerNight = basePrice / totalNights;
    const isInProgress = start <= now && now <= end;
    const netBase = ownerNetAmountOption ?? basePrice;

    if (isInProgress) {
      // Jours écoulés = jours complètement consommés (floor)
      const nightsElapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingNights = Math.max(0, totalNights - nightsElapsed);
      const applicableNet = totalNights > 0 ? (remainingNights / totalNights) * netBase : 0;
      const penalty = Math.round(applicableNet * 0.40);
      const refundAmount = totalNights > 0 ? Math.round((remainingNights / totalNights) * totalPrice) : 0;
      return {
        penalty,
        refundAmount,
        description: `Annulation en cours de location (40% de pénalité sur ${remainingNights} jour(s) restant(s)). Le locataire sera remboursé du restant des jours non consommés.`,
      };
    }
    if (daysUntilStart > 5) {
      return {
        penalty: 0,
        refundAmount: totalPrice,
        description: 'Annulation gratuite (plus de 5 jours avant le début). Le locataire sera remboursé intégralement.',
      };
    }
    if (daysUntilStart > 2 && daysUntilStart <= 5) {
      const penalty = Math.round(netBase * 0.20);
      return {
        penalty,
        refundAmount: totalPrice,
        description: 'Annulation entre 5 et 2 jours avant le début (20% de pénalité sur montant net). Le locataire sera remboursé intégralement.',
      };
    }
    const penalty = Math.round(netBase * 0.40);
    return {
      penalty,
      refundAmount: totalPrice,
      description: 'Annulation 2 jours ou moins avant le début (40% de pénalité sur montant net). Le locataire sera remboursé intégralement.',
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
