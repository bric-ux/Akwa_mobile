import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Property } from '../types';
import { useFavorites } from '../hooks/useFavorites';
import { useAuthRedirect } from '../hooks/useAuthRedirect';
import { useCurrency } from '../hooks/useCurrency';
import { getPriceForDate } from '../utils/priceCalculator';

interface PropertyCardProps {
  property: Property;
  onPress: (property: Property) => void;
  variant?: 'grid' | 'list';
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onPress, variant = 'grid' }) => {
  const { requireAuthForFavorites } = useAuthRedirect();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading } = useFavorites();
  const { formatPrice: formatPriceWithCurrency, currency } = useCurrency();
  const [isFavorited, setIsFavorited] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<number | null>(null);


  useEffect(() => {
    // Mettre à jour l'état local quand le cache global change
    setIsFavorited(isFavoriteSync(property.id));
  }, [property.id, isFavoriteSync, currency]);

  // Charger le prix pour aujourd'hui
  useEffect(() => {
    const loadTodayPrice = async () => {
      try {
        const today = new Date();
        const price = await getPriceForDate(property.id, today, property.price_per_night || 0);
        setDisplayPrice(price);
      } catch (error) {
        console.error('Error loading today price:', error);
        setDisplayPrice(null);
      }
    };

    loadTodayPrice();
  }, [property.id, property.price_per_night]);

  const handleFavoritePress = async (e: any) => {
    e.stopPropagation();
    
    requireAuthForFavorites(async () => {
      try {
        await toggleFavorite(property.id);
        // L'état sera mis à jour automatiquement via le système de cache global
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Impossible de modifier les favoris');
      }
    });
  };

  const handlePropertyPress = () => {
    onPress(property);
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'Prix sur demande';
    return formatPriceWithCurrency(price);
  };

  return (
    <TouchableOpacity
      style={[styles.container, variant === 'list' && styles.listContainer]}
      onPress={handlePropertyPress}
      activeOpacity={0.8}
    >
      {variant === 'list' ? (
        <View style={styles.cardLayout}>
          {/* Image avec prix en overlay */}
          <View style={styles.imageContainer}>
            <Image
              source={{ 
                uri: property.images?.[0] || 'https://via.placeholder.com/300x200' 
              }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            
            {/* Prix en overlay */}
            <View style={styles.priceOverlay}>
              <View style={styles.priceOverlayContent}>
                <Text style={styles.priceText}>
                  {formatPrice(displayPrice !== null ? displayPrice : property.price_per_night)}/nuit
                </Text>
              </View>
              {property.discount_enabled && property.discount_percentage && property.discount_min_nights && (
                <Text style={styles.discountOverlay}>
                  -{property.discount_percentage}% pour {property.discount_min_nights}+ nuits
                </Text>
              )}
            </View>
            
            {/* Bouton favori */}
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
              disabled={favoriteLoading}
            >
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorited ? '#e74c3c' : '#fff'}
              />
            </TouchableOpacity>
          </View>
          
          {/* Contenu de la carte */}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {property.title}
            </Text>
            
            <Text style={styles.cardLocation} numberOfLines={1}>
              📍 {property.cities?.name || property.location}
            </Text>
            
            <Text style={styles.cardRating}>
              ⭐ {(property.rating || 0).toFixed(1)} ({property.review_count || 0} avis)
            </Text>
            
            {property.amenities && property.amenities.length > 0 && (
              <View style={styles.cardAmenities}>
                {property.amenities.slice(0, 3).map((amenity, index) => (
                  <Text key={index} style={styles.amenityTag}>
                    {amenity.name}
                  </Text>
                ))}
                {property.amenities.length > 3 && (
                  <Text style={styles.moreAmenities}>
                    +{property.amenities.length - 3} autres
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.imageContainer}>
            <Image
              source={{
                uri: property.images?.[0] || 'https://via.placeholder.com/300x200'
              }}
              style={styles.image}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoritePress}
              disabled={favoriteLoading}
            >
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorited ? '#e74c3c' : '#fff'}
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.price}>
              {formatPrice(displayPrice !== null ? displayPrice : property.price_per_night)}/nuit
            </Text>
            {property.discount_enabled && property.discount_percentage && property.discount_min_nights && (
              <Text style={styles.discountBadgeOverlay}>
                -{property.discount_percentage}% pour {property.discount_min_nights}+ nuits
              </Text>
            )}
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={2}>
              {property.title}
            </Text>
            
            <Text style={styles.location} numberOfLines={1}>
              📍 {property.cities?.name || property.location}
            </Text>
            
            {/* Description courte */}
            {property.description && (
              <Text style={styles.gridDescription} numberOfLines={2}>
                {property.description}
              </Text>
            )}
            
            {/* Capacité compacte */}
            <View style={styles.gridCapacityContainer}>
              <Text style={styles.gridCapacity}>
                👥 {property.max_guests || 'N/A'}
              </Text>
              <Text style={styles.gridCapacity}>
                🛏️ {property.bedrooms || 'N/A'}
              </Text>
              <Text style={styles.gridCapacity}>
                💧 {property.bathrooms || 'N/A'}
              </Text>
            </View>
            
            <Text style={styles.rating}>
              ⭐ {(property.rating || 0).toFixed(1)} ({property.review_count || 0} avis)
            </Text>
            
            {property.amenities && property.amenities.length > 0 && (
              <View style={styles.amenitiesContainer}>
                {property.amenities.slice(0, 2).map((amenity, index) => (
                  <Text key={index} style={styles.amenity}>
                    {amenity.name}
                  </Text>
                ))}
                {property.amenities.length > 2 && (
                  <Text style={styles.moreAmenities}>
                    +{property.amenities.length - 2} autres
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  listContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  // Nouveaux styles pour le design en cartes
  cardLayout: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 200,
  },
  priceOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  priceOverlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  discountOverlay: {
    color: '#fff',
    fontSize: 10,
    backgroundColor: '#ff6b35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 6,
  },
  cardLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  cardRating: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  amenityTag: {
    fontSize: 12,
    color: '#2E7D32',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flex: 1,
    padding: 15,
    justifyContent: 'space-between',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  price: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
    flex: 1,
    marginRight: 10,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  rating: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  amenity: {
    fontSize: 10,
    color: '#2E7D32',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreAmenities: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  amenities: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  listPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'right',
  },
  discountBadge: {
    fontSize: 10,
    color: '#e67e22',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    fontWeight: '600',
  },
  discountBadgeOverlay: {
    fontSize: 10,
    color: '#fff',
    backgroundColor: '#e67e22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    fontWeight: '600',
  },
  // Nouveaux styles pour les détails
  description: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 8,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  capacity: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 4,
    marginRight: 12,
  },
  bedIcon: {
    marginLeft: 8,
  },
  // Styles pour le variant grid
  gridDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 6,
  },
  gridCapacityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gridCapacity: {
    fontSize: 11,
    color: '#6c757d',
  },
});

export default PropertyCard;