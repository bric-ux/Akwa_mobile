import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
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

const PenaltyPaymentModal: React.FC<PenaltyPaymentModalProps> = ({
  visible,
  onClose,
  penalty,
  onPaymentComplete,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'card' | 'cash'>('card');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handlePayment = async () => {
    if (!penalty) return;

    if (paymentMethod === 'wave') {
      Alert.alert('Bientot disponible', 'Wave sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.');
      return;
    }

    if (paymentMethod === 'card') {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
          body: {
            booking_id: penalty.booking_id,
            amount: penalty.penalty_amount,
            property_title: penalty.booking?.property?.title || 'Paiement de penalite',
            payment_type: 'penalty',
            penalty_id: penalty.id,
          },
        });
        if (error) throw error;
        if (data?.url) {
          Linking.openURL(data.url);
          onClose();
          return;
        }
        throw new Error(data?.error || 'Impossible d\'ouvrir la page de paiement');
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Impossible d\'ouvrir le paiement Stripe');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      // Mettre à jour le statut de la pénalité
      const { error } = await supabase
        .from('penalty_tracking')
        .update({
          status: 'paid_directly',
          deducted_at: new Date().toISOString(),
          admin_notes: 'Paiement en espèces déclaré par le voyageur',
        })
        .eq('id', penalty.id);

      if (error) throw error;

      // Envoyer email de confirmation à l'admin
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'penalty_payment_received',
          to: 'contact@akwahome.com',
          data: {
            penaltyId: penalty.id,
            amount: penalty.penalty_amount,
            paymentMethod: paymentMethod === 'cash' ? 'Especes' : 'Carte bancaire',
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
          'Votre declaration de paiement en especes a ete enregistree.',
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
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={styles.successTitle}>Paiement initié !</Text>
            <Text style={styles.successText}>
              Votre déclaration de paiement en espèces a été enregistrée.
            </Text>
          </View>
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
              style={[
                styles.paymentMethodCard,
                paymentMethod === 'wave' && styles.paymentMethodCardActive,
              ]}
              onPress={() => Alert.alert('Bientot disponible', 'Wave sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.')}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#1DA1F2' }]}>
                  <Ionicons name="phone-portrait" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Wave</Text>
                  <Text style={styles.paymentMethodSubtitle}>Paiement mobile instantané</Text>
                </View>
                <Ionicons
                  name={paymentMethod === 'wave' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={paymentMethod === 'wave' ? '#e67e22' : '#ccc'}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentMethodCard,
                paymentMethod === 'card' && styles.paymentMethodCardActive,
              ]}
              onPress={() => setPaymentMethod('card')}
            >
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIcon, { backgroundColor: '#e67e22' }]}>
                  <Ionicons name="card" size={24} color="#fff" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Carte bancaire</Text>
                  <Text style={styles.paymentMethodSubtitle}>Visa, Mastercard</Text>
                </View>
                <Ionicons
                  name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={paymentMethod === 'card' ? '#e67e22' : '#ccc'}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentMethodCard,
                paymentMethod === 'cash' && styles.paymentMethodCardActive,
              ]}
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
                <Ionicons
                  name={paymentMethod === 'cash' ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={paymentMethod === 'cash' ? '#e67e22' : '#ccc'}
                />
              </View>
            </TouchableOpacity>

            {/* Info carte bancaire */}
            {paymentMethod === 'card' && (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={20} color="#f59e0b" />
                <Text style={styles.infoText}>
                  Vous serez redirigé vers Stripe pour effectuer le paiement de la pénalité en toute sécurité.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.payButton, loading && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  Payer {formatAmount(penalty.penalty_amount)}
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
  successContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    margin: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default PenaltyPaymentModal;

