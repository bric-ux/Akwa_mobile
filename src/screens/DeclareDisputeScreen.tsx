import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
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
import { TRAVELER_COLORS } from '../constants/colors';

const ACCENT = TRAVELER_COLORS.primary;

const DISPUTE_TYPES = [
  { value: 'booking', label: 'Problème de réservation' },
  { value: 'payment', label: 'Paiement ou remboursement' },
  { value: 'property_condition', label: 'État du logement / véhicule' },
  { value: 'behavior', label: 'Comportement (hôte ou voyageur)' },
  { value: 'communication', label: 'Communication / informations' },
  { value: 'other', label: 'Autre' },
];

const DeclareDisputeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [disputeType, setDisputeType] = useState<string>('');
  const [bookingReference, setBookingReference] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!disputeType) {
      Alert.alert('Champ requis', 'Veuillez sélectionner un type de litige.');
      return;
    }
    if (!bookingReference.trim()) {
      Alert.alert(
        'Champ requis',
        'Indiquez la référence de la réservation concernée (numéro, logement ou véhicule).',
      );
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Champ requis', 'Veuillez indiquer un sujet.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Champ requis', 'Veuillez décrire votre litige.');
      return;
    }
    if (!user?.email) {
      Alert.alert('Erreur', 'Vous devez être connecté.');
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const userName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.email;
      const disputeTypeLabel =
        DISPUTE_TYPES.find((t) => t.value === disputeType)?.label || disputeType;

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'dispute_declaration',
          to: 'accueil@akwahome.com',
          data: {
            userName,
            userEmail: user.email,
            disputeType,
            disputeTypeLabel,
            bookingReference: bookingReference.trim(),
            subject: subject.trim(),
            description: description.trim(),
          },
        },
      });

      if (error) throw error;
      setSent(true);
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'envoyer le message.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Déclarer un litige</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.successBox}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color="#059669" />
          </View>
          <Text style={styles.successTitle}>Déclaration transmise</Text>
          <Text style={styles.successText}>
            Notre équipe support vous répondra sous 48 h
            {user?.email ? ` à ${user.email}` : ''}.
          </Text>
          <TouchableOpacity style={styles.successButton} onPress={() => navigation.goBack()}>
            <Text style={styles.successButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Déclarer un litige</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="document-text-outline" size={22} color={ACCENT} />
            </View>
            <Text style={styles.heroTitle}>Support AkwaHome</Text>
            <Text style={styles.heroSubtitle}>
              Décrivez la situation. Notre équipe examine chaque déclaration et vous répond sous 48 h.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Type de litige *</Text>
            <View style={styles.chipWrap}>
              {DISPUTE_TYPES.map((t) => {
                const selected = disputeType === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setDisputeType(t.value)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Référence de réservation *</Text>
            <TextInput
              style={styles.input}
              placeholder="Numéro de réservation, logement ou véhicule"
              placeholderTextColor="#9ca3af"
              value={bookingReference}
              onChangeText={setBookingReference}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Sujet *</Text>
            <TextInput
              style={styles.input}
              placeholder="Résumé en quelques mots"
              placeholderTextColor="#9ca3af"
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Faits, dates, et ce que vous attendez de notre intervention…"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Envoyer</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Réponse sous 48 h
            {user?.email ? ` à l’adresse ${user.email}` : ''}.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: { width: 32 },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  hero: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    padding: 18,
    borderRadius: 14,
    marginBottom: 22,
  },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: TRAVELER_COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 21,
  },
  section: { marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1f2937',
  },
  textArea: {
    minHeight: 130,
    paddingTop: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footerNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  successBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successIconWrap: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 21,
  },
  successButton: {
    marginTop: 28,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default DeclareDisputeScreen;
