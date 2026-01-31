import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';

interface VehicleModificationRequest {
  id: string;
  booking_id: string;
  renter_id: string;
  owner_id: string;
  original_start_date: string;
  original_end_date: string;
  original_rental_days: number;
  original_rental_hours?: number;
  original_total_price: number;
  requested_start_date: string;
  requested_end_date: string;
  requested_rental_days: number;
  requested_rental_hours?: number;
  requested_total_price: number;
  renter_message: string | null;
  status: string;
  owner_response_message: string | null;
  created_at: string;
  responded_at: string | null;
}

interface HostVehicleModificationRequestCardProps {
  request: VehicleModificationRequest;
  renterName: string;
  vehicleTitle: string;
  onUpdated: () => void;
}

const HostVehicleModificationRequestCard: React.FC<HostVehicleModificationRequestCardProps> = ({
  request,
  renterName,
  vehicleTitle,
  onUpdated,
}) => {
  const { approveModificationRequest, rejectModificationRequest, loading } = useVehicleBookingModifications();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const priceDifference = request.requested_total_price - request.original_total_price;

  const handleApprove = async () => {
    const result = await approveModificationRequest(request.id, responseMessage || undefined);
    if (result.success) {
      setShowApproveModal(false);
      setResponseMessage('');
      onUpdated();
    }
  };

  const handleReject = async () => {
    const result = await rejectModificationRequest(request.id, responseMessage || undefined);
    if (result.success) {
      setShowRejectModal(false);
      setResponseMessage('');
      onUpdated();
    }
  };

  if (request.status !== 'pending') {
    return null; // Ne pas afficher les demandes déjà traitées
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.renterName}>{renterName}</Text>
            <Text style={styles.vehicleTitle}>{vehicleTitle}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={16} color="#f39c12" />
            <Text style={styles.pendingText}>En attente</Text>
          </View>
        </View>

        {/* Modifications demandées */}
        <View style={styles.changesContainer}>
          {/* Dates */}
          <View style={styles.changeRow}>
            <Ionicons name="calendar-outline" size={18} color="#666" />
            <View style={styles.changeContent}>
              <Text style={styles.originalValue}>
                {formatDate(request.original_start_date)} - {formatDate(request.original_end_date)}
                {' '}({request.original_rental_days} jour{request.original_rental_days > 1 ? 's' : ''}
                {request.original_rental_hours && request.original_rental_hours > 0 && ` et ${request.original_rental_hours} heure${request.original_rental_hours > 1 ? 's' : ''}`})
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#2E7D32" style={styles.arrow} />
              <Text style={styles.requestedValue}>
                {formatDate(request.requested_start_date)} - {formatDate(request.requested_end_date)}
                {' '}({request.requested_rental_days} jour{request.requested_rental_days > 1 ? 's' : ''}
                {request.requested_rental_hours && request.requested_rental_hours > 0 && ` et ${request.requested_rental_hours} heure${request.requested_rental_hours > 1 ? 's' : ''}`})
              </Text>
            </View>
          </View>

          {/* Prix */}
          <View style={styles.changeRow}>
            <Ionicons name="cash-outline" size={18} color="#666" />
            <View style={styles.changeContent}>
              <Text style={styles.originalValue}>
                {formatPrice(request.original_total_price)}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#2E7D32" style={styles.arrow} />
              <Text style={[styles.requestedValue, priceDifference !== 0 && (priceDifference > 0 ? styles.priceIncrease : styles.priceDecrease)]}>
                {formatPrice(request.requested_total_price)}
                {priceDifference !== 0 && (
                  <Text style={styles.priceDiff}>
                    {' '}({priceDifference > 0 ? '+' : ''}{formatPrice(priceDifference)})
                  </Text>
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* Message du locataire */}
        {request.renter_message && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Message du locataire :</Text>
            <Text style={styles.messageText}>{request.renter_message}</Text>
          </View>
        )}

        {/* Boutons d'action */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => setShowApproveModal(true)}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => setShowRejectModal(true)}
            disabled={loading}
          >
            <Ionicons name="close-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Refuser</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal d'approbation */}
      <Modal
        visible={showApproveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowApproveModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Approuver la modification</Text>
              <TouchableOpacity onPress={() => setShowApproveModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                Voulez-vous approuver cette demande de modification ? La réservation sera mise à jour avec les nouvelles dates et le nouveau prix.
              </Text>
              <Text style={styles.modalLabel}>Message (optionnel) :</Text>
              <TextInput
                style={styles.modalInput}
                multiline
                numberOfLines={4}
                placeholder="Ajoutez un message pour le locataire..."
                value={responseMessage}
                onChangeText={setResponseMessage}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowApproveModal(false);
                  setResponseMessage('');
                }}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleApprove}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.modalConfirmText}>Approuver</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal de refus */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRejectModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refuser la modification</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                Voulez-vous refuser cette demande de modification ? La réservation restera inchangée.
              </Text>
              <Text style={styles.modalLabel}>Message (optionnel) :</Text>
              <TextInput
                style={styles.modalInput}
                multiline
                numberOfLines={4}
                placeholder="Expliquez pourquoi vous refusez cette demande..."
                value={responseMessage}
                onChangeText={setResponseMessage}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setResponseMessage('');
                }}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={handleReject}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.modalConfirmText}>Refuser</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f39c12',
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  renterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vehicleTitle: {
    fontSize: 14,
    color: '#666',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f39c12',
  },
  changesContainer: {
    gap: 12,
    marginBottom: 12,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  changeContent: {
    flex: 1,
    gap: 4,
  },
  originalValue: {
    fontSize: 13,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  arrow: {
    marginVertical: 4,
  },
  requestedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  priceIncrease: {
    color: '#dc2626',
  },
  priceDecrease: {
    color: '#059669',
  },
  priceDiff: {
    fontSize: 12,
    fontWeight: 'normal',
  },
  messageContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#2E7D32',
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 6,
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  modalConfirmButton: {
    backgroundColor: '#2E7D32',
  },
  modalRejectButton: {
    backgroundColor: '#dc2626',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default HostVehicleModificationRequestCard;










