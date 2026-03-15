import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { checkPaymentStatus } from '../services/cardPaymentService';

type CommissionRow = {
  id: string;
  booking_type: string;
  booking_id: string;
  amount_due: number;
  status: string;
  paid_at: string | null;
  payment_method: string | null;
  host_id: string;
  created_at: string;
};

const AdminCommissionPaymentTestScreen: React.FC = () => {
  const navigation = useNavigation();
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const loadCommissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('platform_commission_due')
        .select('id, booking_type, booking_id, amount_due, status, paid_at, payment_method, host_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCommissions((data as CommissionRow[]) || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCommissions();
    }, [loadCommissions])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCommissions();
  };

  const handleCheckStatus = async (commissionId: string) => {
    setCheckingId(commissionId);
    try {
      const result = await checkPaymentStatus({
        payment_type: 'platform_commission',
        commission_due_id: commissionId,
      });
      Alert.alert(
        'Résultat API check-payment-status',
        `commission_due_id: ${commissionId.slice(0, 8)}…\n\n` +
          `payment_status: ${result.payment_status ?? '—'}\n` +
          `is_confirmed: ${result.is_confirmed}\n` +
          (result.error ? `\nerror: ${result.error}` : '')
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Vérification impossible');
    } finally {
      setCheckingId(null);
    }
  };

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';
  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test paiement commission</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e67e22" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Test paiement commission</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e67e22']} />
        }
      >
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Comment tester</Text>
          <Text style={styles.instructionsText}>
            1. Avec un compte hôte/propriétaire, aller dans Remboursements & Pénalités → onglet Commissions.{'\n\n'}
            2. Choisir une commission « À payer » → Carte bancaire → Payer.{'\n\n'}
            3. Sur Stripe Checkout (mode test), utiliser la carte : 4242 4242 4242 4242 (date/CVC au choix).{'\n\n'}
            4. Après paiement, le modal doit passer de « Paiement en attente » au succès (lecture directe Supabase + API).{'\n\n'}
            5. Vérifier dans Stripe que le webhook checkout.session.completed est envoyé à l’URL Supabase stripe-webhook.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Dernières commissions (admin)</Text>
        {commissions.length === 0 ? (
          <Text style={styles.empty}>Aucune commission.</Text>
        ) : (
          commissions.map((row) => (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>ID</Text>
                <Text style={styles.cardValue} numberOfLines={1}>{row.id.slice(0, 8)}…</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Type / Résa</Text>
                <Text style={styles.cardValue}>{row.booking_type} • #{row.booking_id.slice(0, 8)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Montant</Text>
                <Text style={styles.cardValue}>{formatPrice(row.amount_due)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Statut</Text>
                <View style={[styles.badge, row.status === 'paid' ? styles.badgePaid : styles.badgePending]}>
                  <Text style={styles.badgeText}>{row.status}</Text>
                </View>
              </View>
              {row.paid_at && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Payé le</Text>
                  <Text style={styles.cardValue}>{formatDate(row.paid_at)}</Text>
                </View>
              )}
              {row.payment_method && (
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Moyen</Text>
                  <Text style={styles.cardValue}>{row.payment_method}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.checkBtn, checkingId === row.id && styles.checkBtnDisabled]}
                onPress={() => handleCheckStatus(row.id)}
                disabled={checkingId !== null}
              >
                {checkingId === row.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={18} color="#fff" />
                    <Text style={styles.checkBtnText}>Vérifier statut API</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  instructionsCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#e67e22',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  empty: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  cardValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePaid: {
    backgroundColor: '#d1fae5',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  checkBtnDisabled: {
    opacity: 0.7,
  },
  checkBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AdminCommissionPaymentTestScreen;
