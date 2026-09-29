import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useMonthlyRentalListings } from '../hooks/useMonthlyRentalListings';
import type { MonthlyRentalListing } from '../types';
import MediaThumb from '../components/MediaThumb';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Refusé',
  archived: 'Archivé',
};

const MyMonthlyRentalListingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const isTabScreen = route.name === 'MonthlyRentalListingsTab';
  const { getMyListings, deleteListing, submitForApproval, archiveListing, restoreListing, loading } =
    useMonthlyRentalListings(user?.id);
  const [listings, setListings] = useState<MonthlyRentalListing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getMyListings();
    setListings(data);
  }, [getMyListings]);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAdd = () => {
    navigation.navigate('AddMonthlyRentalListing' as never);
  };

  const handleEdit = (listingId: string) => {
    navigation.navigate('EditMonthlyRentalListing' as never, { listingId });
  };

  const handleCandidatures = (listingId: string) => {
    navigation.navigate('MonthlyRentalCandidatures' as never, { listingId });
  };

  const handleSubmitForApproval = async (item: MonthlyRentalListing) => {
    if (item.status !== 'draft') return;
    setSubmittingId(item.id);
    try {
      const sub = await submitForApproval(item.id, true);
      if (sub.success) load();
      else Alert.alert('Erreur', sub.error || 'Impossible de soumettre');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = (item: MonthlyRentalListing) => {
    const canDelete = item.status === 'draft' || item.status === 'rejected';
    if (!canDelete) {
      Alert.alert('Suppression', 'Seuls les brouillons et les annonces refusées peuvent être supprimés. Masquez les annonces publiées.');
      return;
    }
    Alert.alert(
      'Supprimer le logement',
      `Supprimer "${item.title}" ?${item.status === 'draft' ? '' : ' Les demandes de visite associées seront aussi supprimées.'}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const r = await deleteListing(item.id);
            if (r.success) load();
            else Alert.alert('Erreur', r.error || 'Impossible de supprimer');
          },
        },
      ]
    );
  };

  const handleArchive = (item: MonthlyRentalListing) => {
    Alert.alert(
      'Masquer l’annonce',
      `« ${item.title} » ne sera plus visible des voyageurs.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Masquer',
          onPress: async () => {
            const r = await archiveListing(item.id);
            if (r.success) load();
            else Alert.alert('Erreur', r.error || 'Impossible de masquer');
          },
        },
      ],
    );
  };

  const handleRestore = (item: MonthlyRentalListing) => {
    Alert.alert('Remettre en ligne', `Remettre « ${item.title} » visible ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Remettre',
        onPress: async () => {
          const r = await restoreListing(item.id);
          if (r.success) load();
          else Alert.alert('Erreur', r.error || 'Impossible de restaurer');
        },
      },
    ]);
  };

  const getImageUrl = (item: MonthlyRentalListing): string => {
    if (item.images && item.images.length > 0) return item.images[0];
    const cp = item.categorized_photos as Array<{ url?: string }> | undefined;
    if (Array.isArray(cp) && cp.length > 0 && cp[0]?.url) return cp[0].url;
    return 'https://via.placeholder.com/300x180?text=Logement';
  };

  const formatPrice = (n: number) => `${(n || 0).toLocaleString('fr-FR')} FCFA/mois`;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved': return styles.badgeApproved;
      case 'pending': return styles.badgePending;
      case 'rejected': return styles.badgeRejected;
      case 'archived': return styles.badgeArchived;
      default: return styles.badgeDraft;
    }
  };

  const renderItem = ({ item }: { item: MonthlyRentalListing }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardMain}
        onPress={() => handleEdit(item.id)}
        activeOpacity={0.8}
      >
        <MediaThumb
          uri={getImageUrl(item)}
          style={styles.thumb}
          resizeMode="cover"
          contentPosition="center"
          fitWholeImage
          recyclingKey={`monthly-listing-${item.id}`}
        />
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
              <Text style={styles.statusBadgeText}>
                {STATUS_LABEL[item.status] || item.status}
              </Text>
            </View>
          </View>
          <Text style={styles.location} numberOfLines={1}>
            {item.location}
          </Text>
          <Text style={styles.price}>{formatPrice(item.monthly_rent_price)}</Text>
          <View style={styles.meta}>
            <Text style={styles.metaText}>{item.surface_m2} m²</Text>
            <Text style={styles.metaText}> · </Text>
            <Text style={styles.metaText}>{item.number_of_rooms} pièces</Text>
            <Text style={styles.metaText}> · </Text>
            <Text style={styles.metaText}>{item.bedrooms} ch.</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        {item.status === 'draft' && (
          <TouchableOpacity
            style={styles.btnSubmit}
            onPress={() => handleSubmitForApproval(item)}
            disabled={submittingId === item.id || loading}
          >
            {submittingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.btnSubmitText}>Soumettre pour validation</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {(item.status === 'pending' || item.status === 'approved') && (
          <TouchableOpacity
            style={styles.btnCandidatures}
            onPress={() => handleCandidatures(item.id)}
          >
            <Ionicons name="people-outline" size={20} color="#2E7D32" />
            <Text style={styles.btnCandidaturesText}>Candidatures</Text>
          </TouchableOpacity>
        )}
        {(item.status === 'pending' || item.status === 'approved') && (
          <TouchableOpacity style={styles.btnArchive} onPress={() => handleArchive(item)}>
            <Ionicons name="eye-off-outline" size={18} color="#5c6bc0" />
            <Text style={styles.btnArchiveText}>Masquer</Text>
          </TouchableOpacity>
        )}
        {item.status === 'archived' && (
          <TouchableOpacity style={styles.btnRestore} onPress={() => handleRestore(item)}>
            <Ionicons name="eye-outline" size={18} color="#2E7D32" />
            <Text style={styles.btnRestoreText}>Remettre</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnEdit} onPress={() => handleEdit(item.id)}>
          <Ionicons name="pencil-outline" size={20} color="#fff" />
        </TouchableOpacity>
        {(item.status === 'draft' || item.status === 'rejected') && (
          <TouchableOpacity style={styles.btnDelete} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={20} color="#c62828" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading && listings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          {!isTabScreen ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.headerTitle}>Mes bails longue durée</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {!isTabScreen ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.headerTitle}>Mes bails longue durée</Text>
        <TouchableOpacity onPress={handleAdd} style={styles.addBtn}>
          <Ionicons name="add" size={28} color="#2E7D32" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={listings.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2E7D32']} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="home-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Aucun logement</Text>
            <Text style={styles.emptySubtitle}>
              Ajoutez un logement en location mensuelle pour recevoir des demandes de visite.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAdd}>
              <Text style={styles.emptyButtonText}>Ajouter un logement</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333', flex: 1, textAlign: 'center' },
  addBtn: { padding: 8 },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  cardMain: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: MONTHLY_RENTAL_COLORS.light,
  },
  cardBody: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  location: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  price: { fontSize: 15, fontWeight: '600', color: MONTHLY_RENTAL_COLORS.primary, marginBottom: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#94a3b8' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  badgeDraft: { backgroundColor: '#9e9e9e' },
  badgePending: { backgroundColor: '#f59e0b' },
  badgeApproved: { backgroundColor: '#2E7D32' },
  badgeRejected: { backgroundColor: '#c62828' },
  badgeArchived: { backgroundColor: '#5c6bc0' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
    marginTop: 4,
    marginHorizontal: 12,
  },
  btnSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1976d2',
    borderRadius: 8,
  },
  btnSubmitText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  btnCandidatures: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  btnCandidaturesText: { fontSize: 14, color: '#2E7D32', fontWeight: '500' },
  btnArchive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#e8eaf6',
    borderRadius: 8,
  },
  btnArchiveText: { fontSize: 13, color: '#5c6bc0', fontWeight: '600' },
  btnRestore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  btnRestoreText: { fontSize: 13, color: '#2E7D32', fontWeight: '600' },
  btnEdit: {
    padding: 8,
    backgroundColor: '#2E7D32',
    borderRadius: 8,
  },
  btnDelete: { padding: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
  emptyButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
  },
  emptyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default MyMonthlyRentalListingsScreen;
