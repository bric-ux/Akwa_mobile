import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useAuth } from '../services/AuthContext';
import { VehicleBooking } from '../types';
import { VEHICLE_COLORS } from '../constants/colors';
import { getCommissionRates } from '../lib/commissions';

interface DetailedStats {
  totalVehicles: number;
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  totalDays: number;
  averagePerBooking: number;
}

const VehicleOwnerStatsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getMyVehicles } = useVehicles();
  const { getAllOwnerBookings } = useVehicleBookings();
  
  const [stats, setStats] = useState<DetailedStats>({
    totalVehicles: 0,
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    totalRevenue: 0,
    totalDays: 0,
    averagePerBooking: 0,
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<VehicleBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const loadStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Charger les véhicules et les réservations
      const userVehicles = await getMyVehicles();
      setVehicles(userVehicles);

      // Charger toutes les réservations de tous les véhicules du propriétaire
      const allBookingsData = await getAllOwnerBookings();
      setAllBookings(allBookingsData);

      // Filtrer par véhicule si nécessaire
      const filteredBookings = selectedVehicle === 'all'
        ? allBookingsData
        : allBookingsData.filter(b => b.vehicle_id === selectedVehicle);

      // Calculer les statistiques
      const completedBookings = filteredBookings.filter(b => 
        b.status === 'completed' || b.status === 'confirmed'
      );
      const pending = filteredBookings.filter(b => b.status === 'pending');
      const confirmed = filteredBookings.filter(b => 
        b.status === 'confirmed' || b.status === 'completed'
      );

      // Calculer les revenus nets (après déduction des commissions)
      const commissionRates = getCommissionRates('vehicle');
      const calculateNetEarnings = (booking: VehicleBooking) => {
        if (booking.status === 'cancelled') return 0;
        
        // Prix de base = daily_rate × rental_days
        const basePrice = (booking.daily_rate || 0) * (booking.rental_days || 0);
        // Appliquer la réduction si elle existe
        const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
        // Commission de 2% sur le prix APRÈS réduction
        const ownerCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
        return priceAfterDiscount - ownerCommission;
      };

      const totalRevenue = completedBookings.reduce((sum, b) => sum + calculateNetEarnings(b), 0);
      const totalDays = completedBookings.reduce((sum, b) => sum + (b.rental_days || 0), 0);
      const averagePerBooking = completedBookings.length > 0 
        ? totalRevenue / completedBookings.length 
        : 0;

      setStats({
        totalVehicles: userVehicles.length,
        totalBookings: filteredBookings.length,
        pendingBookings: pending.length,
        confirmedBookings: confirmed.length,
        totalRevenue,
        totalDays,
        averagePerBooking: Math.round(averagePerBooking),
      });

    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user, selectedVehicle]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const StatCard = ({ title, value, icon, color }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
          <Text style={styles.loadingText}>Chargement des statistiques...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculer les statistiques par véhicule
  const commissionRates = getCommissionRates('vehicle');
  const calculateNetEarnings = (booking: VehicleBooking) => {
    if (booking.status === 'cancelled') return 0;
    
    // Prix de base = daily_rate × rental_days
    const basePrice = (booking.daily_rate || 0) * (booking.rental_days || 0);
    // Appliquer la réduction si elle existe
    const priceAfterDiscount = basePrice - (booking.discount_amount || 0);
    // Commission de 2% sur le prix APRÈS réduction
    const ownerCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
    return priceAfterDiscount - ownerCommission;
  };

  const vehicleStats = vehicles.map(vehicle => {
    const vehicleBookings = allBookings.filter(b => 
      b.vehicle_id === vehicle.id && 
      (b.status === 'completed' || b.status === 'confirmed')
    );
    const vehicleRevenue = vehicleBookings.reduce((sum, b) => sum + calculateNetEarnings(b), 0);
    const vehicleDays = vehicleBookings.reduce((sum, b) => sum + (b.rental_days || 0), 0);

    return {
      ...vehicle,
      bookings: vehicleBookings.length,
      revenue: vehicleRevenue,
      days: vehicleDays,
    };
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>Statistiques</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadStats}
          disabled={loading}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color={VEHICLE_COLORS.primary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sélecteur de véhicule */}
        {vehicles.length > 1 && (
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Filtrer par véhicule</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowVehicleModal(true)}
            >
              <Text style={styles.filterButtonText}>
                {selectedVehicle === 'all' 
                  ? 'Tous les véhicules' 
                  : vehicles.find(v => v.id === selectedVehicle)?.title || 'Tous les véhicules'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* Statistiques principales */}
        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="Véhicules"
            value={stats.totalVehicles}
            icon="car-outline"
            color={VEHICLE_COLORS.primary}
          />
          
          <StatCard
            title="Réservations totales"
            value={stats.totalBookings}
            icon="calendar-outline"
            color="#3b82f6"
          />
          
          <StatCard
            title="Revenus nets totaux"
            value={formatPrice(stats.totalRevenue)}
            icon="cash-outline"
            color="#10b981"
          />
          
          <StatCard
            title="Jours de location"
            value={stats.totalDays}
            icon="time-outline"
            color="#8b5cf6"
          />
        </View>

        {/* Statistiques des réservations */}
        <Text style={styles.sectionTitle}>Réservations</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="En attente"
            value={stats.pendingBookings}
            icon="hourglass-outline"
            color="#f59e0b"
          />
          
          <StatCard
            title="Confirmées"
            value={stats.confirmedBookings}
            icon="checkmark-circle-outline"
            color="#10b981"
          />
          
          <StatCard
            title="Moyenne par réservation"
            value={formatPrice(stats.averagePerBooking)}
            icon="trending-up-outline"
            color="#8b5cf6"
          />
        </View>

        {/* Performance par véhicule */}
        {vehicleStats.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Performance par véhicule</Text>
            
            <View style={styles.vehicleStatsContainer}>
              {vehicleStats.map((vehicle) => {
                const mainImage = vehicle.images?.[0] || vehicle.photos?.[0]?.url;
                return (
                  <View key={vehicle.id} style={styles.vehicleStatCard}>
                    <View style={styles.vehicleStatHeader}>
                      {mainImage ? (
                        <Image source={{ uri: mainImage }} style={styles.vehicleStatImage} />
                      ) : (
                        <View style={[styles.vehicleStatImage, styles.vehicleStatImagePlaceholder]}>
                          <Ionicons name="car-outline" size={24} color="#ccc" />
                        </View>
                      )}
                      <View style={styles.vehicleStatInfo}>
                        <Text style={styles.vehicleStatTitle} numberOfLines={1}>
                          {vehicle.title}
                        </Text>
                        <Text style={styles.vehicleStatSubtitle}>
                          {vehicle.brand} {vehicle.model}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.vehicleStatDetails}>
                      <View style={styles.vehicleStatDetailItem}>
                        <Text style={styles.vehicleStatDetailValue}>
                          {formatPrice(vehicle.revenue)}
                        </Text>
                        <Text style={styles.vehicleStatDetailLabel}>Revenus nets</Text>
                      </View>
                      <View style={styles.vehicleStatDetailItem}>
                        <Text style={styles.vehicleStatDetailValue}>
                          {vehicle.bookings}
                        </Text>
                        <Text style={styles.vehicleStatDetailLabel}>Réservations</Text>
                      </View>
                      <View style={styles.vehicleStatDetailItem}>
                        <Text style={styles.vehicleStatDetailValue}>
                          {vehicle.days}
                        </Text>
                        <Text style={styles.vehicleStatDetailLabel}>Jours</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Résumé */}
        <View style={styles.summaryContainer}>
          <Ionicons name="trophy-outline" size={32} color="#475569" />
          <Text style={styles.summaryTitle}>Résumé des performances</Text>
          <Text style={styles.summaryText}>
            Vous gérez {stats.totalVehicles} véhicule{stats.totalVehicles > 1 ? 's' : ''} avec un total de {stats.totalBookings} réservation{stats.totalBookings > 1 ? 's' : ''}.
            {stats.totalRevenue > 0 && ` Vos revenus nets totaux s'élèvent à ${formatPrice(stats.totalRevenue)}.`}
          </Text>
        </View>
      </ScrollView>

      {/* Modal de sélection de véhicule */}
      <Modal
        visible={showVehicleModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un véhicule</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: 'all', title: 'Tous les véhicules' }, ...vehicles]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedVehicle === item.id && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedVehicle(item.id);
                    setShowVehicleModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedVehicle === item.id && styles.modalItemTextSelected
                  ]}>
                    {item.title}
                  </Text>
                  {selectedVehicle === item.id && (
                    <Ionicons name="checkmark" size={20} color="#475569" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  vehicleStatsContainer: {
    marginBottom: 20,
  },
  vehicleStatCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleStatImage: {
    width: 60,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  vehicleStatImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleStatInfo: {
    flex: 1,
  },
  vehicleStatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  vehicleStatSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  vehicleStatDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  vehicleStatDetailItem: {
    alignItems: 'center',
  },
  vehicleStatDetailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  vehicleStatDetailLabel: {
    fontSize: 12,
    color: '#666',
  },
  summaryContainer: {
    backgroundColor: '#f1f5f9',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginTop: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 10,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  filterButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemSelected: {
    backgroundColor: '#f1f5f9',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextSelected: {
    color: '#475569',
    fontWeight: '600',
  },
});

export default VehicleOwnerStatsScreen;

