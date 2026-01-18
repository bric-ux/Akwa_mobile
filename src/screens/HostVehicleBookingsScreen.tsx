import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useVehicles } from '../hooks/useVehicles';
import { VehicleBooking } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { VEHICLE_COLORS } from '../constants/colors';
import { getCommissionRates } from '../lib/commissions';
import { Image } from 'react-native';
import { ScrollView } from 'react-native';
import { safeGoBack } from '../utils/navigation';

type HostVehicleBookingsRouteParams = {
  vehicleId?: string;
};

const HostVehicleBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ HostVehicleBookings: HostVehicleBookingsRouteParams }, 'HostVehicleBookings'>>();
  const { vehicleId } = route.params || {};
  const { t } = useLanguage();
  const { getVehicleBookings, getAllOwnerBookings, updateBookingStatus, loading } = useVehicleBookings();
  const { getMyVehicles } = useVehicles();
  const [bookings, setBookings] = useState<VehicleBooking[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'in_progress'>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(vehicleId || null);

  const loadBookings = async () => {
    try {
      // Charger les véhicules
      const vehiclesData = await getMyVehicles();
      setVehicles(vehiclesData);
      
      // Charger les réservations
      if (selectedVehicleId) {
        const data = await getVehicleBookings(selectedVehicleId);
        setBookings(data);
      } else {
        // Charger toutes les réservations de tous les véhicules du propriétaire
        const data = await getAllOwnerBookings();
        setBookings(data);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des réservations:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadBookings();
    }, [selectedVehicleId])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const handleStatusUpdate = async (booking: VehicleBooking, status: 'confirmed' | 'cancelled') => {
    Alert.alert(
      status === 'confirmed' ? 'Confirmer la réservation' : 'Annuler la réservation',
      status === 'confirmed' 
        ? 'Voulez-vous confirmer cette réservation ?'
        : 'Voulez-vous annuler cette réservation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: status === 'confirmed' ? 'Confirmer' : 'Annuler',
          style: status === 'cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const result = await updateBookingStatus(booking.id, status);
              if (result.success) {
                Alert.alert('Succès', 'Réservation mise à jour avec succès');
                loadBookings();
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de mettre à jour la réservation');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'confirmed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'confirmed':
        return 'Confirmée';
      case 'cancelled':
        return 'Annulée';
      case 'completed':
        return 'Terminée';
      case 'in_progress':
        return 'En cours';
      default:
        return status;
    }
  };

  const isBookingInProgress = (booking: VehicleBooking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(booking.start_date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    
    return booking.status === 'confirmed' && startDate <= today && endDate >= today;
  };

  const isBookingCompleted = (booking: VehicleBooking) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(booking.end_date);
    endDate.setHours(0, 0, 0, 0);
    
    return endDate < today;
  };

  // Calculer les gains nets pour une réservation
  const calculateNetEarnings = (booking: VehicleBooking) => {
    if (booking.status === 'cancelled') return 0;
    
    // Prix de base = daily_rate × rental_days
    const basePrice = (booking.daily_rate || 0) * (booking.rental_days || 0);
    const commissionRates = getCommissionRates('vehicle');
    const ownerCommission = commissionRates.hostFeePercent / 100; // 2%
    return Math.round(basePrice * (1 - ownerCommission));
  };

  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'in_progress') return isBookingInProgress(booking);
    if (selectedFilter === 'completed') {
      return isBookingCompleted(booking) && booking.status !== 'cancelled';
    }
    return booking.status === selectedFilter;
  });

  // Obtenir les véhicules avec leurs réservations et statistiques
  const getVehiclesWithBookings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookingsByVehicle = new Map<string, VehicleBooking[]>();
    bookings.forEach(booking => {
      if (!booking.vehicle?.id) return;
      const vid = booking.vehicle.id;
      if (!bookingsByVehicle.has(vid)) {
        bookingsByVehicle.set(vid, []);
      }
      bookingsByVehicle.get(vid)!.push(booking);
    });

    const vehiclesWithStats = vehicles.map(vehicle => {
      const vehicleBookings = bookingsByVehicle.get(vehicle.id) || [];
      
      const stats = {
        total: vehicleBookings.length,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        completed: 0,
        inProgress: 0,
      };

      let isCurrentlyRented = false;

      vehicleBookings.forEach(booking => {
        if (booking.status === 'pending') stats.pending++;
        if (booking.status === 'confirmed') stats.confirmed++;
        if (booking.status === 'cancelled') stats.cancelled++;
        if (isBookingCompleted(booking) && booking.status !== 'cancelled') stats.completed++;
        
        if (isBookingInProgress(booking)) {
          stats.inProgress++;
          isCurrentlyRented = true;
        }
      });

      return {
        vehicle,
        bookings: vehicleBookings,
        stats,
        isCurrentlyRented,
        isAvailable: vehicleBookings.length === 0,
      };
    });

    return vehiclesWithStats.sort((a, b) => {
      if (a.isCurrentlyRented && !b.isCurrentlyRented) return -1;
      if (!a.isCurrentlyRented && b.isCurrentlyRented) return 1;
      if (a.stats.total > 0 && b.stats.total === 0) return -1;
      if (a.stats.total === 0 && b.stats.total > 0) return 1;
      return b.stats.total - a.stats.total;
    });
  };

  const vehiclesWithBookings = getVehiclesWithBookings();
  const selectedVehicle = vehiclesWithBookings.find(v => v.vehicle?.id === selectedVehicleId);

  const getVehicleMainImageUrl = (vehicle: any): string => {
    if (!vehicle) return 'https://via.placeholder.com/150';
    if (vehicle.images && Array.isArray(vehicle.images) && vehicle.images.length > 0) {
      return vehicle.images[0];
    }
    if (vehicle.vehicle_photos && Array.isArray(vehicle.vehicle_photos) && vehicle.vehicle_photos.length > 0) {
      return vehicle.vehicle_photos[0].url;
    }
    return 'https://via.placeholder.com/150';
  };

  const renderBooking = ({ item }: { item: VehicleBooking }) => {
    const inProgress = isBookingInProgress(item);
    const completed = isBookingCompleted(item);
    
    // Déterminer le statut à afficher
    let displayStatus = item.status;
    if (completed && item.status !== 'cancelled') {
      displayStatus = 'completed';
    } else if (inProgress) {
      displayStatus = 'in_progress';
    }
    
    const statusColor = getStatusColor(displayStatus);
    const statusText = getStatusText(displayStatus);
    const netEarnings = calculateNetEarnings(item);

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.renterInfo}>
            {item.renter?.avatar_url ? (
              <Image 
                source={{ uri: item.renter.avatar_url }} 
                style={styles.renterAvatar}
              />
            ) : (
              <View style={styles.renterAvatarPlaceholder}>
                <Ionicons name="person" size={20} color="#666" />
              </View>
            )}
            <View style={styles.renterDetails}>
              <Text style={styles.renterName}>
                {item.renter?.first_name || 'Locataire'} {item.renter?.last_name || ''}
              </Text>
              {item.renter?.email && (
                <Text style={styles.renterEmail}>{item.renter.email}</Text>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {formatDate(item.start_date)} → {formatDate(item.end_date)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={16} color="#10b981" />
            <Text style={[styles.detailText, styles.netEarnings]}>
              Gain net : {netEarnings.toLocaleString()} FCFA
            </Text>
          </View>
        </View>

        {item.message_to_owner && (
          <View style={styles.messageSection}>
            <Text style={styles.messageLabel}>Message:</Text>
            <Text style={styles.messageText}>{item.message_to_owner}</Text>
          </View>
        )}

        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => handleStatusUpdate(item, 'confirmed')}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleStatusUpdate(item, 'cancelled')}
            >
              <Ionicons name="close-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Refuser</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune réservation</Text>
      <Text style={styles.emptySubtitle}>
        {selectedFilter === 'all' 
          ? "Vous n'avez pas encore de réservation pour vos véhicules"
          : `Aucune réservation ${selectedFilter === 'pending' ? 'en attente' : selectedFilter === 'confirmed' ? 'confirmée' : selectedFilter === 'completed' ? 'terminée' : 'annulée'}`}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!selectedVehicleId ? (
        // Vue liste des véhicules
        <>
          <View style={styles.header}>
            <View style={styles.placeholder} />
            <Text style={styles.headerTitle}>Réservations de véhicules</Text>
            <View style={styles.placeholder} />
          </View>

          {vehiclesWithBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Aucun véhicule</Text>
              <Text style={styles.emptySubtitle}>
                Vous n'avez pas encore ajouté de véhicule.
              </Text>
            </View>
          ) : (
            <FlatList
              data={vehiclesWithBookings}
              keyExtractor={(item) => item.vehicle.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.vehicleCard,
                    item.isCurrentlyRented && styles.vehicleCardRented
                  ]}
                  onPress={() => setSelectedVehicleId(item.vehicle.id)}
                >
                  <Image
                    source={{ uri: getVehicleMainImageUrl(item.vehicle) }}
                    style={styles.vehicleCardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.vehicleCardContent}>
                    <View style={styles.vehicleCardHeader}>
                      <Text style={styles.vehicleCardTitle} numberOfLines={2}>
                        {item.vehicle.brand} {item.vehicle.model}
                      </Text>
                      {item.isCurrentlyRented ? (
                        <View style={styles.rentedBadge}>
                          <Text style={styles.rentedBadgeText}>En location</Text>
                        </View>
                      ) : item.isAvailable ? (
                        <View style={styles.availableBadge}>
                          <Text style={styles.availableBadgeText}>Disponible</Text>
                        </View>
                      ) : (
                        <View style={styles.unavailableBadge}>
                          <Text style={styles.unavailableBadgeText}>Indisponible</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.vehicleCardYear}>{item.vehicle.year}</Text>
                    <View style={styles.vehicleCardStats}>
                      <Text style={styles.vehicleCardStatText}>
                        Total: {item.stats.total}
                      </Text>
                      {item.stats.pending > 0 && (
                        <Text style={[styles.vehicleCardStatText, { color: '#FFA500' }]}>
                          En attente: {item.stats.pending}
                        </Text>
                      )}
                      {item.stats.confirmed > 0 && (
                        <Text style={[styles.vehicleCardStatText, { color: '#4CAF50' }]}>
                          Confirmées: {item.stats.confirmed}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={VEHICLE_COLORS.primary}
                />
              }
            />
          )}
        </>
      ) : (
        // Vue détaillée des réservations d'un véhicule
        <>
          {/* En-tête */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setSelectedVehicleId(null);
                setSelectedFilter('all');
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Réservations</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Informations du véhicule */}
          {selectedVehicle && (
            <View style={styles.selectedVehicleInfo}>
              <Image
                source={{ uri: getVehicleMainImageUrl(selectedVehicle.vehicle) }}
                style={styles.selectedVehicleImage}
                resizeMode="cover"
              />
              <View style={styles.selectedVehicleDetails}>
                <Text style={styles.selectedVehicleTitle}>
                  {selectedVehicle.vehicle.brand} {selectedVehicle.vehicle.model}
                </Text>
                <Text style={styles.selectedVehicleYear}>
                  {selectedVehicle.vehicle.year} - {selectedVehicle.vehicle.fuel_type}
                </Text>
              </View>
            </View>
          )}

          {/* Filtres */}
          <View style={styles.filters}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.filtersContent}
            >
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'in_progress', label: 'En cours' },
                { key: 'pending', label: 'En attente' },
                { key: 'confirmed', label: 'Confirmées' },
                { key: 'cancelled', label: 'Annulées' },
                { key: 'completed', label: 'Terminées' },
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter.key && styles.filterButtonActive,
                  ]}
                  onPress={() => setSelectedFilter(filter.key as any)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedFilter === filter.key && styles.filterButtonTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Liste des réservations */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredBookings}
              renderItem={renderBooking}
              keyExtractor={(item) => item.id}
              contentContainerStyle={filteredBookings.length === 0 ? styles.emptyContainer : styles.listContainer}
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
        </>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  filters: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 0,
  },
  filterButtonActive: {
    backgroundColor: '#1e293b', // slate-800 comme sur le site web
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
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
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  renterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  renterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  renterAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renterDetails: {
    flex: 1,
  },
  renterName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  renterEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  netEarnings: {
    color: '#10b981',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  messageSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
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
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  vehicleCardRented: {
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  vehicleCardImage: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  vehicleCardContent: {
    flex: 1,
    padding: 12,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  vehicleCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  rentedBadge: {
    backgroundColor: '#1e293b', // slate-800 comme sur le site web
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rentedBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  availableBadge: {
    backgroundColor: '#22c55e', // green-500 comme sur le site web
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  unavailableBadge: {
    backgroundColor: '#f97316', // orange-500 comme sur le site web
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unavailableBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  vehicleCardYear: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  vehicleCardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleCardStatText: {
    fontSize: 12,
    color: '#666',
  },
  propertyHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backToVehiclesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backToVehiclesText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  selectedVehicleInfo: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  selectedVehicleImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  selectedVehicleDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  selectedVehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  selectedVehicleYear: {
    fontSize: 14,
    color: '#666',
  },
});

export default HostVehicleBookingsScreen;





