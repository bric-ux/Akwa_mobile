import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useGuestReviews, GuestReview } from '../hooks/useGuestReviews';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const MyGuestReviewsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getReviewsForGuest, loading } = useGuestReviews();
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<GuestReview | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadReviews();
    }
  }, [user]);

  const loadReviews = async () => {
    if (!user) return;
    const data = await getReviewsForGuest(user.id, true); // Include unpublished
    setReviews(data);
    
    if (data.length > 0) {
      const avg = data.reduce((acc, r) => acc + r.rating, 0) / data.length;
      setAverageRating(Math.round(avg * 10) / 10);
    } else {
      setAverageRating(0);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const handleOpenResponseModal = (review: GuestReview) => {
    setSelectedReview(review);
    setResponseText(review.response?.response || '');
    setResponseModalVisible(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview || !user || !responseText.trim()) return;

    setSubmitting(true);
    try {
      if (selectedReview.response) {
        // Update existing response
        const { error } = await (supabase as any)
          .from('guest_review_responses')
          .update({ 
            response: responseText.trim(), 
            updated_at: new Date().toISOString() 
          })
          .eq('id', selectedReview.response.id);

        if (error) throw error;
      } else {
        // Create new response
        const { error } = await (supabase as any)
          .from('guest_review_responses')
          .insert({
            guest_review_id: selectedReview.id,
            guest_id: user.id,
            response: responseText.trim(),
          });

        if (error) throw error;
      }

      Alert.alert('Succès', 'Votre réponse a été enregistrée');
      setResponseModalVisible(false);
      setSelectedReview(null);
      setResponseText('');
      await loadReviews();
    } catch (error: any) {
      console.error('Erreur soumission réponse:', error);
      Alert.alert('Erreur', error.message || 'Impossible de soumettre votre réponse');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color={star <= rating ? '#fbbf24' : '#d1d5db'}
          />
        ))}
      </View>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes avis reçus</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyText}>
            Vous devez être connecté pour voir vos avis
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Mes avis reçus</Text>
          <Text style={styles.headerSubtitle}>
            Avis laissés par les hôtes sur vos séjours
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Statistics */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <View style={styles.statValue}>
              <Text style={styles.statNumber}>
                {averageRating > 0 ? averageRating.toFixed(1) : '-'}
              </Text>
              <Ionicons name="star" size={24} color="#fbbf24" />
            </View>
            <Text style={styles.statLabel}>Note moyenne</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{reviews.length}</Text>
            <Text style={styles.statLabel}>Avis reçus</Text>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Comment fonctionne le système d'avis ?
            </Text>
            <Text style={styles.infoText}>
              Les avis ne sont visibles publiquement qu'une fois que vous y avez répondu. Répondez à chaque avis pour que les hôtes puissent voir votre profil complet.
            </Text>
          </View>
        </View>

        {/* Reviews list */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Aucun avis pour le moment</Text>
            <Text style={styles.emptyText}>
              Les hôtes pourront laisser un avis après vos séjours
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <View 
                key={review.id} 
                style={[
                  styles.reviewCard,
                  !review.is_published && styles.reviewCardUnpublished
                ]}
              >
                {/* Publication status */}
                {!review.is_published && (
                  <View style={styles.statusBadge}>
                    <Ionicons name="eye-off-outline" size={16} color="#e67e22" />
                    <Text style={styles.statusText}>
                      Non visible publiquement - Répondez pour publier cet avis
                    </Text>
                  </View>
                )}
                {review.is_published && (
                  <View style={[styles.statusBadge, styles.statusBadgePublished]}>
                    <Ionicons name="eye-outline" size={16} color="#10b981" />
                    <Text style={[styles.statusText, styles.statusTextPublished]}>
                      Publié et visible par les hôtes
                    </Text>
                  </View>
                )}

                <View style={styles.reviewHeader}>
                  <View style={styles.reviewInfo}>
                    <View style={styles.propertyInfo}>
                      <Ionicons name="home-outline" size={16} color="#6b7280" />
                      <Text style={styles.propertyName}>
                        {review.property?.title || 'Propriété'}
                      </Text>
                    </View>
                    <Text style={styles.hostName}>
                      Par {review.guest?.first_name || 'Hôte'} {review.guest?.last_name || ''}
                    </Text>
                  </View>
                  <View style={styles.ratingContainer}>
                    {renderStars(review.rating)}
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>

                {/* Detailed ratings */}
                {(review.cleanliness_rating || review.communication_rating || review.respect_rules_rating) && (
                  <View style={styles.ratingsBadges}>
                    {review.cleanliness_rating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>
                          Propreté: {review.cleanliness_rating}/5
                        </Text>
                      </View>
                    )}
                    {review.communication_rating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>
                          Communication: {review.communication_rating}/5
                        </Text>
                      </View>
                    )}
                    {review.respect_rules_rating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>
                          Respect règles: {review.respect_rules_rating}/5
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {review.comment && (
                  <Text style={styles.comment}>{review.comment}</Text>
                )}

                {/* Existing response */}
                {review.response && (
                  <View style={styles.responseSection}>
                    <Text style={styles.responseLabel}>Votre réponse</Text>
                    <Text style={styles.responseText}>{review.response.response}</Text>
                  </View>
                )}

                {/* Response button */}
                <TouchableOpacity
                  style={styles.responseButton}
                  onPress={() => handleOpenResponseModal(review)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#2E7D32" />
                  <Text style={styles.responseButtonText}>
                    {review.response ? 'Modifier ma réponse' : 'Répondre à cet avis'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={responseModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setResponseModalVisible(false)}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.5)" barStyle="light-content" />
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setResponseModalVisible(false)}
          />
          <View style={[styles.modalContainer, { paddingTop: StatusBar.currentHeight || 0 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedReview?.response ? 'Modifier votre réponse' : 'Répondre à l\'avis'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setResponseModalVisible(false);
                  setSelectedReview(null);
                  setResponseText('');
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.keyboardAvoidingView}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
              <ScrollView 
                style={styles.modalContent}
                contentContainerStyle={styles.modalContentContainer}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                  {selectedReview && (
                    <View style={styles.reviewPreview}>
                      <View style={styles.reviewPreviewHeader}>
                        <Text style={styles.reviewPreviewProperty}>
                          {selectedReview.property?.title}
                        </Text>
                        {renderStars(selectedReview.rating)}
                      </View>
                      {selectedReview.comment && (
                        <Text style={styles.reviewPreviewComment}>
                          {selectedReview.comment}
                        </Text>
                      )}
                    </View>
                  )}

                  <TextInput
                    style={styles.responseInput}
                    value={responseText}
                    onChangeText={setResponseText}
                    placeholder="Écrivez votre réponse..."
                    multiline
                    numberOfLines={10}
                    textAlignVertical="top"
                  />
              </ScrollView>
            </KeyboardAvoidingView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setResponseModalVisible(false);
                  setSelectedReview(null);
                  setResponseText('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  (!responseText.trim() || submitting) && styles.modalSubmitButtonDisabled
                ]}
                onPress={handleSubmitResponse}
                disabled={!responseText.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  reviewsList: {
    padding: 20,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewCardUnpublished: {
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  statusBadgePublished: {
    backgroundColor: '#d1fae5',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e67e22',
    flex: 1,
  },
  statusTextPublished: {
    color: '#10b981',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reviewInfo: {
    flex: 1,
  },
  propertyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  hostName: {
    fontSize: 14,
    color: '#6b7280',
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  ratingsBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  ratingBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingBadgeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  comment: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 12,
    lineHeight: 20,
  },
  responseSection: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 8,
  },
  responseText: {
    fontSize: 14,
    color: '#1e293b',
  },
  responseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  responseButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.9,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    minHeight: 60,
    zIndex: 10,
    minHeight: 60,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  reviewPreview: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reviewPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewPreviewProperty: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  reviewPreviewComment: {
    fontSize: 13,
    color: '#6b7280',
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 200,
    backgroundColor: '#f8f9fa',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default MyGuestReviewsScreen;

