import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Booking } from '../hooks/useBookings';
import { useBookingModifications } from '../hooks/useBookingModifications';
import { useAuth } from '../services/AuthContext';
import AvailabilityCalendar from './AvailabilityCalendar';
import { getAveragePriceForPeriod } from '../utils/priceCalculator';

interface BookingModificationModalProps {
  visible: boolean;
  onClose: () => void;
  booking: Booking;
  onModificationRequested?: () => void;
}

const BookingModificationModal: React.FC<BookingModificationModalProps> = ({
  visible,
  onClose,
  booking,
  onModificationRequested,
}) => {
  const { user } = useAuth();
  const { createModificationRequest, getBookingPendingRequest, loading } = useBookingModifications();
  
  // Initialiser les dates directement depuis booking
  const [checkIn, setCheckIn] = useState<Date | null>(() => {
    try {
      return booking.check_in_date ? new Date(booking.check_in_date) : null;
    } catch {
      return null;
    }
  });
  const [checkOut, setCheckOut] = useState<Date | null>(() => {
    try {
      return booking.check_out_date ? new Date(booking.check_out_date) : null;
    } catch {
      return null;
    }
  });
  const [guestsCount, setGuestsCount] = useState(booking.guests_count);
  const [message, setMessage] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);
  const [effectivePrice, setEffectivePrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const property = booking.properties;
  const pricePerNight = property?.price_per_night || 0;
  const cleaningFee = property?.cleaning_fee || 0;
  const serviceFee = property?.service_fee || 0;
  const maxGuests = property?.max_guests || 10;

  useEffect(() => {
    if (visible) {
      const checkInDate = new Date(booking.check_in_date);
      const checkOutDate = new Date(booking.check_out_date);
      // S'assurer que les dates sont valides
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        console.error('❌ Dates invalides:', { checkInDate, checkOutDate, booking });
        Alert.alert('Erreur', 'Les dates de réservation sont invalides');
        return;
      }
      setCheckIn(checkInDate);
      setCheckOut(checkOutDate);
      setGuestsCount(booking.guests_count);
      setMessage('');
      setShowCalendar(false); // S'assurer que le calendrier est fermé
      checkPendingRequest();
      console.log('📅 Dates initialisées:', { checkInDate, checkOutDate, guestsCount: booking.guests_count, propertyId: property?.id });
    } else {
      // Réinitialiser quand le modal se ferme
      setShowCalendar(false);
    }
  }, [visible, booking]);
  
  // Log pour déboguer l'état de showCalendar
  useEffect(() => {
    console.log('📅 État showCalendar:', showCalendar, 'calendarMode:', calendarMode);
  }, [showCalendar, calendarMode]);

  useEffect(() => {
    const loadEffectivePrice = async () => {
      if (checkIn && checkOut && property?.id) {
        setLoadingPrice(true);
        try {
          const avgPrice = await getAveragePriceForPeriod(
            property.id,
            checkIn,
            checkOut,
            pricePerNight
          );
          setEffectivePrice(avgPrice);
        } catch (error) {
          console.error('Error loading effective price:', error);
          setEffectivePrice(pricePerNight);
        } finally {
          setLoadingPrice(false);
        }
      } else {
        setEffectivePrice(null);
      }
    };

    if (checkIn && checkOut) {
      loadEffectivePrice();
    }
  }, [checkIn, checkOut, property?.id, pricePerNight]);

  const checkPendingRequest = async () => {
    setCheckingPending(true);
    const pending = await getBookingPendingRequest(booking.id);
    setHasPendingRequest(!!pending);
    setCheckingPending(false);
  };

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const diffTime = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const nights = calculateNights();
  const subtotal = (effectivePrice || pricePerNight) * nights;
  const newTotalPrice = subtotal + cleaningFee + serviceFee;

  const hasChanges = 
    checkIn && checkOut &&
    (checkIn.toISOString().split('T')[0] !== booking.check_in_date ||
     checkOut.toISOString().split('T')[0] !== booking.check_out_date ||
     guestsCount !== booking.guests_count);

  const priceDifference = newTotalPrice - booking.total_price;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (selectedCheckIn: Date | null, selectedCheckOut: Date | null) => {
    if (selectedCheckIn) {
      setCheckIn(selectedCheckIn);
    }
    if (selectedCheckOut) {
      setCheckOut(selectedCheckOut);
    }
  };

  const handleSubmit = async () => {
    if (!user || !property?.host_id || !hasChanges || !checkIn || !checkOut) {
      return;
    }

    if (nights < 1) {
      Alert.alert('Erreur', 'La date de départ doit être après la date d\'arrivée');
      return;
    }

    if (guestsCount > maxGuests) {
      Alert.alert('Erreur', `Le nombre maximum de voyageurs est ${maxGuests}`);
      return;
    }

    const result = await createModificationRequest({
      bookingId: booking.id,
      guestId: user.id,
      hostId: property.host_id,
      originalCheckIn: booking.check_in_date,
      originalCheckOut: booking.check_out_date,
      originalGuestsCount: booking.guests_count,
      originalTotalPrice: booking.total_price,
      requestedCheckIn: formatDateForAPI(checkIn),
      requestedCheckOut: formatDateForAPI(checkOut),
      requestedGuestsCount: guestsCount,
      requestedTotalPrice: newTotalPrice,
      guestMessage: message.trim() || undefined,
    });

    if (result.success) {
      onClose();
      onModificationRequested?.();
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const originalNights = Math.ceil(
    (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) 
    / (1000 * 60 * 60 * 24)
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier la réservation</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          scrollEnabled={true}
          nestedScrollEnabled={false}
          scrollEventThrottle={16}
        >
          {checkingPending ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>Vérification...</Text>
            </View>
          ) : hasPendingRequest ? (
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle" size={64} color="#f39c12" />
              <Text style={styles.alertTitle}>Demande en cours</Text>
              <Text style={styles.alertText}>
                Vous avez déjà une demande de modification en attente pour cette réservation.
                Veuillez attendre la réponse de l'hôte.
              </Text>
            </View>
          ) : (
            <>
              {/* Propriété */}
              <View style={styles.propertyCard}>
                <Text style={styles.propertyTitle}>{property?.title || 'Propriété'}</Text>
                <Text style={styles.propertyDates}>
                  Réservation actuelle: {formatDate(new Date(booking.check_in_date))} - {formatDate(new Date(booking.check_out_date))}
                </Text>
              </View>

              {/* Nouvelles dates */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nouvelles dates</Text>
                <View style={styles.dateRow}>
                  <TouchableOpacity
                    style={styles.dateButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log('📅 Ouvrir calendrier check-in, checkIn actuel:', checkIn);
                      console.log('📅 property?.id:', property?.id);
                      if (!property?.id) {
                        Alert.alert('Erreur', 'Propriété non trouvée');
                        return;
                      }
                      setCalendarMode('checkIn');
                      setShowCalendar(true);
                      console.log('📅 showCalendar mis à true, calendarMode:', 'checkIn');
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                    <View style={styles.dateButtonContent}>
                      <Text style={styles.dateLabel}>Arrivée</Text>
                      <Text style={styles.dateValue}>
                        {checkIn ? formatDate(checkIn) : 'Sélectionner'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dateButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log('📅 Ouvrir calendrier check-out, checkOut actuel:', checkOut);
                      console.log('📅 property?.id:', property?.id);
                      if (!property?.id) {
                        Alert.alert('Erreur', 'Propriété non trouvée');
                        return;
                      }
                      setCalendarMode('checkOut');
                      setShowCalendar(true);
                      console.log('📅 showCalendar mis à true, calendarMode:', 'checkOut');
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                    <View style={styles.dateButtonContent}>
                      <Text style={styles.dateLabel}>Départ</Text>
                      <Text style={styles.dateValue}>
                        {checkOut ? formatDate(checkOut) : 'Sélectionner'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nombre de voyageurs */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nombre de voyageurs</Text>
                <View style={styles.guestsSelector}>
                  <TouchableOpacity
                    style={styles.guestButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      const newCount = Math.max(1, guestsCount - 1);
                      console.log('➖ Diminuer voyageurs:', guestsCount, '->', newCount);
                      setGuestsCount(newCount);
                    }}
                    disabled={guestsCount <= 1}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Ionicons name="remove-circle-outline" size={24} color={guestsCount <= 1 ? "#ccc" : "#2E7D32"} />
                  </TouchableOpacity>
                  <Text style={styles.guestCount}>{guestsCount}</Text>
                  <TouchableOpacity
                    style={styles.guestButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      const newCount = Math.min(maxGuests, guestsCount + 1);
                      console.log('➕ Augmenter voyageurs:', guestsCount, '->', newCount);
                      setGuestsCount(newCount);
                    }}
                    disabled={guestsCount >= maxGuests}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={guestsCount >= maxGuests ? "#ccc" : "#2E7D32"} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Résumé des changements */}
              {hasChanges && (
                <View style={styles.changesCard}>
                  <Text style={styles.changesTitle}>Résumé des modifications</Text>
                  
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Dates:</Text>
                    <Text style={styles.changeValue}>
                      {formatDate(new Date(booking.check_in_date))} - {formatDate(new Date(booking.check_out_date))}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#666" />
                    <Text style={styles.changeValueNew}>
                      {checkIn && checkOut ? `${formatDate(checkIn)} - ${formatDate(checkOut)}` : ''}
                    </Text>
                  </View>

                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Voyageurs:</Text>
                    <Text style={styles.changeValue}>{booking.guests_count}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#666" />
                    <Text style={styles.changeValueNew}>{guestsCount}</Text>
                  </View>

                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Nuits:</Text>
                    <Text style={styles.changeValue}>{originalNights}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#666" />
                    <Text style={styles.changeValueNew}>{nights}</Text>
                  </View>

                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Nouveau total</Text>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceValue}>{formatPrice(newTotalPrice)}</Text>
                      {priceDifference !== 0 && (
                        <Text style={[
                          styles.priceDifference,
                          priceDifference > 0 ? styles.priceIncrease : styles.priceDecrease
                        ]}>
                          {priceDifference > 0 ? '+' : ''}{formatPrice(priceDifference)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Message à l'hôte */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Message à l'hôte (optionnel)</Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Expliquez pourquoi vous souhaitez modifier votre réservation..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.submitButton, (!hasChanges || nights < 1 || loading) && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!hasChanges || nights < 1 || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Envoyer la demande</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.infoText}>
                L'hôte devra approuver votre demande de modification.
                Vous serez notifié de sa réponse.
              </Text>
            </>
          )}
        </ScrollView>

        {/* Calendrier modal */}
        {property?.id && showCalendar && (
          <Modal
            visible={showCalendar}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => {
              console.log('❌ Fermer calendrier via onRequestClose');
              setShowCalendar(false);
            }}
          >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
              <View style={styles.header}>
                <TouchableOpacity 
                  onPress={() => {
                    console.log('❌ Fermer calendrier via bouton');
                    setShowCalendar(false);
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                  {calendarMode === 'checkIn' ? 'Date d\'arrivée' : 'Date de départ'}
                </Text>
                <View style={styles.placeholder} />
              </View>
              <View style={{ flex: 1 }}>
                <AvailabilityCalendar
                  propertyId={property.id}
                  selectedCheckIn={calendarMode === 'checkIn' ? checkIn : null}
                  selectedCheckOut={calendarMode === 'checkOut' ? checkOut : null}
                  onDateSelect={(selectedCheckIn, selectedCheckOut) => {
                    console.log('📅 Dates sélectionnées:', { selectedCheckIn, selectedCheckOut, calendarMode });
                    if (calendarMode === 'checkIn' && selectedCheckIn) {
                      setCheckIn(selectedCheckIn);
                      if (checkOut && selectedCheckIn >= checkOut) {
                        const newCheckOut = new Date(selectedCheckIn);
                        newCheckOut.setDate(newCheckOut.getDate() + 1);
                        setCheckOut(newCheckOut);
                      }
                    } else if (calendarMode === 'checkOut' && selectedCheckOut) {
                      setCheckOut(selectedCheckOut);
                    }
                    console.log('📅 Fermeture du calendrier après sélection');
                    setShowCalendar(false);
                  }}
                  onClose={() => {
                    console.log('📅 Calendrier fermé via onClose');
                    setShowCalendar(false);
                  }}
                />
              </View>
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
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
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  alertText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  propertyCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  propertyDates: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 60,
  },
  dateButtonPressed: {
    backgroundColor: '#f0f0f0',
    borderColor: '#2E7D32',
  },
  dateButtonContent: {
    marginLeft: 12,
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  guestsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  guestButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonPressed: {
    opacity: 0.6,
  },
  guestButtonDisabled: {
    opacity: 0.3,
  },
  guestCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center',
  },
  changesCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  changesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  changeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  changeValue: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  changeValueNew: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  priceDifference: {
    fontSize: 14,
    marginTop: 4,
  },
  priceIncrease: {
    color: '#e74c3c',
  },
  priceDecrease: {
    color: '#27ae60',
  },
  messageInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});

export default BookingModificationModal;

