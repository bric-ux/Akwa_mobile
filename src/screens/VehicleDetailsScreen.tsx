import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../services/AuthContext';
import ContactOwnerButton from '../components/ContactOwnerButton';

type VehicleDetailsRouteProp = RouteProp<RootStackParamList, 'VehicleDetails'>;

const { width } = Dimensions.get('window');

const VehicleDetailsScreen: React.FC = () => {
  const route = useRoute<VehicleDetailsRouteProp>();
  const navigation = useNavigation();
  const { vehicleId } = route.params;
  const { getVehicleById } = useVehicles();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loadVehicle = async () => {
      try {
        setLoading(true);
        const vehicleData = await getVehicleById(vehicleId);
        setVehicle(vehicleData);
      } catch (error: any) {
        console.error('Erreur lors du chargement du véhicule:', error);
        Alert.alert('Erreur', 'Impossible de charger les détails du véhicule');
      } finally {
        setLoading(false);
      }
    };

    loadVehicle();
  }, [vehicleId]);

  const handleBookVehicle = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour réserver un véhicule');
      return;
    }
    navigation.navigate('VehicleBooking' as never, { vehicleId: vehicle.id } as never);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
        <Text style={styles.errorText}>Véhicule introuvable</Text>
      </View>
    );
  }

  const isOwner = user?.id === vehicle.owner_id;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Images */}
      {vehicle.images && vehicle.images.length > 0 && (
        <View style={styles.imageContainer}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentImageIndex(index);
            }}
            style={styles.imageScrollView}
          >
            {vehicle.images.map((imageUrl, index) => (
              <Image
                key={index}
                source={{ uri: imageUrl }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {vehicle.images.length > 1 && (
            <View style={styles.imageIndicators}>
              {vehicle.images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === currentImageIndex && styles.activeIndicator,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.content}>
        {/* Titre et prix */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{vehicle.brand} {vehicle.model} {vehicle.year}</Text>
            <Text style={styles.subtitle}>{vehicle.title}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{formatPrice(vehicle.price_per_day)}</Text>
            <Text style={styles.priceUnit}>/jour</Text>
          </View>
        </View>

        {/* Localisation */}
        {vehicle.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={18} color="#666" />
            <Text style={styles.location}>{vehicle.location.name}</Text>
          </View>
        )}

        {/* Note */}
        {vehicle.rating > 0 && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={18} color="#FFD700" />
            <Text style={styles.rating}>
              {vehicle.rating.toFixed(1)} ({vehicle.review_count} avis)
            </Text>
          </View>
        )}

        {/* Caractéristiques principales */}
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Ionicons name="people-outline" size={24} color="#2E7D32" />
            <Text style={styles.featureLabel}>Places</Text>
            <Text style={styles.featureValue}>{vehicle.seats}</Text>
          </View>
          {vehicle.transmission && (
            <View style={styles.featureCard}>
              <Ionicons name="settings-outline" size={24} color="#2E7D32" />
              <Text style={styles.featureLabel}>Transmission</Text>
              <Text style={styles.featureValue}>
                {vehicle.transmission === 'automatic' ? 'Automatique' : 'Manuelle'}
              </Text>
            </View>
          )}
          {vehicle.fuel_type && (
            <View style={styles.featureCard}>
              <Ionicons name="flash-outline" size={24} color="#2E7D32" />
              <Text style={styles.featureLabel}>Carburant</Text>
              <Text style={styles.featureValue}>{vehicle.fuel_type}</Text>
            </View>
          )}
          {vehicle.year && (
            <View style={styles.featureCard}>
              <Ionicons name="calendar-outline" size={24} color="#2E7D32" />
              <Text style={styles.featureLabel}>Année</Text>
              <Text style={styles.featureValue}>{vehicle.year}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {vehicle.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{vehicle.description}</Text>
          </View>
        )}

        {/* Équipements */}
        {vehicle.features && vehicle.features.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Équipements</Text>
            <View style={styles.featuresList}>
              {vehicle.features.map((feature, index) => (
                <View key={index} style={styles.featureTag}>
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                  <Text style={styles.featureTagText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Règles */}
        {vehicle.rules && vehicle.rules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Règles de location</Text>
            <View style={styles.rulesList}>
              {vehicle.rules.map((rule, index) => (
                <View key={index} style={styles.ruleItem}>
                  <Ionicons name="information-circle-outline" size={16} color="#666" />
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Boutons d'action */}
      {!isOwner && (
        <View style={styles.footer}>
          <ContactOwnerButton
            vehicle={vehicle}
            variant="outline"
            size="medium"
            style={styles.contactButton}
          />
          <TouchableOpacity
            style={styles.bookButton}
            onPress={handleBookVehicle}
          >
            <Text style={styles.bookButtonText}>Réserver ce véhicule</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
  imageContainer: {
    width: width,
    height: 300,
    position: 'relative',
  },
  imageScrollView: {
    width: width,
    height: 300,
  },
  mainImage: {
    width: width,
    height: 300,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 16,
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
    width: 24,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  titleContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  priceUnit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  location: {
    fontSize: 14,
    color: '#666',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  rating: {
    fontSize: 16,
    color: '#666',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  featureLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  featureValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  featureTagText: {
    fontSize: 14,
    color: '#2E7D32',
  },
  rulesList: {
    gap: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  contactButton: {
    marginBottom: 8,
  },
  bookButton: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default VehicleDetailsScreen;





