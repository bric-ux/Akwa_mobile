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
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useProperties } from '../hooks/useProperties';
import { Property } from '../types';
import PropertyImageCarousel from '../components/PropertyImageCarousel';

type PropertyDetailsRouteProp = RouteProp<RootStackParamList, 'PropertyDetails'>;

const PropertyDetailsScreen: React.FC = () => {
  const route = useRoute<PropertyDetailsRouteProp>();
  const { propertyId } = route.params;
  const { getPropertyById } = useProperties();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProperty = async () => {
      try {
        setLoading(true);
        const propertyData = await getPropertyById(propertyId);
        setProperty(propertyData);
      } catch (error) {
        console.error('Erreur lors du chargement de la propriété:', error);
        Alert.alert('Erreur', 'Impossible de charger les détails de la propriété');
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [propertyId, getPropertyById]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleBookNow = () => {
    Alert.alert(
      'Réservation',
      'Fonctionnalité de réservation en cours de développement',
      [{ text: 'OK' }]
    );
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
    <ScrollView style={styles.container}>
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
        <Text style={styles.title}>{property.title}</Text>
        
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
          <Text style={styles.price}>
            {formatPrice(property.price_per_night)}
          </Text>
          <Text style={styles.priceUnit}>/nuit</Text>
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
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
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
