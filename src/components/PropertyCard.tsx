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

interface PropertyCardProps {
  property: Property;
  onPress: (property: Property) => void;
  variant?: 'grid' | 'list';
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onPress, variant = 'grid' }) => {
  const { requireAuthForFavorites } = useAuthRedirect();
  const { toggleFavorite, isFavoriteSync, loading: favoriteLoading } = useFavorites();
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    // Mettre à jour l'état local quand le cache global change
    setIsFavorited(isFavoriteSync(property.id));
  }, [property.id, isFavoriteSync]);

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
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <TouchableOpacity
      style={[styles.container, variant === 'list' && styles.listContainer]}
      onPress={handlePropertyPress}
      activeOpacity={0.8}
    >
      {variant === 'list' ? (
        <View style={styles.listLayout}>
          <View style={styles.imageContainer}>
            <Image
              source={{ 
                uri: property.images[0] || 'https://via.placeholder.com/300x200' 
              }}
              style={styles.listImage}
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
          <View style={styles.listContent}>
            <View style={styles.listHeader}>
              <Text style={styles.title} numberOfLines={1}>
                {property.title}
              </Text>
              <View style={styles.priceSection}>
                <Text style={styles.price}>
                  {formatPrice(property.price_per_night)}/nuit
                </Text>
                {property.discount_enabled && property.discount_percentage && property.discount_min_nights && (
                  <Text style={styles.discountBadge}>
                    -{property.discount_percentage}% pour {property.discount_min_nights}+ nuits
                  </Text>
                )}
              </View>
            </View>
            
            <Text style={styles.location} numberOfLines={1}>
              📍 {property.cities?.name || property.location}
            </Text>
            
            <View style={styles.listFooter}>
              <Text style={styles.rating}>
                ⭐ {(property.rating || 0).toFixed(1)} ({property.reviews_count || 0} avis)
              </Text>
              {property.amenities && property.amenities.length > 0 && (
                <View style={styles.amenitiesContainer}>
                  {property.amenities.slice(0, 3).map((amenity, index) => (
                    <Text key={index} style={styles.amenity}>
                      {amenity.icon} {amenity.name}
                    </Text>
                  ))}
                  {property.amenities.length > 3 && (
                    <Text style={styles.amenity}>
                      +{property.amenities.length - 3}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.imageContainer}>
            <Image
              source={{
                uri: property.images[0] || 'https://via.placeholder.com/300x200'
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
              {formatPrice(property.price_per_night)}/nuit
            </Text>
            {property.discount_enabled && property.discount_percentage && property.discount_min_nights && (
              <Text style={styles.discountBadgeOverlay}>
                -{property.discount_percentage}% pour {property.discount_min_nights}+ nuits
              </Text>
            )}
          </View>

          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {property.title}
            </Text>
            
            <Text style={styles.location} numberOfLines={1}>
              📍 {property.cities?.name || property.location}
            </Text>
            
            <Text style={styles.rating}>
              ⭐ {(property.rating || 0).toFixed(1)} ({property.reviews_count || 0} avis)
            </Text>
            
            {property.amenities && property.amenities.length > 0 && (
              <View style={styles.amenitiesContainer}>
                {property.amenities.slice(0, 3).map((amenity, index) => (
                  <Text key={index} style={styles.amenity}>
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
    marginHorizontal: 0,
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 200,
  },
  listLayout: {
    flexDirection: 'row',
    height: 120,
  },
  imageContainer: {
    position: 'relative',
  },
  listImage: {
    width: 120,
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flex: 1,
    padding: 12,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  price: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
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
});

export default PropertyCard;