import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMyProperties } from '../hooks/useMyProperties';
import { useAuth } from '../services/AuthContext';

const HostDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { getMyProperties, getPropertyBookings, loading } = useMyProperties();
  
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    totalRevenue: 0,
    averageRating: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const loadDashboardStats = async () => {
    if (!user) return;

    try {
      setLoadingStats(true);
      
      // Charger les propriétés
      const userProperties = await getMyProperties();

      // Calculer les statistiques
      let totalBookingsCount = 0;
      let pendingBookingsCount = 0;
      let confirmedBookingsCount = 0;
      let revenue = 0;
      let totalRating = 0;
      let ratingCount = 0;

      for (const property of userProperties) {
        const bookings = await getPropertyBookings(property.id);
        totalBookingsCount += bookings.length;
        
        const pending = bookings.filter(booking => booking.status === 'pending');
        pendingBookingsCount += pending.length;
        
        const confirmed = bookings.filter(booking => booking.status === 'confirmed' || booking.status === 'completed');
        confirmedBookingsCount += confirmed.length;
        
        confirmed.forEach(booking => {
          revenue += booking.total_price || 0;
        });

        // Calculer la note moyenne
        if (property.rating && property.rating > 0) {
          totalRating += property.rating;
          ratingCount++;
        }
      }

      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

      setStats({
        totalProperties: userProperties.length,
        totalBookings: totalBookingsCount,
        pendingBookings: pendingBookingsCount,
        confirmedBookings: confirmedBookingsCount,
        totalRevenue: revenue,
        averageRating: Math.round(averageRating * 10) / 10,
      });

    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Charger les statistiques quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadDashboardStats();
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

  const StatCard = ({ title, value, icon, color, onPress }: {
    title: string;
    value: string | number;
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statContent}>
        <View style={styles.statIconContainer}>
          <Ionicons name={icon as any} size={24} color={color} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      )}
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour voir votre tableau de bord hôte.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.loginButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingStats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement des statistiques...</Text>
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
        <Text style={styles.headerTitle}>Tableau de bord hôte</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadDashboardStats}
        >
          <Ionicons name="refresh" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statistiques principales */}
        <Text style={styles.sectionTitle}>Statistiques générales</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="Propriétés"
            value={stats.totalProperties}
            icon="home-outline"
            color="#2E7D32"
            onPress={() => navigation.navigate('MyProperties')}
          />
          
          <StatCard
            title="Réservations totales"
            value={stats.totalBookings}
            icon="calendar-outline"
            color="#3498db"
          />
          
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

        {/* Actions rapides */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('MyProperties')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="business-outline" size={24} color="#2E7D32" />
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionTitle}>Mes propriétés</Text>
              <Text style={styles.quickActionDescription}>Gérer vos propriétés et calendriers</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate('BecomeHost')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="add-circle-outline" size={24} color="#3498db" />
            </View>
            <View style={styles.quickActionContent}>
              <Text style={styles.quickActionTitle}>Ajouter une propriété</Text>
              <Text style={styles.quickActionDescription}>Créer une nouvelle annonce</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Message d'encouragement */}
        <View style={styles.encouragementContainer}>
          <Ionicons name="trophy-outline" size={32} color="#f39c12" />
          <Text style={styles.encouragementTitle}>Continuez comme ça !</Text>
          <Text style={styles.encouragementText}>
            Vous gérez {stats.totalProperties} propriété{stats.totalProperties > 1 ? 's' : ''} avec {stats.totalBookings} réservation{stats.totalBookings > 1 ? 's' : ''}.
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
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  quickAction: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  quickActionDescription: {
    fontSize: 14,
    color: '#666',
  },
  encouragementContainer: {
    backgroundColor: '#fff3cd',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    marginTop: 20,
  },
  encouragementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginTop: 10,
    marginBottom: 8,
  },
  encouragementText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
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
  loginButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
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

export default HostDashboardScreen;