import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Property } from '../types';
import { useBookings } from '../hooks/useBookings';
import { useAuth } from '../services/AuthContext';
import { usePricing, calculateFinalPrice } from '../hooks/usePricing';
import { useEmailService } from '../hooks/useEmailService';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import BookingIdentityAlert from './BookingIdentityAlert';
import { supabase } from '../services/supabase';
import AvailabilityCalendar from './AvailabilityCalendar';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  property: Property;
}

const BookingModal: React.FC<BookingModalProps> = ({ visible, onClose, property }) => {
  const { user } = useAuth();
  const { createBooking, loading } = useBookings();
  const { sendBookingConfirmation, sendBookingRequest } = useEmailService();
  const { hasUploadedIdentity, isVerified, loading: identityLoading } = useIdentityVerification();
  
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [message, setMessage] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'orange_money' | 'mtn_money' | 'moov_money' | 'wave' | 'cash'>('card');
  const [paymentPlan, setPaymentPlan] = useState<'full' | 'split'>('full');
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    phoneNumber: '',
    pin: ''
  });

  const totalGuests = adults + children + infants;

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const diffTime = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const calculateTotal = () => {
    const nights = calculateNights();
    const basePrice = property.price_per_night || 0;
    
    // Configuration de réduction - utiliser les vrais noms de colonnes de la base de données
    const discountConfig = {
      enabled: property.discount_enabled || false,
      minNights: property.discount_min_nights || null,
      percentage: property.discount_percentage || null
    };
    
    console.log('🔍 Calcul des prix:', {
      basePrice,
      nights,
      discountConfig,
      property: {
        discount_enabled: property.discount_enabled,
        discount_min_nights: property.discount_min_nights,
        discount_percentage: property.discount_percentage
      }
    });
    
    const pricing = calculateFinalPrice(basePrice, nights, discountConfig, {
      cleaning_fee: property.cleaning_fee,
      service_fee: property.service_fee,
      taxes: property.taxes
    });
    
    console.log('💰 Résultat du calcul:', pricing);
    
    return {
      nights,
      ...pricing
    };
  };

  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour faire une réservation');
      return;
    }

    if (!checkIn || !checkOut) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates d\'arrivée et de départ');
      return;
    }

    const nights = calculateNights();
    const minimumNights = property.minimum_nights || 1;
    
    if (nights < minimumNights) {
      Alert.alert(
        'Durée insuffisante',
        `Cette propriété nécessite un minimum de ${minimumNights} nuit${minimumNights > 1 ? 's' : ''}`
      );
      return;
    }

    if (totalGuests > (property.max_guests || 10)) {
      Alert.alert(
        'Erreur',
        `Le nombre maximum de voyageurs est ${property.max_guests || 10}`
      );
      return;
    }

    // Valider les informations de paiement
    if (!validatePaymentInfo()) {
      return;
    }

    const { finalTotal } = calculateTotal();
    
    const result = await createBooking({
      propertyId: property.id,
      checkInDate: formatDateForAPI(checkIn),
      checkOutDate: formatDateForAPI(checkOut),
      guestsCount: totalGuests,
      adultsCount: adults,
      childrenCount: children,
      infantsCount: infants,
      totalPrice: finalTotal,
      messageToHost: message.trim() || undefined,
    });

    // Vérifier les erreurs d'identité (même logique que le site web)
    if (!result.success && 'error' in result) {
      if (result.error === 'IDENTITY_REQUIRED') {
        Alert.alert(
          'Vérification d\'identité requise',
          'Vous devez télécharger une pièce d\'identité pour effectuer une réservation. Rendez-vous dans votre profil.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (result.error === 'IDENTITY_NOT_VERIFIED') {
        Alert.alert(
          'Identité en cours de vérification',
          'Votre pièce d\'identité est en cours de vérification. Vous pourrez réserver une fois qu\'elle sera validée par notre équipe.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    if (result.success) {
      const isAutoBooking = property.auto_booking === true;
      
      // Envoyer l'email de confirmation au voyageur
      try {
        await sendBookingConfirmation({
          userEmail: user.email || '',
          userName: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Utilisateur',
          propertyTitle: property.title,
          checkInDate: formatDateForAPI(checkIn),
          checkOutDate: formatDateForAPI(checkOut),
          totalPrice: finalTotal,
          isAutoBooking,
          guestsCount: totalGuests,
          message: message.trim() || undefined
        });
      } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email au voyageur:', error);
      }

      // Envoyer l'email à l'hôte (si ce n'est pas une réservation automatique)
      if (!isAutoBooking) {
        try {
          // Récupérer les informations de l'hôte
          const { data: hostData, error: hostError } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', property.host_id)
            .single();

          if (!hostError && hostData?.email) {
            await sendBookingRequest(
              hostData.email,
              `${hostData.first_name || ''} ${hostData.last_name || ''}`.trim() || 'Hôte',
              `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Voyageur',
              property.title,
              formatDateForAPI(checkIn),
              formatDateForAPI(checkOut),
              totalGuests,
              finalTotal,
              message.trim() || undefined
            );
          }
        } catch (error) {
          console.error('Erreur lors de l\'envoi de l\'email à l\'hôte:', error);
        }
      }
      
      Alert.alert(
        isAutoBooking ? 'Réservation confirmée !' : 'Demande envoyée !',
        isAutoBooking 
          ? 'Votre réservation a été confirmée automatiquement. Vous recevrez une confirmation par email.'
          : 'Votre demande de réservation a été envoyée au propriétaire. Vous recevrez une notification lorsqu\'il répondra.',
        [{ text: 'OK', onPress: onClose }]
      );
      
      // Réinitialiser le formulaire
      setCheckIn(null);
      setCheckOut(null);
      setAdults(1);
      setChildren(0);
      setInfants(0);
      setMessage('');
    } else {
      console.error('Erreur de réservation:', result.error || 'Erreur inconnue');
      Alert.alert(
        'Erreur', 
        result.error || 'Une erreur est survenue lors de l\'envoi de votre réservation. Veuillez réessayer.'
      );
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const validatePaymentInfo = () => {
    if (selectedPaymentMethod === 'card') {
      if (!paymentInfo.cardNumber || !paymentInfo.cardHolder || !paymentInfo.expiryMonth || !paymentInfo.expiryYear || !paymentInfo.cvv) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs de la carte bancaire');
        return false;
      }
      if (paymentInfo.cardNumber.replace(/\s/g, '').length < 16) {
        Alert.alert('Erreur', 'Le numéro de carte doit contenir au moins 16 chiffres');
        return false;
      }
      if (paymentInfo.cvv.length < 3) {
        Alert.alert('Erreur', 'Le code CVV doit contenir au moins 3 chiffres');
        return false;
      }
    } else if (selectedPaymentMethod === 'wave') {
      if (!paymentInfo.phoneNumber || !paymentInfo.pin) {
        Alert.alert('Erreur', 'Veuillez remplir le numéro de téléphone et le code PIN Wave');
        return false;
      }
      if (paymentInfo.phoneNumber.length < 10) {
        Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
        return false;
      }
    } else if (['orange_money', 'mtn_money', 'moov_money'].includes(selectedPaymentMethod)) {
      if (!paymentInfo.phoneNumber || !paymentInfo.pin) {
        Alert.alert('Erreur', 'Veuillez remplir le numéro de téléphone et le code PIN Mobile Money');
        return false;
      }
      if (paymentInfo.phoneNumber.length < 10) {
        Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
        return false;
      }
    }
    return true;
  };

  const { nights, pricing, fees, finalTotal } = calculateTotal();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Réserver</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Informations de la propriété */}
          <View style={styles.propertyInfo}>
            <Text style={styles.propertyTitle}>{property.title}</Text>
            <Text style={styles.propertyLocation}>
              📍 {property.cities?.name || property.location}
            </Text>
            <Text style={styles.propertyPrice}>
              {formatPrice(property.price_per_night || 0)}/nuit
            </Text>
          </View>

          {/* Vérification d'identité */}
          {!isVerified && (
            <View style={styles.identitySection}>
              <BookingIdentityAlert />
            </View>
          )}

          {/* Sélection des dates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dates de séjour</Text>
            <TouchableOpacity 
              style={styles.dateSelector}
              onPress={() => setShowCalendar(true)}
            >
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Arrivée</Text>
                <Text style={styles.dateValue}>
                  {checkIn ? checkIn.toLocaleDateString('fr-FR') : 'Sélectionner'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Départ</Text>
                <Text style={styles.dateValue}>
                  {checkOut ? checkOut.toLocaleDateString('fr-FR') : 'Sélectionner'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Nombre de voyageurs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voyageurs</Text>
            
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Adultes (13+ ans)</Text>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setAdults(Math.max(1, adults - 1))}
                >
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{adults}</Text>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setAdults(adults + 1)}
                >
                  <Ionicons name="add" size={20} color="#2E7D32" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Enfants (2-12 ans)</Text>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setChildren(Math.max(0, children - 1))}
                >
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{children}</Text>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setChildren(children + 1)}
                >
                  <Ionicons name="add" size={20} color="#2E7D32" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Bébés (moins de 2 ans)</Text>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setInfants(Math.max(0, infants - 1))}
                >
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{infants}</Text>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setInfants(infants + 1)}
                >
                  <Ionicons name="add" size={20} color="#2E7D32" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Message à l'hôte */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message à l'hôte (optionnel)</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Dites quelque chose à votre hôte..."
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Résumé des prix */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Résumé des prix</Text>
            <View style={styles.priceBreakdown}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>
                  {formatPrice(property.price_per_night || 0)} × {nights} nuit{nights > 1 ? 's' : ''}
                </Text>
                <Text style={styles.priceValue}>{formatPrice(pricing.originalTotal)}</Text>
              </View>
              
              {pricing.discountApplied && (
                <View style={styles.priceRow}>
                  <Text style={styles.discountLabel}>
                    Réduction ({property.discount_percentage}% pour {property.discount_min_nights}+ nuits)
                  </Text>
                  <Text style={styles.discountValue}>-{formatPrice(pricing.discountAmount)}</Text>
                </View>
              )}
              
              {fees.cleaningFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Frais de nettoyage</Text>
                  <Text style={styles.priceValue}>{formatPrice(fees.cleaningFee)}</Text>
                </View>
              )}
              
              {fees.serviceFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Frais de service</Text>
                  <Text style={styles.priceValue}>{formatPrice(fees.serviceFee)}</Text>
                </View>
              )}
              
              {fees.taxes > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Taxes</Text>
                  <Text style={styles.priceValue}>{formatPrice(fees.taxes)}</Text>
                </View>
              )}
              
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(finalTotal)}</Text>
              </View>
            </View>
          </View>

        {/* Plan de paiement */}
        {checkIn && checkOut && selectedPaymentMethod !== 'cash' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Plan de paiement</Text>
            <View style={styles.paymentPlanContainer}>
              <TouchableOpacity
                style={[
                  styles.paymentPlanOption,
                  paymentPlan === 'full' && styles.paymentPlanSelected
                ]}
                onPress={() => setPaymentPlan('full')}
              >
                <View style={styles.paymentPlanContent}>
                  <Ionicons 
                    name="card" 
                    size={24} 
                    color={paymentPlan === 'full' ? '#2E7D32' : '#666'} 
                  />
                  <View style={styles.paymentPlanInfo}>
                    <Text style={[
                      styles.paymentPlanTitle,
                      paymentPlan === 'full' && styles.paymentPlanTitleSelected
                    ]}>
                      Paiement complet
                    </Text>
                    <Text style={styles.paymentPlanDescription}>
                      {formatPrice(finalTotal)} maintenant
                    </Text>
                  </View>
                  {paymentPlan === 'full' && (
                    <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentPlanOption,
                  paymentPlan === 'split' && styles.paymentPlanSelected
                ]}
                onPress={() => setPaymentPlan('split')}
              >
                <View style={styles.paymentPlanContent}>
                  <Ionicons 
                    name="calendar" 
                    size={24} 
                    color={paymentPlan === 'split' ? '#2E7D32' : '#666'} 
                  />
                  <View style={styles.paymentPlanInfo}>
                    <Text style={[
                      styles.paymentPlanTitle,
                      paymentPlan === 'split' && styles.paymentPlanTitleSelected
                    ]}>
                      Paiement échelonné
                    </Text>
                    <Text style={styles.paymentPlanDescription}>
                      50% maintenant ({formatPrice(finalTotal * 0.5)}), 50% à l'arrivée
                    </Text>
                  </View>
                  {paymentPlan === 'split' && (
                    <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Options de paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Méthode de paiement</Text>
            
            <View style={styles.paymentMethods}>
              {/* Carte bancaire */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'card' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('card');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="card" size={24} color="#2563eb" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Carte bancaire</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Visa, Mastercard, American Express
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'card' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'card' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Orange Money */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'orange_money' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('orange_money');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#f97316" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Orange Money</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile Orange
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'orange_money' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'orange_money' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* MTN Money */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'mtn_money' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('mtn_money');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#eab308" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>MTN Money</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile MTN
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'mtn_money' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'mtn_money' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Moov Money */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'moov_money' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('moov_money');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#3b82f6" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Moov Money</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile Moov
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'moov_money' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'moov_money' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Wave */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'wave' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('wave');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#8b5cf6" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Wave</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile Wave
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'wave' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'wave' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Espèces */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'cash' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('cash');
                  setPaymentPlan('full'); // Espèces = paiement complet à l'arrivée
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="cash" size={24} color="#6b7280" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Espèces</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement complet à l'arrivée ({formatPrice(finalTotal)})
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'cash' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'cash' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Formulaire de paiement détaillé */}
          {selectedPaymentMethod && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations de paiement</Text>
              
              {/* Formulaire pour carte bancaire */}
              {selectedPaymentMethod === 'card' && (
                <View style={styles.paymentForm}>
                  <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Numéro de carte *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="1234 5678 9012 3456"
                        value={paymentInfo.cardNumber}
                        onChangeText={(value) => {
                          // Formatage automatique avec espaces
                          let formattedValue = value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
                          formattedValue = formattedValue.match(/.{1,4}/g)?.join(' ') || formattedValue;
                          setPaymentInfo(prev => ({ ...prev, cardNumber: formattedValue }));
                        }}
                        maxLength={19}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Nom du titulaire *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Jean Dupont"
                        value={paymentInfo.cardHolder}
                        onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, cardHolder: value.toUpperCase() }))}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                  
                  <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Mois *</Text>
                      <View style={styles.selectContainer}>
                        <TextInput
                          style={styles.input}
                          placeholder="MM"
                          value={paymentInfo.expiryMonth}
                          onChangeText={(value) => {
                            const month = value.replace(/[^0-9]/g, '').slice(0, 2);
                            if (month && parseInt(month) > 12) return;
                            setPaymentInfo(prev => ({ ...prev, expiryMonth: month }));
                          }}
                          maxLength={2}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Année *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY"
                        value={paymentInfo.expiryYear}
                        onChangeText={(value) => {
                          const year = value.replace(/[^0-9]/g, '').slice(0, 4);
                          setPaymentInfo(prev => ({ ...prev, expiryYear: year }));
                        }}
                        maxLength={4}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>CVV *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="123"
                        value={paymentInfo.cvv}
                        onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, cvv: value.replace(/[^0-9]/g, '').slice(0, 4) }))}
                        maxLength={4}
                        keyboardType="numeric"
                        secureTextEntry
                      />
                    </View>
                  </View>
                  
                  <View style={styles.securityInfo}>
                    <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                    <Text style={styles.securityText}>
                      🔒 Vos informations de carte sont sécurisées et chiffrées
                    </Text>
                  </View>
                </View>
              )}

              {/* Formulaire pour Wave */}
              {selectedPaymentMethod === 'wave' && (
                <View style={styles.paymentForm}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Numéro de téléphone Wave *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="+225 07 12 34 56 78"
                      value={paymentInfo.phoneNumber}
                      onChangeText={(value) => {
                        // Formatage automatique du numéro
                        let formattedValue = value.replace(/\D/g, '');
                        if (formattedValue.startsWith('225')) {
                          formattedValue = '+' + formattedValue;
                        } else if (formattedValue.startsWith('07') || formattedValue.startsWith('05')) {
                          formattedValue = '+225 ' + formattedValue;
                        }
                        setPaymentInfo(prev => ({ ...prev, phoneNumber: formattedValue }));
                      }}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Code PIN Wave *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Votre code PIN Wave"
                      value={paymentInfo.pin}
                      onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, pin: value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                      maxLength={6}
                      keyboardType="numeric"
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.securityInfo}>
                    <Ionicons name="phone-portrait" size={16} color="#8b5cf6" />
                    <Text style={styles.securityText}>
                      📱 Vous recevrez une notification Wave pour confirmer le paiement
                    </Text>
                  </View>
                </View>
              )}

              {/* Formulaire pour Orange Money, MTN Money, Moov Money */}
              {(selectedPaymentMethod === 'orange_money' || selectedPaymentMethod === 'mtn_money' || selectedPaymentMethod === 'moov_money') && (
                <View style={styles.paymentForm}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>
                      Numéro de téléphone {selectedPaymentMethod === 'orange_money' ? 'Orange' : selectedPaymentMethod === 'mtn_money' ? 'MTN' : 'Moov'} *
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="+225 07 12 34 56 78"
                      value={paymentInfo.phoneNumber}
                      onChangeText={(value) => {
                        // Formatage automatique du numéro
                        let formattedValue = value.replace(/\D/g, '');
                        if (formattedValue.startsWith('225')) {
                          formattedValue = '+' + formattedValue;
                        } else if (formattedValue.startsWith('07') || formattedValue.startsWith('05')) {
                          formattedValue = '+225 ' + formattedValue;
                        }
                        setPaymentInfo(prev => ({ ...prev, phoneNumber: formattedValue }));
                      }}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Code PIN Mobile Money *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Votre code PIN"
                      value={paymentInfo.pin}
                      onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, pin: value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                      maxLength={6}
                      keyboardType="numeric"
                      secureTextEntry
                    />
                  </View>
                  <View style={styles.securityInfo}>
                    <Ionicons name="phone-portrait" size={16} color={selectedPaymentMethod === 'orange_money' ? '#f97316' : selectedPaymentMethod === 'mtn_money' ? '#eab308' : '#3b82f6'} />
                    <Text style={styles.securityText}>
                      📱 Vous recevrez une notification {selectedPaymentMethod === 'orange_money' ? 'Orange Money' : selectedPaymentMethod === 'mtn_money' ? 'MTN Money' : 'Moov Money'} pour confirmer le paiement
                    </Text>
                  </View>
                </View>
              )}

              {/* Message pour espèces */}
              {selectedPaymentMethod === 'cash' && (
                <View style={styles.paymentForm}>
                  <View style={styles.cashInfo}>
                    <Ionicons name="cash" size={48} color="#6b7280" />
                    <Text style={styles.cashTitle}>Paiement en espèces</Text>
                    <Text style={styles.cashDescription}>
                      Vous paierez directement à l'hôte lors de votre arrivée. 
                      Assurez-vous d'avoir le montant exact en espèces.
                    </Text>
                    <View style={styles.cashAmount}>
                      <Text style={styles.cashAmountLabel}>Montant à payer :</Text>
                      <Text style={styles.cashAmountValue}>{formatPrice(finalTotal)}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Bouton de réservation */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.bookButton, 
              (loading || identityLoading || !isVerified) && styles.bookButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={loading || identityLoading || !isVerified}
          >
            {loading || identityLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.bookButtonText}>
                {!isVerified 
                  ? 'Vérification d\'identité requise'
                  : selectedPaymentMethod === 'cash'
                    ? 'Confirmer la réservation'
                    : paymentPlan === 'split'
                      ? `Payer ${formatPrice(finalTotal * 0.5)} maintenant`
                      : property.auto_booking 
                        ? 'Payer et réserver' 
                        : 'Envoyer une demande'
                }
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Calendrier de disponibilité */}
      {showCalendar && (
        <Modal
          visible={showCalendar}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCalendar(false)}
        >
          <AvailabilityCalendar
            propertyId={property.id}
            selectedCheckIn={checkIn}
            selectedCheckOut={checkOut}
            onDateSelect={(checkInDate, checkOutDate) => {
              setCheckIn(checkInDate);
              setCheckOut(checkOutDate);
            }}
            onClose={() => setShowCalendar(false)}
          />
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  propertyInfo: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  identitySection: {
    marginHorizontal: 20,
    marginVertical: 10,
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dateValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  guestLabel: {
    fontSize: 16,
    color: '#333',
  },
  guestControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  guestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 20,
    textAlign: 'center',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    textAlignVertical: 'top',
  },
  priceBreakdown: {
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333',
  },
  discountLabel: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  // Styles pour les plans de paiement
  paymentPlanContainer: {
    gap: 12,
  },
  paymentPlanOption: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
  },
  paymentPlanSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0f9f0',
  },
  paymentPlanContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentPlanInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentPlanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentPlanTitleSelected: {
    color: '#2E7D32',
  },
  paymentPlanDescription: {
    fontSize: 14,
    color: '#666',
  },
  // Styles pour les options de paiement
  paymentMethods: {
    gap: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  paymentMethodSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fef7f0',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#666',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  securityText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  // Styles pour les formulaires de paiement
  paymentForm: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  selectContainer: {
    flex: 1,
  },
  // Styles pour le paiement en espèces
  cashInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cashTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
  },
  cashDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  cashAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cashAmountLabel: {
    fontSize: 16,
    color: '#374151',
    marginRight: 8,
  },
  cashAmountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  bookButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BookingModal;
