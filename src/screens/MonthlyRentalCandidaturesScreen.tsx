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
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import { useMonthlyRentalListings } from '../hooks/useMonthlyRentalListings';
import type { MonthlyRentalCandidature } from '../types';

type RouteParams = { listingId: string };

const MonthlyRentalCandidaturesScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const listingId = route.params?.listingId;
  const { getByListingId, acceptCandidature, rejectCandidature, loading } = useMonthlyRentalCandidatures();
  const { getListingById } = useMonthlyRentalListings();
  const [candidatures, setCandidatures] = useState<MonthlyRentalCandidature[]>([]);
  const [listingTitle, setListingTitle] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!listingId) return;
    const [list, listing] = await Promise.all([
      getByListingId(listingId),
      getListingById(listingId),
    ]);
    setCandidatures(list);
    if (listing) setListingTitle(listing.title);
  }, [listingId, getByListingId, getListingById]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAccept = (c: MonthlyRentalCandidature) => {
    Alert.alert(
      'Accepter la candidature',
      `Accepter la candidature de ${c.full_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            const r = await acceptCandidature(c.id);
            if (r.success) load();
            else Alert.alert('Erreur', r.error);
          },
        },
      ]
    );
  };

  const handleReject = (c: MonthlyRentalCandidature) => {
    Alert.alert(
      'Refuser la candidature',
      `Refuser la candidature de ${c.full_name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            const r = await rejectCandidature(c.id);
            if (r.success) load();
            else Alert.alert('Erreur', r.error);
          },
        },
      ]
    );
  };

  const statusLabel = (s: string) => {
    if (s === 'sent') return 'Envoyée';
    if (s === 'viewed') return 'Vue';
    if (s === 'accepted') return 'Acceptée';
    return 'Refusée';
  };

  const statusColor = (s: string) => {
    if (s === 'sent') return '#f59e0b';
    if (s === 'viewed') return '#1976d2';
    if (s === 'accepted') return '#2E7D32';
    return '#c62828';
  };

  const renderItem = ({ item }: { item: MonthlyRentalCandidature }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.full_name}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.email}>{item.email}</Text>
      <Text style={styles.phone}>{item.phone}</Text>
      {item.message ? (
        <Text style={styles.message} numberOfLines={3}>{item.message}</Text>
      ) : null}
      {(item.desired_move_in_date || item.duration_months) && (
        <View style={styles.meta}>
          {item.desired_move_in_date && (
            <Text style={styles.metaText}>Entrée souhaitée : {item.desired_move_in_date}</Text>
          )}
          {item.duration_months != null && (
            <Text style={styles.metaText}>Durée : {item.duration_months} mois</Text>
          )}
        </View>
      )}
      <Text style={styles.date}>
        Candidature du {new Date(item.created_at).toLocaleDateString('fr-FR')}
      </Text>
      {(item.status === 'sent' || item.status === 'viewed') && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnAccept}
            onPress={() => handleAccept(item)}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.btnAcceptText}>Accepter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnReject}
            onPress={() => handleReject(item)}
          >
            <Ionicons name="close-circle-outline" size={20} color="#c62828" />
            <Text style={styles.btnRejectText}>Refuser</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Candidatures{listingTitle ? ` · ${listingTitle}` : ''}
        </Text>
      </View>
      {loading && candidatures.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : (
        <FlatList
          data={candidatures}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={candidatures.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#2E7D32']}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color="#ccc" />
              <Text style={styles.emptyTitle}>Aucune candidature</Text>
              <Text style={styles.emptySubtitle}>
                Les demandes des locataires apparaîtront ici.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333', flex: 1, marginLeft: 8 },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '600', color: '#222' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  email: { fontSize: 14, color: '#555', marginBottom: 2 },
  phone: { fontSize: 14, color: '#555', marginBottom: 8 },
  message: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 8 },
  meta: { marginBottom: 6 },
  metaText: { fontSize: 13, color: '#666' },
  date: { fontSize: 12, color: '#999', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnAccept: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#2E7D32',
    borderRadius: 10,
  },
  btnAcceptText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#ffebee',
    borderRadius: 10,
  },
  btnRejectText: { color: '#c62828', fontWeight: '600', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
});

export default MonthlyRentalCandidaturesScreen;
