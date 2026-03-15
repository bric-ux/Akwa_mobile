import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuestReviews } from '../hooks/useGuestReviews';
import type { GuestReview } from '../hooks/useGuestReviews';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PRIMARY = '#2E7D32';

interface GuestReviewResponseModalProps {
  visible: boolean;
  onClose: () => void;
  review: GuestReview | null;
  onResponseSubmitted: () => void;
}

const GuestReviewResponseModal: React.FC<GuestReviewResponseModalProps> = ({
  visible,
  onClose,
  review,
  onResponseSubmitted,
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { createResponseForGuestReview, loading } = useGuestReviews();
  const [responseText, setResponseText] = useState('');
  const [rating, setRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [respectRulesRating, setRespectRulesRating] = useState(0);

  useEffect(() => {
    if (visible && review) {
      setResponseText(review.response?.response || '');
      setRating(review.response?.rating ?? 0);
      setCleanlinessRating(review.response?.cleanliness_rating ?? 0);
      setCommunicationRating(review.response?.communication_rating ?? 0);
      setRespectRulesRating(review.response?.respect_rules_rating ?? 0);
    }
  }, [visible, review]);

  const hasExistingResponse = !!review?.response;
  const canSubmit = responseText.trim().length > 0 && (hasExistingResponse || (rating >= 1 && rating <= 5));

  const handleSubmit = async () => {
    if (!review || !responseText.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir votre avis (commentaire).');
      return;
    }
    if (!hasExistingResponse && (rating < 1 || rating > 5)) {
      Alert.alert('Erreur', 'Veuillez donner une note globale (obligatoire).');
      return;
    }
    const result = await createResponseForGuestReview(review.id, responseText.trim(), {
      rating: rating || 0,
      cleanlinessRating: cleanlinessRating || undefined,
      communicationRating: communicationRating || undefined,
      respectRulesRating: respectRulesRating || undefined,
    });
    if (result.success) {
      setResponseText('');
      setRating(0);
      setCleanlinessRating(0);
      setCommunicationRating(0);
      setRespectRulesRating(0);
      onResponseSubmitted();
      onClose();
    } else if (result.error) {
      Alert.alert('Erreur', result.error);
    }
  };

  const StarRatingRow = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <View style={styles.ratingCategory}>
      <Text style={styles.ratingCategoryLabel}>{label}</Text>
      <View style={styles.starsRowInput}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onChange(star)} style={styles.starTouch} activeOpacity={0.7}>
            <Ionicons name={value >= star ? 'star' : 'star-outline'} size={28} color={value >= star ? '#fbbf24' : '#d1d5db'} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (!review) return null;

  const propertyTitle = (review.property as any)?.title || 'Réservation';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Donner mon avis</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Avis de l'hôte sur {propertyTitle}</Text>
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
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator
            >
              <Text style={styles.hint}>
                {hasExistingResponse
                  ? "Votre avis (que vous avez laissé en réponse)."
                  : ""}
              </Text>
              {!hasExistingResponse && (
                <>
                  <View style={styles.ratingSection}>
                    <Text style={styles.globalRatingLabel}>Note globale *</Text>
                    <View style={styles.starsRowInput}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starTouch} activeOpacity={0.7}>
                          <Ionicons name={rating >= star ? 'star' : 'star-outline'} size={32} color={rating >= star ? '#fbbf24' : '#d1d5db'} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.ratingSection}>
                    <Text style={styles.detailRatingTitle}>Notes détaillées (optionnel)</Text>
                    <StarRatingRow value={cleanlinessRating} onChange={setCleanlinessRating} label="Propreté (état du logement)" />
                    <StarRatingRow value={communicationRating} onChange={setCommunicationRating} label="Communication" />
                    <StarRatingRow value={respectRulesRating} onChange={setRespectRulesRating} label="Respect des règles de la maison" />
                  </View>
                </>
              )}
              {hasExistingResponse && review.response?.rating != null && review.response.rating >= 1 && (
                <View style={styles.ratingSection}>
                  <Text style={styles.ratingLabel}>Votre note globale</Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= review.response!.rating! ? 'star' : 'star-outline'}
                        size={18}
                        color={star <= review.response!.rating! ? '#fbbf24' : '#d1d5db'}
                      />
                    ))}
                  </View>
                  {(review.response.cleanliness_rating != null || review.response.communication_rating != null || review.response.respect_rules_rating != null) && (
                    <View style={styles.detailRatingsReadOnly}>
                      {review.response.cleanliness_rating != null && <Text style={styles.detailRatingLine}>Propreté : {review.response.cleanliness_rating}/5</Text>}
                      {review.response.communication_rating != null && <Text style={styles.detailRatingLine}>Communication : {review.response.communication_rating}/5</Text>}
                      {review.response.respect_rules_rating != null && <Text style={styles.detailRatingLine}>Respect des règles : {review.response.respect_rules_rating}/5</Text>}
                    </View>
                  )}
                </View>
              )}
              <Text style={styles.inputLabel}>Votre avis (commentaire)</Text>
              <TextInput
                style={styles.input}
                value={responseText}
                onChangeText={setResponseText}
                placeholder="Écrivez votre avis..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!review.response}
                onFocus={() => {
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                }}
              />
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>{review.response ? 'Fermer' : 'Annuler'}</Text>
            </TouchableOpacity>
            {!review.response && (
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!canSubmit || loading) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit || loading}
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
    height: SCREEN_HEIGHT * 0.88,
    maxHeight: '92%',
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
    flex: 1,
    marginTop: 12,
    minHeight: 120,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 320,
  },
  globalRatingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  detailRatingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 12,
  },
  ratingCategory: {
    marginBottom: 14,
  },
  ratingCategoryLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  detailRatingsReadOnly: {
    marginTop: 8,
  },
  detailRatingLine: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  hint: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  ratingSection: {
    marginBottom: 16,
  },
  starsRowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  starTouch: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 13,
    color: '#666',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
    backgroundColor: PRIMARY,
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

export default GuestReviewResponseModal;
