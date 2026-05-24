import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useHostProfile } from '../hooks/useHostProfile';
import { useHostReviews } from '../hooks/useHostReviews';
import { getOwnerPublicWebUrl, shareProfileLink } from '../utils/shareListingLink';
import { handleHostProfileBack } from '../utils/profileNavigation';
import PublicHostPropertiesList from '../components/PublicHostPropertiesList';
import PublicOwnerVehiclesList, { type PublicOwnerVehicle } from '../components/PublicOwnerVehiclesList';
import ContactHostButton from '../components/ContactHostButton';
import ContactOwnerButton from '../components/ContactOwnerButton';
import { supabase } from '../services/supabase';
import { HOST_COLORS, VEHICLE_COLORS } from '../constants/colors';
import type { RootStackParamList, Property, Vehicle } from '../types';

type HostProfileRouteProp = RouteProp<RootStackParamList, 'HostProfile'>;
type HostProfileNavigationProp = StackNavigationProp<RootStackParamList, 'HostProfile'>;

const HostProfileScreen: React.FC = () => {
  const navigation = useNavigation<HostProfileNavigationProp>();
  const route = useRoute<HostProfileRouteProp>();
  const {
    hostId,
    propertyOnly,
    showListings,
    listingsTab,
    profileContext = 'host',
    returnFromInternal,
  } = route.params;
  const scrollRef = useRef<ScrollView>(null);
  const listingsSectionY = useRef(0);
  const { hostProfile, loading, error, getHostProfile } = useHostProfile();
  const { reviews, loading: reviewsLoading, getHostReviews } = useHostReviews();
  const [ownerVehicles, setOwnerVehicles] = useState<PublicOwnerVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const properties = hostProfile?.properties ?? [];
  const propertyCount = hostProfile?.total_properties ?? properties.length;
  const vehicleCount = ownerVehicles.length;
  const isVehicleContext = profileContext === 'vehicle' || listingsTab === 'vehicles';
  const listingsCount = isVehicleContext ? vehicleCount : propertyCount;
  const hasListings = listingsCount > 0;
  const hasReviews = (hostProfile?.total_reviews ?? 0) > 0;
  const hasRating = (hostProfile?.average_rating ?? 0) > 0;
  const hasAnyStat = hasListings || hasReviews || hasRating;

  const accent = isVehicleContext ? VEHICLE_COLORS : HOST_COLORS;
  const roleLabel = isVehicleContext ? 'propriétaire' : 'hôte';
  const contactTitle = isVehicleContext ? "Contacter le propriétaire" : "Contacter l'hôte";
  const screenTitle = isVehicleContext ? 'Profil du propriétaire' : "Profil de l'hôte";
  const hostDisplayName =
    `${hostProfile?.first_name || ''} ${hostProfile?.last_name || ''}`.trim() || roleLabel;

  const contactProperty = useMemo((): Property | null => {
    const p = properties[0];
    if (!p || !hostId) return null;
    return {
      id: p.id,
      title: p.title,
      host_id: hostId,
      description: null,
      price_per_night: p.price_per_night ?? 0,
      images: p.images ?? [],
      created_at: '',
      updated_at: '',
    } as Property;
  }, [properties, hostId]);

  const contactVehicle = useMemo((): Vehicle | null => {
    const v = ownerVehicles[0];
    if (!v || !hostId) return null;
    return {
      id: v.id,
      title: v.title ?? 'Véhicule',
      owner_id: hostId,
      price_per_day: v.price_per_day ?? 0,
      images: v.images ?? [],
    } as Vehicle;
  }, [ownerVehicles, hostId]);

  const handleBack = useCallback(() => {
    handleHostProfileBack(navigation, { returnFromInternal });
  }, [navigation, returnFromInternal]);

  const scrollToListings = useCallback(() => {
    if (listingsSectionY.current > 0) {
      scrollRef.current?.scrollTo({ y: listingsSectionY.current, animated: true });
    }
  }, []);

  useEffect(() => {
    if (hostId) {
      getHostProfile(hostId);
      getHostReviews(hostId, { propertyOnly: propertyOnly === true });
    }
  }, [hostId, propertyOnly, getHostProfile, getHostReviews]);

  useEffect(() => {
    if (!hostId || !isVehicleContext) {
      setOwnerVehicles([]);
      return;
    }
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
  }, [hostId, isVehicleContext]);

  useEffect(() => {
    if (showListings && !loading && hasListings) {
      const timer = setTimeout(scrollToListings, 300);
      return () => clearTimeout(timer);
    }
  }, [showListings, loading, hasListings, scrollToListings]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });
  };

  const handleShareProfile = useCallback(() => {
    if (!hostId || !hostProfile) return;
    const name = `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim() || 'Hôte';
    shareProfileLink({
      url: getOwnerPublicWebUrl(hostId, {
        type: isVehicleContext ? 'vehicle' : 'host',
        name,
      }),
      name,
      type: isVehicleContext ? 'vehicle' : 'host',
    });
  }, [hostId, hostProfile, isVehicleContext]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !hostProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.errorTitle}>Profil non disponible</Text>
          <Text style={styles.errorMessage}>
            {error || 'Impossible de charger le profil de l\'hôte'}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.hero, { backgroundColor: accent.primary }]}>
        <View style={[styles.heroGlow, { backgroundColor: accent.secondary }]} pointerEvents="none" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{screenTitle}</Text>
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleShareProfile}>
            <Ionicons name="share-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
              <View style={[styles.avatarPlaceholder, { borderColor: accent.primary, backgroundColor: accent.light }]}>
                <Text style={[styles.avatarInitials, { color: accent.primary }]}>
                  {(hostProfile.first_name?.[0] || 'A').toUpperCase()}
                  {(hostProfile.last_name?.[0] || '').toUpperCase()}
                </Text>
              </View>
            )}
            {hostProfile.identity_verified ? (
              <View style={[styles.verifiedBadge, { backgroundColor: accent.primary }]}>
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
              </View>
            ) : null}
          </View>

          <Text style={styles.hostName}>{hostDisplayName}</Text>
          <View style={[styles.rolePill, { backgroundColor: accent.light }]}>
            <Ionicons
              name={isVehicleContext ? 'car-outline' : 'home-outline'}
              size={14}
              color={accent.primary}
            />
            <Text style={[styles.rolePillText, { color: accent.primary }]}>
              {isVehicleContext ? 'Propriétaire sur AkwaHome' : 'Hôte sur AkwaHome'}
            </Text>
          </View>
          {hostProfile.created_at ? (
            <Text style={styles.memberSince}>Membre depuis {formatDate(hostProfile.created_at)}</Text>
          ) : null}
          {(hostProfile.city || hostProfile.country) ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text style={styles.locationText}>
                {[hostProfile.city, hostProfile.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
        </View>

        {hostProfile.bio ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>À propos</Text>
            <Text style={styles.bioText}>{hostProfile.bio}</Text>
          </View>
        ) : null}

        {hasAnyStat ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Statistiques</Text>
            <View style={[styles.statsContainer, { borderColor: accent.light, backgroundColor: accent.light }]}>
              {hasListings ? (
                <TouchableOpacity
                  style={[styles.statItem, styles.listingsStatItem, { borderColor: accent.primary, backgroundColor: '#fff' }]}
                  onPress={scrollToListings}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.statNumber, { color: accent.primary }]}>
                    {vehiclesLoading && isVehicleContext ? '…' : listingsCount}
                  </Text>
                  <Text style={styles.statLabel} numberOfLines={1}>{isVehicleContext ? 'Véhicules' : 'Logements'}</Text>
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
              ) : null}
              {hasReviews ? (
                <View style={styles.statItem}>
                  <Ionicons name="chatbubbles-outline" size={20} color={accent.primary} style={{ marginBottom: 4 }} />
                  <Text style={[styles.statNumber, { color: accent.primary }]}>{hostProfile.total_reviews}</Text>
                  <Text style={styles.statLabel}>Avis</Text>
                </View>
              ) : null}
              {hasRating ? (
                <View style={styles.statItem}>
                  <Ionicons name="star" size={20} color="#f59e0b" style={{ marginBottom: 4 }} />
                  <Text style={[styles.statNumber, { color: accent.primary }]}>{hostProfile.average_rating}</Text>
                  <Text style={styles.statLabel}>Note / 5</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {hasListings ? (
          <View
            style={styles.card}
            onLayout={(e) => {
              listingsSectionY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.cardTitle}>
              {isVehicleContext ? 'Véhicules disponibles' : 'Logements disponibles'}
            </Text>
            {vehiclesLoading && isVehicleContext ? (
              <ActivityIndicator size="small" color="#2E7D32" style={{ marginVertical: 16 }} />
            ) : isVehicleContext ? (
              <PublicOwnerVehiclesList
                vehicles={ownerVehicles}
                onSelect={(vehicleId) =>
                  navigation.navigate('VehicleDetails', { vehicleId })
                }
              />
            ) : (
              <PublicHostPropertiesList
                properties={properties}
                onSelect={(propertyId) =>
                  navigation.navigate('PropertyDetails', { propertyId })
                }
              />
            )}
          </View>
        ) : null}

        {reviews.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Avis reçus ({reviews.length})</Text>
            {reviewsLoading ? (
              <View style={styles.loadingReviewsContainer}>
                <ActivityIndicator size="small" color="#2E7D32" />
                <Text style={styles.loadingReviewsText}>Chargement des avis...</Text>
              </View>
            ) : (
              <View style={styles.reviewsContainer}>
                {reviews.slice(0, 3).map((review) => (
                <View key={review.id} style={[styles.reviewCard, { borderLeftColor: accent.primary }]}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={[styles.reviewerAvatar, { backgroundColor: accent.primary }]}>
                        <Text style={styles.reviewerInitial}>
                          {review.reviewer_name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>{review.reviewer_name || 'Anonyme'}</Text>
                        <Text style={styles.reviewDate}>
                          {formatDate(review.created_at)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.ratingContainer}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= review.rating ? "star" : "star-outline"}
                          size={16}
                          color="#FFD700"
                        />
                      ))}
                    </View>
                  </View>
                  {review.comment ? (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  ) : null}
                  <Text style={[styles.propertyTitle, { color: accent.primary }]}>
                    Propriété: {review.property_title || 'Propriété'}
                  </Text>
                </View>
              ))}
              {reviews.length > 3 ? (
                <Text style={styles.moreReviews}>
                  +{reviews.length - 3} autres avis...
                </Text>
              ) : null}
              </View>
            )}
          </View>
        ) : null}

        <View style={[styles.card, styles.contactCard, { borderColor: accent.light }]}>
          <Text style={styles.cardTitle}>{contactTitle}</Text>
          <Text style={styles.contactHint}>
            Une question avant de réserver ? Envoyez un message à {hostProfile.first_name || roleLabel}.
          </Text>

          {isVehicleContext && contactVehicle ? (
            <ContactOwnerButton
              vehicle={contactVehicle}
              variant="primary"
              size="large"
              style={styles.contactCta}
              openInStack
            />
          ) : null}
          {!isVehicleContext && contactProperty ? (
            <ContactHostButton
              property={contactProperty}
              variant="primary"
              size="large"
              style={styles.contactCta}
              openInStack
            />
          ) : null}

          <View style={styles.contactActions}>
            {hostProfile.email ? (
              <TouchableOpacity
                style={styles.contactActionBtn}
                onPress={() => Linking.openURL(`mailto:${hostProfile.email}`)}
              >
                <Ionicons name="mail-outline" size={18} color={accent.primary} />
                <Text style={styles.contactActionText}>E-mail</Text>
              </TouchableOpacity>
            ) : null}
            {hostProfile.phone ? (
              <TouchableOpacity
                style={styles.contactActionBtn}
                onPress={() => Linking.openURL(`tel:${hostProfile.phone}`)}
              >
                <Ionicons name="call-outline" size={18} color={accent.primary} />
                <Text style={styles.contactActionText}>Téléphone</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={[styles.welcomeSection, { backgroundColor: accent.light }]}>
          <Ionicons name={isVehicleContext ? 'car-outline' : 'home-outline'} size={28} color={accent.primary} />
          <Text style={styles.welcomeTitle}>
            {isVehicleContext
              ? `Location avec ${hostProfile.first_name || 'ce propriétaire'}`
              : `Bienvenue chez ${hostProfile.first_name || 'votre hôte'} !`}
          </Text>
          <Text style={styles.welcomeMessage}>
            {isVehicleContext
              ? 'Un propriétaire réactif pour vous accompagner tout au long de votre location.'
              : 'Votre hôte est là pour vous accueillir et vous faire passer un séjour inoubliable.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748b',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: HOST_COLORS.primary,
  },
  hero: {
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.35,
    top: -40,
    left: -30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
    marginTop: -20,
  },
  scrollContent: {
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
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
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  hostName: {
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
  memberSince: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  locationText: {
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
  bioText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
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
  reviewsContainer: {
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
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
    flex: 1,
  },
  reviewerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewerInitial: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  reviewDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewComment: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginTop: 6,
    fontStyle: 'italic',
  },
  propertyTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  moreReviews: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
  },
  loadingReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingReviewsText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
  },
  contactCard: {
    borderWidth: 1,
  },
  contactHint: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 14,
  },
  contactCta: {
    marginBottom: 12,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 10,
  },
  contactActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contactActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  welcomeSection: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginBottom: 8,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center',
  },
  welcomeMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
  },
});

export default HostProfileScreen;
