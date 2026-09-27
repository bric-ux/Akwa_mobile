import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { HOTEL_COLORS } from '../constants/colors';

const ESTABLISHMENT_TYPES = [
  { value: 'hotel', label: 'Hôtel' },
  { value: 'guesthouse', label: 'Maison d’hôtes' },
  { value: 'residence', label: 'Résidence' },
  { value: 'aparthotel', label: 'Aparthotel' },
] as const;

/**
 * Création d’un établissement hôtelier (brouillon) puis bascule vers l’espace hôtel.
 */
export default function AddHotelEstablishmentScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [establishmentType, setEstablishmentType] = useState<string>('hotel');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

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
      const { data, error } = await supabase
        .from('hotel_establishments')
        .insert({
          host_id: user.id,
          title: title.trim(),
          establishment_type: establishmentType,
          address: address.trim() || null,
          description: description.trim() || null,
          status: 'draft',
        })
        .select('id')
        .single();

      if (error) throw error;

      Alert.alert(
        'Établissement créé',
        'Vous pouvez maintenant gérer votre hôtel depuis l’espace Hôtel.',
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
        e instanceof Error ? e.message : 'Impossible de créer l’établissement.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvel établissement</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Hôtel</Text>
          <Text style={styles.title}>Créer votre établissement</Text>
          <Text style={styles.lead}>
            Renseignez les informations de base. Vous pourrez ajouter les types de chambres ensuite.
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
                style={[
                  styles.chip,
                  establishmentType === t.value && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    establishmentType === t.value && styles.chipTextActive,
                  ]}
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

          <TouchableOpacity
            style={[styles.submit, saving && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Créer l’établissement</Text>
            )}
          </TouchableOpacity>
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
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  lead: { fontSize: 14, lineHeight: 20, color: '#64748b', marginBottom: 22 },
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
});
