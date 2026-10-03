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
  Linking,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import { useMonthlyRentalListings } from '../hooks/useMonthlyRentalListings';
import type { MonthlyRentalCandidature } from '../types';
import {
  MONTHLY_RENTAL_DOCUMENT_OPTIONS,
  monthlyRentalDocumentLabel,
} from '../constants/monthlyRentalDocuments';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import SimpleMessageModal from '../components/SimpleMessageModal';
import { useLanguage } from '../contexts/LanguageContext';

type RouteParams = { listingId: string };

const STATUS_COLOR: Record<string, string> = {
  sent: '#f59e0b',
  viewed: '#1976d2',
  accepted: '#2E7D32',
  rejected: '#c62828',
  visit_authorized: '#0d9488',
  docs_requested: '#b45309',
};

const MonthlyRentalCandidaturesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? 'en-US' : 'fr-FR';
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const listingId = route.params?.listingId;

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      sent: t('monthlyHost.hostStatusSent'),
      viewed: t('monthlyHost.hostStatusViewed'),
      accepted: t('monthlyHost.hostStatusAccepted'),
      rejected: t('monthlyHost.hostStatusRejected'),
      visit_authorized: t('monthlyHost.hostStatusVisitAuthorized'),
      docs_requested: t('monthlyHost.hostStatusDocsRequested'),
    };
    return map[status] || status;
  };
  const {
    getByListingId,
    acceptCandidature,
    rejectCandidature,
    authorizeVisit,
    requestDocuments,
    markSentAsViewed,
    deleteCandidature,
    loading,
  } = useMonthlyRentalCandidatures();
  const { getListingById } = useMonthlyRentalListings();
  const [candidatures, setCandidatures] = useState<MonthlyRentalCandidature[]>([]);
  const [listingTitle, setListingTitle] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [messageTarget, setMessageTarget] = useState<MonthlyRentalCandidature | null>(null);
  const [docsTarget, setDocsTarget] = useState<MonthlyRentalCandidature | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!listingId) return;
    const [list, listing] = await Promise.all([
      getByListingId(listingId),
      getListingById(listingId),
    ]);
    const hasSent = list.some((c) => c.status === 'sent');
    if (hasSent) {
      await markSentAsViewed(listingId);
      setCandidatures(await getByListingId(listingId));
    } else {
      setCandidatures(list);
    }
    if (listing) setListingTitle(listing.title);
  }, [listingId, getByListingId, getListingById, markSentAsViewed]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAccept = (c: MonthlyRentalCandidature) => {
    Alert.alert(t('monthlyHost.acceptTitle'), t('monthlyHost.acceptConfirm', { name: c.full_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('monthlyHost.accept'),
        onPress: async () => {
          const r = await acceptCandidature(c.id);
          if (r.success) load();
          else Alert.alert(t('common.error'), r.error);
        },
      },
    ]);
  };

  const handleReject = (c: MonthlyRentalCandidature) => {
    Alert.alert(t('monthlyHost.rejectTitle'), t('monthlyHost.rejectConfirm', { name: c.full_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('monthlyHost.reject'),
        style: 'destructive',
        onPress: async () => {
          const r = await rejectCandidature(c.id);
          if (r.success) load();
          else Alert.alert(t('common.error'), r.error);
        },
      },
    ]);
  };

  const handleDelete = (c: MonthlyRentalCandidature) => {
    Alert.alert(
      t('monthlyHost.deleteRequestTitle'),
      t('monthlyHost.deleteRequestConfirm', { name: c.full_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const r = await deleteCandidature(c.id);
            if (r.success) load();
            else Alert.alert(t('common.error'), r.error);
          },
        },
      ],
    );
  };

  const handleAuthorizeVisit = (c: MonthlyRentalCandidature) => {
    Alert.alert(t('monthlyHost.authorizeTitle'), t('monthlyHost.authorizeConfirm', { name: c.full_name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('monthlyHost.authorizeVisit'),
        onPress: async () => {
          const r = await authorizeVisit(c.id);
          if (r.success) {
            Alert.alert(t('monthlyHost.authorizeSuccess'), t('monthlyHost.authorizeSuccessDesc'));
            load();
          } else Alert.alert(t('common.error'), r.error);
        },
      },
    ]);
  };

  const openDocsModal = (c: MonthlyRentalCandidature) => {
    setDocsTarget(c);
    setSelectedDocs(c.requested_documents || []);
  };

  const confirmDocs = async () => {
    if (!docsTarget || selectedDocs.length === 0) {
      Alert.alert(t('monthlyHost.selection'), t('monthlyHost.docsSelectRequired'));
      return;
    }
    const r = await requestDocuments(docsTarget.id, selectedDocs);
    if (r.success) {
      setDocsTarget(null);
      Alert.alert(t('monthlyHost.docsRequestSent'), t('monthlyHost.docsRequestSentDesc'));
      load();
    } else Alert.alert(t('common.error'), r.error);
  };

  const isOpen = (s: string) =>
    s === 'sent' || s === 'viewed' || s === 'docs_requested' || s === 'visit_authorized';

  const renderItem = ({ item }: { item: MonthlyRentalCandidature }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.full_name}</Text>
        <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] || '#999') + '20' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] || '#666' }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.email}>{item.email}</Text>
      <Text style={styles.phone}>{item.phone}</Text>
      {item.message ? (
        <Text style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>
      ) : null}
      {Array.isArray(item.application_documents) && item.application_documents.length > 0 ? (
        <View style={styles.docs}>
          <Text style={styles.docsTitle}>{t('monthlyHost.attachedDocs')}</Text>
          {item.application_documents.map((doc) => (
            <TouchableOpacity
              key={`${doc.type}-${doc.url}`}
              style={styles.docLink}
              onPress={() => Linking.openURL(doc.url)}
            >
              <Ionicons name="document-text-outline" size={16} color={MONTHLY_RENTAL_COLORS.primary} />
              <Text style={styles.docLinkText} numberOfLines={1}>
                {monthlyRentalDocumentLabel(doc.type)}
              </Text>
              <Ionicons name="open-outline" size={14} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {Array.isArray(item.requested_documents) && item.requested_documents.length > 0 ? (
        <Text style={styles.requestedHint}>
          {t('monthlyHost.requestedDocs', { list: item.requested_documents.map(monthlyRentalDocumentLabel).join(', ') })}
        </Text>
      ) : null}
      {(item.desired_move_in_date || item.duration_months) && (
        <View style={styles.meta}>
          {item.desired_move_in_date && (
            <Text style={styles.metaText}>{t('monthlyHost.desiredEntry', { date: item.desired_move_in_date })}</Text>
          )}
          {item.duration_months != null && (
            <Text style={styles.metaText}>{t('monthlyHost.duration', { count: String(item.duration_months) })}</Text>
          )}
        </View>
      )}
      <Text style={styles.date}>
        {t('monthlyHost.applicationDate', { date: new Date(item.created_at).toLocaleDateString(dateLocale) })}
      </Text>
      <TouchableOpacity
        style={styles.btnMessage}
        onPress={() => setMessageTarget(item)}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-outline" size={18} color={MONTHLY_RENTAL_COLORS.primary} />
        <Text style={styles.btnMessageText}>{t('monthlyHost.reply')}</Text>
      </TouchableOpacity>
      {isOpen(item.status) ? (
        <View style={styles.actionsCol}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => handleAuthorizeVisit(item)}>
            <Ionicons name="calendar-outline" size={18} color={MONTHLY_RENTAL_COLORS.primary} />
            <Text style={styles.btnSecondaryText}>{t('monthlyHost.authorizeVisit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => openDocsModal(item)}>
            <Ionicons name="document-attach-outline" size={18} color={MONTHLY_RENTAL_COLORS.primary} />
            <Text style={styles.btnSecondaryText}>{t('monthlyHost.requestDocs')}</Text>
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnAccept} onPress={() => handleAccept(item)}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.btnAcceptText}>{t('monthlyHost.accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnReject} onPress={() => handleReject(item)}>
              <Ionicons name="close-circle-outline" size={20} color="#c62828" />
              <Text style={styles.btnRejectText}>{t('monthlyHost.reject')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btnDelete} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={18} color="#b91c1c" />
            <Text style={styles.btnDeleteText}>{t('monthlyHost.deleteRequest')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('monthlyHost.candidaturesTitle')}{listingTitle ? ` · ${listingTitle}` : ''}
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2E7D32']} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color="#ccc" />
              <Text style={styles.emptyTitle}>{t('monthlyHost.candidaturesEmpty')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('monthlyHost.candidaturesEmptyDesc')}
              </Text>
            </View>
          }
        />
      )}
      {listingId && messageTarget ? (
        <SimpleMessageModal
          visible={!!messageTarget}
          onClose={() => setMessageTarget(null)}
          monthlyListingId={listingId}
          otherParticipant={{
            id: messageTarget.tenant_id,
            name: messageTarget.full_name,
            isHost: false,
          }}
        />
      ) : null}

      <Modal visible={!!docsTarget} animationType="slide" transparent onRequestClose={() => setDocsTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('monthlyHost.docsModalTitle')}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {MONTHLY_RENTAL_DOCUMENT_OPTIONS.map((opt) => {
                const on = selectedDocs.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={styles.docOption}
                    onPress={() =>
                      setSelectedDocs((prev) =>
                        on ? prev.filter((id) => id !== opt.id) : [...prev, opt.id],
                      )
                    }
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? MONTHLY_RENTAL_COLORS.primary : '#94a3b8'}
                    />
                    <Text style={styles.docOptionText}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDocsTarget(null)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={() => void confirmDocs()}>
                <Text style={styles.modalConfirmText}>{t('monthlyHost.send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  name: { fontSize: 16, fontWeight: '600', color: '#222', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  email: { fontSize: 14, color: '#555', marginBottom: 2 },
  phone: { fontSize: 14, color: '#555', marginBottom: 8 },
  message: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 8 },
  docs: { marginBottom: 10, gap: 6 },
  docsTitle: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 4 },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
  },
  docLinkText: { flex: 1, fontSize: 13, color: '#334155' },
  requestedHint: { fontSize: 12, color: '#b45309', marginBottom: 8 },
  meta: { marginBottom: 6 },
  metaText: { fontSize: 13, color: '#666' },
  date: { fontSize: 12, color: '#999', marginBottom: 12 },
  btnMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MONTHLY_RENTAL_COLORS.primary,
    marginBottom: 10,
  },
  btnMessageText: { color: MONTHLY_RENTAL_COLORS.primary, fontWeight: '600', fontSize: 14 },
  actionsCol: { gap: 8 },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  btnSecondaryText: { color: MONTHLY_RENTAL_COLORS.primary, fontWeight: '600', fontSize: 14 },
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
  btnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff',
  },
  btnDeleteText: { color: '#b91c1c', fontWeight: '600', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 12 },
  docOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  docOptionText: { flex: 1, fontSize: 14, color: '#334155' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  modalCancelText: { fontWeight: '600', color: '#64748b' },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    alignItems: 'center',
  },
  modalConfirmText: { fontWeight: '700', color: '#fff' },
});

export default MonthlyRentalCandidaturesScreen;
