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
    if (!bookingReference.trim()) {
      Alert.alert('Champ requis', 'Veuillez indiquer la référence de la réservation concernée (ex. numéro de réservation ou logement).');
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

      const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user.email;
      const disputeTypeLabel = DISPUTE_TYPES.find((t) => t.value === disputeType)?.label || disputeType || 'Non précisé';

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'dispute_declaration',
          to: 'accueil@akwahome.com',
          data: {
            userName,
            userEmail: user.email,
            disputeType,
            disputeTypeLabel,
            bookingReference: bookingReference.trim() || undefined,
            subject: subject.trim(),
            description: description.trim(),
          },
        },
      });

      if (error) throw error;
      setSent(true);
      Alert.alert(
        'Message envoyé',
        'Votre déclaration de litige a bien été transmise à notre équipe (accueil@akwahome.com). Nous vous recontacterons sous 48h.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'envoyer le message.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={64} color="#10b981" />
          <Text style={styles.successTitle}>Message envoyé</Text>
          <Text style={styles.successText}>Notre équipe vous recontactera à {user?.email}.</Text>
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
        <Text style={styles.headerTitle}>Déclarer un litige</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>📋</Text>
            <Text style={styles.heroTitle}>Nous sommes à votre écoute</Text>
            <Text style={styles.heroSubtitle}>
              Décrivez votre litige en détail. Les informations seront transmises à accueil@akwahome.com et notre équipe vous recontactera sous 48h.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Type de litige</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {DISPUTE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, disputeType === t.value && styles.chipSelected]}
                  onPress={() => setDisputeType(t.value)}
                >
                  <Text style={[styles.chipText, disputeType === t.value && styles.chipTextSelected]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Référence de réservation *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex. numéro de réservation, logement ou véhicule concerné"
              placeholderTextColor="#9ca3af"
              value={bookingReference}
              onChangeText={setBookingReference}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Sujet *</Text>
            <TextInput
              style={styles.input}
              placeholder="Résumé du litige en quelques mots"
              placeholderTextColor="#9ca3af"
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description détaillée *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez la situation, les faits et ce que vous attendez..."
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
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Envoyer la déclaration</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Un accusé de réception sera envoyé à {user?.email}. Merci de faire confiance à Akwahome 🌴
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
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  placeholder: { width: 32 },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  hero: {
    backgroundColor: '#fff7ed',
    borderLeftWidth: 4,
    borderLeftColor: '#ea580c',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  heroEmoji: { fontSize: 36, marginBottom: 8 },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9a3412',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  section: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  chipRow: { marginHorizontal: -4 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  chipText: { fontSize: 13, color: '#4b5563' },
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
    minHeight: 120,
    paddingTop: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ea580c',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footerNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  successBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669',
    marginTop: 16,
  },
  successText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DeclareDisputeScreen;
