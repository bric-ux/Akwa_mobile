import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';
import { hostHasReceivedGuestCashProperty } from '../utils/cancellationPolicy';

export interface CancellationBreakdown {
  totalNights: number;
  nightsElapsed?: number;
  remainingNights: number;
  pricePerNightUsed: number;
  baseAmount: number;
  remainingNightsAmount: number;
  refundRatePercent: number;
  appliedRule: string;
}

/** Ligne pré-calculée issue de booking_calculation_details (réservation actuelle, y compris après modification). */
export interface CancellationCalculationLine {
  label: string;
  value: string;
}

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
  /** Détail transparent du calcul */
  breakdown?: CancellationBreakdown;
  /** Détail fidèle au dernier calcul enregistré (réduction, ménage gratuit, etc.) */
  calculationDetailLines?: CancellationCalculationLine[];
  /** Étapes lisibles : comment le remboursement voyageur est dérivé du total payé et de la politique */
  refundTransparencyLines?: { label: string; value: string }[];
}

function formatFCFA(n: number): string {
  return `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
}

function buildPropertyCalculationLines(s: {
  base_price: number;
  price_after_discount: number;
  discount_amount: number;
  effective_cleaning_fee: number;
  effective_taxes: number;
  service_fee: number;
  total_price: number;
}): CancellationCalculationLine[] {
  const lines: CancellationCalculationLine[] = [
    { label: 'Sous-total nuitées (avant réduction)', value: formatFCFA(s.base_price) },
  ];
  if (Number(s.discount_amount) > 0) {
    lines.push({ label: 'Réduction', value: `−${formatFCFA(s.discount_amount)}` });
    lines.push({
      label: 'Hébergement après réduction',
      value: formatFCFA(s.price_after_discount),
    });
  }
  lines.push(
    { label: 'Frais de ménage', value: formatFCFA(s.effective_cleaning_fee || 0) },
    { label: 'Taxe de séjour', value: formatFCFA(s.effective_taxes || 0) },
    { label: 'Frais de service Akwahome (TTC)', value: formatFCFA(s.service_fee) },
    { label: 'Total payé', value: formatFCFA(s.total_price) },
  );
  return lines;
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
    optionalTotalNights?: number,
    /** Montant réel payé par nuit (hébergement) - si fourni, utilisé à la place de pricePerNight pour cohérence avec réduction/modification */
    effectivePricePerNightOverride?: number,
    /** Détails enregistrés pour cette réservation (prioritaires après modification : réduction, ménage gratuit, etc.) */
    propertyStoredCalc?: {
      base_price: number;
      price_after_discount: number;
      discount_amount: number;
      effective_cleaning_fee: number;
      effective_taxes: number;
      service_fee: number;
      total_price: number;
    } | null
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

      let pricePerNightUsed = (effectivePricePerNightOverride != null && effectivePricePerNightOverride > 0)
        ? effectivePricePerNightOverride
        : pricePerNight;

      if (propertyStoredCalc && totalNights > 0) {
        pricePerNightUsed = Math.round(propertyStoredCalc.price_after_discount / totalNights);
      }

      let baseAmount = totalNights * pricePerNightUsed;
      if (propertyStoredCalc) {
        baseAmount = propertyStoredCalc.price_after_discount;
      }
      // Résidence meublée : pas de prorata de taxes dans le calcul d'annulation

      // Vérifier si la réservation est en cours
      if (checkOut && checkIn <= today && today <= checkOut) {
        isInProgress = true;
        // Nuitées écoulées = nuits complètement consommées (floor)
        const nightsElapsed = Math.max(0, Math.floor((today.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
        remainingNights = Math.max(0, totalNights - nightsElapsed);
        remainingNightsAmount = propertyStoredCalc && totalNights > 0
          ? Math.round((remainingNights / totalNights) * propertyStoredCalc.price_after_discount)
          : remainingNights * pricePerNightUsed;
        canCancel = true;
        // refundPercentage cohérent avec la politique : flexible=80, moderate=50, strict=0
        if (remainingNights > 0) {
          refundPercentage = policy === 'flexible' ? 80 : policy === 'moderate' ? 50 : policy === 'strict' ? 0 : 80;
        } else {
          refundPercentage = 0;
        }
      } else if (isPending) {
        canCancel = true;
        refundPercentage = 100;
      } else {
        const daysUntilCheckIn = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntilCheckIn = (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60);
        canCancel = true;
        switch (policy) {
          case 'flexible':
            refundPercentage = hoursUntilCheckIn >= 24 ? 100 : 80;
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
            refundPercentage = hoursUntilCheckIn >= 24 ? 100 : 80;
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
        remainingNightsAmount = propertyStoredCalc
          ? propertyStoredCalc.price_after_discount
          : baseAmount;

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
      const nightsElapsed = totalNights - remainingNights;
      if (penaltyAmount > 0 && isInProgress && remainingNights !== undefined) {
        consumedNightsAmount = Math.round((nightsElapsed / totalNights) * totalPrice);
        cancellationFeeAmount = Math.max(0, penaltyAmount - consumedNightsAmount);
      } else if (penaltyAmount > 0) {
        cancellationFeeAmount = penaltyAmount;
      }

      // Détail transparent du calcul
      let refundRatePercent = 0;
      let appliedRule = '';
      if (isPending) {
        refundRatePercent = 100;
        appliedRule = 'Demande non confirmée : remboursement intégral';
      } else if (isInProgress) {
        if (remainingNights <= 0) {
          appliedRule = 'Séjour entièrement consommé : aucun remboursement';
        } else {
          refundRatePercent = policy === 'flexible' ? 80 : policy === 'moderate' ? 50 : 0;
          appliedRule = policy === 'flexible'
            ? `${refundRatePercent}% des nuitées restantes (politique flexible)`
            : policy === 'moderate'
              ? `${refundRatePercent}% des nuitées restantes (politique modérée)`
              : '0% des nuitées restantes (politique stricte)';
        }
      } else {
        const daysUntilCheckIn = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntilCheckIn = (checkIn.getTime() - today.getTime()) / (1000 * 60 * 60);
        switch (policy) {
          case 'flexible':
            appliedRule = hoursUntilCheckIn >= 24 ? '≥ 24h avant : remboursement intégral' : `${80}% des nuitées (flexible < 24h)`;
            refundRatePercent = hoursUntilCheckIn >= 24 ? 100 : 80;
            break;
          case 'moderate':
            appliedRule = daysUntilCheckIn >= 5 ? '≥ 5 jours avant : remboursement intégral' : `${50}% des nuitées (modérée < 5j)`;
            refundRatePercent = daysUntilCheckIn >= 5 ? 100 : 50;
            break;
          case 'strict':
            appliedRule = daysUntilCheckIn >= 28 ? '≥ 28 jours avant : remboursement intégral'
              : daysUntilCheckIn >= 7 ? '7-28 jours avant : 50% du total' : '< 7 jours : aucun remboursement';
            refundRatePercent = daysUntilCheckIn >= 28 ? 100 : daysUntilCheckIn >= 7 ? 50 : 0;
            break;
          case 'non_refundable':
            appliedRule = 'Politique non remboursable';
            break;
          default:
            appliedRule = hoursUntilCheckIn >= 24 ? '≥ 24h avant : remboursement intégral' : `${80}% des nuitées`;
            refundRatePercent = hoursUntilCheckIn >= 24 ? 100 : 80;
        }
      }

      const breakdown: CancellationBreakdown = {
        totalNights,
        nightsElapsed: isInProgress ? nightsElapsed : undefined,
        remainingNights,
        pricePerNightUsed,
        baseAmount,
        remainingNightsAmount,
        refundRatePercent,
        appliedRule,
      };

      const calculationDetailLines = propertyStoredCalc
        ? buildPropertyCalculationLines(propertyStoredCalc)
        : undefined;

      const refundTransparencyLines: { label: string; value: string }[] = [
        { label: 'Total payé par le voyageur', value: formatFCFA(totalPrice) },
      ];
      if (
        propertyStoredCalc &&
        Number(propertyStoredCalc.discount_amount) > 0
      ) {
        refundTransparencyLines.push({
          label: 'Hébergement (après réduction)',
          value: formatFCFA(propertyStoredCalc.price_after_discount),
        });
      }
      if (isPending) {
        refundTransparencyLines.push(
          { label: 'Situation', value: 'Réservation non confirmée' },
          { label: 'Remboursement', value: `${formatFCFA(refundAmount)} (= total payé)` },
        );
      } else if (isInProgress) {
        refundTransparencyLines.push(
          {
            label: 'Base pour les nuitées restantes',
            value: formatFCFA(remainingNightsAmount),
          },
          { label: 'Règle', value: breakdown.appliedRule },
          {
            label: 'Remboursement voyageur',
            value: `${formatFCFA(refundAmount)}${remainingNights > 0 && policy === 'flexible' ? ' (80% des nuitées restantes)' : remainingNights > 0 && policy === 'moderate' ? ' (50% des nuitées restantes)' : remainingNights > 0 && policy === 'strict' ? ' (politique stricte : 0%)' : ''}`,
          },
        );
        if (penaltyAmount > 0) {
          refundTransparencyLines.push({
            label: 'Montant non remboursé au voyageur',
            value: `${formatFCFA(penaltyAmount)} (= total payé − remboursement)`,
          });
        }
      } else {
        const daysTr = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        refundTransparencyLines.push(
          {
            label: 'Montant nuitées pris en compte pour la politique',
            value: formatFCFA(remainingNightsAmount),
          },
          { label: 'Règle', value: breakdown.appliedRule },
        );
        if (policy === 'strict' && daysTr >= 7 && daysTr < 28 && refundAmount > 0) {
          refundTransparencyLines.push({
            label: 'Calcul (stricte 7–28 j.)',
            value: `50% × ${formatFCFA(totalPrice)} = ${formatFCFA(refundAmount)}`,
          });
        } else if (
          refundAmount > 0 &&
          breakdown.refundRatePercent > 0 &&
          breakdown.refundRatePercent < 100 &&
          policy !== 'strict'
        ) {
          refundTransparencyLines.push({
            label: `Calcul (${breakdown.refundRatePercent}% des nuitées concernées)`,
            value: `${breakdown.refundRatePercent}% × ${formatFCFA(remainingNightsAmount)} ≈ ${formatFCFA(refundAmount)}`,
          });
        } else if (refundAmount > 0 && penaltyAmount === 0 && refundAmount >= totalPrice) {
          refundTransparencyLines.push({
            label: 'Remboursement',
            value: `${formatFCFA(refundAmount)} (= total payé)`,
          });
        } else if (refundAmount > 0) {
          refundTransparencyLines.push({
            label: 'Remboursement voyageur',
            value: formatFCFA(refundAmount),
          });
        }
        if (penaltyAmount > 0) {
          refundTransparencyLines.push({
            label: 'Montant non remboursé au voyageur',
            value: `${formatFCFA(penaltyAmount)} (= total payé − remboursement)`,
          });
        }
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
        breakdown,
        calculationDetailLines,
        refundTransparencyLines,
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
    status: string,
    effectivePricePerNightOverride?: number
  ) => {
    try {
      setLoading(true);

      // Calculer les informations d'annulation
      const { data: calcRow } = await supabase
        .from('booking_calculation_details')
        .select('base_price, price_after_discount, discount_amount, effective_cleaning_fee, effective_taxes, service_fee, total_price, host_net_amount')
        .eq('booking_id', bookingId)
        .eq('booking_type', 'property')
        .maybeSingle();

      const propertyStoredCalc = calcRow
        ? {
            base_price: Number(calcRow.base_price),
            price_after_discount: Number(calcRow.price_after_discount),
            discount_amount: Number(calcRow.discount_amount || 0),
            effective_cleaning_fee: Number(calcRow.effective_cleaning_fee || 0),
            effective_taxes: Number(calcRow.effective_taxes || 0),
            service_fee: Number(calcRow.service_fee),
            total_price: Number(calcRow.total_price),
          }
        : null;

      const cancellationInfo = await calculateCancellationInfo(
        bookingId,
        checkInDate,
        checkOutDate,
        totalPrice,
        pricePerNight,
        cancellationPolicy,
        status,
        undefined,
        effectivePricePerNightOverride,
        propertyStoredCalc
      );

      if (!cancellationInfo || !cancellationInfo.canCancel) {
        Alert.alert(
          'Annulation impossible',
          'Cette réservation ne peut pas être annulée selon la politique de la propriété.'
        );
        return { success: false };
      }

      const { data: payRow } = await supabase
        .from('bookings')
        .select('payment_method, total_price')
        .eq('id', bookingId)
        .maybeSingle();

      const bookingTotalForCancel = Math.max(0, Number(payRow?.total_price) || totalPrice);
      let guestRefund = cancellationInfo.refundAmount ?? 0;
      const pmPre = payRow?.payment_method;
      const guestPaidPlatformPre = pmPre === 'card' || pmPre === 'wave';
      if (
        !guestPaidPlatformPre &&
        pmPre &&
        guestRefund > 0 &&
        status !== 'pending'
      ) {
        const { data: commRow } = await supabase
          .from('platform_commission_due')
          .select('status, amount_due')
          .eq('booking_id', bookingId)
          .eq('booking_type', 'property')
          .maybeSingle();
        if (commRow?.status === 'paid') {
          const commAmt = Math.round(Number(commRow.amount_due || 0));
          guestRefund = Math.max(0, guestRefund - commAmt);
        }
      }
      // Espèces / virement : l’argent est remis à l’hôte à l’arrivée — avant le check-in, aucun remboursement à traiter.
      if (
        !guestPaidPlatformPre &&
        pmPre &&
        status !== 'pending' &&
        !hostHasReceivedGuestCashProperty({
          check_in_date: checkInDate,
          payment_method: pmPre,
        })
      ) {
        guestRefund = 0;
      }
      const penaltyAmount = Math.max(0, bookingTotalForCancel - guestRefund);

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
      // l'hôte doit reverser à AkwaHome au prorata de ce qu'il a réellement perçu (host_net),
      // jamais plus que ce montant — ne pas utiliser total_price comme proxy du net hôte.
      const refundAmount = guestRefund;
      const guestTotalPaid = Math.max(0, Number(data?.total_price) || 0);
      let hostNetResolved = Math.max(0, Number(data?.host_net_amount) || 0);
      if (hostNetResolved <= 0 && calcRow?.host_net_amount != null && Number(calcRow.host_net_amount) > 0) {
        hostNetResolved = Math.round(Number(calcRow.host_net_amount));
      }
      let hostReimbursementAmount = 0;
      if (refundAmount > 0 && guestTotalPaid > 0 && hostNetResolved > 0) {
        hostReimbursementAmount = Math.round((refundAmount / guestTotalPaid) * hostNetResolved);
        hostReimbursementAmount = Math.min(hostNetResolved, Math.max(0, hostReimbursementAmount));
      } else if (refundAmount > 0 && guestTotalPaid > 0 && hostNetResolved <= 0) {
        console.warn(
          '[cancelBooking] host_net_amount absent : impossible de créer host_refund_due sans montant net hôte fiable',
          { bookingId },
        );
      }
      const guestPaidViaPlatform = data?.payment_method === 'card' || data?.payment_method === 'wave';
      const hostHasReceivedMoney = data?.check_in_date
        ? new Date(data.check_in_date).getTime() + 48 * 60 * 60 * 1000 <= Date.now()
        : false;

      if (
        refundAmount > 0 &&
        guestPaidViaPlatform &&
        hostHasReceivedMoney &&
        data?.properties?.host_id &&
        hostReimbursementAmount > 0
      ) {
        try {
          const { data: existingDue } = await supabase
            .from('host_refund_due')
            .select('id')
            .eq('booking_type', 'property')
            .eq('booking_id', bookingId)
            .eq('status', 'pending')
            .maybeSingle();
          if (!existingDue?.id) {
            const { error: insertErr } = await supabase.from('host_refund_due').insert({
              host_id: data.properties.host_id,
              booking_type: 'property',
              booking_id: bookingId,
              amount_due: hostReimbursementAmount,
              status: 'pending',
              penalty_tracking_id: null,
            });
            if (insertErr) {
              console.error('Erreur création host_refund_due (annulation voyageur):', insertErr);
            }
          }
        } catch (e) {
          console.error('Erreur création host_refund_due (annulation voyageur):', e);
        }
      }

      // Envoyer les emails de notification (avec indication si hôte doit rembourser directement en cas de paiement espèces)
      const hostMustReimburseDirectly = refundAmount > 0 && !guestPaidViaPlatform;
      await sendCancellationEmails(data, penaltyAmount, refundAmount, hostMustReimburseDirectly);

      Alert.alert('Réservation annulée');

      return { success: true, data, penaltyAmount, refundAmount: guestRefund };

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
  ): { penalty: number; refundAmount: number; description: string; breakdown?: { totalDays: number; daysElapsed?: number; remainingDays: number; netBase: number; penaltyRatePercent: number; appliedRule: string } } => {
    const totalNights = Math.max(1, rentalDays);
    const netBase = ownerNetAmountOption ?? basePrice;
    if (status === 'pending') {
      return {
        penalty: 0,
        refundAmount: totalPrice,
        description: 'Aucune pénalité (demande en attente)',
        breakdown: {
          totalDays: totalNights,
          remainingDays: totalNights,
          netBase,
          penaltyRatePercent: 0,
          appliedRule: 'Demande en attente : remboursement intégral',
        },
      };
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isInProgress = start <= now && now <= end;

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
        breakdown: {
          totalDays: totalNights,
          daysElapsed: nightsElapsed,
          remainingDays: remainingNights,
          netBase: Math.round(applicableNet),
          penaltyRatePercent: 40,
          appliedRule: `40% du montant net des ${remainingNights} jour(s) restant(s)`,
        },
      };
    }
    if (daysUntilStart > 5) {
      return {
        penalty: 0,
        refundAmount: totalPrice,
        description: 'Annulation gratuite (plus de 5 jours avant le début). Le locataire sera remboursé intégralement.',
        breakdown: {
          totalDays: totalNights,
          remainingDays: totalNights,
          netBase,
          penaltyRatePercent: 0,
          appliedRule: 'Plus de 5 jours avant : aucune pénalité',
        },
      };
    }
    if (daysUntilStart > 2 && daysUntilStart <= 5) {
      const penalty = Math.round(netBase * 0.20);
      return {
        penalty,
        refundAmount: totalPrice,
        description: 'Annulation entre 5 et 2 jours avant le début (20% de pénalité sur montant net). Le locataire sera remboursé intégralement.',
        breakdown: {
          totalDays: totalNights,
          remainingDays: totalNights,
          netBase,
          penaltyRatePercent: 20,
          appliedRule: 'Entre 5 et 2 jours avant : 20% du montant net',
        },
      };
    }
    const penalty = Math.round(netBase * 0.40);
    return {
      penalty,
      refundAmount: totalPrice,
      description: 'Annulation 2 jours ou moins avant le début (40% de pénalité sur montant net). Le locataire sera remboursé intégralement.',
      breakdown: {
        totalDays: totalNights,
        remainingDays: totalNights,
        netBase,
        penaltyRatePercent: 40,
        appliedRule: '2 jours ou moins avant : 40% du montant net',
      },
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
