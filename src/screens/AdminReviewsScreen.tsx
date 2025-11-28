import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdminReviews } from '../hooks/useAdminReviews';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { Review } from '../hooks/useReviews';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

const AdminReviewsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { t } = useLanguage();
  const { getAllPendingReviews, approveReview, rejectReview, loading } = useAdminReviews();
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Test d'avis
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPropertyId, setTestPropertyId] = useState('');
  const [testLocationRating, setTestLocationRating] = useState(5);
  const [testCleanlinessRating, setTestCleanlinessRating] = useState(5);
  const [testValueRating, setTestValueRating] = useState(5);
  const [testCommunicationRating, setTestCommunicationRating] = useState(5);
  const [testComment, setTestComment] = useState('');
  const [properties, setProperties] = useState<any[]>([]);
  const [creatingTest, setCreatingTest] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (user && profile) {
        checkAdminAndLoad();
      }
    }, [user, profile])
  );

  const checkAdminAndLoad = async () => {
    if (profile?.role !== 'admin') {
      Alert.alert(
        t('common.error'),
        t('admin.accessDenied') || 'Vous n\'avez pas les permissions nécessaires',
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      );
      return;
    }
    
    setIsAdmin(true);
    loadPendingReviews();
    loadProperties();
  };
  
  const loadProperties = async () => {
    const { data } = await supabase
      .from('properties')
      .select('id, title')
      .eq('is_active', true)
      .order('title');
    
    if (data) {
      setProperties(data);
    }
  };

  const loadPendingReviews = async () => {
    const data = await getAllPendingReviews();
    setReviews(data);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPendingReviews();
    setRefreshing(false);
  };

  const handleApprove = async (review: Review) => {
    Alert.alert(
      t('review.approve') || 'Approuver l\'avis',
      t('review.approveConfirm') || 'Êtes-vous sûr de vouloir approuver cet avis ?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('review.approve') || 'Approuver',
          onPress: async () => {
            const result = await approveReview(review.id, adminNotes || undefined);
            if (result.success) {
              Alert.alert(
                t('review.approved') || 'Avis approuvé',
                t('review.approvedDesc') || 'L\'avis a été approuvé avec succès'
              );
              setAdminNotes('');
              setSelectedReview(null);
              loadPendingReviews();
            } else {
              Alert.alert(
                t('common.error'),
                t('review.approveError') || 'Impossible d\'approuver l\'avis'
              );
            }
          },
        },
      ]
    );
  };

  const handleReject = async (review: Review) => {
    if (!adminNotes.trim()) {
      Alert.alert(
        t('review.notesRequired') || 'Notes requises',
        t('review.notesRequiredDesc') || 'Veuillez ajouter des notes avant de rejeter'
      );
      return;
    }

    Alert.alert(
      t('review.reject') || 'Rejeter l\'avis',
      t('review.rejectConfirm') || 'Êtes-vous sûr de vouloir rejeter cet avis ? Cette action est irréversible.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('review.reject') || 'Rejeter',
          style: 'destructive',
          onPress: async () => {
            const result = await rejectReview(review.id, adminNotes);
            if (result.success) {
              Alert.alert(
                t('review.rejected') || 'Avis rejeté',
                t('review.rejectedDesc') || 'L\'avis a été rejeté'
              );
              setAdminNotes('');
              setSelectedReview(null);
              loadPendingReviews();
            } else {
              Alert.alert(
                t('common.error'),
                t('review.rejectError') || 'Impossible de rejeter l\'avis'
              );
            }
          },
        },
      ]
    );
  };

  const handleCreateTestReview = async () => {
    if (!testPropertyId || !testComment.trim()) {
      Alert.alert(
        t('common.error') || 'Erreur',
        'Veuillez sélectionner une propriété et ajouter un commentaire'
      );
      return;
    }

    if (!user) {
      Alert.alert(
        t('common.error') || 'Erreur',
        'Vous devez être connecté'
      );
      return;
    }

    try {
      setCreatingTest(true);
      
      // Récupérer les informations de la propriété
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('id, host_id, price_per_night')
        .eq('id', testPropertyId)
        .single();

      if (propertyError || !propertyData) {
        throw new Error('Propriété introuvable');
      }

      // Créer une réservation de test (dates futures pour éviter la validation)
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() + 1); // Demain
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2); // Dans 3 jours

      const { data: testBooking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          property_id: testPropertyId,
          guest_id: user.id,
          check_in_date: checkInDate.toISOString().split('T')[0],
          check_out_date: checkOutDate.toISOString().split('T')[0],
          guests_count: 1,
          total_price: (propertyData.price_per_night || 10000) * 2,
          status: 'confirmed',
          message_to_host: 'Réservation de test pour créer un avis'
        })
        .select()
        .single();

      if (bookingError) {
        // Si la réservation existe déjà, essayer de la récupérer
        const { data: existingBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('property_id', testPropertyId)
          .eq('guest_id', user.id)
          .eq('status', 'confirmed')
          .maybeSingle();

        if (!existingBooking) {
          throw bookingError;
        }

        // Vérifier si un avis existe déjà pour cette réservation
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('booking_id', existingBooking.id)
          .eq('reviewer_id', user.id)
          .maybeSingle();

        if (existingReview) {
          throw new Error('Un avis existe déjà pour cette réservation de test');
        }

        // Créer l'avis avec la réservation existante
        const { error: reviewError } = await supabase
          .from('reviews')
          .insert({
            booking_id: existingBooking.id,
            property_id: testPropertyId,
            reviewer_id: user.id,
            location_rating: testLocationRating,
            cleanliness_rating: testCleanlinessRating,
            value_rating: testValueRating,
            communication_rating: testCommunicationRating,
            comment: testComment.trim(),
            approved: false
          } as any);

        if (reviewError) throw reviewError;

        Alert.alert(
          'Avis de test créé',
          'L\'avis de test a été créé et apparaîtra dans la liste',
          [{ text: t('common.ok') || 'OK', onPress: () => {
            setShowTestModal(false);
            setTestPropertyId('');
            setTestLocationRating(5);
            setTestCleanlinessRating(5);
            setTestValueRating(5);
            setTestCommunicationRating(5);
            setTestComment('');
            loadPendingReviews();
          }}]
        );
        return;
      }

      if (!testBooking) {
        throw new Error('Impossible de créer la réservation de test');
      }

      // Créer l'avis avec la nouvelle réservation
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          booking_id: testBooking.id,
          property_id: testPropertyId,
          reviewer_id: user.id,
          location_rating: testLocationRating,
          cleanliness_rating: testCleanlinessRating,
          value_rating: testValueRating,
          communication_rating: testCommunicationRating,
          comment: testComment.trim(),
          approved: false
        } as any);

      if (reviewError) throw reviewError;

      Alert.alert(
        'Avis de test créé',
        'L\'avis de test a été créé et apparaîtra dans la liste',
        [{ text: t('common.ok') || 'OK', onPress: () => {
          setShowTestModal(false);
          setTestPropertyId('');
          setTestLocationRating(5);
          setTestCleanlinessRating(5);
          setTestValueRating(5);
          setTestCommunicationRating(5);
          setTestComment('');
          loadPendingReviews();
        }}]
      );
    } catch (error: any) {
      console.error('Error creating test review:', error);
      Alert.alert(
        t('common.error') || 'Erreur',
        error.message || 'Impossible de créer l\'avis de test'
      );
    } finally {
      setCreatingTest(false);
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
            color={star <= rating ? '#FFD700' : '#ccc'}
          />
        ))}
      </View>
    );
  };
  
  const renderRatingSelector = (
    title: string,
    icon: string,
    rating: number,
    setRating: (value: number) => void
  ) => (
    <View style={styles.testRatingCategory}>
      <View style={styles.testRatingHeader}>
        <Ionicons name={icon as any} size={18} color="#666" />
        <Text style={styles.testRatingTitle}>{title}</Text>
      </View>
      <View style={styles.testStarsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.testStarButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={24}
              color={star <= rating ? '#FFD700' : '#ccc'}
            />
          </TouchableOpacity>
        ))}
        <Text style={styles.testRatingValue}>{rating}/5</Text>
      </View>
    </View>
  );

  const renderReviewItem = ({ item: review }: { item: Review }) => {
    const isSelected = selectedReview?.id === review.id;
    
    return (
      <TouchableOpacity
        style={[styles.reviewCard, isSelected && styles.reviewCardSelected]}
        onPress={() => {
          setSelectedReview(isSelected ? null : review);
          setAdminNotes('');
        }}
      >
        <View style={styles.reviewHeader}>
          <View style={styles.reviewInfo}>
            <Text style={styles.reviewerName}>
              {review.reviewer_name || 'Utilisateur'}
            </Text>
            <Text style={styles.propertyTitle}>
              {(review as any).properties?.title || 'Propriété'}
            </Text>
            {renderStars(review.rating)}
          </View>
          <Text style={styles.reviewDate}>
            {new Date(review.created_at).toLocaleDateString('fr-FR')}
          </Text>
        </View>

        {/* Notes détaillées */}
        {(review.location_rating || review.cleanliness_rating || review.value_rating || review.communication_rating) && (
          <View style={styles.detailedRatings}>
            {review.location_rating && (
              <View style={styles.detailedRatingItem}>
                <Text style={styles.detailedRatingLabel}>Localisation:</Text>
                <Text style={styles.detailedRatingValue}>{review.location_rating}/5</Text>
              </View>
            )}
            {review.cleanliness_rating && (
              <View style={styles.detailedRatingItem}>
                <Text style={styles.detailedRatingLabel}>Propreté:</Text>
                <Text style={styles.detailedRatingValue}>{review.cleanliness_rating}/5</Text>
              </View>
            )}
            {review.value_rating && (
              <View style={styles.detailedRatingItem}>
                <Text style={styles.detailedRatingLabel}>Qualité/Prix:</Text>
                <Text style={styles.detailedRatingValue}>{review.value_rating}/5</Text>
              </View>
            )}
            {review.communication_rating && (
              <View style={styles.detailedRatingItem}>
                <Text style={styles.detailedRatingLabel}>Communication:</Text>
                <Text style={styles.detailedRatingValue}>{review.communication_rating}/5</Text>
              </View>
            )}
          </View>
        )}

        {review.comment && (
          <Text style={styles.reviewComment}>{review.comment}</Text>
        )}

        {isSelected && (
          <View style={styles.adminActions}>
            <TextInput
              style={styles.notesInput}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder={t('review.adminNotes') || 'Notes admin (optionnel)'}
              multiline
              numberOfLines={3}
            />
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => handleApprove(review)}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {t('review.approve') || 'Approuver'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleReject(review)}
              >
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {t('review.reject') || 'Rejeter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('admin.reviews') || 'Validation des avis'}
        </Text>
        <TouchableOpacity
          style={styles.testButton}
          onPress={() => setShowTestModal(true)}
        >
          <Ionicons name="flask" size={20} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>
            {t('admin.loading') || 'Chargement des avis...'}
          </Text>
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>
            {t('admin.noPendingReviews') || 'Aucun avis en attente'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('admin.noPendingReviewsDesc') || 'Tous les avis ont été traités'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          renderItem={renderReviewItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2E7D32']}
              tintColor="#2E7D32"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de test d'avis */}
      <Modal
        visible={showTestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer un avis de test</Text>
              <TouchableOpacity
                onPress={() => setShowTestModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Sélection de propriété */}
              <View style={styles.testSection}>
                <Text style={styles.testLabel}>Propriété *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propertiesList}>
                  {properties.map((prop) => (
                    <TouchableOpacity
                      key={prop.id}
                      style={[
                        styles.propertyOption,
                        testPropertyId === prop.id && styles.propertyOptionSelected
                      ]}
                      onPress={() => setTestPropertyId(prop.id)}
                    >
                      <Text style={[
                        styles.propertyOptionText,
                        testPropertyId === prop.id && styles.propertyOptionTextSelected
                      ]}>
                        {prop.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Notes */}
              {renderRatingSelector('Localisation', 'location', testLocationRating, setTestLocationRating)}
              {renderRatingSelector('Propreté', 'sparkles', testCleanlinessRating, setTestCleanlinessRating)}
              {renderRatingSelector('Qualité/Prix', 'cash', testValueRating, setTestValueRating)}
              {renderRatingSelector('Communication', 'chatbubble-ellipses', testCommunicationRating, setTestCommunicationRating)}

              {/* Commentaire */}
              <View style={styles.testSection}>
                <Text style={styles.testLabel}>Commentaire *</Text>
                <TextInput
                  style={styles.testCommentInput}
                  value={testComment}
                  onChangeText={setTestComment}
                  placeholder="Commentaire de test..."
                  multiline
                  numberOfLines={4}
                  maxLength={1000}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{testComment.length}/1000</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowTestModal(false)}
                disabled={creatingTest}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalSubmitButton,
                  (!testPropertyId || !testComment.trim() || creatingTest) && styles.modalSubmitButtonDisabled
                ]}
                onPress={handleCreateTestReview}
                disabled={!testPropertyId || !testComment.trim() || creatingTest}
              >
                {creatingTest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Créer l'avis</Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  testButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e8f5e9',
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalSubmitButton: {
    backgroundColor: '#2E7D32',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  testSection: {
    marginBottom: 20,
  },
  testLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  propertiesList: {
    maxHeight: 120,
  },
  propertyOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    backgroundColor: '#f8f9fa',
  },
  propertyOptionSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#e8f5e9',
  },
  propertyOptionText: {
    fontSize: 14,
    color: '#333',
  },
  propertyOptionTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  testRatingCategory: {
    marginBottom: 16,
  },
  testRatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  testRatingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  testStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  testStarButton: {
    padding: 4,
  },
  testRatingValue: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  testCommentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
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
    shadowRadius: 3.84,
    elevation: 5,
  },
  reviewCardSelected: {
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewComment: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginTop: 8,
  },
  adminActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    backgroundColor: '#f8f9fa',
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
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
  approveButton: {
    backgroundColor: '#2E7D32',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  detailedRatings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  detailedRatingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: '45%',
  },
  detailedRatingLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailedRatingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
});

export default AdminReviewsScreen;









