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
import { BookingModificationRequest } from '../hooks/useBookingModifications';
import { useBookingModifications } from '../hooks/useBookingModifications';

interface HostModificationRequestCardProps {
  request: BookingModificationRequest;
  guestName: string;
  propertyTitle: string;
  onUpdated: () => void;
}

const HostModificationRequestCard: React.FC<HostModificationRequestCardProps> = ({
  request,
  guestName,
  propertyTitle,
  onUpdated,
}) => {
  const { approveModificationRequest, rejectModificationRequest, loading } = useBookingModifications();
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
  const originalNights = Math.ceil(
    (new Date(request.original_check_out).getTime() - new Date(request.original_check_in).getTime()) 
    / (1000 * 60 * 60 * 24)
  );
  const requestedNights = Math.ceil(
    (new Date(request.requested_check_out).getTime() - new Date(request.requested_check_in).getTime()) 
    / (1000 * 60 * 60 * 24)
  );

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
            <Text style={styles.guestName}>{guestName}</Text>
            <Text style={styles.propertyTitle}>{propertyTitle}</Text>
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
                {formatDate(request.original_check_in)} - {formatDate(request.original_check_out)}
                {' '}({originalNights} nuit{originalNights > 1 ? 's' : ''})
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#2E7D32" style={styles.arrow} />
              <Text style={styles.requestedValue}>
                {formatDate(request.requested_check_in)} - {formatDate(request.requested_check_out)}
                {' '}({requestedNights} nuit{requestedNights > 1 ? 's' : ''})
              </Text>
            </View>
          </View>

          {/* Voyageurs */}
          {request.original_guests_count !== request.requested_guests_count && (
            <View style={styles.changeRow}>
              <Ionicons name="people-outline" size={18} color="#666" />
              <View style={styles.changeContent}>
                <Text style={styles.originalValue}>
                  {request.original_guests_count} voyageur{request.original_guests_count > 1 ? 's' : ''}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#2E7D32" style={styles.arrow} />
                <Text style={styles.requestedValue}>
                  {request.requested_guests_count} voyageur{request.requested_guests_count > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Prix */}
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Nouveau total</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceValue}>{formatPrice(request.requested_total_price)}</Text>
              {priceDifference !== 0 && (
                <Text style={[styles.priceDifference, priceDifference > 0 ? styles.priceIncrease : styles.priceDecrease]}>
                  {priceDifference > 0 ? '+' : ''}{formatPrice(priceDifference)}
                </Text>
              )}
            </View>
          </View>

          {/* Message du voyageur */}
          {request.guest_message && (
            <View style={styles.messageContainer}>
              <Ionicons name="chatbubble-outline" size={18} color="#2563eb" />
              <View style={styles.messageContent}>
                <Text style={styles.messageLabel}>Message du voyageur</Text>
                <Text style={styles.messageText}>{request.guest_message}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => setShowRejectModal(true)}
          >
            <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
            <Text style={styles.rejectButtonText}>Refuser</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => setShowApproveModal(true)}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.approveButtonText}>Approuver</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.dateText}>
          Demande reçue le {formatDate(request.created_at)}
        </Text>
      </View>

      {/* Modal d'approbation */}
      <Modal
        visible={showApproveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowApproveModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Approuver la modification</Text>
            <TouchableOpacity onPress={() => setShowApproveModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              La réservation sera mise à jour avec les nouvelles dates et le nouveau tarif.
            </Text>
            <Text style={styles.inputLabel}>Message au voyageur (optionnel)</Text>
            <TextInput
              style={styles.textInput}
              value={responseMessage}
              onChangeText={setResponseMessage}
              placeholder="Ex: Parfait, j'ai noté le changement de dates..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowApproveModal(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmApproveButton]}
              onPress={handleApprove}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Approuver</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal de refus */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Refuser la modification</Text>
            <TouchableOpacity onPress={() => setShowRejectModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalDescription}>
              La réservation restera inchangée avec les dates et tarifs originaux.
            </Text>
            <Text style={styles.inputLabel}>Raison du refus (optionnel)</Text>
            <TextInput
              style={styles.textInput}
              value={responseMessage}
              onChangeText={setResponseMessage}
              placeholder="Ex: Désolé, ces dates ne sont pas disponibles car..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowRejectModal(false)}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmRejectButton]}
              onPress={handleReject}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Refuser</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyTitle: {
    fontSize: 14,
    color: '#666',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f39c12',
  },
  changesContainer: {
    gap: 12,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  originalValue: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  arrow: {
    marginHorizontal: 4,
  },
  requestedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  priceContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  priceDifference: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceIncrease: {
    color: '#ef4444',
  },
  priceDecrease: {
    color: '#27ae60',
  },
  messageContainer: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  messageContent: {
    flex: 1,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#1e40af',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  approveButton: {
    backgroundColor: '#27ae60',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
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
  confirmApproveButton: {
    backgroundColor: '#27ae60',
  },
  confirmRejectButton: {
    backgroundColor: '#ef4444',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default HostModificationRequestCard;


