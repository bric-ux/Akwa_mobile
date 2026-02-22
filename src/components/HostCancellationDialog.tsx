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
import { HostBooking } from '../types';
import { useHostBookings } from '../hooks/useHostBookings';
import { formatPrice } from '../utils/priceCalculator';

interface HostCancellationDialogProps {
  visible: boolean;
  onClose: () => void;
  booking: HostBooking | null;
  onCancelled: () => void;
}

const hostCancellationReasons = [
  { value: 'property_unavailable', label: 'Propriété non disponible' },
  { value: 'maintenance', label: 'Travaux de maintenance' },
  { value: 'emergency', label: 'Urgence' },
  { value: 'double_booking', label: 'Double réservation' },
  { value: 'property_damage', label: 'Dommages à la propriété' },
  { value: 'legal_issue', label: 'Problème légal' },
  { value: 'family_emergency', label: 'Urgence familiale' },
  { value: 'other', label: 'Autre raison' }
];

const HostCancellationDialog: React.FC<HostCancellationDialogProps> = ({
  visible,
  onClose,
  booking,
  onCancelled,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reason, setReason] = useState('');
  const [penaltyPaymentMethod, setPenaltyPaymentMethod] = useState<'deduct_from_next_booking' | 'pay_directly' | ''>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const { cancelBooking, loading } = useHostBookings();

  if (!booking) return null;

  // Calculer la pénalité selon les règles (avant début : 28j/48h ; séjour en cours : 40% sur nuitées non consommées)
  const calculateHostPenalty = () => {
    const checkInDate = new Date(booking.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    const checkOutDate = booking.check_out_date ? new Date(booking.check_out_date) : null;
    if (checkOutDate) checkOutDate.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const totalNights = checkOutDate
      ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
      : 1;
    const baseReservationAmount = (booking.properties?.price_per_night || 0) * totalNights;
    const isInProgress = checkOutDate && checkInDate <= now && now <= checkOutDate;

    let penalty = 0;
    let penaltyDescription = '';

    if (isInProgress) {
      const nightsElapsed = Math.max(0, Math.ceil((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingNights = Math.max(0, totalNights - nightsElapsed);
      const remainingBaseAmount = remainingNights * (booking.properties?.price_per_night || 0);
      penalty = Math.round(remainingBaseAmount * 0.40);
      penaltyDescription = 'Annulation en cours de séjour : 40% des nuitées non consommées (remboursement intégral au voyageur)';
    } else if (hoursUntilCheckIn <= 48) {
      penalty = Math.round(baseReservationAmount * 0.40);
      penaltyDescription = 'Annulation 48h ou moins avant l\'arrivée (40% du montant)';
    } else if (daysUntilCheckIn > 2 && daysUntilCheckIn <= 28) {
      penalty = Math.round(baseReservationAmount * 0.20);
      penaltyDescription = 'Annulation entre 28 jours et 48h avant l\'arrivée (20% du montant)';
    } else if (daysUntilCheckIn > 28 && totalNights > 30) {
      penalty = 0;
      penaltyDescription = 'Annulation gratuite (réservation longue durée, plus de 28 jours avant)';
    } else if (daysUntilCheckIn > 28) {
      penalty = 0;
      penaltyDescription = 'Annulation gratuite (plus de 28 jours avant l\'arrivée)';
    } else {
      penalty = 0;
      penaltyDescription = 'Annulation gratuite';
    }

    return { penalty, penaltyDescription, isWithin48Hours: hoursUntilCheckIn <= 48 };
  };

  const { penalty: penaltyAmount, penaltyDescription } = calculateHostPenalty();
  
  const guestName = booking.guest_profile 
    ? `${booking.guest_profile.first_name || ''} ${booking.guest_profile.last_name || ''}`.trim() 
    : 'le voyageur';

  const handleCancel = async () => {
    if (!selectedReason) {
      Alert.alert('Erreur', 'Veuillez sélectionner une cause d\'annulation');
      return;
    }

    if (penaltyAmount > 0 && !penaltyPaymentMethod) {
      Alert.alert('Mode de paiement requis', 'Veuillez choisir comment vous souhaitez régler la pénalité');
      return;
    }

    setIsConfirming(true);
    
    const reasonLabel = hostCancellationReasons.find(r => r.value === selectedReason)?.label || selectedReason;
    const fullReason = reason.trim() 
      ? `[Annulé par l'hôte] ${reasonLabel}: ${reason.trim()}`
      : `[Annulé par l'hôte] ${reasonLabel}`;
    
    const result = await cancelBooking(booking.id, fullReason, penaltyPaymentMethod || undefined);

    if (result.success) {
      onCancelled();
      onClose();
      setSelectedReason('');
      setReason('');
      setPenaltyPaymentMethod('');
      Alert.alert('Succès', 'La réservation a été annulée');
    } else {
      Alert.alert('Erreur', 'Impossible d\'annuler la réservation');
    }
    
    setIsConfirming(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Annuler la réservation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Informations de la réservation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informations</Text>
              <Text style={styles.infoText}>Propriété: {booking.properties?.title || '-'}</Text>
              <Text style={styles.infoText}>Voyageur: {guestName}</Text>
              <Text style={styles.infoText}>
                Arrivée: {new Date(booking.check_in_date).toLocaleDateString('fr-FR')}
              </Text>
              <Text style={styles.infoText}>
                Prix total: {formatPrice(booking.total_price)}
              </Text>
            </View>

            {/* Alerte de pénalité */}
            {penaltyAmount > 0 ? (
              <View style={styles.penaltyAlert}>
                <Ionicons name="alert-circle" size={20} color="#f59e0b" />
                <View style={styles.penaltyAlertContent}>
                  <Text style={styles.penaltyAlertTitle}>Pénalité applicable</Text>
                  <Text style={styles.penaltyAlertText}>{penaltyDescription}</Text>
                  <Text style={styles.penaltyAmount}>
                    Vous devrez payer une pénalité de {formatPrice(penaltyAmount)} à Akwahome.
                  </Text>
                  <Text style={styles.penaltyNote}>
                    Le voyageur sera intégralement remboursé ({formatPrice(booking.total_price)}).
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.noPenaltyAlert}>
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <View style={styles.penaltyAlertContent}>
                  <Text style={styles.noPenaltyTitle}>Annulation sans pénalité</Text>
                  <Text style={styles.penaltyAlertText}>{penaltyDescription}</Text>
                  <Text style={styles.penaltyNote}>
                    Le voyageur sera intégralement remboursé.
                  </Text>
                </View>
              </View>
            )}

            {/* Détails financiers */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Détails financiers</Text>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix total de la réservation</Text>
                <Text style={styles.financialValue}>{formatPrice(booking.total_price)}</Text>
              </View>
              
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Remboursement au voyageur</Text>
                <Text style={[styles.financialValue, styles.refundText]}>
                  {formatPrice(booking.total_price)}
                </Text>
              </View>
              
              {penaltyAmount > 0 && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.financialRow}>
                    <Text style={styles.financialLabel}>Pénalité à payer à Akwahome</Text>
                    <Text style={[styles.financialValue, styles.penaltyText]}>
                      {formatPrice(penaltyAmount)}
                    </Text>
                  </View>
                  <Text style={styles.penaltyInfo}>
                    Cette pénalité est distincte du remboursement au voyageur. Elle doit être payée à Akwahome.
                  </Text>
                </>
              )}
            </View>

            {/* Raison de l'annulation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cause de l'annulation *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reasonsContainer}>
                {hostCancellationReasons.map((reasonOption) => (
                  <TouchableOpacity
                    key={reasonOption.value}
                    style={[
                      styles.reasonChip,
                      selectedReason === reasonOption.value && styles.reasonChipSelected
                    ]}
                    onPress={() => setSelectedReason(reasonOption.value)}
                  >
                    <Text style={[
                      styles.reasonChipText,
                      selectedReason === reasonOption.value && styles.reasonChipTextSelected
                    ]}>
                      {reasonOption.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {selectedReason && (
                <View style={styles.additionalReasonContainer}>
                  <Text style={styles.additionalReasonLabel}>Détails supplémentaires (optionnel)</Text>
                  <TextInput
                    style={styles.additionalReasonInput}
                    placeholder="Ajoutez des détails sur votre annulation..."
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Mode de paiement de la pénalité */}
              {penaltyAmount > 0 && (
                <View style={styles.paymentMethodContainer}>
                  <Text style={styles.paymentMethodTitle}>
                    Comment souhaitez-vous régler la pénalité de {formatPrice(penaltyAmount)} ? *
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodOption,
                      penaltyPaymentMethod === 'deduct_from_next_booking' && styles.paymentMethodOptionSelected
                    ]}
                    onPress={() => setPenaltyPaymentMethod('deduct_from_next_booking')}
                  >
                    <Ionicons 
                      name={penaltyPaymentMethod === 'deduct_from_next_booking' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={penaltyPaymentMethod === 'deduct_from_next_booking' ? '#e67e22' : '#999'} 
                    />
                    <Text style={styles.paymentMethodText}>Déduire sur ma prochaine réservation</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodOption,
                      penaltyPaymentMethod === 'pay_directly' && styles.paymentMethodOptionSelected
                    ]}
                    onPress={() => setPenaltyPaymentMethod('pay_directly')}
                  >
                    <Ionicons 
                      name={penaltyPaymentMethod === 'pay_directly' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={penaltyPaymentMethod === 'pay_directly' ? '#e67e22' : '#999'} 
                    />
                    <Text style={styles.paymentMethodText}>Payer directement</Text>
                  </TouchableOpacity>
                  <Text style={styles.paymentMethodNote}>
                    {penaltyPaymentMethod === 'deduct_from_next_booking' 
                      ? 'La pénalité sera automatiquement déduite de votre prochain paiement.'
                      : penaltyPaymentMethod === 'pay_directly'
                      ? 'Vous serez contacté pour effectuer le paiement de la pénalité.'
                      : 'Veuillez choisir un mode de paiement.'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelFooterButton}
              onPress={onClose}
              disabled={loading || isConfirming}
            >
              <Text style={styles.cancelFooterButtonText}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, (!selectedReason || (penaltyAmount > 0 && !penaltyPaymentMethod) || loading || isConfirming) && styles.confirmButtonDisabled]}
              onPress={handleCancel}
              disabled={!selectedReason || (penaltyAmount > 0 && !penaltyPaymentMethod) || loading || isConfirming}
            >
              {loading || isConfirming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirmer l'annulation</Text>
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
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  penaltyAlert: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    gap: 12,
  },
  noPenaltyAlert: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    gap: 12,
  },
  penaltyAlertContent: {
    flex: 1,
  },
  penaltyAlertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 4,
  },
  noPenaltyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  penaltyAlertText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  penaltyAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 4,
  },
  penaltyNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  refundText: {
    color: '#10b981',
  },
  penaltyText: {
    color: '#e74c3c',
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  penaltyInfo: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  reasonsContainer: {
    marginBottom: 16,
  },
  reasonChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reasonChipSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#333',
  },
  reasonChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  additionalReasonContainer: {
    marginTop: 12,
  },
  additionalReasonLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  additionalReasonInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    backgroundColor: '#f9fafb',
  },
  paymentMethodContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 12,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  paymentMethodOptionSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fff7ed',
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#333',
  },
  paymentMethodNote: {
    fontSize: 12,
    color: '#c2410c',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelFooterButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelFooterButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HostCancellationDialog;
























