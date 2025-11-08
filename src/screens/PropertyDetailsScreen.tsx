import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useProperties } from '../hooks/useProperties';
import { useAuth } from '../services/AuthContext';
import { useFavorites } from '../hooks/useFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { useHostProfile } from '../hooks/useHostProfile';
import { Property } from '../types';
import PropertyImageCarousel from '../components/PropertyImageCarousel';
import BookingModal from '../components/BookingModal';
import ContactHostButton from '../components/ContactHostButton';
import PhotoCategoryDisplay from '../components/PhotoCategoryDisplay';
import PropertyMap from '../components/PropertyMap';
import { supabase } from '../services/supabase';
import { getPriceForDate, getAveragePriceForPeriod } from '../utils/priceCalculator';

type PropertyDetailsRouteProp = RouteProp<RootStackParamList, 'PropertyDetails'>;

const PropertyDetailsScreen: React.FC = () => {
  const route = useRoute<PropertyDetailsRouteProp>();
  const navigation = useNavigation();
  const { propertyId } = route.params;
  const { getPropertyById } = useProperties();
  const { user } = useAuth();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading } = useFavorites();
  const { requireAuthForFavorites } = useAuthRedirect();
  const { hostProfile, getHostProfile } = useHostProfile();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [reviewersProfiles, setReviewersProfiles] = useState<{[key: string]: string}>({});
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    const loadProperty = async () => {
      try {
        setLoading(true);
        console.log('🔍 Chargement de la propriété avec ID:', propertyId);
        
        // Vérifier que l'ID est valide
        if (!propertyId) {
          throw new Error('ID de propriété manquant');
        }
        
        const propertyData = await getPropertyById(propertyId);
        setProperty(propertyData);
        
        // Charger le profil de l'hôte
        if (propertyData && propertyData.host_id) {
          console.log('🔄 Chargement du profil de l\'hôte:', propertyData.host_id);
          await getHostProfile(propertyData.host_id);
        }

        // Charger les profils des reviewers
        if (propertyData.reviews && propertyData.reviews.length > 0) {
          console.log('🔄 Chargement des profils reviewers...');
          await loadReviewersProfiles(propertyData.reviews);
        } else {
          console.log('⚠️ Aucun avis trouvé pour cette propriété');
        }
        
        // Vérifier si la propriété est en favoris
        if (user && propertyData) {
          const favorited = isFavoriteSync(propertyData.id);
          setIsFavorited(favorited);
        }
      } catch (error: any) {
        console.error('❌ Erreur lors du chargement de la propriété:', error);
        
        // Messages d'erreur plus spécifiques
        let errorMessage = 'Impossible de charger les détails de la propriété';
        
        if (error.message?.includes('réseau') || error.message?.includes('network')) {
          errorMessage = 'Erreur de connexion réseau. Vérifiez votre connexion internet.';
        } else if (error.message?.includes('authentification') || error.message?.includes('auth')) {
          errorMessage = 'Erreur d\'authentification. Veuillez vous reconnecter.';
        } else if (error.message?.includes('non trouvée')) {
          errorMessage = 'Cette propriété n\'existe pas ou n\'est plus disponible.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        Alert.alert('Erreur', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [propertyId]);

  // Charger le prix pour aujourd'hui (ou le prix de base)
  useEffect(() => {
    const loadTodayPrice = async () => {
      if (property) {
        setPriceLoading(true);
        try {
          const today = new Date();
          const price = await getPriceForDate(property.id, today, property.price_per_night);
          setDisplayPrice(price);
        } catch (error) {
          console.error('Error loading today price:', error);
          setDisplayPrice(null);
        } finally {
          setPriceLoading(false);
        }
      }
    };

    loadTodayPrice();
  }, [property]); // Supprimer les autres dépendances pour éviter la boucle

  // Fonction pour charger les profils des reviewers
  const loadReviewersProfiles = async (reviews: any[]) => {
    try {
      console.log('🔍 Reviews reçues:', reviews);
      const reviewerIds = reviews.map(review => review.reviewer_id).filter(Boolean);
      console.log('🔍 Reviewer IDs extraits:', reviewerIds);
      
      if (reviewerIds.length === 0) {
        console.log('⚠️ Aucun reviewer_id trouvé');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name')
        .in('user_id', reviewerIds);

      if (error) {
        console.error('❌ Erreur lors du chargement des profils reviewers:', error);
        return;
      }

      console.log('🔍 Données profiles récupérées:', data);

      // Créer un mapping reviewer_id -> first_name
      const profilesMap: {[key: string]: string} = {};
      data?.forEach(profile => {
        console.log('🔍 Profile:', profile.user_id, '->', profile.first_name);
        profilesMap[profile.user_id] = profile.first_name || 'Anonyme';
      });

      setReviewersProfiles(profilesMap);
      console.log('✅ Profils reviewers chargés:', profilesMap);
    } catch (error) {
      console.error('❌ Erreur lors du chargement des profils reviewers:', error);
    }
  };

  // useEffect séparé pour gérer les favoris
  useEffect(() => {
    if (property) {
      // Utiliser la fonction synchrone pour une réponse immédiate
      setIsFavorited(isFavoriteSync(property.id));
    }
  }, [property, isFavoriteSync]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleFavoritePress = async () => {
    if (!property) return;

    requireAuthForFavorites(async () => {
      try {
        const newFavoriteState = await toggleFavorite(property.id);
        setIsFavorited(newFavoriteState);
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Impossible de modifier les favoris');
      }
    });
  };

  const handleBookNow = () => {
    if (!user) {
      // Rediriger vers la page de connexion avec un paramètre de retour
      navigation.navigate('Auth', { 
        returnTo: 'PropertyDetails', 
        returnParams: { propertyId } 
      });
    } else {
      setShowBookingModal(true);
    }
  };


  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Propriété non trouvée</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
      {/* Galerie d'images par catégories */}
      <View style={styles.imageContainer}>
        {property.photos && property.photos.length > 0 ? (
          <PhotoCategoryDisplay
            photos={property.photos}
            propertyTitle={property.title}
          />
        ) : (
          <PropertyImageCarousel
            images={property.images || []}
            height={300}
            onImagePress={(imageIndex) => {
              console.log('Image sélectionnée:', imageIndex);
              // Optionnel : ouvrir une vue plein écran des images
            }}
          />
        )}
      </View>

      {/* Informations principales */}
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{property.title}</Text>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
            disabled={favoriteLoading}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorited ? '#e74c3c' : '#666'}
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.locationContainer}>
          <Text style={styles.location}>
            📍 {property.cities?.name || property.location}
          </Text>
        </View>

        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>
            ⭐ {property.rating?.toFixed(1)} ({property.review_count} avis)
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            {priceLoading ? (
              <Text style={styles.price}>Chargement...</Text>
            ) : (
              <>
                <Text style={styles.price}>
                  {formatPrice(displayPrice !== null ? displayPrice : property.price_per_night)}
                </Text>
                <Text style={styles.priceUnit}>/nuit</Text>
              </>
            )}
          </View>
          {property.discount_enabled && property.discount_percentage && property.discount_min_nights && (
            <View style={styles.discountContainer}>
              <Text style={styles.discountText}>
                🎉 Réduction de {property.discount_percentage}% pour {property.discount_min_nights}+ nuits
              </Text>
            </View>
          )}
        </View>

        {/* Description */}
        {property.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos de ce logement</Text>
            <Text style={styles.description}>{property.description}</Text>
          </View>
        )}

        {/* Avis et commentaires */}
        {property.reviews && property.reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Avis des voyageurs</Text>
            {property.reviews.map((review, index) => {
              const reviewerName = reviewersProfiles[review.reviewer_id] || 'Anonyme';
              console.log('🔍 Affichage avis:', {
                reviewer_id: review.reviewer_id,
                reviewerName,
                profilesMap: reviewersProfiles
              });
              
              return (
                <View key={index} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUserInfo}>
                      <View style={styles.reviewUserAvatar}>
                        <Text style={styles.reviewUserInitial}>
                          {reviewerName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reviewUserDetails}>
                      <Text style={styles.reviewUserName}>
                        {reviewerName}
                      </Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Text key={star} style={[
                            styles.reviewStar,
                            star <= review.rating ? styles.reviewStarFilled : styles.reviewStarEmpty
                          ]}>
                            ⭐
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </Text>
                  {review.comment && (
                    <Text style={styles.reviewComment}>
                      "{review.comment}"
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Équipements */}
        {property.amenities && property.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Équipements</Text>
            <View style={styles.amenitiesGrid}>
              {property.amenities.map((amenity, idx) => (
                <View key={idx} style={styles.amenityItem}>
                  <Text style={styles.amenityIcon}>{amenity.icon || '✓'}</Text>
                  <Text style={styles.amenityName}>{amenity.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Informations pratiques */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations pratiques</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>
                {property.property_type?.replace('_', ' ').toUpperCase() || 'Non spécifié'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Voyageurs</Text>
              <Text style={styles.infoValue}>
                {property.max_guests || 'Non spécifié'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Chambres</Text>
              <Text style={styles.infoValue}>
                {property.bedrooms || 'Non spécifié'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Salles de bain</Text>
              <Text style={styles.infoValue}>
                {property.bathrooms || 'Non spécifié'}
              </Text>
            </View>
          </View>
        </View>

        {/* Section Hôte */}
        {property && property.host_id && hostProfile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Votre hôte</Text>
            <TouchableOpacity
              style={styles.hostCard}
              onPress={() => navigation.navigate('HostProfile', { hostId: property.host_id })}
              activeOpacity={0.7}
            >
              <View style={styles.hostInfo}>
                <View style={styles.hostAvatarContainer}>
                  {hostProfile?.avatar_url ? (
                    <Image
                      source={{ uri: hostProfile.avatar_url }}
                      style={styles.hostAvatar}
                    />
                  ) : (
                    <View style={styles.hostAvatarPlaceholder}>
                      <Ionicons name="person" size={24} color="#666" />
                    </View>
                  )}
                </View>
                
                <View style={styles.hostDetails}>
                  <Text style={styles.hostName}>
                    {hostProfile ? `${hostProfile.first_name} ${hostProfile.last_name}` : 'Chargement...'}
                  </Text>
                  <Text style={styles.hostTitle}>Hôte sur AkwaHome</Text>
                  
                  {/* Statistiques rapides */}
                  {hostProfile && ((hostProfile.total_properties != null && hostProfile.total_properties > 0) || (hostProfile.average_rating != null && hostProfile.average_rating > 0)) && (
                    <View style={styles.hostStats}>
                      {(hostProfile.total_properties != null && hostProfile.total_properties > 0) && (
                        <Text style={styles.hostStat}>
                          {hostProfile.total_properties} propriété{hostProfile.total_properties > 1 ? 's' : ''}
                        </Text>
                      )}
                      {(hostProfile.average_rating != null && hostProfile.average_rating > 0) && (
                        <Text style={styles.hostStat}>
                          ⭐ {hostProfile.average_rating}/5
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {hostProfile?.bio && (
                    <Text style={styles.hostBio} numberOfLines={2}>
                      {hostProfile.bio}
                    </Text>
                  )}
                </View>
                
                <View style={styles.hostAction}>
                  <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Localisation sur la carte */}
        <PropertyMap
          latitude={property.neighborhoods?.latitude || property.cities?.latitude}
          longitude={property.neighborhoods?.longitude || property.cities?.longitude}
          locationName={property.location}
          cityName={property.cities?.name}
          neighborhoodName={property.neighborhoods?.name}
        />

        {/* Boutons d'action */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.bookButton} onPress={handleBookNow}>
            <Text style={styles.bookButtonText}>Réserver maintenant</Text>
          </TouchableOpacity>
          
          <ContactHostButton
            property={property}
            variant="outline"
            size="medium"
            style={styles.contactButton}
          />
        </View>
      </View>
      </ScrollView>

      {/* Modal de réservation */}
      {property && (
        <BookingModal
          visible={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          property={property}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  imageContainer: {
    position: 'relative',
  },
  mainImage: {
    height: 300,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeIndicator: {
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginLeft: 10,
  },
  locationContainer: {
    marginBottom: 10,
  },
  location: {
    fontSize: 16,
    color: '#6c757d',
  },
  ratingContainer: {
    marginBottom: 15,
  },
  rating: {
    fontSize: 14,
    color: '#6c757d',
  },
  priceContainer: {
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  discountContainer: {
    marginTop: 8,
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e67e22',
  },
  priceUnit: {
    fontSize: 16,
    color: '#6c757d',
    marginLeft: 5,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 24,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  amenityIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  amenityName: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  infoItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 15,
  },
  bookButton: {
    backgroundColor: '#e67e22',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    flex: 1,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactButton: {
    flex: 1,
  },
  loadingText: {
    fontSize: 18,
    color: '#6c757d',
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
  },
  hostCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatarContainer: {
    marginRight: 12,
  },
  hostAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  hostAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  hostDetails: {
    flex: 1,
  },
  hostName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  hostTitle: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginBottom: 4,
  },
  hostBio: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  hostAction: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostStats: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 12,
  },
  hostStat: {
    fontSize: 12,
    color: '#2E7D32',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontWeight: '500',
  },
  // Styles pour les avis
  reviewItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewUserInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reviewUserDetails: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewStar: {
    fontSize: 14,
    marginRight: 2,
  },
  reviewStarFilled: {
    color: '#ffc107',
  },
  reviewStarEmpty: {
    color: '#e9ecef',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 8,
  },
  reviewComment: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    fontStyle: 'italic',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
});

export default PropertyDetailsScreen;
