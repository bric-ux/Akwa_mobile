import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { HOTEL_COLORS } from '../constants/colors';

type HotelRow = {
  id: string;
  title: string;
  establishment_type: string;
  status: string;
  address: string | null;
};

export default function MyHotelEstablishmentsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [rows, setRows] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('hotel_establishments')
        .select('id, title, establishment_type, status, address')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data as HotelRow[]) || []);
    } catch (e) {
      console.error('MyHotelEstablishments load:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const statusLabel = (s: string) => {
    if (s === 'active') return 'Actif';
    if (s === 'hidden') return 'Masqué';
    return 'Brouillon';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes établissements</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddHotelEstablishment')}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={HOTEL_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={HOTEL_COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="business-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Aucun établissement</Text>
              <Text style={styles.emptyText}>
                Créez votre premier hôtel ou maison d’hôtes pour commencer.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate('AddHotelEstablishment')}
              >
                <Text style={styles.ctaText}>Ajouter un établissement</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.badge, { backgroundColor: HOTEL_COLORS.light }]}>
                <Ionicons name="business" size={20} color={HOTEL_COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.establishment_type} · {statusLabel(item.status)}
                </Text>
                {!!item.address && <Text style={styles.cardAddr}>{item.address}</Text>}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: HOTEL_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 16, gap: 10 },
  emptyWrap: { flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: 20,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cardMeta: { marginTop: 2, fontSize: 12, color: HOTEL_COLORS.primary, fontWeight: '600' },
  cardAddr: { marginTop: 4, fontSize: 13, color: '#64748b' },
});
