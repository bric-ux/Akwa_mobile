import React, { useCallback, useEffect, useState } from 'react';
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
import { HOTEL_COLORS } from '../constants/colors';
import type { RootStackParamList } from '../types';

const ESTABLISHMENT_TYPES = [
  { value: 'hotel', label: 'Hôtel' },
  { value: 'guesthouse', label: 'Maison d’hôtes' },
  { value: 'residence', label: 'Résidence' },
  { value: 'aparthotel', label: 'Aparthotel' },
] as const;

type Route = RouteProp<RootStackParamList, 'AddHotelEstablishment'>;

/**
 * Création / édition d’un établissement hôtelier.
 */
export default function AddHotelEstablishmentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const establishmentId = route.params?.establishmentId;
  const isEdit = !!establishmentId;
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [establishmentType, setEstablishmentType] = useState<string>('hotel');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(!!establishmentId);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!establishmentId || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_establishments')
        .select('title, establishment_type, address, description, status, images')
        .eq('id', establishmentId)
        .eq('host_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        Alert.alert('Introuvable', 'Établissement introuvable.');
        navigation.goBack();
        return;
      }
      setTitle(data.title || '');
      setEstablishmentType(data.establishment_type || 'hotel');
      setAddress(data.address || '');
      setDescription(data.description || '');
      setStatus(data.status || 'draft');
      setCoverUrl(
        Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : '',
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [establishmentId, user, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!user) {
      navigation.navigate('Auth', { returnTo: 'AddHotelEstablishment' });
      return;
    }
    if (!title.trim()) {
      Alert.alert('Champ requis', 'Indiquez le nom de l’établissement.');
      return;
    }

    setSaving(true);
    try {
      const images = coverUrl.trim() ? [coverUrl.trim()] : [];
      if (isEdit && establishmentId) {
        const { error } = await supabase
          .from('hotel_establishments')
          .update({
            title: title.trim(),
            establishment_type: establishmentType,
            address: address.trim() || null,
            description: description.trim() || null,
            images,
            updated_at: new Date().toISOString(),
          })
          .eq('id', establishmentId)
          .eq('host_id', user.id);
        if (error) throw error;
        Alert.alert('Enregistré', 'Établissement mis à jour.');
        navigation.goBack();
        return;
      }

      const { error } = await supabase
        .from('hotel_establishments')
        .insert({
          host_id: user.id,
          title: title.trim(),
          establishment_type: establishmentType,
          address: address.trim() || null,
          description: description.trim() || null,
          images,
          status: 'draft',
        })
        .select('id')
        .single();

      if (error) throw error;

      Alert.alert(
        'Établissement créé',
        'Ajoutez des types de chambres (avec photos) puis publiez depuis Mes établissements.',
        [
          {
            text: 'Continuer',
            onPress: () => {
              navigation.navigate('ModeTransition', {
                targetMode: 'hotel',
                targetPath: 'HotelOwnerSpace',
                fromMode: 'traveler',
              });
            },
          },
        ],
      );
    } catch (e: unknown) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer l’établissement.',
      );
    } finally {
      setSaving(false);
    }
  };

  const setVisibility = async (next: 'active' | 'hidden' | 'draft') => {
    if (!user || !establishmentId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('hotel_establishments')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', establishmentId)
        .eq('host_id', user.id);
      if (error) throw error;
      setStatus(next);
      Alert.alert(
        'OK',
        next === 'active'
          ? 'Établissement publié.'
          : next === 'hidden'
            ? 'Établissement masqué.'
            : 'Repassé en brouillon.',
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!user || !establishmentId) return;
    Alert.alert('Supprimer', 'Supprimer définitivement cet établissement ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const { error } = await supabase
              .from('hotel_establishments')
              .delete()
              .eq('id', establishmentId)
              .eq('host_id', user.id);
            if (error) throw error;
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression impossible');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Modifier l’établissement' : 'Nouvel établissement'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Hôtel</Text>
          <Text style={styles.title}>
            {isEdit ? 'Modifier votre établissement' : 'Créer votre établissement'}
          </Text>

          <Text style={styles.label}>Nom de l’établissement *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex. Hôtel Palm Abidjan"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {ESTABLISHMENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setEstablishmentType(t.value)}
                style={[styles.chip, establishmentType === t.value && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, establishmentType === t.value && styles.chipTextActive]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Adresse</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Quartier, ville…"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Présentez votre établissement…"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Photo établissement (URL)</Text>
          <TextInput
            style={styles.input}
            value={coverUrl}
            onChangeText={setCoverUrl}
            autoCapitalize="none"
            placeholder="https://…"
            placeholderTextColor="#94a3b8"
          />

          <TouchableOpacity
            style={[styles.submit, saving && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isEdit ? 'Enregistrer' : 'Créer l’établissement'}
              </Text>
            )}
          </TouchableOpacity>

          {isEdit && establishmentId ? (
            <View style={styles.manageBlock}>
              <Text style={styles.manageTitle}>Gestion</Text>
              <Text style={styles.statusLine}>
                Statut :{' '}
                {status === 'active' ? 'Publié' : status === 'hidden' ? 'Masqué' : 'Brouillon'}
              </Text>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() =>
                  navigation.navigate('ManageHotelRoomTypes', {
                    establishmentId,
                    establishmentTitle: title,
                  })
                }
              >
                <Ionicons name="bed-outline" size={18} color={HOTEL_COLORS.primary} />
                <Text style={styles.secondaryBtnText}>Types de chambres</Text>
              </TouchableOpacity>

              {status !== 'active' ? (
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => void setVisibility('active')}
                  disabled={saving}
                >
                  <Text style={styles.publishBtnText}>Publier</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.hideBtn}
                  onPress={() => void setVisibility('hidden')}
                  disabled={saving}
                >
                  <Text style={styles.hideBtnText}>Masquer</Text>
                </TouchableOpacity>
              )}

              {status === 'hidden' ? (
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => void setVisibility('active')}
                  disabled={saving}
                >
                  <Text style={styles.publishBtnText}>Remettre en ligne</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
                <Text style={styles.deleteBtnText}>Supprimer l’établissement</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: HOTEL_COLORS.primary,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 16,
  },
  textarea: { minHeight: 100, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipActive: {
    borderColor: HOTEL_COLORS.primary,
    backgroundColor: HOTEL_COLORS.primary,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  submit: {
    marginTop: 8,
    backgroundColor: HOTEL_COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  manageBlock: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  manageTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  statusLine: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: HOTEL_COLORS.primary },
  publishBtn: {
    backgroundColor: HOTEL_COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  publishBtnText: { color: '#fff', fontWeight: '700' },
  hideBtn: {
    backgroundColor: '#e8eaf6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  hideBtnText: { color: '#5c6bc0', fontWeight: '700' },
  deleteBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteBtnText: { color: '#c62828', fontWeight: '600' },
});
