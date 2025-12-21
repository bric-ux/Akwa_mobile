import React, { useState } from 'react';
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
import { useBookingCancellation } from '../hooks/useBookingCancellation';
import { useAuth } from '../services/AuthContext';

interface CancellationDialogProps {
  visible: boolean;
  onClose: () => void;
  booking: {
    id: string;
    check_in_date: string;
    total_price: number;
    status?: string;
    property: {
      title: string;
      price_per_night: number;
    };
  };
  onCancelled: () => void;
}

const CancellationDialog: React.FC<CancellationDialogProps> = ({
  visible,
  onClose,
  booking,
  onCancelled,
}) => {
  const [reason, setReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const { cancelBooking, calculatePenalty, loading } = useBookingCancellation();
  const { user } = useAuth();

  // Pas de pénalité pour les réservations pending
  const isPending = booking.status === 'pending';
  const penaltyAmount = isPending ? 0 : calculatePenalty(booking.check_in_date, booking.property.price_per_night);
  const isWithin48Hours = penaltyAmount > 0;
  const refundAmount = booking.total_price - penaltyAmount;

  const formatPrice = (price: number) => {
    return `${price.toLocaleString('fr-FR')} FCFA`;
  };

  const handleCancel = async () => {
    if (!reason.trim() || !user) {
      Alert.alert('Erreur', 'Veuillez indiquer une raison pour l\'annulation');
      return;
    }

    setIsConfirming(true);
    
    const result = await cancelBooking(
      booking.id,
      user.id,
      reason.trim(),
      booking.property.price_per_night,
      booking.check_in_date
    );

    if (result.success) {
      onCancelled();
      onClose();
      setReason('');
    }
    
    setIsConfirming(false);
  };

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
              <Text style={styles.bookingTitle}>{booking.property.title}</Text>
              <View style={styles.bookingDetails}>
                <Text style={styles.bookingDetailText}>
                  Arrivée : {new Date(booking.check_in_date).toLocaleDateString('fr-FR')}
                </Text>
                <Text style={styles.bookingDetailText}>
                  Prix total : {formatPrice(booking.total_price)}
                </Text>
              </View>
            </View>

            {/* Alerte de pénalité */}
            {isPending ? (
              <View style={[styles.alert, styles.alertInfo]}>
                <Ionicons name="time-outline" size={20} color="#2196F3" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Réservation en attente</Text>
                  <Text style={styles.alertText}>Aucune pénalité applicable</Text>
                </View>
              </View>
            ) : isWithin48Hours ? (
              <View style={[styles.alert, styles.alertWarning]}>
                <Ionicons name="time-outline" size={20} color="#e67e22" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Pénalité appliquée</Text>
                  <Text style={styles.alertText}>
                    Annulation moins de 48h avant l'arrivée
                  </Text>
                  <Text style={styles.alertAmount}>
                    Montant de la pénalité : {formatPrice(penaltyAmount)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.alert, styles.alertSuccess]}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>Annulation gratuite</Text>
                  <Text style={styles.alertText}>
                    Plus de 48h avant l'arrivée
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
              
              {penaltyAmount > 0 && (
                <View style={styles.financialRow}>
                  <Text style={[styles.financialLabel, styles.penaltyLabel]}>
                    Pénalité d'annulation :
                  </Text>
                  <Text style={[styles.financialValue, styles.penaltyValue]}>
                    -{formatPrice(penaltyAmount)}
                  </Text>
                </View>
              )}
              
              <View style={[styles.financialRow, styles.refundRow]}>
                <Text style={styles.refundLabel}>Remboursement :</Text>
                <Text style={styles.refundValue}>{formatPrice(refundAmount)}</Text>
              </View>
            </View>

            {/* Raison de l'annulation */}
            <View style={styles.reasonSection}>
              <Text style={styles.reasonLabel}>Raison de l'annulation *</Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Expliquez pourquoi vous annulez cette réservation..."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
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
              disabled={!reason.trim() || loading || isConfirming}
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
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
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
  reasonSection: {
    marginBottom: 15,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
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

