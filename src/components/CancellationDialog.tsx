import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBookingCancellation, CancellationInfo } from '../hooks/useBookingCancellation';
import { useAuth } from '../services/AuthContext';
import { formatPrice } from '../utils/priceCalculator';

interface CancellationDialogProps {
  visible: boolean;
  onClose: () => void;
  booking: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    status?: string;
    properties?: {
      title: string;
      price_per_night: number;
      cancellation_policy?: string | null;
    };
    property?: {
      title: string;
      price_per_night: number;
      cancellation_policy?: string | null;
    };
  };
  onCancelled: () => void;
}

const cancellationReasons = [
  { value: 'change_plans', label: 'Changement de plans' },
  { value: 'emergency', label: 'Urgence personnelle' },
  { value: 'property_issue', label: 'Problème avec la propriété' },
  { value: 'found_alternative', label: 'J\'ai trouvé une alternative' },
  { value: 'travel_restrictions', label: 'Restrictions de voyage' },
  { value: 'financial_reasons', label: 'Raisons financières' },
  { value: 'family_emergency', label: 'Urgence familiale' },
  { value: 'weather', label: 'Conditions météorologiques' },
  { value: 'other', label: 'Autre raison' }
];

const CancellationDialog: React.FC<CancellationDialogProps> = ({
  visible,
  onClose,
  booking,
  onCancelled,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState<CancellationInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const { cancelBooking, calculateCancellationInfo, loading } = useBookingCancellation();
  const { user } = useAuth();

  const property = booking.properties || booking.property;
  const cancellationPolicy = property?.cancellation_policy || null;
  const pricePerNight = property?.price_per_night || 0;

  useEffect(() => {
    if (visible && booking && user) {
      loadCancellationInfo();
    }
  }, [visible, booking]);

  const loadCancellationInfo = async () => {
    if (!booking || !user) return;
    
    setLoadingInfo(true);
    try {
      const info = await calculateCancellationInfo(
        booking.id,
        booking.check_in_date,
        booking.check_out_date,
        booking.total_price,
        pricePerNight,
        cancellationPolicy,
        booking.status || 'pending'
      );
      setCancellationInfo(info);
    } catch (error) {
      console.error('Error loading cancellation info:', error);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedReason || !user || !cancellationInfo?.canCancel) {
      Alert.alert('Raison requise', 'Veuillez sélectionner une cause d\'annulation');
      return;
    }

    setIsConfirming(true);
    
    const reasonLabel = cancellationReasons.find(r => r.value === selectedReason)?.label || selectedReason;
    const fullReason = reason.trim() 
      ? `${reasonLabel}: ${reason.trim()}`
      : reasonLabel;
    
    const result = await cancelBooking(
      booking.id,
      user.id,
      fullReason,
      booking.check_in_date,
      booking.check_out_date,
      booking.total_price,
      pricePerNight,
      cancellationPolicy,
      booking.status || 'pending'
    );

    if (result.success) {
      onCancelled();
      onClose();
      setSelectedReason('');
      setReason('');
    }
    
    setIsConfirming(false);
  };

  const getPolicyLabel = (policy: string | null) => {
    switch (policy) {
      case 'flexible':
        return 'Flexible';
      case 'moderate':
        return 'Modérée';
      case 'strict':
        return 'Stricte';
      case 'non_refundable':
        return 'Non remboursable';
      default:
        return 'Flexible';
    }
  };

  const getPolicyDescription = (policy: string | null) => {
    switch (policy) {
      case 'flexible':
        return '100% remboursés au moins 1 jour avant l\'arrivée. Remboursement partiel (50%) moins de 1 jour avant.';
      case 'moderate':
        return '100% remboursés au moins 5 jours avant l\'arrivée. Remboursement partiel (50%) moins de 5 jours avant.';
      case 'strict':
        return '100% remboursés au moins 7 jours avant l\'arrivée. Remboursement partiel (50%) moins de 7 jours avant.';
      case 'non_refundable':
        return 'Aucun remboursement en cas d\'annulation';
      default:
        return '100% remboursés au moins 1 jour avant l\'arrivée. Remboursement partiel (50%) moins de 1 jour avant.';
    }
  };

  if (!cancellationInfo && loadingInfo) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>Calcul des informations d'annulation...</Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (!cancellationInfo?.canCancel) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Ionicons name="alert-circle-outline" size={24} color="#e74c3c" />
                <Text style={styles.title}>Annulation non autorisée</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              <View style={[styles.alert, styles.alertError]}>
                <Ionicons name="alert-circle-outline" size={20} color="#e74c3c" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Annulation non autorisée</Text>
                  <Text style={styles.alertText}>
                    Selon la politique d'annulation "{getPolicyLabel(cancellationPolicy)}" de cette propriété, vous ne pouvez plus annuler cette réservation.
                  </Text>
                </View>
              </View>

              <View style={styles.bookingInfo}>
                <Text style={styles.bookingTitle}>{property?.title || 'Propriété'}</Text>
                <View style={styles.bookingDetails}>
                  <Text style={styles.bookingDetailText}>
                    Arrivée : {new Date(booking.check_in_date).toLocaleDateString('fr-FR')}
                  </Text>
                  <Text style={styles.bookingDetailText}>
                    Politique : {getPolicyLabel(cancellationPolicy)}
                  </Text>
                  <Text style={styles.policyDescription}>
                    {getPolicyDescription(cancellationPolicy)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.button, styles.closeButtonStyle]}
                onPress={onClose}
              >
                <Text style={styles.closeButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const { refundPercentage, isInProgress, remainingNights, remainingNightsAmount, penaltyAmount, refundAmount } = cancellationInfo;
  const isPending = booking.status === 'pending';
  const finalRefundAmount = refundAmount || (isInProgress && remainingNightsAmount !== undefined
    ? Math.round(remainingNightsAmount * 0.50) // 50% des nuitées restantes
    : (booking.total_price * refundPercentage) / 100);
  const finalPenaltyAmount = penaltyAmount || (booking.total_price - finalRefundAmount);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="warning-outline" size={24} color="#e67e22" />
              <Text style={styles.title}>Annuler la réservation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Informations de la réservation */}
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingTitle}>{property?.title || 'Propriété'}</Text>
              <View style={styles.bookingDetails}>
                <Text style={styles.bookingDetailText}>
                  Arrivée : {new Date(booking.check_in_date).toLocaleDateString('fr-FR')}
                </Text>
                <Text style={styles.bookingDetailText}>
                  Prix total : {formatPrice(booking.total_price)}
                </Text>
                <Text style={styles.bookingDetailText}>
                  Politique : {getPolicyLabel(cancellationPolicy)}
                </Text>
              </View>
            </View>

            {/* Alerte de remboursement */}
            {isPending ? (
              <View style={[styles.alert, styles.alertInfo]}>
                <Ionicons name="time-outline" size={20} color="#2196F3" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Réservation en attente</Text>
                  <Text style={styles.alertText}>Aucune pénalité applicable. Remboursement intégral.</Text>
                </View>
              </View>
            ) : isInProgress ? (
              <View style={[styles.alert, styles.alertWarning]}>
                <Ionicons name="calendar-outline" size={20} color="#e67e22" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Réservation en cours</Text>
                  <Text style={styles.alertText}>
                    50% des {remainingNights} nuitée{remainingNights !== 1 ? 's' : ''} restante{remainingNights !== 1 ? 's' : ''} seront remboursées
                  </Text>
                </View>
              </View>
            ) : finalPenaltyAmount > 0 ? (
              <View style={[styles.alert, styles.alertWarning]}>
                <Ionicons name="alert-circle-outline" size={20} color="#e67e22" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Pénalité appliquée</Text>
                  <Text style={styles.alertText}>
                    Remboursement de {refundPercentage}% selon la politique "{getPolicyLabel(cancellationPolicy)}"
                  </Text>
                  <Text style={styles.alertAmount}>
                    Montant de la pénalité : {formatPrice(finalPenaltyAmount)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.alert, styles.alertSuccess]}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Annulation gratuite</Text>
                  <Text style={styles.alertText}>
                    Remboursement intégral selon la politique "{getPolicyLabel(cancellationPolicy)}"
                  </Text>
                </View>
              </View>
            )}

            {/* Détails financiers */}
            <View style={styles.financialDetails}>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix total de la réservation :</Text>
                <Text style={styles.financialValue}>{formatPrice(booking.total_price)}</Text>
              </View>
              
              {finalPenaltyAmount > 0 && (
                <View style={styles.financialRow}>
                  <Text style={[styles.financialLabel, styles.penaltyLabel]}>
                    Pénalité d'annulation :
                  </Text>
                  <Text style={[styles.financialValue, styles.penaltyValue]}>
                    -{formatPrice(finalPenaltyAmount)}
                  </Text>
                </View>
              )}
              
              <View style={[styles.financialRow, styles.refundRow]}>
                <Text style={styles.refundLabel}>Remboursement :</Text>
                <Text style={styles.refundValue}>{formatPrice(finalRefundAmount)}</Text>
              </View>
            </View>

            {/* Description de la politique */}
            <View style={styles.policySection}>
              <Text style={styles.policyTitle}>Politique d'annulation</Text>
              <Text style={styles.policyText}>{getPolicyDescription(cancellationPolicy)}</Text>
            </View>

            {/* Raison de l'annulation */}
            <View style={styles.reasonSection}>
              <Text style={styles.reasonLabel}>Cause de l'annulation *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reasonsScroll}>
                {cancellationReasons.map((reasonOption) => (
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
              
              <Text style={styles.reasonLabel}>Détails (optionnel)</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Expliquez davantage votre raison d'annulation..."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Footer avec boutons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading || isConfirming}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleCancel}
              disabled={!selectedReason || loading || isConfirming}
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
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  bookingInfo: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  bookingDetails: {
    gap: 5,
  },
  bookingDetailText: {
    fontSize: 14,
    color: '#666',
  },
  policyDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  alert: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    gap: 12,
  },
  alertInfo: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  alertWarning: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#e67e22',
  },
  alertSuccess: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  alertError: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  alertText: {
    fontSize: 14,
    color: '#666',
  },
  alertAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    color: '#e67e22',
  },
  financialDetails: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  financialLabel: {
    fontSize: 14,
    color: '#666',
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  penaltyLabel: {
    color: '#e67e22',
  },
  penaltyValue: {
    color: '#e67e22',
  },
  refundRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 5,
    marginBottom: 0,
  },
  refundLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  refundValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  policySection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  policyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  policyText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  reasonSection: {
    marginBottom: 15,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  reasonsScroll: {
    marginBottom: 12,
  },
  reasonChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  reasonChipSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#666',
  },
  reasonChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  closeButtonStyle: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  confirmButton: {
    backgroundColor: '#e74c3c',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CancellationDialog;
