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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Booking } from '../hooks/useBookings';
import { useBookingModifications, BookingModificationRequest } from '../hooks/useBookingModifications';
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
  const { createModificationRequest, getBookingPendingRequest, cancelModificationRequest, loading } = useBookingModifications();
  
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
  const [calendarMode, setCalendarMode] = useState<'checkIn' | 'checkOut' | 'both'>('both');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<BookingModificationRequest | null>(null);
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
      setCalendarMode('both'); // Réinitialiser le mode calendrier
      checkPendingRequest();
      console.log('📅 Dates initialisées:', { checkInDate, checkOutDate, guestsCount: booking.guests_count, propertyId: property?.id });
    } else {
      // Réinitialiser quand le modal se ferme
      setShowCalendar(false);
      setCalendarMode('both');
    }
  }, [visible, booking]);
  
  // Log pour déboguer l'état de showCalendar
  useEffect(() => {
    console.log('📅 État showCalendar:', showCalendar);
  }, [showCalendar]);

  // Calculer les dates effectives pour le calcul du prix
  const effectiveCheckInForPrice = checkIn || new Date(booking.check_in_date);
  const effectiveCheckOutForPrice = checkOut || new Date(booking.check_out_date);

  useEffect(() => {
    const loadEffectivePrice = async () => {
      if (property?.id) {
        setLoadingPrice(true);
        try {
          // Utiliser les dates effectives (modifiées ou originales) pour calculer le prix
          const avgPrice = await getAveragePriceForPeriod(
            property.id,
            effectiveCheckInForPrice,
            effectiveCheckOutForPrice,
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

    loadEffectivePrice();
  }, [effectiveCheckInForPrice, effectiveCheckOutForPrice, property?.id, pricePerNight]);

  const checkPendingRequest = async () => {
    setCheckingPending(true);
    const pending = await getBookingPendingRequest(booking.id);
    setHasPendingRequest(!!pending);
    setPendingRequest(pending);
    setCheckingPending(false);
  };

  // Fonctions utilitaires pour le formatage des dates (définies en premier)
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

  // Utiliser les dates actuelles si elles ne sont pas modifiées
  const effectiveCheckIn = checkIn || new Date(booking.check_in_date);
  const effectiveCheckOut = checkOut || new Date(booking.check_out_date);
  
  const calculateNights = () => {
    if (!effectiveCheckIn || !effectiveCheckOut) return 0;
    const diffTime = effectiveCheckOut.getTime() - effectiveCheckIn.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };
  
  const nights = calculateNights();
  const subtotal = (effectivePrice || pricePerNight) * nights;
  const newTotalPrice = subtotal + cleaningFee + serviceFee;

  // Vérifier s'il y a des changements (dates ou nombre de voyageurs)
  const checkInChanged = checkIn && formatDateForAPI(checkIn) !== booking.check_in_date;
  const checkOutChanged = checkOut && formatDateForAPI(checkOut) !== booking.check_out_date;
  const guestsChanged = guestsCount !== booking.guests_count;
  
  const hasChanges = checkInChanged || checkOutChanged || guestsChanged;

  const priceDifference = newTotalPrice - booking.total_price;

  const handleDateSelect = (selectedCheckIn: Date | null, selectedCheckOut: Date | null) => {
    if (selectedCheckIn) {
      setCheckIn(selectedCheckIn);
    }
    if (selectedCheckOut) {
      setCheckOut(selectedCheckOut);
    }
  };

  const handleSubmit = async () => {
    // Fermer le clavier avant de soumettre
    Keyboard.dismiss();
    
    if (!user || !property?.host_id || !hasChanges) {
      return;
    }

    // Utiliser les dates actuelles si elles ne sont pas modifiées
    const finalCheckIn = checkIn || new Date(booking.check_in_date);
    const finalCheckOut = checkOut || new Date(booking.check_out_date);

    // Vérifier que les dates sont valides
    if (finalCheckOut <= finalCheckIn) {
      Alert.alert('Erreur', 'La date de départ doit être après la date d\'arrivée');
      return;
    }

    const finalNights = Math.ceil(
      (finalCheckOut.getTime() - finalCheckIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (finalNights < 1) {
      Alert.alert('Erreur', 'La date de départ doit être après la date d\'arrivée');
      return;
    }

    if (guestsCount > maxGuests) {
      Alert.alert('Erreur', `Le nombre maximum de voyageurs est ${maxGuests}`);
      return;
    }

    // Recalculer le prix avec les dates finales
    // Si effectivePrice n'est pas encore chargé, le recalculer maintenant
    let finalEffectivePrice = effectivePrice;
    if (!finalEffectivePrice || loadingPrice) {
      try {
        finalEffectivePrice = await getAveragePriceForPeriod(
          property.id,
          finalCheckIn,
          finalCheckOut,
          pricePerNight
        );
      } catch (error) {
        console.error('Error calculating final price:', error);
        finalEffectivePrice = pricePerNight;
      }
    }
    
    const finalSubtotal = finalEffectivePrice * finalNights;
    const finalTotalPrice = finalSubtotal + cleaningFee + serviceFee;

    const result = await createModificationRequest({
      bookingId: booking.id,
      guestId: user.id,
      hostId: property.host_id,
      originalCheckIn: booking.check_in_date,
      originalCheckOut: booking.check_out_date,
      originalGuestsCount: booking.guests_count,
      originalTotalPrice: booking.total_price,
      requestedCheckIn: formatDateForAPI(finalCheckIn),
      requestedCheckOut: formatDateForAPI(finalCheckOut),
      requestedGuestsCount: guestsCount,
      requestedTotalPrice: finalTotalPrice,
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

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
          ) : hasPendingRequest && pendingRequest ? (
            <>
              <View style={styles.pendingRequestCard}>
                <View style={styles.pendingRequestHeader}>
                  <Ionicons name="time-outline" size={24} color="#f39c12" />
                  <Text style={styles.pendingRequestTitle}>Demande en attente</Text>
                </View>
                <Text style={styles.pendingRequestSubtitle}>
                  Votre demande de modification est en cours d'examen par l'hôte.
                </Text>

                {/* Détails de la demande */}
                <View style={styles.requestDetails}>
                  <Text style={styles.requestDetailsTitle}>Détails de votre demande</Text>
                  
                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Dates demandées:</Text>
                    <Text style={styles.requestDetailValue}>
                      {formatDate(new Date(pendingRequest.requested_check_in))} - {formatDate(new Date(pendingRequest.requested_check_out))}
                    </Text>
                  </View>

                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Nombre de voyageurs:</Text>
                    <Text style={styles.requestDetailValue}>{pendingRequest.requested_guests_count}</Text>
                  </View>

                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Nouveau total:</Text>
                    <Text style={styles.requestDetailValue}>{formatPrice(pendingRequest.requested_total_price)}</Text>
                  </View>

                  {pendingRequest.guest_message && (
                    <View style={styles.requestMessageBox}>
                      <Text style={styles.requestMessageLabel}>Votre message:</Text>
                      <Text style={styles.requestMessageText}>{pendingRequest.guest_message}</Text>
                    </View>
                  )}

                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Date de la demande:</Text>
                    <Text style={styles.requestDetailValue}>
                      {formatDate(new Date(pendingRequest.created_at))}
                    </Text>
                  </View>
                </View>

                {/* Bouton d'annulation */}
                <TouchableOpacity
                  style={styles.cancelRequestButton}
                  onPress={async () => {
                    Alert.alert(
                      'Annuler la demande',
                      'Êtes-vous sûr de vouloir annuler cette demande de modification ?',
                      [
                        { text: 'Non', style: 'cancel' },
                        {
                          text: 'Oui, annuler',
                          style: 'destructive',
                          onPress: async () => {
                            const result = await cancelModificationRequest(pendingRequest.id);
                            if (result.success) {
                              setHasPendingRequest(false);
                              setPendingRequest(null);
                              checkPendingRequest();
                            }
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#e74c3c" />
                  <Text style={styles.cancelRequestButtonText}>Annuler la demande</Text>
                </TouchableOpacity>
              </View>
            </>
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
                <View style={styles.datesContainer}>
                  {/* Date d'arrivée */}
                  <TouchableOpacity
                    style={styles.dateButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (!property?.id) {
                        Alert.alert('Erreur', 'Propriété non trouvée');
                        return;
                      }
                      setCalendarMode('checkIn');
                      setShowCalendar(true);
                    }}
                  >
                    <View style={styles.dateButtonContent}>
                      <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                      <View style={styles.dateButtonTextContainer}>
                        <Text style={styles.dateButtonLabel}>Arrivée</Text>
                        <Text style={[styles.dateButtonValue, !checkIn && styles.dateButtonPlaceholder]}>
                          {checkIn ? formatDate(checkIn) : 'Sélectionner'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#666" />
                  </TouchableOpacity>

                  {/* Date de départ */}
                  <TouchableOpacity
                    style={styles.dateButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (!property?.id) {
                        Alert.alert('Erreur', 'Propriété non trouvée');
                        return;
                      }
                      // Permettre la sélection de la date de départ même si l'arrivée n'est pas modifiée
                      // (on utilisera la date d'arrivée actuelle de la réservation)
                      setCalendarMode('checkOut');
                      setShowCalendar(true);
                    }}
                  >
                    <View style={styles.dateButtonContent}>
                      <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                      <View style={styles.dateButtonTextContainer}>
                        <Text style={styles.dateButtonLabel}>Départ</Text>
                        <Text style={[styles.dateButtonValue, !checkOut && styles.dateButtonPlaceholder]}>
                          {checkOut ? formatDate(checkOut) : 'Sélectionner'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
                {(effectiveCheckIn && effectiveCheckOut) && (
                  <View style={styles.nightsContainer}>
                    <Text style={styles.nightsText}>
                      {nights} {nights === 1 ? 'nuit' : 'nuits'}
                    </Text>
                  </View>
                )}
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
                  
                  {(checkInChanged || checkOutChanged) && (
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Dates:</Text>
                      <Text style={styles.changeValue}>
                        {formatDate(new Date(booking.check_in_date))} - {formatDate(new Date(booking.check_out_date))}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                      <Text style={styles.changeValueNew}>
                        {formatDate(effectiveCheckIn)} - {formatDate(effectiveCheckOut)}
                      </Text>
                    </View>
                  )}

                  {guestsChanged && (
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Voyageurs:</Text>
                      <Text style={styles.changeValue}>{booking.guests_count}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                      <Text style={styles.changeValueNew}>{guestsCount}</Text>
                    </View>
                  )}

                  {(checkInChanged || checkOutChanged) && (
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Nuits:</Text>
                      <Text style={styles.changeValue}>{originalNights}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                      <Text style={styles.changeValueNew}>{nights}</Text>
                    </View>
                  )}

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
                  style={[styles.button, styles.submitButton, (!hasChanges || loading) && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!hasChanges || loading}
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
        </KeyboardAvoidingView>

        {/* Calendrier modal */}
        {property?.id && showCalendar && (
          <Modal
            visible={showCalendar}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => {
              setShowCalendar(false);
            }}
          >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
              <View style={styles.header}>
                <TouchableOpacity 
                  onPress={() => {
                    setShowCalendar(false);
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                  {calendarMode === 'checkIn' ? 'Sélectionner la date d\'arrivée' : 
                   calendarMode === 'checkOut' ? 'Sélectionner la date de départ' : 
                   'Sélectionner les dates'}
                </Text>
                <View style={styles.placeholder} />
              </View>
              <View style={{ flex: 1 }}>
                <AvailabilityCalendar
                  propertyId={property.id}
                  selectedCheckIn={calendarMode === 'checkIn' || calendarMode === 'both' ? checkIn : null}
                  selectedCheckOut={calendarMode === 'checkOut' || calendarMode === 'both' ? checkOut : null}
                  mode={calendarMode}
                  showHeader={false}
                  onDateSelect={(selectedCheckIn, selectedCheckOut) => {
                    if (calendarMode === 'checkIn' && selectedCheckIn) {
                      setCheckIn(selectedCheckIn);
                      // Si la nouvelle date d'arrivée est >= date de départ, ajuster la date de départ
                      if (checkOut && selectedCheckIn >= checkOut) {
                        const newCheckOut = new Date(selectedCheckIn);
                        newCheckOut.setDate(newCheckOut.getDate() + 1);
                        setCheckOut(newCheckOut);
                      }
                    } else if (calendarMode === 'checkOut' && selectedCheckOut) {
                      setCheckOut(selectedCheckOut);
                    } else if (calendarMode === 'both') {
                      if (selectedCheckIn) {
                        setCheckIn(selectedCheckIn);
                      }
                      if (selectedCheckOut) {
                        setCheckOut(selectedCheckOut);
                      }
                    }
                  }}
                  onClose={() => {
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
    paddingBottom: 40, // Espace supplémentaire pour le clavier
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
  datesContainer: {
    gap: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 60,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateButtonTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  dateButtonLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateButtonValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  dateButtonPlaceholder: {
    color: '#999',
    fontWeight: '400',
  },
  nightsContainer: {
    marginTop: 8,
    paddingLeft: 4,
  },
  nightsText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
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
  pendingRequestCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  pendingRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingRequestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  pendingRequestSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  requestDetails: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  requestDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  requestDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  requestDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  requestMessageBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
  requestMessageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  requestMessageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  cancelRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e74c3c',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelRequestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e74c3c',
  },
});

export default BookingModificationModal;

