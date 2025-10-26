import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin, DashboardStats } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';

const AdminStatsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getDashboardStats, loading } = useAdmin();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const dashboardStats = await getDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadStats();
      }
    }, [user])
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const StatCard = ({ title, value, icon, color, onPress }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statContent}>
        <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={20} color="#ccc" />}
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Accès non autorisé</Text>
          <Text style={styles.emptySubtitle}>Vous devez être connecté pour accéder à cette page</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingStats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
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
        <TouchableOpacity style={styles.refreshButton} onPress={loadStats}>
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vue d'ensemble */}
        <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="Utilisateurs totaux"
            value={stats?.totalUsers || 0}
            icon="people-outline"
            color="#3498db"
          />
          
          <StatCard
            title="Propriétés totales"
            value={stats?.totalProperties || 0}
            icon="home-outline"
            color="#2E7D32"
          />
          
          <StatCard
            title="Réservations totales"
            value={stats?.totalBookings || 0}
            icon="calendar-outline"
            color="#f39c12"
          />
          
          <StatCard
            title="Revenus totaux"
            value={formatPrice(stats?.totalRevenue || 0)}
            icon="cash-outline"
            color="#e67e22"
          />
        </View>

        {/* Performance */}
        <Text style={styles.sectionTitle}>Performance</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="Note moyenne"
            value={`${stats?.averageRating || 0}/5`}
            icon="star-outline"
            color="#9b59b6"
          />
          
          <StatCard
            title="Candidatures en attente"
            value={stats?.pendingApplications || 0}
            icon="time-outline"
            color="#e74c3c"
          />
          
          <StatCard
            title="Documents à vérifier"
            value="Gérer"
            icon="shield-checkmark-outline"
            color="#8e44ad"
          />
        </View>

        {/* Activité récente */}
        {stats?.recentBookings && stats.recentBookings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Réservations récentes</Text>
            <View style={styles.recentContainer}>
              {stats.recentBookings.slice(0, 5).map((booking, index) => (
                <View key={index} style={styles.recentItem}>
                  <View style={styles.recentItemContent}>
                    <Text style={styles.recentItemTitle}>
                      {booking.properties?.title || 'Propriété'}
                    </Text>
                    <Text style={styles.recentItemSubtitle}>
                      {booking.profiles?.first_name} {booking.profiles?.last_name}
                    </Text>
                    <View style={styles.recentItemMeta}>
                      <Text style={styles.recentItemDate}>
                        {formatDate(booking.created_at)}
                      </Text>
                      <Text style={styles.recentItemPrice}>
                        {formatPrice(booking.total_price || 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Villes populaires */}
        {stats?.popularCities && stats.popularCities.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Villes populaires</Text>
            <View style={styles.citiesContainer}>
              {stats.popularCities.slice(0, 5).map((city, index) => (
                <View key={index} style={styles.cityItem}>
                  <Text style={styles.cityName}>{city.city}</Text>
                  <Text style={styles.cityCount}>{city.count} propriétés</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.encouragementContainer}>
          <Ionicons name="trophy-outline" size={32} color="#f39c12" />
          <Text style={styles.encouragementTitle}>Plateforme en croissance !</Text>
          <Text style={styles.encouragementText}>
            Vous gérez {stats?.totalUsers || 0} utilisateur{(stats?.totalUsers || 0) > 1 ? 's' : ''} avec {stats?.totalProperties || 0} propriété{(stats?.totalProperties || 0) > 1 ? 's' : ''}.
            {stats?.averageRating && stats.averageRating > 0 && ` Note moyenne: ${stats.averageRating}/5.`}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  },
  recentContainer: {
    marginBottom: 20,
  },
  recentItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recentItemContent: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recentItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  recentItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentItemDate: {
    fontSize: 12,
    color: '#999',
  },
  recentItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  citiesContainer: {
    marginBottom: 20,
  },
  cityItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cityCount: {
    fontSize: 14,
    color: '#666',
  },
  encouragementContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  encouragementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 8,
  },
  encouragementText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AdminStatsScreen;
