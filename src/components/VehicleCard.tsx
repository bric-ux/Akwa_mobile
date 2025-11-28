import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Vehicle } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useLanguage } from '../contexts/LanguageContext';

interface VehicleCardProps {
  vehicle: Vehicle;
  onPress: (vehicle: Vehicle) => void;
  variant?: 'grid' | 'list';
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onPress, variant = 'list' }) => {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case 'car': return 'car-outline';
      case 'suv': return 'car-sport-outline';
      case 'van': return 'bus-outline';
      case 'truck': return 'car-sport-outline';
      case 'motorcycle': return 'bicycle-outline';
      case 'scooter': return 'bicycle-outline';
      case 'bicycle': return 'bicycle-outline';
      default: return 'car-outline';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, variant === 'list' && styles.listContainer]}
      onPress={() => onPress(vehicle)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLayout}>
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ 
              uri: vehicle.images?.[0] || 'https://via.placeholder.com/300x200' 
            }}
            style={styles.cardImage}
            resizeMode="cover"
          />
          
          {/* Prix en overlay */}
          <View style={styles.priceOverlay}>
            <Text style={styles.priceText}>
              {formatPrice(vehicle.price_per_day)}/jour
            </Text>
          </View>

          {/* Badge type de véhicule */}
          <View style={styles.typeBadge}>
            <Ionicons name={getVehicleTypeIcon(vehicle.vehicle_type) as any} size={16} color="#fff" />
            <Text style={styles.typeText}>{vehicle.vehicle_type.toUpperCase()}</Text>
          </View>
        </View>
        
        {/* Contenu de la carte */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {vehicle.brand} {vehicle.model} {vehicle.year}
          </Text>
          
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {vehicle.title}
          </Text>
          
          {vehicle.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.cardLocation} numberOfLines={1}>
                {vehicle.location.name}
              </Text>
            </View>
          )}
          
          {/* Caractéristiques */}
          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <Ionicons name="people-outline" size={14} color="#666" />
              <Text style={styles.featureText}>{vehicle.seats} places</Text>
            </View>
            {vehicle.transmission && (
              <View style={styles.featureItem}>
                <Ionicons name="settings-outline" size={14} color="#666" />
                <Text style={styles.featureText}>
                  {vehicle.transmission === 'automatic' ? 'Automatique' : 'Manuelle'}
                </Text>
              </View>
            )}
            {vehicle.fuel_type && (
              <View style={styles.featureItem}>
                <Ionicons name="flash-outline" size={14} color="#666" />
                <Text style={styles.featureText}>{vehicle.fuel_type}</Text>
              </View>
            )}
          </View>
          
          {/* Note */}
          {vehicle.rating > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>
                {vehicle.rating.toFixed(1)} ({vehicle.review_count} avis)
              </Text>
            </View>
          )}
        </View>
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
  listContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  cardLayout: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
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
  },
  priceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  cardLocation: {
    fontSize: 14,
    color: '#666',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#666',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
  },
});

export default VehicleCard;

