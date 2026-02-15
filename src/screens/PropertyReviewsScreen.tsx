import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { useReviewResponses } from '../hooks/useReviewResponses';
import ReviewResponseModal from '../components/ReviewResponseModal';

type PropertyReviewsRouteProp = RouteProp<RootStackParamList, 'PropertyReviews'>;

interface PropertyReview {
  id: string;
  booking_id: string;
  property_id: string;
  reviewer_id: string;
  rating: number;
  cleanliness_rating: number | null;
  communication_rating: number | null;
  location_rating: number | null;
  value_rating: number | null;
  comment: string | null;
  approved: boolean | null;
  created_at: string;
  response_deadline: string | null;
  reviewer?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  response?: {
    id: string;
    response: string;
    created_at: string;
  } | null;
  has_response?: boolean;
  is_deadline_passed?: boolean;
}

const PropertyReviewsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PropertyReviewsRouteProp>();
  const { propertyId } = route.params;
  const { getReviewResponse } = useReviewResponses();
  
  const [reviews, setReviews] = useState<PropertyReview[]>([]);
  const [property, setProperty] = useState<{ title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'responded' | 'expired'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PropertyReview | null>(null);
  const [existingResponse, setExistingResponse] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [propertyId]);

  const loadData = async () => {
    if (!propertyId) return;
    
    setLoading(true);
    try {
      // Load property info
      const { data: propData } = await supabase
        .from('properties')
        .select('title')
        .eq('id', propertyId)
        .single();
      
      setProperty(propData);

      // Load reviews for this property
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles!reviewer_id(first_name, last_name, avatar_url)
        `)
        .eq('property_id', propertyId)
        .eq('approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get responses for these reviews
      const reviewIds = (reviewsData || []).map((r: any) => r.id);
      const { data: responses } = await supabase
        .from('review_responses')
        .select('*')
        .in('review_id', reviewIds);

      const now = new Date();

      const formattedReviews = (reviewsData || []).map((review: any) => {
        const response = (responses || []).find((r: any) => r.review_id === review.id);
        const deadline = review.response_deadline ? new Date(review.response_deadline) : null;
        
        return {
          ...review,
          reviewer: review.profiles,
          response,
          has_response: !!response,
          is_deadline_passed: deadline ? deadline < now : false
        };
      });

      setReviews(formattedReviews);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenResponseModal = async (review: PropertyReview) => {
    setSelectedReview(review);
    if (review.response) {
      setExistingResponse(review.response.response);
    } else {
      const response = await getReviewResponse(review.id);
      setExistingResponse(response?.response || null);
    }
    setResponseModalVisible(true);
  };

  const handleResponseSubmitted = () => {
    loadData();
  };

  const getTimeRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours <= 0) return null;
    if (hours < 24) return `${hours}h restantes`;
    return `${Math.floor(hours / 24)}j ${hours % 24}h restantes`;
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const pendingReviews = reviews.filter(r => !r.has_response && !r.is_deadline_passed);
  const respondedReviews = reviews.filter(r => r.has_response);
  const expiredReviews = reviews.filter(r => !r.has_response && r.is_deadline_passed);

  const currentReviews = activeTab === 'pending' ? pendingReviews 
    : activeTab === 'responded' ? respondedReviews 
    : expiredReviews;

  const ReviewCard = ({ review, showDeadline = false }: { review: PropertyReview; showDeadline?: boolean }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {review.reviewer?.first_name?.[0] || 'A'}
            </Text>
          </View>
          <View style={styles.reviewerDetails}>
            <Text style={styles.reviewerName}>
              {review.reviewer?.first_name || 'Anonyme'} {review.reviewer?.last_name || ''}
            </Text>
          </View>
        </View>
        <View style={styles.ratingContainer}>
          {renderStars(review.rating)}
          {showDeadline && review.response_deadline && !review.has_response && (
            <View style={[
              styles.deadlineBadge,
              (() => {
                const deadlineDate = new Date(review.response_deadline);
                const now = new Date();
                const diffMs = deadlineDate.getTime() - now.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                return hours < 12;
              })() && styles.deadlineBadgeUrgent
            ]}>
              <Ionicons name="time-outline" size={12} color="#fff" />
              <Text style={styles.deadlineText}>
                {getTimeRemaining(review.response_deadline)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {review.comment && (
        <Text style={styles.comment}>{review.comment}</Text>
      )}

      <Text style={styles.date}>
        {formatDate(review.created_at)}
      </Text>

      {/* Response section */}
      {review.response && (
        <View style={styles.responseSection}>
          <View style={styles.responseHeader}>
            <Ionicons name="chatbubble-outline" size={16} color="#2E7D32" />
            <Text style={styles.responseLabel}>Votre réponse</Text>
          </View>
          <Text style={styles.responseText}>{review.response.response}</Text>
          <Text style={styles.responseDate}>
            {formatDate(review.response.created_at)}
          </Text>
        </View>
      )}

      {/* Response action */}
      {!review.has_response && !review.is_deadline_passed && (
        <TouchableOpacity
          style={styles.responseButton}
          onPress={() => handleOpenResponseModal(review)}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#2E7D32" />
          <Text style={styles.responseButtonText}>Répondre</Text>
        </TouchableOpacity>
      )}

      {review.is_deadline_passed && !review.has_response && (
        <View style={styles.expiredSection}>
          <Ionicons name="alert-circle-outline" size={16} color="#e74c3c" />
          <Text style={styles.expiredText}>
            Délai de réponse expiré (48h)
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Avis reçus</Text>
          {property && (
            <Text style={styles.headerSubtitle}>{property.title}</Text>
          )}
        </View>
      </View>

      {/* Alert for pending reviews */}
      {pendingReviews.length > 0 && (
        <View style={styles.alertCard}>
          <Ionicons name="time-outline" size={20} color="#e67e22" />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              {pendingReviews.length} avis en attente de réponse
            </Text>
            <Text style={styles.alertText}>
              Vous avez 48h pour répondre à chaque avis après son approbation.
            </Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            En attente
          </Text>
          {pendingReviews.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingReviews.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'responded' && styles.tabActive]}
          onPress={() => setActiveTab('responded')}
        >
          <Text style={[styles.tabText, activeTab === 'responded' && styles.tabTextActive]}>
            Répondus
          </Text>
          {respondedReviews.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{respondedReviews.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expired' && styles.tabActive]}
          onPress={() => setActiveTab('expired')}
        >
          <Text style={[styles.tabText, activeTab === 'expired' && styles.tabTextActive]}>
            Expirés
          </Text>
          {expiredReviews.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{expiredReviews.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Aucun avis pour cette propriété</Text>
            <Text style={styles.emptyText}>
              Les avis de vos voyageurs apparaîtront ici.
            </Text>
          </View>
        ) : currentReviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={activeTab === 'pending' ? 'checkmark-circle' : 'chatbubbles-outline'} 
              size={64} 
              color="#d1d5db" 
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'pending' ? 'Aucun avis en attente' 
                : activeTab === 'responded' ? 'Aucun avis répondu'
                : 'Aucun avis expiré'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'pending' ? 'Vous avez répondu à tous les avis.'
                : activeTab === 'responded' ? 'Vos réponses aux avis apparaîtront ici.'
                : 'Vous avez répondu à temps à tous les avis.'}
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {currentReviews.map(review => (
              <ReviewCard 
                key={review.id} 
                review={review} 
                showDeadline={activeTab === 'pending'} 
              />
            ))}
          </View>
        )}
      </ScrollView>

      <ReviewResponseModal
        visible={responseModalVisible}
        onClose={() => {
          setResponseModalVisible(false);
          setSelectedReview(null);
          setExistingResponse(null);
        }}
        reviewId={selectedReview?.id || ''}
        existingResponse={existingResponse}
        onResponseSubmitted={handleResponseSubmitted}
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
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    margin: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e67e22',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#e67e22',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#f0fdf4',
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
  tabBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
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
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  deadlineBadgeUrgent: {
    backgroundColor: '#ef4444',
  },
  deadlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  comment: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
  responseSection: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },
  responseText: {
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 8,
  },
  responseDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  responseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#2E7D32',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  responseButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  expiredSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  expiredText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e74c3c',
  },
});

export default PropertyReviewsScreen;























