import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useHostProfile } from '../hooks/useHostProfile';
import { useHostReviews } from '../hooks/useHostReviews';

const HostProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { hostId } = (route.params as any) || {};
  const { hostProfile, loading, error, getHostProfile } = useHostProfile();
  const { reviews, loading: reviewsLoading, getHostReviews } = useHostReviews();

  useEffect(() => {
    if (hostId) {
      getHostProfile(hostId);
      getHostReviews(hostId);
    }
  }, [hostId, getHostProfile, getHostReviews]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });
  };

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
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil de l'hôte</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Photo de profil et informations de base */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {hostProfile.avatar_url ? (
              <Image
                source={{ uri: hostProfile.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#666" />
              </View>
            )}
          </View>
          
          <Text style={styles.hostName}>
            {hostProfile.first_name} {hostProfile.last_name}
          </Text>
          
          <Text style={styles.hostTitle}>Hôte sur AkwaHome</Text>
          
          {hostProfile.created_at ? (
            <Text style={styles.memberSince}>
              Membre depuis {formatDate(hostProfile.created_at)}
            </Text>
          ) : null}
        </View>

        {/* Bio */}
        {hostProfile.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <Text style={styles.bioText}>{hostProfile.bio}</Text>
          </View>
        ) : null}

        {/* Statistiques de l'hôte */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{hostProfile.total_properties || 0}</Text>
              <Text style={styles.statLabel}>Propriétés</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{hostProfile.total_reviews || 0}</Text>
              <Text style={styles.statLabel}>Avis</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {hostProfile.average_rating ? `${hostProfile.average_rating}/5` : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Note moyenne</Text>
            </View>
          </View>
        </View>

        {/* Avis reçus */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avis reçus {reviews.length > 0 && `(${reviews.length})`}</Text>
          {reviewsLoading ? (
            <View style={styles.loadingReviewsContainer}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.loadingReviewsText}>Chargement des avis...</Text>
            </View>
          ) : reviews.length > 0 ? (
            <View style={styles.reviewsContainer}>
              {reviews.slice(0, 3).map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
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
                  <Text style={styles.propertyTitle}>Propriété: {review.property_title || 'Propriété'}</Text>
                </View>
              ))}
              {reviews.length > 3 ? (
                <Text style={styles.moreReviews}>
                  +{reviews.length - 3} autres avis...
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyReviews}>
              <Ionicons name="star-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyReviewsText}>Aucun avis pour le moment</Text>
            </View>
          )}
        </View>

        {/* Informations de contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de contact</Text>
          <View style={styles.contactInfo}>
            <View style={styles.contactItem}>
              <Ionicons name="mail-outline" size={20} color="#2E7D32" />
              <Text style={styles.contactText}>{hostProfile.email}</Text>
            </View>
            {hostProfile.phone ? (
              <View style={styles.contactItem}>
                <Ionicons name="call-outline" size={20} color="#2E7D32" />
                <Text style={styles.contactText}>{hostProfile.phone}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Message de bienvenue */}
        <View style={styles.welcomeSection}>
          <Ionicons name="home-outline" size={32} color="#2E7D32" />
          <Text style={styles.welcomeTitle}>Bienvenue chez {hostProfile.first_name} !</Text>
          <Text style={styles.welcomeMessage}>
            Votre hôte est là pour vous accueillir et vous faire passer un séjour inoubliable.
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
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
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#2E7D32',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2E7D32',
  },
  hostName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  hostTitle: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 8,
  },
  memberSince: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingVertical: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  reviewsContainer: {
    marginTop: 16,
  },
  reviewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewComment: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginTop: 8,
    fontStyle: 'italic',
  },
  propertyTitle: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
    marginTop: 8,
  },
  moreReviews: {
    fontSize: 14,
    color: '#2E7D32',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  loadingReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingReviewsText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyReviewsText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  contactInfo: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#333',
  },
  welcomeSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  welcomeMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default HostProfileScreen;
