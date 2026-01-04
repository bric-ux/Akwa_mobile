import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVehicleReviews, VehicleReview } from '../hooks/useVehicleReviews';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

interface VehicleReviewsProps {
  vehicleId: string;
  ownerId?: string;
}

// Formatage de date simple
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  return `${day} ${months[date.getMonth()]} ${year}`;
};

const VehicleReviews: React.FC<VehicleReviewsProps> = ({ vehicleId, ownerId }) => {
  const [reviews, setReviews] = useState<VehicleReview[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const { getVehicleReviews } = useVehicleReviews();
  const { user } = useAuth();
  const isOwner = user?.id === ownerId;
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [vehicleId]);

  const loadReviews = async () => {
    setLoading(true);
    const data = await getVehicleReviews(vehicleId);
    setReviews(data);

    // Charger les réponses pour chaque avis
    const responsesData: Record<string, any> = {};
    for (const review of data) {
      const { data: response } = await supabase
        .from('vehicle_review_responses')
        .select('*')
        .eq('review_id', review.id)
        .maybeSingle();
      if (response) {
        responsesData[review.id] = response;
      }
    }
    setResponses(responsesData);
    setLoading(false);
  };

  const handleSubmitResponse = async (reviewId: string) => {
    if (!responseText.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('vehicle_review_responses')
        .insert({
          review_id: reviewId,
          owner_id: user.id,
          response: responseText.trim(),
        });

      if (error) throw error;

      Alert.alert('Succès', 'Votre réponse a été publiée avec succès');
      setRespondingTo(null);
      setResponseText('');
      loadReviews();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || "Impossible d'envoyer la réponse");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Avis des locataires</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </View>
    );
  }

  // Filtrer uniquement les avis approuvés
  const approvedReviews = reviews.filter(r => r.approved === true);

  if (approvedReviews.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Avis des locataires</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="star-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>
            Aucun avis pour le moment. Soyez le premier à laisser un avis !
          </Text>
        </View>
      </View>
    );
  }

  const averageRating = approvedReviews.reduce((sum, review) => sum + review.rating, 0) / approvedReviews.length;

  return (
    <View style={styles.container}>
      {/* En-tête avec note moyenne */}
      <View style={styles.header}>
        <Text style={styles.title}>Avis des locataires</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={24} color="#fbbf24" />
          <Text style={styles.averageRating}>
            {averageRating.toFixed(1)}
          </Text>
          <Text style={styles.reviewCount}>
            ({approvedReviews.length} avis)
          </Text>
        </View>
      </View>

      {/* Liste des avis */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.reviewsScroll}
        contentContainerStyle={styles.reviewsContent}
      >
        {approvedReviews.map((review) => {
          const response = responses[review.id];

          return (
            <View key={review.id} style={styles.reviewCard}>
              {/* En-tête de l'avis */}
              <View style={styles.reviewHeader}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>
                    {review.reviewer_name ? review.reviewer_name.substring(0, 2).toUpperCase() : 'AN'}
                  </Text>
                </View>

                <View style={styles.reviewHeaderContent}>
                  <View style={styles.reviewHeaderTop}>
                    <Text style={styles.reviewerName}>
                      {review.reviewer_name || 'Anonyme'}
                    </Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={16} color="#fbbf24" />
                      <Text style={styles.ratingValue}>{review.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>
                    {formatDate(review.created_at)}
                  </Text>
                </View>
              </View>

              {/* Notes détaillées */}
              <View style={styles.detailedRatings}>
                {review.condition_rating && (
                  <View style={styles.detailedRatingItem}>
                    <Ionicons name="car-outline" size={14} color="#666" />
                    <View style={styles.detailedRatingContent}>
                      <Text style={styles.detailedRatingLabel}>État</Text>
                      <View style={styles.detailedRatingStars}>
                        <Ionicons name="star" size={12} color="#fbbf24" />
                        <Text style={styles.detailedRatingValue}>
                          {review.condition_rating}/5
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                {review.cleanliness_rating && (
                  <View style={styles.detailedRatingItem}>
                    <Ionicons name="sparkles-outline" size={14} color="#666" />
                    <View style={styles.detailedRatingContent}>
                      <Text style={styles.detailedRatingLabel}>Propreté</Text>
                      <View style={styles.detailedRatingStars}>
                        <Ionicons name="star" size={12} color="#fbbf24" />
                        <Text style={styles.detailedRatingValue}>
                          {review.cleanliness_rating}/5
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                {review.value_rating && (
                  <View style={styles.detailedRatingItem}>
                    <Ionicons name="cash-outline" size={14} color="#666" />
                    <View style={styles.detailedRatingContent}>
                      <Text style={styles.detailedRatingLabel}>Qualité/Prix</Text>
                      <View style={styles.detailedRatingStars}>
                        <Ionicons name="star" size={12} color="#fbbf24" />
                        <Text style={styles.detailedRatingValue}>
                          {review.value_rating}/5
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
                {review.communication_rating && (
                  <View style={styles.detailedRatingItem}>
                    <Ionicons name="chatbubble-outline" size={14} color="#666" />
                    <View style={styles.detailedRatingContent}>
                      <Text style={styles.detailedRatingLabel}>Communication</Text>
                      <View style={styles.detailedRatingStars}>
                        <Ionicons name="star" size={12} color="#fbbf24" />
                        <Text style={styles.detailedRatingValue}>
                          {review.communication_rating}/5
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Commentaire */}
              {review.comment && (
                <View style={styles.commentContainer}>
                  <Text style={styles.commentText}>{review.comment}</Text>
                </View>
              )}

              {/* Réponse du propriétaire */}
              {response && (
                <View style={styles.responseContainer}>
                  <View style={styles.responseHeader}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#666" />
                    <Text style={styles.responseLabel}>Réponse du propriétaire</Text>
                  </View>
                  <Text style={styles.responseText}>{response.response}</Text>
                  <Text style={styles.responseDate}>
                    {formatDate(response.created_at)}
                  </Text>
                </View>
              )}

              {/* Bouton de réponse pour le propriétaire */}
              {isOwner && !response && (
                <TouchableOpacity
                  style={styles.responseButton}
                  onPress={() => setRespondingTo(review.id)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#1e293b" />
                  <Text style={styles.responseButtonText}>Répondre à cet avis</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Modal de réponse */}
      <Modal
        visible={respondingTo !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setRespondingTo(null);
          setResponseText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Répondre à l'avis de {reviews.find(r => r.id === respondingTo)?.reviewer_name || 'Anonyme'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setRespondingTo(null);
                  setResponseText('');
                }}
              >
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.quoteContainer}>
                <Text style={styles.quoteText}>
                  "{reviews.find(r => r.id === respondingTo)?.comment}"
                </Text>
              </View>

              <TextInput
                style={styles.responseInput}
                value={responseText}
                onChangeText={setResponseText}
                placeholder="Écrivez votre réponse..."
                multiline
                numberOfLines={4}
                placeholderTextColor="#999"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setRespondingTo(null);
                    setResponseText('');
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSubmitButton,
                    (!responseText.trim() || isSubmitting) && styles.modalSubmitButtonDisabled,
                  ]}
                  onPress={() => respondingTo && handleSubmitResponse(respondingTo)}
                  disabled={!responseText.trim() || isSubmitting}
                >
                  <Text style={styles.modalSubmitButtonText}>
                    {isSubmitting ? 'Envoi...' : 'Publier la réponse'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  averageRating: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  reviewsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  reviewsContent: {
    gap: 16,
  },
  reviewCard: {
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reviewHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewHeaderContent: {
    flex: 1,
  },
  reviewHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
  },
  detailedRatings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  detailedRatingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: '45%',
  },
  detailedRatingContent: {
    flex: 1,
  },
  detailedRatingLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  detailedRatingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailedRatingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  commentContainer: {
    marginBottom: 16,
  },
  commentText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  responseContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  responseText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
    marginBottom: 8,
  },
  responseDate: {
    fontSize: 12,
    color: '#999',
  },
  responseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  responseButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
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
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginRight: 16,
  },
  modalBody: {
    padding: 20,
  },
  quoteContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  quoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSubmitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VehicleReviews;

