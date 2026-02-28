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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useCurrency } from '../hooks/useCurrency';

interface ModificationSurplusPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  surplusAmount: number;
  bookingId: string;
  onPaymentComplete: () => void;
  propertyTitle?: string;
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
  originalTotalPrice,
  newTotalPrice,
  priceBreakdown,
}) => {
  const { currency, rates, formatPriceForPayment } = useCurrency();
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'card' | 'paypal' | 'cash'>('wave');
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    phoneNumber: '',
    pin: '',
    paypalEmail: '',
  });
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const formatPrice = (price: number) => formatPriceForPayment(price);

  const validatePaymentInfo = (): boolean => {
    if (paymentMethod === 'card') return true; // Redirection Stripe, pas de saisie carte
    if (paymentMethod === 'wave' || ['orange_money', 'mtn_money', 'moov_money'].includes(paymentMethod)) {
      if (!paymentInfo.phoneNumber) {
        Alert.alert('Erreur', 'Veuillez remplir le numéro de téléphone');
        return false;
      }
      if (paymentInfo.phoneNumber.replace(/\D/g, '').length < 10) {
        Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
        return false;
      }
    } else if (paymentMethod === 'paypal') {
      if (!paymentInfo.paypalEmail) {
        Alert.alert('Erreur', 'Veuillez entrer votre email PayPal');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(paymentInfo.paypalEmail)) {
        Alert.alert('Erreur', 'Veuillez entrer une adresse email PayPal valide');
        return false;
      }
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
          property_title: propertyTitle || 'Surplus modification',
          payment_type: 'modification_surplus',
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
        amount: surplusAmount,
        payment_method: paymentMethod,
        payment_provider: paymentProvider,
      };

      if (paymentMethod === 'wave' || ['orange_money', 'mtn_money', 'moov_money'].includes(paymentMethod)) {
        paymentData.mobile_money_phone = paymentInfo.phoneNumber;
        paymentData.mobile_money_operator = paymentMethod === 'wave' ? 'wave' : paymentMethod;
      }
      if (paymentMethod === 'paypal') {
        paymentData.paypal_email = paymentInfo.paypalEmail;
      }

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
              phoneNumber: ['wave', 'orange_money', 'mtn_money', 'moov_money'].includes(paymentMethod) ? paymentInfo.phoneNumber : null,
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

              {/* Orange Money */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'orange_money' && styles.paymentMethodSelected]}
                onPress={() => setPaymentMethod('orange_money')}
              >
                <Ionicons name="phone-portrait" size={24} color={paymentMethod === 'orange_money' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'orange_money' && styles.paymentMethodTextSelected]}>Orange Money</Text>
                {paymentMethod === 'orange_money' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* MTN Money */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'mtn_money' && styles.paymentMethodSelected]}
                onPress={() => setPaymentMethod('mtn_money')}
              >
                <Ionicons name="phone-portrait" size={24} color={paymentMethod === 'mtn_money' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'mtn_money' && styles.paymentMethodTextSelected]}>MTN Money</Text>
                {paymentMethod === 'mtn_money' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* Moov Money */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'moov_money' && styles.paymentMethodSelected]}
                onPress={() => setPaymentMethod('moov_money')}
              >
                <Ionicons name="phone-portrait" size={24} color={paymentMethod === 'moov_money' ? '#e67e22' : '#6b7280'} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'moov_money' && styles.paymentMethodTextSelected]}>Moov Money</Text>
                {paymentMethod === 'moov_money' && <Ionicons name="checkmark-circle" size={20} color="#e67e22" />}
              </TouchableOpacity>

              {/* PayPal */}
              <TouchableOpacity
                style={[styles.paymentMethod, paymentMethod === 'paypal' && styles.paymentMethodSelected]}
                onPress={() => setPaymentMethod('paypal')}
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

            {(paymentMethod === 'wave' || ['orange_money', 'mtn_money', 'moov_money'].includes(paymentMethod)) && (
              <View style={[styles.paymentFormSection, { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8f9fa', padding: 16, borderRadius: 8 }]}>
                <Ionicons name="shield-checkmark" size={24} color={paymentMethod === 'wave' ? '#8b5cf6' : paymentMethod === 'orange_money' ? '#f97316' : paymentMethod === 'mtn_money' ? '#eab308' : '#3b82f6'} />
                <Text style={[styles.inputLabel, { flex: 1, marginBottom: 0 }]}>
                  Vous serez redirigé vers un paiement sécurisé via {paymentMethod === 'wave' ? 'Wave' : paymentMethod === 'orange_money' ? 'Orange Money' : paymentMethod === 'mtn_money' ? 'MTN Money' : 'Moov Money'} pour régler le surplus.
                </Text>
              </View>
            )}

            {paymentMethod === 'card' && (
              <View style={styles.paymentFormSection}>
                <Text style={styles.inputLabel}>Numéro de carte *</Text>
                <TextInput style={styles.phoneInput} placeholder="1234 5678 9012 3456" value={paymentInfo.cardNumber} maxLength={19} keyboardType="numeric"
                  onChangeText={(value) => {
                    let formatted = value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
                    formatted = formatted.match(/.{1,4}/g)?.join(' ') || formatted;
                    setPaymentInfo(prev => ({ ...prev, cardNumber: formatted }));
                  }}
                  placeholderTextColor="#9ca3af"
                />
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Nom du titulaire *</Text>
                <TextInput style={styles.phoneInput} placeholder="Jean Dupont" value={paymentInfo.cardHolder}
                  onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, cardHolder: value.toUpperCase() }))} autoCapitalize="characters" placeholderTextColor="#9ca3af"
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Mois *</Text>
                    <TextInput style={styles.phoneInput} placeholder="MM" value={paymentInfo.expiryMonth} maxLength={2} keyboardType="numeric"
                      onChangeText={(value) => {
                        const month = value.replace(/[^0-9]/g, '').slice(0, 2);
                        if (month && parseInt(month) > 12) return;
                        setPaymentInfo(prev => ({ ...prev, expiryMonth: month }));
                      }}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Année *</Text>
                    <TextInput style={styles.phoneInput} placeholder="YYYY" value={paymentInfo.expiryYear} maxLength={4} keyboardType="numeric"
                      onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, expiryYear: value.replace(/[^0-9]/g, '').slice(0, 4) }))}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>CVV *</Text>
                    <TextInput style={styles.phoneInput} placeholder="123" value={paymentInfo.cvv} maxLength={4} keyboardType="numeric" secureTextEntry
                      onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, cvv: value.replace(/[^0-9]/g, '').slice(0, 4) }))}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
                <View style={styles.securityInfo}>
                  <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                  <Text style={styles.securityText}>🔒 Vos informations sont sécurisées</Text>
                </View>
              </View>
            )}

            {paymentMethod === 'paypal' && (
              <View style={styles.paymentFormSection}>
                <Text style={styles.inputLabel}>Email PayPal *</Text>
                <TextInput style={styles.phoneInput} placeholder="votre.email@example.com" value={paymentInfo.paypalEmail}
                  onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, paypalEmail: value }))} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9ca3af"
                />
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

