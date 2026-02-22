import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin, MonthlyRentalListingWithOwner } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Refusé',
  archived: 'Archivé',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#95a5a6',
  pending: '#f39c12',
  approved: '#2E7D32',
  rejected: '#e74c3c',
  archived: '#7f8c8d',
};

const { height: WINDOW_HEIGHT } = Dimensions.get('window');

const AdminMonthlyRentalScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const {
    getMonthlyRentalListings,
    updateMonthlyRentalListingStatus,
    deleteMonthlyRentalListing,
    loading,
  } = useAdmin();

  const [listings, setListings] = useState<MonthlyRentalListingWithOwner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selected, setSelected] = useState<MonthlyRentalListingWithOwner | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadListings = async () => {
    try {
      const data = await getMonthlyRentalListings();
      setListings(data);
    } catch (e) {
      console.error('Erreur chargement annonces location mensuelle:', e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadListings();
      }
    }, [user, profile])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadListings();
    setRefreshing(false);
  };

  const filtered = listings.filter((l) => {
    if (filterStatus === 'all') return true;
    return l.status === filterStatus;
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(price);

  const formatDate = (dateString: string | null) =>
    dateString
      ? new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    const result = await updateMonthlyRentalListingStatus(selected.id, 'approved', adminNotes.trim() || undefined);
    setActionLoading(false);
    if (result.success) {
      setSelected(null);
      setAdminNotes('');
      loadListings();
      Alert.alert('Succès', 'Annonce approuvée.');
    } else {
      Alert.alert('Erreur', result.error ?? 'Impossible d\'approuver');
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    const result = await updateMonthlyRentalListingStatus(selected.id, 'rejected', adminNotes.trim() || undefined);
    setActionLoading(false);
    if (result.success) {
      setSelected(null);
      setAdminNotes('');
      loadListings();
      Alert.alert('Succès', 'Annonce refusée.');
    } else {
      Alert.alert('Erreur', result.error ?? 'Impossible de refuser');
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    Alert.alert(
      'Supprimer l\'annonce',
      `Supprimer définitivement "${selected.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await deleteMonthlyRentalListing(selected.id);
            setActionLoading(false);
            if (result.success) {
              setSelected(null);
              loadListings();
              Alert.alert('Succès', 'Annonce supprimée.');
            } else {
              Alert.alert('Erreur', result.error ?? 'Impossible de supprimer');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: MonthlyRentalListingWithOwner }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.8}>
      {item.images?.[0] ? (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="home-outline" size={40} color="#ccc" />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardLocation} numberOfLines={1}>📍 {item.location || '—'}</Text>
        <Text style={styles.cardOwner} numberOfLines={1}>
          👤 {item.owner_profile
            ? `${item.owner_profile.first_name ?? ''} ${item.owner_profile.last_name ?? ''}`.trim() || item.owner_profile.email
            : '—'}
        </Text>
        <Text style={styles.cardPrice}>{formatPrice(item.monthly_rent_price)}/mois</Text>
        <Text style={styles.cardDate}>Soumis le {formatDate(item.submitted_at)}</Text>
        <View style={styles.cardRow}>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] || '#999' }]}>
            <Text style={styles.badgeText}>{STATUS_LABELS[item.status] ?? item.status}</Text>
          </View>
          {item.payment && (
            <View style={[styles.badge, { backgroundColor: item.payment.status === 'completed' ? '#2E7D32' : '#f39c12' }]}>
              <Text style={styles.badgeText}>
                Paiement {item.payment.status === 'completed' ? 'OK' : item.payment.status}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>Aucune annonce</Text>
      <Text style={styles.emptySubtitle}>
        {filterStatus === 'all' ? 'Aucune annonce de location mensuelle.' : `Aucune annonce "${STATUS_LABELS[filterStatus] ?? filterStatus}".`}
      </Text>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.btnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Locations mensuelles</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterBtn, filterStatus === s && styles.filterBtnActive]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={[styles.filterBtnText, filterStatus === s && styles.filterBtnTextActive]}>
              {s === 'all' ? 'Toutes' : STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{listings.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{listings.filter((l) => l.status === 'pending').length}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{listings.filter((l) => l.status === 'approved').length}</Text>
          <Text style={styles.statLabel}>Approuvées</Text>
        </View>
      </View>

      {loading && listings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : filtered.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#e74c3c']} />
          }
        />
      )}

      <Modal visible={!!selected} animationType="slide" transparent statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { height: WINDOW_HEIGHT * 0.92 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détail de l'annonce</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setAdminNotes(''); }}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>
            {selected && (
              <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} showsVerticalScrollIndicator={true}>
                <Text style={styles.detailTitle}>{selected.title}</Text>
                <Text style={styles.detailLocation}>📍 {selected.location || '—'}</Text>
                <Text style={styles.detailPrice}>{formatPrice(selected.monthly_rent_price)}/mois</Text>
                <Text style={styles.detailMeta}>
                  {selected.surface_m2} m² · {selected.bedrooms} ch. · {selected.bathrooms} sdb
                </Text>
                <Text style={styles.detailDescription} numberOfLines={6}>{selected.description || '—'}</Text>

                <Text style={styles.sectionLabel}>Propriétaire</Text>
                <Text style={styles.detailText}>
                  {selected.owner_profile
                    ? `${selected.owner_profile.first_name ?? ''} ${selected.owner_profile.last_name ?? ''}`.trim() || selected.owner_profile.email
                    : '—'}
                </Text>
                {selected.owner_profile?.email && (
                  <Text style={styles.detailSubtext}>{selected.owner_profile.email}</Text>
                )}

                <Text style={styles.sectionLabel}>Paiement 200 FCFA</Text>
                <Text style={styles.detailText}>
                  {selected.payment
                    ? selected.payment.status === 'completed'
                      ? `Payé le ${formatDate(selected.payment.paid_at)}`
                      : `Statut: ${selected.payment.status}`
                    : 'Aucun paiement'}
                </Text>

                <Text style={styles.sectionLabel}>Workflow</Text>
                <Text style={styles.detailText}>Soumis le {formatDate(selected.submitted_at)}</Text>
                {selected.reviewed_at && (
                  <Text style={styles.detailSubtext}>Traité le {formatDate(selected.reviewed_at)}</Text>
                )}
                {selected.admin_notes && (
                  <>
                    <Text style={styles.sectionLabel}>Notes admin</Text>
                    <Text style={styles.detailText}>{selected.admin_notes}</Text>
                  </>
                )}

                {(selected.status === 'pending' || selected.status === 'rejected') && (
                  <>
                    <Text style={styles.sectionLabel}>Notes (optionnel)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Notes pour le propriétaire ou usage interne..."
                      placeholderTextColor="#999"
                      value={adminNotes}
                      onChangeText={setAdminNotes}
                      multiline
                      numberOfLines={2}
                    />
                  </>
                )}
              </ScrollView>
            )}
            {selected && (selected.status === 'pending' || selected.status === 'rejected') && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.actionBtnText}>Approuver</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={handleReject}
                  disabled={actionLoading}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Refuser</Text>
                </TouchableOpacity>
              </View>
            )}
            {selected && (
              <TouchableOpacity style={styles.deleteLink} onPress={handleDelete} disabled={actionLoading}>
                <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                <Text style={styles.deleteLinkText}>Supprimer l'annonce</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
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
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  refreshBtn: { padding: 8 },
  filters: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterBtnActive: { backgroundColor: '#e74c3c', borderColor: '#e74c3c' },
  filterBtnText: { fontSize: 14, color: '#666', fontWeight: '500' },
  filterBtnTextActive: { color: '#fff' },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardImage: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' },
  cardImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  cardLocation: { fontSize: 13, color: '#666', marginTop: 2 },
  cardOwner: { fontSize: 13, color: '#666', marginTop: 2 },
  cardPrice: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginTop: 4 },
  cardDate: { fontSize: 12, color: '#999', marginTop: 2 },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptySubtitle: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  btn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#e74c3c', borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalBody: { flex: 1, paddingHorizontal: 20 },
  modalBodyContent: { paddingVertical: 20, paddingBottom: 32 },
  detailTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  detailLocation: { fontSize: 14, color: '#666', marginTop: 4 },
  detailPrice: { fontSize: 16, fontWeight: '600', color: '#2E7D32', marginTop: 4 },
  detailMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  detailDescription: { fontSize: 14, color: '#555', marginTop: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#999', marginTop: 16, marginBottom: 4 },
  detailText: { fontSize: 14, color: '#333' },
  detailSubtext: { fontSize: 13, color: '#666', marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  approveBtn: { backgroundColor: '#2E7D32' },
  rejectBtn: { backgroundColor: '#e74c3c' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  deleteLinkText: { fontSize: 14, color: '#e74c3c', fontWeight: '500' },
});

export default AdminMonthlyRentalScreen;
