import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReviews, Review } from '../hooks/useReviews';
import { useReviewResponses, ReviewResponse } from '../hooks/useReviewResponses';
import { useAuth } from '../services/AuthContext';
import ReviewResponseModal from './ReviewResponseModal';

interface PropertyReviewsProps {
  propertyId: string;
  hostId?: string;
}

const PropertyReviews: React.FC<PropertyReviewsProps> = ({ propertyId, hostId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [responses, setResponses] = useState<Record<string, ReviewResponse>>({});
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const { getPropertyReviews, loading } = useReviews();
  const { getReviewResponse } = useReviewResponses();
  const { user } = useAuth();
  const isHost = user?.id === hostId;

  useEffect(() => {
    loadReviews();
  }, [propertyId]);

  const loadReviews = async () => {
    const data = await getPropertyReviews(propertyId);
    setReviews(data);
    
    // Charger les réponses pour chaque avis
    const responsesData: Record<string, ReviewResponse> = {};
    for (const review of data) {
      const response = await getReviewResponse(review.id);
      if (response) {
        responsesData[review.id] = response;
      }
    }
    setResponses(responsesData);
  };

  const handleResponseUpdated = () => {
    loadReviews();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Avis des voyageurs</Text>
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
        <Text style={styles.title}>Avis des voyageurs</Text>
        <View style={styles.emptyContainer}>
          <Ionicons name="star-outline" size={48} color="#6c757d" />
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
        <Text style={styles.title}>Avis des voyageurs</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={24} color="#ffc107" />
          <Text style={styles.averageRating}>{averageRating.toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({approvedReviews.length} avis)</Text>
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {review.reviewer_name ? review.reviewer_name.substring(0, 2).toUpperCase() : 'AN'}
                  </Text>
                </View>
                
                <View style={styles.reviewerInfo}>
                  <Text style={styles.reviewerName}>{review.reviewer_name || 'Anonyme'}</Text>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('fr-FR', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </Text>
                </View>
                
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={16} color="#ffc107" />
                  <Text style={styles.ratingText}>{review.rating.toFixed(1)}</Text>
                </View>
              </View>

              {/* Notes détaillées */}
              <View style={styles.ratingsGrid}>
                <View style={styles.ratingItem}>
                  <Ionicons name="location" size={14} color="#666" />
                  <View style={styles.ratingItemContent}>
                    <Text style={styles.ratingItemLabel}>Localisation</Text>
                    <View style={styles.ratingItemValue}>
                      <Ionicons name="star" size={12} color="#ffc107" />
                      <Text style={styles.ratingItemNumber}>{review.location_rating || 0}/5</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.ratingItem}>
                  <Ionicons name="sparkles" size={14} color="#666" />
                  <View style={styles.ratingItemContent}>
                    <Text style={styles.ratingItemLabel}>Propreté</Text>
                    <View style={styles.ratingItemValue}>
                      <Ionicons name="star" size={12} color="#ffc107" />
                      <Text style={styles.ratingItemNumber}>{review.cleanliness_rating || 0}/5</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.ratingItem}>
                  <Ionicons name="cash" size={14} color="#666" />
                  <View style={styles.ratingItemContent}>
                    <Text style={styles.ratingItemLabel}>Qualité/Prix</Text>
                    <View style={styles.ratingItemValue}>
                      <Ionicons name="star" size={12} color="#ffc107" />
                      <Text style={styles.ratingItemNumber}>{review.value_rating || 0}/5</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.ratingItem}>
                  <Ionicons name="chatbubble-ellipses" size={14} color="#666" />
                  <View style={styles.ratingItemContent}>
                    <Text style={styles.ratingItemLabel}>Communication</Text>
                    <View style={styles.ratingItemValue}>
                      <Ionicons name="star" size={12} color="#ffc107" />
                      <Text style={styles.ratingItemNumber}>{review.communication_rating || 0}/5</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Commentaire */}
              {review.comment && (
                <View style={styles.commentContainer}>
                  <Text style={styles.commentText}>{review.comment}</Text>
                </View>
              )}

              {/* Réponse de l'hôte */}
              {response && (
                <View style={styles.responseContainer}>
                  <View style={styles.responseHeader}>
                    <Ionicons name="chatbubble" size={16} color="#666" />
                    <Text style={styles.responseLabel}>Réponse de l'hôte</Text>
                  </View>
                  <Text style={styles.responseText}>{response.response}</Text>
                  <Text style={styles.responseDate}>
                    {new Date(response.created_at).toLocaleDateString('fr-FR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </Text>
                </View>
              )}

              {/* Bouton de réponse pour l'hôte */}
              {isHost && !response && (
                <View style={styles.responseButtonContainer}>
                  <TouchableOpacity
                    style={styles.responseButton}
                    onPress={() => {
                      setSelectedReviewId(review.id);
                      setResponseModalVisible(true);
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color="#2E7D32" />
                    <Text style={styles.responseButtonText}>Répondre</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Modal de réponse */}
      <ReviewResponseModal
        visible={responseModalVisible}
        onClose={() => {
          setResponseModalVisible(false);
          setSelectedReviewId(null);
        }}
        reviewId={selectedReviewId || ''}
        existingResponse={selectedReviewId ? responses[selectedReviewId]?.response : null}
        onResponseSubmitted={handleResponseUpdated}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#333',
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  reviewsScroll: {
    marginHorizontal: -20,
  },
  reviewsContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  reviewCard: {
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '48%',
  },
  ratingItemContent: {
    flex: 1,
  },
  ratingItemLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  ratingItemValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingItemNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  commentContainer: {
    marginBottom: 16,
  },
  commentText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  responseContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  responseText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    marginBottom: 8,
  },
  responseDate: {
    fontSize: 12,
    color: '#999',
  },
  responseButtonContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  responseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    alignSelf: 'flex-start',
  },
  responseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
});

export default PropertyReviews;

