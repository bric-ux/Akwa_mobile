/**
 * Paiement du surplus de modification de réservation (véhicule).
 * Flux carte 100 % autonome : create-checkout-session → Stripe → retour app → vérif par session_id.
 * Aucun partage avec StripeReturnHandler (qui ne gère que la réservation initiale avec checkout_token).
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { createCheckoutSession, checkPaymentStatus } from '../services/cardPaymentService';
import CardPaymentSuccessView from './CardPaymentSuccessView';
import { useCurrency } from '../hooks/useCurrency';

interface VehicleModificationSurplusPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  surplusAmount: number;
  bookingId: string;
  /** Appelé après confirmation. Carte : stripeSessionId (demande créée par le webhook). Cash : pas d'argument. */
  onPaymentComplete: (stripeSessionId?: string) => void;
  /** Payload pour le draft surplus (création demande par le webhook après paiement). */
  modificationRequestPayload?: Record<string, unknown>;
  vehicleTitle?: string;
  vehicleId?: string;
  originalTotalPrice?: number;
  newTotalPrice?: number;
  priceBreakdown?: {
    daysPriceDiff?: number;
    hoursPriceDiff?: number;
    basePriceBeforeDiscountDiff?: number;
    totalBeforeDiscountDiff?: number;
    discountDiff?: number;
    basePriceAfterDiscountDiff?: number;
    serviceFeeDiff?: number;
    serviceFeeHTDiff?: number;
    serviceFeeVATDiff?: number;
  };
}

