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
import { Property } from '../types';
import PropertyImageCarousel from '../components/PropertyImageCarousel';
import BookingModal from '../components/BookingModal';

type PropertyDetailsRouteProp = RouteProp<RootStackParamList, 'PropertyDetails'>;

const PropertyDetailsScreen: React.FC = () => {
  const route = useRoute<PropertyDetailsRouteProp>();
  const navigation = useNavigation();
  const { propertyId } = route.params;
  const { getPropertyById } = useProperties();
  const { user } = useAuth();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading } = useFavorites();
  const { requireAuthForFavorites } = useAuthRedirect();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

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
  }, [propertyId]); // Supprimer les autres dépendances pour éviter la boucle

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

  const handleContactHost = () => {
    Alert.alert(
      'Contacter l\'hôte',
      'Fonctionnalité de messagerie en cours de développement',
      [{ text: 'OK' }]
    );
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
      {/* Galerie d'images */}
      <View style={styles.imageContainer}>
        <PropertyImageCarousel
          images={property.images || []}
          height={300}
          onImagePress={(imageIndex) => {
            console.log('Image sélectionnée:', imageIndex);
            // Optionnel : ouvrir une vue plein écran des images
          }}
        />
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
            ⭐ {property.rating?.toFixed(1)} ({property.reviews_count} avis)
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatPrice(property.price_per_night)}
            </Text>
            <Text style={styles.priceUnit}>/nuit</Text>
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

        {/* Équipements */}
        {property.amenities && property.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Équipements</Text>
            <View style={styles.amenitiesGrid}>
              {property.amenities.map((amenity) => (
                <View key={amenity.id} style={styles.amenityItem}>
                  <Text style={styles.amenityIcon}>{amenity.icon}</Text>
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

        {/* Boutons d'action */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.bookButton} onPress={handleBookNow}>
            <Text style={styles.bookButtonText}>Réserver maintenant</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.contactButton} onPress={handleContactHost}>
            <Text style={styles.contactButtonText}>Contacter l'hôte</Text>
          </TouchableOpacity>
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
    marginTop: 20,
    gap: 15,
  },
  bookButton: {
    backgroundColor: '#e67e22',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e67e22',
  },
  contactButtonText: {
    color: '#e67e22',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 18,
    color: '#6c757d',
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
  },
});

export default PropertyDetailsScreen;
