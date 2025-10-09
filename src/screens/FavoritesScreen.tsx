import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Property } from '../types';
import { supabase } from '../services/supabase';

const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      
      // Pour l'instant, on simule des favoris
      // Dans une vraie app, on récupérerait depuis la base de données
      const mockFavorites: Property[] = [
        {
          id: '1',
          title: 'Villa avec piscine à Cocody',
          description: 'Magnifique villa avec piscine privée',
          price_per_night: 45000,
          images: ['https://via.placeholder.com/400x300'],
          rating: 4.8,
          reviews_count: 12,
          max_guests: 6,
          bedrooms: 3,
          bathrooms: 2,
          amenities: [
            { id: '1', name: 'WiFi gratuit', icon: 'wifi' },
            { id: '2', name: 'Piscine', icon: 'water' },
            { id: '3', name: 'Parking gratuit', icon: 'car' },
          ],
          cities: { id: '1', name: 'Cocody', region: 'Lagunes' },
          location: 'Cocody, Abidjan',
        },
        {
          id: '2',
          title: 'Appartement moderne à Grand-Bassam',
          description: 'Appartement moderne face à la mer',
          price_per_night: 25000,
          images: ['https://via.placeholder.com/400x300'],
          rating: 4.5,
          reviews_count: 8,
          max_guests: 4,
          bedrooms: 2,
          bathrooms: 1,
          amenities: [
            { id: '1', name: 'WiFi gratuit', icon: 'wifi' },
            { id: '2', name: 'Climatisation', icon: 'snow' },
          ],
          cities: { id: '2', name: 'Grand-Bassam', region: 'Sud-Comoé' },
          location: 'Grand-Bassam',
        },
      ];
      
      setFavorites(mockFavorites);
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromFavorites = (propertyId: string) => {
    Alert.alert(
      'Supprimer des favoris',
      'Êtes-vous sûr de vouloir supprimer cette propriété de vos favoris ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setFavorites(prev => prev.filter(fav => fav.id !== propertyId));
          },
        },
      ]
    );
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'Prix sur demande';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handlePropertyPress = (property: Property) => {
    navigation.navigate('PropertyDetails', { propertyId: property.id });
  };

  const renderFavoriteItem = ({ item }: { item: Property }) => (
    <TouchableOpacity
      style={styles.favoriteItem}
      onPress={() => handlePropertyPress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.images[0] || 'https://via.placeholder.com/300x200' }}
        style={styles.favoriteImage}
        resizeMode="cover"
      />
      
      <View style={styles.favoriteContent}>
        <View style={styles.favoriteHeader}>
          <Text style={styles.favoriteTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeFromFavorites(item.id)}
          >
            <Ionicons name="heart" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.favoriteLocation} numberOfLines={1}>
          📍 {item.cities?.name || item.location}
        </Text>
        
        <View style={styles.favoriteDetails}>
          <Text style={styles.favoriteRating}>
            ⭐ {item.rating?.toFixed(1) || '0.0'} ({item.reviews_count || 0} avis)
          </Text>
          <Text style={styles.favoriteGuests}>
            👥 {item.max_guests || 0} voyageur{item.max_guests && item.max_guests > 1 ? 's' : ''}
          </Text>
        </View>
        
        <View style={styles.favoriteFooter}>
          <Text style={styles.favoritePrice}>
            {formatPrice(item.price_per_night)}/nuit
          </Text>
          {item.amenities && item.amenities.length > 0 && (
            <View style={styles.amenitiesContainer}>
              {item.amenities.slice(0, 2).map((amenity, index) => (
                <Text key={index} style={styles.amenity}>
                  {amenity.icon} {amenity.name}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Chargement de vos favoris...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (favorites.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>Aucun favori</Text>
          <Text style={styles.emptySubtitle}>
            Explorez nos hébergements et ajoutez vos favoris en cliquant sur le cœur
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} propriété{favorites.length > 1 ? 's' : ''} sauvegardée{favorites.length > 1 ? 's' : ''}
        </Text>
      </View>
      
      <FlatList
        data={favorites}
        renderItem={renderFavoriteItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  listContainer: {
    padding: 20,
  },
  favoriteItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  favoriteImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  favoriteContent: {
    padding: 16,
  },
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  favoriteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  removeButton: {
    padding: 5,
  },
  favoriteLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  favoriteDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  favoriteRating: {
    fontSize: 14,
    color: '#333',
  },
  favoriteGuests: {
    fontSize: 14,
    color: '#333',
  },
  favoriteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoritePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amenity: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
    marginBottom: 4,
  },
});

export default FavoritesScreen;
