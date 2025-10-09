import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Property } from '../types';

interface PropertyCardProps {
  property: Property;
  onPress: (property: Property) => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onPress }) => {
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
      style={styles.container}
      onPress={() => onPress(property)}
      activeOpacity={0.8}
    >
      <Image
        source={{ 
          uri: property.images[0] || 'https://via.placeholder.com/300x200' 
        }}
        style={styles.image}
        resizeMode="cover"
      />
      
      <View style={styles.priceContainer}>
        <Text style={styles.price}>
          {formatPrice(property.price_per_night)}/nuit
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {property.title}
        </Text>
        
        <Text style={styles.location} numberOfLines={1}>
          📍 {property.cities?.name || property.location}
        </Text>

        <View style={styles.details}>
        <Text style={styles.rating}>
          ⭐ {(property.rating || 0).toFixed(1)} ({property.reviews_count || 0} avis)
        </Text>
          {property.max_guests && (
            <Text style={styles.guests}>
              👥 {property.max_guests} voyageur{property.max_guests > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {property.amenities && property.amenities.length > 0 && (
          <View style={styles.amenitiesContainer}>
            {property.amenities.slice(0, 3).map((amenity) => (
              <Text key={amenity.id} style={styles.amenity}>
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
  image: {
    width: '100%',
    height: 200,
  },
  priceContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e67e22',
  },
  content: {
    padding: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  location: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 10,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rating: {
    fontSize: 12,
    color: '#6c757d',
  },
  guests: {
    fontSize: 12,
    color: '#6c757d',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  amenity: {
    fontSize: 10,
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#6c757d',
  },
});

export default PropertyCard;
