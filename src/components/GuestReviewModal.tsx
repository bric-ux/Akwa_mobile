import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGuestReviews } from '../hooks/useGuestReviews';
import { useLanguage } from '../contexts/LanguageContext';

interface GuestReviewModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  guestId: string;
  guestName: string;
  propertyId: string;
  onReviewSubmitted: () => void;
}

const GuestReviewModal: React.FC<GuestReviewModalProps> = ({
  visible,
  onClose,
  bookingId,
  guestId,
  guestName,
  propertyId,
  onReviewSubmitted,
}) => {
  const { t } = useLanguage();
  const { submitGuestReview, loading, error } = useGuestReviews();
  const [rating, setRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [respectRulesRating, setRespectRulesRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRatings, setHoveredRatings] = useState<Record<string, number>>({});

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(
        t('common.error') || 'Erreur',
        'Veuillez donner une note globale.'
      );
      return;
    }

    const result = await submitGuestReview({
      bookingId,
      guestId,
      propertyId,
      rating,
      cleanlinessRating: cleanlinessRating || undefined,
      communicationRating: communicationRating || undefined,
      respectRulesRating: respectRulesRating || undefined,
      comment: comment.trim() || undefined,
    });

    if (result.success) {
      Alert.alert(
        'Avis enregistré',
        'Votre avis sera publié lorsque l\'invité aura répondu.',
        [
          {
            text: t('common.ok') || 'OK',
            onPress: () => {
              setRating(0);
              setCleanlinessRating(0);
              setCommunicationRating(0);
              setRespectRulesRating(0);
              setComment('');
              onReviewSubmitted();
              onClose();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        t('common.error') || 'Erreur',
        error || 'Impossible de soumettre votre avis. Veuillez réessayer.'
      );
    }
  };

  const StarRating = ({ 
    value, 
    onChange, 
    label,
    categoryId
  }: { 
    value: number; 
    onChange: (value: number) => void; 
    label: string;
    categoryId: string;
  }) => {
    const hoveredValue = hoveredRatings[categoryId] || 0;
    const displayValue = hoveredValue || value;

    return (
      <View style={styles.ratingCategory}>
        <Text style={styles.ratingLabel}>{label}</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => onChange(star)}
              onPressIn={() => setHoveredRatings(prev => ({ ...prev, [categoryId]: star }))}
              onPressOut={() => setHoveredRatings(prev => {
                const newState = { ...prev };
                delete newState[categoryId];
                return newState;
              })}
              style={styles.starButton}
            >
              <Ionicons
                name={star <= displayValue ? 'star' : 'star-outline'}
                size={28}
                color={star <= displayValue ? '#FFD700' : '#ccc'}
              />
            </TouchableOpacity>
          ))}
          {value > 0 && (
            <Text style={styles.ratingValue}>{value}/5</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Évaluer {guestName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              {/* Note globale */}
              <View style={styles.globalRatingSection}>
                <Text style={styles.globalRatingLabel}>Note globale *</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRating(star)}
                      style={styles.starButton}
                    >
                      <Ionicons
                        name={rating >= star ? 'star' : 'star-outline'}
                        size={32}
                        color={rating >= star ? '#FFD700' : '#ccc'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes détaillées */}
              <StarRating
                value={cleanlinessRating}
                onChange={setCleanlinessRating}
                label="Propreté (état du logement après le départ)"
                categoryId="cleanliness"
              />
              <StarRating
                value={communicationRating}
                onChange={setCommunicationRating}
                label="Communication"
                categoryId="communication"
              />
              <StarRating
                value={respectRulesRating}
                onChange={setRespectRulesRating}
                label="Respect des règles de la maison"
                categoryId="respectRules"
              />

              {/* Commentaire */}
              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>
                  Votre commentaire (optionnel)
                </Text>
                <TextInput
                  style={styles.commentInput}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Partagez votre expérience avec cet invité..."
                  multiline
                  numberOfLines={6}
                  maxLength={1000}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>
                  {comment.length}/1000 caractères
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (loading || rating === 0) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || rating === 0}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Publier l'avis</Text>
              )}
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
    justifyContent: 'flex-end',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  section: {
    gap: 20,
  },
  globalRatingSection: {
    marginBottom: 20,
  },
  globalRatingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  ratingCategory: {
    marginBottom: 20,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  ratingValue: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  commentSection: {
    marginTop: 8,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 120,
    backgroundColor: '#f8f9fa',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
});

export default GuestReviewModal;

