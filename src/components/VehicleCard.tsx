import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Vehicle } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useLanguage } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VehicleCardProps {
  vehicle: Vehicle;
  onPress: (vehicle: Vehicle) => void;
  variant?: 'grid' | 'list';
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onPress, variant = 'list' }) => {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const galleryScrollViewRef = useRef<ScrollView>(null);

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

  const vehicleImages = vehicle.images || vehicle.photos?.map((p: any) => p.url) || [];
  const hasMultipleImages = vehicleImages.length > 1;

  const handleImagePress = (e: any) => {
    e.stopPropagation();
    if (vehicleImages.length > 0) {
      setCurrentImageIndex(0);
      setShowImageGallery(true);
    }
  };

  const handlePrevImage = () => {
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : vehicleImages.length - 1;
    setCurrentImageIndex(newIndex);
    galleryScrollViewRef.current?.scrollTo({
      x: newIndex * SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleNextImage = () => {
    const newIndex = currentImageIndex < vehicleImages.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    galleryScrollViewRef.current?.scrollTo({
      x: newIndex * SCREEN_WIDTH,
      animated: true,
    });
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, variant === 'list' && styles.listContainer]}
        onPress={() => onPress(vehicle)}
        activeOpacity={0.8}
      >
        <View style={styles.cardLayout}>
          {/* Image */}
          <View style={styles.imageContainer}>
            <TouchableOpacity
              onPress={handleImagePress}
              activeOpacity={0.9}
              style={styles.imageTouchable}
            >
              <Image
                source={{ 
                  uri: vehicleImages[0] || 'https://via.placeholder.com/300x200' 
                }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              {hasMultipleImages && (
                <View style={styles.imageCountBadge}>
                  <Ionicons name="images-outline" size={14} color="#fff" />
                  <Text style={styles.imageCountText}>{vehicleImages.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Prix en overlay */}
            <View style={styles.priceOverlay}>
              <Text style={styles.priceText}>
                {formatPrice(vehicle.price_per_day)}/jour
              </Text>
              {vehicle.hourly_rental_enabled && vehicle.price_per_hour && (
                <Text style={styles.priceTextHourly}>
                  {formatPrice(vehicle.price_per_hour)}/h
                </Text>
              )}
            </View>

            {/* Badge type de véhicule */}
            <View style={styles.typeBadge}>
              <Ionicons name={getVehicleTypeIcon(vehicle.vehicle_type) as any} size={16} color="#fff" />
              <Text style={styles.typeText}>{vehicle.vehicle_type?.toUpperCase() || 'VEHICULE'}</Text>
            </View>
          </View>
        
        {/* Contenu de la carte */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {vehicle.brand || ''} {vehicle.model || ''} {vehicle.year || ''}
          </Text>
          
          {vehicle.title && (
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {vehicle.title}
            </Text>
          )}
          
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
              <Text style={styles.featureText}>{vehicle.seats || 0} places</Text>
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
                <Text style={styles.featureText}>{vehicle.fuel_type || ''}</Text>
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

    {/* Modal Galerie d'images */}
    <Modal
      visible={showImageGallery}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowImageGallery(false)}
    >
      <SafeAreaView style={styles.galleryModalContainer}>
        <View style={styles.galleryHeader}>
          <Text style={styles.galleryTitle} numberOfLines={1}>
            {vehicle.title || `${vehicle.brand} ${vehicle.model}`}
          </Text>
          <TouchableOpacity
            style={styles.galleryCloseButton}
            onPress={() => setShowImageGallery(false)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.galleryImageContainer}>
          <ScrollView
            ref={galleryScrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setCurrentImageIndex(index);
            }}
            style={styles.galleryScrollView}
            contentContainerStyle={styles.galleryScrollContent}
          >
            {vehicleImages.map((imageUrl, index) => (
              <View key={index} style={styles.galleryImageWrapper}>
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.galleryImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          {hasMultipleImages && (
            <>
              <TouchableOpacity
                style={[styles.galleryNavButton, styles.galleryNavButtonLeft]}
                onPress={handlePrevImage}
              >
                <Ionicons name="chevron-back" size={32} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.galleryNavButton, styles.galleryNavButtonRight]}
                onPress={handleNextImage}
              >
                <Ionicons name="chevron-forward" size={32} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {hasMultipleImages && (
          <View style={styles.galleryFooter}>
            <View style={styles.galleryCounter}>
              <Text style={styles.galleryCounterText}>
                {currentImageIndex + 1} / {vehicleImages.length}
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
    </>
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
  imageTouchable: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: 200,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  priceOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  priceText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  priceTextHourly: {
    color: '#e67e22',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
  galleryModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  galleryTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 16,
  },
  galleryCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  galleryScrollView: {
    flex: 1,
  },
  galleryScrollContent: {
    alignItems: 'center',
  },
  galleryImageWrapper: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  galleryNavButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  galleryNavButtonLeft: {
    left: 16,
  },
  galleryNavButtonRight: {
    right: 16,
  },
  galleryFooter: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    alignItems: 'center',
  },
  galleryCounter: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  galleryCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VehicleCard;





