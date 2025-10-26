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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin, AdminProperty } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

const AdminPropertiesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getAllProperties, updatePropertyStatus, deleteProperty, loading } = useAdmin();
  
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  const loadProperties = async () => {
    try {
      const allProperties = await getAllProperties();
      setProperties(allProperties);
    } catch (error) {
      console.error('Erreur lors du chargement des propriétés:', error);
    }
  };

  // Charger les propriétés quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadProperties();
      }
    }, [user, profile])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProperties();
    setRefreshing(false);
  };

  const handleToggleVisibility = async (property: AdminProperty) => {
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
              const result = await updatePropertyStatus(property.id, newStatus);
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

  const handleDeleteProperty = async (property: AdminProperty) => {
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

  const handleViewProperty = (propertyId: string) => {
    navigation.navigate('PropertyDetails', { propertyId });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredProperties = properties.filter(property => {
    if (filterActive === 'all') return true;
    if (filterActive === 'active') return property.is_active;
    if (filterActive === 'inactive') return !property.is_active;
    return true;
  });

  const renderPropertyItem = ({ item: property }: { item: AdminProperty }) => (
    <View style={styles.propertyCard}>
      <TouchableOpacity
        style={styles.propertyInfo}
        onPress={() => handleViewProperty(property.id)}
      >
        <Image
          source={{ uri: property.images?.[0] || 'https://via.placeholder.com/150' }}
          style={styles.propertyImage}
        />
        <View style={styles.propertyDetails}>
          <Text style={styles.propertyTitle} numberOfLines={1}>{property.title}</Text>
          <Text style={styles.propertyLocation} numberOfLines={1}>
            📍 {property.cities?.name || 'Inconnu'}
          </Text>
          <Text style={styles.propertyHost} numberOfLines={1}>
            👤 {property.host_info?.first_name} {property.host_info?.last_name}
          </Text>
          <View style={styles.propertySpecs}>
            <Text style={styles.specText}>👥 {property.max_guests}</Text>
            <Text style={styles.specText}>🛏️ {property.bedrooms}</Text>
            <Text style={styles.specText}>🚿 {property.bathrooms}</Text>
          </View>
          <Text style={styles.propertyPrice}>{formatPrice(property.price_per_night)}/nuit</Text>
          <Text style={styles.propertyDate}>Créée le {formatDate(property.created_at)}</Text>
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
          onPress={() => handleViewProperty(property.id)}
        >
          <Ionicons name="eye-outline" size={16} color="#2E7D32" />
          <Text style={styles.actionButtonText}>Voir</Text>
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

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteProperty(property)}
        >
          <Ionicons name="trash-outline" size={16} color="#e74c3c" />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="home-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune propriété</Text>
      <Text style={styles.emptySubtitle}>
        {filterActive === 'all' 
          ? 'Aucune propriété trouvée'
          : filterActive === 'active'
          ? 'Aucune propriété active'
          : 'Aucune propriété masquée'
        }
      </Text>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour accéder à l'administration.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Vérifier que l'utilisateur est admin
  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color="#e74c3c" />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <Text style={styles.emptySubtitle}>
            Vous n'avez pas les permissions nécessaires pour accéder à l'administration.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.loginButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des propriétés</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {['all', 'active', 'inactive'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterActive === status && styles.filterButtonActive,
            ]}
            onPress={() => setFilterActive(status as any)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterActive === status && styles.filterButtonTextActive,
              ]}
            >
              {status === 'all' ? 'Toutes' :
               status === 'active' ? 'Actives' :
               'Masquées'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{properties.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{properties.filter(p => p.is_active).length}</Text>
          <Text style={styles.statLabel}>Actives</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{properties.filter(p => !p.is_active).length}</Text>
          <Text style={styles.statLabel}>Masquées</Text>
        </View>
      </View>

      {loading && properties.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement des propriétés...</Text>
        </View>
      ) : filteredProperties.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredProperties}
          keyExtractor={(item) => item.id}
          renderItem={renderPropertyItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#e74c3c']} />
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
  refreshButton: {
    padding: 8,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
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
    marginBottom: 2,
  },
  propertyHost: {
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
    marginBottom: 4,
  },
  propertyDate: {
    fontSize: 12,
    color: '#999',
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
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#ffeaea',
  },
  deleteButtonText: {
    color: '#e74c3c',
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
  loginButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
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

export default AdminPropertiesScreen;
