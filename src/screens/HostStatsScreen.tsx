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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMyProperties } from '../hooks/useMyProperties';
import { useHostBookings } from '../hooks/useHostBookings';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { getCommissionRates } from '../lib/commissions';
import { calculateHostCommission } from '../hooks/usePricing';
import { calculateHostNetAmount } from '../lib/hostNetAmount';

interface DetailedStats {
  totalProperties: number;
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalVisitors: number;
  totalViews: number;
  occupancyRate: number;
  totalGuests: number;
  totalNights: number;
}

const HostStatsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getMyProperties } = useMyProperties();
  const { getHostBookings } = useHostBookings();
  
  const [stats, setStats] = useState<DetailedStats>({
    totalProperties: 0,
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    totalRevenue: 0,
    averageRating: 0,
    totalVisitors: 0,
    totalViews: 0,
    occupancyRate: 0,
    totalGuests: 0,
    totalNights: 0,
  });
  const [monthlyStats, setMonthlyStats] = useState<Record<string, DetailedStats>>({});
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);

  const loadDetailedStats = async (filterMonth?: string, propertyIdFilter?: string) => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Charger les propriétés et les bookings en parallèle pour améliorer les performances
      const [userProperties, allBookings] = await Promise.all([
        getMyProperties(),
        getHostBookings()
      ]);

      // Stocker les propriétés pour le sélecteur
      setProperties(userProperties);

      // Filtrer par propriété si sélectionné
      const propertyFilteredBookings = propertyIdFilter && propertyIdFilter !== 'all'
        ? allBookings.filter(booking => {
            const propertyId = (booking as any).property?.id || (booking as any).property_id;
            return propertyId === propertyIdFilter;
          })
        : allBookings;

      // Filtrer les réservations par mois si nécessaire
      const filteredBookings = filterMonth
        ? propertyFilteredBookings.filter(booking => {
            const bookingMonth = (booking as any).created_at?.slice(0, 7);
            return bookingMonth === filterMonth;
          })
        : propertyFilteredBookings;

      let totalBookingsCount = 0;
      let pendingBookingsCount = 0;
      let confirmedBookingsCount = 0;
      let revenue = 0;
      let totalRating = 0;
      let ratingCount = 0;
      let totalGuestsCount = 0;
      let totalNightsCount = 0;
      let totalVisitorsCount = 0;
      let totalViewsCount = 0;

      const propertyIds = propertyIdFilter && propertyIdFilter !== 'all'
        ? new Set([propertyIdFilter])
        : new Set(userProperties.map(p => p.id));

      const hostBookings = filteredBookings.filter(booking => {
        const propertyId = (booking as any).property?.id || (booking as any).property_id;
        return propertyId && propertyIds.has(propertyId);
      });

      totalBookingsCount = hostBookings.length;
      
      const pending = hostBookings.filter(booking => booking.status === 'pending');
      pendingBookingsCount = pending.length;
      
      const confirmed = hostBookings.filter(booking => 
        booking.status === 'confirmed' || booking.status === 'completed'
      );
      confirmedBookingsCount = confirmed.length;
      
      // Calculer les revenus nets - EXACTEMENT comme dans InvoiceDisplay.tsx (mobile)
      const commissionRates = getCommissionRates('property');
      const calculateNetEarnings = (booking: any) => {
        if (booking.status === 'cancelled') return 0;
        
        // Calculer le nombre de nuits
        let nights = 0;
        if ((booking as any).check_in_date && (booking as any).check_out_date) {
          const checkIn = new Date((booking as any).check_in_date);
          const checkOut = new Date((booking as any).check_out_date);
          nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        // Récupérer le prix par nuit depuis la propriété
        const pricePerNight = (booking as any).property?.price_per_night || 
                             (booking as any).properties?.price_per_night || 0;
        
        // Calculer le prix de base
        const basePrice = pricePerNight * nights;
        
        // Appliquer la réduction si elle existe
        const discountAmount = (booking as any).discount_amount || 0;
        const priceAfterDiscount = basePrice - discountAmount;
        
        // Frais de ménage - avec logique free_cleaning_min_days comme dans InvoiceDisplay
        let effectiveCleaningFee = (booking as any).property?.cleaning_fee || 
                                  (booking as any).properties?.cleaning_fee || 0;
        if ((booking as any).properties?.free_cleaning_min_days && nights >= (booking as any).properties.free_cleaning_min_days) {
          effectiveCleaningFee = 0;
        }
        
        // Taxe de séjour
        const taxesPerNight = (booking as any).property?.taxes || 
                             (booking as any).properties?.taxes || 0;
        const effectiveTaxes = taxesPerNight * nights;
        
        // Utiliser host_net_amount stocké si disponible, sinon utiliser la fonction centralisée
        if ((booking as any).host_net_amount !== undefined && (booking as any).host_net_amount !== null) {
          return (booking as any).host_net_amount;
        }
        
        // Utiliser la fonction centralisée pour les anciennes réservations
        return calculateHostNetAmount({
          pricePerNight: pricePerNight,
          nights: nights,
          discountAmount: discountAmount,
          cleaningFee: effectiveCleaningFee,
          taxesPerNight: taxesPerNight,
          freeCleaningMinDays: (booking as any).properties?.free_cleaning_min_days || null,
          status: (booking as any).status || 'confirmed',
          serviceType: 'property',
        }).hostNetAmount;
      };

      confirmed.forEach(booking => {
        // Utiliser le calcul des revenus nets au lieu du total_price brut
        const netEarnings = calculateNetEarnings(booking);
        revenue += netEarnings;
        totalGuestsCount += (booking as any).guests_count || 0;
        
        if ((booking as any).check_in_date && (booking as any).check_out_date) {
          const checkIn = new Date((booking as any).check_in_date);
          const checkOut = new Date((booking as any).check_out_date);
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          totalNightsCount += nights;
        }
      });

      for (const property of userProperties) {
        // Filtrer par propriété si nécessaire
        if (propertyIdFilter && propertyIdFilter !== 'all' && property.id !== propertyIdFilter) {
          continue;
        }

        try {
          // Requête pour les vues avec filtre de mois si nécessaire
          const viewsQuery = supabase
            .from('property_views')
            .select('viewer_id, viewed_at')
            .eq('property_id', property.id);

          // Ajouter le filtre mensuel si nécessaire
          if (filterMonth) {
            const startOfMonth = new Date(`${filterMonth}-01`);
            const endOfMonth = new Date(startOfMonth);
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            
            viewsQuery
              .gte('viewed_at', startOfMonth.toISOString())
              .lt('viewed_at', endOfMonth.toISOString());
          }

          const { data: views } = await viewsQuery;

          const uniqueViewers = views ? new Set(
            views
              .filter(v => v.viewer_id !== null)
              .map(v => v.viewer_id)
          ).size : 0;

          const propertyViews = views?.length || 0;
          totalVisitorsCount += uniqueViewers;
          totalViewsCount += propertyViews;
        } catch (error) {
          console.log('Erreur lors du chargement des vues:', error);
        }

        if (property.rating && property.rating > 0) {
          totalRating += property.rating;
          ratingCount++;
        }
      }

      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
      const totalAvailableNights = userProperties.length * 365;
      const occupancyRate = totalAvailableNights > 0 ? (totalNightsCount / totalAvailableNights) * 100 : 0;

      const finalStats = {
        totalProperties: userProperties.length,
        totalBookings: totalBookingsCount,
        pendingBookings: pendingBookingsCount,
        confirmedBookings: confirmedBookingsCount,
        totalRevenue: revenue,
        averageRating: Math.round(averageRating * 10) / 10,
        totalVisitors: totalVisitorsCount,
        totalViews: totalViewsCount,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        totalGuests: totalGuestsCount,
        totalNights: totalNightsCount,
      };

      if (filterMonth) {
        setMonthlyStats(prev => ({ ...prev, [filterMonth]: finalStats }));
      } else {
        setStats(finalStats);
      }

    } catch (error) {
      console.error('Erreur lors du chargement des statistiques détaillées:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDetailedStats(undefined, selectedPropertyId);
    }
  }, [user, selectedPropertyId]);

  useEffect(() => {
    if (user && viewMode === 'monthly') {
      loadDetailedStats(selectedMonth, selectedPropertyId);
    }
  }, [selectedMonth, viewMode, selectedPropertyId]);

  useEffect(() => {
    if (user && viewMode === 'monthly' && selectedMonth) {
      if (!monthlyStats[selectedMonth]) {
        loadDetailedStats(selectedMonth, selectedPropertyId);
      }
    }
  }, [viewMode, selectedMonth, user, selectedPropertyId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const StatCard = ({ title, value, icon, color, subtitle }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    subtitle?: string;
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <View style={styles.statIconContainer}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
          {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  );

  const currentStats = viewMode === 'monthly' && selectedMonth 
    ? (monthlyStats[selectedMonth] || stats)
    : stats;

  const getLastMonths = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(date.toISOString().slice(0, 7));
    }
    return months;
  };

  const formatMonthLabel = (month: string) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  if (loading && viewMode === 'annual') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement des statistiques...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.placeholder} />
        <Text style={styles.headerTitle}>Statistiques détaillées</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => loadDetailedStats(viewMode === 'monthly' ? selectedMonth : undefined, selectedPropertyId)}
          disabled={loading}
        >
          <Ionicons 
            name="refresh" 
            size={24} 
            color="#2E7D32" 
            style={loading ? { transform: [{ rotate: '0deg' }] } : undefined}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sélecteur de propriété */}
        {properties.length > 1 && (
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Filtrer par propriété</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowPropertyModal(true)}
            >
              <Text style={styles.filterButtonText}>
                {selectedPropertyId === 'all' 
                  ? 'Toutes les propriétés' 
                  : properties.find(p => p.id === selectedPropertyId)?.title || 'Toutes les propriétés'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* Onglets Annuel / Mensuel */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'annual' && styles.tabActive]}
            onPress={() => setViewMode('annual')}
          >
            <Text style={[styles.tabText, viewMode === 'annual' && styles.tabTextActive]}>
              Vue annuelle
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'monthly' && styles.tabActive]}
            onPress={() => setViewMode('monthly')}
          >
            <Text style={[styles.tabText, viewMode === 'monthly' && styles.tabTextActive]}>
              Vue mensuelle
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sélecteur de mois pour la vue mensuelle */}
        {viewMode === 'monthly' && (
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Sélectionner un mois</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowMonthModal(true)}
            >
              <Text style={styles.filterButtonText}>
                {formatMonthLabel(selectedMonth)}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {loading && viewMode === 'monthly' ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Chargement des statistiques...</Text>
          </View>
        ) : (
          <>
            {/* Statistiques principales */}
            <Text style={styles.sectionTitle}>
              {viewMode === 'monthly' 
                ? `Statistiques de ${formatMonthLabel(selectedMonth)}`
                : 'Vue d\'ensemble'}
            </Text>
        
        <View style={styles.statsContainer}>
          {viewMode === 'annual' && (
            <StatCard
              title="Propriétés"
              value={currentStats.totalProperties}
              icon="home-outline"
              color="#2E7D32"
            />
          )}
          
          <StatCard
            title={viewMode === 'monthly' ? 'Réservations du mois' : 'Réservations totales'}
            value={currentStats.totalBookings}
            icon="calendar-outline"
            color="#3498db"
          />
          
          <StatCard
            title={viewMode === 'monthly' ? 'Revenus nets du mois' : 'Revenus nets totaux'}
            value={formatPrice(currentStats.totalRevenue)}
            icon="cash-outline"
            color="#e67e22"
          />
          
          {viewMode === 'annual' && (
            <StatCard
              title="Note moyenne"
              value={`${currentStats.averageRating}/5`}
              icon="star-outline"
              color="#9b59b6"
            />
          )}
        </View>

        {/* Statistiques des réservations */}
        <Text style={styles.sectionTitle}>Réservations</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="En attente"
            value={currentStats.pendingBookings}
            icon="time-outline"
            color="#f39c12"
          />
          
          <StatCard
            title="Confirmées"
            value={currentStats.confirmedBookings}
            icon="checkmark-circle-outline"
            color="#27ae60"
          />
          
          <StatCard
            title={viewMode === 'monthly' ? 'Voyageurs du mois' : 'Total invités'}
            value={currentStats.totalGuests}
            icon="people-outline"
            color="#8e44ad"
          />
          
          <StatCard
            title={viewMode === 'monthly' ? 'Nuits réservées' : 'Nuits totales'}
            value={currentStats.totalNights}
            icon="bed-outline"
            color="#16a085"
          />
        </View>

        {/* Statistiques de visibilité */}
        {viewMode === 'annual' && (
          <>
            <Text style={styles.sectionTitle}>Visibilité</Text>
            
            <View style={styles.statsContainer}>
              <StatCard
                title="Visiteurs uniques"
                value={currentStats.totalVisitors}
                icon="eye-outline"
                color="#e74c3c"
                subtitle="Personnes ayant vu vos propriétés"
              />
              
              <StatCard
                title="Vues totales"
                value={currentStats.totalViews}
                icon="analytics-outline"
                color="#f39c12"
                subtitle="Nombre total de consultations"
              />
              
              <StatCard
                title="Taux d'occupation"
                value={`${currentStats.occupancyRate}%`}
                icon="trending-up-outline"
                color="#2ecc71"
                subtitle="Pourcentage de nuits occupées"
              />
            </View>
          </>
        )}

        {viewMode === 'monthly' && (
          <>
            <Text style={styles.sectionTitle}>Visibilité</Text>
            
            <View style={styles.statsContainer}>
              <StatCard
                title="Visiteurs uniques du mois"
                value={currentStats.totalVisitors}
                icon="eye-outline"
                color="#e74c3c"
                subtitle="Personnes ayant vu vos propriétés"
              />
              
              <StatCard
                title="Vues du mois"
                value={currentStats.totalViews}
                icon="analytics-outline"
                color="#f39c12"
                subtitle="Nombre de consultations"
              />
            </View>
          </>
        )}

        {/* Résumé des performances */}
        {viewMode === 'annual' ? (
          <View style={styles.summaryContainer}>
            <Ionicons name="trophy-outline" size={32} color="#f39c12" />
            <Text style={styles.summaryTitle}>Résumé des performances</Text>
            <Text style={styles.summaryText}>
              Vous gérez {currentStats.totalProperties} propriété{currentStats.totalProperties > 1 ? 's' : ''} avec un taux d'occupation de {currentStats.occupancyRate}%.
              {currentStats.totalVisitors > 0 && ` Vos propriétés ont été vues par ${currentStats.totalVisitors} visiteurs uniques.`}
              {currentStats.averageRating > 0 && ` Votre note moyenne est de ${currentStats.averageRating}/5.`}
            </Text>
          </View>
        ) : (
          <View style={[styles.summaryContainer, { backgroundColor: '#e3f2fd', borderColor: '#90caf9' }]}>
            <Text style={[styles.summaryTitle, { color: '#1976d2' }]}>Résumé mensuel</Text>
            <Text style={[styles.summaryText, { color: '#1565c0' }]}>
              Ce mois, vous avez généré {formatPrice(currentStats.totalRevenue)} avec {currentStats.totalBookings} réservation{currentStats.totalBookings > 1 ? 's' : ''} 
              {currentStats.totalGuests > 0 && ` et accueilli ${currentStats.totalGuests} invité${currentStats.totalGuests > 1 ? 's' : ''}`}.
            </Text>
          </View>
        )}
          </>
        )}
      </ScrollView>

      {/* Modal de sélection de propriété */}
      <Modal
        visible={showPropertyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPropertyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner une propriété</Text>
              <TouchableOpacity onPress={() => setShowPropertyModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: 'all', title: 'Toutes les propriétés' }, ...properties]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedPropertyId === item.id && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedPropertyId(item.id);
                    setShowPropertyModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedPropertyId === item.id && styles.modalItemTextSelected
                  ]}>
                    {item.title}
                  </Text>
                  {selectedPropertyId === item.id && (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de sélection de mois */}
      <Modal
        visible={showMonthModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner un mois</Text>
              <TouchableOpacity onPress={() => setShowMonthModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={getLastMonths()}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedMonth === item && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedMonth(item);
                    setShowMonthModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    selectedMonth === item && styles.modalItemTextSelected
                  ]}>
                    {formatMonthLabel(item)}
                  </Text>
                  {selectedMonth === item && (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
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
    backgroundColor: '#f8f9fa',
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
  statSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  summaryContainer: {
    backgroundColor: '#fff3cd',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    marginTop: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginTop: 10,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#856404',
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#2E7D32',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
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
    backgroundColor: '#e8f5e9',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalItemTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
});

export default HostStatsScreen;
