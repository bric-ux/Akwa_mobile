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
import { createWaveCheckoutSession, openWavePayment } from '../services/wavePaymentService';
import CardPaymentSuccessView from './CardPaymentSuccessView';
import { formatAmount } from '../utils/priceCalculator';

interface PenaltyPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  penalty: {
    id: string;
    penalty_amount: number;
    booking_id: string;
    penalty_type: string;
    booking?: {
      property?: {
        title: string;
      } | null;
      check_in_date?: string;
      check_out_date?: string;
    } | null;
  } | null;
  onPaymentComplete: () => void;
}

const AKWAHOME_RIB = 'FR76 1759 8000 0100 0121 8085 961';
const AKWAHOME_WAVE = '+225 07 79 57 13 48';

type PenaltyPaymentMethod = 'bank_transfer' | 'wave' | 'deduct_from_next_booking' | 'card' | 'cash';

const PenaltyPaymentModal: React.FC<PenaltyPaymentModalProps> = ({
  visible,
  onClose,
  penalty,
  onPaymentComplete,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PenaltyPaymentMethod>('card');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [pendingWaveCheckoutToken, setPendingWaveCheckoutToken] = useState<string | null>(null);
  const [pendingWaveReturn, setPendingWaveReturn] = useState(false);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const checkingRef = useRef(false);

  const resetPendingWaveState = useCallback(() => {
    setPendingWaveCheckoutToken(null);
    setPendingWaveReturn(false);
    setCheckingPaymentStatus(false);
  }, []);

  const checkPenaltyWavePaymentStatus = useCallback(async (token?: string | null) => {
    if (!penalty) return false;
    const checkoutToken = token ?? pendingWaveCheckoutToken;
    if (!checkoutToken) return false;
    try {
      const result = await checkPaymentStatus({
        payment_type: 'penalty',
        penalty_id: penalty.id,
        checkout_token: checkoutToken,
        wave: true,
      });
      return result.is_confirmed ?? false;
    } catch {
      return false;
    }
  }, [penalty, pendingWaveCheckoutToken]);

  const verifyWavePaymentNow = useCallback(async () => {
    if (!penalty || !pendingWaveCheckoutToken) return;
    if (checkingRef.current) return;
    checkingRef.current = true;
    setCheckingPaymentStatus(true);
    setPendingWaveReturn(true);
    const confirmed = await checkPenaltyWavePaymentStatus(pendingWaveCheckoutToken);
    checkingRef.current = false;
    setCheckingPaymentStatus(false);
    if (confirmed) {
      resetPendingWaveState();
      setPaymentSuccess(true);
      setTimeout(() => {
        onPaymentComplete();
        onClose();
      }, 1200);
    }
  }, [penalty, pendingWaveCheckoutToken, checkPenaltyWavePaymentStatus, resetPendingWaveState, onPaymentComplete, onClose]);

  useEffect(() => {
    if (!visible) {
      resetPendingWaveState();
      setPaymentMethod('card');
    }
  }, [visible, resetPendingWaveState]);

  useEffect(() => {
    if (!visible || !pendingWaveCheckoutToken || !penalty) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const confirmed = await checkPenaltyWavePaymentStatus();
      if (cancelled) return;
      if (confirmed) {
        resetPendingWaveState();
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentComplete();
          onClose();
        }, 1200);
      }
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, pendingWaveCheckoutToken, penalty, checkPenaltyWavePaymentStatus, resetPendingWaveState, onPaymentComplete, onClose]);

  const handleWaveSuccessUrl = useCallback((url: string | null) => {
    if (!url?.includes('payment-success')) return;
    const typeMatch = url.match(/payment_type=([^&]+)/);
    if (typeMatch?.[1] !== 'penalty') return;
    const tokenMatch = url.match(/checkout_token=([^&]+)/);
    const urlToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (!urlToken || !pendingWaveCheckoutToken || urlToken !== pendingWaveCheckoutToken) return;
    setPendingWaveReturn(true);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(verifyWavePaymentNow, 1000);
    });
  }, [pendingWaveCheckoutToken, verifyWavePaymentNow]);

  useEffect(() => {
    if (!visible) return;
    Linking.getInitialURL().then(handleWaveSuccessUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleWaveSuccessUrl(url));
    return () => sub.remove();
  }, [visible, handleWaveSuccessUrl]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasBackground && nextState === 'active' && pendingWaveCheckoutToken && penalty) {
        timeoutId = setTimeout(verifyWavePaymentNow, 1000);
      }
      appStateRef.current = nextState;
    });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      sub.remove();
    };
  }, [pendingWaveCheckoutToken, penalty, verifyWavePaymentNow]);

  const savePaymentMethodOnly = async (method: 'bank_transfer' | 'wave' | 'deduct_from_next_booking') => {
    if (!penalty) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('penalty_tracking')
        .update({
          payment_method: method,
          admin_notes: method === 'bank_transfer'
            ? 'Pénalité à régler par virement - RIB AkwaHome communiqué.'
            : method === 'wave'
            ? 'Pénalité à régler par Wave - Numéro AkwaHome communiqué.'
            : 'Pénalité à déduire de la prochaine paie.',
        })
        .eq('id', penalty.id);
      if (error) throw error;
      if (method === 'deduct_from_next_booking') {
        Alert.alert(
          'Choix enregistré',
          'La pénalité sera déduite de votre prochaine paie. Elle apparaîtra clairement sur votre facture (retenue pour pénalité d\'annulation).',
          [{ text: 'OK', onPress: () => { onPaymentComplete(); onClose(); setPaymentMethod('card'); } }]
        );
      } else {
        Alert.alert(
          'Coordonnées notées',
          method === 'bank_transfer'
            ? 'Effectuez le virement sur le RIB indiqué. AkwaHome validera le paiement après réception.'
            : 'Effectuez le transfert Wave au numéro indiqué. AkwaHome validera le paiement après réception.',
          [{ text: 'OK', onPress: () => { onPaymentComplete(); onClose(); setPaymentMethod('card'); } }]
        );
      }
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible d\'enregistrer le choix');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!penalty) return;

    if (paymentMethod === 'bank_transfer') {
      await savePaymentMethodOnly(paymentMethod);
      return;
    }

    if (paymentMethod === 'wave') {
      setLoading(true);
      try {
        const checkoutToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
        const result = await createWaveCheckoutSession({
          payment_type: 'penalty',
          penalty_id: penalty.id,
          booking_id: penalty.booking_id,
          amount: penalty.penalty_amount,
          property_title: penalty.booking?.property?.title || 'Paiement de penalite',
          checkout_token: checkoutToken,
          return_to_app: true,
          app_scheme: 'akwahomemobile',
          client: 'mobile',
        });
        setPendingWaveCheckoutToken(result.checkout_token ?? checkoutToken);
        await openWavePayment(result.wave_launch_url);
      } catch (e: unknown) {
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement Wave');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (paymentMethod === 'deduct_from_next_booking') {
      await savePaymentMethodOnly('deduct_from_next_booking');
      return;
    }

    if (paymentMethod === 'card') {
      setLoading(true);
      try {
        const result = await createCheckoutSession({
          booking_id: penalty.booking_id,
          amount: penalty.penalty_amount,
          property_title: penalty.booking?.property?.title || 'Paiement de penalite',
          payment_type: 'penalty',
          penalty_id: penalty.id,
        });
        Linking.openURL(result.url);
        onClose();
      } catch (e: unknown) {
        Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement Stripe');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('penalty_tracking')
        .update({
          payment_method: 'pay_directly',
          status: 'paid_directly',
          deducted_at: new Date().toISOString(),
          admin_notes: 'Paiement en espèces déclaré par l\'hôte',
        })
        .eq('id', penalty.id);

      if (error) throw error;

      await supabase.functions.invoke('send-email', {
        body: {
          type: 'penalty_payment_received',
          to: 'contact@akwahome.com',
          data: {
            penaltyId: penalty.id,
            amount: penalty.penalty_amount,
            paymentMethod: 'Especes',
            phoneNumber: null,
            propertyTitle: penalty.booking?.property?.title || 'N/A',
            checkInDate: penalty.booking?.check_in_date,
            penaltyType: penalty.penalty_type,
          },
        },
      });

      setPaymentSuccess(true);
      setTimeout(() => {
        Alert.alert(
          'Paiement initié',
          'Votre déclaration de paiement en espèces a été enregistrée.',
          [
            {
              text: 'OK',
              onPress: () => {
                onPaymentComplete();
                onClose();
                setPaymentSuccess(false);
                setPaymentMethod('card');
              },
            },
          ]
        );
      }, 2000);
    } catch (error: any) {
      console.error('Erreur paiement:', error);
      Alert.alert('Erreur', 'Impossible de traiter le paiement');
    } finally {
      setLoading(false);
    }
  };

  if (!penalty) return null;

  if (paymentSuccess) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <CardPaymentSuccessView subtitle="Votre déclaration de paiement en espèces a été enregistrée." />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Payer la pénalité</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Récapitulatif */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Propriété</Text>
                <Text style={styles.summaryValue}>
                  {penalty.booking?.property?.title || 'N/A'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>
                  {penalty.penalty_type === 'host_cancellation'
                    ? 'Annulation hôte'
                    : 'Annulation voyageur'}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Montant à payer</Text>
                <Text style={styles.summaryTotalValue}>
                  {formatAmount(penalty.penalty_amount)}
                </Text>
              </View>
            </View>

            {/* Choix du mode de paiement */}
            <Text style={styles.sectionTitle}>Mode de paiement</Text>

            <TouchableOpacity
              style={[styles.paymentMethodCard, paymentMethod === 'bank_transfer' && styles.paymentMethodCardActive]}
              onPress={() => setPaymentMethod('bank_transfer')}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#0ea5e9' }]}>
                  <Ionicons name="business-outline" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Virement bancaire</Text>
                  <Text style={styles.paymentMethodSubtitle}>RIB AkwaHome</Text>
                </View>
                <Ionicons name={paymentMethod === 'bank_transfer' ? 'radio-button-on' : 'radio-button-off'} size={24} color={paymentMethod === 'bank_transfer' ? '#e67e22' : '#ccc'} />
              </View>
            </TouchableOpacity>
            {paymentMethod === 'bank_transfer' && (
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>RIB AkwaHome</Text>
                <Text style={styles.detailValue} selectable>{AKWAHOME_RIB}</Text>
                <Text style={styles.detailHint}>Effectuez un virement de {formatAmount(penalty.penalty_amount)} à ce RIB, puis confirmez votre choix ci-dessous.</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.paymentMethodCard, paymentMethod === 'wave' && styles.paymentMethodCardActive]}
              onPress={() => setPaymentMethod('wave')}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#1DA1F2' }]}>
                  <Ionicons name="phone-portrait" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Wave</Text>
                  <Text style={styles.paymentMethodSubtitle}>Numéro AkwaHome</Text>
                </View>
                <Ionicons name={paymentMethod === 'wave' ? 'radio-button-on' : 'radio-button-off'} size={24} color={paymentMethod === 'wave' ? '#e67e22' : '#ccc'} />
              </View>
            </TouchableOpacity>
            {paymentMethod === 'wave' && (
              <View style={styles.detailBox}>
                <Text style={styles.detailLabel}>Numéro Wave AkwaHome</Text>
                <Text style={styles.detailValue} selectable>{AKWAHOME_WAVE}</Text>
                <Text style={styles.detailHint}>Envoyez {formatAmount(penalty.penalty_amount)} à ce numéro, puis confirmez votre choix ci-dessous.</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.paymentMethodCard, paymentMethod === 'deduct_from_next_booking' && styles.paymentMethodCardActive]}
              onPress={() => setPaymentMethod('deduct_from_next_booking')}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#10b981' }]}>
                  <Ionicons name="wallet-outline" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Déduire de ma prochaine paie</Text>
                  <Text style={styles.paymentMethodSubtitle}>La retenue apparaîtra sur votre facture</Text>
                </View>
                <Ionicons name={paymentMethod === 'deduct_from_next_booking' ? 'radio-button-on' : 'radio-button-off'} size={24} color={paymentMethod === 'deduct_from_next_booking' ? '#e67e22' : '#ccc'} />
              </View>
            </TouchableOpacity>

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

            <TouchableOpacity
              style={[styles.paymentMethodCard, paymentMethod === 'cash' && styles.paymentMethodCardActive]}
              onPress={() => setPaymentMethod('cash')}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#6b7280' }]}>
                  <Ionicons name="cash" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Espèces</Text>
                  <Text style={styles.paymentMethodSubtitle}>Paiement hors application</Text>
                </View>
                <Ionicons name={paymentMethod === 'cash' ? 'radio-button-on' : 'radio-button-off'} size={24} color={paymentMethod === 'cash' ? '#e67e22' : '#ccc'} />
              </View>
            </TouchableOpacity>

            {paymentMethod === 'card' && (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#f59e0b" />
                <Text style={styles.infoText}>
                  Vous serez redirigé vers Stripe pour effectuer le paiement de la pénalité en toute sécurité.
                </Text>
              </View>
            )}
            {paymentMethod === 'wave' && (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#1DA1F2" />
                <Text style={styles.infoText}>
                  Vous serez redirigé vers Wave pour effectuer le paiement de la pénalité en toute sécurité.
                </Text>
              </View>
            )}
            {(pendingWaveCheckoutToken || pendingWaveReturn) && (
              <View style={styles.infoCard}>
                <ActivityIndicator size="small" color="#1DA1F2" />
                <Text style={styles.infoText}>
                  {pendingWaveReturn || checkingPaymentStatus
                    ? 'Vérification du paiement Wave en cours...'
                    : 'Revenez dans l’app après avoir terminé le paiement sur Wave.'}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                if (pendingWaveCheckoutToken || pendingWaveReturn) {
                  resetPendingWaveState();
                }
                onClose();
              }}
              disabled={loading || checkingPaymentStatus}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.payButton, (loading || checkingPaymentStatus || !!pendingWaveCheckoutToken) && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={loading || checkingPaymentStatus || !!pendingWaveCheckoutToken}
            >
              {loading || checkingPaymentStatus ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  {paymentMethod === 'bank_transfer' || paymentMethod === 'wave'
                    ? paymentMethod === 'wave'
                      ? `Payer ${formatAmount(penalty.penalty_amount)} avec Wave`
                      : 'Confirmer mon choix'
                    : paymentMethod === 'deduct_from_next_booking'
                    ? 'Déduire de ma prochaine paie'
                    : paymentMethod === 'cash'
                    ? 'Déclarer le paiement'
                    : `Payer ${formatAmount(penalty.penalty_amount)}`}
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
  inputContainer: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
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

export default PenaltyPaymentModal;

