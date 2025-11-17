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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdminReviews } from '../hooks/useAdminReviews';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { Review } from '../hooks/useReviews';
import { useLanguage } from '../contexts/LanguageContext';

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
        <View style={styles.placeholder} />
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
});

export default AdminReviewsScreen;

