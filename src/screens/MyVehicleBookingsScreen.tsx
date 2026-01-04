import React, { useState, useCallback } from 'react';
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
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useAuth } from '../services/AuthContext';
import { VehicleBooking } from '../types';
import { formatPrice } from '../utils/priceCalculator';

const MyVehicleBookingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getMyBookings, loading } = useVehicleBookings();
  const [bookings, setBookings] = useState<VehicleBooking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress'>('all');

  const getBookingStatus = (booking: VehicleBooking): string => {
    if (booking.status === 'cancelled') return 'cancelled';
    if (booking.status === 'pending') return 'pending';
    if (booking.status === 'confirmed') {
      const startDate = new Date(booking.start_date);
      const endDate = new Date(booking.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      if (endDate < today) return 'completed';
      if (startDate <= today && today <= endDate) return 'in_progress';
      return 'confirmed';
    }
    return booking.status || 'pending';
  };

  const loadBookings = async () => {
    try {
      const userBookings = await getMyBookings();
      setBookings(userBookings);
    } catch (err) {
      console.error('Erreur lors du chargement des réservations:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadBookings();
      }
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'all':
        return 'Toutes';
      case 'pending':
        return 'En attente';
      case 'confirmed':
        return 'Confirmées';
      case 'completed':
        return 'Terminées';
      case 'cancelled':
        return 'Annulées';
      case 'in_progress':
        return 'En cours';
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'confirmed':
        return '#10b981';
      case 'in_progress':
        return '#3b82f6';
      case 'completed':
        return '#6366f1';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const filteredBookings = bookings.filter(booking => {
    if (selectedFilter === 'all') return true;
    const status = getBookingStatus(booking);
    return status === selectedFilter;
  });

  const renderBookingItem = ({ item: booking }: { item: VehicleBooking }) => {
    const status = getBookingStatus(booking);
    const statusColor = getStatusColor(status);
    const vehicle = booking.vehicle;
    const vehicleImage = vehicle?.images?.[0] || vehicle?.vehicle_photos?.[0]?.url || null;
    const rentalDays = booking.rental_days || 1;

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.bookingTitleRow}>
            {vehicleImage ? (
              <Image
                source={{ uri: vehicleImage }}
                style={styles.vehicleImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}>
                <Ionicons name="car-outline" size={32} color="#ccc" />
              </View>
            )}
            <View style={styles.bookingInfo}>
              <Text style={styles.vehicleTitle}>
                {vehicle?.title || `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Véhicule'}
              </Text>
              <Text style={styles.vehicleLocation}>
                📍 {vehicle?.location?.name || 'Localisation inconnue'}
              </Text>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={14} color="#666" />
                <Text style={styles.dateText}>
                  {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                </Text>
                <Text style={styles.daysText}>
                  {rentalDays} jour{rentalDays > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{getStatusText(status)}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total</Text>
            <Text style={styles.priceValue}>
              {formatPrice(booking.total_price || 0)}
            </Text>
          </View>

          {booking.message_to_owner && (
            <View style={styles.messageContainer}>
              <Text style={styles.messageLabel}>Votre message :</Text>
              <Text style={styles.messageText}>{booking.message_to_owner}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              (navigation as any).navigate('VehicleBookingDetails', { bookingId: booking.id });
            }}
          >
            <Ionicons name="receipt-outline" size={18} color="#2563eb" />
            <Text style={styles.actionButtonText}>Voir détails</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              if (vehicle?.id) {
                navigation.navigate('VehicleDetails' as never, { vehicleId: vehicle.id } as never);
              }
            }}
          >
            <Ionicons name="eye-outline" size={18} color="#2E7D32" />
            <Text style={styles.actionButtonText}>Voir véhicule</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune réservation de véhicule</Text>
      <Text style={styles.emptySubtitle}>
        {selectedFilter === 'all' 
          ? 'Vous n\'avez pas encore de réservations de véhicules'
          : `Aucune réservation ${getStatusText(selectedFilter).toLowerCase()}`
        }
      </Text>
      {selectedFilter === 'all' && (
        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => navigation.navigate('Vehicles' as never)}
        >
          <Text style={styles.exploreButtonText}>Découvrir des véhicules</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFilterButton = (filter: typeof selectedFilter, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Connexion requise</Text>
          <Text style={styles.emptySubtitle}>
            Vous devez être connecté pour voir vos réservations
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Auth' as never)}
          >
            <Text style={styles.exploreButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes réservations véhicules</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersContent}>
            {renderFilterButton('all', 'Toutes')}
            {renderFilterButton('in_progress', 'En cours')}
            {renderFilterButton('pending', 'En attente')}
            {renderFilterButton('confirmed', 'Confirmées')}
            {renderFilterButton('completed', 'Terminées')}
            {renderFilterButton('cancelled', 'Annulées')}
          </View>
        </ScrollView>
      </View>

      {/* Liste des réservations */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement des réservations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2E7D32']}
              tintColor="#2E7D32"
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
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
  placeholder: {
    width: 40,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filtersContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
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
  bookingTitleRow: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  vehicleImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  vehicleImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingInfo: {
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vehicleLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  daysText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  bookingDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  messageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 6,
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
  exploreButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
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

export default MyVehicleBookingsScreen;