const VehicleModificationSurplusPaymentModal: React.FC<VehicleModificationSurplusPaymentModalProps> = ({
  visible,
  onClose,
  surplusAmount,
  bookingId,
  onPaymentComplete,
  modificationRequestPayload,
  vehicleTitle,
  vehicleId,
  originalTotalPrice,
  newTotalPrice,
  priceBreakdown,
}) => {
  const STRIPE_PENDING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const navigation = useNavigation();
  const { currency, rates, formatPriceForPayment } = useCurrency();
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'card' | 'paypal' | 'cash'>('card');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [pendingStripeReturn, setPendingStripeReturn] = useState(false);
  const [stripeCheckoutOpened, setStripeCheckoutOpened] = useState(false);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [checkingStripeStatus, setCheckingStripeStatus] = useState(false);
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);
  const [pendingStripeSessionId, setPendingStripeSessionId] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const bookingIdRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const checkingRef = useRef(false);

  const checkPaymentStatusFull = useCallback(async (sid?: string | null, bid?: string | null): Promise<{ is_confirmed: boolean; payment_status?: string; error?: string }> => {
    const sessionId = sid ?? pendingStripeSessionId ?? sessionIdRef.current;
    const bookId = bid ?? bookingId;
    if (!sessionId || !bookId) {
      console.log('[DEBUG][VehicleModificationSurplusModal] checkPaymentStatusFull: skip, sessionId ou bookId manquant');
      return { is_confirmed: false, error: 'Session ou réservation manquante' };
    }
    console.log('[DEBUG][VehicleModificationSurplusModal] checkPaymentStatusFull: appel API booking_id=', bookId, 'stripe_session_id=', sessionId.substring(0, 24) + '...');
    try {
      const result = await checkPaymentStatus({
        booking_id: bookId,
        booking_type: 'vehicle',
        payment_type: 'vehicle_modification_surplus',
        stripe_session_id: sessionId,
      });
      console.log('[DEBUG][VehicleModificationSurplusModal] checkPaymentStatusFull: résultat', { is_confirmed: result.is_confirmed, payment_status: result.payment_status, error: result.error });
      setLastPaymentStatus(result.payment_status ?? 'pending');
      if (result.error) return { is_confirmed: false, payment_status: result.payment_status, error: result.error };
      return { is_confirmed: result.is_confirmed, payment_status: result.payment_status };
    } catch (e) {
      return { is_confirmed: false, error: e instanceof Error ? e.message : 'Erreur de vérification' };
    }
  }, [bookingId, pendingStripeSessionId]);

  const resetPendingStripeState = useCallback(() => {
    setPendingStripeReturn(false);
    setStripeCheckoutOpened(false);
    setPendingStripeStartedAt(null);
    setStripeTimeLeftSec(0);
    setLastPaymentStatus(null);
    setCheckingStripeStatus(false);
    setPendingStripeSessionId(null);
    sessionIdRef.current = null;
    bookingIdRef.current = null;
  }, []);

  /** À l'ouverture du modal : repartir de zéro. Flux 100 % autonome (pas de partage avec StripeReturnHandler). */
  useEffect(() => {
    if (visible) {
      console.log('[DEBUG][VehicleModificationSurplusModal] Modal ouvert, reset state. bookingId:', bookingId);
      setPaymentSuccess(false);
      setPendingStripeReturn(false);
      setStripeCheckoutOpened(false);
      setPendingStripeStartedAt(null);
      setStripeTimeLeftSec(0);
      setLastPaymentStatus(null);
      setPendingStripeSessionId(null);
      sessionIdRef.current = null;
      bookingIdRef.current = null;
    }
  }, [visible, bookingId]);

  const verifyStripePaymentNow = useCallback(async () => {
    const sid = sessionIdRef.current ?? pendingStripeSessionId;
    const bid = bookingIdRef.current ?? bookingId;
    console.log('[DEBUG][VehicleModificationSurplusModal] verifyStripePaymentNow: sid=', !!sid, 'bid=', bid);
    if (!sid || !bid) return;
    if (checkingRef.current) return;
    checkingRef.current = true;
    setCheckingStripeStatus(true);
    setPendingStripeReturn(true);
    const result = await checkPaymentStatusFull(sid, bid);
    checkingRef.current = false;
    setCheckingStripeStatus(false);
    if (result.is_confirmed) {
      console.log('[DEBUG][VehicleModificationSurplusModal] verifyStripePaymentNow: CONFIRMÉ → onPaymentComplete(sessionId), puis onClose');
      resetPendingStripeState();
      setPaymentSuccess(true);
      setTimeout(() => {
        onPaymentComplete(sid ?? undefined);
        onClose();
      }, 1500);
    } else if (result.error) {
      Alert.alert(
        'Consultez vos réservations',
        'Votre paiement a peut-être déjà été enregistré. Consultez vos réservations pour vérifier, ou réessayez dans quelques secondes.'
      );
    }
  }, [pendingStripeSessionId, bookingId, checkPaymentStatusFull, resetPendingStripeState, onPaymentComplete, onClose]);

  const handleAbandonStripeOperation = useCallback(() => {
    Alert.alert(
      'Abandonner le paiement ?',
      'La demande de modification ne sera envoyée au propriétaire qu\'après paiement confirmé. Vous pourrez réessayer plus tard.',
      [
        { text: 'Continuer le paiement', style: 'cancel' },
        { text: "J'abandonne", style: 'destructive', onPress: () => { resetPendingStripeState(); onClose(); } },
      ]
    );
  }, [resetPendingStripeState, onClose]);

  useEffect(() => {
    if (!visible || !stripeCheckoutOpened) return;
    if (!pendingStripeSessionId && !sessionIdRef.current) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const sid = sessionIdRef.current ?? pendingStripeSessionId;
      const bid = bookingIdRef.current ?? bookingId;
      if (!sid || !bid) return;
      const result = await checkPaymentStatusFull(sid, bid);
      if (cancelled) return;
      if (result.is_confirmed) {
        console.log('[DEBUG][VehicleModificationSurplusModal] Poll: CONFIRMÉ → onPaymentComplete(sessionId), puis onClose');
        resetPendingStripeState();
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentComplete(sid ?? undefined);
          onClose();
        }, 1500);
      }
    };
    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, stripeCheckoutOpened, pendingStripeSessionId, bookingId, checkPaymentStatusFull, resetPendingStripeState, onPaymentComplete, onClose]);

  useEffect(() => {
    if (!stripeCheckoutOpened || !pendingStripeStartedAt) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - pendingStripeStartedAt;
      const remainingMs = Math.max(0, STRIPE_PENDING_TIMEOUT_MS - elapsed);
      setStripeTimeLeftSec(Math.floor(remainingMs / 1000));
      if (remainingMs <= 0) {
        clearInterval(timer);
        resetPendingStripeState();
        Alert.alert('Paiement expiré', 'Le délai de paiement est dépassé. Vous pourrez relancer une modification plus tard.');
        onClose();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stripeCheckoutOpened, pendingStripeStartedAt, STRIPE_PENDING_TIMEOUT_MS, resetPendingStripeState, onClose]);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasBackground && nextState === 'active' && (sessionIdRef.current || pendingStripeSessionId)) {
        verifyStripePaymentNow();
        retryTimeout = setTimeout(verifyStripePaymentNow, 2000);
      }
      appStateRef.current = nextState;
    });
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      sub.remove();
    };
  }, [pendingStripeSessionId, verifyStripePaymentNow]);

  const handlePaymentSuccessUrl = useCallback((url: string | null) => {
    if (!url) return;
    if (!url.includes('payment-success')) return;
    if (!bookingId) return;
    const bookingMatch = url.match(/booking_id=([^&]+)/);
    const urlBookingId = bookingMatch ? decodeURIComponent(bookingMatch[1]) : null;
    if (urlBookingId !== bookingId) {
      console.log('[DEBUG][VehicleModificationSurplusModal] handlePaymentSuccessUrl: booking_id URL !== modal. urlBookingId:', urlBookingId, 'modal bookingId:', bookingId);
      return;
    }
    const sessionMatch = url.match(/session_id=([^&]+)/);
    const sessionId = sessionMatch?.[1] && !sessionMatch[1].startsWith('{') ? decodeURIComponent(sessionMatch[1]) : null;
    console.log('[DEBUG][VehicleModificationSurplusModal] handlePaymentSuccessUrl: retour Stripe, booking_id OK, session_id:', sessionId ? `${sessionId.substring(0, 20)}...` : 'absent');
    setPendingStripeReturn(true);
    if (sessionId) setPendingStripeSessionId(sessionId);
  }, [bookingId]);

  useEffect(() => {
    if (!visible) return;
    Linking.getInitialURL().then(handlePaymentSuccessUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handlePaymentSuccessUrl(url));
    return () => sub.remove();
  }, [visible, handlePaymentSuccessUrl]);

  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') Linking.getInitialURL().then(handlePaymentSuccessUrl);
    });
    return () => sub.remove();
  }, [visible, handlePaymentSuccessUrl]);

  useEffect(() => {
    if (!visible) {
      setPendingStripeReturn(false);
      setStripeCheckoutOpened(false);
      setPendingStripeStartedAt(null);
      setLastPaymentStatus(null);
      setPendingStripeSessionId(null);
      sessionIdRef.current = null;
      bookingIdRef.current = null;
    }
  }, [visible]);

  const formatPrice = (price: number) => formatPriceForPayment(price);

  const validatePaymentInfo = (): boolean => {
    if (paymentMethod === 'card' || paymentMethod === 'cash') {
      return true;
    }
    if (['wave', 'orange_money', 'mtn_money', 'moov_money', 'paypal'].includes(paymentMethod)) {
      Alert.alert('Bientot disponible', 'Ce moyen de paiement sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.');
      return false;
    }
    return true;
  };

  const runStripeCheckoutSurplus = useCallback(async (convertFcfaToEur: boolean) => {
    console.log('[DEBUG][VehicleModificationSurplusModal] runStripeCheckoutSurplus: début. bookingId:', bookingId, 'amount:', surplusAmount);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('[DEBUG][VehicleModificationSurplusModal] runStripeCheckoutSurplus: session expirée');
        Alert.alert('Session expirée', 'Veuillez vous reconnecter pour payer le surplus.');
        return;
      }
      if (!modificationRequestPayload || Object.keys(modificationRequestPayload).length === 0) {
        console.log('[DEBUG][VehicleModificationSurplusModal] runStripeCheckoutSurplus: modificationRequestPayload manquant');
        Alert.alert('Erreur', 'Données de modification manquantes. Fermez et rouvrez le modal.');
        return;
      }
      const body: Record<string, unknown> = {
        booking_id: bookingId,
        amount: surplusAmount,
        property_title: vehicleTitle || 'Surplus modification véhicule',
        payment_type: 'vehicle_modification_surplus',
        booking_type: 'vehicle',
        client: 'mobile',
        return_to_app: true,
        app_scheme: 'akwahomemobile',
        modification_request: modificationRequestPayload,
      };
      if ((currency === 'EUR' && rates.EUR) || (convertFcfaToEur && rates.EUR)) {
        body.currency = 'eur';
        body.rate = rates.EUR;
      } else if (currency === 'USD' && rates.USD) {
        body.currency = 'usd';
        body.rate = rates.USD;
      }
      console.log('[DEBUG][VehicleModificationSurplusModal] runStripeCheckoutSurplus: appel createCheckoutSession...');
      const result = await createCheckoutSession(body);
      const sid = result.session_id ?? null;
      console.log('[DEBUG][VehicleModificationSurplusModal] runStripeCheckoutSurplus: createCheckoutSession OK. session_id:', sid ? `${String(sid).substring(0, 24)}...` : 'null');
      setPendingStripeSessionId(sid);
      sessionIdRef.current = sid;
      bookingIdRef.current = bookingId;
      setPendingStripeStartedAt(Date.now());
      setStripeTimeLeftSec(Math.floor(STRIPE_PENDING_TIMEOUT_MS / 1000));
      setStripeCheckoutOpened(true);
      Linking.openURL(result.url);
      console.log('[DEBUG][VehicleModificationSurplusModal] runStripeCheckoutSurplus: Linking.openURL appelé');
    } catch (e: unknown) {
      console.log('[DEBUG][VehicleModificationSurplusModal] runStripeCheckoutSurplus: ERREUR', e);
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement Stripe');
    } finally {
      setLoading(false);
    }
  }, [bookingId, surplusAmount, vehicleTitle, currency, rates.EUR, rates.USD, modificationRequestPayload]);

  const handlePayment = async () => {
    if (!validatePaymentInfo()) return;

    if (paymentMethod === 'card') {
      // En CFA (XOF) : on n'envoie pas currency/rate → Stripe débite en FCFA. En EUR : on envoie eur + rate.
      await runStripeCheckoutSurplus(currency === 'EUR');
      return;
    }

    setLoading(true);
    try {
      const getPaymentProvider = (method: string): string => {
        switch (method) {
          case 'wave': return 'wave';
          case 'orange_money': return 'orange_money';
          case 'mtn_money': return 'mtn_money';
          case 'moov_money': return 'moov_money';
          case 'card': return 'stripe';
          case 'paypal': return 'paypal';
          case 'cash': return 'manual';
          default: return 'manual';
        }
      };

      const paymentProvider = getPaymentProvider(paymentMethod);
      const paymentData: any = {
        booking_id: bookingId,
        booking_type: 'vehicle',
        amount: surplusAmount,
        payment_method: paymentMethod,
        payment_provider: paymentProvider,
      };

      const { data: paymentResult, error: paymentError } = await supabase.functions.invoke(
        'create-modification-payment',
        {
          body: paymentData,
        }
      );

      if (paymentError) {
        console.error('❌ [VehicleModificationSurplusPaymentModal] Erreur Edge Function:', paymentError);
        console.error('❌ [VehicleModificationSurplusPaymentModal] Type erreur:', typeof paymentError);
        console.error('❌ [VehicleModificationSurplusPaymentModal] Erreur complète:', JSON.stringify(paymentError, Object.getOwnPropertyNames(paymentError), 2));
        
        // Essayer d'extraire le message d'erreur depuis différentes sources
        let errorMessage = 'Erreur lors de la création du paiement';
        
        // Vérifier si l'erreur a un message direct
        if (paymentError.message) {
          errorMessage = paymentError.message;
        }
        
        // Vérifier si l'erreur a un contexte avec une réponse
        const errorAny = paymentError as any;
        if (errorAny.context?.response) {
          try {
            // Cloner la réponse pour pouvoir la lire
            const responseClone = errorAny.context.response.clone();
            const responseText = await responseClone.text();
            console.error('❌ [VehicleModificationSurplusPaymentModal] Réponse erreur (text):', responseText);
            
            try {
              const errorBody = JSON.parse(responseText);
              console.error('❌ [VehicleModificationSurplusPaymentModal] Réponse erreur (parsed):', errorBody);
              if (errorBody.error) {
                errorMessage = errorBody.error;
              } else if (errorBody.message) {
                errorMessage = errorBody.message;
              }
            } catch (parseError) {
              // Si le parsing échoue, utiliser le texte brut si disponible
              if (responseText && responseText.trim()) {
                errorMessage = responseText;
              }
            }
          } catch (extractError) {
            console.error('❌ [VehicleModificationSurplusPaymentModal] Erreur extraction message:', extractError);
          }
        }
        
        // Vérifier si le résultat contient une erreur
        if (paymentResult && !paymentResult.success && paymentResult.error) {
          errorMessage = paymentResult.error;
        }
        
        throw new Error(errorMessage);
      }
      
      if (!paymentResult?.success) {
        console.error('❌ [VehicleModificationSurplusPaymentModal] Résultat non réussi:', paymentResult);
        throw new Error(paymentResult?.error || 'Erreur lors de la création du paiement');
      }

      // Envoyer email de confirmation
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'vehicle_modification_surplus_paid',
            to: 'contact@akwahome.com', // Email admin pour suivi
            data: {
              bookingId,
              surplusAmount,
              paymentMethod,
              phoneNumber: null,
              vehicleTitle: vehicleTitle || 'N/A',
            },
          },
        });
      } catch (emailError) {
        console.warn('Erreur envoi email:', emailError);
        // Ne pas bloquer le processus si l'email échoue
      }

      setPaymentSuccess(true);

      setTimeout(() => {
        setPaymentSuccess(false);
        onPaymentComplete(undefined); // cash
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('❌ [VehicleModificationSurplusPaymentModal] Erreur paiement surplus:', error);
      console.error('❌ [VehicleModificationSurplusPaymentModal] Détails erreur:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        context: error.context,
      });
      
      // Extraire le message d'erreur le plus détaillé possible
      let errorMessage = 'Impossible de traiter le paiement. Veuillez réessayer.';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      Alert.alert(
        'Erreur de paiement',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <CardPaymentSuccessView subtitle={`Le surplus de ${formatPrice(surplusAmount)} a été enregistré.`} />
        </View>
      </Modal>
    );
  }

  const showPendingStripeUI = stripeCheckoutOpened || pendingStripeReturn;
  if (showPendingStripeUI) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.pendingContainer}>
            <Text style={styles.pendingTitle}>Paiement en attente</Text>
            <View style={styles.stripePendingBox}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.stripePendingText}>
                {pendingStripeReturn
                  ? 'Retour détecté. Vérification du paiement en cours…'
                  : 'Finalisez le paiement dans le navigateur, puis revenez ici. La demande de modification ne sera envoyée qu\'après confirmation du paiement.'}
                {!pendingStripeReturn && currency !== 'EUR' && currency !== 'USD' ? ' Le montant a été converti pour le paiement par carte.' : ''}
              </Text>
              {lastPaymentStatus != null && (
                <Text style={styles.stripeStatusText}>
                  Statut : paiement {lastPaymentStatus}
                </Text>
              )}
              {(stripeCheckoutOpened || pendingStripeReturn) && pendingStripeStartedAt != null && (
                <Text style={styles.stripePendingCountdown}>
                  Expiration dans {Math.max(0, Math.floor(stripeTimeLeftSec / 60))}:{String(Math.max(0, stripeTimeLeftSec % 60)).padStart(2, '0')}
                </Text>
              )}
              <View style={styles.stripePendingActions}>
                <TouchableOpacity
                  style={[styles.stripeActionButton, styles.stripeActionDanger]}
                  onPress={handleAbandonStripeOperation}
                >
                  <Text style={styles.stripeActionDangerText}>J'abandonne l'opération</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Paiement du surplus</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.amountSection}>
              {vehicleTitle && vehicleId ? (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    (navigation as any).navigate('VehicleDetails', { vehicleId });
                  }}
                  style={styles.offerTitleRow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.offerTitleLabel}>Véhicule : </Text>
                  <Text style={styles.offerTitleLink} numberOfLines={1}>{vehicleTitle}</Text>
                  <Ionicons name="open-outline" size={16} color="#e67e22" />
                </TouchableOpacity>
              ) : null}
              <Text style={styles.amountLabel}>Montant à payer</Text>
              <Text style={styles.amountValue}>
                {formatPrice(surplusAmount)}
              </Text>
              <Text style={styles.amountNote}>
                Ce montant correspond au surplus de votre modification de réservation.
              </Text>
            </View>

            {/* Méthode de paiement - Placé en priorité pour une meilleure visibilité */}
            <View style={styles.paymentMethodsSection}>
              <Text style={styles.sectionTitle}>Méthode de paiement</Text>

              {/* Wave */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  paymentMethod === 'wave' && styles.paymentMethodSelected,
                ]}
                onPress={() => Alert.alert('Bientot disponible', 'Wave sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.')}
              >
                <Ionicons name="wallet" size={24} color={paymentMethod === 'wave' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'wave' && styles.paymentMethodTextSelected]}>
                  Wave • Recommandé
                </Text>
                {paymentMethod === 'wave' && (
                  <Ionicons name="checkmark-circle" size={20} color="#e67e22" />
                )}
              </TouchableOpacity>

              {/* Orange Money */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'orange_money' && styles.paymentMethodSelected]}
                onPress={() => Alert.alert('Bientot disponible', 'Orange Money sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.')}
              >
                <Ionicons name="phone-portrait" size={24} color={paymentMethod === 'orange_money' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'orange_money' && styles.paymentMethodTextSelected]}>Orange Money • Recommandé</Text>
                {paymentMethod === 'orange_money' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* MTN Money */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'mtn_money' && styles.paymentMethodSelected]}
                onPress={() => Alert.alert('Bientot disponible', 'MTN Money sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.')}
              >
                <Ionicons name="phone-portrait" size={24} color={paymentMethod === 'mtn_money' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'mtn_money' && styles.paymentMethodTextSelected]}>MTN Money • Recommandé</Text>
                {paymentMethod === 'mtn_money' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* Moov Money */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'moov_money' && styles.paymentMethodSelected]}
                onPress={() => Alert.alert('Bientot disponible', 'Moov Money sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.')}
              >
                <Ionicons name="phone-portrait" size={24} color={paymentMethod === 'moov_money' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'moov_money' && styles.paymentMethodTextSelected]}>Moov Money • Recommandé</Text>
                {paymentMethod === 'moov_money' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* PayPal */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'paypal' && styles.paymentMethodSelected]}
                onPress={() => Alert.alert('Bientot disponible', 'PayPal sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.')}
              >
                <Ionicons name="logo-paypal" size={24} color={paymentMethod === 'paypal' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'paypal' && styles.paymentMethodTextSelected]}>PayPal • Recommandé</Text>
                {paymentMethod === 'paypal' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* Carte bancaire */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  paymentMethod === 'card' && styles.paymentMethodSelected,
                ]}
                onPress={() => setPaymentMethod('card')}
              >
                <Ionicons name="card" size={24} color={paymentMethod === 'card' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'card' && styles.paymentMethodTextSelected]}>
                  Carte bancaire
                </Text>
                {paymentMethod === 'card' && (
                  <Ionicons name="checkmark-circle" size={20} color="#e67e22" />
                )}
              </TouchableOpacity>

              {/* Espèces */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  paymentMethod === 'cash' && styles.paymentMethodSelected,
                ]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Ionicons name="cash" size={24} color={paymentMethod === 'cash' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'cash' && styles.paymentMethodTextSelected]}>
                  Espèces (à l'arrivée) • Recommandé
                </Text>
                {paymentMethod === 'cash' && (
                  <Ionicons name="checkmark-circle" size={20} color="#e67e22" />
                )}
              </TouchableOpacity>
            </View>

            {(paymentMethod === 'wave' || paymentMethod === 'orange_money' || paymentMethod === 'mtn_money' || paymentMethod === 'moov_money' || paymentMethod === 'paypal') && (
              <View style={[styles.paymentFormSection, { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8 }]}>
                <Ionicons name="time-outline" size={24} color="#f59e0b" />
                <Text style={[styles.inputLabel, { flex: 1, marginBottom: 0 }]}>
                  Ce moyen de paiement sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.
                </Text>
              </View>
            )}

            {paymentMethod === 'cash' && (
              <View style={styles.paymentFormSection}>
                <View style={styles.cashInfo}>
                  <Ionicons name="cash" size={32} color="#6b7280" />
                  <Text style={styles.cashText}>Vous paierez le surplus en espèces lors de la prise en charge du véhicule.</Text>
                </View>
              </View>
            )}

            {/* Détails du surplus */}
            {priceBreakdown && (
              <View style={styles.priceDetailsSection}>
                <Text style={styles.priceDetailsTitle}>Détail du surplus</Text>
                
                {priceBreakdown.daysPriceDiff !== undefined && priceBreakdown.daysPriceDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence prix des jours:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.daysPriceDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.daysPriceDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.daysPriceDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.hoursPriceDiff !== undefined && priceBreakdown.hoursPriceDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence prix des heures:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.hoursPriceDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.hoursPriceDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.hoursPriceDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.basePriceBeforeDiscountDiff !== undefined && priceBreakdown.basePriceBeforeDiscountDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Prix de base (avant réduction):</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.basePriceBeforeDiscountDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.basePriceBeforeDiscountDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.basePriceBeforeDiscountDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.discountDiff !== undefined && priceBreakdown.discountDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>
                      {priceBreakdown.discountDiff > 0 ? 'Réduction supplémentaire (gain):' : 'Réduction réduite (perte):'}
                    </Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.discountDiff > 0 ? styles.decreaseValue : styles.increaseValue]}>
                      {priceBreakdown.discountDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.discountDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.basePriceAfterDiscountDiff !== undefined && priceBreakdown.basePriceAfterDiscountDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Prix après réduction:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.basePriceAfterDiscountDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.basePriceAfterDiscountDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.basePriceAfterDiscountDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.serviceFeeHTDiff !== undefined && priceBreakdown.serviceFeeHTDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence frais de service (HT):</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.serviceFeeHTDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.serviceFeeHTDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.serviceFeeHTDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.serviceFeeVATDiff !== undefined && priceBreakdown.serviceFeeVATDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence TVA (20%):</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.serviceFeeVATDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.serviceFeeVATDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.serviceFeeVATDiff)}
                    </Text>
                  </View>
                )}
                
                <View style={[styles.priceDetailRow, styles.surplusRow]}>
                  <Text style={styles.surplusLabel}>Surplus total à payer:</Text>
                  <Text style={styles.surplusValue}>
                    {formatPrice(surplusAmount)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                Si votre demande de modification est refusée, ce montant vous sera intégralement remboursé.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.payButton, loading && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.payButtonText}>
                    Payer {formatPrice(surplusAmount)}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
    maxHeight: '90%',
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  amountSection: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  offerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  offerTitleLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  offerTitleLink: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#e67e22',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  amountNote: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  paymentMethodsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  paymentMethodSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fff7ed',
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 12,
  },
  paymentMethodTextSelected: {
    color: '#e67e22',
    fontWeight: '600',
  },
  paymentFormSection: {
    marginTop: 12,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    gap: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
  },
  cashInfo: {
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  cashText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  phoneInputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  phoneIcon: {
    marginRight: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    marginLeft: 12,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  payButton: {
    backgroundColor: '#e67e22',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    margin: 20,
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 20,
    marginBottom: 12,
  },
  pendingText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  stripePendingBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  stripePendingText: {
    color: '#1e3a8a',
    fontSize: 14,
    lineHeight: 20,
  },
  stripeStatusText: {
    color: '#1e40af',
    fontSize: 13,
    marginTop: 4,
  },
  stripePendingCountdown: {
    color: '#1e40af',
    fontSize: 13,
    fontWeight: '600',
  },
  stripePendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  stripeActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeActionPrimary: {
    backgroundColor: '#2563eb',
  },
  stripeActionDisabled: {
    opacity: 0.6,
  },
  stripeActionPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  stripeActionDanger: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  stripeActionDangerText: {
    color: '#b91c1c',
    fontWeight: '600',
    fontSize: 13,
  },
  priceDetailsSection: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  priceDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  priceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  increaseValue: {
    color: '#e74c3c',
  },
  decreaseValue: {
    color: '#059669',
  },
  surplusRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e67e22',
  },
  surplusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  surplusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e67e22',
  },
});

export default VehicleModificationSurplusPaymentModal;

