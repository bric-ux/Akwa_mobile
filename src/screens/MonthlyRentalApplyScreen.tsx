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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { useMonthlyRentalCandidatures } from '../hooks/useMonthlyRentalCandidatures';
import type { MonthlyRentalCandidature, RootStackParamList } from '../types';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import {
  monthlyRentalDocumentLabel,
  type MonthlyRentalApplicationDocument,
} from '../constants/monthlyRentalDocuments';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Dossier envoyé',
  viewed: 'Dossier vu par le propriétaire',
  accepted: 'Dossier accepté — visite à organiser',
  rejected: 'Dossier refusé',
};

type Route = RouteProp<RootStackParamList, 'MonthlyRentalApply'>;

type LocalDoc = {
  type: string;
  uri: string;
  name: string;
  mimeType?: string | null;
};

export default function MonthlyRentalApplyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { listingId, listingTitle } = route.params;
  const { user } = useAuth();
  const { submitCandidature, getMyCandidatureForListing, loading } = useMonthlyRentalCandidatures();
  const [existing, setExisting] = useState<MonthlyRentalCandidature | null>(null);
  const [checking, setChecking] = useState(true);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [localDocs, setLocalDocs] = useState<Record<string, LocalDoc>>({});
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    message: '',
    desired_move_in_date: '',
    duration_months: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const listingRes = await supabase
        .from('monthly_rental_listings')
        .select('required_documents')
        .eq('id', listingId)
        .maybeSingle();
      if (!cancelled) {
        const docs = listingRes.data?.required_documents;
        setRequiredDocuments(Array.isArray(docs) ? docs : []);
      }

      if (!user) {
        if (!cancelled) setChecking(false);
        return;
      }

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

  const pickDocument = async (docType: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setLocalDocs((prev) => ({
        ...prev,
        [docType]: {
          type: docType,
          uri: asset.uri,
          name: asset.name || `${docType}.pdf`,
          mimeType: asset.mimeType,
        },
      }));
    } catch {
      Alert.alert('Erreur', 'Impossible d’ouvrir le sélecteur de fichiers.');
    }
  };

  const uploadDoc = async (doc: LocalDoc): Promise<MonthlyRentalApplicationDocument> => {
    const ext =
      doc.name.split('.').pop()?.toLowerCase() ||
      (doc.mimeType?.includes('pdf') ? 'pdf' : 'jpg');
    const fileName = `monthly-rental-docs/${user!.id}/${listingId}/${doc.type}-${Date.now()}.${ext}`;
    const response = await fetch(doc.uri);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const contentType =
      doc.mimeType ||
      (ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg');
    const { error } = await supabase.storage
      .from('property-images')
      .upload(fileName, new Uint8Array(arrayBuffer), { contentType, upsert: false });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = supabase.storage.from('property-images').getPublicUrl(fileName);
    return { type: doc.type, url: publicUrl, name: doc.name };
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim()) {
      Alert.alert('Champs requis', 'Nom, email et téléphone sont obligatoires.');
      return;
    }
    const missing = requiredDocuments.filter((id) => !localDocs[id]);
    if (missing.length > 0) {
      Alert.alert(
        'Documents manquants',
        `Joignez tous les documents demandés :\n${missing.map(monthlyRentalDocumentLabel).join('\n')}`,
      );
      return;
    }

    let applicationDocuments: MonthlyRentalApplicationDocument[] = [];
    if (requiredDocuments.length > 0) {
      setUploading(true);
      try {
        for (const id of requiredDocuments) {
          applicationDocuments.push(await uploadDoc(localDocs[id]));
        }
      } catch {
        setUploading(false);
        Alert.alert('Erreur', 'Impossible d’envoyer certains documents. Réessayez.');
        return;
      }
      setUploading(false);
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
      application_documents: applicationDocuments,
    });
    if (result.success) {
      Alert.alert(
        'Candidature envoyée',
        `Votre dossier pour « ${listingTitle} » a été transmis. Le propriétaire étudie d’abord votre profil avant d’organiser une visite.`,
      );
      const candidature = await getMyCandidatureForListing(listingId);
      setExisting(candidature);
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d’envoyer la candidature.');
    }
  };

  const busy = loading || uploading;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Postuler
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {checking ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={MONTHLY_RENTAL_COLORS.primary} />
      ) : !user ? (
        <View style={styles.box}>
          <Text style={styles.boxText}>Connectez-vous pour postuler à cette annonce.</Text>
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.box, styles.boxSuccess, { margin: 0 }]}>
            <Text style={styles.successTitle}>Candidature envoyée</Text>
            <Text style={styles.boxText}>
              Statut : {STATUS_LABEL[existing.status] || existing.status}
            </Text>
            <Text style={[styles.boxText, { marginTop: 8 }]}>
              {existing.status === 'accepted'
                ? 'Votre dossier a été accepté. Le propriétaire vous contactera pour organiser la visite.'
                : existing.status === 'rejected'
                  ? 'Le propriétaire a décliné votre dossier pour ce logement.'
                  : 'Le propriétaire étudie votre dossier. Une visite ne sera proposée que s’il correspond.'}
            </Text>
          </View>
          {Array.isArray(existing.application_documents) &&
          existing.application_documents.length > 0 ? (
            <View style={styles.docsBlock}>
              <Text style={styles.label}>Documents envoyés</Text>
              {existing.application_documents.map((doc) => (
                <TouchableOpacity
                  key={`${doc.type}-${doc.url}`}
                  style={styles.docRow}
                  onPress={() => Linking.openURL(doc.url)}
                >
                  <Ionicons name="document-text-outline" size={18} color={MONTHLY_RENTAL_COLORS.primary} />
                  <Text style={styles.docRowText} numberOfLines={1}>
                    {monthlyRentalDocumentLabel(doc.type)} — {doc.name}
                  </Text>
                  <Ionicons name="open-outline" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Postuler pour ce logement</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {listingTitle}
            </Text>
            <Text style={styles.intro}>
              Étape 1 — candidature. Le propriétaire trie les dossiers avant d’organiser une visite,
              pour éviter des déplacements inutiles.
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

            <Text style={styles.label}>Durée envisagée (mois)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={form.duration_months}
              onChangeText={(v) => setForm((f) => ({ ...f, duration_months: v }))}
            />

            <Text style={styles.label}>Présentez votre dossier</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
              placeholder="Situation, composition du foyer, budget, garanties, motifs du déménagement…"
              placeholderTextColor="#94a3b8"
              value={form.message}
              onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
            />

            {requiredDocuments.length > 0 ? (
              <View style={styles.docsBlock}>
                <Text style={styles.label}>Documents demandés *</Text>
                <Text style={styles.docsHint}>
                  Joignez chaque pièce (PDF ou image) avant d’envoyer votre candidature.
                </Text>
                {requiredDocuments.map((docType) => {
                  const attached = localDocs[docType];
                  return (
                    <View key={docType} style={styles.docPickRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docPickLabel}>{monthlyRentalDocumentLabel(docType)}</Text>
                        {attached ? (
                          <Text style={styles.docPickFile} numberOfLines={1}>
                            {attached.name}
                          </Text>
                        ) : (
                          <Text style={styles.docPickEmpty}>Aucun fichier</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.docPickBtn}
                        onPress={() => pickDocument(docType)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={attached ? 'checkmark-circle' : 'cloud-upload-outline'}
                          size={18}
                          color={attached ? '#2E7D32' : MONTHLY_RENTAL_COLORS.primary}
                        />
                        <Text style={styles.docPickBtnText}>
                          {attached ? 'Remplacer' : 'Ajouter'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={busy}
            >
              {busy ? (
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
  sub: { fontSize: 14, color: '#666', marginBottom: 8 },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginBottom: 20,
  },
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
  docsBlock: { marginBottom: 16 },
  docsHint: { fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 17 },
  docPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  docPickLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  docPickFile: { marginTop: 3, fontSize: 12, color: '#2E7D32' },
  docPickEmpty: { marginTop: 3, fontSize: 12, color: '#94a3b8' },
  docPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  docPickBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  docRowText: { flex: 1, fontSize: 13, color: '#334155' },
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
