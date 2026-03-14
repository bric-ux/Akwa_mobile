import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVehicleRenterReviews } from '../hooks/useVehicleRenterReviews';
import { VEHICLE_COLORS } from '../constants/colors';
import type { VehicleRenterReview } from '../hooks/useVehicleRenterReviews';

interface VehicleRenterReviewResponseModalProps {
  visible: boolean;
  onClose: () => void;
  review: VehicleRenterReview | null;
  onResponseSubmitted: () => void;
}

const VehicleRenterReviewResponseModal: React.FC<VehicleRenterReviewResponseModalProps> = ({
  visible,
  onClose,
  review,
  onResponseSubmitted,
}) => {
  const insets = useSafeAreaInsets();
  const { createResponse, loading } = useVehicleRenterReviews();
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    if (visible && review) {
      setResponseText(review.response?.response || '');
    }
  }, [visible, review]);

  const handleSubmit = async () => {
    if (!review || !responseText.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une réponse.');
      return;
    }
    const result = await createResponse(review.id, responseText.trim());
    if (result.success) {
      setResponseText('');
      onResponseSubmitted();
      onClose();
    }
  };

  if (!review) return null;

  const ownerName = review.owner
    ? `${review.owner.first_name || ''} ${review.owner.last_name || ''}`.trim() || 'Propriétaire'
    : 'Propriétaire';
  const vehicleTitle = review.vehicle?.title || 'Véhicule';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Répondre à l'avis</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>
              Avis de {ownerName} sur {vehicleTitle}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= review.rating ? 'star' : 'star-outline'}
                  size={18}
                  color={star <= review.rating ? '#fbbf24' : '#d1d5db'}
                />
              ))}
            </View>
            {review.comment ? (
              <Text style={styles.previewComment}>{review.comment}</Text>
            ) : null}
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            <TextInput
              style={styles.input}
              value={responseText}
              onChangeText={setResponseText}
              placeholder="Écrivez votre réponse..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!review.response}
            />
          </KeyboardAvoidingView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>{review.response ? 'Fermer' : 'Annuler'}</Text>
            </TouchableOpacity>
            {!review.response && (
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!responseText.trim() || loading) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!responseText.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  preview: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  previewComment: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  keyboardView: {
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    backgroundColor: '#fff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#6b7280',
  },
  submitBtn: {
    backgroundColor: VEHICLE_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VehicleRenterReviewResponseModal;
