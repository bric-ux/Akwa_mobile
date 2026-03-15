import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HostBooking } from '../types';
import { useHostBookings } from '../hooks/useHostBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { formatPrice } from '../utils/priceCalculator';
import { useCurrency } from '../hooks/useCurrency';
import { createCheckoutSession, checkPaymentStatus } from '../services/cardPaymentService';

interface HostCancellationDialogProps {
  visible: boolean;
  onClose: () => void;
  booking: HostBooking | null;
  onCancelled: () => void;
}

const hostCancellationReasons = [
  { value: 'property_unavailable', label: 'Propriété non disponible' },
  { value: 'maintenance', label: 'Travaux de maintenance' },
  { value: 'emergency', label: 'Urgence' },
  { value: 'double_booking', label: 'Double réservation' },
  { value: 'property_damage', label: 'Dommages à la propriété' },
  { value: 'legal_issue', label: 'Problème légal' },
  { value: 'family_emergency', label: 'Urgence familiale' },
  { value: 'other', label: 'Autre raison' }
];

const STRIPE_PENDING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const HostCancellationDialog: React.FC<HostCancellationDialogProps> = ({
  visible,
  onClose,
  booking,
  onCancelled,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reason, setReason] = useState('');
  /** Si pénalité > 0 : true = régler remboursement + pénalité en un paiement ; false = remboursement seul (pénalité déduite plus tard) */
  const [includePenaltyInPayment, setIncludePenaltyInPayment] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [stripeCheckoutOpened, setStripeCheckoutOpened] = useState(false);
  const [pendingPenaltyId, setPendingPenaltyId] = useState<string | null>(null);
  const [pendingStripeSessionId, setPendingStripeSessionId] = useState<string | null>(null);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [checkingPenaltyStatus, setCheckingPenaltyStatus] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pendingCancellationReasonRef = useRef<string | null>(null);
  const { user } = useAuth();
  const { cancelBooking, loading } = useHostBookings();
  const { currency, rates } = useCurrency();

  // Pénalité à partir de 5 jours avant le début du séjour ; séjour en cours : 40% sur nuitées non consommées
  const calculateHostPenalty = (b: HostBooking) => {
    const checkInDate = new Date(b.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    const checkOutDate = b.check_out_date ? new Date(b.check_out_date) : null;
    if (checkOutDate) checkOutDate.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const totalNights = checkOutDate
      ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
      : 1;
    const baseReservationAmount = (b.properties?.price_per_night || 0) * totalNights;
    const isInProgress = checkOutDate && checkInDate <= now && now <= checkOutDate;

    let penalty = 0;
    let penaltyDescription = '';

    if (isInProgress) {
      const nightsElapsed = Math.max(0, Math.ceil((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingNights = Math.max(0, totalNights - nightsElapsed);
      const remainingBaseAmount = remainingNights * (b.properties?.price_per_night || 0);
      penalty = Math.round(remainingBaseAmount * 0.40);
      penaltyDescription = 'Annulation en cours de séjour : 40% des nuitées non consommées (remboursement intégral au voyageur)';
    } else if (daysUntilCheckIn > 5) {
      penalty = 0;
      penaltyDescription = 'Annulation gratuite (plus de 5 jours avant l\'arrivée)';
    } else if (daysUntilCheckIn > 2 && daysUntilCheckIn <= 5) {
      penalty = Math.round(baseReservationAmount * 0.20);
      penaltyDescription = 'Annulation entre 5 et 2 jours avant l\'arrivée (20% du montant)';
    } else {
      penalty = Math.round(baseReservationAmount * 0.40);
      penaltyDescription = 'Annulation 2 jours ou moins avant l\'arrivée (40% du montant)';
    }

    return { penalty, penaltyDescription, isWithin48Hours: hoursUntilCheckIn <= 48 };
  };

  const penaltyResult = booking ? calculateHostPenalty(booking) : { penalty: 0, penaltyDescription: '', isWithin48Hours: false };
  const { penalty: penaltyAmount, penaltyDescription } = penaltyResult;

  /** L'hôte reçoit l'argent 48h après le début du séjour. Si pas encore perçu, c'est AkwaHome qui rembourse → on ne demande pas le remboursement à l'hôte. */
  const hostHasReceivedMoney = booking?.check_in_date
    ? new Date(booking.check_in_date).getTime() + 48 * 60 * 60 * 1000 <= Date.now()
    : false;

  const guestName = booking?.guest_profile
    ? `${booking.guest_profile.first_name || ''} ${booking.guest_profile.last_name || ''}`.trim()
    : 'le voyageur';

  /** Carte obligatoire pour le remboursement. Pénalité : incluse dans le paiement (card) ou déduction ultérieure (deduct_from_next_booking). */
  const effectivePenaltyMethod = (penaltyAmount > 0 && !includePenaltyInPayment) ? 'deduct_from_next_booking' : 'card';
  const canConfirmPenaltyPayment = true; // Remboursement toujours par carte

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
    if (!pendingPenaltyId || !booking) return;
    setCheckingPenaltyStatus(true);
    const paid = await checkPenaltyPaymentStatus(pendingPenaltyId, pendingStripeSessionId);
    setCheckingPenaltyStatus(false);
    if (paid) {
      const reasonToUse = pendingCancellationReasonRef.current || '[Annulé par l\'hôte]';
      const result = await cancelBooking(booking.id, reasonToUse, 'card', pendingPenaltyId);
      resetPendingStripeState();
      pendingCancellationReasonRef.current = null;
      if (result.success) {
        onCancelled();
        onClose();
        setSelectedReason('');
        setReason('');
        setIncludePenaltyInPayment(true);
        Alert.alert('Succès', 'La réservation a été annulée et le paiement a été effectué.');
      } else {
        Alert.alert('Erreur', 'Paiement reçu mais l\'annulation n\'a pas pu être enregistrée. Contactez le support.');
      }
    }
  }, [booking, pendingPenaltyId, pendingStripeSessionId, checkPenaltyPaymentStatus, cancelBooking, resetPendingStripeState, onCancelled, onClose]);

  useEffect(() => {
    if (!visible) {
      resetPendingStripeState();
      pendingCancellationReasonRef.current = null;
    }
  }, [visible, resetPendingStripeState]);

  useEffect(() => {
    if (!visible || !stripeCheckoutOpened || !pendingPenaltyId || !booking) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const paid = await checkPenaltyPaymentStatus(pendingPenaltyId, pendingStripeSessionId);
      if (cancelled) return;
      if (paid) {
        const reasonToUse = pendingCancellationReasonRef.current || '[Annulé par l\'hôte]';
        const result = await cancelBooking(booking.id, reasonToUse, 'card', pendingPenaltyId);
        if (cancelled) return;
        resetPendingStripeState();
        pendingCancellationReasonRef.current = null;
        if (result.success) {
          onCancelled();
          onClose();
          setSelectedReason('');
          setReason('');
          setIncludePenaltyInPayment(true);
          Alert.alert('Succès', 'La réservation a été annulée et le paiement a été effectué.');
        } else {
          Alert.alert('Erreur', 'Paiement reçu mais l\'annulation n\'a pas pu être enregistrée. Contactez le support.');
        }
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, stripeCheckoutOpened, pendingPenaltyId, pendingStripeSessionId, booking, checkPenaltyPaymentStatus, cancelBooking, resetPendingStripeState, onCancelled, onClose]);

  useEffect(() => {
    if (!stripeCheckoutOpened || !pendingStripeStartedAt) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - pendingStripeStartedAt;
      const remainingMs = Math.max(0, STRIPE_PENDING_TIMEOUT_MS - elapsed);
      setStripeTimeLeftSec(Math.floor(remainingMs / 1000));
      if (remainingMs <= 0) {
        resetPendingStripeState();
        Alert.alert('Paiement expiré', 'Le délai de paiement est dépassé. Remboursement et pénalité restent à régler (contactez le support ou Remboursements & Pénalités).');
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

  const handleCancel = async () => {
    if (!selectedReason) {
      Alert.alert('Erreur', 'Veuillez sélectionner une cause d\'annulation');
      return;
    }

    setIsConfirming(true);

    const reasonLabel = hostCancellationReasons.find(r => r.value === selectedReason)?.label || selectedReason;
    const fullReason = reason.trim()
      ? `[Annulé par l'hôte] ${reasonLabel}: ${reason.trim()}`
      : `[Annulé par l'hôte] ${reasonLabel}`;

    const refundAmount = booking.total_price ?? 0;
    const mustPayRefund = hostHasReceivedMoney && refundAmount > 0;
    const mustPayPenaltyNow = penaltyAmount > 0 && includePenaltyInPayment;
    const needPaymentFirst = mustPayRefund || mustPayPenaltyNow;

    if (needPaymentFirst && user) {
      // Flux paiement d'abord : créer penalty_tracking, ouvrir Stripe. L'annulation sera faite après confirmation du paiement.
      try {
        const { data: penaltyRow, error: penaltyErr } = await supabase
          .from('penalty_tracking')
          .insert({
            booking_id: booking.id,
            host_id: user.id,
            guest_id: booking.guest_id,
            penalty_amount: penaltyAmount,
            penalty_type: 'host_cancellation',
            payment_method: 'card',
            status: 'pending',
          })
          .select('id')
          .single();

        if (penaltyErr || !penaltyRow?.id) {
          setIsConfirming(false);
          Alert.alert('Erreur', penaltyErr?.message || 'Impossible de préparer le paiement.');
          return;
        }

        const amountToCharge = mustPayRefund
          ? Math.round(refundAmount + (includePenaltyInPayment ? penaltyAmount : 0))
          : Math.round(penaltyAmount);

        pendingCancellationReasonRef.current = fullReason;
        setStripeCheckoutOpened(true);
        setPendingPenaltyId(penaltyRow.id);
        setIsConfirming(false);

        const amountNum = Number(amountToCharge);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          setIsConfirming(false);
          Alert.alert('Erreur', 'Montant invalide pour le paiement.');
          return;
        }
        const body: Record<string, unknown> = {
          payment_type: 'penalty',
          penalty_tracking_id: penaltyRow.id,
          amount: amountNum,
          refund_amount_xof: mustPayRefund ? refundAmount : 0,
          property_title: mustPayRefund
            ? (includePenaltyInPayment && penaltyAmount > 0 ? 'Remboursement voyageur + Pénalité - Annulation AkwaHome' : 'Remboursement voyageur - Annulation AkwaHome')
            : 'Pénalité annulation - AkwaHome',
          return_to_app: true,
          app_scheme: 'akwahomemobile',
          client: 'mobile',
          booking_type: 'property',
        };
        if (currency === 'EUR' && rates.EUR && rates.EUR > 0) {
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
        setIsConfirming(false);
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement');
        resetPendingStripeState();
      }
      return;
    }

    // Pas de paiement carte : annulation immédiate (remboursement AkwaHome et/ou pénalité en déduction).
    const result = await cancelBooking(booking.id, fullReason, effectivePenaltyMethod as 'deduct_from_next_booking' | 'pay_directly' | 'card' | undefined);

    if (result.success) {
      onCancelled();
      onClose();
      setSelectedReason('');
      setReason('');
      setIncludePenaltyInPayment(true);
      Alert.alert('Succès', 'La réservation a été annulée');
    } else {
      Alert.alert('Erreur', 'Impossible d\'annuler la réservation');
    }

    setIsConfirming(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Annuler la réservation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {stripeCheckoutOpened && pendingPenaltyId ? (
              <View style={styles.pendingCard}>
                <ActivityIndicator size="small" color="#e67e22" />
                <Text style={styles.pendingTitle}>Paiement en attente</Text>
                <Text style={styles.pendingText}>
                  Revenez dans l'app après avoir terminé le paiement {hostHasReceivedMoney ? '(remboursement voyageur + pénalité)' : '(pénalité)'}.
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
                      'Si vous avez déjà payé, la réservation sera mise à jour sous peu. Sinon, le remboursement et la pénalité restent à régler.',
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
            ) : (
              <>
            {/* Informations de la réservation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>
              <Text style={styles.infoText}>Propriété: {booking.properties?.title || '-'}</Text>
              <Text style={styles.infoText}>Voyageur: {guestName}</Text>
              <Text style={styles.infoText}>
                Arrivée: {new Date(booking.check_in_date).toLocaleDateString('fr-FR')}
              </Text>
              <Text style={styles.infoText}>
                Prix total: {formatPrice(booking.total_price)}
              </Text>
            </View>

            {/* Alerte de pénalité */}
            {penaltyAmount > 0 ? (
              <View style={styles.penaltyAlert}>
                <Ionicons name="alert-circle" size={20} color="#f59e0b" />
                <View style={styles.penaltyAlertContent}>
                  <Text style={styles.penaltyAlertTitle}>Pénalité applicable</Text>
                  <Text style={styles.penaltyAlertText}>{penaltyDescription}</Text>
                  <Text style={styles.penaltyAmount}>
                    Vous devrez payer une pénalité de {formatPrice(penaltyAmount)} à Akwahome.
                  </Text>
                  <Text style={styles.penaltyNote}>
                    Le voyageur sera intégralement remboursé ({formatPrice(booking.total_price)}).
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.noPenaltyAlert}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <View style={styles.penaltyAlertContent}>
                  <Text style={styles.noPenaltyTitle}>Annulation sans pénalité</Text>
                  <Text style={styles.penaltyAlertText}>{penaltyDescription}</Text>
                  <Text style={styles.penaltyNote}>
                    Le voyageur sera intégralement remboursé.
                  </Text>
                </View>
              </View>
            )}

            {/* Détails financiers */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Détails financiers</Text>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix total de la réservation</Text>
                <Text style={styles.financialValue}>{formatPrice(booking.total_price)}</Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Remboursement au voyageur</Text>
                <Text style={[styles.financialValue, styles.refundText]}>
                  {formatPrice(booking.total_price)}
                </Text>
              </View>
              {!hostHasReceivedMoney && (
                <Text style={[styles.penaltyInfo, { marginTop: 8 }]}>
                  Le remboursement sera effectué par AkwaHome.
                </Text>
              )}
              {hostHasReceivedMoney && (
                <Text style={[styles.penaltyInfo, { marginTop: 8 }]}>
                  Vous avez déjà perçu ce montant. Vous devrez le rembourser au voyageur par carte (voir ci-dessous).
                </Text>
              )}
              {penaltyAmount > 0 && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>Pénalité à payer à Akwahome</Text>
                    <Text style={[styles.financialValue, styles.penaltyText]}>
                      {formatPrice(penaltyAmount)}
                    </Text>
                  </View>
                  <Text style={styles.penaltyInfo}>
                    Cette pénalité est distincte du remboursement au voyageur. Elle doit être payée à Akwahome.
                  </Text>
                </>
              )}
            </View>

            {/* Raison de l'annulation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cause de l'annulation *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reasonsContainer}>
                {hostCancellationReasons.map((reasonOption) => (
                  <TouchableOpacity
                    key={reasonOption.value}
                    style={[
                      styles.reasonChip,
                      selectedReason === reasonOption.value && styles.reasonChipSelected
                    ]}
                    onPress={() => setSelectedReason(reasonOption.value)}
                  >
                    <Text style={[
                      styles.reasonChipText,
                      selectedReason === reasonOption.value && styles.reasonChipTextSelected
                    ]}>
                      {reasonOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {selectedReason && (
                <View style={styles.additionalReasonContainer}>
                  <Text style={styles.additionalReasonLabel}>Détails supplémentaires (optionnel)</Text>
                  <TextInput
                    style={styles.additionalReasonInput}
                    placeholder="Ajoutez des détails sur votre annulation..."
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Paiement : remboursement (si hôte a déjà perçu) + pénalité optionnelle */}
              <View style={styles.paymentMethodContainer}>
                {hostHasReceivedMoney ? (
                  <>
                    <Text style={styles.paymentMethodTitle}>
                      Remboursement obligatoire
                    </Text>
                    <View style={styles.paymentMethodOption}>
                      <Ionicons name="card" size={20} color="#e67e22" />
                      <Text style={styles.paymentMethodText}>
                        Vous avez déjà perçu le montant. Le remboursement au voyageur ({formatPrice(booking.total_price ?? 0)}) s'effectue obligatoirement par carte bancaire (Stripe).
                      </Text>
                    </View>
                    {penaltyAmount > 0 && (
                      <>
                        <Text style={[styles.paymentMethodTitle, { marginTop: 16, marginBottom: 8 }]}>
                          Pénalité AkwaHome — comment la régler ?
                        </Text>
                        <TouchableOpacity
                          style={[styles.paymentMethodOption, includePenaltyInPayment && styles.paymentMethodOptionSelected]}
                          onPress={() => setIncludePenaltyInPayment(true)}
                        >
                          <Ionicons
                            name={includePenaltyInPayment ? 'radio-button-on' : 'radio-button-off'}
                            size={22}
                            color={includePenaltyInPayment ? '#e67e22' : '#999'}
                          />
                          <Text style={styles.paymentMethodText}>
                            Régler la pénalité maintenant (avec le remboursement en un seul paiement par carte)
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.paymentMethodOption, !includePenaltyInPayment && styles.paymentMethodOptionSelected]}
                          onPress={() => setIncludePenaltyInPayment(false)}
                        >
                          <Ionicons
                            name={!includePenaltyInPayment ? 'radio-button-on' : 'radio-button-off'}
                            size={22}
                            color={!includePenaltyInPayment ? '#e67e22' : '#999'}
                          />
                          <Text style={styles.paymentMethodText}>
                            Laisser AkwaHome prélever la pénalité sur ma prochaine réservation
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.paymentMethodNote}>
                          {includePenaltyInPayment
                            ? `Montant à payer : remboursement + pénalité = ${formatPrice((booking.total_price ?? 0) + penaltyAmount)}.`
                            : `Vous paierez le remboursement seul (${formatPrice(booking.total_price ?? 0)}). La pénalité sera déduite de vos prochains revenus.`}
                        </Text>
                      </>
                    )}
                    {penaltyAmount === 0 && (
                      <Text style={styles.paymentMethodNote}>
                        Aucune pénalité. Vous ne réglerez que le remboursement au voyageur.
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.paymentMethodOption}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      <Text style={styles.paymentMethodText}>
                        Le remboursement au voyageur sera effectué par AkwaHome. Aucun paiement de votre part pour le remboursement.
                      </Text>
                    </View>
                    {penaltyAmount > 0 ? (
                      <>
                        <Text style={[styles.paymentMethodTitle, { marginTop: 16, marginBottom: 8 }]}>
                          Pénalité AkwaHome — comment la régler ?
                        </Text>
                        <TouchableOpacity
                          style={[styles.paymentMethodOption, includePenaltyInPayment && styles.paymentMethodOptionSelected]}
                          onPress={() => setIncludePenaltyInPayment(true)}
                        >
                          <Ionicons
                            name={includePenaltyInPayment ? 'radio-button-on' : 'radio-button-off'}
                            size={22}
                            color={includePenaltyInPayment ? '#e67e22' : '#999'}
                          />
                          <Text style={styles.paymentMethodText}>
                            Régler la pénalité maintenant par carte
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.paymentMethodOption, !includePenaltyInPayment && styles.paymentMethodOptionSelected]}
                          onPress={() => setIncludePenaltyInPayment(false)}
                        >
                          <Ionicons
                            name={!includePenaltyInPayment ? 'radio-button-on' : 'radio-button-off'}
                            size={22}
                            color={!includePenaltyInPayment ? '#e67e22' : '#999'}
                          />
                          <Text style={styles.paymentMethodText}>
                            Laisser AkwaHome prélever la pénalité sur ma prochaine réservation
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.paymentMethodNote}>
                          {includePenaltyInPayment
                            ? `Montant à payer : pénalité seule = ${formatPrice(penaltyAmount)}.`
                            : 'Aucun paiement maintenant. La pénalité sera déduite de vos prochains revenus.'}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.paymentMethodNote}>
                        Aucune pénalité. Aucun paiement à effectuer.
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelFooterButton}
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
              disabled={loading || isConfirming}
            >
              <Text style={styles.cancelFooterButtonText}>
                {stripeCheckoutOpened && pendingPenaltyId ? 'Fermer' : 'Retour'}
              </Text>
            </TouchableOpacity>
            {!(stripeCheckoutOpened && pendingPenaltyId) ? (
              <TouchableOpacity
                style={[styles.confirmButton, (!selectedReason || loading || isConfirming) && styles.confirmButtonDisabled]}
                onPress={handleCancel}
                disabled={!selectedReason || loading || isConfirming}
              >
                {loading || isConfirming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmer l'annulation</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.confirmButton, checkingPenaltyStatus && styles.confirmButtonDisabled]}
                onPress={verifyPenaltyPaymentNow}
                disabled={checkingPenaltyStatus}
              >
                {checkingPenaltyStatus ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Vérifier le paiement</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
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
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '70%',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
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
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  penaltyAlert: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    gap: 12,
  },
  noPenaltyAlert: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    gap: 12,
  },
  penaltyAlertContent: {
    flex: 1,
  },
  penaltyAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 4,
  },
  noPenaltyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  penaltyAlertText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  penaltyAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 4,
  },
  penaltyNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  refundText: {
    color: '#10b981',
  },
  penaltyText: {
    color: '#e74c3c',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  penaltyInfo: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  reasonsContainer: {
    marginBottom: 16,
  },
  reasonChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reasonChipSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#333',
  },
  reasonChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  additionalReasonContainer: {
    marginTop: 12,
  },
  additionalReasonLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  additionalReasonInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    backgroundColor: '#f9fafb',
  },
  paymentMethodContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 12,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  paymentMethodOptionSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fff7ed',
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  paymentMethodTextDisabled: {
    color: '#999',
  },
  paymentMethodOptionDisabled: {
    opacity: 0.7,
  },
  payDirectlySubOptions: {
    marginLeft: 20,
    marginTop: 8,
  },
  paymentMethodNote: {
    fontSize: 12,
    color: '#c2410c',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelFooterButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelFooterButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HostCancellationDialog;
























