import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { VEHICLE_COLORS } from '../constants/colors';
import { useCurrency } from '../hooks/useCurrency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'vehicles' | 'applications';

const MyVehiclesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { getMyVehicles, deleteVehicle, loading } = useVehicles();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('vehicles');
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [selectedVehicleImages, setSelectedVehicleImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const galleryScrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

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

  const handleImagePress = (e: any, vehicle: Vehicle) => {
    e.stopPropagation();
    const vehicleImages = vehicle.images || vehicle.photos?.map((p: any) => p.url) || [];
    if (vehicleImages.length > 0) {
      setSelectedVehicleImages(vehicleImages);
      setCurrentImageIndex(0);
      setShowImageGallery(true);
    }
  };

  const handlePrevImage = () => {
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : selectedVehicleImages.length - 1;
    setCurrentImageIndex(newIndex);
    galleryScrollViewRef.current?.scrollTo({
      x: newIndex * SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleNextImage = () => {
    const newIndex = currentImageIndex < selectedVehicleImages.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    galleryScrollViewRef.current?.scrollTo({
      x: newIndex * SCREEN_WIDTH,
      animated: true,
    });
  };

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const mainImage = item.images?.[0] || item.photos?.[0]?.url;
    const statusColor = getStatusColor(item);
    const statusText = getStatusText(item);
    const vehicleImages = item.images || item.photos?.map((p: any) => p.url) || [];
    const hasMultipleImages = vehicleImages.length > 1;

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
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={(e) => handleImagePress(e, item)}
            activeOpacity={0.9}
            disabled={!mainImage}
          >
            {mainImage ? (
              <>
                <Image source={{ uri: mainImage }} style={styles.vehicleImage} />
                {hasMultipleImages && (
                  <View style={styles.imageCountBadge}>
                    <Ionicons name="images-outline" size={12} color="#fff" />
                    <Text style={styles.imageCountText}>{vehicleImages.length}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="car-outline" size={activeTab === 'vehicles' ? 32 : 40} color="#9ca3af" />
              </View>
            )}
          </TouchableOpacity>

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

      {/* Modal Galerie d'images */}
      <Modal
        visible={showImageGallery}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageGallery(false)}
        statusBarTranslucent={true}
      >
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.95)" barStyle="light-content" />
        <View style={styles.galleryModalContainer}>
          <View style={[styles.galleryHeader, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.galleryTitle} numberOfLines={1}>
              Galerie d'images
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
              {selectedVehicleImages.map((imageUrl, index) => (
                <View key={index} style={styles.galleryImageWrapper}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.galleryImage}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </ScrollView>

            {selectedVehicleImages.length > 1 && (
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

          {selectedVehicleImages.length > 1 && (
            <View style={styles.galleryFooter}>
              <View style={styles.galleryCounter}>
                <Text style={styles.galleryCounterText}>
                  {currentImageIndex + 1} / {selectedVehicleImages.length}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
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
    position: 'relative',
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
  imageCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  galleryModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
