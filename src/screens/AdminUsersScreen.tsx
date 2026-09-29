import React, { useState, useCallback, useMemo } from 'react';
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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { useMessaging } from '../hooks/useMessaging';
import { AKWAHOME_SUPPORT_TITLE } from '../constants/supportMessaging';
import {
  displayEmailOrPhone,
  getProfileContactEmail,
  isPhonePseudoEmail,
} from '../lib/displayContact';

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
  identity_verified?: boolean | null;
}

type ContactEntry = {
  kind: 'email' | 'phone';
  value: string;
};

const AdminUsersScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getAllUsers, updateUserRole, loading } = useAdmin();
  const { createOrGetAdminSupportConversation, sendMessage, sending } = useMessaging();
  
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'admin' | 'host'>('all');
  const [messageTarget, setMessageTarget] = useState<User | null>(null);
  const [messageText, setMessageText] = useState('');
  const [messageSending, setMessageSending] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers as User[]);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    } finally {
      setListLoading(false);
    }
  }, [getAllUsers]);

  // Charger les utilisateurs quand l'écran devient actif
  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadUsers();
      }
    }, [user, profile])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const formatDisplayName = (item: User) => {
    const full = [item.first_name, item.last_name]
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join(' ');
    return full || 'Utilisateur sans nom';
  };

  const getContactEntries = (item: User): ContactEntry[] => {
    const emailLine = getProfileContactEmail(item.email, item.email);
    const phoneLine = isPhonePseudoEmail(item.email)
      ? displayEmailOrPhone(item.email, item.phone)
      : (item.phone || '').trim();
    const entries: ContactEntry[] = [];
    if (emailLine) entries.push({ kind: 'email', value: emailLine });
    if (phoneLine && phoneLine !== emailLine) entries.push({ kind: 'phone', value: phoneLine });
    return entries;
  };

  const copyContact = async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('Copié', `${label} copié dans le presse-papiers.`);
    } catch {
      Alert.alert('Erreur', 'Impossible de copier dans le presse-papiers.');
    }
  };

  const getInitials = (item: User) => {
    const first = (item.first_name || '').trim().charAt(0);
    const last = (item.last_name || '').trim().charAt(0);
    const initials = `${first}${last}`.toUpperCase();
    return initials || '?';
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

  const getIdentityBadge = (verified: boolean | null) => {
    if (verified === true) {
      return { text: 'Vérifié', color: '#10b981', icon: 'checkmark-circle' };
    } else if (verified === false) {
      return { text: 'Rejeté', color: '#ef4444', icon: 'close-circle' };
    } else if (verified === null) {
      return { text: 'En attente', color: '#f59e0b', icon: 'time' };
    } else {
      return { text: 'Non vérifié', color: '#6b7280', icon: 'alert-circle' };
    }
  };

  const handleSendSupportMessage = async () => {
    if (!user || !messageTarget) return;
    const text = messageText.trim();
    if (!text) {
      Alert.alert('Message requis', 'Écrivez un message à envoyer à cet utilisateur.');
      return;
    }
    if (messageTarget.user_id === user.id) {
      Alert.alert('Action impossible', 'Vous ne pouvez pas vous écrire à vous-même.');
      return;
    }

    setMessageSending(true);
    try {
      const conversationId = await createOrGetAdminSupportConversation(
        user.id,
        messageTarget.user_id,
      );
      await sendMessage(conversationId, text, user.id);
      setMessageTarget(null);
      setMessageText('');
      navigation.navigate('Messaging' as never, { conversationId } as never);
    } catch (error: unknown) {
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : "Impossible d'envoyer le message.",
      );
    } finally {
      setMessageSending(false);
    }
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

  const filteredUsers = useMemo(() => users.filter((user) => {
    const q = searchQuery.trim().toLowerCase();
    const contactEntries = getContactEntries(user);
    const matchesSearch =
      q === '' ||
      user.first_name?.toLowerCase().includes(q) ||
      user.last_name?.toLowerCase().includes(q) ||
      formatDisplayName(user).toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.phone?.toLowerCase().includes(q) ||
      contactEntries.some((entry) => entry.value.toLowerCase().includes(q));

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
  }), [users, searchQuery, filterRole]);

  const renderUserItem = ({ item: user }: { item: User }) => {
    const roleInfo = getRoleBadge(user.role, user.is_host);
    const identityInfo = getIdentityBadge(user.identity_verified);
    const displayName = formatDisplayName(user);
    const contactEntries = getContactEntries(user);
    
    return (
      <TouchableOpacity style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{getInitials(user)}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={2}>
                {displayName}
              </Text>
              {contactEntries.length > 0 ? (
                contactEntries.map((entry) => (
                  <View key={`${user.user_id}-${entry.kind}`} style={styles.contactRow}>
                    <Ionicons
                      name={entry.kind === 'email' ? 'mail-outline' : 'call-outline'}
                      size={14}
                      color="#64748b"
                      style={styles.contactIcon}
                    />
                    <TouchableOpacity
                      style={styles.contactTextWrap}
                      onPress={() =>
                        void copyContact(
                          entry.value,
                          entry.kind === 'email' ? "L'email" : 'Le numéro',
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.userContact} selectable>
                        {entry.value}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contactCopyBtn}
                      onPress={() =>
                        void copyContact(
                          entry.value,
                          entry.kind === 'email' ? "L'email" : 'Le numéro',
                        )
                      }
                      accessibilityLabel={
                        entry.kind === 'email' ? "Copier l'email" : 'Copier le numéro'
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="copy-outline" size={17} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.userContactMuted}>Aucun contact renseigné</Text>
              )}
            </View>
          </View>
          <View style={styles.badgesContainer}>
            <View style={[styles.roleBadge, { backgroundColor: roleInfo.color }]}>
              <Ionicons name={roleInfo.icon as any} size={12} color="#fff" />
              <Text style={styles.roleText}>{roleInfo.text}</Text>
            </View>
            <View style={[styles.identityBadge, { backgroundColor: identityInfo.color }]}>
              <Ionicons name={identityInfo.icon as any} size={12} color="#fff" />
              <Text style={styles.identityText}>{identityInfo.text}</Text>
            </View>
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
          {user.user_id !== profile?.id && (
            <TouchableOpacity
              style={[styles.actionButton, styles.messageButton]}
              onPress={() => {
                setMessageTarget(user);
                setMessageText('');
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#2563eb" />
              <Text style={styles.actionButtonText}>Écrire</Text>
            </TouchableOpacity>
          )}

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

      {listLoading && users.length === 0 ? (
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
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          windowSize={8}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#e74c3c']} />
          }
        />
      )}

      <Modal
        visible={!!messageTarget}
        animationType="slide"
        transparent
        onRequestClose={() => setMessageTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{AKWAHOME_SUPPORT_TITLE}</Text>
            {messageTarget ? (
              <Text style={styles.modalSubtitle}>
                Message à {messageTarget.first_name} {messageTarget.last_name}
              </Text>
            ) : null}
            <Text style={styles.modalHint}>
              L’utilisateur verra « Service AkwaHome » et recevra une notification push.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Votre message…"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setMessageTarget(null)}
                disabled={messageSending || sending}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSend}
                onPress={() => void handleSendSupportMessage()}
                disabled={messageSending || sending}
              >
                {messageSending || sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSendText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b91c1c',
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 22,
  },
  userContact: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  userContactMuted: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    width: '100%',
  },
  contactIcon: {
    marginTop: 2,
  },
  contactTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  contactCopyBtn: {
    padding: 4,
    marginTop: -2,
  },
  badgesContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
    marginLeft: 8,
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
  identityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  identityText: {
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
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
  messageButton: {
    backgroundColor: '#eff6ff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#374151',
  },
  modalHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
  },
  modalInput: {
    marginTop: 14,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCancelText: {
    color: '#64748b',
    fontWeight: '600',
  },
  modalSend: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  modalSendText: {
    color: '#fff',
    fontWeight: '700',
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


