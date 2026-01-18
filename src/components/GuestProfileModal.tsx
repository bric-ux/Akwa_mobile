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
import { supabase } from '../services/supabase';
import { useGuestReviews, GuestReview } from '../hooks/useGuestReviews';

interface GuestProfile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  identity_verified?: boolean;
  created_at?: string;
  city?: string;
  country?: string;
  bio?: string;
}

interface GuestProfileModalProps {
  visible: boolean;
  onClose: () => void;
  guestId: string;
}

const GuestProfileModal: React.FC<GuestProfileModalProps> = ({
  visible,
  onClose,
  guestId,
}) => {
  const { getPublishedReviewsForGuest } = useGuestReviews();
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState<number>(0);

  useEffect(() => {
    if (visible && guestId) {
      loadGuestData();
    }
  }, [visible, guestId]);

  const loadGuestData = async () => {
    setLoading(true);
    try {
      // Load guest profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url, identity_verified, created_at, city, country, bio')
        .eq('user_id', guestId)
        .single();
      
      setProfile(profileData);

      // Load published reviews for this guest
      const reviewsData = await getPublishedReviewsForGuest(guestId);

      if (reviewsData && reviewsData.length > 0) {
        // Load property and host info
        const propertyIds = [...new Set(reviewsData.map((r: any) => r.property_id))] as string[];
        const hostIds = [...new Set(reviewsData.map((r: any) => r.host_id))] as string[];
        const reviewIds = reviewsData.map((r: any) => r.id) as string[];

        const [propertiesResult, hostsResult, responsesResult] = await Promise.all([
          supabase.from('properties').select('id, title').in('id', propertyIds),
          supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', hostIds),
          (supabase as any).from('guest_review_responses').select('*').in('guest_review_id', reviewIds)
        ]);

        const propertiesMap = new Map((propertiesResult.data || []).map(p => [p.id, p]));
        const hostsMap = new Map((hostsResult.data || []).map(h => [h.user_id, h]));
        const responsesMap = new Map((responsesResult.data || []).map((r: any) => [r.guest_review_id, r]));

        const enrichedReviews: GuestReview[] = reviewsData.map((review: any) => ({
          ...review,
          property: propertiesMap.get(review.property_id) as { title: string } | undefined,
          host: hostsMap.get(review.host_id) as { first_name: string; last_name: string } | undefined,
          response: responsesMap.get(review.id) as { response: string; created_at: string } | undefined
        }));

        setReviews(enrichedReviews);

        // Calculate average rating
        const avg = reviewsData.reduce((acc, r) => acc + r.rating, 0) / reviewsData.length;
        setAverageRating(Math.round(avg * 10) / 10);
      } else {
        setReviews([]);
        setAverageRating(0);
      }
    } catch (error) {
      console.error('Erreur chargement profil voyageur:', error);
    } finally {
      setLoading(false);
    }
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

  if (!guestId) return null;

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
              <Text style={styles.headerTitle}>Profil du voyageur</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Profile */}
              {profile && (
                <View style={styles.profileSection}>
                  <View style={styles.avatarContainer}>
                    {profile.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {profile.first_name?.[0]}{profile.last_name?.[0]}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.profileInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>
                        {profile.first_name} {profile.last_name}
                      </Text>
                      {profile.identity_verified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="shield-checkmark" size={14} color="#10b981" />
                          <Text style={styles.verifiedText}>Vérifié</Text>
                        </View>
                      )}
                    </View>
                    
                    {(profile.city || profile.country) && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={14} color="#6b7280" />
                        <Text style={styles.location}>
                          {[profile.city, profile.country].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    )}
                    
                    {profile.created_at && (
                      <View style={styles.memberRow}>
                        <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                        <Text style={styles.memberSince}>
                          Membre depuis {new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </Text>
                      </View>
                    )}

                    {profile.bio && (
                      <Text style={styles.bio}>{profile.bio}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Statistics */}
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <View style={styles.statValue}>
                    <Text style={styles.statNumber}>
                      {averageRating > 0 ? averageRating.toFixed(1) : '-'}
                    </Text>
                    <Ionicons name="star" size={20} color="#fbbf24" />
                  </View>
                  <Text style={styles.statLabel}>Note moyenne</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{reviews.length}</Text>
                  <Text style={styles.statLabel}>Avis reçus</Text>
                </View>
              </View>

              {/* Reviews */}
              <View style={styles.reviewsSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="chatbubbles-outline" size={18} color="#1e293b" />
                  <Text style={styles.sectionTitle}>
                    Avis des hôtes ({reviews.length})
                  </Text>
                </View>
                
                {reviews.length === 0 ? (
                  <View style={styles.emptyReviews}>
                    <Text style={styles.emptyReviewsText}>
                      Ce voyageur n'a pas encore reçu d'avis
                    </Text>
                  </View>
                ) : (
                  <View style={styles.reviewsList}>
                    {reviews.map((review) => (
                      <View key={review.id} style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewInfo}>
                            <Text style={styles.reviewHostName}>
                              {review.host?.first_name} {review.host?.last_name}
                            </Text>
                            <Text style={styles.reviewProperty}>
                              {review.property?.title}
                            </Text>
                          </View>
                          <View style={styles.reviewRating}>
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
                          <Text style={styles.reviewComment}>{review.comment}</Text>
                        )}
                        
                        {/* Guest response */}
                        {review.response && (
                          <View style={styles.guestResponse}>
                            <Text style={styles.guestResponseLabel}>
                              Réponse du voyageur
                            </Text>
                            <Text style={styles.guestResponseText}>
                              {review.response.response}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
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
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#eff6ff',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileSection: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#6b7280',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  memberSince: {
    fontSize: 14,
    color: '#6b7280',
  },
  bio: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 20,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  reviewsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  emptyReviews: {
    backgroundColor: '#f9fafb',
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyReviewsText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewInfo: {
    flex: 1,
  },
  reviewHostName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  reviewProperty: {
    fontSize: 12,
    color: '#6b7280',
  },
  reviewRating: {
    alignItems: 'flex-end',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
  ratingsBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  ratingBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingBadgeText: {
    fontSize: 11,
    color: '#6b7280',
  },
  reviewComment: {
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 8,
    lineHeight: 18,
  },
  guestResponse: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#2563eb',
  },
  guestResponseLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  guestResponseText: {
    fontSize: 13,
    color: '#6b7280',
  },
});

export default GuestProfileModal;

