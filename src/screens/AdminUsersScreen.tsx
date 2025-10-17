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
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

interface User {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  is_host: boolean;
  created_at: string;
  avatar_url?: string;
}

const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getAllUsers, updateUserRole, loading } = useAdmin();
  
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'admin' | 'host'>('all');

  const loadUsers = async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    }
  };

  // Charger les utilisateurs quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadUsers();
      }
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleRoleUpdate = async (userId: string, newRole: 'user' | 'admin') => {
    const userToUpdate = users.find(u => u.user_id === userId);
    if (!userToUpdate) return;

    const actionText = newRole === 'admin' ? 'promouvoir administrateur' : 'rétrograder utilisateur';

    Alert.alert(
      `Confirmer l'action`,
      `Êtes-vous sûr de vouloir ${actionText} ${userToUpdate.first_name} ${userToUpdate.last_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          onPress: async () => {
            try {
              const result = await updateUserRole(userId, newRole);
              if (result.success) {
                Alert.alert('Succès', `Rôle ${actionText} avec succès`);
                loadUsers(); // Recharger la liste
              } else {
                Alert.alert('Erreur', 'Impossible de mettre à jour le rôle');
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

  const getRoleBadge = (role: string, isHost: boolean) => {
    if (role === 'admin') {
      return { color: '#e74c3c', text: 'Admin', icon: 'shield-outline' };
    } else if (isHost) {
      return { color: '#2E7D32', text: 'Hôte', icon: 'home-outline' };
    } else {
      return { color: '#3498db', text: 'Utilisateur', icon: 'person-outline' };
    }
  };

  const filteredUsers = users.filter(user => {
    // Filtre par recherche
    const matchesSearch = searchQuery === '' || 
      user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    // Filtre par rôle
    let matchesRole = true;
    if (filterRole === 'admin') {
      matchesRole = user.role === 'admin';
    } else if (filterRole === 'host') {
      matchesRole = user.is_host && user.role !== 'admin';
    } else if (filterRole === 'user') {
      matchesRole = user.role === 'user' && !user.is_host;
    }

    return matchesSearch && matchesRole;
  });

  const renderUserItem = ({ item: user }: { item: User }) => {
    const roleInfo = getRoleBadge(user.role, user.is_host);
    
    return (
      <TouchableOpacity style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Ionicons name="person" size={24} color="#666" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.first_name} {user.last_name}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                📧 {user.email}
              </Text>
              {user.phone && (
                <Text style={styles.userPhone} numberOfLines={1}>
                  📞 {user.phone}
                </Text>
              )}
            </View>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleInfo.color }]}>
            <Ionicons name={roleInfo.icon as any} size={12} color="#fff" />
            <Text style={styles.roleText}>{roleInfo.text}</Text>
          </View>
        </View>

        <View style={styles.userDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Membre depuis:</Text>
            <Text style={styles.detailValue}>{formatDate(user.created_at)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Rôle:</Text>
            <Text style={styles.detailValue}>{user.role}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Hôte:</Text>
            <Text style={styles.detailValue}>{user.is_host ? 'Oui' : 'Non'}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.userActions}>
          {user.role !== 'admin' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.promoteButton]}
              onPress={() => handleRoleUpdate(user.user_id, 'admin')}
              disabled={loading}
            >
              <Ionicons name="shield-outline" size={16} color="#e74c3c" />
              <Text style={styles.actionButtonText}>Promouvoir Admin</Text>
            </TouchableOpacity>
          )}
          
          {user.role === 'admin' && user.user_id !== profile?.id && (
            <TouchableOpacity
              style={[styles.actionButton, styles.demoteButton]}
              onPress={() => handleRoleUpdate(user.user_id, 'user')}
              disabled={loading}
            >
              <Ionicons name="person-outline" size={16} color="#3498db" />
              <Text style={styles.actionButtonText}>Rétrograder</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <Text style={styles.emptySubtitle}>
            Veuillez vous connecter pour accéder à l'administration.
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestion des utilisateurs</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.filter(u => u.role === 'admin').length}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.filter(u => u.is_host && u.role !== 'admin').length}</Text>
          <Text style={styles.statLabel}>Hôtes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.filter(u => u.role === 'user' && !u.is_host).length}</Text>
          <Text style={styles.statLabel}>Utilisateurs</Text>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un utilisateur..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        {['all', 'user', 'host', 'admin'].map((role) => (
          <TouchableOpacity
            key={role}
            style={[
              styles.filterButton,
              filterRole === role && styles.filterButtonActive,
            ]}
            onPress={() => setFilterRole(role as any)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterRole === role && styles.filterButtonTextActive,
              ]}
            >
              {role === 'all' ? 'Tous' :
               role === 'user' ? 'Utilisateurs' :
               role === 'host' ? 'Hôtes' :
               'Admins'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && users.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement des utilisateurs...</Text>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Aucun utilisateur</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Aucun utilisateur ne correspond à votre recherche' : 'Aucun utilisateur trouvé'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.user_id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#e74c3c']} />
          }
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
  refreshButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filtersContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterButtonActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
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
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    marginLeft: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginHorizontal: 5,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 4,
    fontWeight: '500',
  },
  promoteButton: {
    backgroundColor: '#ffeaea',
  },
  demoteButton: {
    backgroundColor: '#e3f2fd',
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

export default AdminUsersScreen;


