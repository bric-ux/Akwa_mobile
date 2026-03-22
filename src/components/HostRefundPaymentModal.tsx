import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { createCheckoutSession, checkPaymentStatus } from '../services/cardPaymentService';
import { createWaveCheckoutSession, openWavePayment } from '../services/wavePaymentService';
import CardPaymentSuccessView from './CardPaymentSuccessView';
import { formatAmount } from '../utils/priceCalculator';
import { useCurrency } from '../hooks/useCurrency';
import type { HostRefundDueItem } from '../hooks/useHostRefunds';
import type { PlatformPaymentInfo } from '../hooks/useCommissions';

interface HostRefundPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  refund: HostRefundDueItem | null;
  paymentInfo: PlatformPaymentInfo | null;
  onPaymentComplete: () => void;
}

type PaymentMethod = 'wave' | 'card';

const HostRefundPaymentModal: React.FC<HostRefundPaymentModalProps> = ({
  visible,
  onClose,
  refund,
  paymentInfo,
  onPaymentComplete,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [stripeCheckoutOpened, setStripeCheckoutOpened] = useState(false);
  const [pendingStripeSessionId, setPendingStripeSessionId] = useState<string | null>(null);
  const [pendingWaveCheckoutToken, setPendingWaveCheckoutToken] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [lastPaymentStatus, setLastPaymentStatus] = useState<string | null>(null);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);

  const { currency, rates, formatPrice, formatPriceForPayment, changeCurrency } = useCurrency();
  const amount = refund?.amount_due ?? 0;
  const cardFeePercent = 1;
  const cardFeeAmount = Math.round(amount * (cardFeePercent / 100));
  const cardTotalAmount = amount + cardFeeAmount;
  const payInEur = currency === 'EUR' && rates?.EUR && rates.EUR > 0;

  const checkStatus = useCallback(async (waveToken?: string | null) => {
    if (!refund) return false;
    try {
      if (waveToken) {
        const result = await checkPaymentStatus({
          checkout_token: waveToken,
          wave: true,
          payment_type: 'host_refund',
          host_refund_due_id: refund.id,
        });
        setLastPaymentStatus(result.payment_status ?? 'pending');
        return result.is_confirmed ?? false;
      }
      const { data: row } = await supabase
        .from('host_refund_due')
        .select('status')
        .eq('id', refund.id)
        .maybeSingle();
      if (row && String(row.status).toLowerCase() === 'paid') {
        setLastPaymentStatus('paid');
        return true;
      }
      const result = await checkPaymentStatus({
        payment_type: 'host_refund',
        host_refund_due_id: refund.id,
        stripe_session_id: pendingStripeSessionId ?? undefined,
      });
      setLastPaymentStatus(result.payment_status ?? 'pending');
      return result.is_confirmed ?? false;
    } catch {
      return false;
    }
  }, [refund, pendingStripeSessionId]);

  const verifyPayment = useCallback(async () => {
    if (!refund) return;
    setCheckingStatus(true);
    const paid = await checkStatus(pendingWaveCheckoutToken ?? undefined);
    setCheckingStatus(false);
    if (paid) {
      setPaymentSuccess(true);
      setTimeout(() => {
        onPaymentComplete();
      }, 1500);
    }
  }, [refund, pendingWaveCheckoutToken, checkStatus, onPaymentComplete]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBg = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasBg && nextState === 'active' && (stripeCheckoutOpened || pendingWaveCheckoutToken)) {
        setTimeout(verifyPayment, 1500);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [stripeCheckoutOpened, pendingWaveCheckoutToken, verifyPayment]);

  useEffect(() => {
    if (!visible || !refund) return;
    const handleUrl = (url: string | null) => {
      if (!url?.includes('payment-success')) return;
      const typeMatch = url.match(/payment_type=([^&]+)/);
      if (typeMatch?.[1] === 'host_refund' || url.includes('host_refund')) {
        setTimeout(verifyPayment, 1000);
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [visible, refund, verifyPayment]);

  const handlePayment = async () => {
    if (!refund) return;
    if (paymentMethod === 'card') {
      setLoading(true);
      try {
        const body: Record<string, unknown> = {
          payment_type: 'host_refund',
          host_refund_due_id: refund.id,
          booking_id: refund.booking_id,
          amount: refund.amount_due,
          property_title: 'Remboursement annulation - AkwaHome',
          return_to_app: true,
          app_scheme: 'akwahomemobile',
          client: 'mobile',
          booking_type: refund.booking_type,
        };
        if (payInEur && rates?.EUR) {
          body.currency = 'eur';
          body.rate = rates.EUR;
        }
        const result = await createCheckoutSession(body);
        if (result.session_id) {
          setPendingStripeSessionId(result.session_id);
          setStripeCheckoutOpened(true);
        }
        await Linking.openURL(result.url);
      } catch (e: unknown) {
        Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'ouvrir le paiement Stripe");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (currency !== 'XOF') {
      Alert.alert(
        'Devise requise',
        "Le paiement Wave n'accepte que le Franc CFA (FCFA). Passez en CFA pour payer avec Wave.",
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Passer en CFA', onPress: async () => {
            await changeCurrency('XOF');
            Alert.alert('Devise mise à jour', 'Vous pouvez maintenant cliquer sur Payer pour continuer avec Wave.');
          } },
        ]
      );
      return;
    }
    setLoading(true);
    try {
      const checkoutToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
      const waveResult = await createWaveCheckoutSession({
        payment_type: 'host_refund',
        host_refund_due_id: refund.id,
        amount: refund.amount_due,
        checkout_token: checkoutToken,
        client: 'mobile',
        return_to_app: true,
        app_scheme: 'akwahomemobile',
      });
      setPendingWaveCheckoutToken(waveResult.checkout_token ?? checkoutToken);
      setStripeCheckoutOpened(true);
      await openWavePayment(waveResult.wave_launch_url);
    } catch (err: unknown) {
      Alert.alert('Erreur', err instanceof Error ? err.message : "Impossible d'ouvrir Wave");
    } finally {
      setLoading(false);
    }
  };

  if (!refund) return null;
  if (paymentSuccess) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <CardPaymentSuccessView subtitle="Votre reversement a été enregistré." />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Régler le remboursement</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.content}>
            <View style={styles.summaryCard}>
              {refund.label && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Réservation</Text>
                  <Text style={styles.summaryValue}>{refund.label}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Montant à reverser</Text>
                <Text style={styles.summaryTotalValue}>{payInEur ? formatPrice(amount) : formatAmount(amount)}</Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>Moyen de paiement</Text>
            <TouchableOpacity
              style={[styles.paymentMethodCard, paymentMethod === 'wave' && styles.paymentMethodCardActive]}
              onPress={() => {
                if (currency !== 'XOF') {
                  Alert.alert('Devise requise', "Wave n'accepte que le FCFA. Passez en CFA d'abord.");
                  return;
                }
                setPaymentMethod('wave');
              }}
            >
              <View style={styles.paymentMethodContent}>
                <Ionicons name="phone-portrait" size={24} color="#1DA1F2" />
                <Text style={styles.paymentMethodTitle}>Wave</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentMethodCard, paymentMethod === 'card' && styles.paymentMethodCardActive]}
              onPress={() => setPaymentMethod('card')}
            >
              <View style={styles.paymentMethodContent}>
                <Ionicons name="card" size={24} color="#e67e22" />
                <Text style={styles.paymentMethodTitle}>Carte bancaire</Text>
              </View>
            </TouchableOpacity>
            {(stripeCheckoutOpened || checkingStatus) && (
              <View style={styles.pendingCard}>
                <ActivityIndicator size="small" color="#e67e22" />
                <Text style={styles.pendingTitle}>Paiement en attente</Text>
                <Text style={styles.pendingText}>Revenez dans l'app après avoir terminé le paiement.</Text>
                {lastPaymentStatus != null && <Text style={styles.pendingStatus}>Statut : {lastPaymentStatus}</Text>}
              </View>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.payButton, (loading || stripeCheckoutOpened || checkingStatus) && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={loading || stripeCheckoutOpened || checkingStatus}
            >
              {loading || checkingStatus ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  {paymentMethod === 'wave' ? `Payer ${formatAmount(amount)} avec Wave` : `Payer ${payInEur ? formatPriceForPayment(cardTotalAmount) : formatAmount(cardTotalAmount)} par carte`}
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  content: { padding: 20 },
  summaryCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryTotal: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#333' },
  summaryTotalLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  summaryTotalValue: { fontSize: 18, fontWeight: 'bold', color: '#e67e22' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  paymentMethodCard: { borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 },
  paymentMethodCardActive: { borderColor: '#e67e22', backgroundColor: '#fff7ed' },
  paymentMethodContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentMethodTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  pendingCard: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 16, marginTop: 16 },
  pendingTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  pendingText: { fontSize: 14, color: '#666' },
  pendingStatus: { fontSize: 12, color: '#888', marginTop: 4 },
  footer: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#f3f4f6' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#666' },
  payButton: { backgroundColor: '#e67e22' },
  payButtonDisabled: { opacity: 0.6 },
  payButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

export default HostRefundPaymentModal;
