import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { useVehicleRenterReviews, VehicleRenterReview } from '../hooks/useVehicleRenterReviews';
import { useGuestReviews, GuestReview } from '../hooks/useGuestReviews';
import { VEHICLE_COLORS } from '../constants/colors';
import VehicleRenterReviewResponseModal from '../components/VehicleRenterReviewResponseModal';
import GuestReviewResponseModal from '../components/GuestReviewResponseModal';

type TabType = 'property' | 'vehicle';

const MyVehicleRenterReviewsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getReviewsAboutMe } = useVehicleRenterReviews();
  const { getReviewsForGuest } = useGuestReviews();
  const getReviewsRef = useRef(getReviewsAboutMe);
  const getGuestReviewsRef = useRef(getReviewsForGuest);
  getReviewsRef.current = getReviewsAboutMe;
  getGuestReviewsRef.current = getReviewsForGuest;

  const [activeTab, setActiveTab] = useState<TabType>('property');
  const [guestReviews, setGuestReviews] = useState<GuestReview[]>([]);
  const [vehicleReviews, setVehicleReviews] = useState<VehicleRenterReview[]>([]);
  const [hostNamesMap, setHostNamesMap] = useState<Record<string, string>>({});
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicleResponseModalVisible, setVehicleResponseModalVisible] = useState(false);
  const [guestResponseModalVisible, setGuestResponseModalVisible] = useState(false);
  const [selectedVehicleReview, setSelectedVehicleReview] = useState<VehicleRenterReview | null>(null);
  const [selectedGuestReview, setSelectedGuestReview] = useState<GuestReview | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      const [guestData, vehicleData] = await Promise.all([
        user ? getGuestReviewsRef.current(user.id, true) : Promise.resolve([]),
        getReviewsRef.current(),
      ]);
      setGuestReviews(guestData ?? []);
      setVehicleReviews(vehicleData ?? []);

      if (guestData?.length) {
        const hostIds = [...new Set((guestData as any[]).map((r: any) => r.host_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', hostIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p: any) => {
          map[p.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Hôte';
        });
        setHostNamesMap(map);
      }
    } catch (e) {
      setGuestReviews([]);
      setVehicleReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [loadReviews])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReviews();
    setRefreshing(false);
  };

  const renderStars = (rating: number) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={18}
          color={star <= rating ? '#fbbf24' : '#d1d5db'}
        />
      ))}
    </View>
  );

  const currentList = activeTab === 'property' ? guestReviews : vehicleReviews;
  const isEmpty = currentList.length === 0;
  const emptyMessageProperty = "Les avis laissés par les hôtes après vos séjours en résidence meublée apparaîtront ici.";
  const emptyMessageVehicle = "Les avis laissés par les propriétaires après vos locations véhicule apparaîtront ici.";

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avis reçus</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'property' && styles.tabActive]}
          onPress={() => setActiveTab('property')}
        >
          <Ionicons name="home-outline" size={18} color={activeTab === 'property' ? '#2E7D32' : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'property' && styles.tabTextActive]}>
            Résidence meublée ({guestReviews.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicle' && styles.tabActiveVehicle]}
          onPress={() => setActiveTab('vehicle')}
        >
          <Ionicons name="car-outline" size={18} color={activeTab === 'vehicle' ? VEHICLE_COLORS.primary : '#6b7280'} />
          <Text style={[styles.tabText, activeTab === 'vehicle' && styles.tabTextActiveVehicle]}>
            Véhicules ({vehicleReviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={22} color={activeTab === 'vehicle' ? VEHICLE_COLORS.primary : '#2E7D32'} />
          <Text style={styles.infoText}>
            {activeTab === 'property'
              ? "Les hôtes peuvent vous laisser un avis après votre séjour. Vous pouvez y répondre ici. L'avis sera publié une fois que vous aurez répondu ou après 48 h."
              : "Les propriétaires peuvent vous laisser un avis après une location. Vous pouvez y répondre ici. L'avis sera publié une fois que vous aurez répondu ou après 48 h."}
          </Text>
        </View>

        {loadingReviews && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={activeTab === 'vehicle' ? VEHICLE_COLORS.primary : '#2E7D32'} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : isEmpty ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Aucun avis reçu</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'property' ? emptyMessageProperty : emptyMessageVehicle}
            </Text>
          </View>
        ) : activeTab === 'property' ? (
          <View style={styles.reviewsList}>
            {guestReviews.map((review) => {
              const hostName = hostNamesMap[(review as any).host_id] || 'Hôte';
              const propertyTitle = (review.property as any)?.title || 'Réservation';
              return (
                <View
                  key={review.id}
                  style={[styles.reviewCard, !review.response && styles.reviewCardPending]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.ownerName}>{hostName}</Text>
                      <Text style={styles.vehicleTitle}>{propertyTitle}</Text>
                    </View>
                    <View style={styles.ratingBlock}>
                      {renderStars(review.rating)}
                      <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
                  {review.response ? (
                    <View style={styles.responseSection}>
                      <Text style={styles.responseLabel}>Mon avis</Text>
                      {review.response.rating != null && review.response.rating >= 1 ? (
                        <View style={styles.responseRatingRow}>{renderStars(review.response.rating)}</View>
                      ) : null}
                      <Text style={styles.responseText}>{review.response.response}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.responseButton, { backgroundColor: '#f0fdf4' }]}
                    onPress={() => {
                      setSelectedGuestReview(review);
                      setGuestResponseModalVisible(true);
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#2E7D32" />
                    <Text style={[styles.responseButtonText, { color: '#2E7D32' }]}>
                      {review.response ? 'Voir mon avis' : 'Répondre à cet avis'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {vehicleReviews.map((review) => {
              const ownerName = review.owner
                ? `${review.owner.first_name || ''} ${review.owner.last_name || ''}`.trim() || 'Propriétaire'
                : 'Propriétaire';
              const vehicleTitle = review.vehicle?.title || 'Véhicule';
              return (
                <View
                  key={review.id}
                  style={[styles.reviewCard, !review.response && styles.reviewCardPending]}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.ownerName}>{ownerName}</Text>
                      <Text style={styles.vehicleTitle}>{vehicleTitle}</Text>
                    </View>
                    <View style={styles.ratingBlock}>
                      {renderStars(review.rating)}
                      <Text style={styles.reviewDate}>
                        {new Date(review.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
                  {review.response ? (
                    <View style={styles.responseSection}>
                      <Text style={styles.responseLabel}>Mon avis</Text>
                      {review.response.rating != null && review.response.rating >= 1 ? (
                        <View style={styles.responseRatingRow}>{renderStars(review.response.rating)}</View>
                      ) : null}
                      <Text style={styles.responseText}>{review.response.response}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.responseButton}
                    onPress={() => {
                      setSelectedVehicleReview(review);
                      setVehicleResponseModalVisible(true);
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={VEHICLE_COLORS.primary} />
                    <Text style={[styles.responseButtonText, { color: VEHICLE_COLORS.primary }]}>
                      {review.response ? 'Voir mon avis' : 'Répondre à cet avis'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <VehicleRenterReviewResponseModal
        visible={vehicleResponseModalVisible}
        onClose={() => {
          setVehicleResponseModalVisible(false);
          setSelectedVehicleReview(null);
        }}
        review={selectedVehicleReview}
        onResponseSubmitted={loadReviews}
      />
      <GuestReviewResponseModal
        visible={guestResponseModalVisible}
        onClose={() => {
          setGuestResponseModalVisible(false);
          setSelectedGuestReview(null);
        }}
        review={selectedGuestReview}
        onResponseSubmitted={loadReviews}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#f0fdf4',
  },
  tabActiveVehicle: {
    backgroundColor: '#ccfbf1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  tabTextActiveVehicle: {
    color: VEHICLE_COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
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
    padding: 16,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewCardPending: {
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reviewInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  vehicleTitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  ratingBlock: {
    alignItems: 'flex-end',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  comment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  responseSection: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 6,
  },
  responseRatingRow: {
    marginBottom: 6,
  },
  responseText: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 20,
  },
  responseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
  },
  responseButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MyVehicleRenterReviewsScreen;
