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
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { VEHICLE_COLORS } from '../constants/colors';
import { useCurrency } from '../hooks/useCurrency';

type TabType = 'vehicles' | 'applications';

const MyVehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { getMyVehicles, deleteVehicle, loading } = useVehicles();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('vehicles');

  const loadVehicles = async () => {
    try {
      console.log('🔄 [MyVehiclesScreen] Chargement des véhicules...');
      const data = await getMyVehicles();
      console.log(`✅ [MyVehiclesScreen] ${data.length} véhicule(s) chargé(s)`);
      setVehicles(data);
    } catch (err) {
      console.error('❌ [MyVehiclesScreen] Erreur lors du chargement des véhicules:', err);
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

  const getStatusColor = (vehicle: Vehicle) => {
    // Pour les candidatures
    const isApproved = (vehicle as any).is_approved === true;
    if (!isApproved) {
      const approvalStatus = (vehicle as any).approval_status;
      if (approvalStatus === 'rejected') return '#e74c3c';
      return '#FFA500'; // pending
    }
    // Pour les véhicules actifs
    return vehicle.is_active ? '#2E7D32' : '#e74c3c';
  };

  const getStatusText = (vehicle: Vehicle) => {
    // Pour les candidatures
    const isApproved = (vehicle as any).is_approved === true;
    if (!isApproved) {
      const approvalStatus = (vehicle as any).approval_status;
      if (approvalStatus === 'rejected') return 'Refusé';
      return 'En attente';
    }
    // Pour les véhicules actifs
    return vehicle.is_active ? 'Actif' : 'Masqué';
  };

  // Filtrer les véhicules selon l'onglet actif
  // Véhicules actifs : is_active && is_approved
  const activeVehicles = vehicles.filter(v => {
    const isApproved = (v as any).is_approved === true;
    const isActive = v.is_active === true;
    return isActive && isApproved;
  });
  // Candidatures : pas encore approuvés (is_approved est false, null, ou undefined)
  const pendingVehicles = vehicles.filter(v => {
    return (v as any).is_approved !== true;
  });

  console.log(`📊 [MyVehiclesScreen] Total: ${vehicles.length}, Actifs: ${activeVehicles.length}, Candidatures: ${pendingVehicles.length}`);

  const currentVehicles = activeTab === 'vehicles' ? activeVehicles : pendingVehicles;

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const mainImage = item.images?.[0] || item.photos?.[0]?.url;
    const statusColor = getStatusColor(item);
    const statusText = getStatusText(item);

    return (
      <TouchableOpacity
        style={styles.vehicleCard}
        onPress={() => {
          if (activeTab === 'vehicles') {
            // Navigation vers la page de gestion pour les véhicules actifs (comme sur le site web)
            navigation.navigate('VehicleManagement' as never, { vehicleId: item.id } as never);
          }
          // Les candidatures ne sont pas cliquables (comme sur le site web)
        }}
        activeOpacity={activeTab === 'vehicles' ? 0.7 : 1}
        disabled={activeTab === 'applications'}
      >
        <View style={styles.cardContent}>
          <View style={styles.imageContainer}>
            {mainImage ? (
              <Image source={{ uri: mainImage }} style={styles.vehicleImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="car-outline" size={activeTab === 'vehicles' ? 32 : 40} color="#9ca3af" />
              </View>
            )}
          </View>

          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.vehicleDetails}>
              {item.brand} {item.model} • {item.year}
            </Text>
            {activeTab === 'vehicles' && item.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color="#6b7280" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.location.name}
                </Text>
              </View>
            )}
            {activeTab === 'vehicles' && (
              <Text style={styles.price}>
                {formatPrice(item.price_per_day)}/jour
              </Text>
            )}
          </View>
        </View>

        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const isVehiclesTab = activeTab === 'vehicles';
    return (
      <View style={styles.emptyState}>
        <Ionicons 
          name={isVehiclesTab ? "car-outline" : "document-text-outline"} 
          size={64} 
          color="#9ca3af" 
        />
        <Text style={styles.emptyTitle}>
          {isVehiclesTab ? 'Aucun véhicule' : 'Aucune candidature'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isVehiclesTab
            ? "Vous n'avez pas encore de véhicules actifs."
            : "Vous n'avez pas de véhicule en attente d'approbation."}
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddVehicle' as never)}
        >
          <Text style={styles.addButtonText}>Ajouter un véhicule</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Véhicules</Text>
      </View>

      {/* Onglets */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'vehicles' && styles.tabActive]}
            onPress={() => setActiveTab('vehicles')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={activeTab === 'vehicles' ? 'car' : 'car-outline'} 
              size={20} 
              color={activeTab === 'vehicles' ? '#1e293b' : '#64748b'} 
            />
            <Text style={[styles.tabText, activeTab === 'vehicles' && styles.tabTextActive]}>
              Véhicules actifs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'applications' && styles.tabActive]}
            onPress={() => setActiveTab('applications')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={activeTab === 'applications' ? 'document-text' : 'document-text-outline'} 
              size={20} 
              color={activeTab === 'applications' ? '#1e293b' : '#64748b'} 
            />
            <Text style={[styles.tabText, activeTab === 'applications' && styles.tabTextActive]}>
              Candidatures
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Contenu principal */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={currentVehicles}
          renderItem={renderVehicle}
          keyExtractor={(item) => item.id}
          contentContainerStyle={currentVehicles.length === 0 ? styles.emptyContainer : styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={VEHICLE_COLORS.primary}
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
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabsContent: {
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  tabActive: {
    borderBottomColor: '#1e293b',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#1e293b',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  vehicleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    flexShrink: 0,
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flex: 1,
    minWidth: 0,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#64748b',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
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
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyVehiclesScreen;
