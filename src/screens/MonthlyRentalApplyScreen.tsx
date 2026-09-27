import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import type { MonthlyRentalCandidature, RootStackParamList } from '../types';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Envoyée',
  viewed: 'Vue',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

type Route = RouteProp<RootStackParamList, 'MonthlyRentalApply'>;

export default function MonthlyRentalApplyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { listingId, listingTitle } = route.params;
  const { user } = useAuth();
  const { submitCandidature, getMyCandidatureForListing, loading } = useMonthlyRentalCandidatures();
  const [existing, setExisting] = useState<MonthlyRentalCandidature | null>(null);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    message: '',
    desired_move_in_date: '',
    duration_months: '',
  });

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [candidature, profileRes] = await Promise.all([
        getMyCandidatureForListing(listingId),
        supabase
          .from('profiles')
          .select('first_name, last_name, email, phone, phone_e164')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setExisting(candidature);
      const profile = profileRes.data;
      if (!candidature && profile) {
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
        setForm((prev) => ({
          ...prev,
          full_name: name || prev.full_name,
          email: profile.email || user.email || prev.email,
          phone: profile.phone_e164 || profile.phone || prev.phone,
        }));
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, listingId, getMyCandidatureForListing]);

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      Alert.alert('Champs requis', 'Nom, email et téléphone sont obligatoires.');
      return;
    }
    const result = await submitCandidature({
      listing_id: listingId,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      message: form.message || undefined,
      desired_move_in_date: form.desired_move_in_date || undefined,
      duration_months: form.duration_months
        ? parseInt(form.duration_months, 10)
        : undefined,
    });
    if (result.success) {
      Alert.alert('Candidature envoyée', `Votre demande pour « ${listingTitle} » a été transmise.`);
      const candidature = await getMyCandidatureForListing(listingId);
      setExisting(candidature);
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d’envoyer la candidature.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Candidater
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {checking ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={MONTHLY_RENTAL_COLORS.primary} />
      ) : !user ? (
        <View style={styles.box}>
          <Text style={styles.boxText}>Connectez-vous pour candidater à cette annonce.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              navigation.navigate('Auth', {
                returnTo: 'MonthlyRentalApply',
                returnParams: { listingId, listingTitle },
              })
            }
          >
            <Text style={styles.primaryBtnText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      ) : existing ? (
        <View style={[styles.box, styles.boxSuccess]}>
          <Text style={styles.successTitle}>Candidature envoyée</Text>
          <Text style={styles.boxText}>
            Statut : {STATUS_LABEL[existing.status] || existing.status}
          </Text>
          <Text style={[styles.boxText, { marginTop: 8 }]}>
            Le propriétaire vous contactera si votre candidature est retenue.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Candidater pour ce logement</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {listingTitle}
            </Text>

            <Text style={styles.label}>Nom complet *</Text>
            <TextInput
              style={styles.input}
              value={form.full_name}
              onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))}
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
            />

            <Text style={styles.label}>Téléphone *</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
            />

            <Text style={styles.label}>Date d’entrée souhaitée (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-10-01"
              placeholderTextColor="#94a3b8"
              value={form.desired_move_in_date}
              onChangeText={(v) => setForm((f) => ({ ...f, desired_move_in_date: v }))}
            />

            <Text style={styles.label}>Durée (mois)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={form.duration_months}
              onChangeText={(v) => setForm((f) => ({ ...f, duration_months: v }))}
            />

            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
              placeholder="Présentez-vous et précisez vos besoins…"
              placeholderTextColor="#94a3b8"
              value={form.message}
              onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Envoyer ma candidature</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#333' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 4 },
  sub: { fontSize: 14, color: '#666', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 14,
  },
  textarea: { minHeight: 100, paddingTop: 12 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  box: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  boxSuccess: { backgroundColor: '#e8f5e9', borderColor: '#a5d6a7' },
  successTitle: { fontSize: 16, fontWeight: '700', color: '#1b5e20', marginBottom: 6 },
  boxText: { fontSize: 14, color: '#444', lineHeight: 20 },
});
