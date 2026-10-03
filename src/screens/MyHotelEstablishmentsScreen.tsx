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
import MediaThumb from '../components/MediaThumb';
import { useLanguage } from '../contexts/LanguageContext';

type HotelRow = {
  id: string;
  title: string;
  establishment_type: string;
  status: string;
  address: string | null;
  images?: string[] | null;
};

function coverUri(item: HotelRow): string {
  if (Array.isArray(item.images) && item.images.length > 0 && item.images[0]) {
    return item.images[0];
  }
  return 'https://via.placeholder.com/160x160?text=Hôtel';
}

export default function MyHotelEstablishmentsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [rows, setRows] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      hotel: t('hotelEstablishment.typeHotel'),
      guesthouse: t('hotelEstablishment.typeGuesthouse'),
      residence: t('hotelEstablishment.typeResidence'),
      aparthotel: t('hotelEstablishment.typeAparthotel'),
    };
    return map[type] || type;
  };

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('hotel_establishments')
        .select('id, title, establishment_type, status, address, images')
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
    if (s === 'active') return t('hotelOwner.statusPublished');
    if (s === 'pending') return t('hotelOwner.statusValidating');
    if (s === 'rejected') return t('hotelOwner.statusRejected');
    if (s === 'hidden') return t('hotelOwner.statusHidden');
    return t('hotelOwner.statusDraft');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('hotelOwner.myEstablishments')}</Text>
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
              <Text style={styles.emptyTitle}>{t('hotelOwner.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('hotelOwner.emptyDesc')}</Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate('AddHotelEstablishment')}
              >
                <Text style={styles.ctaText}>{t('hotelOwner.addEstablishment')}</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('AddHotelEstablishment', { establishmentId: item.id })
              }
            >
              <MediaThumb
                uri={coverUri(item)}
                style={styles.thumb}
                resizeMode="cover"
                contentPosition="center"
                fitWholeImage
                recyclingKey={`hotel-est-${item.id}`}
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {typeLabel(item.establishment_type)}
                  {' · '}
                  {statusLabel(item.status)}
                </Text>
                {!!item.address && (
                  <Text style={styles.cardAddr} numberOfLines={1}>
                    {item.address}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>
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
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: HOTEL_COLORS.light,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  cardMeta: { marginTop: 2, fontSize: 12, color: HOTEL_COLORS.primary, fontWeight: '600' },
  cardAddr: { marginTop: 4, fontSize: 13, color: '#64748b' },
});
