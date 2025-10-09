import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Property {
  id: string;
  title: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  amenities: Array<{
    id: string;
    name: string;
    icon: string;
  }>;
}

interface RecommendedPropertiesProps {
  properties: Property[];
  onPropertyPress?: (property: Property) => void;
  onViewAllPress?: () => void;
}

export const RecommendedProperties: React.FC<RecommendedPropertiesProps> = ({
  properties,
  onPropertyPress,
  onViewAllPress,
}) => {
  const renderPropertyCard = (property: Property) => (
    <TouchableOpacity
      key={property.id}
      style={styles.propertyCard}
      onPress={() => onPropertyPress?.(property)}
    >
      <Image
        source={{ uri: property.image }}
        style={styles.propertyImage}
        resizeMode="cover"
      />
      
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyTitle} numberOfLines={1}>
          {property.title}
        </Text>
        <Text style={styles.propertyLocation} numberOfLines={1}>
          {property.location}
        </Text>
        
        <View style={styles.propertyDetails}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>{(property.rating || 0).toFixed(1)}</Text>
        </View>
        
        <Text style={styles.priceText}>
          {(property.price || 0).toLocaleString()} FCFA/nuit
        </Text>
        </View>
        
        {property.amenities && property.amenities.length > 0 && (
          <View style={styles.amenitiesContainer}>
            {property.amenities.slice(0, 3).map((amenity) => (
              <View key={amenity.id} style={styles.amenityTag}>
                <Text style={styles.amenityIcon}>{amenity.icon}</Text>
                <Text style={styles.amenityText} numberOfLines={1}>
                  {amenity.name}
                </Text>
              </View>
            ))}
            {property.amenities.length > 3 && (
              <Text style={styles.moreAmenities}>
                +{property.amenities.length - 3}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Propriétés recommandées</Text>
        <TouchableOpacity onPress={onViewAllPress}>
          <Text style={styles.viewAllText}>Voir tout</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {properties.map(renderPropertyCard)}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  propertyCard: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  propertyImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  propertyInfo: {
    padding: 15,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  propertyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  amenityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  amenityIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  amenityText: {
    fontSize: 12,
    color: '#666',
    maxWidth: 60,
  },
  moreAmenities: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});
