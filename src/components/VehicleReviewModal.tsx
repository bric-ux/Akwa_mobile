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
import { useVehicleReviews } from '../hooks/useVehicleReviews';
import { VEHICLE_COLORS } from '../constants/colors';

interface VehicleReviewModalProps {
  visible: boolean;
  onClose: () => void;
  vehicleId: string;
  bookingId: string;
  vehicleTitle: string;
  onReviewSubmitted: () => void;
}

const VehicleReviewModal: React.FC<VehicleReviewModalProps> = ({
  visible,
  onClose,
  vehicleId,
  bookingId,
  vehicleTitle,
  onReviewSubmitted,
}) => {
  const { createReview, loading } = useVehicleReviews();
  const [rating, setRating] = useState(0);
  const [conditionRating, setConditionRating] = useState(0);
  const [cleanlinessRating, setCleanlinessRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRatings, setHoveredRatings] = useState<{ [key: string]: number }>({});

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Note requise', 'Veuillez donner une note globale.');
      return;
    }

    const result = await createReview({
      vehicle_id: vehicleId,
      booking_id: bookingId,
      rating,
      condition_rating: conditionRating || undefined,
      cleanliness_rating: cleanlinessRating || undefined,
      value_rating: valueRating || undefined,
      communication_rating: communicationRating || undefined,
      comment: comment.trim() || undefined,
    });

    if (result.success) {
      setRating(0);
      setConditionRating(0);
      setCleanlinessRating(0);
      setValueRating(0);
      setCommunicationRating(0);
      setComment('');
      onReviewSubmitted();
      onClose();
    }
  };

  const StarRating = ({ 
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
    const hoveredValue = hoveredRatings[category] || rating;

    return (
      <View style={styles.ratingCategory}>
        <View style={styles.ratingCategoryHeader}>
          <Ionicons name={icon as any} size={20} color={VEHICLE_COLORS.primary} />
          <Text style={styles.ratingCategoryTitle}>{title}</Text>
        </View>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              onPressIn={() => setHoveredRatings({ ...hoveredRatings, [category]: star })}
              onPressOut={() => setHoveredRatings({ ...hoveredRatings, [category]: 0 })}
              style={styles.starButton}
            >
              <Ionicons
                name={hoveredValue >= star ? 'star' : 'star-outline'}
                size={28}
                color={hoveredValue >= star ? '#fbbf24' : '#d1d5db'}
              />
            </TouchableOpacity>
          ))}
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
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="star-outline" size={20} color={VEHICLE_COLORS.primary} />
              <Text style={styles.headerTitle}>Votre avis sur {vehicleTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Note globale */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Note globale *</Text>
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
                      color={rating >= star ? '#fbbf24' : '#d1d5db'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes détaillées */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes détaillées</Text>
              <View style={styles.ratingsGrid}>
                <StarRating
                  title="État du véhicule"
                  icon="car-outline"
                  rating={conditionRating}
                  setRating={setConditionRating}
                  category="condition"
                />
                <StarRating
                  title="Propreté"
                  icon="sparkles-outline"
                  rating={cleanlinessRating}
                  setRating={setCleanlinessRating}
                  category="cleanliness"
                />
                <StarRating
                  title="Qualité/Prix"
                  icon="cash-outline"
                  rating={valueRating}
                  setRating={setValueRating}
                  category="value"
                />
                <StarRating
                  title="Communication"
                  icon="chatbubble-outline"
                  rating={communicationRating}
                  setRating={setCommunicationRating}
                  category="communication"
                />
              </View>
            </View>

            {/* Commentaire */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Votre commentaire</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Partagez votre expérience avec ce véhicule..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (rating === 0 || loading) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={rating === 0 || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Envoyer mon avis</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  starButton: {
    padding: 4,
  },
  ratingsGrid: {
    gap: 20,
  },
  ratingCategory: {
    marginBottom: 16,
  },
  ratingCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ratingCategoryTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    backgroundColor: '#f9fafb',
  },
  submitButton: {
    backgroundColor: VEHICLE_COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    margin: 16,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleReviewModal;


