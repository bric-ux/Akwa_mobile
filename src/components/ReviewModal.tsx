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
import { useReviews } from '../hooks/useReviews';
import { useLanguage } from '../contexts/LanguageContext';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
  bookingId: string;
  onReviewSubmitted: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  visible,
  onClose,
  propertyId,
  bookingId,
  onReviewSubmitted,
}) => {
  const { t } = useLanguage();
  const { submitReview, loading, error } = useReviews();
  const [locationRating, setLocationRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState<{ category: string; value: number } | null>(null);

  const handleSubmit = async () => {
    if (locationRating === 0 || cleanlinessRating === 0 || valueRating === 0 || communicationRating === 0) {
      Alert.alert(
        t('common.error') || 'Erreur',
        'Veuillez noter tous les critères.'
      );
      return;
    }

    const result = await submitReview({
      propertyId,
      bookingId,
      locationRating,
      cleanlinessRating,
      valueRating,
      communicationRating,
      comment: comment.trim() || undefined,
    });

    if (result.success) {
      Alert.alert(
        'Avis soumis',
        'Merci pour votre avis ! Il sera visible après validation par notre équipe.',
        [
          {
            text: t('common.ok') || 'OK',
            onPress: () => {
              setLocationRating(0);
              setCleanlinessRating(0);
              setValueRating(0);
              setCommunicationRating(0);
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

  const RatingCategory = ({ 
    title, 
    icon, 
    rating, 
    setRating, 
    category 
  }: { 
    title: string; 
    icon: string; 
    rating: number; 
    setRating: (value: number) => void;
    category: string;
  }) => {
    const getIconName = () => {
      switch (icon) {
        case 'location': return 'location';
        case 'sparkles': return 'sparkles';
        case 'dollar': return 'cash';
        case 'message': return 'chatbubble-ellipses';
        default: return 'star';
      }
    };

    return (
      <View style={styles.ratingCategory}>
        <View style={styles.ratingHeader}>
          <Ionicons name={getIconName() as any} size={18} color="#666" />
          <Text style={styles.ratingTitle}>{title}</Text>
        </View>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              onPressIn={() => setHoveredRating({ category, value: star })}
              onPressOut={() => setHoveredRating(null)}
              style={styles.starButton}
            >
              <Ionicons
                name={star <= (hoveredRating?.category === category ? hoveredRating.value : rating) ? 'star' : 'star-outline'}
                size={28}
                color={star <= (hoveredRating?.category === category ? hoveredRating.value : rating) ? '#FFD700' : '#ccc'}
              />
            </TouchableOpacity>
          ))}
          {rating > 0 && (
            <Text style={styles.ratingValue}>{rating}/5</Text>
          )}
        </View>
      </View>
    );
  };

  const averageRating = locationRating > 0 && cleanlinessRating > 0 && valueRating > 0 && communicationRating > 0
    ? ((locationRating + cleanlinessRating + valueRating + communicationRating) / 4).toFixed(1)
    : 0;

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
            <Text style={styles.title}>Laisser un avis</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <RatingCategory
                title="Localisation (Facilité à trouver)"
                icon="location"
                rating={locationRating}
                setRating={setLocationRating}
                category="location"
              />

              <RatingCategory
                title="Propreté du logement"
                icon="sparkles"
                rating={cleanlinessRating}
                setRating={setCleanlinessRating}
                category="cleanliness"
              />

              <RatingCategory
                title="Rapport qualité/prix"
                icon="dollar"
                rating={valueRating}
                setRating={setValueRating}
                category="value"
              />

              <RatingCategory
                title="Communication"
                icon="message"
                rating={communicationRating}
                setRating={setCommunicationRating}
                category="communication"
              />

              {/* Moyenne */}
              {averageRating > 0 && (
                <View style={styles.averageContainer}>
                  <Text style={styles.averageLabel}>Note moyenne</Text>
                  <View style={styles.averageValueContainer}>
                    <Ionicons name="star" size={24} color="#FFD700" />
                    <Text style={styles.averageValue}>{averageRating}</Text>
                    <Text style={styles.averageMax}>/5</Text>
                  </View>
                </View>
              )}

              {/* Commentaire */}
              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>
                  Commentaire public (optionnel)
                </Text>
                <TextInput
                  style={styles.commentInput}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Partagez votre expérience..."
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
                (loading || locationRating === 0 || cleanlinessRating === 0 || valueRating === 0 || communicationRating === 0) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading || locationRating === 0 || cleanlinessRating === 0 || valueRating === 0 || communicationRating === 0}
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
    maxHeight: '90%',
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
    padding: 20,
  },
  section: {
    gap: 20,
  },
  ratingCategory: {
    marginBottom: 20,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ratingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
  averageContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginVertical: 8,
  },
  averageLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  averageValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  averageValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  averageMax: {
    fontSize: 18,
    color: '#666',
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

export default ReviewModal;
