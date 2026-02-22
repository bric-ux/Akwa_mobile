import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
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
  const { getMyListings, deleteListing, submitForApproval, loading } = useMonthlyRentalListings(user?.id);
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
      Alert.alert('Suppression', 'Seuls les brouillons et les annonces refusées peuvent être supprimés.');
      return;
    }
    Alert.alert(
      'Supprimer le logement',
      `Supprimer "${item.title}" ?${item.status === 'draft' ? '' : ' Les candidatures associées seront aussi supprimées.'}`,
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
      <TouchableOpacity onPress={() => handleEdit(item.id)} activeOpacity={0.8}>
        <Image source={{ uri: getImageUrl(item) }} style={styles.image} resizeMode="cover" />
        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={styles.statusBadgeText}>{STATUS_LABEL[item.status] || item.status}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.location} numberOfLines={1}>{item.location}</Text>
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
          <Text style={styles.headerTitle}>Mes logements longue durée</Text>
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
        <Text style={styles.headerTitle}>Mes logements longue durée</Text>
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
              Ajoutez un logement en location mensuelle pour recevoir des candidatures.
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
  },
  image: { width: '100%', height: 160 },
  cardBody: { padding: 14 },
  title: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 4 },
  location: { fontSize: 13, color: '#666', marginBottom: 4 },
  price: { fontSize: 15, fontWeight: '600', color: '#2E7D32', marginBottom: 6 },
  meta: { flexDirection: 'row' },
  metaText: { fontSize: 12, color: '#888' },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  badgeDraft: { backgroundColor: '#9e9e9e' },
  badgePending: { backgroundColor: '#f59e0b' },
  badgeApproved: { backgroundColor: '#2E7D32' },
  badgeRejected: { backgroundColor: '#c62828' },
  badgeArchived: { backgroundColor: '#5c6bc0' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
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
