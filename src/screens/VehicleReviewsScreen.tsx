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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useVehicleReviews, VehicleReview } from '../hooks/useVehicleReviews';
import { VEHICLE_COLORS } from '../constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VehicleReviewWithDetails extends VehicleReview {
  reviewer?: {
    first_name: string | null;
    last_name: string | null;
  };
  response?: {
    id: string;
    response: string;
    created_at: string;
  };
}

const VehicleReviewsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ VehicleReviews: { vehicleId: string } }, 'VehicleReviews'>>();
  const { vehicleId } = route.params || {};
  const { user } = useAuth();
  const { getVehicleReviews, loading } = useVehicleReviews();
  const [reviews, setReviews] = useState<VehicleReviewWithDetails[]>([]);
  const [vehicle, setVehicle] = useState<{ title?: string; brand?: string; model?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<VehicleReviewWithDetails | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && vehicleId) {
      loadData();
    }
  }, [user, vehicleId]);

  const loadData = async () => {
    if (!vehicleId) return;
    
    // Charger les infos du véhicule
    try {
      const { data: vehicleData } = await (supabase as any)
        .from('vehicles')
        .select('title, brand, model')
        .eq('id', vehicleId)
        .single();
      setVehicle(vehicleData);
    } catch (error) {
      console.error('Error loading vehicle:', error);
    }
    
    // Charger les avis
    await loadReviews();
  };

  const loadReviews = async () => {
    if (!vehicleId) return;
    
    try {
      // Charger tous les avis (pas seulement approuvés) pour le propriétaire
      const { data: reviewsData, error } = await (supabase as any)
        .from('vehicle_reviews')
        .select(`
          *,
          reviewer:profiles!vehicle_reviews_reviewer_id_fkey(first_name, last_name)
        `)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading reviews:', error);
        return;
      }

      // Charger les réponses
      const reviewIds = (reviewsData || []).map((r: any) => r.id);
      if (reviewIds.length > 0) {
        const { data: responses } = await (supabase as any)
          .from('vehicle_review_responses')
          .select('*')
          .in('review_id', reviewIds);

        const enrichedReviews = (reviewsData || []).map((review: any) => ({
          ...review,
          reviewer: review.reviewer || undefined,
          response: (responses || []).find((r: any) => r.review_id === review.id)
        }));

        setReviews(enrichedReviews);
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const handleOpenResponseModal = (review: VehicleReviewWithDetails) => {
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
          .from('vehicle_review_responses')
          .update({ 
            response: responseText.trim()
          })
          .eq('id', selectedReview.response.id);

        if (error) throw error;
      } else {
        // Create new response
        const { error } = await (supabase as any)
          .from('vehicle_review_responses')
          .insert({
            review_id: selectedReview.id,
            owner_id: user.id,
            response: responseText.trim()
          });

        if (error) throw error;
      }

      Alert.alert('Succès', 'Votre réponse a été enregistrée et l\'avis est maintenant publié');
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
          <Text style={styles.headerTitle}>Avis</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptyText}>
            Vous devez être connecté pour voir les avis
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const pendingReviews = reviews.filter(r => !r.response);
  const respondedReviews = reviews.filter(r => r.response);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Avis</Text>
          <Text style={styles.headerSubtitle}>
            {vehicle 
              ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || vehicle.title || 'Véhicule'
              : 'Véhicule'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              Système d'avis mutuel
            </Text>
            <Text style={styles.infoText}>
              Les avis sont publiés automatiquement dès que vous y répondez. Répondez pour que l'avis soit visible publiquement.
            </Text>
          </View>
        </View>

        {/* Statistics */}
        {reviews.length > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{reviews.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{pendingReviews.length}</Text>
              <Text style={styles.statLabel}>En attente</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#10b981' }]}>{respondedReviews.length}</Text>
              <Text style={styles.statLabel}>Publiés</Text>
            </View>
          </View>
        )}

        {/* Reviews list */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Aucun avis reçu</Text>
            <Text style={styles.emptyText}>
              Les avis des locataires apparaîtront ici après leurs locations.
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <View 
                key={review.id} 
                style={[
                  styles.reviewCard,
                  !review.response && styles.reviewCardUnpublished
                ]}
              >
                {/* Publication status */}
                {!review.response && (
                  <View style={styles.statusBadge}>
                    <Ionicons name="eye-off-outline" size={16} color="#e67e22" />
                    <Text style={styles.statusText}>
                      Non publié - Répondez pour publier cet avis
                    </Text>
                  </View>
                )}
                {review.response && (
                  <View style={[styles.statusBadge, styles.statusBadgePublished]}>
                    <Ionicons name="eye-outline" size={16} color="#10b981" />
                    <Text style={[styles.statusText, styles.statusTextPublished]}>
                      Publié et visible
                    </Text>
                  </View>
                )}

                <View style={styles.reviewHeader}>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewerName}>
                      {review.reviewer 
                        ? `${review.reviewer.first_name || ''} ${review.reviewer.last_name || ''}`.trim() || 'Anonyme'
                        : 'Anonyme'}
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
                {(review.condition_rating || review.cleanliness_rating || review.value_rating || review.communication_rating) && (
                  <View style={styles.ratingsBadges}>
                    {review.condition_rating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>
                          État: {review.condition_rating}/5
                        </Text>
                      </View>
                    )}
                    {review.cleanliness_rating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>
                          Propreté: {review.cleanliness_rating}/5
                        </Text>
                      </View>
                    )}
                    {review.value_rating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>
                          Qualité/Prix: {review.value_rating}/5
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
                  <Ionicons name="chatbubble-outline" size={18} color={VEHICLE_COLORS.primary} />
                  <Text style={[styles.responseButtonText, { color: VEHICLE_COLORS.primary }]}>
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
                        {selectedReview.reviewer 
                          ? `${selectedReview.reviewer.first_name || ''} ${selectedReview.reviewer.last_name || ''}`.trim() || 'Anonyme'
                          : 'Anonyme'}
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
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
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: VEHICLE_COLORS.primary,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
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
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
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
    borderLeftColor: VEHICLE_COLORS.primary,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: VEHICLE_COLORS.primary,
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
    borderColor: VEHICLE_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  responseButtonText: {
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
    backgroundColor: VEHICLE_COLORS.primary,
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

export default VehicleReviewsScreen;


