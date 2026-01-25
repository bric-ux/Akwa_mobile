import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { getCommissionRates } from '../lib/commissions';
import { formatPrice } from '../utils/priceCalculator';

interface BookingRevenue {
  id: string;
  type: 'property' | 'vehicle';
  booking_id: string;
  service_fee: number;
  host_commission: number;
  total_revenue: number;
  booking_date: string;
  check_in_date?: string;
  check_out_date?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  total_price: number;
  discount_amount?: number;
  property?: {
    id: string;
    title: string;
    price_per_night: number;
  };
  vehicle?: {
    id: string;
    title: string;
    brand: string;
    model: string;
    price_per_day: number;
  };
  guest?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  host?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface RevenueStats {
  totalRevenue: number;
  propertyRevenue: number;
  vehicleRevenue: number;
  totalBookings: number;
  propertyBookings: number;
  vehicleBookings: number;
  averageRevenuePerBooking: number;
}

const AdminRevenueScreen: React.FC = () => {
  const navigation = useNavigation();
  const [revenues, setRevenues] = useState<BookingRevenue[]>([]);
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    propertyRevenue: 0,
    vehicleRevenue: 0,
    totalBookings: 0,
    propertyBookings: 0,
    vehicleBookings: 0,
    averageRevenuePerBooking: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'property' | 'vehicle'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingRevenue | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');

  useEffect(() => {
    loadRevenues();
  }, [typeFilter, statusFilter, dateFilter]);

  const calculateRevenue = (booking: any, type: 'property' | 'vehicle'): BookingRevenue => {
    const commissionRates = getCommissionRates(type);
    
    // Calculer le prix de base
    let basePrice = 0;
    let nights = 0;
    
    if (type === 'property') {
      const checkIn = new Date(booking.check_in_date);
      const checkOut = new Date(booking.check_out_date);
      nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const pricePerNight = booking.properties?.price_per_night || 0;
      basePrice = pricePerNight * nights;
    } else {
      nights = booking.rental_days || 0;
      const pricePerDay = booking.vehicles?.price_per_day || booking.daily_rate || 0;
      basePrice = pricePerDay * nights;
    }
    
    // Appliquer la réduction (discount_amount n'existe pas dans vehicle_bookings)
    const discountAmount = 0; // Pas de réduction pour les véhicules pour l'instant
    const priceAfterDiscount = basePrice - discountAmount;
    
    // Calculer les commissions
    const serviceFee = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
    const hostCommission = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
    const totalRevenue = serviceFee + hostCommission;
    
    return {
      id: booking.id,
      type,
      booking_id: booking.id,
      service_fee: serviceFee,
      host_commission: hostCommission,
      total_revenue: totalRevenue,
      booking_date: booking.created_at,
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      start_date: booking.start_date,
      end_date: booking.end_date,
      status: booking.status,
      total_price: booking.total_price || 0,
      discount_amount: discountAmount,
      property: booking.properties,
      vehicle: booking.vehicles,
      guest: booking.guest_profile,
      host: booking.host_profile,
    };
  };

  const loadRevenues = async () => {
    try {
      setLoading(true);
      
      // Récupérer les réservations de propriétés
      let propertyQuery = supabase
        .from('bookings')
        .select(`
          id,
          check_in_date,
          check_out_date,
          total_price,
          discount_amount,
          status,
          created_at,
          properties!inner(
            id,
            title,
            price_per_night,
            host_id
          )
        `)
        .in('status', ['confirmed', 'completed', 'cancelled'])
        .order('created_at', { ascending: false });

      // Appliquer les filtres
      if (statusFilter !== 'all') {
        propertyQuery = propertyQuery.eq('status', statusFilter);
      }

      // Filtre par date
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (dateFilter) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        propertyQuery = propertyQuery.gte('created_at', startDate.toISOString());
      }

      const { data: propertyBookings, error: propertyError } = await propertyQuery;

      if (propertyError) {
        console.error('Erreur chargement réservations propriétés:', propertyError);
      }

      // Récupérer les réservations de véhicules
      let vehicleQuery = supabase
        .from('vehicle_bookings')
        .select(`
          id,
          start_date,
          end_date,
          total_price,
          daily_rate,
          rental_days,
          status,
          created_at,
          renter_id,
          vehicles!inner(
            id,
            title,
            brand,
            model,
            price_per_day,
            owner_id
          )
        `)
        .in('status', ['confirmed', 'completed', 'cancelled'])
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        vehicleQuery = vehicleQuery.eq('status', statusFilter);
      }

      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (dateFilter) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        vehicleQuery = vehicleQuery.gte('created_at', startDate.toISOString());
      }

      const { data: vehicleBookings, error: vehicleError } = await vehicleQuery;

      if (vehicleError) {
        console.error('Erreur chargement réservations véhicules:', vehicleError);
      }

