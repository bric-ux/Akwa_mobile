import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { VEHICLE_COLORS } from '../constants/colors';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from '../hooks/useEmailService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type VehicleManagementRouteProp = RouteProp<RootStackParamList, 'VehicleManagement'>;

interface VehicleReviewItem {
  id: string;
  vehicle_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  condition_rating?: number | null;
  cleanliness_rating?: number | null;
  value_rating?: number | null;
  communication_rating?: number | null;
  reviewer?: { first_name: string | null; last_name: string | null };
  response?: {
    id: string;
    response: string;
    created_at: string;
    rating?: number | null;
    vehicle_care_rating?: number | null;
    punctuality_rating?: number | null;
    communication_rating?: number | null;
    respect_rules_rating?: number | null;
  };
}

const VehicleManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleManagementRouteProp>();
  const { vehicleId } = route.params;
  const { user } = useAuth();
  const { getVehicleById, updateVehicle, deleteVehicle, loading } = useVehicles();
  const { sendNewVehicleReviewResponse } = useEmailService();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const galleryScrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const [vehicleReviews, setVehicleReviews] = useState<VehicleReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<VehicleReviewItem | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Scroller vers l'image sélectionnée quand la galerie s'ouvre
  useEffect(() => {
    if (showImageGallery && galleryScrollViewRef.current && vehicle?.images) {
      setTimeout(() => {
        galleryScrollViewRef.current?.scrollTo({
          x: galleryStartIndex * SCREEN_WIDTH,
          animated: false,
        });
      }, 100);
    }
  }, [showImageGallery, galleryStartIndex, vehicle?.images]);

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const loadVehicle = async () => {
    try {
      setLoadingVehicle(true);
      const data = await getVehicleById(vehicleId);
      setVehicle(data);
      if (data) await loadReviews();
    } catch (err) {
      console.error('Erreur lors du chargement du véhicule:', err);
      Alert.alert('Erreur', 'Impossible de charger le véhicule');
    } finally {
      setLoadingVehicle(false);
    }
  };

  const loadReviews = async () => {
    if (!vehicleId) return;
    try {
      setLoadingReviews(true);
      const { data: reviewsData, error } = await (supabase as any)
        .from('vehicle_reviews')
        .select(`
          *,
          reviewer:profiles!vehicle_reviews_reviewer_id_fkey(first_name, last_name)
        `)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      if (error) {
        setVehicleReviews([]);
        return;
      }
      const list = reviewsData || [];
      let responses: any[] = [];
      if (list.length > 0) {
        const { data: responsesData } = await (supabase as any)
          .from('vehicle_review_responses')
          .select('*')
          .in('review_id', list.map((r: any) => r.id));
        responses = responsesData || [];
      }
      const enriched = list.map((r: any) => ({
        ...r,
        reviewer: r.reviewer || r.profiles,
        response: responses.find((res: any) => res.review_id === r.id),
      }));
      setVehicleReviews(enriched);
    } catch (e) {
      console.error('Erreur chargement avis:', e);
      setVehicleReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const renderStars = (ratingValue: number) => (
    <View style={styles.reviewStarsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= ratingValue ? 'star' : 'star-outline'}
          size={14}
          color={star <= ratingValue ? '#fbbf24' : '#d1d5db'}
        />
      ))}
    </View>
  );

  const StarRatingRow = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <View style={styles.responseRatingCategory}>
      <Text style={styles.responseRatingCategoryLabel}>{label}</Text>
      <View style={styles.responseStarsRowInput}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => onChange(star)} style={styles.responseStarTouch} activeOpacity={0.7}>
            <Ionicons name={value >= star ? 'star' : 'star-outline'} size={28} color={value >= star ? '#fbbf24' : '#d1d5db'} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const isNewResponseModal = selectedReview && !selectedReview.response;
  const canSubmitResponseModal = responseText.trim().length > 0 && (!!selectedReview?.response || (responseRating >= 1 && responseRating <= 5));

  const handleOpenResponseModal = (review: VehicleReviewItem) => {
    setSelectedReview(review);
    setResponseText(review.response?.response || '');
    const resp = review.response as any;
    setResponseRating(resp?.rating ?? 0);
    setResponseVehicleCareRating(resp?.vehicle_care_rating ?? 0);
    setResponsePunctualityRating(resp?.punctuality_rating ?? 0);
    setResponseCommunicationRating(resp?.communication_rating ?? 0);
    setResponseRespectRulesRating(resp?.respect_rules_rating ?? 0);
    setResponseModalVisible(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview || !user || !responseText.trim()) return;
    const isNewResponse = !selectedReview.response;
    if (isNewResponse && (responseRating < 1 || responseRating > 5)) {
      Alert.alert('Erreur', 'Veuillez donner une note globale au locataire (1 à 5 étoiles) pour publier l\'avis.');
      return;
    }
    setSubmitting(true);
    try {
      if (selectedReview.response) {
        const { error } = await (supabase as any)
          .from('vehicle_review_responses')
          .update({ response: responseText.trim() })
          .eq('id', selectedReview.response.id);
        if (error) throw error;
      } else {
        const payload: Record<string, unknown> = {
          review_id: selectedReview.id,
          owner_id: user.id,
          response: responseText.trim(),
          rating: responseRating,
        };
        if (responseVehicleCareRating >= 1 && responseVehicleCareRating <= 5) payload.vehicle_care_rating = responseVehicleCareRating;
        if (responsePunctualityRating >= 1 && responsePunctualityRating <= 5) payload.punctuality_rating = responsePunctualityRating;
        if (responseCommunicationRating >= 1 && responseCommunicationRating <= 5) payload.communication_rating = responseCommunicationRating;
        if (responseRespectRulesRating >= 1 && responseRespectRulesRating <= 5) payload.respect_rules_rating = responseRespectRulesRating;
        const { error } = await (supabase as any)
          .from('vehicle_review_responses')
          .insert(payload);
        if (error) throw error;
      }
      if (isNewResponse) {
        try {
          const { data: reviewData } = await (supabase as any)
            .from('vehicle_reviews')
            .select(`
              reviewer_id, vehicle_id, rating, comment,
              vehicles!vehicle_reviews_vehicle_id_fkey(title),
              profiles!vehicle_reviews_reviewer_id_fkey(first_name, last_name, email)
            `)
            .eq('id', selectedReview.id)
            .single();
          const profiles = reviewData?.profiles;
          const vehicles = reviewData?.vehicles;
          const renter = profiles != null ? (Array.isArray(profiles) ? profiles[0] : profiles) : null;
          const vehicleRow = vehicles != null ? (Array.isArray(vehicles) ? vehicles[0] : vehicles) : null;
          if (renter?.email) {
            const renterName = `${renter.first_name || ''} ${renter.last_name || ''}`.trim() || 'Locataire';
            const ownerName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Propriétaire';
            const vehicleTitle = vehicleRow?.title || 'Votre location';
            await sendNewVehicleReviewResponse(renter.email, renterName, ownerName, vehicleTitle, responseText.trim());
          }
        } catch (emailErr) {
          console.error('Erreur envoi email:', emailErr);
        }
      }
      Alert.alert('Succès', 'Votre réponse a été enregistrée');
      setResponseModalVisible(false);
      setSelectedReview(null);
      setResponseText('');
      setResponseRating(0);
      setResponseVehicleCareRating(0);
      setResponsePunctualityRating(0);
      setResponseCommunicationRating(0);
      setResponseRespectRulesRating(0);
      await loadReviews();
    } catch (err: any) {
      Alert.alert('Erreur', err.message || 'Impossible de soumettre votre réponse');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = () => {
    if (!vehicle) return;
    
    Alert.alert(
      vehicle.is_active ? 'Masquer le véhicule' : 'Afficher le véhicule',
      `Êtes-vous sûr de vouloir ${vehicle.is_active ? 'masquer' : 'afficher'} "${vehicle.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: vehicle.is_active ? 'Masquer' : 'Afficher',
          onPress: async () => {
            try {
              const result = await updateVehicle(vehicleId, { is_active: !vehicle.is_active });
              if (result.success) {
                Alert.alert(
                  'Succès',
                  `Véhicule ${vehicle.is_active ? 'masqué' : 'affiché'} avec succès`
                );
                loadVehicle();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de modifier la visibilité');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleDeleteVehicle = () => {
    if (!vehicle) return;
    
    Alert.alert(
      'Supprimer le véhicule',
      `Êtes-vous sûr de vouloir supprimer définitivement "${vehicle.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteVehicle(vehicleId);
              if (result.success) {
                Alert.alert('Succès', 'Véhicule supprimé avec succès');
                navigation.goBack();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de supprimer le véhicule');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleEditVehicle = () => {
    navigation.navigate('EditVehicle' as never, { vehicleId } as never);
  };

  const handleOpenCalendar = () => {
    navigation.navigate('VehicleCalendar' as never, { vehicleId } as never);
  };

  const handleOpenPricing = () => {
    navigation.navigate('VehiclePricing' as never, { vehicleId } as never);
  };

  const handleOpenReviews = () => {
    navigation.navigate('VehicleReviews' as never, { vehicleId } as never);
  };

  const handleImagePress = (index: number) => {
    setGalleryStartIndex(index);
    setShowImageGallery(true);
  };

  const handlePrevImage = () => {
    if (!vehicle?.images) return;
    const newIndex = galleryStartIndex > 0 ? galleryStartIndex - 1 : vehicle.images.length - 1;
    setGalleryStartIndex(newIndex);
    galleryScrollViewRef.current?.scrollTo({
      x: newIndex * SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleNextImage = () => {
    if (!vehicle?.images) return;
    const newIndex = galleryStartIndex < vehicle.images.length - 1 ? galleryStartIndex + 1 : 0;
    setGalleryStartIndex(newIndex);
    galleryScrollViewRef.current?.scrollTo({
      x: newIndex * SCREEN_WIDTH,
      animated: true,
    });
  };

  if (loadingVehicle || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Véhicule non trouvé</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Véhicule introuvable</Text>
          <TouchableOpacity
            style={styles.backButtonStyle}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {vehicle.title}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images-outline" size={20} color="#1e293b" />
            <Text style={styles.sectionTitle}>Photos du véhicule</Text>
          </View>
          {vehicle.images && vehicle.images.length > 0 ? (
            <View style={styles.photosContainer}>
              <Text style={styles.photoCount}>
                {vehicle.images.length} photo{vehicle.images.length > 1 ? 's' : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {vehicle.images.map((url, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoItem}
                    onPress={() => handleImagePress(index)}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: url }} style={styles.photo} />
                    <View style={styles.imageClickIndicator}>
                      <Ionicons name="expand-outline" size={16} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyPhotos}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={styles.emptyPhotosText}>Aucune photo disponible</Text>
            </View>
          )}
        </View>

        {/* Options d'action - Ligne 1 */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleOpenCalendar}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="calendar-outline" size={24} color="#475569" />
            </View>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Calendrier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleEditVehicle}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="create-outline" size={24} color="#d97706" />
            </View>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleToggleVisibility}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons
                name={vehicle.is_active ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color="#475569"
              />
            </View>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {vehicle.is_active ? 'Masquer' : 'Afficher'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Options d'action - Ligne 2 */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleOpenPricing}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="pricetag-outline" size={24} color="#475569" />
            </View>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Tarification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleOpenReviews}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="star-outline" size={24} color="#475569" />
            </View>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>Avis</Text>
          </TouchableOpacity>
        </View>

        {/* Option Supprimer */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteVehicle}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteButtonText}>Supprimer le véhicule</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Galerie d'images */}
      <Modal
        visible={showImageGallery}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageGallery(false)}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.95)" barStyle="light-content" />
        <View style={styles.galleryModalContainer}>
          <View style={[styles.galleryHeader, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.galleryTitle} numberOfLines={1}>
              {vehicle?.title || 'Galerie d\'images'}
            </Text>
            <TouchableOpacity
              style={styles.galleryCloseButton}
              onPress={() => setShowImageGallery(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.galleryImageContainer}>
            {vehicle?.images && vehicle.images.length > 0 && (
              <>
                <ScrollView
                  ref={galleryScrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setGalleryStartIndex(index);
                  }}
                  style={styles.galleryScrollView}
                  contentContainerStyle={styles.galleryScrollContent}
                >
                  {vehicle.images.map((url, index) => (
                    <View key={index} style={styles.galleryImageWrapper}>
                      <Image
                        source={{ uri: url }}
                        style={styles.galleryImage}
                        resizeMode="contain"
                      />
                    </View>
                  ))}
                </ScrollView>

                {vehicle.images.length > 1 && (
                  <>
                    <TouchableOpacity
                      style={[styles.galleryNavButton, styles.galleryNavButtonLeft]}
                      onPress={handlePrevImage}
                    >
                      <Ionicons name="chevron-back" size={32} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.galleryNavButton, styles.galleryNavButtonRight]}
                      onPress={handleNextImage}
                    >
                      <Ionicons name="chevron-forward" size={32} color="#fff" />
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>

          {vehicle?.images && vehicle.images.length > 1 && (
            <View style={styles.galleryFooter}>
              <View style={styles.galleryCounter}>
                <Text style={styles.galleryCounterText}>
                  {galleryStartIndex + 1} / {vehicle.images.length}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Modal Réponse à un avis */}
      <Modal
        visible={responseModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setResponseModalVisible(false)}
        statusBarTranslucent
      >
        <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
        <View style={styles.responseModalOverlay}>
          <TouchableOpacity style={styles.responseModalOverlayTouch} activeOpacity={1} onPress={() => setResponseModalVisible(false)} />
          <View style={[styles.responseModalContainer, { paddingTop: insets.top + 16 }]}>
            <View style={styles.responseModalHeader}>
              <Text style={styles.responseModalTitle}>
                {selectedReview?.response ? 'Modifier votre réponse' : 'Répondre à l\'avis'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setResponseModalVisible(false);
                  setSelectedReview(null);
                  setResponseText('');
                  setResponseRating(0);
                  setResponseVehicleCareRating(0);
                  setResponsePunctualityRating(0);
                  setResponseCommunicationRating(0);
                  setResponseRespectRulesRating(0);
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.responseModalKV}>
              <ScrollView style={styles.responseModalScroll} contentContainerStyle={styles.responseModalScrollContent} keyboardShouldPersistTaps="handled">
                {selectedReview && (
                  <View style={styles.responseModalPreview}>
                    <Text style={styles.responseModalPreviewName}>
                      {selectedReview.reviewer ? `${selectedReview.reviewer.first_name || ''} ${selectedReview.reviewer.last_name || ''}`.trim() || 'Anonyme' : 'Anonyme'}
                    </Text>
                    {renderStars(selectedReview.rating)}
                    {selectedReview.comment ? <Text style={styles.responseModalPreviewComment}>{selectedReview.comment}</Text> : null}
                  </View>
                )}
                {isNewResponseModal && (
                  <View style={styles.responseRatingSection}>
                    <Text style={styles.responseRatingHint}>Pour que l'avis soit publié, donnez une note au locataire puis répondez.</Text>
                    <StarRatingRow value={responseRating} onChange={setResponseRating} label="Note globale *" />
                    <StarRatingRow value={responseVehicleCareRating} onChange={setResponseVehicleCareRating} label="Soin du véhicule" />
                    <StarRatingRow value={responsePunctualityRating} onChange={setResponsePunctualityRating} label="Ponctualité" />
                    <StarRatingRow value={responseCommunicationRating} onChange={setResponseCommunicationRating} label="Communication" />
                    <StarRatingRow value={responseRespectRulesRating} onChange={setResponseRespectRulesRating} label="Respect des règles" />
                  </View>
                )}
                <Text style={styles.responseModalResponseLabel}>Votre réponse</Text>
                <TextInput
                  style={styles.responseModalInput}
                  value={responseText}
                  onChangeText={setResponseText}
                  placeholder="Écrivez votre réponse..."
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </ScrollView>
            </KeyboardAvoidingView>
            <View style={styles.responseModalFooter}>
              <TouchableOpacity
                style={styles.responseModalCancelBtn}
                onPress={() => {
                  setResponseModalVisible(false);
                  setSelectedReview(null);
                  setResponseText('');
                  setResponseRating(0);
                  setResponseVehicleCareRating(0);
                  setResponsePunctualityRating(0);
                  setResponseCommunicationRating(0);
                  setResponseRespectRulesRating(0);
                }}
              >
                <Text style={styles.responseModalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.responseModalSubmitBtn, (!canSubmitResponseModal || submitting) && styles.responseModalSubmitBtnDisabled]}
                onPress={handleSubmitResponse}
                disabled={!canSubmitResponseModal || submitting}
              >
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.responseModalSubmitText}>Envoyer</Text>}
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
    justifyContent: 'space-between',
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonStyle: {
    backgroundColor: VEHICLE_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  photosContainer: {
    gap: 12,
  },
  photoCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  photosScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  photoItem: {
    width: 128,
    height: 128,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageClickIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 4,
  },
  galleryModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  galleryTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 16,
  },
  galleryCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  galleryScrollView: {
    flex: 1,
  },
  galleryScrollContent: {
    alignItems: 'center',
  },
  galleryImageWrapper: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  galleryNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  galleryNavButtonLeft: {
    left: 16,
  },
  galleryNavButtonRight: {
    right: 16,
  },
  galleryFooter: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    alignItems: 'center',
  },
  galleryCounter: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  galleryCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPhotos: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyPhotosText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionCardFull: {
    flex: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    marginHorizontal: 20,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  reviewsLoadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  reviewsLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  reviewsEmptyBox: {
    paddingVertical: 20,
  },
  reviewsEmptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reviewCardUnpublished: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  reviewStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
  },
  reviewStatusBadgePublished: {
    backgroundColor: '#d1fae5',
  },
  reviewStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#e67e22',
  },
  reviewStatusTextPublished: {
    color: '#10b981',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  reviewMeta: {
    alignItems: 'flex-end',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  reviewComment: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 10,
    lineHeight: 18,
  },
  reviewResponseBlock: {
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: VEHICLE_COLORS.primary,
  },
  reviewResponseLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: VEHICLE_COLORS.primary,
    marginBottom: 4,
  },
  reviewResponseText: {
    fontSize: 13,
    color: '#1e293b',
  },
  reviewResponseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: VEHICLE_COLORS.primary,
  },
  reviewResponseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  responseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  responseModalOverlayTouch: {
    flex: 1,
  },
  responseModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  responseModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  responseModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  responseModalKV: {
    flex: 1,
    maxHeight: 360,
  },
  responseModalScroll: {
    flex: 1,
  },
  responseModalScrollContent: {
    padding: 20,
    paddingBottom: 16,
  },
  responseModalPreview: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  responseModalPreviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  responseModalPreviewComment: {
    fontSize: 13,
    color: '#6b7280',
  },
  responseRatingSection: {
    marginBottom: 20,
  },
  responseRatingHint: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
    lineHeight: 20,
  },
  responseRatingCategory: {
    marginBottom: 14,
  },
  responseRatingCategoryLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  responseStarsRowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  responseStarTouch: {
    padding: 4,
  },
  responseModalResponseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  responseModalInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 160,
    backgroundColor: '#f8f9fa',
    color: '#333',
  },
  responseModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  responseModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  responseModalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: VEHICLE_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseModalSubmitBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  responseModalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VehicleManagementScreen;






