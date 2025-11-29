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
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

const MyVehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { getMyVehicles, deleteVehicle, loading } = useVehicles();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadVehicles = async () => {
    try {
      const data = await getMyVehicles();
      setVehicles(data);
    } catch (err) {
      console.error('Erreur lors du chargement des véhicules:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadVehicles();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVehicles();
    setRefreshing(false);
  };

  const handleDelete = (vehicle: Vehicle) => {
    Alert.alert(
      'Supprimer le véhicule',
      `Êtes-vous sûr de vouloir supprimer "${vehicle.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteVehicle(vehicle.id);
              if (result.success) {
                Alert.alert('Succès', 'Véhicule supprimé avec succès');
                loadVehicles();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de supprimer le véhicule');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const mainImage = item.images?.[0] || item.photos?.[0]?.url;
    const statusColor = item.is_active && item.admin_approved 
      ? '#10b981' 
      : item.admin_rejected 
      ? '#ef4444' 
      : '#f59e0b';

    const statusText = item.is_active && item.admin_approved 
      ? 'Approuvé' 
      : item.admin_rejected 
      ? 'Rejeté' 
      : 'En attente';

    return (
      <TouchableOpacity
        style={styles.vehicleCard}
        onPress={() => navigation.navigate('VehicleDetails' as never, { vehicleId: item.id } as never)}
      >
        <View style={styles.vehicleImageContainer}>
          {mainImage ? (
            <Image source={{ uri: mainImage }} style={styles.vehicleImage} />
          ) : (
            <View style={styles.vehicleImagePlaceholder}>
              <Ionicons name="car-outline" size={40} color="#ccc" />
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.vehicleDetails}>
            {item.brand} {item.model} • {item.year}
          </Text>
          {item.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.locationText}>{item.location.name}</Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{item.price_per_day.toLocaleString()}</Text>
            <Text style={styles.priceUnit}> XOF/jour</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditVehicle' as never, { vehicleId: item.id } as never)}
          >
            <Ionicons name="create-outline" size={20} color="#e67e22" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('HostVehicleBookings' as never, { vehicleId: item.id } as never)}
          >
            <Ionicons name="calendar-outline" size={20} color="#e67e22" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="car-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucun véhicule</Text>
      <Text style={styles.emptySubtitle}>
        Vous n'avez pas encore ajouté de véhicule à la location
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddVehicle' as never)}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Ajouter un véhicule</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Véhicules</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('HostVehicleBookings' as never)}
          >
            <Ionicons name="calendar-outline" size={24} color="#e67e22" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('AddVehicle' as never)}
          >
            <Ionicons name="add" size={24} color="#e67e22" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
        </View>
      ) : (
        <FlatList
          data={vehicles}
          renderItem={renderVehicle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={vehicles.length === 0 ? styles.emptyContainer : styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#e67e22"
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleImageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  vehicleImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleInfo: {
    padding: 16,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e67e22',
  },
  priceUnit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyVehiclesScreen;

