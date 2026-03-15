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
  const [penaltyPaymentMethod, setPenaltyPaymentMethod] = useState<'deduct_from_next_booking' | 'pay_directly' | ''>('');
  const [payDirectlyMethod, setPayDirectlyMethod] = useState<'card' | 'wave' | ''>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [stripeCheckoutOpened, setStripeCheckoutOpened] = useState(false);
  const [pendingPenaltyId, setPendingPenaltyId] = useState<string | null>(null);
  const [pendingStripeSessionId, setPendingStripeSessionId] = useState<string | null>(null);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [checkingPenaltyStatus, setCheckingPenaltyStatus] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const { cancelBooking, loading } = useHostBookings();
  const { currency, rates } = useCurrency();

  // Calculer la pénalité selon les règles (avant début : 28j/48h ; séjour en cours : 40% sur nuitées non consommées)
  // Fonction pure pour respecter les règles des hooks : tous les hooks doivent être appelés avant tout return.
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
    } else if (hoursUntilCheckIn <= 48) {
      penalty = Math.round(baseReservationAmount * 0.40);
      penaltyDescription = 'Annulation 48h ou moins avant l\'arrivée (40% du montant)';
    } else if (daysUntilCheckIn > 2 && daysUntilCheckIn <= 28) {
      penalty = Math.round(baseReservationAmount * 0.20);
      penaltyDescription = 'Annulation entre 28 jours et 48h avant l\'arrivée (20% du montant)';
    } else if (daysUntilCheckIn > 28 && totalNights > 30) {
      penalty = 0;
      penaltyDescription = 'Annulation gratuite (réservation longue durée, plus de 28 jours avant)';
    } else if (daysUntilCheckIn > 28) {
      penalty = 0;
      penaltyDescription = 'Annulation gratuite (plus de 28 jours avant l\'arrivée)';
    } else {
      penalty = 0;
      penaltyDescription = 'Annulation gratuite';
    }

    return { penalty, penaltyDescription, isWithin48Hours: hoursUntilCheckIn <= 48 };
  };

  const penaltyResult = booking ? calculateHostPenalty(booking) : { penalty: 0, penaltyDescription: '', isWithin48Hours: false };
  const { penalty: penaltyAmount, penaltyDescription } = penaltyResult;

  const guestName = booking?.guest_profile
    ? `${booking.guest_profile.first_name || ''} ${booking.guest_profile.last_name || ''}`.trim()
    : 'le voyageur';

  const effectivePenaltyMethod = penaltyPaymentMethod === 'pay_directly' && payDirectlyMethod === 'card'
    ? 'card'
    : penaltyPaymentMethod === 'pay_directly' && payDirectlyMethod === 'wave'
    ? undefined
    : penaltyPaymentMethod || undefined;
  const canConfirmPenaltyPayment =
    penaltyAmount === 0 ||
    penaltyPaymentMethod === 'deduct_from_next_booking' ||
    (penaltyPaymentMethod === 'pay_directly' && payDirectlyMethod === 'card');

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

  const handleCancel = async () => {
    if (!selectedReason) {
      Alert.alert('Erreur', 'Veuillez sélectionner une cause d\'annulation');
      return;
    }

    if (penaltyAmount > 0 && !canConfirmPenaltyPayment) {
      Alert.alert(
        'Mode de paiement requis',
        penaltyPaymentMethod === 'pay_directly' && !payDirectlyMethod
          ? 'Veuillez choisir Carte bancaire pour régler la pénalité (Wave n\'est pas encore disponible).'
          : 'Veuillez choisir comment vous souhaitez régler la pénalité'
      );
      return;
    }

    setIsConfirming(true);

    const reasonLabel = hostCancellationReasons.find(r => r.value === selectedReason)?.label || selectedReason;
    const fullReason = reason.trim()
      ? `[Annulé par l'hôte] ${reasonLabel}: ${reason.trim()}`
      : `[Annulé par l'hôte] ${reasonLabel}`;

    const result = await cancelBooking(booking.id, fullReason, effectivePenaltyMethod as 'deduct_from_next_booking' | 'pay_directly' | 'card' | undefined);

    if (result.success) {
      if (result.penaltyTrackingId && penaltyAmount > 0) {
        setStripeCheckoutOpened(true);
        setPendingPenaltyId(result.penaltyTrackingId);
        setIsConfirming(false);
        try {
          // Un seul paiement : remboursement voyageur + pénalité Akwahome (même logique que commission)
          const refundAmount = booking.total_price ?? 0;
          const totalAmountXof = Math.round(refundAmount + penaltyAmount);
          const body: Record<string, unknown> = {
            payment_type: 'penalty',
            penalty_tracking_id: result.penaltyTrackingId,
            amount: totalAmountXof,
            refund_amount_xof: refundAmount,
            property_title: 'Remboursement voyageur + Pénalité - Annulation AkwaHome',
            return_to_app: true,
            app_scheme: 'akwahomemobile',
            client: 'mobile',
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
          Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement');
          resetPendingStripeState();
        }
        return;
      }
      onCancelled();
      onClose();
      setSelectedReason('');
      setReason('');
      setPenaltyPaymentMethod('');
      setPayDirectlyMethod('');
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
                  Revenez dans l'app après avoir terminé le paiement (remboursement voyageur + pénalité).
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

              {/* Mode de paiement de la pénalité */}
              {penaltyAmount > 0 && (
                <View style={styles.paymentMethodContainer}>
                  <Text style={styles.paymentMethodTitle}>
                    Comment souhaitez-vous régler la pénalité de {formatPrice(penaltyAmount)} ? *
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodOption,
                      penaltyPaymentMethod === 'deduct_from_next_booking' && styles.paymentMethodOptionSelected
                    ]}
                    onPress={() => { setPenaltyPaymentMethod('deduct_from_next_booking'); setPayDirectlyMethod(''); }}
                  >
                    <Ionicons 
                      name={penaltyPaymentMethod === 'deduct_from_next_booking' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={penaltyPaymentMethod === 'deduct_from_next_booking' ? '#e67e22' : '#999'} 
                    />
                    <Text style={styles.paymentMethodText}>Déduire sur ma prochaine réservation</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodOption,
                      penaltyPaymentMethod === 'pay_directly' && styles.paymentMethodOptionSelected
                    ]}
                    onPress={() => setPenaltyPaymentMethod('pay_directly')}
                  >
                    <Ionicons 
                      name={penaltyPaymentMethod === 'pay_directly' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={penaltyPaymentMethod === 'pay_directly' ? '#e67e22' : '#999'} 
                    />
                    <Text style={styles.paymentMethodText}>Payer directement</Text>
                  </TouchableOpacity>
                  {penaltyPaymentMethod === 'pay_directly' && (
                    <View style={styles.payDirectlySubOptions}>
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodOption,
                          payDirectlyMethod === 'card' && styles.paymentMethodOptionSelected
                        ]}
                        onPress={() => setPayDirectlyMethod('card')}
                      >
                        <Ionicons 
                          name={payDirectlyMethod === 'card' ? 'radio-button-on' : 'radio-button-off'} 
                          size={20} 
                          color={payDirectlyMethod === 'card' ? '#e67e22' : '#999'} 
                        />
                        <Text style={styles.paymentMethodText}>Carte bancaire</Text>
                      </TouchableOpacity>
                      <View style={[styles.paymentMethodOption, styles.paymentMethodOptionDisabled]}>
                        <Ionicons name="radio-button-off" size={20} color="#bbb" />
                        <Text style={[styles.paymentMethodText, styles.paymentMethodTextDisabled]}>
                          Wave (non disponible)
                        </Text>
                      </View>
                    </View>
                  )}
                  <Text style={styles.paymentMethodNote}>
                    {penaltyPaymentMethod === 'deduct_from_next_booking'
                      ? 'La pénalité sera automatiquement déduite de votre prochain paiement.'
                      : penaltyPaymentMethod === 'pay_directly' && payDirectlyMethod === 'card'
                        ? 'Vous réglerez en un seul paiement : remboursement au voyageur + pénalité Akwahome. Vous serez redirigé vers le paiement sécurisé par carte.'
                        : penaltyPaymentMethod === 'pay_directly'
                          ? 'Choisissez Carte bancaire pour régler maintenant (Wave n\'est pas encore disponible).'
                          : 'Veuillez choisir un mode de paiement.'}
                  </Text>
                </View>
              )}
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
                style={[styles.confirmButton, (!selectedReason || (penaltyAmount > 0 && !canConfirmPenaltyPayment) || loading || isConfirming) && styles.confirmButtonDisabled]}
                onPress={handleCancel}
                disabled={!selectedReason || (penaltyAmount > 0 && !canConfirmPenaltyPayment) || loading || isConfirming}
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
























