import React, { useState, useCallback, useEffect } from 'react';
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
import { useCurrency } from '../hooks/useCurrency';

interface ModificationSurplusPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  surplusAmount: number;
  bookingId: string;
  onPaymentComplete: () => void;
  propertyTitle?: string;
  propertyId?: string;
  originalTotalPrice?: number;
  newTotalPrice?: number;
  priceBreakdown?: {
    basePriceDiff?: number;
    discountDiff?: number;
    cleaningFeeDiff?: number;
    serviceFeeDiff?: number;
    serviceFeeHTDiff?: number;
    serviceFeeVATDiff?: number;
    taxesDiff?: number;
  };
}

const ModificationSurplusPaymentModal: React.FC<ModificationSurplusPaymentModalProps> = ({
  visible,
  onClose,
  surplusAmount,
  bookingId,
  onPaymentComplete,
  propertyTitle,
  propertyId,
  originalTotalPrice,
  newTotalPrice,
  priceBreakdown,
}) => {
  const navigation = useNavigation();
  const { currency, rates, formatPriceForPayment } = useCurrency();
  const STRIPE_PENDING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'card' | 'paypal' | 'cash'>('card');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [pendingStripeReturn, setPendingStripeReturn] = useState(false);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [checkingStripeStatus, setCheckingStripeStatus] = useState(false);
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);

  const formatPrice = (price: number) => formatPriceForPayment(price);

  const checkPaymentStatusFull = useCallback(async (): Promise<{ is_confirmed: boolean; payment_status?: string; error?: string }> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: {
          booking_id: bookingId,
          booking_type: 'property',
          payment_type: 'modification_surplus',
        },
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      const ps = data?.payment_status != null ? String(data.payment_status) : 'pending';
      setLastPaymentStatus(ps);
      if (error) return { is_confirmed: false, payment_status: ps, error: error?.message };
      return { is_confirmed: data?.is_confirmed === true, payment_status: ps };
    } catch (e) {
      return { is_confirmed: false, error: e instanceof Error ? e.message : 'Erreur de vérification' };
    }
  }, [bookingId]);

  const resetPendingStripeState = useCallback(() => {
    setPendingStripeReturn(false);
    setPendingStripeStartedAt(null);
    setStripeTimeLeftSec(0);
    setLastPaymentStatus(null);
    setCheckingStripeStatus(false);
  }, []);

  const verifyStripePaymentNow = useCallback(async () => {
    if (!pendingStripeReturn || checkingStripeStatus) return;
    setCheckingStripeStatus(true);
    const result = await checkPaymentStatusFull();
    setCheckingStripeStatus(false);
    if (result.is_confirmed) {
      resetPendingStripeState();
      setPaymentSuccess(true);
      setTimeout(() => {
        onPaymentComplete();
        onClose();
      }, 1500);
    } else if (result.error) {
      Alert.alert('Vérification', result.error + '\n\nRéessayez dans quelques secondes ou cliquez sur « Vérifier le paiement ».');
    }
  }, [pendingStripeReturn, checkingStripeStatus, checkPaymentStatusFull, resetPendingStripeState, onPaymentComplete, onClose]);

  const handleAbandonStripeOperation = useCallback(() => {
    Alert.alert(
      'Abandonner le paiement ?',
      'La demande de modification ne sera envoyée à l\'hôte qu\'après paiement confirmé. Vous pourrez réessayer plus tard.',
      [
        { text: 'Continuer le paiement', style: 'cancel' },
        { text: "J'abandonne", style: 'destructive', onPress: () => { resetPendingStripeState(); onClose(); } },
      ]
    );
  }, [resetPendingStripeState, onClose]);

  useEffect(() => {
    if (!visible || !pendingStripeReturn) return;
    let cancelled = false;
    const poll = async () => {
      const result = await checkPaymentStatusFull();
      if (cancelled) return;
      if (result.is_confirmed) {
        setPendingStripeReturn(false);
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentComplete();
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
  }, [visible, pendingStripeReturn, checkPaymentStatusFull, onPaymentComplete, onClose]);

  useEffect(() => {
    if (!pendingStripeReturn || !pendingStripeStartedAt) return;
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
  }, [pendingStripeReturn, pendingStripeStartedAt, STRIPE_PENDING_TIMEOUT_MS, resetPendingStripeState, onClose]);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && pendingStripeReturn) {
        verifyStripePaymentNow();
        retryTimeout = setTimeout(verifyStripePaymentNow, 2000);
      }
    });
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      sub.remove();
    };
  }, [pendingStripeReturn, verifyStripePaymentNow]);

  const handlePaymentSuccessUrl = useCallback((url: string | null) => {
    if (!url || !url.includes('payment-success') || !bookingId) return;
    const match = url.match(/booking_id=([^&]+)/);
    if (match && decodeURIComponent(match[1]) === bookingId) setPendingStripeReturn(true);
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
      setPendingStripeStartedAt(null);
      setLastPaymentStatus(null);
    }
  }, [visible]);

  const validatePaymentInfo = (): boolean => {
    if (paymentMethod === 'card' || paymentMethod === 'cash') return true;
    if (['wave', 'orange_money', 'mtn_money', 'moov_money', 'paypal'].includes(paymentMethod)) {
      Alert.alert('Bientot disponible', 'Ce moyen de paiement sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.');
      return false;
    }
    return true;
  };

  const runStripeCheckoutSurplus = useCallback(async (convertFcfaToEur: boolean) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        booking_id: bookingId,
        amount: surplusAmount,
        property_title: propertyTitle || 'Surplus modification',
        payment_type: 'modification_surplus',
        booking_type: 'property',
        client: 'mobile',
        return_to_app: true,
        app_scheme: 'akwahomemobile',
      };
      if ((currency === 'EUR' && rates.EUR) || (convertFcfaToEur && rates.EUR)) {
        body.currency = 'eur';
        body.rate = rates.EUR;
      } else if (currency === 'USD' && rates.USD) {
        body.currency = 'usd';
        body.rate = rates.USD;
      }
      const { data, error } = await supabase.functions.invoke('create-checkout-session', { body });
      if (error) throw error;
      if (data?.url) {
        setPendingStripeStartedAt(Date.now());
        setStripeTimeLeftSec(Math.floor(STRIPE_PENDING_TIMEOUT_MS / 1000));
        setPendingStripeReturn(true);
        Linking.openURL(data.url);
        return;
      }
      throw new Error(data?.error || 'Impossible d\'ouvrir la page de paiement');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d\'ouvrir le paiement Stripe');
    } finally {
      setLoading(false);
    }
  }, [bookingId, surplusAmount, propertyTitle, currency, rates.EUR, rates.USD]);

  const handlePayment = async () => {
    if (!validatePaymentInfo()) return;

    if (paymentMethod === 'card') {
      if (currency === 'XOF' && rates.EUR) {
        await runStripeCheckoutSurplus(true);
      } else {
        await runStripeCheckoutSurplus(false);
      }
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

      if (paymentError) throw paymentError;
      if (!paymentResult?.success) {
        throw new Error(paymentResult?.error || 'Erreur lors de la création du paiement');
      }

      // Envoyer email de confirmation
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'modification_surplus_paid',
            to: 'contact@akwahome.com', // Email admin pour suivi
            data: {
              bookingId,
              surplusAmount,
              paymentMethod,
              phoneNumber: null,
              propertyTitle: propertyTitle || 'N/A',
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
        onPaymentComplete();
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Erreur paiement surplus:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de traiter le paiement. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (paymentSuccess) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={styles.successTitle}>Paiement effectué</Text>
            <Text style={styles.successText}>
              Le surplus de {formatPrice(surplusAmount)} a été enregistré.
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (pendingStripeReturn) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.pendingContainer}>
            <Text style={styles.pendingTitle}>Paiement en attente</Text>
            <View style={styles.stripePendingBox}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.stripePendingText}>
                Finalisez le paiement sur Stripe. Revenez ici après avoir payé ; la demande de modification ne sera envoyée à l'hôte qu'une fois le paiement confirmé.
                {currency !== 'EUR' && currency !== 'USD' ? ' Le montant a été converti pour le paiement par carte.' : ''}
              </Text>
              {lastPaymentStatus != null && (
                <Text style={styles.stripeStatusText}>
                  Statut : paiement {lastPaymentStatus}
                </Text>
              )}
              <Text style={styles.stripePendingCountdown}>
                Expiration dans {Math.max(0, Math.floor(stripeTimeLeftSec / 60))}:{String(Math.max(0, stripeTimeLeftSec % 60)).padStart(2, '0')}
              </Text>
              <View style={styles.stripePendingActions}>
                <TouchableOpacity
                  style={[styles.stripeActionButton, styles.stripeActionPrimary]}
                  onPress={verifyStripePaymentNow}
                  disabled={checkingStripeStatus}
                >
                  {checkingStripeStatus ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.stripeActionPrimaryText}>Vérifier le paiement</Text>
                  )}
                </TouchableOpacity>
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
              {propertyTitle && propertyId ? (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    (navigation as any).navigate('PropertyDetails', { propertyId });
                  }}
                  style={styles.offerTitleRow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.offerTitleLabel}>Résidence : </Text>
                  <Text style={styles.offerTitleLink} numberOfLines={1}>{propertyTitle}</Text>
                  <Ionicons name="open-outline" size={16} color="#2E7D32" />
                </TouchableOpacity>
              ) : null}
              <Text style={styles.amountLabel}>Montant à payer</Text>
              <Text style={styles.amountValue}>
                {paymentMethod === 'card' && currency === 'XOF' && rates.EUR
                  ? `~${(surplusAmount / rates.EUR).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (${surplusAmount.toLocaleString('fr-FR')} FCFA)`
                  : formatPrice(surplusAmount)}
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
                <Text style={[styles.paymentMethodText, paymentMethod === 'mtn_money' && styles.paymentMethodTextSelected]}>MTN Money</Text>
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
                onPress={() => {
                  if (currency === 'XOF' && rates.EUR) {
                    const eurAmount = surplusAmount / rates.EUR;
                    const eurText = eurAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    Alert.alert(
                      'Carte bancaire - Paiement en euros',
                      `La carte bancaire est disponible uniquement pour le paiement en euros.\n\nSouhaitez-vous effectuer le paiement en euros ? Si oui, le montant sera converti et débité en euros : ~${eurText} € (équivalent de ${surplusAmount.toLocaleString('fr-FR')} FCFA).`,
                      [
                        { text: 'Non', style: 'cancel' },
                        { text: 'Oui, payer en euros', onPress: () => setPaymentMethod('card') },
                      ]
                    );
                    return;
                  }
                  setPaymentMethod('card');
                }}
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
                  <Text style={styles.cashText}>Vous paierez le surplus en espèces à l'arrivée.</Text>
                </View>
              </View>
            )}

            {/* Détails du surplus */}
            {priceBreakdown && (
              <View style={styles.priceDetailsSection}>
                <Text style={styles.priceDetailsTitle}>Détail du surplus</Text>
                
                {priceBreakdown.basePriceDiff !== undefined && priceBreakdown.basePriceDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence prix de base:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.basePriceDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.basePriceDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.basePriceDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.discountDiff !== undefined && priceBreakdown.discountDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence réduction:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.discountDiff > 0 ? styles.decreaseValue : styles.increaseValue]}>
                      {priceBreakdown.discountDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.discountDiff)}
                    </Text>
                  </View>
                )}
                
                {priceBreakdown.cleaningFeeDiff !== undefined && priceBreakdown.cleaningFeeDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence frais de ménage:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.cleaningFeeDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.cleaningFeeDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.cleaningFeeDiff)}
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
                
                {priceBreakdown.taxesDiff !== undefined && priceBreakdown.taxesDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence taxe de séjour:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.taxesDiff > 0 ? styles.increaseValue : styles.decreaseValue]}>
                      {priceBreakdown.taxesDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.taxesDiff)}
                    </Text>
                  </View>
                )}
                
                <View style={[styles.priceDetailRow, styles.surplusRow]}>
                  <Text style={styles.surplusLabel}>Surplus total à payer:</Text>
                  <Text style={styles.surplusValue}>
                    {paymentMethod === 'card' && currency === 'XOF' && rates.EUR
                      ? `~${(surplusAmount / rates.EUR).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (${surplusAmount.toLocaleString('fr-FR')} FCFA)`
                      : formatPrice(surplusAmount)}
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
                    Payer {paymentMethod === 'card' && currency === 'XOF' && rates.EUR
                      ? `~${(surplusAmount / rates.EUR).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                      : formatPrice(surplusAmount)}
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
    color: '#2E7D32',
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
  successContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    margin: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
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
  priceComparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  priceComparisonLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceComparisonValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textDecorationLine: 'line-through',
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
  discountValue: {
    color: '#059669',
  },
  increaseValue: {
    color: '#e74c3c',
  },
  decreaseValue: {
    color: '#059669',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
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

export default ModificationSurplusPaymentModal;

