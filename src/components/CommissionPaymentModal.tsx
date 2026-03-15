import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  AppState,
  AppStateStatus,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { createCheckoutSession, checkPaymentStatus } from '../services/cardPaymentService';
import CardPaymentSuccessView from './CardPaymentSuccessView';
import { formatAmount } from '../utils/priceCalculator';
import { useCurrency } from '../hooks/useCurrency';
import type { CommissionDueItem, PlatformPaymentInfo } from '../hooks/useCommissions';

const FALLBACK_WAVE = '+225 07 79 57 13 48';
const FALLBACK_RIB = 'FR76 1759 8000 0100 0121 8085 961';
const STRIPE_PENDING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface CommissionPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  commission: CommissionDueItem | null;
  paymentInfo: PlatformPaymentInfo | null;
  onPaymentComplete: () => void;
}

type CommissionPaymentMethod = 'wave' | 'card';

const CommissionPaymentModal: React.FC<CommissionPaymentModalProps> = ({
  visible,
  onClose,
  commission,
  paymentInfo,
  onPaymentComplete,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<CommissionPaymentMethod>('card');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [stripeCheckoutOpened, setStripeCheckoutOpened] = useState(false);
  const [pendingStripeReturn, setPendingStripeReturn] = useState(false);
  const [pendingStripeSessionId, setPendingStripeSessionId] = useState<string | null>(null);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);
  const [checkingStripeStatus, setCheckingStripeStatus] = useState(false);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const checkingRef = useRef(false);

  const { currency, rates, formatPrice, formatPriceForPayment } = useCurrency();
  const wavePhone = paymentInfo?.wave_phone || FALLBACK_WAVE;
  const ribIban = paymentInfo?.rib_iban || FALLBACK_RIB;
  const commissionAmount = commission?.amount_due ?? 0;
  const cardFeePercent = 1;
  const cardFeeAmount = Math.round(commissionAmount * (cardFeePercent / 100));
  const cardTotalAmount = commissionAmount + cardFeeAmount;
  const payInEur = currency === 'EUR' && rates.EUR && rates.EUR > 0;

  const resetPendingStripeState = useCallback(() => {
    setStripeCheckoutOpened(false);
    setPendingStripeReturn(false);
    setPendingStripeSessionId(null);
    setPendingStripeStartedAt(null);
    setStripeTimeLeftSec(0);
    setLastPaymentStatus(null);
    setCheckingStripeStatus(false);
  }, []);

  const checkCommissionPaymentStatus = useCallback(async (): Promise<{ is_confirmed: boolean }> => {
    if (!commission) return { is_confirmed: false };
    try {
      const result = await checkPaymentStatus({
        payment_type: 'platform_commission',
        commission_due_id: commission.id,
        stripe_session_id: pendingStripeSessionId ?? undefined,
      });
      setLastPaymentStatus(result.payment_status ?? 'pending');
      if (result.is_confirmed) return { is_confirmed: true };

      // Fallback : lecture directe en base (webhook peut avoir mis à jour avant que l'API réponde)
      const { data: row } = await supabase
        .from('platform_commission_due')
        .select('status')
        .eq('id', commission.id)
        .maybeSingle();
      const isPaid = String(row?.status ?? '').toLowerCase() === 'paid';
      if (isPaid) setLastPaymentStatus('paid');
      return { is_confirmed: isPaid };
    } catch {
      return { is_confirmed: false };
    }
  }, [commission, pendingStripeSessionId]);

  const verifyCommissionPaymentNow = useCallback(async () => {
    if (!commission) return;
    if (checkingRef.current) return;
    checkingRef.current = true;
    setCheckingStripeStatus(true);
    setPendingStripeReturn(true);
    const result = await checkCommissionPaymentStatus();
    checkingRef.current = false;
    setCheckingStripeStatus(false);
    if (result.is_confirmed) {
      resetPendingStripeState();
      setPaymentSuccess(true);
      setTimeout(() => {
        onPaymentComplete();
        onClose();
      }, 1500);
    }
  }, [commission, checkCommissionPaymentStatus, resetPendingStripeState, onPaymentComplete, onClose]);

  useEffect(() => {
    if (visible) {
      setPaymentSuccess(false);
      resetPendingStripeState();
    }
  }, [visible, resetPendingStripeState]);

  useEffect(() => {
    if (!visible || !stripeCheckoutOpened || !commission) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const result = await checkCommissionPaymentStatus();
      if (cancelled) return;
      if (result.is_confirmed) {
        resetPendingStripeState();
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentComplete();
          onClose();
        }, 1500);
      }
    };
    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, stripeCheckoutOpened, commission, checkCommissionPaymentStatus, resetPendingStripeState, onPaymentComplete, onClose]);

  useEffect(() => {
    if (!stripeCheckoutOpened || !pendingStripeStartedAt) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - pendingStripeStartedAt;
      const remainingMs = Math.max(0, STRIPE_PENDING_TIMEOUT_MS - elapsed);
      setStripeTimeLeftSec(Math.floor(remainingMs / 1000));
      if (remainingMs <= 0) {
        clearInterval(timer);
        resetPendingStripeState();
        Alert.alert('Paiement expiré', 'Le délai de paiement est dépassé. Vous pourrez réessayer depuis l\'onglet Commissions.');
        onClose();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stripeCheckoutOpened, pendingStripeStartedAt, resetPendingStripeState, onClose]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasBackground && nextState === 'active' && stripeCheckoutOpened && commission) {
        // Délai pour laisser le webhook Stripe mettre à jour platform_commission_due avant la vérification
        timeoutId = setTimeout(verifyCommissionPaymentNow, 2500);
      }
      appStateRef.current = nextState;
    });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      sub.remove();
    };
  }, [stripeCheckoutOpened, commission, verifyCommissionPaymentNow]);

  const handlePaymentSuccessUrl = useCallback((url: string | null) => {
    if (!url?.includes('payment-success') || !commission) return;
    const typeMatch = url.match(/payment_type=([^&]+)/);
    if (typeMatch?.[1] !== 'platform_commission') return;
    const commissionMatch = url.match(/commission_due_id=([^&]+)/);
    const urlCommissionId = commissionMatch ? decodeURIComponent(commissionMatch[1]) : null;
    if (urlCommissionId !== commission.id) return;
    setPendingStripeReturn(true);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(verifyCommissionPaymentNow, 2500);
    });
  }, [commission, verifyCommissionPaymentNow]);

  useEffect(() => {
    if (!visible) return;
    Linking.getInitialURL().then(handlePaymentSuccessUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handlePaymentSuccessUrl(url));
    return () => sub.remove();
  }, [visible, handlePaymentSuccessUrl]);

  const handlePayment = async () => {
    if (!commission) return;

    if (paymentMethod === 'card') {
      setLoading(true);
      try {
        const body: Record<string, unknown> = {
          payment_type: 'platform_commission',
          commission_due_id: commission.id,
          booking_id: commission.booking_id,
          amount: commission.amount_due,
          property_title: 'Commission AkwaHome - Réservation espèces',
          return_to_app: true,
          app_scheme: 'akwahomemobile',
          client: 'mobile',
        };
        if (payInEur) {
          body.currency = 'eur';
          body.rate = rates.EUR;
        }
        const result = await createCheckoutSession(body);
        if (result.session_id) {
          setPendingStripeSessionId(result.session_id);
          setStripeCheckoutOpened(true);
          setPendingStripeStartedAt(Date.now());
        }
        await Linking.openURL(result.url);
      } catch (e: unknown) {
        Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'ouvrir le paiement Stripe");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Wave : marquer payé + notifier admin
    setLoading(true);
    try {
      const { error } = await supabase
        .from('platform_commission_due')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'wave',
          payment_reference: phoneNumber.trim() ? `Wave ${phoneNumber.trim()}` : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commission.id);

      if (error) throw error;

      await supabase.functions.invoke('send-email', {
        body: {
          type: 'commission_wave_declaration',
          to: 'contact@akwahome.com',
          data: {
            commissionDueId: commission.id,
            amount: commission.amount_due,
            phoneNumber: phoneNumber.trim() || null,
            reference: null,
            label: commission.label,
            bookingType: commission.booking_type,
          },
        },
      });
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'commission_payment_confirmation',
          to: 'contact@akwahome.com',
          data: { commissionDueId: commission.id },
        },
      });

      setPaymentSuccess(true);
      setTimeout(() => {
        Alert.alert(
          'Paiement enregistré',
          "Votre reversement de commission a été enregistré. AkwaHome vérifiera le paiement sous peu.",
          [
            {
              text: 'OK',
              onPress: () => {
                onPaymentComplete();
                onClose();
                setPaymentSuccess(false);
                setPhoneNumber('');
              },
            },
          ]
        );
      }, 1500);
    } catch (err: unknown) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Impossible d'enregistrer le paiement");
    } finally {
      setLoading(false);
    }
  };

  if (!commission) return null;

  if (paymentSuccess) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <CardPaymentSuccessView subtitle="Votre reversement de commission a été enregistré." />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Régler la commission</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.summaryCard}>
              {commission.label ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Réservation</Text>
                  <Text style={styles.summaryValue}>{commission.label}</Text>
                </View>
              ) : null}
              {paymentMethod === 'card' ? (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Commission</Text>
                    <Text style={styles.summaryValue}>{payInEur ? formatPrice(commission.amount_due) : formatAmount(commission.amount_due)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>+ 1% frais carte</Text>
                    <Text style={styles.summaryValue}>{payInEur ? formatPrice(cardFeeAmount) : formatAmount(cardFeeAmount)}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={styles.summaryTotalLabel}>Total à payer (carte)</Text>
                    <Text style={styles.summaryTotalValue}>{payInEur ? formatPriceForPayment(cardTotalAmount) : formatAmount(cardTotalAmount)}</Text>
                  </View>
                </>
              ) : (
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Montant à reverser</Text>
                  <Text style={styles.summaryTotalValue}>{currency === 'EUR' ? formatPrice(commission.amount_due) : formatAmount(commission.amount_due)}</Text>
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Moyen de paiement</Text>

            <View style={[styles.paymentMethodCard, { opacity: 0.7, backgroundColor: '#f3f4f6' }]}>
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#1DA1F2' }]}>
                  <Ionicons name="phone-portrait" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Wave</Text>
                  <Text style={styles.paymentMethodSubtitle}>Paiement mobile — Bientôt disponible</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.paymentMethodCard, paymentMethod === 'card' && styles.paymentMethodCardActive]}
              onPress={() => setPaymentMethod('card')}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#e67e22' }]}>
                  <Ionicons name="card" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Carte bancaire</Text>
                  <Text style={styles.paymentMethodSubtitle}>Visa, Mastercard (Stripe)</Text>
                </View>
                <Ionicons name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'} size={24} color={paymentMethod === 'card' ? '#e67e22' : '#ccc'} />
              </View>
            </TouchableOpacity>
            {paymentMethod === 'card' && (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#f59e0b" />
                <Text style={styles.infoText}>
                  Vous serez redirigé vers le paiement sécurisé. Revenez ici après avoir payé pour confirmer.
                </Text>
              </View>
            )}
            {(stripeCheckoutOpened || pendingStripeReturn) && (
              <View style={styles.pendingCard}>
                <ActivityIndicator size="small" color="#e67e22" />
                <Text style={styles.pendingTitle}>Paiement en attente</Text>
                <Text style={styles.pendingText}>
                  {pendingStripeReturn
                    ? 'Vérification du paiement en cours…'
                    : 'Revenez dans l’app après avoir terminé le paiement sur Stripe.'}
                </Text>
                {lastPaymentStatus != null && (
                  <Text style={styles.pendingStatus}>Statut : {lastPaymentStatus}</Text>
                )}
                {stripeTimeLeftSec > 0 && (
                  <Text style={styles.pendingTimer}>Expiration dans {Math.floor(stripeTimeLeftSec / 60)} min {stripeTimeLeftSec % 60} s</Text>
                )}
                <TouchableOpacity
                  style={styles.abandonButton}
                  onPress={() => {
                    Alert.alert(
                      'Abandonner le paiement ?',
                      'Si vous avez déjà payé, la commission sera marquée payée sous peu. Sinon, vous pourrez réessayer plus tard.',
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
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                if (stripeCheckoutOpened || pendingStripeReturn) {
                  resetPendingStripeState();
                  onClose();
                } else {
                  onClose();
                }
              }}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{stripeCheckoutOpened || pendingStripeReturn ? 'Fermer' : 'Annuler'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.payButton, (loading || stripeCheckoutOpened || pendingStripeReturn || checkingStripeStatus) && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={loading || stripeCheckoutOpened || pendingStripeReturn || checkingStripeStatus}
            >
              {loading || checkingStripeStatus ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  {paymentMethod === 'wave' ? "J'ai payé par Wave" : `Payer ${payInEur ? formatPriceForPayment(cardTotalAmount) : formatAmount(cardTotalAmount)} par carte`}
                </Text>
              )}
            </TouchableOpacity>
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
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginBottom: 0,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e67e22',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  paymentMethodCard: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentMethodCardActive: {
    borderColor: '#e67e22',
    backgroundColor: '#fff7ed',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentMethodSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  detailBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
    letterSpacing: 1,
  },
  detailHint: {
    fontSize: 12,
    color: '#64748b',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  pendingCard: {
    marginTop: 20,
    padding: 16,
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
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  payButton: {
    backgroundColor: '#e67e22',
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CommissionPaymentModal;
