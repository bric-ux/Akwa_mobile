import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VehicleBooking } from '../types';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';
import { VehicleDateTimeSelector } from './VehicleDateTimeSelector';
import { formatPrice } from '../utils/priceCalculator';
import { calculateVehiclePriceWithHours, type DiscountConfig } from '../hooks/usePricing';
import VehicleModificationSurplusPaymentModal from './VehicleModificationSurplusPaymentModal';

interface VehicleModificationModalProps {
  visible: boolean;
  onClose: () => void;
  booking: VehicleBooking | null;
  onModified: () => void;
}

const VehicleModificationModal: React.FC<VehicleModificationModalProps> = ({
  visible,
  onClose,
  booking,
  onModified,
}) => {
  const { modifyBooking, loading, getBookingPendingRequest } = useVehicleBookingModifications();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startDateTime, setStartDateTime] = useState<string | undefined>(undefined);
  const [endDateTime, setEndDateTime] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingModificationData, setPendingModificationData] = useState<any>(null);
  const [surplusBreakdown, setSurplusBreakdown] = useState<{
    daysPriceDiff?: number;
    hoursPriceDiff?: number;
    discountDiff?: number;
    serviceFeeDiff?: number;
    serviceFeeHTDiff?: number;
    serviceFeeVATDiff?: number;
  } | null>(null);

  useEffect(() => {
    if (booking && visible) {
      // Pré-remplir avec les dates/heures actuelles de la réservation
      setStartDate(booking.start_date);
      setEndDate(booking.end_date);
      setStartDateTime(booking.start_datetime);
      setEndDateTime(booking.end_datetime);
      setMessage('');
    }
  }, [booking, visible]);

  if (!booking) return null;

  const vehicle = booking.vehicle;
  const dailyRate = booking.daily_rate || vehicle?.price_per_day || 0;

  // Calculer les heures totales et les heures restantes si applicable
  // C'est la source de vérité pour déterminer les jours et heures de location
  const calculateRentalDuration = () => {
    // Si les datetime sont disponibles, les utiliser pour un calcul précis
    if (startDateTime && endDateTime) {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = end.getTime() - start.getTime();
        const totalHours = Math.ceil(diffTime / (1000 * 60 * 60));
        
        // Calculer les jours complets directement à partir des heures totales
        const fullDaysFromHours = Math.floor(totalHours / 24);
        
        // Logique corrigée : utiliser les heures réelles comme base principale
        // Si totalHours >= 24 : utiliser fullDaysFromHours (basé sur les heures réelles)
        // Si totalHours < 24 : facturer 1 jour minimum
        // Ne pas utiliser les jours calendaires qui peuvent donner des résultats incorrects
        let rentalDays: number;
        if (totalHours >= 24) {
          rentalDays = fullDaysFromHours; // Utiliser directement les jours calculés à partir des heures
        } else {
          rentalDays = 1; // Minimum 1 jour pour toute location
        }
        
        console.log('🔍 [VehicleModificationModal] Calcul jours:', {
          totalHours,
          fullDaysFromHours,
          rentalDays
        });
        
        // Calculer les heures restantes : durée totale - (jours complets × 24 heures)
        // Utiliser fullDaysFromHours pour le calcul des heures, pas rentalDays
        const hoursInFullDays = fullDaysFromHours * 24;
        const remainingHours = totalHours - hoursInFullDays;
        
        // Logique de facturation :
        // - Si moins de 24h : facturer 1 jour minimum (pas d'heures supplémentaires)
        // - Si 24h ou plus : facturer les jours complets + les heures restantes
        let finalRentalDays: number;
        let finalRemainingHours: number;
        
        if (totalHours < 24) {
          // Moins de 24h : facturer 1 jour minimum, pas d'heures supplémentaires
          finalRentalDays = 1;
          finalRemainingHours = 0;
        } else {
          // 24h ou plus : utiliser rentalDays calculé (max entre fullDaysFromHours et rentalDaysFromDates)
          // et les heures restantes basées sur fullDaysFromHours
          finalRentalDays = rentalDays;
          finalRemainingHours = remainingHours > 0 ? remainingHours : 0;
        }
        
        return { 
          rentalDays: finalRentalDays, 
          remainingHours: finalRemainingHours, 
          totalHours 
        };
      }
    }
    
    // Si les datetime ne sont pas disponibles, retourner 0 (pas de calcul basé sur les valeurs de la réservation)
    // L'utilisateur doit sélectionner les nouvelles dates/heures
    return { rentalDays: 0, remainingHours: 0, totalHours: 0 };
  };

  const durationCalculation = calculateRentalDuration();
  const rentalDays = durationCalculation.rentalDays;
  const remainingHours = durationCalculation.remainingHours;
  
  // Vérifier si les dates/heures ont été modifiées par rapport à la réservation actuelle
  const hasDatesChanged = startDateTime !== booking.start_datetime || endDateTime !== booking.end_datetime;
  const hasDurationChanged = rentalDays !== (booking.rental_days || 0) || remainingHours !== (booking.rental_hours || 0);
  const hasModification = hasDatesChanged || hasDurationChanged;
  
  // Utiliser hourly_rate de la réservation si disponible, sinon price_per_hour du véhicule
  const hourlyRate = booking.hourly_rate || vehicle?.price_per_hour || 0;
  
  // Calculer les valeurs de la réservation actuelle
  const currentRentalDays = booking.rental_days || 0;
  const currentRentalHours = booking.rental_hours || 0;
  const currentDailyRate = booking.daily_rate || vehicle?.price_per_day || 0;
  const currentHourlyRate = booking.hourly_rate || vehicle?.price_per_hour || 0;
  const currentDaysPrice = currentDailyRate * currentRentalDays;
  const currentHoursPrice = currentRentalHours > 0 && currentHourlyRate > 0 ? currentRentalHours * currentHourlyRate : 0;
  const currentBasePrice = currentDaysPrice + currentHoursPrice;
  const currentDiscountAmount = booking.discount_amount || 0;
  const currentPriceAfterDiscount = currentBasePrice - currentDiscountAmount;
  const currentServiceFee = Math.round(currentPriceAfterDiscount * 0.12); // 10% + 20% TVA = 12%
  const currentTotalPrice = currentPriceAfterDiscount + currentServiceFee;
  
  // Calculer le surplus (différence entre nouvelles et anciennes valeurs)
  const daysDifference = rentalDays - currentRentalDays;
  const hoursDifference = remainingHours - currentRentalHours;
  
  // Pour le calcul du surplus, utiliser le tarif horaire actuel de la réservation
  const surplusDaysPrice = daysDifference > 0 ? daysDifference * dailyRate : 0;
  const surplusHoursPrice = hoursDifference > 0 && currentHourlyRate > 0 ? hoursDifference * currentHourlyRate : 0;
  const surplusBasePrice = surplusDaysPrice + surplusHoursPrice;
  
  // Debug: vérifier le calcul du surplus
  console.log('🔍 [VehicleModificationModal] Calcul surplus détaillé:', {
    daysDifference,
    hoursDifference,
    dailyRate,
    currentHourlyRate,
    vehiclePricePerHour: vehicle?.price_per_hour,
    surplusDaysPrice,
    surplusHoursPrice,
    surplusBasePrice
  });
  
  // Debug: afficher les informations actuelles et le surplus
  console.log('📊 [VehicleModificationModal] === RÉSERVATION ACTUELLE ===');
  console.log('📅 Dates actuelles:', {
    startDate: booking.start_date,
    endDate: booking.end_date,
    startDateTime: booking.start_datetime,
    endDateTime: booking.end_datetime
  });
  console.log('⏱️ Durée actuelle:', {
    rentalDays: currentRentalDays,
    rentalHours: currentRentalHours,
    totalHours: (currentRentalDays * 24) + currentRentalHours
  });
  console.log('💰 Prix actuel:', {
    dailyRate: currentDailyRate,
    hourlyRate: currentHourlyRate,
    daysPrice: currentDaysPrice,
    hoursPrice: currentHoursPrice,
    basePrice: currentBasePrice,
    discountAmount: currentDiscountAmount,
    priceAfterDiscount: currentPriceAfterDiscount,
    serviceFee: currentServiceFee,
    totalPrice: currentTotalPrice
  });
  
  console.log('📊 [VehicleModificationModal] === NOUVELLES VALEURS ===');
  console.log('📅 Nouvelles dates:', {
    startDate,
    endDate,
    startDateTime,
    endDateTime
  });
  console.log('⏱️ Nouvelle durée:', {
    rentalDays,
    remainingHours,
    totalHours: durationCalculation.totalHours
  });
  
  console.log('📊 [VehicleModificationModal] === SURPLUS (DIFFÉRENCE) ===');
  console.log('📈 Différence:', {
    daysDifference,
    hoursDifference,
    totalHoursDifference: (daysDifference * 24) + hoursDifference
  });
  console.log('💰 Prix du surplus:', {
    surplusDaysPrice,
    surplusHoursPrice,
    surplusBasePrice
  });
  
  // Configuration des réductions
  const discountConfig: DiscountConfig = {
    enabled: vehicle?.discount_enabled || false,
    minNights: vehicle?.discount_min_days || null,
    percentage: vehicle?.discount_percentage || null
  };
  
  const longStayDiscountConfig: DiscountConfig | undefined = vehicle?.long_stay_discount_enabled ? {
    enabled: vehicle.long_stay_discount_enabled || false,
    minNights: vehicle.long_stay_discount_min_days || null,
    percentage: vehicle.long_stay_discount_percentage || null
  } : undefined;
  
  // Utiliser la fonction centralisée pour calculer le prix avec heures et réductions
  const priceCalculation = calculateVehiclePriceWithHours(
    dailyRate,
    rentalDays,
    remainingHours,
    hourlyRate,
    discountConfig,
    longStayDiscountConfig
  );
  
  const daysPrice = priceCalculation.daysPrice;
  const hoursPrice = priceCalculation.hoursPrice;
  const basePrice = priceCalculation.basePrice; // Prix après réduction
  const discountAmount = priceCalculation.discountAmount;
  
  // Calculer les frais de service avec TVA (10% + 20% TVA = 12% total)
  const commissionRates = { travelerFeePercent: 10, hostFeePercent: 2 };
  const serviceFeeHT = Math.round(basePrice * (commissionRates.travelerFeePercent / 100));
  const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
  const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
  const totalPrice = basePrice + effectiveServiceFee; // Total avec frais de service

  const handleDateTimeChange = (start: string | undefined, end: string | undefined) => {
    if (start) {
      const startDateObj = new Date(start);
      setStartDate(startDateObj.toISOString().split('T')[0]);
      setStartDateTime(start);
    }
    if (end) {
      const endDateObj = new Date(end);
      setEndDate(endDateObj.toISOString().split('T')[0]);
      setEndDateTime(end);
    }
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates de location');
      return;
    }

    // Comparer les dates en format string pour éviter les problèmes de fuseau horaire
    // Permettre l'égalité pour les locations d'un jour (ex: du 1er au 1er janvier)
    if (endDate < startDate) {
      Alert.alert('Erreur', 'La date de fin ne peut pas être avant la date de début');
      return;
    }

    if (rentalDays < 1) {
      Alert.alert('Erreur', 'La durée de location doit être d\'au moins 1 jour');
      return;
    }

    // Vérifier s'il y a déjà une demande de modification en cours
    try {
      const pendingRequest = await getBookingPendingRequest(booking.id);
      if (pendingRequest) {
        Alert.alert(
          'Demande en cours',
          'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse du propriétaire ou annuler la demande existante.'
        );
        return;
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la demande en cours:', error);
      Alert.alert('Erreur', 'Impossible de vérifier les demandes en cours. Veuillez réessayer.');
      return;
    }

    if (!startDateTime || !endDateTime) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates et heures de prise et de rendu');
      return;
    }

    // Calculer la différence de prix
    const priceDifference = totalPrice - currentTotalPrice;
    
    // Calculer le breakdown du surplus
    // Calculer les frais de service actuels pour la comparaison
    const currentServiceFeeHT = Math.round(currentPriceAfterDiscount * 0.10);
    const currentServiceFeeVAT = Math.round(currentServiceFeeHT * 0.20);
    
    const calculatedSurplusBreakdown = {
      daysPriceDiff: daysPrice - currentDaysPrice,
      hoursPriceDiff: hoursPrice - currentHoursPrice,
      discountDiff: currentDiscountAmount - discountAmount,
      serviceFeeHTDiff: serviceFeeHT - currentServiceFeeHT,
      serviceFeeVATDiff: serviceFeeVAT - currentServiceFeeVAT,
      serviceFeeDiff: effectiveServiceFee - currentServiceFee,
    };
    setSurplusBreakdown(calculatedSurplusBreakdown);

    // Préparer les données de modification
    const modificationData = {
      bookingId: booking.id,
      requestedStartDate: startDate,
      requestedEndDate: endDate,
      requestedStartDateTime: startDateTime,
      requestedEndDateTime: endDateTime,
      requestedRentalDays: rentalDays,
      requestedRentalHours: remainingHours,
      requestedTotalPrice: totalPrice,
      message: message.trim() || undefined,
    };

    // Si le surplus est positif, afficher le modal de paiement
    if (priceDifference > 0) {
      setPendingModificationData(modificationData);
      setShowPaymentModal(true);
    } else {
      // Si pas de surplus, soumettre directement
      setIsSubmitting(true);
      try {
        const result = await modifyBooking(modificationData);

        if (result.success) {
          Alert.alert('Succès', 'La réservation a été modifiée avec succès');
          onModified();
          onClose();
        } else {
          Alert.alert('Erreur', result.error || 'Impossible de modifier la réservation');
        }
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Une erreur est survenue');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handlePaymentComplete = async () => {
    if (!pendingModificationData) return;
    
    // Réinitialiser les valeurs
    setSurplusBreakdown(null);
    
    // Soumettre la demande après le paiement
    setIsSubmitting(true);
    try {
      const result = await modifyBooking(pendingModificationData);
      
      if (result.success) {
        setPendingModificationData(null);
        Alert.alert('Succès', 'La demande de modification a été soumise avec succès');
        onModified();
        onClose();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de soumettre la demande de modification');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="create-outline" size={20} color="#2563eb" />
              <Text style={styles.headerTitle}>Modifier la réservation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Informations actuelles */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Réservation actuelle</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Véhicule:</Text>
                <Text style={styles.infoValue}>
                  {vehicle?.title || `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dates actuelles:</Text>
                <Text style={styles.infoValue}>
                  {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Durée actuelle:</Text>
                <Text style={styles.infoValue}>
                  {booking.rental_days || 0} jour{(booking.rental_days || 0) > 1 ? 's' : ''}
                  {booking.rental_hours && booking.rental_hours > 0 && ` et ${booking.rental_hours} heure${booking.rental_hours > 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Prix actuel:</Text>
                <Text style={styles.infoValue}>{formatPrice(booking.total_price || 0)}</Text>
              </View>
            </View>

            {/* Nouvelles dates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nouvelles dates et heures</Text>
              <VehicleDateTimeSelector
                vehicleId={vehicle?.id || ''}
                startDateTime={startDateTime}
                endDateTime={endDateTime}
                onDateTimeChange={handleDateTimeChange}
              />
              {hasModification && rentalDays > 0 && (
                <View style={styles.summaryBox}>
                  {/* Calculer les différences */}
                  {(() => {
                    const daysDiff = rentalDays - currentRentalDays;
                    const hoursDiff = remainingHours - currentRentalHours;
                    const daysPriceDiff = daysPrice - currentDaysPrice;
                    const hoursPriceDiff = hoursPrice - currentHoursPrice;
                    const discountDiff = currentDiscountAmount - discountAmount;
                    const basePriceDiff = basePrice - currentPriceAfterDiscount;
                    const serviceFeeDiff = effectiveServiceFee - currentServiceFee;
                    const totalDiff = totalPrice - currentTotalPrice;
                    
                    return (
                      <>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Durée:</Text>
                          <Text style={styles.summaryValue}>
                            {daysDiff !== 0 || hoursDiff !== 0 ? (
                              <>
                                {daysDiff !== 0 && `${daysDiff} jour${Math.abs(daysDiff) > 1 ? 's' : ''}`}
                                {daysDiff !== 0 && hoursDiff !== 0 && ' et '}
                                {hoursDiff !== 0 && `${hoursDiff} heure${Math.abs(hoursDiff) > 1 ? 's' : ''}`}
                              </>
                            ) : (
                              'Aucun changement'
                            )}
                          </Text>
                        </View>
                        {(daysPriceDiff !== 0 || hoursPriceDiff !== 0) && (
                          <>
                            {daysPriceDiff !== 0 && (
                              <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Prix des jours:</Text>
                                <Text style={styles.summaryValue} numberOfLines={2}>
                                  {daysPriceDiff > 0 ? '+' : ''}{formatPrice(daysPriceDiff)}{'\n'}
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                    ({daysDiff > 0 ? '+' : ''}{daysDiff} jour{Math.abs(daysDiff) > 1 ? 's' : ''} × {formatPrice(dailyRate)})
                                  </Text>
                                </Text>
                              </View>
                            )}
                            {hoursPriceDiff !== 0 && hoursDiff !== 0 && hourlyRate > 0 && (
                              <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Prix des heures:</Text>
                                <Text style={styles.summaryValue} numberOfLines={2}>
                                  {hoursPriceDiff > 0 ? '+' : ''}{formatPrice(hoursPriceDiff)}{'\n'}
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                    ({hoursDiff > 0 ? '+' : ''}{hoursDiff} h × {formatPrice(hourlyRate)}/h)
                                  </Text>
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                        {discountDiff !== 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, discountDiff > 0 ? { color: '#059669' } : { color: '#e74c3c' }]}>
                              {discountDiff > 0 ? 'Réduction supplémentaire:' : 'Réduction réduite:'}
                            </Text>
                            <Text style={[styles.summaryValue, discountDiff > 0 ? { color: '#059669' } : { color: '#e74c3c' }]}>
                              {discountDiff > 0 ? '+' : ''}{formatPrice(discountDiff)}
                            </Text>
                          </View>
                        )}
                        {basePriceDiff !== 0 && discountDiff !== 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Prix après réduction:</Text>
                            <Text style={styles.summaryValue}>
                              {basePriceDiff > 0 ? '+' : ''}{formatPrice(basePriceDiff)}
                            </Text>
                          </View>
                        )}
                        {serviceFeeDiff !== 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Frais de service:</Text>
                            <Text style={styles.summaryValue}>
                              {serviceFeeDiff > 0 ? '+' : ''}{formatPrice(serviceFeeDiff)}
                            </Text>
                          </View>
                        )}
                        <View style={[styles.summaryRow, styles.totalRow]}>
                          <Text style={styles.totalLabel}>
                            {totalDiff > 0 ? 'Surplus à payer:' : totalDiff < 0 ? 'Remboursement:' : 'Aucun changement'}
                          </Text>
                          <Text style={[styles.totalValue, totalDiff > 0 ? { color: '#e67e22' } : totalDiff < 0 ? { color: '#059669' } : { color: '#6b7280' }]}>
                            {totalDiff > 0 
                              ? `+${formatPrice(totalDiff)}`
                              : totalDiff < 0
                              ? formatPrice(Math.abs(totalDiff))
                              : formatPrice(0)}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
            </View>

            {/* Message optionnel */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Message au propriétaire (optionnel)</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Expliquez la raison de la modification..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitButton, (isSubmitting || loading) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting || loading}
            >
              {isSubmitting || loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Confirmer la modification</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Modal de paiement du surplus */}
      <VehicleModificationSurplusPaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPendingModificationData(null);
          setSurplusBreakdown(null);
        }}
        surplusAmount={totalPrice > currentTotalPrice ? totalPrice - currentTotalPrice : 0}
        bookingId={booking.id}
        onPaymentComplete={handlePaymentComplete}
        vehicleTitle={vehicle?.title || `${vehicle?.brand} ${vehicle?.model}`}
        originalTotalPrice={currentTotalPrice}
        newTotalPrice={totalPrice}
        priceBreakdown={surplusBreakdown || undefined}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 100,
    backgroundColor: '#fff',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
});

export default VehicleModificationModal;








