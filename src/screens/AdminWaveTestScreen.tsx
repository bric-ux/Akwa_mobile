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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

type Draft = {
  id: string;
  checkout_token: string;
  payment_type: string;
  booking_type: string | null;
  created_at: string;
  payload: Record<string, unknown>;
};

const AdminWaveTestScreen: React.FC = () => {
  const navigation = useNavigation();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('simulate-wave-webhook', {
        body: { list_drafts: true, limit: 30 },
      });
      if (fnError) throw fnError;
      const resolved = data?.data ?? data;
      setDrafts(resolved?.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du chargement des drafts');
      setDrafts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const simulatePayment = async (checkoutToken: string) => {
    setSimulating(checkoutToken);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('simulate-wave-webhook', {
        body: { checkout_token: checkoutToken },
      });
      if (fnError) throw fnError;
      const resolved = data?.data ?? data;
      if (resolved?.error) throw new Error(resolved.error);
      setSuccess(`Réservation créée : ${resolved.booking_id}. L'app recevra is_confirmed: true au prochain polling.`);
      setManualToken('');
      loadDrafts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la simulation');
    } finally {
      setSimulating(null);
    }
  };

  const handleManualSimulate = () => {
    const token = manualToken.trim();
    if (!token) {
      setError('Veuillez entrer un checkout_token');
      return;
    }
    simulatePayment(token);
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('fr-FR');
  const getPayloadPreview = (p: Record<string, unknown>) => {
    const prop = p.propertyId ?? p.property_id;
    const checkIn = p.checkInDate ?? p.check_in;
    const checkOut = p.checkOutDate ?? p.check_out;
    return prop && checkIn && checkOut
      ? `${prop} | ${checkIn} → ${checkOut}`
      : JSON.stringify(p).slice(0, 60) + '...';
  };

  if (loading && drafts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test paiement Wave</Text>
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
        <Text style={styles.headerTitle}>Test paiement Wave</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#e67e22']} />
        }
      >
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Comment tester (sans compte Wave)</Text>
          <Text style={styles.instructionsText}>
            1. Sélectionnez une propriété, des dates, choisissez Wave, puis « Payer avec Wave ».{'\n\n'}
            2. Le draft apparaît ci-dessous (Wave peut échouer à s'ouvrir).{'\n\n'}
            3. Cliquez sur « Simuler » pour ce draft.{'\n\n'}
            4. L'app en attente recevra is_confirmed: true et affichera « Paiement confirmé ».
          </Text>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.manualSection}>
          <Text style={styles.sectionTitle}>Token manuel</Text>
          <TextInput
            style={styles.input}
            placeholder="Collez le checkout_token..."
            placeholderTextColor="#999"
            value={manualToken}
            onChangeText={setManualToken}
          />
          <TouchableOpacity
            style={[styles.simulateBtn, (!manualToken.trim() || !!simulating) && styles.btnDisabled]}
            onPress={handleManualSimulate}
            disabled={!manualToken.trim() || !!simulating}
          >
            {simulating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.simulateBtnText}>Simuler</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Drafts Wave récents</Text>
        {drafts.length === 0 ? (
          <Text style={styles.empty}>Aucun draft. Initiez un paiement Wave pour en créer un.</Text>
        ) : (
          drafts.map((d) => (
            <View key={d.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Token</Text>
                <Text style={styles.cardValue} numberOfLines={1}>{d.checkout_token.slice(0, 16)}…</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Type</Text>
                <Text style={styles.cardValue}>{d.payment_type} {d.booking_type ? `• ${d.booking_type}` : ''}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Créé</Text>
                <Text style={styles.cardValue}>{formatDate(d.created_at)}</Text>
              </View>
              <Text style={styles.payloadPreview}>{getPayloadPreview(d.payload)}</Text>
              <TouchableOpacity
                style={[styles.simulateBtn, simulating === d.checkout_token && styles.btnDisabled]}
                onPress={() => simulatePayment(d.checkout_token)}
                disabled={!!simulating}
              >
                {simulating === d.checkout_token ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={styles.simulateBtnText}>Simuler paiement</Text>
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
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  instructionsCard: {
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#8b5cf6',
  },
  instructionsTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  instructionsText: { fontSize: 13, color: '#555', lineHeight: 20 },
  errorCard: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { fontSize: 13, color: '#dc2626' },
  successCard: { backgroundColor: '#d1fae5', borderRadius: 8, padding: 12, marginBottom: 12 },
  successText: { fontSize: 13, color: '#059669' },
  manualSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  empty: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 20 },
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
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardLabel: { fontSize: 12, color: '#666', marginRight: 8 },
  cardValue: { fontSize: 13, color: '#333', flex: 1, textAlign: 'right' },
  payloadPreview: { fontSize: 11, color: '#888', marginTop: 6, marginBottom: 10 },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
  },
  btnDisabled: { opacity: 0.6 },
  simulateBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default AdminWaveTestScreen;
