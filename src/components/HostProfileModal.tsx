import React, { useState, useEffect, useCallback } from 'react';
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
import type { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../services/supabase';
import { useHostProfile } from '../hooks/useHostProfile';
import { useHostReviews } from '../hooks/useHostReviews';
import type { PublicOwnerVehicle } from './PublicOwnerVehiclesList';
import { getOwnerPublicWebUrl, shareProfileLink } from '../utils/shareListingLink';
import { buildHostProfileInternalParams } from '../utils/profileNavigation';
import { HOST_COLORS, VEHICLE_COLORS } from '../constants/colors';
import type { RootStackParamList } from '../types';

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { hostProfile, loading, getHostProfile } = useHostProfile();
  const { reviews, loading: reviewsLoading, getHostReviews } = useHostReviews();
  const [showAllReviews, setShowAllReviews] = useState(false);
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
    reviewsContext === 'vehicle' ? ownerVehicles.length : (hostProfile?.total_properties ?? hostProperties.length);
  const listingsLabel =
    reviewsContext === 'vehicle'
      ? `Véhicule${listingsCount !== 1 ? 's' : ''}`
      : `Logement${listingsCount !== 1 ? 's' : ''}`;
  const hasListings = listingsCount > 0;
  const hasRating = combinedAverageRating > 0;
  const hasReviews = totalReviewsCount > 0;

  const accent = reviewsContext === 'vehicle' ? VEHICLE_COLORS : HOST_COLORS;
  const screenTitle = reviewsContext === 'vehicle' ? 'Profil du propriétaire' : 'Profil de l\'hôte';

  const handleShareProfile = useCallback(() => {
    if (!hostId || !hostProfile) return;
    const name = `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim() || 'Propriétaire';
    shareProfileLink({
      url: getOwnerPublicWebUrl(hostId, {
        type: reviewsContext === 'vehicle' ? 'vehicle' : 'host',
        name,
      }),
      name,
      type: reviewsContext === 'vehicle' ? 'vehicle' : 'host',
    });
  }, [hostId, hostProfile, reviewsContext]);

  const handleOpenListings = useCallback(() => {
    if (!hostId) return;
    const isVehicle = reviewsContext === 'vehicle';
    onClose();
    navigation.navigate(
      'HostProfile',
      buildHostProfileInternalParams({
        hostId,
        showListings: true,
        listingsTab: isVehicle ? 'vehicles' : 'properties',
        profileContext: isVehicle ? 'vehicle' : 'host',
        propertyOnly: !isVehicle,
      }),
    );
  }, [hostId, reviewsContext, onClose, navigation]);

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
        <SafeAreaView style={styles.modalContainer} edges={['bottom']}>
          <View style={[styles.hero, { backgroundColor: accent.primary }]}>
            <View
              style={[styles.heroGlow, { backgroundColor: accent.secondary }]}
              pointerEvents="none"
            />
            <View style={styles.header}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {screenTitle}
              </Text>
              <View style={styles.headerActions}>
                {hostProfile ? (
                  <TouchableOpacity
                    onPress={handleShareProfile}
                    style={styles.headerIconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="share-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.headerIconSpacer} />
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.headerIconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={accent.primary} />
              <Text style={styles.loadingText}>Chargement du profil...</Text>
            </View>
          ) : hostProfile ? (
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.profileCard}>
                <View style={styles.avatarContainer}>
                  {hostProfile.avatar_url ? (
                    <Image
                      source={{ uri: hostProfile.avatar_url }}
                      style={[styles.avatar, { borderColor: accent.primary }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { borderColor: accent.primary, backgroundColor: accent.light },
                      ]}
                    >
                      <Text style={[styles.avatarText, { color: accent.primary }]}>
                        {(hostProfile.first_name?.[0] || 'P').toUpperCase()}
                        {(hostProfile.last_name?.[0] || '').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {hostProfile.identity_verified ? (
                    <View style={[styles.verifiedIconBadge, { backgroundColor: accent.primary }]}>
                      <Ionicons name="shield-checkmark" size={12} color="#fff" />
                    </View>
                  ) : null}
                </View>

                <Text style={styles.name}>
                  {hostProfile.first_name || ''} {hostProfile.last_name || ''}
                </Text>

                <View style={[styles.rolePill, { backgroundColor: accent.light }]}>
                  <Ionicons
                    name={reviewsContext === 'vehicle' ? 'car-outline' : 'home-outline'}
                    size={14}
                    color={accent.primary}
                  />
                  <Text style={[styles.rolePillText, { color: accent.primary }]}>
                    {reviewsContext === 'vehicle' ? 'Propriétaire sur AkwaHome' : 'Hôte sur AkwaHome'}
                  </Text>
                </View>

                {(hostProfile.city || hostProfile.country) ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color="#64748b" />
                    <Text style={styles.location}>
                      {[hostProfile.city, hostProfile.country].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                ) : null}
              </View>

              {(hasListings || hasRating || hasReviews) ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Statistiques</Text>
                <View style={[styles.statsContainer, { borderColor: accent.light, backgroundColor: accent.light }]}>
                {hasListings && (
                  <TouchableOpacity
                    style={[
                      styles.statItem,
                      styles.listingsStatItem,
                      { borderColor: accent.primary, backgroundColor: '#fff' },
                    ]}
                    disabled={vehiclesLoading}
                    onPress={handleOpenListings}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.statValue, { color: accent.primary }]}>
                      {vehiclesLoading ? '…' : listingsCount}
                    </Text>
                    <Text style={styles.statLabel} numberOfLines={1}>{listingsLabel}</Text>
                    <View style={[styles.listingsCta, { borderColor: accent.primary }]}>
                      <Text
                        style={[styles.listingsCtaText, { color: accent.primary }]}
                        numberOfLines={1}
                      >
                        Voir la liste
                      </Text>
                      <Ionicons name="chevron-forward" size={10} color={accent.primary} />
                    </View>
                  </TouchableOpacity>
                )}
                {hasRating && (
                    <View style={styles.statItem}>
                      <Ionicons name="star" size={18} color="#f59e0b" style={{ marginBottom: 4 }} />
                      <Text style={[styles.statValue, { color: accent.primary }]}>{combinedAverageRating.toFixed(1)}</Text>
                      <Text style={styles.statLabel} numberOfLines={1}>Note / 5</Text>
                    </View>
                )}
                {hasReviews && (
                    <View style={styles.statItem}>
                      <Ionicons name="chatbubbles-outline" size={18} color={accent.primary} style={{ marginBottom: 4 }} />
                      <Text style={[styles.statValue, { color: accent.primary }]}>{totalReviewsCount}</Text>
                      <Text style={styles.statLabel} numberOfLines={1}>Avis</Text>
                    </View>
                )}
                </View>
              </View>
              ) : null}

              {hostProfile.bio ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>À propos</Text>
                  <Text style={styles.bioText}>{hostProfile.bio}</Text>
                </View>
              ) : null}

              {displayReviews.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Avis des locataires ({displayReviews.length})
                </Text>
                {reviewsLoading ? (
                  <View style={styles.loadingReviewsContainer}>
                    <ActivityIndicator size="small" color={accent.primary} />
                    <Text style={styles.loadingReviewsText}>Chargement des avis...</Text>
                  </View>
                ) : (
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
                          <View style={[styles.reviewTypeBadge, { backgroundColor: accent.light }]}>
                            <Ionicons name="home-outline" size={12} color={accent.primary} />
                            <Text style={[styles.reviewTypeText, { color: accent.primary }]}>
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
                        style={[styles.showAllButton, { borderColor: accent.primary, backgroundColor: accent.light }]}
                        onPress={() => setShowAllReviews(!showAllReviews)}
                      >
                        <Text style={[styles.showAllButtonText, { color: accent.primary }]}>
                          {showAllReviews 
                            ? 'Voir moins d\'avis' 
                            : `Voir tous les avis (${displayReviews.length - MAX_REVIEWS_PREVIEW} de plus)`}
                        </Text>
                        <Ionicons
                          name={showAllReviews ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={accent.primary}
                        />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
              ) : null}
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
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 48,
    overflow: 'hidden',
  },
  hero: {
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.3,
    top: -50,
    left: -30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconSpacer: {
    width: 40,
    height: 40,
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
    color: '#64748b',
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 12,
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
  },
  verifiedIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 6,
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  location: {
    fontSize: 13,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  listingsStatItem: {
    marginHorizontal: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 2,
  },
  listingsCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  listingsCtaText: {
    fontSize: 9,
    fontWeight: '700',
    flexShrink: 1,
  },
  bioText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
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

