import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useHostProfile } from '../hooks/useHostProfile';
import { useHostReviews } from '../hooks/useHostReviews';
import PublicHostPropertiesList from './PublicHostPropertiesList';
import PublicOwnerVehiclesList, { type PublicOwnerVehicle } from './PublicOwnerVehiclesList';

interface HostProfileModalProps {
  visible: boolean;
  onClose: () => void;
  hostId: string;
  /** Contexte d'affichage : en "vehicle" (ex. depuis une fiche véhicule) on n'affiche que les avis véhicule. */
  reviewsContext?: 'vehicle' | 'all';
}

const HostProfileModal: React.FC<HostProfileModalProps> = ({
  visible,
  onClose,
  hostId,
  reviewsContext = 'all',
}) => {
  const navigation = useNavigation<any>();
  const { hostProfile, loading, getHostProfile } = useHostProfile();
  const { reviews, loading: reviewsLoading, getHostReviews } = useHostReviews();
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [ownerVehicles, setOwnerVehicles] = useState<PublicOwnerVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  const MAX_REVIEWS_PREVIEW = 3;

  // En contexte "location véhicule", n'afficher que les avis véhicule (pas résidence meublée)
  const displayReviews =
    reviewsContext === 'vehicle'
      ? reviews.filter((r) => r.review_type === 'vehicle')
      : reviews;

  useEffect(() => {
    if (visible && hostId) {
      getHostProfile(hostId);
      getHostReviews(hostId);
      setShowAllReviews(false);
      setShowListings(false);

      if (reviewsContext === 'vehicle') {
        setVehiclesLoading(true);
        supabase
          .from('vehicles')
          .select('id, title, brand, model, price_per_day, images')
          .eq('owner_id', hostId)
          .eq('is_active', true)
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            setOwnerVehicles((data as PublicOwnerVehicle[]) || []);
          })
          .finally(() => setVehiclesLoading(false));
      } else {
        setOwnerVehicles([]);
      }
    }
  }, [visible, hostId, reviewsContext, getHostProfile, getHostReviews]);

  const totalReviewsCount = displayReviews.length;
  const combinedAverageRating =
    totalReviewsCount > 0
      ? Number(
          (
            displayReviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
            totalReviewsCount
          ).toFixed(1),
        )
      : 0;

  const hostProperties = hostProfile?.properties ?? [];
  const listingsCount =
    reviewsContext === 'vehicle' ? ownerVehicles.length : hostProperties.length;
  const listingsLabel =
    reviewsContext === 'vehicle'
      ? `Véhicule${listingsCount !== 1 ? 's' : ''}`
      : `Logement${listingsCount !== 1 ? 's' : ''}`;

  const openProperty = (propertyId: string) => {
    onClose();
    navigation.navigate('PropertyDetails', { propertyId });
  };

  const openVehicle = (vehicleId: string) => {
    onClose();
    navigation.navigate('VehicleDetails', { vehicleId });
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={14}
            color={star <= rating ? '#fbbf24' : '#d1d5db'}
          />
        ))}
      </View>
    );
  };

  if (!hostId) return null;

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
              <Ionicons name="person-outline" size={20} color="#2563eb" />
              <Text style={styles.headerTitle}>Profil du propriétaire</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Chargement du profil...</Text>
            </View>
          ) : hostProfile ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Photo et informations de base */}
              <View style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                  {hostProfile.avatar_url ? (
                    <Image
                      source={{ uri: hostProfile.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {hostProfile.first_name?.charAt(0) || 'P'}
                        {hostProfile.last_name?.charAt(0) || ''}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.name}>
                  {hostProfile.first_name || ''} {hostProfile.last_name || ''}
                </Text>
                {hostProfile.city && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.location}>
                      {hostProfile.city}
                      {hostProfile.country ? `, ${hostProfile.country}` : ''}
                    </Text>
                  </View>
                )}
                {hostProfile.identity_verified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={styles.verifiedText}>Propriétaire vérifié</Text>
                  </View>
                )}
              </View>

              {/* Statistiques */}
              <View style={styles.statsContainer}>
                <TouchableOpacity
                  style={styles.statItem}
                  disabled={listingsCount === 0 || vehiclesLoading}
                  onPress={() => setShowListings((v) => !v)}
                  activeOpacity={listingsCount > 0 ? 0.7 : 1}
                >
                  <Text style={styles.statValue}>
                    {vehiclesLoading ? '…' : listingsCount}
                  </Text>
                  <Text style={styles.statLabel}>{listingsLabel}</Text>
                  {listingsCount > 0 && (
                    <Text style={styles.statHint}>
                      {showListings ? 'Masquer' : 'Voir la liste'}
                    </Text>
                  )}
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {combinedAverageRating.toFixed(1)}
                  </Text>
                  <Text style={styles.statLabel}>Note moyenne</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {totalReviewsCount}
                  </Text>
                  <Text style={styles.statLabel}>Avis</Text>
                </View>
              </View>

              {showListings && listingsCount > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {reviewsContext === 'vehicle'
                      ? `Véhicules (${ownerVehicles.length})`
                      : `Logements (${hostProperties.length})`}
                  </Text>
                  {reviewsContext === 'vehicle' ? (
                    <PublicOwnerVehiclesList
                      vehicles={ownerVehicles}
                      onSelect={openVehicle}
                    />
                  ) : (
                    <PublicHostPropertiesList
                      properties={hostProperties}
                      onSelect={openProperty}
                    />
                  )}
                </View>
              )}

              {/* Bio */}
              {hostProfile.bio && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>À propos</Text>
                  <Text style={styles.bioText}>{hostProfile.bio}</Text>
                </View>
              )}

              {/* Avis */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    Avis des locataires {displayReviews.length > 0 && `(${displayReviews.length})`}
                  </Text>
                </View>
                {reviewsLoading ? (
                  <View style={styles.loadingReviewsContainer}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.loadingReviewsText}>Chargement des avis...</Text>
                  </View>
                ) : displayReviews.length > 0 ? (
                  <>
                    {(showAllReviews ? displayReviews : displayReviews.slice(0, MAX_REVIEWS_PREVIEW)).map((review) => (
                      <View key={review.id} style={styles.reviewItem}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewerInfo}>
                            <View style={styles.reviewerAvatar}>
                              <Text style={styles.reviewerInitial}>
                                {review.reviewer_name?.charAt(0) || 'U'}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.reviewerName}>
                                {review.reviewer_name || 'Locataire anonyme'}
                              </Text>
                              <Text style={styles.reviewDate}>
                                {new Date(review.created_at).toLocaleDateString('fr-FR', {
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </Text>
                            </View>
                          </View>
                          {renderStars(review.rating)}
                        </View>
                        {review.comment && (
                          <Text style={styles.reviewComment}>{review.comment}</Text>
                        )}
                        {review.review_type === 'property' && review.property_title && (
                          <View style={styles.reviewTypeBadge}>
                            <Ionicons name="home-outline" size={12} color="#2563eb" />
                            <Text style={styles.reviewTypeText}>
                              Résidence meublée: {review.property_title}
                            </Text>
                          </View>
                        )}
                        {review.review_type === 'vehicle' && review.vehicle_title && (
                          <View style={styles.reviewTypeBadge}>
                            <Ionicons name="car-outline" size={12} color="#059669" />
                            <Text style={styles.reviewTypeText}>
                              Véhicule: {review.vehicle_title}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                    {displayReviews.length > MAX_REVIEWS_PREVIEW && (
                      <TouchableOpacity
                        style={styles.showAllButton}
                        onPress={() => setShowAllReviews(!showAllReviews)}
                      >
                        <Text style={styles.showAllButtonText}>
                          {showAllReviews 
                            ? 'Voir moins d\'avis' 
                            : `Voir tous les avis (${displayReviews.length - MAX_REVIEWS_PREVIEW} de plus)`}
                        </Text>
                        <Ionicons 
                          name={showAllReviews ? 'chevron-up' : 'chevron-down'} 
                          size={20} 
                          color="#2563eb" 
                        />
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyReviews}>
                    <Ionicons name="star-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyReviewsText}>
                      Aucun avis pour le moment
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
              <Text style={styles.errorText}>Impossible de charger le profil</Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  location: {
    fontSize: 14,
    color: '#6b7280',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    paddingVertical: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statHint: {
    fontSize: 10,
    color: '#2563eb',
    marginTop: 4,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  bioText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  reviewItem: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginTop: 8,
  },
  reviewProperty: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  reviewTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  reviewTypeText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyReviewsText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  loadingReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingReviewsText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  showAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#ef4444',
  },
});

export default HostProfileModal;

