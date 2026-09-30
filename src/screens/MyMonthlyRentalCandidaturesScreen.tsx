import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import { monthlyRentalDocumentLabel } from '../constants/monthlyRentalDocuments';
import type { MonthlyRentalCandidature } from '../types';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Dossier envoyé',
  viewed: 'Vu par le propriétaire',
  accepted: 'Accepté — visite à organiser',
  rejected: 'Refusé',
  visit_authorized: 'Visite autorisée',
  docs_requested: 'Documents demandés',
};

const STATUS_COLOR: Record<string, string> = {
  sent: '#2563eb',
  viewed: '#7c3aed',
  accepted: '#16a34a',
  rejected: '#dc2626',
  visit_authorized: '#0d9488',
  docs_requested: '#b45309',
};

type Row = MonthlyRentalCandidature & { listing_title?: string; listing_location?: string };

export default function MyMonthlyRentalCandidaturesScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { getByTenantId, appendDocuments, loading } = useMonthlyRentalCandidatures();
  const [rows, setRows] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getByTenantId();
    setRows(data);
  }, [getByTenantId]);

  useFocusEffect(
    useCallback(() => {
      if (user) void load();
    }, [user, load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const uploadDoc = async (candidatureId: string, docType: string) => {
    if (!user) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      setUploadingId(candidatureId);
      const ext = asset.name?.split('.').pop() || 'bin';
      const path = `monthly-candidatures/${user.id}/${candidatureId}/${docType}-${Date.now()}.${ext}`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: upErr } = await supabase.storage.from('property-images').upload(
        path,
        new Uint8Array(arrayBuffer),
        {
          upsert: true,
          contentType: asset.mimeType || undefined,
        },
      );
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('property-images').getPublicUrl(path);
      const result = await appendDocuments(candidatureId, [
        { type: docType, url: urlData.publicUrl, name: asset.name || docType },
      ]);
      if (!result.success) throw new Error(result.error);
      Alert.alert('Document envoyé');
      await load();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setUploadingId(null);
    }
  };

  const renderItem = ({ item }: { item: Row }) => {
    const requested = item.requested_documents || [];
    const uploadedTypes = new Set((item.application_documents || []).map((d) => d.type));
    const missing = requested.filter((t) => !uploadedTypes.has(t));
    const showUpload = item.status === 'docs_requested' || missing.length > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('MonthlyRentalListingDetail', { listingId: item.listing_id })
        }
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.listing_title || 'Logement'}
          </Text>
          <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[item.status] || '#6b7280'}18` }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] || '#6b7280' }]}>
              {STATUS_LABEL[item.status] || item.status}
            </Text>
          </View>
        </View>
        {item.listing_location ? (
          <Text style={styles.location} numberOfLines={1}>
            <Ionicons name="location-outline" size={13} color="#64748b" /> {item.listing_location}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          Envoyé le {new Date(item.created_at).toLocaleDateString('fr-FR')}
          {item.desired_move_in_date
            ? ` · Entrée souhaitée ${new Date(item.desired_move_in_date).toLocaleDateString('fr-FR')}`
            : ''}
        </Text>
        {item.status === 'accepted' ? (
          <Text style={styles.hintSuccess}>
            Le propriétaire a accepté votre dossier. Organisez la visite via la messagerie.
          </Text>
        ) : null}
        {item.status === 'visit_authorized' ? (
          <Text style={styles.hintSuccess}>
            Visite autorisée — contactez le propriétaire pour convenir d&apos;un créneau.
          </Text>
        ) : null}
        {item.status === 'rejected' ? (
          <Text style={styles.hintMuted}>Vous pouvez consulter d&apos;autres annonces sur AkwaHome.</Text>
        ) : null}

        {Array.isArray(item.application_documents) && item.application_documents.length > 0 ? (
          <View style={styles.docsBlock}>
            {(item.application_documents || []).map((doc) => (
              <TouchableOpacity key={`${doc.type}-${doc.url}`} onPress={() => Linking.openURL(doc.url)}>
                <Text style={styles.docLink}>
                  {monthlyRentalDocumentLabel(doc.type)} — {doc.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {showUpload ? (
          <View style={styles.uploadBox}>
            <Text style={styles.uploadTitle}>Documents complémentaires à fournir</Text>
            <Text style={styles.uploadHint}>
              Le propriétaire a demandé des pièces supplémentaires.
            </Text>
            {(missing.length > 0 ? missing : requested).map((docType) => (
              <TouchableOpacity
                key={docType}
                style={styles.uploadBtn}
                disabled={uploadingId === item.id}
                onPress={(e) => {
                  e.stopPropagation?.();
                  void uploadDoc(item.id, docType);
                }}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={MONTHLY_RENTAL_COLORS.primary} />
                <Text style={styles.uploadBtnText}>{monthlyRentalDocumentLabel(docType)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes candidatures</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={MONTHLY_RENTAL_COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MONTHLY_RENTAL_COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Aucune candidature</Text>
              <Text style={styles.emptyText}>
                Postulez depuis une annonce en bail longue durée pour suivre l&apos;avancement de votre
                dossier ici.
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => navigation.navigate('Search', { initialRentalType: 'monthly' })}
              >
                <Text style={styles.ctaText}>Rechercher un logement</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  list: { padding: 16, gap: 12 },
  emptyWrap: { flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  location: { marginTop: 8, fontSize: 13, color: '#64748b' },
  meta: { marginTop: 6, fontSize: 12, color: '#94a3b8' },
  hintSuccess: { marginTop: 10, fontSize: 13, color: '#166534', lineHeight: 18 },
  hintMuted: { marginTop: 10, fontSize: 13, color: '#64748b', lineHeight: 18 },
  docsBlock: { marginTop: 10, gap: 4 },
  docLink: { fontSize: 13, color: MONTHLY_RENTAL_COLORS.primary, textDecorationLine: 'underline' },
  uploadBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  uploadHint: { marginTop: 4, fontSize: 12, color: '#a16207', marginBottom: 8 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  uploadBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#334155' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 48,
  },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '700', color: '#0f172a' },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: 20,
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
