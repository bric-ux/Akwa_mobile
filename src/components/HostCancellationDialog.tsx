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
import { useCurrency } from '../hooks/useCurrency';
import { getAmountInXOF } from '../utils/amountUtils';
import { createCheckoutSession, checkPaymentStatus } from '../services/cardPaymentService';
import { createWaveCheckoutSession, openWavePayment } from '../services/wavePaymentService';
import { calculateHostNetAmount } from '../lib/hostNetAmount';

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
  /** Si pénalité > 0 : true = régler la pénalité maintenant ; false = pénalité déduite plus tard */
  const [includePenaltyInPayment, setIncludePenaltyInPayment] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [stripeCheckoutOpened, setStripeCheckoutOpened] = useState(false);
  const [waveCheckoutOpened, setWaveCheckoutOpened] = useState(false);
  const [pendingPenaltyId, setPendingPenaltyId] = useState<string | null>(null);
  const [pendingStripeSessionId, setPendingStripeSessionId] = useState<string | null>(null);
  const [pendingWaveCheckoutToken, setPendingWaveCheckoutToken] = useState<string | null>(null);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);
  const [penaltyPaymentMethod, setPenaltyPaymentMethod] = useState<'card' | 'wave'>('card');
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [checkingPenaltyStatus, setCheckingPenaltyStatus] = useState(false);
  /** Pour espèces/virement : true si l'hôte a déjà payé la commission plateforme, false sinon, null si pas encore chargé */
  const [commissionPaidForCashBooking, setCommissionPaidForCashBooking] = useState<boolean | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pendingCancellationReasonRef = useRef<string | null>(null);
  const verifyPenaltyPaymentNowRef = useRef<() => Promise<void>>(async () => {});
  const { user } = useAuth();
  const { cancelBooking, loading } = useHostBookings();
  const { currency, rates, formatPrice } = useCurrency();

  // Pour espèces/virement : vérifier si l'hôte a déjà payé la commission plateforme
  useEffect(() => {
    if (!visible || !booking || booking.payment_method === 'card' || booking.payment_method === 'wave') {
      setCommissionPaidForCashBooking(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('platform_commission_due')
        .select('status')
        .eq('booking_id', booking.id)
        .eq('booking_type', 'property')
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setCommissionPaidForCashBooking(false);
        return;
      }
      setCommissionPaidForCashBooking(data.status === 'paid');
    })();
    return () => { cancelled = true; };
  }, [visible, booking?.id, booking?.payment_method]);

  // Normaliser une date en YYYY-MM-DD (supporte ISO et DD/MM/YYYY)
  const toYyyyMmDd = (s: string): string => {
    const trimmed = (s || '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    return trimmed;
  };

  // Pénalité à partir de 5 jours avant le début du séjour ; séjour en cours : 40% sur nuitées non consommées
  const calculateHostPenalty = (b: HostBooking) => {
    const checkInStr = toYyyyMmDd(b.check_in_date || '');
    const checkOutStr = toYyyyMmDd(b.check_out_date || '');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const checkInDate = new Date(checkInStr + 'T12:00:00');
    checkInDate.setHours(0, 0, 0, 0);
    const checkOutDate = checkOutStr ? new Date(checkOutStr + 'T12:00:00') : null;
    if (checkOutDate) checkOutDate.setHours(0, 0, 0, 0);
    const nowNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - nowNormalized.getTime()) / (1000 * 60 * 60 * 24));
    const hoursUntilCheckIn = (checkInDate.getTime() - nowNormalized.getTime()) / (1000 * 60 * 60);

    const totalNights = checkOutDate
      ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
      : 1;
    // Comparaison YYYY-MM-DD pour éviter les bugs de fuseau horaire
    const isInProgress = checkOutStr && checkInStr <= todayStr && todayStr <= checkOutStr;

    // hostNetAmount sera calculé plus bas ; ici on calcule les proportions
    let penaltyRatio = 0;
    let penaltyDescription = '';
    let refundAmount = (b.total_price ?? 0);

    if (isInProgress) {
      // Nuitées écoulées = nuits complètement consommées (floor). Ex: 21/03 10h → 6 nuits faites, 2 restantes.
        const nightsElapsed = Math.max(0, Math.floor((nowNormalized.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingNights = Math.max(0, totalNights - nightsElapsed);
      penaltyRatio = 0.40;
      penaltyDescription = remainingNights > 0
        ? 'Annulation en cours de séjour : 40% des nuitées non consommées à verser à AkwaHome. Le voyageur sera remboursé au prorata des nuitées restantes.'
        : 'Annulation en cours de séjour : 40% des nuitées non consommées à verser à AkwaHome. Aucun remboursement au voyageur (séjour entièrement consommé).';
      refundAmount = totalNights > 0 ? Math.round((remainingNights / totalNights) * (b.total_price ?? 0)) : 0;
    } else if (daysUntilCheckIn > 5) {
      penaltyRatio = 0;
      penaltyDescription = 'Annulation gratuite (plus de 5 jours avant l\'arrivée)';
    } else if (daysUntilCheckIn > 2 && daysUntilCheckIn <= 5) {
      penaltyRatio = 0.20;
      penaltyDescription = 'Annulation entre 5 et 2 jours avant l\'arrivée (20% du montant net)';
    } else {
      penaltyRatio = 0.40;
      penaltyDescription = 'Annulation 2 jours ou moins avant l\'arrivée (40% du montant net)';
    }

    return { penaltyRatio, penaltyDescription, isWithin48Hours: hoursUntilCheckIn <= 48, refundAmount, totalNights, isInProgress };
  };

  const penaltyResult = booking ? calculateHostPenalty(booking) : { penaltyRatio: 0, penaltyDescription: '', isWithin48Hours: false, refundAmount: 0, totalNights: 1, isInProgress: false };
  const { penaltyRatio, penaltyDescription, refundAmount: computedRefundAmount, totalNights, isInProgress } = penaltyResult;

  /** Le voyageur a payé via la plateforme (CB, Wave) → l'argent est passé par AkwaHome. Sinon (cash, virement) → l'hôte a reçu directement. */
  const guestPaidViaPlatform = booking?.payment_method === 'card' || booking?.payment_method === 'wave';
  /** L'hôte reçoit l'argent 48h après le début du séjour (pour paiement CB/Wave). Si pas encore perçu, c'est AkwaHome qui rembourse. */
  const hostHasReceivedMoney = booking?.check_in_date
    ? new Date(booking.check_in_date).getTime() + 48 * 60 * 60 * 1000 <= Date.now()
    : false;
  /** L'hôte doit payer le remboursement via Stripe : seulement si paiement plateforme ET hôte a déjà perçu (48h passées). Pour cash/virement : hôte rembourse le voyageur directement. */
  const mustPayRefundViaStripe = guestPaidViaPlatform && hostHasReceivedMoney && (booking?.total_price ?? 0) > 0;

  /** Montant net perçu par l'hôte = base pour pénalité et remboursement. CB/Wave: host_net_amount. Espèces: si commission payée → host_net_amount, sinon total. */
  const hostNetAmount = (() => {
    if (!booking) return 0;
    if (guestPaidViaPlatform) {
      if (booking.host_net_amount != null) return booking.host_net_amount;
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      return calculateHostNetAmount({
        pricePerNight: booking.properties?.price_per_night || 0,
        nights,
        discountAmount: booking.discount_amount ?? 0,
        cleaningFee: booking.properties?.cleaning_fee || 0,
        taxesPerNight: booking.properties?.taxes || 0,
        freeCleaningMinDays: booking.properties?.free_cleaning_min_days ?? null,
        status: booking.status || 'confirmed',
        serviceType: 'property',
      }).hostNetAmount;
    }
    // Espèces/virement : si l'hôte a payé la commission → utiliser le net (host_net_amount)
    if (commissionPaidForCashBooking === true) {
      if (booking.host_net_amount != null && booking.host_net_amount > 0) return booking.host_net_amount;
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      return calculateHostNetAmount({
        pricePerNight: booking.properties?.price_per_night || 0,
        nights,
        discountAmount: booking.discount_amount ?? 0,
        cleaningFee: booking.properties?.cleaning_fee || 0,
        taxesPerNight: booking.properties?.taxes || 0,
        freeCleaningMinDays: booking.properties?.free_cleaning_min_days ?? null,
        status: booking.status || 'confirmed',
        serviceType: 'property',
      }).hostNetAmount;
    }
    // Commission non payée ou inconnu → total
    return booking.total_price ?? 0;
  })();

  // Pénalité calculée sur le montant NET perçu par l'hôte
  const penaltyAmount = (() => {
    if (!booking || penaltyRatio <= 0 || hostNetAmount <= 0) return 0;
    const totalPriceDisplay = booking.total_price ?? 1;
    const applicableNet = isInProgress && totalNights > 0 && totalPriceDisplay > 0
      ? (computedRefundAmount / totalPriceDisplay) * hostNetAmount
      : hostNetAmount;
    return Math.round(penaltyRatio * applicableNet);
  })();

  /** Montant à reverser = net perçu (au prorata si remboursement partiel). */
  const totalPriceDisplay = booking?.total_price ?? 1;
  const amountToReverse = totalPriceDisplay > 0
    ? Math.round((computedRefundAmount / totalPriceDisplay) * hostNetAmount)
    : 0;

  const guestName = booking?.guest_profile
    ? `${booking.guest_profile.first_name || ''} ${booking.guest_profile.last_name || ''}`.trim()
    : 'le voyageur';

  /** Carte obligatoire pour le remboursement. Pénalité : incluse dans le paiement (card) ou déduction ultérieure (deduct_from_next_booking). */
  const effectivePenaltyMethod = (penaltyAmount > 0 && !includePenaltyInPayment) ? 'deduct_from_next_booking' : 'card';
  const canConfirmPenaltyPayment = true; // Remboursement toujours par carte

  const resetPendingStripeState = useCallback(() => {
    setStripeCheckoutOpened(false);
    setWaveCheckoutOpened(false);
    setPendingPenaltyId(null);
    setPendingStripeSessionId(null);
    setPendingWaveCheckoutToken(null);
    setPendingStripeStartedAt(null);
    setStripeTimeLeftSec(0);
    setLastPaymentStatus(null);
    setCheckingPenaltyStatus(false);
  }, []);

  const checkPenaltyPaymentStatus = useCallback(async (penaltyId: string, sessionId?: string | null, waveToken?: string | null) => {
    try {
      const result = await checkPaymentStatus({
        payment_type: 'penalty',
        penalty_tracking_id: penaltyId,
        stripe_session_id: sessionId ?? undefined,
        checkout_token: waveToken ?? undefined,
        wave: !!waveToken,
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
    const paid = await checkPenaltyPaymentStatus(
      pendingPenaltyId,
      pendingStripeSessionId,
      pendingWaveCheckoutToken
    );
    setCheckingPenaltyStatus(false);
    if (paid) {
      const reasonToUse = pendingCancellationReasonRef.current || '[Annulé par l\'hôte]';
      const refundToCreate = mustPayRefundViaStripe && amountToReverse > 0 ? amountToReverseXOF : undefined;
      const result = await cancelBooking(booking.id, reasonToUse, 'card', pendingPenaltyId, refundToCreate);
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
  }, [booking, pendingPenaltyId, pendingStripeSessionId, pendingWaveCheckoutToken, checkPenaltyPaymentStatus, cancelBooking, resetPendingStripeState, onCancelled, onClose]);

  verifyPenaltyPaymentNowRef.current = verifyPenaltyPaymentNow;

  useEffect(() => {
    if (!visible) {
      resetPendingStripeState();
      pendingCancellationReasonRef.current = null;
    }
  }, [visible, resetPendingStripeState]);

  useEffect(() => {
    if (!visible || (!stripeCheckoutOpened && !waveCheckoutOpened) || !pendingPenaltyId || !booking) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const paid = await checkPenaltyPaymentStatus(pendingPenaltyId, pendingStripeSessionId, pendingWaveCheckoutToken);
      if (cancelled) return;
      if (paid) {
        const reasonToUse = pendingCancellationReasonRef.current || '[Annulé par l\'hôte]';
        const refundToCreate = mustPayRefundViaStripe && amountToReverse > 0 ? amountToReverseXOF : undefined;
        const result = await cancelBooking(booking.id, reasonToUse, 'card', pendingPenaltyId, refundToCreate);
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
  }, [visible, stripeCheckoutOpened, waveCheckoutOpened, pendingPenaltyId, pendingStripeSessionId, pendingWaveCheckoutToken, booking, checkPenaltyPaymentStatus, cancelBooking, resetPendingStripeState, onCancelled, onClose]);

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
      const hasPendingPayment = (stripeCheckoutOpened || waveCheckoutOpened) && pendingPenaltyId;
      if (wasBackground && nextState === 'active' && hasPendingPayment) {
        setTimeout(() => verifyPenaltyPaymentNowRef.current(), 1500);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [stripeCheckoutOpened, waveCheckoutOpened, pendingPenaltyId]);

  useEffect(() => {
    if (!visible || !pendingPenaltyId) return;
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const typeMatch = url.match(/payment_type=([^&]+)/);
      if (typeMatch?.[1] !== 'penalty') return;
      const idMatch = url.match(/penalty_tracking_id=([^&]+)/);
      const tokenMatch = url.match(/checkout_token=([^&]+)/);
      const waveMatch = url.match(/[?&]wave=([^&]+)/);
      const isWave = waveMatch && ['1', 'true', 'yes'].includes(String(waveMatch[1]).toLowerCase());
      if (isWave && pendingWaveCheckoutToken && tokenMatch) {
        const urlToken = decodeURIComponent(tokenMatch[1]);
        if (urlToken === pendingWaveCheckoutToken) {
          setTimeout(() => verifyPenaltyPaymentNowRef.current(), 1000);
        }
      } else if (!isWave && idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        if (id === pendingPenaltyId) {
          setTimeout(() => verifyPenaltyPaymentNowRef.current(), 1000);
        }
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [visible, pendingPenaltyId, pendingWaveCheckoutToken]);

  if (!booking) return null;

  /** Montants en XOF pour affichage (convertir si booking payé en EUR/USD) */
  const pc = (booking as any).payment_currency;
  const er = (booking as any).exchange_rate;
  const totalPriceXOF = getAmountInXOF(booking.total_price ?? 0, pc, er);
  const computedRefundXOF = getAmountInXOF(computedRefundAmount, pc, er);
  const amountToReverseXOF = getAmountInXOF(amountToReverse, pc, er);
  const penaltyAmountXOF = getAmountInXOF(penaltyAmount, pc, er);

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

    const refundAmount = computedRefundAmount ?? booking.total_price ?? 0;
    const effectiveHostRefund = amountToReverse;
    const mustPayRefund = mustPayRefundViaStripe && refundAmount > 0;
    /** Popup : on ne paie que la pénalité. Le remboursement se règle dans l'onglet Remboursements. */
    const mustPayPenaltyNow = penaltyAmount > 0 && includePenaltyInPayment;
    const needPaymentFirst = mustPayPenaltyNow;

    if (needPaymentFirst && user) {
      if (penaltyPaymentMethod === 'wave' && currency !== 'XOF') {
        setIsConfirming(false);
        Alert.alert(
          'Wave : XOF requis',
          'Le paiement Wave n\'accepte que le Franc CFA (FCFA). Passez en CFA dans les paramètres ou choisissez la carte.'
        );
        return;
      }
      try {
        const paymentMethod = penaltyPaymentMethod === 'wave' ? 'wave' : 'card';
        const { data: penaltyRow, error: penaltyErr } = await supabase
          .from('penalty_tracking')
          .insert({
            booking_id: booking.id,
            host_id: user.id,
            guest_id: booking.guest_id,
            penalty_amount: penaltyAmount,
            penalty_type: 'host_cancellation',
            payment_method: paymentMethod,
            status: 'pending',
          })
          .select('id')
          .single();

        if (penaltyErr || !penaltyRow?.id) {
          setIsConfirming(false);
          Alert.alert('Erreur', penaltyErr?.message || 'Impossible de préparer le paiement.');
          return;
        }

        /** Popup : uniquement la pénalité. Le remboursement (effectiveHostRefund) se règle dans l'onglet Remboursements. */
        const amountToChargeXof = Math.round(penaltyAmount);

        pendingCancellationReasonRef.current = fullReason;
        setPendingPenaltyId(penaltyRow.id);
        setIsConfirming(false);

        const amountNum = Number(amountToChargeXof);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          setIsConfirming(false);
          Alert.alert('Erreur', 'Montant invalide pour le paiement.');
          return;
        }

        if (penaltyPaymentMethod === 'wave') {
          setWaveCheckoutOpened(true);
          const checkoutToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
          const result = await createWaveCheckoutSession({
            payment_type: 'penalty',
            penalty_tracking_id: penaltyRow.id,
            penalty_id: penaltyRow.id,
            booking_id: booking.id,
            amount: amountNum,
            property_title: 'Pénalité annulation - AkwaHome',
            checkout_token: checkoutToken,
            return_to_app: true,
            app_scheme: 'akwahomemobile',
            client: 'mobile',
            booking_type: 'property',
          });
          setPendingWaveCheckoutToken(result.checkout_token ?? checkoutToken);
          await openWavePayment(result.wave_launch_url);
        } else {
          setStripeCheckoutOpened(true);
          setPendingStripeStartedAt(Date.now());
          const body: Record<string, unknown> = {
            payment_type: 'penalty',
            booking_id: booking.id,
            penalty_tracking_id: penaltyRow.id,
            amount: amountNum,
            refund_amount_xof: 0,
            property_title: 'Pénalité annulation - AkwaHome',
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
          }
          await Linking.openURL(checkoutResult.url);
        }
      } catch (e: unknown) {
        setIsConfirming(false);
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement');
        resetPendingStripeState();
      }
      return;
    }

    // Pas de paiement carte : annulation immédiate (remboursement AkwaHome et/ou pénalité en déduction).
    const refundToCreate = mustPayRefundViaStripe && amountToReverse > 0 ? amountToReverseXOF : undefined;
    const result = await cancelBooking(booking.id, fullReason, effectivePenaltyMethod as 'deduct_from_next_booking' | 'pay_directly' | 'card' | undefined, undefined, refundToCreate);

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
            {(stripeCheckoutOpened || waveCheckoutOpened) && pendingPenaltyId ? (
              <View style={styles.pendingCard}>
                <ActivityIndicator size="small" color="#e67e22" />
                <Text style={styles.pendingTitle}>Paiement en attente</Text>
                <Text style={styles.pendingText}>
                  Revenez dans l'app après avoir terminé le paiement de la pénalité {waveCheckoutOpened ? '(Wave)' : '(carte)'}.
                  {mustPayRefundViaStripe && ' Le remboursement se règle dans l\'onglet Remboursements.'}
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
                Prix total de la réservation: {formatPrice(totalPriceXOF)}
              </Text>
              {mustPayRefundViaStripe && (
                <Text style={[styles.infoText, { fontWeight: '600', color: '#c62828', marginTop: 4 }]}>
                  Montant net à reverser (via onglet Remboursements): {formatPrice(amountToReverseXOF)}
                </Text>
              )}
            </View>

            {/* Alerte de pénalité */}
            {penaltyAmount > 0 ? (
              <View style={styles.penaltyAlert}>
                <Ionicons name="alert-circle" size={20} color="#f59e0b" />
                <View style={styles.penaltyAlertContent}>
                  <Text style={styles.penaltyAlertTitle}>Pénalité applicable</Text>
                  <Text style={styles.penaltyAlertText}>{penaltyDescription}</Text>
                  <Text style={styles.penaltyAmount}>
                    Vous devrez payer une pénalité de {formatPrice(penaltyAmountXOF)} à AkwaHome.
                  </Text>
                  <Text style={styles.penaltyNote}>
                    {computedRefundAmount > 0
                      ? `Le voyageur sera remboursé au prorata.${mustPayRefundViaStripe ? ` Le remboursement (${formatPrice(amountToReverseXOF)}) se règle dans l'onglet Remboursements.` : ''}`
                      : 'Aucun remboursement au voyageur (séjour entièrement consommé).'}
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
                    {computedRefundAmount > 0 ? 'Le voyageur sera intégralement remboursé.' : 'Aucun remboursement au voyageur (séjour entièrement consommé).'}
                  </Text>
                </View>
              </View>
            )}

            {/* Détails financiers (uniquement quand l'hôte doit reverser) */}
            {(mustPayRefundViaStripe || !guestPaidViaPlatform) && (booking?.total_price ?? 0) > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Détails financiers</Text>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix total de la réservation</Text>
                <Text style={styles.financialValue}>{formatPrice(totalPriceXOF)}</Text>
              </View>
              {mustPayRefundViaStripe && (
                <>
                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>Remboursement au voyageur</Text>
                    <Text style={[styles.financialValue, styles.refundText]}>
                      {formatPrice(computedRefundXOF)}
                    </Text>
                  </View>
                  {amountToReverse > 0 && (
                    <View style={styles.financialRow}>
                      <Text style={styles.financialLabel}>Montant net à reverser (onglet Remboursements)</Text>
                      <Text style={[styles.financialValue, styles.penaltyText]}>
                        {formatPrice(amountToReverseXOF)}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {!guestPaidViaPlatform && (
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>À rembourser au voyageur</Text>
                  <Text style={[styles.financialValue, styles.penaltyText]}>
                    {formatPrice(computedRefundXOF)}
                  </Text>
                </View>
              )}
              {penaltyAmount > 0 && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>Pénalité à payer à AkwaHome (popup)</Text>
                    <Text style={[styles.financialValue, styles.penaltyText]}>
                      {formatPrice(penaltyAmountXOF)}
                    </Text>
                  </View>
                  <Text style={styles.penaltyInfo}>
                    Cette pénalité est distincte du remboursement au voyageur. Elle doit être payée à Akwahome.
                  </Text>
                </>
              )}
            </View>
            )}

            {/* Comment le remboursement va se passer - uniquement quand l'hôte doit reverser (sinon AkwaHome rembourse, pas d'affichage montant) */}
            {(mustPayRefundViaStripe || !guestPaidViaPlatform) && (booking?.total_price ?? 0) > 0 && (
              <View style={[styles.refundProcessBox, { marginHorizontal: 16, marginBottom: 16 }]}>
                <Text style={styles.refundProcessTitle}>Comment le remboursement va se passer</Text>
                {computedRefundAmount <= 0 ? (
                  <Text style={styles.refundProcessText}>
                    Aucun remboursement au voyageur. Le séjour est entièrement consommé.
                  </Text>
                ) : !guestPaidViaPlatform ? (
                  <Text style={styles.refundProcessText}>
                    Le voyageur a payé en espèces ou par virement. Vous devez le rembourser directement ({formatPrice(computedRefundXOF)}). La plateforme ne peut pas effectuer ce remboursement.
                  </Text>
                ) : (
                  <Text style={styles.refundProcessText}>
                    Vous reversez {formatPrice(amountToReverseXOF)} (montant net) — à régler dans l'onglet Remboursements de la page Remboursements et Pénalités.
                  </Text>
                )}
              </View>
            )}
            {guestPaidViaPlatform && !hostHasReceivedMoney && (booking?.total_price ?? 0) > 0 && (
              <View style={[styles.refundProcessBox, { marginHorizontal: 16, marginBottom: 16 }]}>
                <Text style={styles.refundProcessTitle}>Comment le remboursement va se passer</Text>
                <Text style={styles.refundProcessText}>
                  Le remboursement sera effectué par AkwaHome. Aucun paiement de votre part.
                </Text>
              </View>
            )}

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

              {/* Paiement : ici uniquement la pénalité. Le remboursement se règle dans l'onglet Remboursements. */}
              <View style={styles.paymentMethodContainer}>
                {mustPayRefundViaStripe ? (
                  <>
                    <View style={styles.paymentMethodOption}>
                      <Ionicons name="information-circle" size={20} color="#0369a1" />
                      <Text style={styles.paymentMethodText}>
                        {amountToReverse > 0
                          ? `Le remboursement (${formatPrice(amountToReverseXOF)}) se règle dans l'onglet Remboursements de la page Remboursements et Pénalités. Ici vous ne réglez que la pénalité.`
                          : 'Aucun remboursement à reverser. Le séjour est entièrement consommé. Ici vous ne réglez que la pénalité.'}
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
                            Régler la pénalité maintenant (carte ou Wave)
                          </Text>
                        </TouchableOpacity>
                        {includePenaltyInPayment && (
                          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginLeft: 34 }}>
                            <TouchableOpacity
                              style={[styles.paymentMethodOption, { flex: 1 }, penaltyPaymentMethod === 'card' && styles.paymentMethodOptionSelected]}
                              onPress={() => setPenaltyPaymentMethod('card')}
                            >
                              <Ionicons name="card" size={20} color={penaltyPaymentMethod === 'card' ? '#e67e22' : '#666'} />
                              <Text style={styles.paymentMethodText}>Carte</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.paymentMethodOption, { flex: 1 }, penaltyPaymentMethod === 'wave' && styles.paymentMethodOptionSelected]}
                              onPress={() => setPenaltyPaymentMethod('wave')}
                            >
                              <Ionicons name="phone-portrait" size={20} color={penaltyPaymentMethod === 'wave' ? '#e67e22' : '#666'} />
                              <Text style={styles.paymentMethodText}>Wave</Text>
                            </TouchableOpacity>
                          </View>
                        )}
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
                            ? `Montant à payer ici : pénalité = ${formatPrice(penaltyAmountXOF)}.`
                            : 'La pénalité sera déduite de vos prochains revenus. Le remboursement reste à régler dans l\'onglet Remboursements.'}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.paymentMethodNote}>
                        {amountToReverse > 0
                          ? `Aucune pénalité. Règlez le remboursement (${formatPrice(amountToReverseXOF)}) dans l'onglet Remboursements.`
                          : 'Aucune pénalité. Aucun remboursement à reverser (séjour entièrement consommé).'}
                      </Text>
                    )}
                  </>
                ) : !guestPaidViaPlatform && (booking?.total_price ?? 0) > 0 ? (
                  <>
                    <Text style={styles.paymentMethodTitle}>
                      Remboursement au voyageur (espèces/virement)
                    </Text>
                    <View style={styles.paymentMethodOption}>
                      <Ionicons name="cash" size={20} color="#e67e22" />
                      <Text style={styles.paymentMethodText}>
                        {computedRefundAmount > 0
                          ? `Le voyageur a payé en espèces ou par virement. Vous devez le rembourser directement (${formatPrice(computedRefundXOF)}). La plateforme ne peut pas effectuer ce remboursement.`
                          : 'Aucun remboursement au voyageur. Le séjour est entièrement consommé.'}
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
                            ? `Montant à payer : pénalité = ${formatPrice(penaltyAmountXOF)}.`
                            : 'La pénalité sera déduite de vos prochains revenus.'}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.paymentMethodNote}>
                        {computedRefundAmount > 0 ? 'Aucune pénalité. Remboursez le voyageur directement.' : 'Aucune pénalité. Aucun remboursement au voyageur (séjour entièrement consommé).'}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <View style={styles.paymentMethodOption}>
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      <Text style={styles.paymentMethodText}>
                        {computedRefundAmount > 0 ? 'Le remboursement au voyageur sera effectué par AkwaHome. Aucun paiement de votre part pour le remboursement.' : 'Aucun remboursement au voyageur. Le séjour est entièrement consommé.'}
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
                            ? `Montant à payer : pénalité seule = ${formatPrice(penaltyAmountXOF)}.`
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
  refundProcessBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#c62828',
  },
  refundProcessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c62828',
    marginBottom: 6,
  },
  refundProcessText: {
    fontSize: 13,
    color: '#b71c1c',
    lineHeight: 20,
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
























