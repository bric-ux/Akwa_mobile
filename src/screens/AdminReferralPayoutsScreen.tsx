import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

interface HostReferralRow {
  id: string;
  referrer_id: string;
  cash_reward_amount: number | null;
  cash_reward_paid: boolean | null;
  completed_at: string | null;
  approval_campaign_reward: boolean | null;
}

type EnrichedReferral = HostReferralRow & {
  referrer_profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  payment: {
    mobile_money_number: string | null;
    mobile_money_provider: string | null;
  } | null;
};

function formatFcfa(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const AdminReferralPayoutsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [rows, setRows] = useState<EnrichedReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingReferrerId, setProcessingReferrerId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const { data: pending, error } = await supabase
        .from('host_referrals')
        .select('*')
        .eq('approval_campaign_reward', true)
        .gt('cash_reward_amount', 0)
        .or('cash_reward_paid.is.null,cash_reward_paid.eq.false')
        .order('completed_at', { ascending: false });

      if (error) throw error;

      const list = (pending || []) as HostReferralRow[];
      const referrerIds = [...new Set(list.map((r) => r.referrer_id))];

      const [profilesRes, paymentsRes] = await Promise.all([
        referrerIds.length
          ? supabase
              .from('profiles')
              .select('user_id, first_name, last_name, email, phone')
              .in('user_id', referrerIds)
          : Promise.resolve({ data: [] as const, error: null }),
        referrerIds.length
          ? supabase
              .from('host_payment_info')
              .select('user_id, mobile_money_number, mobile_money_provider')
              .in('user_id', referrerIds)
          : Promise.resolve({ data: [] as const, error: null }),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const profileMap = new Map(
        (profilesRes.data || []).map((p) => [p.user_id, p])
      );
      const paymentMap = new Map(
        (paymentsRes.data || []).map((p) => [p.user_id, p])
      );

      const enriched: EnrichedReferral[] = list.map((r) => ({
        ...r,
        referrer_profile: profileMap.get(r.referrer_id) ?? null,
        payment: paymentMap.get(r.referrer_id) ?? null,
      }));

      setRows(enriched);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de charger les parrainages à payer.');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (user && profile?.role === 'admin') {
        load();
      }
    }, [user, profile?.role, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  };

  const totalPending = useMemo(
    () =>
      rows.reduce((s, r) => s + (Number(r.cash_reward_amount) || 0), 0),
    [rows]
  );

  const byReferrer = useMemo(() => {
    const m = new Map<string, { total: number; items: EnrichedReferral[] }>();
    for (const r of rows) {
      const cur = m.get(r.referrer_id) || { total: 0, items: [] };
      cur.total += Number(r.cash_reward_amount) || 0;
      cur.items.push(r);
      m.set(r.referrer_id, cur);
    }
    return m;
  }, [rows]);

  const markPaid = async (referralIds: string[]) => {
    if (!user?.id || referralIds.length === 0) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('host_referrals')
      .update({
        cash_reward_paid: true,
        referral_payout_paid_at: now,
        referral_payout_marked_by: user.id,
        updated_at: now,
      })
      .in('id', referralIds);

    if (error) {
      Alert.alert('Erreur', error.message);
      return;
    }

    Alert.alert(
      'Paiement enregistré',
      `${referralIds.length} ligne(s) marquée(s) comme payée(s) (Wave).`
    );
    await load({ silent: true });
  };

  const handleMarkOne = async (id: string) => {
    setProcessingId(id);
    try {
      await markPaid([id]);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllForReferrer = async (referrerId: string) => {
    const ids = rows.filter((r) => r.referrer_id === referrerId).map((r) => r.id);
    setProcessingReferrerId(referrerId);
    try {
      await markPaid(ids);
    } finally {
      setProcessingReferrerId(null);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Non connecté</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Auth' as never)}
          >
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color="#e74c3c" />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payer parrainage</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.muted}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payer parrainage</Text>
        <TouchableOpacity
          onPress={() => load({ silent: true })}
          style={styles.refreshButton}
          disabled={loading || refreshing}
        >
          <Ionicons name="refresh" size={22} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e74c3c']} />
        }
      >
        <Text style={styles.intro}>
          Campagne 1 000 FCFA (candidature approuvée). Régler par Wave puis marquer payé — la ligne
          disparaît de la liste.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total à payer</Text>
          <Text style={styles.totalAmount}>{formatFcfa(totalPending)}</Text>
          <Text style={styles.muted}>
            {rows.length} ligne(s) en attente — regroupement par parrain ci-dessous.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Par parrain</Text>
        {byReferrer.size === 0 && !loading ? (
          <Text style={styles.muted}>Aucun paiement en attente.</Text>
        ) : (
          [...byReferrer.entries()].map(([referrerId, { total, items }]) => {
            const p = items[0]?.referrer_profile;
            const label =
              p?.first_name || p?.last_name
                ? `${p?.first_name || ''} ${p?.last_name || ''}`.trim()
                : referrerId.slice(0, 8);
            return (
              <View key={referrerId} style={styles.referrerRow}>
                <View style={styles.referrerRowText}>
                  <Text style={styles.referrerName}>{label}</Text>
                  <Text style={styles.muted}>
                    {items.length} ligne(s) — {formatFcfa(total)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.smallButton,
                    (processingReferrerId === referrerId || processingId !== null) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() => handleMarkAllForReferrer(referrerId)}
                  disabled={
                    loading || processingReferrerId === referrerId || processingId !== null
                  }
                >
                  {processingReferrerId === referrerId ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.smallButtonText}>Tout payé (Wave)</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Détail des lignes</Text>
        {rows.length === 0 ? (
          <Text style={styles.muted}>Aucune ligne à afficher.</Text>
        ) : (
          rows.map((r) => {
            const p = r.referrer_profile;
            const wave = r.payment?.mobile_money_number;
            const provider = r.payment?.mobile_money_provider;
            return (
              <View key={r.id} style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Ionicons name="person-outline" size={18} color="#666" />
                  <View style={styles.detailHeaderText}>
                    <Text style={styles.detailName}>
                      {p?.first_name || p?.last_name
                        ? `${p?.first_name || ''} ${p?.last_name || ''}`.trim()
                        : r.referrer_id.slice(0, 8)}
                    </Text>
                    {p?.email ? (
                      <Text style={styles.mutedSmall} numberOfLines={1}>
                        {p.email}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {wave ? (
                  <View style={styles.waveRow}>
                    <Ionicons name="call-outline" size={16} color="#333" />
                    <Text style={styles.waveText}>{wave}</Text>
                    {provider ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{provider}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.warningText}>
                    {`Pas d'infos Wave (host_payment_info)`}
                  </Text>
                )}
                <View style={styles.detailFooter}>
                  <View>
                    <Text style={styles.amount}>{formatFcfa(Number(r.cash_reward_amount) || 0)}</Text>
                    <Text style={styles.mutedSmall}>{formatDateTime(r.completed_at)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.smallButton,
                      processingId === r.id && styles.buttonDisabled,
                    ]}
                    onPress={() => handleMarkOne(r.id)}
                    disabled={processingId === r.id || processingReferrerId !== null}
                  >
                    {processingId === r.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.smallButtonText}>Marquer payé</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerRight: {
    width: 32,
  },
  refreshButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  intro: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2E7D32',
  },
  muted: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
  mutedSmall: {
    fontSize: 12,
    color: '#888',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  sectionSpaced: {
    marginTop: 8,
  },
  referrerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 8,
  },
  referrerRowText: {
    flex: 1,
  },
  referrerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  smallButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  waveText: {
    fontSize: 14,
    color: '#333',
  },
  badge: {
    backgroundColor: '#eef2f7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    color: '#555',
  },
  warningText: {
    fontSize: 13,
    color: '#c27c00',
    marginTop: 10,
  },
  detailFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default AdminReferralPayoutsScreen;
