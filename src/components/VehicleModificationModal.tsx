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

  useEffect(() => {
    if (booking && visible) {
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

  const calculateRentalDays = () => {
    if (!startDate || !endDate) return 0;
    
    // Si les dates sont identiques, c'est 1 jour de location
    if (startDate === endDate) {
      return 1;
    }
    
    // Si les dates sont différentes, calculer la différence
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // +1 pour inclure le jour de départ
  };

  // Calculer les heures restantes si applicable
  const calculateRemainingHours = () => {
    if (!startDateTime || !endDateTime || !vehicle?.hourly_rental_enabled || !vehicle?.price_per_hour) {
      return 0;
    }
    
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }
    
    const diffTime = end.getTime() - start.getTime();
    const totalHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    // Calculer les jours complets directement à partir des heures totales
    const fullDaysFromHours = Math.floor(totalHours / 24);
    const hoursInFullDays = fullDaysFromHours * 24;
    const remainingHours = totalHours - hoursInFullDays;
    
    return remainingHours > 0 ? remainingHours : 0;
  };

  const rentalDays = calculateRentalDays();
  const remainingHours = calculateRemainingHours();
  
  // Calculer le prix : jours + heures
  // Utiliser hourly_rate de la réservation si disponible, sinon price_per_hour du véhicule
  const hourlyRate = booking.hourly_rate || vehicle?.price_per_hour || 0;
  let daysPrice = dailyRate * rentalDays;
  let hoursPrice = 0;
  if (remainingHours > 0 && hourlyRate > 0) {
    hoursPrice = remainingHours * hourlyRate;
  }
  const totalPrice = daysPrice + hoursPrice;

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

    setIsSubmitting(true);
    try {
      const result = await modifyBooking({
        bookingId: booking.id,
        requestedStartDate: startDate,
        requestedEndDate: endDate,
        requestedStartDateTime: startDateTime,
        requestedEndDateTime: endDateTime,
        requestedRentalDays: rentalDays,
        requestedRentalHours: remainingHours,
        requestedTotalPrice: totalPrice,
        message: message.trim() || undefined,
      });

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
              {rentalDays > 0 && (
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Durée:</Text>
                    <Text style={styles.summaryValue}>
                      {rentalDays} jour{rentalDays > 1 ? 's' : ''}
                      {remainingHours > 0 && ` et ${remainingHours} heure${remainingHours > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Prix par jour:</Text>
                    <Text style={styles.summaryValue}>{formatPrice(dailyRate)}</Text>
                  </View>
                  {remainingHours > 0 && hourlyRate > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Prix des heures supplémentaires:</Text>
                      <Text style={styles.summaryValue}>
                        {formatPrice(remainingHours * hourlyRate)} ({remainingHours} h × {formatPrice(hourlyRate)}/h)
                      </Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Nouveau total:</Text>
                    <Text style={styles.totalValue}>{formatPrice(totalPrice)}</Text>
                  </View>
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
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
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








