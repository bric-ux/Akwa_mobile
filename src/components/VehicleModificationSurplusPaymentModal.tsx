import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useCurrency } from '../hooks/useCurrency';

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
  vehicleTitle,
  originalTotalPrice,
  newTotalPrice,
  priceBreakdown,
}) => {
  const { currency, rates } = useCurrency();
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'card' | 'paypal' | 'cash'>('card');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

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

  const handlePayment = async () => {
    if (!validatePaymentInfo()) return;

    if (paymentMethod === 'card') {
      setLoading(true);
      try {
        const body: Record<string, unknown> = {
          booking_id: bookingId,
          amount: surplusAmount,
          property_title: vehicleTitle || 'Surplus modification véhicule',
          payment_type: 'vehicle_modification_surplus',
        };
        if (currency === 'EUR' && rates.EUR) {
          body.currency = 'eur';
          body.rate = rates.EUR;
        } else if (currency === 'USD' && rates.USD) {
          body.currency = 'usd';
          body.rate = rates.USD;
        }
        const { data, error } = await supabase.functions.invoke('create-checkout-session', { body });
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
                  Wave
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
                <Text style={[styles.paymentMethodText, paymentMethod === 'orange_money' && styles.paymentMethodTextSelected]}>Orange Money</Text>
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
                <Text style={[styles.paymentMethodText, paymentMethod === 'moov_money' && styles.paymentMethodTextSelected]}>Moov Money</Text>
                {paymentMethod === 'moov_money' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* PayPal */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'paypal' && styles.paymentMethodSelected]}
                onPress={() => Alert.alert('Bientot disponible', 'PayPal sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.')}
              >
                <Ionicons name="logo-paypal" size={24} color={paymentMethod === 'paypal' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'paypal' && styles.paymentMethodTextSelected]}>PayPal</Text>
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
                  Espèces (à l'arrivée)
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
                  <Text style={styles.surplusValue}>{formatPrice(surplusAmount)}</Text>
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

