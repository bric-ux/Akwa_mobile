import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VehicleBooking } from '../types';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { useBookingCancellation, CancellationInfo } from '../hooks/useBookingCancellation';
import { useCurrency } from '../hooks/useCurrency';
import { createCheckoutSession, checkPaymentStatus } from '../services/cardPaymentService';

interface VehicleCancellationModalProps {
  visible: boolean;
  onClose: () => void;
  booking: VehicleBooking | null;
  isOwner: boolean;
  onCancelled: () => void;
}

const STRIPE_PENDING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const cancellationReasons = [
  { value: 'change_plans', label: 'Changement de plans' },
  { value: 'vehicle_unavailable', label: 'Véhicule non disponible' },
  { value: 'maintenance', label: 'Maintenance du véhicule' },
  { value: 'emergency', label: 'Urgence' },
  { value: 'found_alternative', label: "J'ai trouvé une alternative" },
  { value: 'financial_reasons', label: 'Raisons financières' },
  { value: 'family_emergency', label: 'Urgence familiale' },
  { value: 'other', label: 'Autre raison' },
];

const VehicleCancellationModal: React.FC<VehicleCancellationModalProps> = ({
  visible,
  onClose,
  booking,
  isOwner,
  onCancelled,
}) => {
  const { user } = useAuth();
  const { updateBookingStatus } = useVehicleBookings();
  const { calculateCancellationInfoForVehicle, calculateVehicleOwnerCancellationPenalty } = useBookingCancellation();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [guestCancellationInfo, setGuestCancellationInfo] = useState<CancellationInfo | null>(null);
  const [loadingGuestCancellation, setLoadingGuestCancellation] = useState(false);
  const [penaltyPaymentMethod, setPenaltyPaymentMethod] = useState<'deduct_from_next_booking' | 'pay_directly' | ''>('');
  const [payDirectlyMethod, setPayDirectlyMethod] = useState<'card' | 'wave' | ''>('');
  const [stripeCheckoutOpened, setStripeCheckoutOpened] = useState(false);
  const [pendingPenaltyId, setPendingPenaltyId] = useState<string | null>(null);
  const [pendingStripeSessionId, setPendingStripeSessionId] = useState<string | null>(null);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [checkingPenaltyStatus, setCheckingPenaltyStatus] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const { currency, rates } = useCurrency();

  // Valeurs dérivées (avec garde pour booking null — tous les hooks doivent être appelés avant tout return)
  const rentalDays = booking?.rental_days ?? 0;
  const rentalHours = booking?.rental_hours ?? 0;
  const daysPrice = (booking?.daily_rate ?? 0) * rentalDays;
  const hoursPrice =
    rentalHours > 0 && booking?.vehicle?.hourly_rental_enabled && booking?.vehicle?.price_per_hour
      ? rentalHours * (booking.vehicle.price_per_hour ?? 0)
      : 0;
  const basePrice = daysPrice + hoursPrice;
  const totalPrice = booking?.total_price ?? basePrice;

  // Charger les infos d'annulation pour le locataire (mêmes règles que résidence meublée)
  useEffect(() => {
    if (!visible || !booking || isOwner) {
      setGuestCancellationInfo(null);
      return;
    }
    let cancelled = false;
    setLoadingGuestCancellation(true);
    setGuestCancellationInfo(null);
    const policy = (booking.vehicle as any)?.cancellation_policy ?? (booking as any).cancellation_policy ?? 'flexible';
    calculateCancellationInfoForVehicle(
      booking.start_date,
      booking.end_date,
      totalPrice,
      basePrice,
      Math.max(1, rentalDays),
      policy,
      booking.status
    ).then((info) => {
      if (!cancelled) setGuestCancellationInfo(info ?? null);
    }).finally(() => {
      if (!cancelled) setLoadingGuestCancellation(false);
    });
    return () => { cancelled = true; };
  }, [visible, booking?.id, isOwner, totalPrice, basePrice, rentalDays, booking?.status, booking?.start_date, booking?.end_date, calculateCancellationInfoForVehicle]);

  // Résultat affiché (utilisé seulement quand booking est non null, après le return null)
  const ownerResult =
    booking && isOwner
      ? calculateVehicleOwnerCancellationPenalty(
          booking.start_date,
          booking.end_date,
          totalPrice,
          basePrice,
          Math.max(1, rentalDays),
          booking.status
        )
      : null;

  const penalty = isOwner ? (ownerResult?.penalty ?? 0) : (guestCancellationInfo?.penaltyAmount ?? 0);
  const refundAmount = isOwner ? (ownerResult?.refundAmount ?? 0) : (guestCancellationInfo?.refundAmount ?? 0);
  const penaltyDescription = isOwner
    ? (ownerResult?.description ?? '')
    : loadingGuestCancellation
      ? 'Chargement des conditions d\'annulation...'
      : guestCancellationInfo && !guestCancellationInfo.canCancel
        ? 'Cette réservation est non remboursable. Aucun remboursement ne sera effectué.'
        : guestCancellationInfo
          ? (guestCancellationInfo.penaltyAmount && guestCancellationInfo.penaltyAmount > 0
              ? `Pénalité de ${(guestCancellationInfo.penaltyAmount ?? 0).toLocaleString()} XOF. `
              : '') +
            (booking?.status === 'pending'
              ? 'Aucune pénalité (demande en attente).'
              : `Remboursement : ${(guestCancellationInfo.refundAmount ?? 0).toLocaleString()} XOF.`)
          : '';

  const canConfirmCancellation = isOwner || !guestCancellationInfo || guestCancellationInfo.canCancel;

  const resetPendingStripeState = useCallback(() => {
    setStripeCheckoutOpened(false);
    setPendingPenaltyId(null);
    setPendingStripeSessionId(null);
    setPendingStripeStartedAt(null);
    setStripeTimeLeftSec(0);
    setLastPaymentStatus(null);
    setCheckingPenaltyStatus(false);
  }, []);

  const checkPenaltyPaymentStatus = useCallback(async (penaltyId: string, sessionId?: string | null) => {
    try {
      const result = await checkPaymentStatus({
        payment_type: 'penalty',
        penalty_tracking_id: penaltyId,
        stripe_session_id: sessionId ?? undefined,
      });
      setLastPaymentStatus(result.payment_status ?? 'pending');
      return result.is_confirmed ?? false;
    } catch {
      return false;
    }
  }, []);

  const verifyPenaltyPaymentNow = useCallback(async () => {
    if (!pendingPenaltyId) return;
    setCheckingPenaltyStatus(true);
    const paid = await checkPenaltyPaymentStatus(pendingPenaltyId, pendingStripeSessionId);
    setCheckingPenaltyStatus(false);
    if (paid) {
      resetPendingStripeState();
      onCancelled();
      onClose();
      setSelectedReason('');
      setReason('');
      setPenaltyPaymentMethod('');
      setPayDirectlyMethod('');
      Alert.alert('Succès', 'La réservation a été annulée et la pénalité a été payée.');
    }
  }, [pendingPenaltyId, pendingStripeSessionId, checkPenaltyPaymentStatus, resetPendingStripeState, onCancelled, onClose]);

  useEffect(() => {
    if (!visible) {
      resetPendingStripeState();
    }
  }, [visible, resetPendingStripeState]);

  useEffect(() => {
    if (!visible || !stripeCheckoutOpened || !pendingPenaltyId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const paid = await checkPenaltyPaymentStatus(pendingPenaltyId, pendingStripeSessionId);
      if (cancelled) return;
      if (paid) {
        resetPendingStripeState();
        onCancelled();
        onClose();
        setSelectedReason('');
        setReason('');
        setPenaltyPaymentMethod('');
        setPayDirectlyMethod('');
        Alert.alert('Succès', 'La réservation a été annulée et la pénalité a été payée.');
      }
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, stripeCheckoutOpened, pendingPenaltyId, pendingStripeSessionId, checkPenaltyPaymentStatus, resetPendingStripeState, onCancelled, onClose]);

  useEffect(() => {
    if (!stripeCheckoutOpened || !pendingStripeStartedAt) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - pendingStripeStartedAt;
      const remainingMs = Math.max(0, STRIPE_PENDING_TIMEOUT_MS - elapsed);
      setStripeTimeLeftSec(Math.floor(remainingMs / 1000));
      if (remainingMs <= 0) {
        resetPendingStripeState();
        Alert.alert('Paiement expiré', 'Le délai de paiement est dépassé. Vous pourrez régler la pénalité depuis Remboursements & Pénalités.');
        onClose();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stripeCheckoutOpened, pendingStripeStartedAt, resetPendingStripeState, onClose]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasBackground && nextState === 'active' && stripeCheckoutOpened && pendingPenaltyId) {
        setTimeout(verifyPenaltyPaymentNow, 1500);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [stripeCheckoutOpened, pendingPenaltyId, verifyPenaltyPaymentNow]);

  useEffect(() => {
    if (!visible || !pendingPenaltyId) return;
    const handleUrl = (url: string | null) => {
      if (!url?.includes('payment-success') || !pendingPenaltyId) return;
      const typeMatch = url.match(/payment_type=([^&]+)/);
      if (typeMatch?.[1] !== 'penalty') return;
      const idMatch = url.match(/penalty_tracking_id=([^&]+)/);
      const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
      if (id === pendingPenaltyId) {
        setTimeout(verifyPenaltyPaymentNow, 1000);
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [visible, pendingPenaltyId, verifyPenaltyPaymentNow]);

  if (!booking) return null;

  const isBookingCompleted = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate < today;
  };

  const bookingIsCompleted = isBookingCompleted();

  const handleCancel = async () => {
    if (bookingIsCompleted) {
      Alert.alert('Annulation impossible', 'Cette réservation est terminée et ne peut plus être annulée.');
      return;
    }

    if (!selectedReason || !user) {
      Alert.alert('Erreur', 'Veuillez sélectionner une cause d\'annulation');
      return;
    }

    if (isOwner && penalty > 0 && !penaltyPaymentMethod) {
      Alert.alert('Mode de paiement requis', 'Veuillez choisir comment vous souhaitez régler la pénalité');
      return;
    }
    if (isOwner && penalty > 0 && penaltyPaymentMethod === 'pay_directly' && !payDirectlyMethod) {
      Alert.alert(
        'Mode de paiement requis',
        "Choisissez Carte bancaire pour régler la pénalité (Wave n'est pas encore disponible)."
      );
      return;
    }

    setIsConfirming(true);

    try {
      const reasonLabel = cancellationReasons.find((r) => r.value === selectedReason)?.label || selectedReason;
      const effectivePenaltyMethod =
        penaltyPaymentMethod === 'pay_directly' && payDirectlyMethod === 'card'
          ? 'card'
          : penaltyPaymentMethod === 'pay_directly' && payDirectlyMethod === 'wave'
            ? undefined
            : penaltyPaymentMethod || undefined;
      const fullReason = reason.trim() ? `${reasonLabel}: ${reason.trim()}` : reasonLabel;

      // Récupérer les informations complètes de la réservation pour les emails
      const { data: bookingData, error: bookingFetchError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles(
            brand,
            model,
            cancellation_policy,
            owner_id
          ),
          renter:profiles!vehicle_bookings_renter_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', booking.id)
        .single();

      if (bookingFetchError) {
        throw bookingFetchError;
      }

      // Mettre à jour le statut via Supabase directement
      const { error: updateError } = await supabase
        .from('vehicle_bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: `[Annulé par ${isOwner ? 'le propriétaire' : 'le locataire'}] ${fullReason}`,
          cancellation_penalty: penalty,
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      // Envoyer les emails de notification
      const vehicleTitle = bookingData?.vehicle
        ? `${bookingData.vehicle.brand || ''} ${bookingData.vehicle.model || ''}`.trim()
        : 'Véhicule';
      const startDate = booking.start_date;
      const endDate = booking.end_date;
      const startDateTime = booking.start_datetime || null;
      const endDateTime = booking.end_datetime || null;
      const renterEmail = bookingData?.renter?.email || user?.email;

      const invokeSendEmail = async (body: { type: string; to: string; data: Record<string, unknown> }) => {
        const { data: res, error } = await supabase.functions.invoke('send-email', { body });
        if (error) {
          console.warn('[VehicleCancellationModal] send-email erreur:', body.type, error);
          return false;
        }
        if (res?.error) {
          console.warn('[VehicleCancellationModal] send-email retour:', body.type, res.error);
          return false;
        }
        return true;
      };

      try {
        if (isOwner && renterEmail) {
          await invokeSendEmail({
            type: 'vehicle_booking_cancelled_by_owner',
            to: renterEmail,
            data: {
              renterName: bookingData?.renter?.first_name || 'Cher client',
              vehicleTitle,
              startDate,
              endDate,
              startDateTime,
              endDateTime,
              reason: fullReason,
              refundAmount,
            },
          });
        } else if (!isOwner) {
          if (bookingData?.vehicle?.owner_id) {
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('email, first_name')
              .eq('user_id', bookingData.vehicle.owner_id)
              .single();
            if (ownerProfile?.email) {
              await invokeSendEmail({
                type: 'vehicle_booking_cancelled_by_renter',
                to: ownerProfile.email,
                data: {
                  ownerName: ownerProfile.first_name || 'Cher propriétaire',
                  vehicleTitle,
                  startDate,
                  endDate,
                  startDateTime,
                  endDateTime,
                  reason: fullReason,
                  penaltyAmount: penalty,
                },
              });
            }
          }
          if (renterEmail) {
            await invokeSendEmail({
              type: 'vehicle_booking_cancelled_by_renter_confirmation',
              to: renterEmail,
              data: {
                renterName: bookingData?.renter?.first_name || 'Cher client',
                vehicleTitle,
                startDate,
                endDate,
                startDateTime,
                endDateTime,
                reason: fullReason,
                penaltyAmount: penalty,
                refundAmount,
              },
            });
          }
        }

        await invokeSendEmail({
          type: 'vehicle_booking_cancelled_admin',
          to: 'contact@akwahome.com',
          data: {
            bookingId: booking.id,
            vehicleTitle,
            cancelledBy: isOwner ? 'propriétaire' : 'locataire',
            renterName: bookingData?.renter ? `${bookingData.renter.first_name || ''} ${bookingData.renter.last_name || ''}`.trim() : 'N/A',
            startDate,
            endDate,
            startDateTime,
            endDateTime,
            reason: fullReason,
            penaltyAmount: penalty,
            totalPrice: booking.total_price,
          },
        });
      } catch (emailError) {
        console.warn('[VehicleCancellationModal] Erreur envoi email annulation:', emailError);
      }

      // Propriétaire avec pénalité : créer penalty_tracking et éventuellement rediriger vers Stripe (même principe que hôte résidence)
      if (isOwner && penalty > 0 && booking.vehicle?.owner_id && effectivePenaltyMethod) {
        const { data: bookingRow } = await supabase
          .from('vehicle_bookings')
          .select('renter_id')
          .eq('id', booking.id)
          .single();

        if (bookingRow?.renter_id) {
          const { data: insertedPenalty, error: penaltyErr } = await supabase
            .from('penalty_tracking')
            .insert({
              booking_id: null,
              vehicle_booking_id: booking.id,
              host_id: booking.vehicle.owner_id,
              guest_id: bookingRow.renter_id,
              penalty_amount: penalty,
              penalty_type: 'host_cancellation',
              status: 'pending',
              payment_method: effectivePenaltyMethod === 'card' ? 'pay_directly' : effectivePenaltyMethod,
              service_type: 'vehicle',
            })
            .select('id')
            .single();

          if (!penaltyErr && insertedPenalty?.id && effectivePenaltyMethod === 'card') {
            setStripeCheckoutOpened(true);
            setPendingPenaltyId(insertedPenalty.id);
            setIsConfirming(false);
            try {
              // Un seul paiement : remboursement locataire + pénalité (même logique que résidence)
              const totalAmountXof = Math.round(refundAmount + penalty);
              const body: Record<string, unknown> = {
                payment_type: 'penalty',
                penalty_tracking_id: insertedPenalty.id,
                amount: totalAmountXof,
                refund_amount_xof: refundAmount,
                property_title: 'Remboursement locataire + Pénalité - Annulation véhicule AkwaHome',
                return_to_app: true,
                app_scheme: 'akwahomemobile',
                client: 'mobile',
              };
              if (currency === 'EUR' && rates?.EUR && rates.EUR > 0) {
                body.currency = 'eur';
                body.rate = rates.EUR;
              }
              const checkoutResult = await createCheckoutSession(body);
              if (checkoutResult.session_id) {
                setPendingStripeSessionId(checkoutResult.session_id);
                setPendingStripeStartedAt(Date.now());
              }
              await Linking.openURL(checkoutResult.url);
            } catch (e: unknown) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement');
              resetPendingStripeState();
            }
            return;
          }
        }
      }

      Alert.alert('Succès', 'La réservation a été annulée avec succès.');
      onCancelled();
      onClose();
      setSelectedReason('');
      setReason('');
      setPenaltyPaymentMethod('');
      setPayDirectlyMethod('');
    } catch (error: any) {
      console.error('Erreur annulation:', error);
      Alert.alert('Erreur', error.message || "Impossible d'annuler la réservation");
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
              <Text style={styles.headerTitle}>Annuler la réservation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {stripeCheckoutOpened && pendingPenaltyId ? (
              <View style={styles.pendingCard}>
                <ActivityIndicator size="small" color="#e67e22" />
                <Text style={styles.pendingTitle}>Paiement en attente</Text>
                <Text style={styles.pendingText}>
                  Revenez dans l'app après avoir terminé le paiement (remboursement locataire + pénalité).
                </Text>
                {lastPaymentStatus != null && (
                  <Text style={styles.pendingStatus}>Statut : {lastPaymentStatus}</Text>
                )}
                {stripeTimeLeftSec > 0 && (
                  <Text style={styles.pendingTimer}>
                    Expiration dans {Math.floor(stripeTimeLeftSec / 60)} min {stripeTimeLeftSec % 60} s
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.abandonButton}
                  onPress={() => {
                    Alert.alert(
                      'Abandonner le paiement ?',
                      'Si vous avez déjà payé, la réservation sera mise à jour sous peu. Sinon, vous pourrez régler depuis Remboursements & Pénalités.',
                      [
                        { text: 'Continuer', style: 'cancel' },
                        { text: 'Abandonner', style: 'destructive', onPress: () => { resetPendingStripeState(); onClose(); } },
                      ]
                    );
                  }}
                >
                  <Text style={styles.abandonButtonText}>Abandonner</Text>
                </TouchableOpacity>
              </View>
            ) : bookingIsCompleted ? (
              <View style={styles.warningContainer}>
                <Ionicons name="information-circle" size={48} color="#ef4444" />
                <Text style={styles.warningText}>
                  Cette réservation est terminée et ne peut plus être annulée.
                </Text>
              </View>
            ) : (
              <>
                {/* Informations */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Informations</Text>
                  {booking.status === 'pending' ? (
                    <Text style={styles.infoText}>
                      Cette demande est en attente de confirmation. L'annulation est gratuite car aucun paiement n'a encore été effectué.
                    </Text>
                  ) : !canConfirmCancellation ? (
                    <Text style={styles.infoText}>
                      {penaltyDescription}
                      {'\n\n'}
                      L'annulation de cette réservation n'est pas possible (politique non remboursable).
                    </Text>
                  ) : (
                    <Text style={styles.infoText}>
                      {penaltyDescription}
                      {'\n\n'}
                      {isOwner ? (
                        <>
                          {penalty > 0 ? (
                            <>
                              Vous serez pénalisé de {penalty.toLocaleString()} XOF.
                              {'\n'}
                              Le locataire sera remboursé intégralement de {refundAmount.toLocaleString()} XOF.
                            </>
                          ) : (
                            <>
                              Aucune pénalité ne sera appliquée.
                              {'\n'}
                              Le locataire sera remboursé intégralement de {refundAmount.toLocaleString()} XOF.
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {penalty > 0 ? (
                            <>
                              Une pénalité de {penalty.toLocaleString()} XOF sera appliquée.
                              {'\n'}
                              Le montant remboursé sera de {refundAmount.toLocaleString()} XOF.
                            </>
                          ) : (
                            <>
                              Aucune pénalité ne sera appliquée.
                              {'\n'}
                              Le montant remboursé sera de {refundAmount.toLocaleString()} XOF.
                            </>
                          )}
                        </>
                      )}
                    </Text>
                  )}
                </View>

                {/* Raison */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Raison de l'annulation *</Text>
                  {cancellationReasons.map((reasonOption) => (
                    <TouchableOpacity
                      key={reasonOption.value}
                      style={[
                        styles.reasonOption,
                        selectedReason === reasonOption.value && styles.reasonOptionSelected,
                      ]}
                      onPress={() => setSelectedReason(reasonOption.value)}
                    >
                      <View style={styles.reasonRadio}>
                        {selectedReason === reasonOption.value && (
                          <View style={styles.reasonRadioSelected} />
                        )}
                      </View>
                      <Text style={styles.reasonLabel}>{reasonOption.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Détails supplémentaires */}
                {selectedReason && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Détails supplémentaires (optionnel)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={reason}
                      onChangeText={setReason}
                      placeholder="Ajoutez des détails sur la raison de l'annulation..."
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                )}

                {/* Mode de paiement de la pénalité (propriétaire, même principe que résidence meublée) */}
                {isOwner && penalty > 0 && (
                  <View style={styles.penaltyPaymentSection}>
                    <Text style={styles.sectionTitle}>
                      Comment souhaitez-vous régler la pénalité de {penalty.toLocaleString()} XOF ? *
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.reasonOption,
                        penaltyPaymentMethod === 'deduct_from_next_booking' && styles.reasonOptionSelected,
                      ]}
                      onPress={() => {
                        setPenaltyPaymentMethod('deduct_from_next_booking');
                        setPayDirectlyMethod('');
                      }}
                    >
                      <View style={styles.reasonRadio}>
                        {penaltyPaymentMethod === 'deduct_from_next_booking' && <View style={styles.reasonRadioSelected} />}
                      </View>
                      <Text style={styles.reasonLabel}>Déduire sur ma prochaine réservation</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.reasonOption,
                        penaltyPaymentMethod === 'pay_directly' && styles.reasonOptionSelected,
                      ]}
                      onPress={() => setPenaltyPaymentMethod('pay_directly')}
                    >
                      <View style={styles.reasonRadio}>
                        {penaltyPaymentMethod === 'pay_directly' && <View style={styles.reasonRadioSelected} />}
                      </View>
                      <Text style={styles.reasonLabel}>Payer directement</Text>
                    </TouchableOpacity>
                    {penaltyPaymentMethod === 'pay_directly' && (
                      <View style={styles.payDirectlyOptions}>
                        <TouchableOpacity
                          style={[
                            styles.reasonOption,
                            payDirectlyMethod === 'card' && styles.reasonOptionSelected,
                          ]}
                          onPress={() => setPayDirectlyMethod('card')}
                        >
                          <View style={styles.reasonRadio}>
                            {payDirectlyMethod === 'card' && <View style={styles.reasonRadioSelected} />}
                          </View>
                          <Text style={styles.reasonLabel}>Carte bancaire</Text>
                        </TouchableOpacity>
                        <View style={[styles.reasonOption, styles.optionDisabled]}>
                          <View style={styles.reasonRadio} />
                          <Text style={[styles.reasonLabel, styles.labelMuted]}>Wave (non disponible)</Text>
                        </View>
                      </View>
                    )}
                    <Text style={styles.penaltyPaymentNote}>
                      {penaltyPaymentMethod === 'deduct_from_next_booking'
                        ? 'La pénalité sera automatiquement déduite de votre prochain paiement.'
                        : penaltyPaymentMethod === 'pay_directly' && payDirectlyMethod === 'card'
                          ? 'Vous réglerez en un seul paiement : remboursement au locataire + pénalité Akwahome. Vous serez redirigé vers le paiement sécurisé par carte.'
                          : penaltyPaymentMethod === 'pay_directly'
                            ? "Choisissez Carte bancaire pour régler maintenant (Wave n'est pas encore disponible)."
                            : 'Veuillez choisir un mode de paiement.'}
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          {!bookingIsCompleted && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  if (stripeCheckoutOpened && pendingPenaltyId) {
                    Alert.alert(
                      'Abandonner ?',
                      'Si vous avez déjà payé, la réservation sera mise à jour sous peu.',
                      [
                        { text: 'Rester', style: 'cancel' },
                        { text: 'Fermer', style: 'destructive', onPress: () => { resetPendingStripeState(); onClose(); } },
                      ]
                    );
                  } else {
                    onClose();
                  }
                }}
              >
                <Text style={styles.cancelButtonText}>
                  {stripeCheckoutOpened && pendingPenaltyId ? 'Fermer' : 'Annuler'}
                </Text>
              </TouchableOpacity>
              {stripeCheckoutOpened && pendingPenaltyId ? (
                <TouchableOpacity
                  style={[styles.confirmButton, checkingPenaltyStatus && styles.confirmButtonDisabled]}
                  onPress={verifyPenaltyPaymentNow}
                  disabled={checkingPenaltyStatus}
                >
                  {checkingPenaltyStatus ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="card" size={20} color="#fff" />
                      <Text style={styles.confirmButtonText}>Vérifier le paiement</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (!selectedReason ||
                      !canConfirmCancellation ||
                      (isOwner && penalty > 0 && (!penaltyPaymentMethod || (penaltyPaymentMethod === 'pay_directly' && !payDirectlyMethod)))) &&
                      styles.confirmButtonDisabled,
                  ]}
                  onPress={handleCancel}
                  disabled={
                    !selectedReason ||
                    isConfirming ||
                    !canConfirmCancellation ||
                    (isOwner && penalty > 0 && (!penaltyPaymentMethod || (penaltyPaymentMethod === 'pay_directly' && !payDirectlyMethod)))
                  }
                >
                  {isConfirming ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={styles.confirmButtonText}>Confirmer l'annulation</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  pendingCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c2410c',
    marginTop: 8,
  },
  pendingText: {
    fontSize: 14,
    color: '#9a3412',
    marginTop: 8,
    textAlign: 'center',
  },
  pendingStatus: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  pendingTimer: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 4,
  },
  abandonButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  abandonButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
  },
  warningContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  warningText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 16,
  },
  infoCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  penaltyPaymentSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  penaltyPaymentNote: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 12,
    lineHeight: 18,
  },
  payDirectlyOptions: {
    marginLeft: 16,
    marginTop: 8,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  labelMuted: {
    color: '#6b7280',
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reasonOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  reasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonRadioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  reasonLabel: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VehicleCancellationModal;

