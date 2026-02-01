import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

interface VehicleModificationSurplusPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  surplusAmount: number;
  bookingId: string;
  onPaymentComplete: () => void;
  vehicleTitle?: string;
  originalTotalPrice?: number;
  newTotalPrice?: number;
  priceBreakdown?: {
    daysPriceDiff?: number;
    hoursPriceDiff?: number;
    discountDiff?: number;
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
  vehicleTitle,
  originalTotalPrice,
  newTotalPrice,
  priceBreakdown,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'card' | 'mobile_money' | 'cash'>('wave');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handlePayment = async () => {
    if (paymentMethod === 'wave' && !phoneNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro Wave');
      return;
    }

    if (paymentMethod === 'mobile_money' && !phoneNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre numéro de téléphone');
      return;
    }

    setLoading(true);
    try {
      // Mapper payment_method à payment_provider
      const getPaymentProvider = (method: string): string => {
        switch (method) {
          case 'wave':
            return 'wave';
          case 'mobile_money':
            return 'orange_money';
          case 'card':
            return 'stripe';
          case 'cash':
            return 'manual';
          default:
            return 'manual';
        }
      };

      // Créer un enregistrement de paiement pour le surplus de modification via Edge Function
      const paymentProvider = getPaymentProvider(paymentMethod);
      const paymentData: any = {
        booking_id: bookingId,
        booking_type: 'vehicle', // Indiquer que c'est une réservation véhicule
        amount: surplusAmount,
        payment_method: paymentMethod,
        payment_provider: paymentProvider,
      };

      if (paymentMethod === 'wave' || paymentMethod === 'mobile_money') {
        paymentData.mobile_money_phone = phoneNumber;
        if (paymentMethod === 'wave') {
          paymentData.mobile_money_operator = 'wave';
        } else {
          paymentData.mobile_money_operator = 'orange_money';
        }
      }

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
              phoneNumber: paymentMethod !== 'cash' ? phoneNumber : null,
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
        onPaymentComplete();
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
              <Text style={styles.amountLabel}>Montant à payer</Text>
              <Text style={styles.amountValue}>{formatPrice(surplusAmount)}</Text>
              <Text style={styles.amountNote}>
                Ce montant correspond au surplus de votre modification de réservation.
              </Text>
            </View>

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
                
                {priceBreakdown.discountDiff !== undefined && priceBreakdown.discountDiff !== 0 && (
                  <View style={styles.priceDetailRow}>
                    <Text style={styles.priceDetailLabel}>Différence réduction:</Text>
                    <Text style={[styles.priceDetailValue, priceBreakdown.discountDiff > 0 ? styles.decreaseValue : styles.increaseValue]}>
                      {priceBreakdown.discountDiff > 0 ? '+' : ''}{formatPrice(priceBreakdown.discountDiff)}
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
                  <Text style={styles.surplusValue}>{formatPrice(surplusAmount)}</Text>
                </View>
              </View>
            )}

            <View style={styles.paymentMethodsSection}>
              <Text style={styles.sectionTitle}>Méthode de paiement</Text>

              {/* Wave */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  paymentMethod === 'wave' && styles.paymentMethodSelected,
                ]}
                onPress={() => setPaymentMethod('wave')}
              >
                <Ionicons name="wallet" size={24} color={paymentMethod === 'wave' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'wave' && styles.paymentMethodTextSelected]}>
                  Wave
                </Text>
                {paymentMethod === 'wave' && (
                  <Ionicons name="checkmark-circle" size={20} color="#e67e22" />
                )}
              </TouchableOpacity>

              {/* Mobile Money */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  paymentMethod === 'mobile_money' && styles.paymentMethodSelected,
                ]}
                onPress={() => setPaymentMethod('mobile_money')}
              >
                <Ionicons name="phone-portrait" size={24} color={paymentMethod === 'mobile_money' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'mobile_money' && styles.paymentMethodTextSelected]}>
                  Mobile Money
                </Text>
                {paymentMethod === 'mobile_money' && (
                  <Ionicons name="checkmark-circle" size={20} color="#e67e22" />
                )}
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
                  Espèces (à l'arrivée)
                </Text>
                {paymentMethod === 'cash' && (
                  <Ionicons name="checkmark-circle" size={20} color="#e67e22" />
                )}
              </TouchableOpacity>
            </View>

            {(paymentMethod === 'wave' || paymentMethod === 'mobile_money') && (
              <View style={styles.phoneInputSection}>
                <Text style={styles.inputLabel}>
                  {paymentMethod === 'wave' ? 'Numéro Wave' : 'Numéro de téléphone'}
                </Text>
                <View style={styles.phoneInputContainer}>
                  <Ionicons name="call" size={20} color="#6b7280" style={styles.phoneIcon} />
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder={paymentMethod === 'wave' ? 'Ex: +225 07 12 34 56 78' : 'Ex: +225 07 12 34 56 78'}
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />
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
                  <Text style={styles.payButtonText}>Payer {formatPrice(surplusAmount)}</Text>
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

