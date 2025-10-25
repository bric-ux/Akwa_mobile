import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin, DashboardStats } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import AdminNotificationBell from '../components/AdminNotificationBell';

const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
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

  // Charger les statistiques quand l'écran devient actif
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

  const QuickAction = ({ title, description, icon, onPress }: {
    title: string;
    description: string;
    icon: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon as any} size={24} color="#e74c3c" />
      </View>
      <View style={styles.quickActionContent}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const handleNavigateToApplications = () => {
    navigation.navigate('AdminApplications');
  };

  const handleNavigateToProperties = () => {
    navigation.navigate('AdminProperties');
  };

  const handleNavigateToUsers = () => {
    navigation.navigate('AdminUsers');
  };

  const handleNavigateToIdentityDocuments = () => {
    navigation.navigate('AdminIdentityDocuments');
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour accéder au tableau de bord admin.
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

  // Vérifier que l'utilisateur est admin
  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color="#e74c3c" />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <Text style={styles.emptySubtitle}>
            Vous n'avez pas les permissions nécessaires pour accéder à l'administration.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.loginButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingStats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Administration</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadStats}
        >
          <Ionicons name="refresh" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications */}
        <AdminNotificationBell />

        {/* Statistiques principales */}
        <Text style={styles.sectionTitle}>Statistiques générales</Text>
        
        <View style={styles.statsContainer}>
          <StatCard
            title="Utilisateurs"
            value={stats?.totalUsers || 0}
            icon="people-outline"
            color="#3498db"
            onPress={handleNavigateToUsers}
          />
          
          <StatCard
            title="Propriétés"
            value={stats?.totalProperties || 0}
            icon="home-outline"
            color="#2E7D32"
            onPress={handleNavigateToProperties}
          />
          
          <StatCard
            title="Réservations"
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
            onPress={handleNavigateToApplications}
          />
          
          <StatCard
            title="Documents d'identité"
            value="Gérer"
            icon="shield-checkmark-outline"
            color="#8e44ad"
            onPress={handleNavigateToIdentityDocuments}
          />
        </View>

        {/* Actions rapides */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        
        <View style={styles.quickActionsContainer}>
          <QuickAction
            title="Candidatures d'hôtes"
            description="Examiner et valider les nouvelles candidatures"
            icon="home-outline"
            onPress={handleNavigateToApplications}
          />
          
          <QuickAction
            title="Gestion des propriétés"
            description="Masquer, afficher ou supprimer toutes les propriétés"
            icon="business-outline"
            onPress={handleNavigateToProperties}
          />
          
          <QuickAction
            title="Gestion des utilisateurs"
            description="Modifier les rôles et gérer les comptes utilisateurs"
            icon="people-outline"
            onPress={handleNavigateToUsers}
          />
        </View>

        {/* Utilisateurs récents */}
        {stats?.recentUsers && stats.recentUsers.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Utilisateurs récents</Text>
            <View style={styles.recentContainer}>
              {stats.recentUsers.slice(0, 3).map((user, index) => (
                <View key={index} style={styles.recentItem}>
                  <View style={styles.recentItemContent}>
                    <Text style={styles.recentItemTitle}>
                      {user.first_name} {user.last_name}
                    </Text>
                    <Text style={styles.recentItemSubtitle}>{user.email}</Text>
                    <View style={styles.recentItemMeta}>
                      <Text style={styles.recentItemDate}>
                        {formatDate(user.created_at)}
                      </Text>
                      {user.role === 'admin' && (
                        <View style={styles.adminBadge}>
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                      {user.is_host && (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeText}>Hôte</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Réservations récentes */}
        {stats?.recentBookings && stats.recentBookings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Réservations récentes</Text>
            <View style={styles.recentContainer}>
              {stats.recentBookings.slice(0, 3).map((booking, index) => (
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
    backgroundColor: '#ffeaea',
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
  adminBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  adminBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  hostBadge: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  hostBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
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
    backgroundColor: '#e74c3c',
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

export default AdminDashboardScreen;
