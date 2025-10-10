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
  const { sendBookingConfirmation, sendBookingRequestToHost } = useEmailService();
  
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [message, setMessage] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);

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
    
    const pricing = calculateFinalPrice(basePrice, nights, discountConfig);
    
    console.log('💰 Résultat du calcul:', pricing);
    
    return {
      nights,
      ...pricing
    };
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

    const { finalTotal } = calculateTotal();
    
    const result = await createBooking({
      propertyId: property.id,
      checkInDate: checkIn.toISOString().split('T')[0],
      checkOutDate: checkOut.toISOString().split('T')[0],
      guestsCount: totalGuests,
      adultsCount: adults,
      childrenCount: children,
      infantsCount: infants,
      totalPrice: finalTotal,
      messageToHost: message.trim() || undefined,
    });

    if (result.success) {
      const isAutoBooking = property.auto_booking === true;
      
      // Envoyer l'email de confirmation au voyageur
      try {
        await sendBookingConfirmation({
          userEmail: user.email || '',
          userName: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Utilisateur',
          propertyTitle: property.title,
          checkInDate: checkIn.toISOString().split('T')[0],
          checkOutDate: checkOut.toISOString().split('T')[0],
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
            await sendBookingRequestToHost(hostData.email, {
              hostName: `${hostData.first_name || ''} ${hostData.last_name || ''}`.trim() || 'Hôte',
              guestName: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Voyageur',
              propertyTitle: property.title,
              checkInDate: checkIn.toISOString().split('T')[0],
              checkOutDate: checkOut.toISOString().split('T')[0],
              totalPrice: finalTotal,
              guestsCount: totalGuests,
              message: message.trim() || undefined
            });
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
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de votre réservation. Veuillez réessayer.');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
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
              
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Frais de nettoyage</Text>
                <Text style={styles.priceValue}>{formatPrice(fees.cleaningFee)}</Text>
              </View>
              
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Frais de service</Text>
                <Text style={styles.priceValue}>{formatPrice(fees.serviceFee)}</Text>
              </View>
              
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(finalTotal)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bouton de réservation */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.bookButton, loading && styles.bookButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.bookButtonText}>
                {property.auto_booking ? 'Réserver maintenant' : 'Envoyer une demande'}
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
