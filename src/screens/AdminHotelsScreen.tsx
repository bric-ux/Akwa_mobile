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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAdmin, HotelEstablishmentWithOwner } from '../hooks/useAdmin';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { HOTEL_COLORS } from '../constants/colors';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  active: 'Publié',
  rejected: 'Refusé',
  hidden: 'Masqué',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#95a5a6',
  pending: '#f39c12',
  active: '#2E7D32',
  rejected: '#e74c3c',
  hidden: '#7f8c8d',
};

const AdminHotelsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { getHotelEstablishments, updateHotelEstablishmentStatus, deleteHotelEstablishment, loading } =
    useAdmin();

  const [rows, setRows] = useState<HotelEstablishmentWithOwner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active' | 'rejected'>('pending');
  const [selected, setSelected] = useState<HotelEstablishmentWithOwner | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      setRows(await getHotelEstablishments());
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') void load();
    }, [user, profile]),
  );

  const filtered = rows.filter((l) => (filterStatus === 'all' ? true : l.status === filterStatus));

  const ownerLabel = (l: HotelEstablishmentWithOwner) => {
    const p = l.owner_profile;
    if (!p) return '—';
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '—';
  };

  const decide = async (status: 'active' | 'rejected') => {
    if (!selected) return;
    setActionLoading(true);
    const result = await updateHotelEstablishmentStatus(
      selected.id,
      status,
      adminNotes.trim() || undefined,
    );
    setActionLoading(false);
    if (result.success) {
      setSelected(null);
      setAdminNotes('');
      await load();
      Alert.alert(
        'Succès',
        status === 'active'
          ? 'Hôtel approuvé — visible sur le site et l’app.'
          : 'Hôtel refusé.',
      );
    } else {
      Alert.alert('Erreur', result.error ?? 'Action impossible');
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    Alert.alert(
      'Supprimer l’hôtel',
      `Supprimer définitivement « ${selected.title} » ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            const result = await deleteHotelEstablishment(selected.id);
            setActionLoading(false);
            if (result.success) {
              setSelected(null);
              setAdminNotes('');
              await load();
              Alert.alert('Succès', 'Hôtel supprimé.');
            } else {
              Alert.alert('Erreur', result.error ?? 'Suppression impossible');
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modération hôtels</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filters}>
        {(['pending', 'active', 'rejected', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filterStatus === f && styles.filterChipOn]}
            onPress={() => setFilterStatus(f)}
          >
            <Text style={[styles.filterText, filterStatus === f && styles.filterTextOn]}>
              {f === 'all' ? 'Tous' : STATUS_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              colors={[HOTEL_COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun établissement dans ce filtre.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: (STATUS_COLORS[item.status] || '#999') + '22' },
                  ]}
                >
                  <Text style={{ color: STATUS_COLORS[item.status] || '#666', fontWeight: '700', fontSize: 12 }}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>{item.establishment_type || 'Hôtel'}</Text>
              <Text style={styles.meta}>{item.address || item.city || '—'}</Text>
              <Text style={styles.owner}>Propriétaire : {ownerLabel(item)}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{selected?.title}</Text>
            <Text style={styles.meta}>Statut : {STATUS_LABELS[selected?.status || ''] || selected?.status}</Text>
            <Text style={styles.owner}>Propriétaire : {selected ? ownerLabel(selected) : ''}</Text>
            <Text style={styles.notesLabel}>Notes admin</Text>
            <TextInput
              style={styles.notesInput}
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder="Optionnel"
              multiline
            />
            {(selected?.status === 'pending' || selected?.status === 'rejected') && (
              <TouchableOpacity
                style={styles.approveBtn}
                disabled={actionLoading}
                onPress={() => void decide('active')}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.approveText}>Approuver (publier)</Text>
                )}
              </TouchableOpacity>
            )}
            {(selected?.status === 'pending' || selected?.status === 'active') && (
              <TouchableOpacity
                style={styles.rejectBtn}
                disabled={actionLoading}
                onPress={() => void decide('rejected')}
              >
                <Text style={styles.rejectText}>Refuser</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deleteBtn}
              disabled={actionLoading}
              onPress={handleDelete}
            >
              <Text style={styles.deleteText}>Supprimer définitivement</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#222' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipOn: { backgroundColor: HOTEL_COLORS.light, borderColor: HOTEL_COLORS.primary },
  filterText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  filterTextOn: { color: HOTEL_COLORS.dark },
  list: { padding: 12, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  owner: { fontSize: 13, color: '#334155', marginTop: 6 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  notesLabel: { marginTop: 14, fontSize: 13, fontWeight: '600', color: '#475569' },
  notesInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  approveBtn: {
    marginTop: 16,
    backgroundColor: HOTEL_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  approveText: { color: '#fff', fontWeight: '700' },
  rejectBtn: {
    marginTop: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rejectText: { color: '#b91c1c', fontWeight: '700' },
  deleteBtn: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteText: { color: '#dc2626', fontWeight: '600' },
  closeBtn: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  closeText: { color: '#64748b', fontWeight: '600' },
});

export default AdminHotelsScreen;
