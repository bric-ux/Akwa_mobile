import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import PhoneNumberField from '../components/PhoneNumberField';
import { buildE164, E164_REGEX } from '../lib/phoneAuth';
import { getPredictionContact } from '../lib/matchPredictionContact';
import {
  MATCH_PREDICTION_DEADLINE,
  MATCH_PREDICTION_KEY,
  MATCH_PREDICTION_LABEL,
  MATCH_PREDICTION_PENDING_STORAGE_KEY,
} from '../constants/matchPrediction';
import { safeGoBack } from '../utils/navigation';
import FootballHeroAnimation from '../components/FootballHeroAnimation';

type MissingFields = { fullName: boolean; email: boolean; phone: boolean };

const MatchPredictionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [scoreHome, setScoreHome] = useState('');
  const [scoreAway, setScoreAway] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [contactLoading, setContactLoading] = useState(false);
  const [contactForm, setContactForm] = useState({ fullName: '', email: '' });
  const [phoneDial, setPhoneDial] = useState('+225');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [missingFields, setMissingFields] = useState<MissingFields | null>(null);

  const deadlinePassed = now >= MATCH_PREDICTION_DEADLINE;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const loadParticipants = useCallback(async () => {
    const { count } = await supabase
      .from('match_predictions')
      .select('*', { count: 'exact', head: true })
      .eq('match_key', MATCH_PREDICTION_KEY);
    if (count != null) setParticipants(count);
  }, []);

  const restorePendingScores = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(MATCH_PREDICTION_PENDING_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { scoreHome?: string; scoreAway?: string };
      if (parsed.scoreHome) setScoreHome(parsed.scoreHome);
      if (parsed.scoreAway) setScoreAway(parsed.scoreAway);
      await AsyncStorage.removeItem(MATCH_PREDICTION_PENDING_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const loadExistingPrediction = useCallback(async () => {
    if (!user) {
      setExistingId(null);
      setMissingFields(null);
      return;
    }

    setContactLoading(true);
    try {
      const contact = await getPredictionContact(user);
      setContactForm({
        fullName: contact.fullName,
        email: contact.email,
      });
      if (contact.phone.startsWith('+')) {
        const dialMatch = contact.phone.match(/^(\+\d{1,3})/);
        if (dialMatch) {
          setPhoneDial(dialMatch[1]);
          setPhoneLocal(contact.phone.slice(dialMatch[1].length));
        }
      }
      setMissingFields({
        fullName: !contact.fullName,
        email: !contact.email,
        phone: !contact.phone,
      });

      let existing: { id: string; score_home: number; score_away: number } | null = null;
      const { data: byUser } = await supabase
        .from('match_predictions')
        .select('id,score_home,score_away')
        .eq('match_key', MATCH_PREDICTION_KEY)
        .eq('user_id', user.id)
        .maybeSingle();
      if (byUser) existing = byUser;

      if (!existing && contact.email) {
        const { data: byEmail } = await supabase
          .from('match_predictions')
          .select('id,score_home,score_away')
          .eq('match_key', MATCH_PREDICTION_KEY)
          .ilike('email', contact.email)
          .maybeSingle();
        if (byEmail) existing = byEmail;
      }

      if (existing) {
        setExistingId(existing.id);
        setScoreHome((prev) => prev || String(existing!.score_home));
        setScoreAway((prev) => prev || String(existing!.score_away));
      } else {
        setExistingId(null);
      }
    } finally {
      setContactLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadParticipants();
      void restorePendingScores();
      void loadExistingPrediction();
    }, [loadParticipants, restorePendingScores, loadExistingPrediction]),
  );

  const validateScore = () => {
    const home = parseInt(scoreHome, 10);
    const away = parseInt(scoreAway, 10);
    if (Number.isNaN(home) || Number.isNaN(away) || home < 0 || away < 0 || home > 20 || away > 20) {
      Alert.alert('Score requis', 'Entre 0 et 20 pour chaque équipe.');
      return null;
    }
    return { home, away };
  };

  const submitPrediction = async () => {
    if (deadlinePassed) {
      Alert.alert('Trop tard', 'Les pronostics sont clôturés (20/06 22h Paris).');
      return;
    }
    const score = validateScore();
    if (!score) return;

    if (!user) {
      await AsyncStorage.setItem(
        MATCH_PREDICTION_PENDING_STORAGE_KEY,
        JSON.stringify({ scoreHome, scoreAway }),
      );
      Alert.alert(
        'Connexion requise',
        'Connecte-toi ou crée un compte pour valider ton pronostic.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Se connecter',
            onPress: () =>
              navigation.navigate('Auth', {
                returnTo: 'MatchPrediction',
                mode: 'login',
              }),
          },
          {
            text: "S'inscrire",
            onPress: () =>
              navigation.navigate('Auth', {
                returnTo: 'MatchPrediction',
                mode: 'signup',
              }),
          },
        ],
      );
      return;
    }

    setSubmitting(true);
    const phoneE164 = buildE164(phoneDial, phoneLocal);
    const contact = await getPredictionContact(user, {
      fullName: contactForm.fullName,
      email: contactForm.email,
      phone: E164_REGEX.test(phoneE164) ? phoneE164 : '',
    });

    if (!contact.fullName || !contact.email || !contact.phone) {
      setSubmitting(false);
      setMissingFields({
        fullName: !contact.fullName,
        email: !contact.email,
        phone: !contact.phone,
      });
      const missing: string[] = [];
      if (!contact.fullName) missing.push('ton nom');
      if (!contact.email) missing.push('ton email');
      if (!contact.phone) missing.push('ton numéro');
      Alert.alert('Une dernière étape', `Ajoute ${missing.join(' et ')} pour valider.`);
      return;
    }

    let error: { code?: string; message: string } | null = null;
    if (existingId) {
      const res = await supabase
        .from('match_predictions')
        .update({
          full_name: contact.fullName,
          email: contact.email,
          phone: contact.phone,
          score_home: score.home,
          score_away: score.away,
        })
        .eq('id', existingId);
      error = res.error;
    } else {
      const res = await supabase.from('match_predictions').insert({
        user_id: contact.userId,
        match_key: MATCH_PREDICTION_KEY,
        match_label: MATCH_PREDICTION_LABEL,
        full_name: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        score_home: score.home,
        score_away: score.away,
      });
      error = res.error;
    }
    setSubmitting(false);

    if (error) {
      const isDup = error.code === '23505' || /duplicate/i.test(error.message);
      Alert.alert(
        isDup ? 'Pronostic déjà enregistré' : 'Erreur',
        isDup
          ? 'Tu as déjà soumis un pronostic — reconnecte-toi pour le modifier.'
          : error.message,
      );
      return;
    }

    setSubmitted(true);
    void loadParticipants();
    Alert.alert(
      existingId ? 'Pronostic mis à jour !' : 'Pronostic enregistré !',
      'Bonne chance pour le tirage au sort !',
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack(navigation)}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Concours pronostic</Text>
          <View style={styles.backBtnPlaceholder} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FootballHeroAnimation />

          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color="#FF7900" />
            <Text style={styles.badgeText}>Concours · Coupe du Monde 2026</Text>
          </View>

          <Text style={styles.heroTitle}>
            Devine le{'\n'}
            <Text style={styles.heroAccent}>score exact.</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            1 nuit à gagner dans une résidence partenaire.
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="calendar-outline" size={14} color="#FF7900" />
              <Text style={styles.metaText}>20 juin 2026</Text>
            </View>
            {participants != null && participants > 0 ? (
              <View style={styles.metaChip}>
                <Ionicons name="people-outline" size={14} color="#009E60" />
                <Text style={styles.metaText}>{participants} participants</Text>
              </View>
            ) : null}
          </View>

          {submitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={48} color="#fff" />
              </View>
              <Text style={styles.successTitle}>C'est validé !</Text>
              <Text style={styles.successBody}>
                Ton pronostic <Text style={styles.bold}>{scoreHome} - {scoreAway}</Text> est enregistré.
                Tu es dans la course pour le tirage au sort.
              </Text>
              {!deadlinePassed ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSubmitted(false)}>
                  <Text style={styles.secondaryBtnText}>Modifier mon pronostic</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.panel}>
                <Text style={styles.stepLabel}>Étape 1 · Ton pronostic</Text>
                <View style={styles.scoreRow}>
                  <View style={styles.teamCol}>
                    <Text style={styles.flag}>🇩🇪</Text>
                    <Text style={styles.teamName}>Allemagne</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={scoreHome}
                      onChangeText={setScoreHome}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                  <Text style={styles.vs}>VS</Text>
                  <View style={styles.teamCol}>
                    <Text style={styles.flag}>🇨🇮</Text>
                    <Text style={styles.teamName}>Côte d'Ivoire</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={scoreAway}
                      onChangeText={setScoreAway}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  </View>
                </View>
                <Text style={styles.hint}>Tape ton pronostic (0 à 20 par équipe).</Text>
              </View>

              <View style={styles.panel}>
                <View style={styles.stepHeader}>
                  <Ionicons name="trophy" size={18} color="#FF7900" />
                  <Text style={styles.stepLabel}>Étape 2 · Valide ta participation</Text>
                </View>

                {user && missingFields && (missingFields.fullName || missingFields.email || missingFields.phone) ? (
                  <View style={styles.profileFields}>
                    {missingFields.fullName ? (
                      <TextInput
                        style={styles.input}
                        value={contactForm.fullName}
                        onChangeText={(v) => setContactForm((p) => ({ ...p, fullName: v }))}
                        placeholder="Prénom et nom"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                      />
                    ) : null}
                    {missingFields.email ? (
                      <TextInput
                        style={styles.input}
                        value={contactForm.email}
                        onChangeText={(v) => setContactForm((p) => ({ ...p, email: v }))}
                        placeholder="Email"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    ) : null}
                    {missingFields.phone ? (
                      <PhoneNumberField
                        dial={phoneDial}
                        local={phoneLocal}
                        onDialChange={setPhoneDial}
                        onLocalChange={setPhoneLocal}
                      />
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.authHint}>
                    {user
                      ? existingId
                        ? "Tu peux modifier ton pronostic jusqu'au 20 juin 22h (Paris)."
                        : 'Confirme ton score pour entrer dans le tirage.'
                      : 'Connecte-toi ou inscris-toi pour valider ton pronostic.'}
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, (submitting || contactLoading || deadlinePassed) && styles.submitBtnDisabled]}
                  onPress={() => void submitPrediction()}
                  disabled={submitting || contactLoading || deadlinePassed}
                >
                  {submitting || contactLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {deadlinePassed
                        ? 'Pronostics clôturés'
                        : existingId
                          ? 'Modifier mon pronostic'
                          : 'Valider mon pronostic'}
                    </Text>
                  )}
                </TouchableOpacity>

                {!user ? (
                  <View style={styles.authRow}>
                    <TouchableOpacity
                      style={styles.authLinkBtn}
                      onPress={() => {
                        void AsyncStorage.setItem(
                          MATCH_PREDICTION_PENDING_STORAGE_KEY,
                          JSON.stringify({ scoreHome, scoreAway }),
                        );
                        navigation.navigate('Auth', { returnTo: 'MatchPrediction', mode: 'login' });
                      }}
                    >
                      <Text style={styles.authLinkText}>Se connecter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.authLinkBtn}
                      onPress={() => {
                        void AsyncStorage.setItem(
                          MATCH_PREDICTION_PENDING_STORAGE_KEY,
                          JSON.stringify({ scoreHome, scoreAway }),
                        );
                        navigation.navigate('Auth', { returnTo: 'MatchPrediction', mode: 'signup' });
                      }}
                    >
                      <Text style={styles.authLinkText}>Créer un compte</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              <View style={styles.howItWorks}>
                {[
                  { n: '01', t: 'Pronostique', d: 'Choisis le score exact avant le coup d\'envoi.' },
                  { n: '02', t: 'Crée ton compte', d: '1 SMS pour valider — bienvenue chez AkwaHome.' },
                  { n: '03', t: 'Tirage au sort', d: 'Un bon pronostic remporte 1 nuit en résidence partenaire.' },
                ].map((step) => (
                  <View key={step.n} style={styles.howCard}>
                    <Text style={styles.howNum}>{step.n}</Text>
                    <Text style={styles.howTitle}>{step.t}</Text>
                    <Text style={styles.howDesc}>{step.d}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtnPlaceholder: { width: 40 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 32 },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 36,
  },
  heroAccent: { color: '#FF7900' },
  heroSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metaText: { color: '#fff', fontSize: 13 },
  panel: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginBottom: 14,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamCol: { flex: 1, alignItems: 'center' },
  flag: { fontSize: 36, marginBottom: 4 },
  teamName: { color: '#fff', fontWeight: '700', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  scoreInput: {
    width: '100%',
    height: 72,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  vs: { color: 'rgba(255,255,255,0.3)', fontSize: 18, fontWeight: '900', paddingTop: 36 },
  hint: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  authHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 14,
    lineHeight: 20,
  },
  profileFields: { gap: 10, marginBottom: 14 },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 15,
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FF7900',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  authRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
  },
  authLinkBtn: { paddingVertical: 6 },
  authLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  howItWorks: { gap: 10, marginTop: 6 },
  howCard: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  howNum: { fontSize: 28, fontWeight: '900', color: '#FF7900' },
  howTitle: { marginTop: 4, fontSize: 16, fontWeight: '700', color: '#fff' },
  howDesc: { marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  successCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    alignItems: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#009E60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  successBody: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
  bold: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  secondaryBtnText: { color: '#fff', fontWeight: '600' },
});

export default MatchPredictionScreen;