      // Enrichir avec les profils
      const allBookings: BookingRevenue[] = [];
      
      // Traiter les réservations de propriétés
      if (propertyBookings && (typeFilter === 'all' || typeFilter === 'property')) {
        for (const booking of propertyBookings) {
          // Récupérer le profil du client
          const { data: guestProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', booking.guest_id)
            .single();

          // Récupérer le profil de l'hôte
          const { data: hostProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', booking.properties.host_id)
            .single();

          const revenue = calculateRevenue(
            {
              ...booking,
              guest_profile: guestProfile,
              host_profile: hostProfile,
            },
            'property'
          );
          allBookings.push(revenue);
        }
      }

      // Traiter les réservations de véhicules
      if (vehicleBookings && (typeFilter === 'all' || typeFilter === 'vehicle')) {
        for (const booking of vehicleBookings) {
          // Récupérer le profil du locataire
          const { data: renterProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', booking.renter_id)
            .single();

          // Récupérer le profil du propriétaire
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', booking.vehicles.owner_id)
            .single();

          const revenue = calculateRevenue(
            {
              ...booking,
              guest_profile: renterProfile,
              host_profile: ownerProfile,
            },
            'vehicle'
          );
          allBookings.push(revenue);
        }
      }

      // Trier par date de création (plus récent en premier)
      allBookings.sort((a, b) => 
        new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime()
      );

      setRevenues(allBookings);

      // Calculer les statistiques
      const propertyRevs = allBookings.filter(r => r.type === 'property');
      const vehicleRevs = allBookings.filter(r => r.type === 'vehicle');
      
      const totalRevenue = allBookings.reduce((sum, r) => sum + r.total_revenue, 0);
      const propertyRevenue = propertyRevs.reduce((sum, r) => sum + r.total_revenue, 0);
      const vehicleRevenue = vehicleRevs.reduce((sum, r) => sum + r.total_revenue, 0);

      setStats({
        totalRevenue,
        propertyRevenue,
        vehicleRevenue,
        totalBookings: allBookings.length,
        propertyBookings: propertyRevs.length,
        vehicleBookings: vehicleRevs.length,
        averageRevenuePerBooking: allBookings.length > 0 ? totalRevenue / allBookings.length : 0,
      });

    } catch (error) {
      console.error('Erreur chargement revenus:', error);
      Alert.alert('Erreur', 'Impossible de charger les revenus');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRevenues();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#10b981';
      case 'completed':
        return '#3b82f6';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmée';
      case 'completed':
        return 'Terminée';
      case 'cancelled':
        return 'Annulée';
      default:
        return status;
    }
  };

  const handleViewDetails = (revenue: BookingRevenue) => {
    setSelectedBooking(revenue);
    setDetailsModalVisible(true);
  };

  const handleNavigateToBooking = (revenue: BookingRevenue) => {
    setDetailsModalVisible(false);
    if (revenue.type === 'property') {
      navigation.navigate('PropertyBookingDetails' as never, { bookingId: revenue.booking_id } as never);
    } else {
      navigation.navigate('VehicleBookingDetails' as never, { bookingId: revenue.booking_id } as never);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Revenus AkwaHome</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revenus AkwaHome</Text>
        <TouchableOpacity onPress={loadRevenues} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Statistiques */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Ionicons name="cash-outline" size={32} color="#2E7D32" />
            <Text style={styles.statValue}>{formatPrice(stats.totalRevenue)}</Text>
            <Text style={styles.statLabel}>Revenus totaux</Text>
          </View>
          
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardSecondary]}>
              <Ionicons name="home-outline" size={24} color="#3498db" />
              <Text style={styles.statValueSmall}>{formatPrice(stats.propertyRevenue)}</Text>
              <Text style={styles.statLabelSmall}>Résidences ({stats.propertyBookings})</Text>
            </View>
            
            <View style={[styles.statCard, styles.statCardSecondary]}>
              <Ionicons name="car-outline" size={24} color="#e67e22" />
              <Text style={styles.statValueSmall}>{formatPrice(stats.vehicleRevenue)}</Text>
              <Text style={styles.statLabelSmall}>Véhicules ({stats.vehicleBookings})</Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.statCardInfo]}>
            <Ionicons name="trending-up-outline" size={24} color="#9b59b6" />
            <Text style={styles.statValueSmall}>
              {formatPrice(stats.averageRevenuePerBooking)}
            </Text>
            <Text style={styles.statLabelSmall}>Moyenne par réservation</Text>
          </View>
        </View>

        {/* Filtres */}
        <View style={styles.filtersContainer}>
          <Text style={styles.filterSectionTitle}>Type de service</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterButton, typeFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setTypeFilter('all')}
            >
              <Text style={[styles.filterText, typeFilter === 'all' && styles.filterTextActive]}>
                Tous
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, typeFilter === 'property' && styles.filterButtonActive]}
              onPress={() => setTypeFilter('property')}
            >
              <Ionicons 
                name="home-outline" 
                size={16} 
                color={typeFilter === 'property' ? '#fff' : '#666'} 
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.filterText, typeFilter === 'property' && styles.filterTextActive]}>
                Résidences
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, typeFilter === 'vehicle' && styles.filterButtonActive]}
              onPress={() => setTypeFilter('vehicle')}
            >
              <Ionicons 
                name="car-outline" 
                size={16} 
                color={typeFilter === 'vehicle' ? '#fff' : '#666'} 
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.filterText, typeFilter === 'vehicle' && styles.filterTextActive]}>
                Véhicules
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <Text style={styles.filterSectionTitle}>Statut</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.filterText, statusFilter === 'all' && styles.filterTextActive]}>
                Tous
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'confirmed' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('confirmed')}
            >
              <Text style={[styles.filterText, statusFilter === 'confirmed' && styles.filterTextActive]}>
                Confirmées
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'completed' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('completed')}
            >
              <Text style={[styles.filterText, statusFilter === 'completed' && styles.filterTextActive]}>
                Terminées
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, statusFilter === 'cancelled' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('cancelled')}
            >
              <Text style={[styles.filterText, statusFilter === 'cancelled' && styles.filterTextActive]}>
                Annulées
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <Text style={styles.filterSectionTitle}>Période</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterButton, dateFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setDateFilter('all')}
            >
              <Text style={[styles.filterText, dateFilter === 'all' && styles.filterTextActive]}>
                Toutes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, dateFilter === 'today' && styles.filterButtonActive]}
              onPress={() => setDateFilter('today')}
            >
              <Text style={[styles.filterText, dateFilter === 'today' && styles.filterTextActive]}>
                Aujourd'hui
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, dateFilter === 'week' && styles.filterButtonActive]}
              onPress={() => setDateFilter('week')}
            >
              <Text style={[styles.filterText, dateFilter === 'week' && styles.filterTextActive]}>
                7 jours
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, dateFilter === 'month' && styles.filterButtonActive]}
              onPress={() => setDateFilter('month')}
            >
              <Text style={[styles.filterText, dateFilter === 'month' && styles.filterTextActive]}>
                30 jours
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, dateFilter === 'year' && styles.filterButtonActive]}
              onPress={() => setDateFilter('year')}
            >
              <Text style={[styles.filterText, dateFilter === 'year' && styles.filterTextActive]}>
                1 an
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Liste des revenus */}
        <Text style={styles.sectionTitle}>
          Réservations ({revenues.length})
        </Text>

        {revenues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Aucune réservation trouvée</Text>
            <Text style={styles.emptySubtext}>Ajustez les filtres pour voir plus de résultats</Text>
          </View>
        ) : (
          revenues.map((revenue) => {
            const statusColor = getStatusColor(revenue.status);
            const title = revenue.type === 'property' 
              ? revenue.property?.title 
              : `${revenue.vehicle?.brand} ${revenue.vehicle?.model}`;

            return (
              <TouchableOpacity
                key={revenue.id}
                style={styles.revenueCard}
                onPress={() => handleViewDetails(revenue)}
              >
                <View style={styles.revenueHeader}>
                  <View style={styles.revenueTitleContainer}>
                    <Ionicons 
                      name={revenue.type === 'property' ? 'home-outline' : 'car-outline'} 
                      size={20} 
                      color={revenue.type === 'property' ? '#3498db' : '#e67e22'} 
                    />
                    <View style={styles.revenueTitleText}>
                      <Text style={styles.revenueTitle} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.revenueType}>
                        {revenue.type === 'property' ? 'Résidence meublée' : 'Location de véhicule'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusLabel(revenue.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.revenueDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color="#666" />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {revenue.guest?.first_name} {revenue.guest?.last_name}
                    </Text>
                  </View>
                  
                  {(revenue.check_in_date || revenue.start_date) && (
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        {revenue.type === 'property' 
                          ? `${formatDate(revenue.check_in_date || '')} - ${formatDate(revenue.check_out_date || '')}`
                          : `${formatDate(revenue.start_date || '')} - ${formatDate(revenue.end_date || '')}`
                        }
                      </Text>
                    </View>
                  )}

                  <View style={styles.revenueBreakdown}>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Frais de service</Text>
                      <Text style={styles.breakdownValue}>
                        {formatPrice(revenue.service_fee)}
                      </Text>
                    </View>
                    <View style={styles.breakdownItem}>
                      <Text style={styles.breakdownLabel}>Commission hôte</Text>
                      <Text style={styles.breakdownValue}>
                        {formatPrice(revenue.host_commission)}
                      </Text>
                    </View>
                    <View style={[styles.breakdownItem, styles.breakdownTotal]}>
                      <Text style={styles.breakdownLabelTotal}>Revenu total</Text>
                      <Text style={styles.breakdownValueTotal}>
                        {formatPrice(revenue.total_revenue)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.viewDetailsButton}>
                  <Text style={styles.viewDetailsText}>Voir les détails</Text>
                  <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal de détails */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails de la réservation</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedBooking && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Informations générales</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Type</Text>
                    <View style={styles.infoValueContainer}>
                      <Ionicons 
                        name={selectedBooking.type === 'property' ? 'home-outline' : 'car-outline'} 
                        size={16} 
                        color={selectedBooking.type === 'property' ? '#3498db' : '#e67e22'} 
                      />
                      <Text style={styles.infoValue}>
                        {selectedBooking.type === 'property' ? 'Résidence meublée' : 'Location de véhicule'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Titre</Text>
                    <Text style={styles.infoValue}>
                      {selectedBooking.type === 'property' 
                        ? selectedBooking.property?.title 
                        : `${selectedBooking.vehicle?.brand} ${selectedBooking.vehicle?.model}`
                      }
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Statut</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedBooking.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(selectedBooking.status) }]}>
                        {getStatusLabel(selectedBooking.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date de réservation</Text>
                    <Text style={styles.infoValue}>{formatDate(selectedBooking.booking_date)}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Dates</Text>
                  {selectedBooking.type === 'property' ? (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Arrivée</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedBooking.check_in_date || '')}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Départ</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedBooking.check_out_date || '')}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Début</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedBooking.start_date || '')}
                        </Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Fin</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(selectedBooking.end_date || '')}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Client</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nom</Text>
                    <Text style={styles.infoValue}>
                      {selectedBooking.guest?.first_name} {selectedBooking.guest?.last_name}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>
                      {selectedBooking.guest?.email || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Hôte/Propriétaire</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Nom</Text>
                    <Text style={styles.infoValue}>
                      {selectedBooking.host?.first_name} {selectedBooking.host?.last_name}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>
                      {selectedBooking.host?.email || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Revenus AkwaHome</Text>
                  <View style={styles.revenueDetailsModal}>
                    <View style={styles.revenueRow}>
                      <Text style={styles.revenueLabel}>Frais de service</Text>
                      <Text style={styles.revenueAmount}>
                        {formatPrice(selectedBooking.service_fee)}
                      </Text>
                    </View>
                    <View style={styles.revenueRow}>
                      <Text style={styles.revenueLabel}>Commission hôte</Text>
                      <Text style={styles.revenueAmount}>
                        {formatPrice(selectedBooking.host_commission)}
                      </Text>
                    </View>
                    <View style={[styles.revenueRow, styles.revenueRowTotal]}>
                      <Text style={styles.revenueLabelTotal}>Revenu total AkwaHome</Text>
                      <Text style={styles.revenueAmountTotal}>
                        {formatPrice(selectedBooking.total_revenue)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Informations financières</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Prix total payé</Text>
                    <Text style={styles.infoValue}>
                      {formatPrice(selectedBooking.total_price)}
                    </Text>
                  </View>
                  {selectedBooking.discount_amount && selectedBooking.discount_amount > 0 && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Réduction appliquée</Text>
                      <Text style={[styles.infoValue, styles.discountValue]}>
                        -{formatPrice(selectedBooking.discount_amount)}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.viewFullDetailsButton}
                  onPress={() => handleNavigateToBooking(selectedBooking)}
                >
                  <Ionicons name="document-text-outline" size={20} color="#fff" />
                  <Text style={styles.viewFullDetailsText}>Voir la réservation complète</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardPrimary: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  statCardSecondary: {
    flex: 1,
    padding: 16,
  },
  statCardInfo: {
    backgroundColor: '#f3e5f5',
    borderWidth: 1,
    borderColor: '#9b59b6',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 8,
  },
  statValueSmall: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  statLabelSmall: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  filterScroll: {
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
    textAlign: 'center',
  },
  revenueCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  revenueTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  revenueTitleText: {
    flex: 1,
    marginLeft: 8,
  },
  revenueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  revenueType: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  revenueDetails: {
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
    flex: 1,
  },
  revenueBreakdown: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#666',
  },
  breakdownValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  breakdownLabelTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  breakdownValueTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  viewDetailsText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginRight: 4,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  discountValue: {
    color: '#ef4444',
  },
  revenueDetailsModal: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  revenueRowTotal: {
    borderTopWidth: 2,
    borderTopColor: '#2E7D32',
    marginTop: 8,
    paddingTop: 12,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#666',
  },
  revenueAmount: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  revenueLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  revenueAmountTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  viewFullDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  viewFullDetailsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AdminRevenueScreen;

