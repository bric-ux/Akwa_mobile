import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import {
  adminBookingStatusTitle,
  fetchAdminBookingStatusList,
  type AdminBookingSummary,
} from '../lib/adminBookingStatusList';

function formatDay(value?: string | null): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} F`;
}

function openContact(kind: 'tel' | 'mailto', value: string) {
  const href = kind === 'tel' ? `tel:${value.replace(/\s/g, '')}` : `mailto:${value}`;
  void Linking.openURL(href);
}

function ContactLines({
  label,
  name,
  phone,
  email,
}: {
  label: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  return (
    <View style={styles.contactBlock}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.line}>{name?.trim() || '—'}</Text>
      {phone ? (
        <Text style={styles.link} onPress={() => openContact('tel', phone)}>
          {phone}
        </Text>
      ) : (
        <Text style={styles.missing}>Téléphone non renseigné</Text>
      )}
      {email ? (
        <Text style={styles.link} onPress={() => openContact('mailto', email)}>
          {email}
        </Text>
      ) : (
        <Text style={styles.missing}>E-mail non renseigné</Text>
      )}
    </View>
  );
}

const AdminBookingStatusListScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AdminBookingStatusList'>>();
  const { service, status } = route.params;
  const [rows, setRows] = useState<AdminBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchAdminBookingStatusList(service, status);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [service, status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>
          {adminBookingStatusTitle(service, status)}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.center} color="#64748b" />
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aucune réservation</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.guestName}</Text>
              <Text style={styles.listing} numberOfLines={1}>
                {item.listingTitle}
              </Text>
              <Text style={styles.meta}>
                {formatDay(item.checkIn)} → {formatDay(item.checkOut)} · {item.nights} nuit
                {item.nights > 1 ? 's' : ''}
              </Text>
              <Text style={styles.line}>Payé {formatFcfa(item.paid)}</Text>
              <Text style={styles.line}>Frais AkwaHome {formatFcfa(item.akwaFee)}</Text>
              <Text style={styles.line}>Propriétaire {formatFcfa(item.hostNet)}</Text>
              {service === 'residences' ? (
                <View style={styles.contacts}>
                  <ContactLines
                    label="Voyageur"
                    name={item.guestName}
                    phone={item.guestPhone}
                    email={item.guestEmail}
                  />
                  <ContactLines
                    label="Hôte"
                    name={item.hostName}
                    phone={item.hostPhone}
                    email={item.hostEmail}
                  />
                </View>
              ) : null}
              {item.modified ? <Text style={styles.modified}>Modifiée</Text> : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  center: { marginTop: 40 },
  list: { padding: 12, gap: 8, paddingBottom: 32 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#64748b', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  name: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  listing: { marginTop: 2, fontSize: 13, color: '#334155' },
  meta: { marginTop: 4, fontSize: 12, color: '#64748b' },
  line: { marginTop: 2, fontSize: 13, color: '#0f172a' },
  contacts: {
    marginTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  contactBlock: { gap: 2 },
  contactLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  link: { marginTop: 2, fontSize: 13, fontWeight: '600', color: '#c2410c' },
  missing: { marginTop: 2, fontSize: 12, color: '#94a3b8' },
  modified: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#c2410c' },
});

export default AdminBookingStatusListScreen;
