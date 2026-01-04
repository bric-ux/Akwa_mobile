import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { VEHICLE_COLORS } from '../constants/colors';
import { RootStackParamList } from '../types';

type VehicleManagementRouteProp = RouteProp<RootStackParamList, 'VehicleManagement'>;

const VehicleManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleManagementRouteProp>();
  const { vehicleId } = route.params;
  const { getVehicleById, updateVehicle, deleteVehicle, loading } = useVehicles();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const loadVehicle = async () => {
    try {
      setLoadingVehicle(true);
      const data = await getVehicleById(vehicleId);
      setVehicle(data);
    } catch (err) {
      console.error('Erreur lors du chargement du véhicule:', err);
      Alert.alert('Erreur', 'Impossible de charger le véhicule');
    } finally {
      setLoadingVehicle(false);
    }
  };

  const handleToggleVisibility = () => {
    if (!vehicle) return;
    
    Alert.alert(
      vehicle.is_active ? 'Masquer le véhicule' : 'Afficher le véhicule',
      `Êtes-vous sûr de vouloir ${vehicle.is_active ? 'masquer' : 'afficher'} "${vehicle.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: vehicle.is_active ? 'Masquer' : 'Afficher',
          onPress: async () => {
            try {
              const result = await updateVehicle(vehicleId, { is_active: !vehicle.is_active });
              if (result.success) {
                Alert.alert(
                  'Succès',
                  `Véhicule ${vehicle.is_active ? 'masqué' : 'affiché'} avec succès`
                );
                loadVehicle();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de modifier la visibilité');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleDeleteVehicle = () => {
    if (!vehicle) return;
    
    Alert.alert(
      'Supprimer le véhicule',
      `Êtes-vous sûr de vouloir supprimer définitivement "${vehicle.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteVehicle(vehicleId);
              if (result.success) {
                Alert.alert('Succès', 'Véhicule supprimé avec succès');
                navigation.goBack();
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

  const handleEditVehicle = () => {
    navigation.navigate('EditVehicle' as never, { vehicleId } as never);
  };

  const handleOpenCalendar = () => {
    navigation.navigate('VehicleCalendar' as never, { vehicleId } as never);
  };

  const handleOpenPricing = () => {
    navigation.navigate('VehiclePricing' as never, { vehicleId } as never);
  };

  if (loadingVehicle || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Véhicule non trouvé</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Véhicule introuvable</Text>
          <TouchableOpacity
            style={styles.backButtonStyle}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {vehicle.title}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="images-outline" size={20} color="#1e293b" />
            <Text style={styles.sectionTitle}>Photos du véhicule</Text>
          </View>
          {vehicle.images && vehicle.images.length > 0 ? (
            <View style={styles.photosContainer}>
              <Text style={styles.photoCount}>
                {vehicle.images.length} photo{vehicle.images.length > 1 ? 's' : ''}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {vehicle.images.map((url, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image source={{ uri: url }} style={styles.photo} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyPhotos}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={styles.emptyPhotosText}>Aucune photo disponible</Text>
            </View>
          )}
        </View>

        {/* Options d'action - Ligne 1 */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleOpenCalendar}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="calendar-outline" size={24} color="#475569" />
            </View>
            <Text style={styles.actionText}>Calendrier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleEditVehicle}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="create-outline" size={24} color="#d97706" />
            </View>
            <Text style={styles.actionText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleToggleVisibility}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons
                name={vehicle.is_active ? 'eye-off-outline' : 'eye-outline'}
                size={24}
                color="#475569"
              />
            </View>
            <Text style={styles.actionText}>
              {vehicle.is_active ? 'Masquer' : 'Afficher'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Options d'action - Ligne 2 */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardFull]}
            onPress={handleOpenPricing}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="pricetag-outline" size={24} color="#475569" />
            </View>
            <Text style={styles.actionText}>Tarification</Text>
          </TouchableOpacity>
        </View>

        {/* Option Supprimer */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteVehicle}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteButtonText}>Supprimer le véhicule</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonStyle: {
    backgroundColor: VEHICLE_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  photosContainer: {
    gap: 12,
  },
  photoCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  photosScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  photoItem: {
    width: 128,
    height: 128,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptyPhotos: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyPhotosText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionCardFull: {
    flex: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    marginHorizontal: 20,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VehicleManagementScreen;

