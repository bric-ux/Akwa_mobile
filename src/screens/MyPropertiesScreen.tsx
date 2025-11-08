import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMyProperties } from '../hooks/useMyProperties';
import { useAuth } from '../services/AuthContext';
import { Property } from '../hooks/useProperties';

const MyPropertiesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getMyProperties, hideProperty, showProperty, deleteProperty, loading } = useMyProperties();
  const [properties, setProperties] = useState<Property[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadProperties = async () => {
    try {
      const userProperties = await getMyProperties();
      setProperties(userProperties);
    } catch (err) {
      console.error('Erreur lors du chargement des propriétés:', err);
    }
  };

  // Charger les propriétés quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadProperties();
      }
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProperties();
    setRefreshing(false);
  };

  const handleToggleVisibility = async (property: Property) => {
    const action = property.is_active ? 'masquer' : 'afficher';
    const newStatus = !property.is_active;

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} la propriété`,
      `Êtes-vous sûr de vouloir ${action} "${property.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try {
              const result = newStatus ? await showProperty(property.id) : await hideProperty(property.id);
              if (result.success) {
                Alert.alert('Succès', `Propriété ${action}ée avec succès`);
                loadProperties(); // Recharger la liste
              } else {
                Alert.alert('Erreur', `Impossible de ${action} la propriété`);
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleDeleteProperty = async (property: Property) => {
    Alert.alert(
      'Supprimer la propriété',
      `Êtes-vous sûr de vouloir supprimer définitivement "${property.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteProperty(property.id);
              if (result.success) {
                Alert.alert('Succès', 'Propriété supprimée avec succès');
                loadProperties(); // Recharger la liste
              } else {
                Alert.alert('Erreur', 'Impossible de supprimer la propriété');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleEditProperty = (propertyId: string) => {
    navigation.navigate('EditProperty', { propertyId });
  };

  const handleViewProperty = (propertyId: string) => {
    navigation.navigate('PropertyDetails', { propertyId });
  };


  const formatPrice = (price: number) => {
    return `${Math.round(price).toLocaleString('fr-FR')} CFA`;
  };

  // Fonction pour obtenir l'URL de la photo principale
  const getMainImageUrl = (property: Property): string => {
    // Priorité 1: property_photos (photos catégorisées) triées par display_order
    if (property.property_photos && Array.isArray(property.property_photos) && property.property_photos.length > 0) {
      const sortedPhotos = [...property.property_photos].sort((a, b) => 
        (a.display_order || 0) - (b.display_order || 0)
      );
      return sortedPhotos[0].url;
    }

    // Priorité 2: images array
    if (property.images && Array.isArray(property.images) && property.images.length > 0) {
      return property.images[0];
    }

    // Fallback: placeholder
    return 'https://via.placeholder.com/150';
  };

  const renderPropertyItem = ({ item: property }: { item: Property }) => (
    <View style={styles.propertyCard}>
      <TouchableOpacity
        style={styles.propertyInfo}
        onPress={() => handleViewProperty(property.id)}
      >
        <Image
          source={{ uri: getMainImageUrl(property) }}
          style={styles.propertyImage}
          resizeMode="cover"
        />
        <View style={styles.propertyDetails}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{property.title}</Text>
          <Text style={styles.propertyLocation} numberOfLines={1}>
            📍 {property.cities?.name || 'Inconnu'}
          </Text>
          <View style={styles.propertySpecs}>
            <Text style={styles.specText}>👥 {property.max_guests}</Text>
            <Text style={styles.specText}>🛏️ {property.bedrooms}</Text>
            <Text style={styles.specText}>🚿 {property.bathrooms}</Text>
          </View>
          <Text style={styles.propertyPrice}>{formatPrice(property.price_per_night)}/nuit</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.propertyStatus}>
        <View style={[
          styles.statusBadge,
          { backgroundColor: property.is_active ? '#2E7D32' : '#e74c3c' }
        ]}>
          <Text style={styles.statusText}>
            {property.is_active ? 'Active' : 'Masquée'}
          </Text>
        </View>
      </View>

      <View style={styles.propertyActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('PropertyCalendar', { propertyId: property.id })}
        >
          <Ionicons name="calendar-outline" size={16} color="#3498db" />
          <Text style={styles.actionButtonText}>Calendrier</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditProperty(property.id)}
        >
          <Ionicons name="create-outline" size={16} color="#f39c12" />
          <Text style={styles.actionButtonText}>Modifier</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleVisibility(property)}
        >
          <Ionicons 
            name={property.is_active ? "eye-off-outline" : "eye-outline"} 
            size={16} 
            color="#3498db" 
          />
          <Text style={styles.actionButtonText}>
            {property.is_active ? 'Masquer' : 'Afficher'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.deleteActionContainer}>
        <TouchableOpacity
          style={styles.deleteButtonFull}
          onPress={() => handleDeleteProperty(property)}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.deleteButtonFullText}>Supprimer la propriété</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="home-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune propriété</Text>
      <Text style={styles.emptySubtitle}>
        Vous n'avez pas encore de propriétés. Commencez par soumettre une candidature pour devenir hôte.
      </Text>
      <TouchableOpacity
        style={styles.becomeHostButton}
        onPress={() => navigation.navigate('BecomeHost')}
      >
        <Text style={styles.becomeHostButtonText}>Devenir hôte</Text>
      </TouchableOpacity>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour gérer vos propriétés.
          </Text>
          <TouchableOpacity
            style={styles.becomeHostButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.becomeHostButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes propriétés</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('BecomeHost')}
        >
          <Ionicons name="add" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      {loading && properties.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement de vos propriétés...</Text>
        </View>
      ) : properties.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          renderItem={renderPropertyItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2E7D32']} />
          }
        />
      )}
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyInfo: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  propertyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  propertyDetails: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  propertySpecs: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  specText: {
    fontSize: 12,
    color: '#666',
    marginRight: 15,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  propertyStatus: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  propertyActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginBottom: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    flex: 1,
    marginHorizontal: 3,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 11,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteActionContainer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deleteButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#e74c3c',
  },
  deleteButtonFullText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  becomeHostButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  becomeHostButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default MyPropertiesScreen;
