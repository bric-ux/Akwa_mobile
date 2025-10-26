import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMyProperties } from '../hooks/useMyProperties';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';

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
  const { getMyProperties, getPropertyBookings } = useMyProperties();
  
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
  const [loading, setLoading] = useState(true);

  const loadDetailedStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Charger les propriétés
      const userProperties = await getMyProperties();

      // Calculer les statistiques
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

      // Charger les statistiques pour chaque propriété
      for (const property of userProperties) {
        // Réservations
        const bookings = await getPropertyBookings(property.id);
        totalBookingsCount += bookings.length;
        
        const pending = bookings.filter(booking => booking.status === 'pending');
        pendingBookingsCount += pending.length;
        
        const confirmed = bookings.filter(booking => 
          booking.status === 'confirmed' || booking.status === 'completed'
        );
        confirmedBookingsCount += confirmed.length;
        
        confirmed.forEach(booking => {
          revenue += booking.total_price || 0;
          totalGuestsCount += (booking.adults_count || 0) + (booking.children_count || 0);
          
          // Calculer les nuits
          if (booking.check_in_date && booking.check_out_date) {
            const checkIn = new Date(booking.check_in_date);
            const checkOut = new Date(booking.check_out_date);
            const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
            totalNightsCount += nights;
          }
        });

        // Vues et visiteurs
        try {
          const { data: views } = await supabase
            .from('property_views')
            .select('viewer_id, viewed_at')
            .eq('property_id', property.id);

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

        // Calculer la note moyenne
        if (property.rating && property.rating > 0) {
          totalRating += property.rating;
          ratingCount++;
        }
      }

      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
      
      // Calculer le taux d'occupation (approximation)
      const totalAvailableNights = userProperties.length * 365; // Approximation
      const occupancyRate = totalAvailableNights > 0 ? (totalNightsCount / totalAvailableNights) * 100 : 0;

      setStats({
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
      });

    } catch (error) {
      console.error('Erreur lors du chargement des statistiques détaillées:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDetailedStats();
    }
  }, [user]);

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

  if (loading) {
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistiques détaillées</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadDetailedStats}
        >
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statistiques principales */}
        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="Propriétés"
            value={stats.totalProperties}
            icon="home-outline"
            color="#2E7D32"
          />
          
          <StatCard
            title="Réservations totales"
            value={stats.totalBookings}
            icon="calendar-outline"
            color="#3498db"
          />
          
          <StatCard
            title="Revenus totaux"
            value={formatPrice(stats.totalRevenue)}
            icon="cash-outline"
            color="#e67e22"
          />
          
          <StatCard
            title="Note moyenne"
            value={`${stats.averageRating}/5`}
            icon="star-outline"
            color="#9b59b6"
          />
        </View>

        {/* Statistiques des réservations */}
        <Text style={styles.sectionTitle}>Réservations</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="En attente"
            value={stats.pendingBookings}
            icon="time-outline"
            color="#f39c12"
          />
          
          <StatCard
            title="Confirmées"
            value={stats.confirmedBookings}
            icon="checkmark-circle-outline"
            color="#27ae60"
          />
          
          <StatCard
            title="Total invités"
            value={stats.totalGuests}
            icon="people-outline"
            color="#8e44ad"
          />
          
          <StatCard
            title="Nuits totales"
            value={stats.totalNights}
            icon="bed-outline"
            color="#16a085"
          />
        </View>

        {/* Statistiques de visibilité */}
        <Text style={styles.sectionTitle}>Visibilité</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="Visiteurs uniques"
            value={stats.totalVisitors}
            icon="eye-outline"
            color="#e74c3c"
            subtitle="Personnes ayant vu vos propriétés"
          />
          
          <StatCard
            title="Vues totales"
            value={stats.totalViews}
            icon="analytics-outline"
            color="#f39c12"
            subtitle="Nombre total de consultations"
          />
          
          <StatCard
            title="Taux d'occupation"
            value={`${stats.occupancyRate}%`}
            icon="trending-up-outline"
            color="#2ecc71"
            subtitle="Pourcentage de nuits occupées"
          />
        </View>

        {/* Résumé des performances */}
        <View style={styles.summaryContainer}>
          <Ionicons name="trophy-outline" size={32} color="#f39c12" />
          <Text style={styles.summaryTitle}>Résumé des performances</Text>
          <Text style={styles.summaryText}>
            Vous gérez {stats.totalProperties} propriété{stats.totalProperties > 1 ? 's' : ''} avec un taux d'occupation de {stats.occupancyRate}%.
            {stats.totalVisitors > 0 && ` Vos propriétés ont été vues par ${stats.totalVisitors} visiteurs uniques.`}
            {stats.averageRating > 0 && ` Votre note moyenne est de ${stats.averageRating}/5.`}
          </Text>
        </View>
      </ScrollView>
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
});

export default HostStatsScreen;
