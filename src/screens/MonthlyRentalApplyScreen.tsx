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
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { MonthlyRentalCandidature, RootStackParamList } from '../types';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import {
  monthlyRentalDocumentLabel,
  type MonthlyRentalApplicationDocument,
} from '../constants/monthlyRentalDocuments';

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
  const { t } = useLanguage();
  const { submitCandidature, getMyCandidatureForListing, loading } = useMonthlyRentalCandidatures();
  const { showToast } = useToast();
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

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      sent: t('monthly.statusSent'),
      viewed: t('monthly.statusViewed'),
      accepted: t('monthly.statusAccepted'),
      rejected: t('monthly.statusRejected'),
    };
    return map[status] || status;
  };

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
      Alert.alert(t('common.error'), t('monthly.pickerError'));
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
      Alert.alert(t('monthly.fieldsRequired'), t('monthly.fieldsRequiredDesc'));
      return;
    }
    const missing = requiredDocuments.filter((id) => !localDocs[id]);
    if (missing.length > 0) {
      Alert.alert(
        t('monthly.missingDocuments'),
        t('monthly.missingDocumentsDesc', {
          list: missing.map(monthlyRentalDocumentLabel).join('\n'),
        }),
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
        Alert.alert(t('common.error'), t('monthly.docsUploadError'));
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
      showToast(t('monthly.submitSuccess'), 'success');
      const candidature = await getMyCandidatureForListing(listingId);
      setExisting(candidature);
    } else {
      showToast(result.error || t('monthly.submitError'), 'error');
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
          {t('monthly.apply')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {checking ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={MONTHLY_RENTAL_COLORS.primary} />
      ) : !user ? (
        <View style={styles.box}>
          <Text style={styles.boxText}>{t('monthly.loginRequired')}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              navigation.navigate('Auth', {
                returnTo: 'MonthlyRentalApply',
                returnParams: { listingId, listingTitle },
              })
            }
          >
            <Text style={styles.primaryBtnText}>{t('auth.signIn')}</Text>
          </TouchableOpacity>
        </View>
      ) : existing ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.box, styles.boxSuccess, { margin: 0 }]}>
            <Text style={styles.successTitle}>{t('monthly.applicationSent')}</Text>
            <Text style={styles.boxText}>
              {t('monthly.status', { status: statusLabel(existing.status) })}
            </Text>
            <Text style={[styles.boxText, { marginTop: 8 }]}>
              {existing.status === 'accepted'
                ? t('monthly.statusAcceptedDesc')
                : existing.status === 'rejected'
                  ? t('monthly.statusRejectedDesc')
                  : t('monthly.statusPendingDesc')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('MyMonthlyRentalCandidatures')}
          >
            <Text style={styles.secondaryBtnText}>{t('monthly.seeAllApplications')}</Text>
          </TouchableOpacity>
          {Array.isArray(existing.application_documents) &&
          existing.application_documents.length > 0 ? (
            <View style={styles.docsBlock}>
              <Text style={styles.label}>{t('monthly.documentsSent')}</Text>
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
            <Text style={styles.title}>{t('monthly.applyTitle')}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {listingTitle}
            </Text>
            <Text style={styles.intro}>{t('monthly.applyIntro')}</Text>

            <Text style={styles.label}>{t('monthly.fullName')}</Text>
            <TextInput
              style={styles.input}
              value={form.full_name}
              onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))}
            />

            <Text style={styles.label}>{t('monthly.email')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
            />

            <Text style={styles.label}>{t('monthly.phone')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
            />

            <Text style={styles.label}>{t('monthly.moveInDate')}</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-10-01"
              placeholderTextColor="#94a3b8"
              value={form.desired_move_in_date}
              onChangeText={(v) => setForm((f) => ({ ...f, desired_move_in_date: v }))}
            />

            <Text style={styles.label}>{t('monthly.durationMonths')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={form.duration_months}
              onChangeText={(v) => setForm((f) => ({ ...f, duration_months: v }))}
            />

            <Text style={styles.label}>{t('monthly.presentDossier')}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
              placeholder={t('monthly.messagePlaceholder')}
              placeholderTextColor="#94a3b8"
              value={form.message}
              onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
            />

            {requiredDocuments.length > 0 ? (
              <View style={styles.docsBlock}>
                <Text style={styles.label}>{t('monthly.requiredDocuments')}</Text>
                <Text style={styles.docsHint}>{t('monthly.docsHint')}</Text>
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
                          <Text style={styles.docPickEmpty}>{t('monthly.noFile')}</Text>
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
                          {attached ? t('monthly.replace') : t('monthly.add')}
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
                <Text style={styles.primaryBtnText}>{t('monthly.submitApplication')}</Text>
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
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MONTHLY_RENTAL_COLORS.primary,
  },
  secondaryBtnText: { color: MONTHLY_RENTAL_COLORS.primary, fontWeight: '700', fontSize: 14 },
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
