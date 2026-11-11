import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useOnboardingStaff } from '../hooks/useOnboardingStaff';

type Mode = 'one' | 'all';
type Template = 'auto' | 'vehicle' | 'lodging' | 'both';

type PickerUser = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

const LETTERS: {
  id: Exclude<Template, 'auto'>;
  title: string;
  subject: string;
  push: string;
  paragraphs: string[];
}[] = [
  {
    id: 'vehicle',
    title: 'Propriétaire de véhicule',
    subject: 'AkwaHome — commission applicable à vos locations de véhicules',
    push: 'À compter des nouvelles réservations, AkwaHome retient 7 % sur vos locations de véhicules. Cette commission est à votre charge. Le locataire ne paie aucun frais de service.',
    paragraphs: [
      'Nous vous informons de la mise à jour des conditions de commission d’AkwaHome. Elle s’applique exclusivement aux nouvelles réservations.',
      'Pour les véhicules que vous proposez, la commission est de 7 % du prix après réduction. Elle est prélevée uniquement sur le montant qui vous revient. Le locataire ne règle aucun frais de service.',
      'Les réservations déjà confirmées restent soumises aux conditions en vigueur au jour de leur confirmation. Aucun frais d’inscription ne vous est demandé.',
      'Nous vous remercions de votre confiance et demeurons à votre disposition pour toute précision.',
    ],
  },
  {
    id: 'lodging',
    title: 'Hôte — résidence ou hôtel',
    subject: 'AkwaHome — commission applicable à vos hébergements',
    push: 'À compter des nouvelles réservations, AkwaHome retient 10 % sur vos résidences meublées et vos hôtels. Cette commission est à votre charge. Le voyageur ne paie aucun frais de service.',
    paragraphs: [
      'Nous vous informons de la mise à jour des conditions de commission d’AkwaHome. Elle s’applique exclusivement aux nouvelles réservations.',
      'Pour vos résidences meublées et vos hôtels, la commission est de 10 % du prix après réduction. Elle est à la charge de l’hôte. Pour les hôtels, elle est calculée sur le sous-total des chambres, hors taxes et hors frais de ménage. Le voyageur ne règle aucun frais de service.',
      'Les réservations déjà confirmées restent soumises aux conditions en vigueur au jour de leur confirmation. Aucun frais d’inscription ne vous est demandé.',
      'Nous vous remercions de votre confiance et demeurons à votre disposition pour toute précision.',
    ],
  },
  {
    id: 'both',
    title: 'Véhicule et hébergement',
    subject: 'AkwaHome — commissions applicables à vos biens',
    push: 'Nouvelles réservations : 7 % sur vos véhicules et 10 % sur vos résidences et hôtels, à votre charge. Le voyageur et le locataire ne paient aucun frais de service.',
    paragraphs: [
      'Nous vous informons de la mise à jour des conditions de commission d’AkwaHome. Elle s’applique exclusivement aux nouvelles réservations.',
      'Vous proposez des véhicules et des hébergements. La commission est de 7 % sur les locations de véhicules, à la charge du propriétaire, et de 10 % sur les résidences meublées et les hôtels, à la charge de l’hôte.',
      'Ces commissions sont calculées sur le prix après réduction. Pour les hôtels, le calcul porte sur le sous-total des chambres, hors taxes et hors frais de ménage. Le voyageur et le locataire ne règlent aucun frais de service.',
      'Les réservations déjà confirmées restent soumises aux conditions en vigueur au jour de leur confirmation. Aucun frais d’inscription ne vous est demandé.',
      'Nous vous remercions de votre confiance et demeurons à votre disposition pour toute précision.',
    ],
  },
];

function displayName(user: PickerUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || user.email || user.phone || 'Utilisateur';
}

function initials(user: PickerUser): string {
  const letters = [user.first_name, user.last_name]
    .filter(Boolean)
    .map((part) => part!.trim().charAt(0).toUpperCase());
  return letters.join('').slice(0, 2) || '?';
}

function searchFilter(raw: string): string | null {
  const safe = raw.replace(/[%_,.()]/g, '').trim();
  if (safe.length < 2) return null;
  const parts = safe.split(/\s+/).filter(Boolean);
  const compact = safe.replace(/\s/g, '');
  if (parts.length >= 2) {
    const a = parts[0];
    const b = parts.slice(1).join(' ');
    return [
      `and(first_name.ilike.%${a}%,last_name.ilike.%${b}%)`,
      `and(first_name.ilike.%${b}%,last_name.ilike.%${a}%)`,
      `email.ilike.%${safe}%`,
      `phone.ilike.%${compact}%`,
    ].join(',');
  }
  return `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${compact}%`;
}

async function invokeErrorMessage(error: unknown): Promise<string> {
  const err = error as { message?: string; context?: { json?: () => Promise<{ error?: string }> } };
  try {
    if (typeof err?.context?.json === 'function') {
      const body = await err.context.json();
      if (body?.error) return body.error;
    }
  } catch {
    /* ignore */
  }
  return err?.message || 'Envoi impossible.';
}

const AdminCommissionNoticeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { isFullAdmin, loading: staffLoading } = useOnboardingStaff();
  const [mode, setMode] = useState<Mode>('one');
  const [template, setTemplate] = useState<Template>('auto');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [target, setTarget] = useState<PickerUser | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isFullAdmin || mode !== 'one') return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const filter = searchFilter(query);
      if (!filter) {
        setUsers([]);
        setLoadingUsers(false);
        return;
      }
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email, phone')
          .or(filter)
          .limit(8);
        if (cancelled) return;
        if (error) {
          setUsers([]);
          return;
        }
        setUsers((data || []) as PickerUser[]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, isFullAdmin, mode]);

  const send = () => {
    if (mode === 'one' && !target) {
      Alert.alert('Destinataire', 'Recherchez un nom, puis touchez la personne.');
      return;
    }
    const label =
      mode === 'one'
        ? `Envoyer l’e-mail et la notification à ${target ? displayName(target) : ''} ?`
        : 'Envoyer l’e-mail et la notification à tous les hôtes et propriétaires de véhicules ? Chaque personne reçoit le courrier qui correspond à ses biens.';
    Alert.alert('Nouvelles conditions', label, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: () => void doSend() },
    ]);
  };

  const doSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-commission-notice', {
        body: {
          mode,
          userId: mode === 'one' ? target?.user_id : undefined,
          template: mode === 'one' ? template : 'auto',
        },
      });
      if (error) {
        Alert.alert('Envoi impossible', await invokeErrorMessage(error));
        return;
      }
      if (data?.error) {
        Alert.alert('Envoi impossible', String(data.error));
        return;
      }
      Alert.alert(
        'Courrier envoyé',
        `${data?.targeted ?? 0} destinataire(s).\nE-mails envoyés : ${data?.emails_sent ?? 0}\nNotifications : ${data?.push_delivered ?? 0}`,
      );
    } finally {
      setSending(false);
    }
  };

  if (staffLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!isFullAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.blocked}>Réservé aux administrateurs.</Text>
      </SafeAreaView>
    );
  }

  const visibleLetters = template === 'auto' ? LETTERS : LETTERS.filter((letter) => letter.id === template);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelles conditions</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Courrier et notification pour informer les hôtes et les propriétaires de véhicules des commissions AkwaHome. Le texte ci-dessous est celui qui part, précédé de « Bonjour » et du nom.
        </Text>

        <View style={styles.row}>
          <Choice label="Une personne" active={mode === 'one'} onPress={() => setMode('one')} />
          <Choice label="Tout le monde" active={mode === 'all'} onPress={() => setMode('all')} />
        </View>

        {mode === 'one' ? (
          <View style={styles.card}>
            <Text style={styles.label}>Destinataire du test</Text>
            {target ? (
              <View style={styles.selectedCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTextOn}>{initials(target)}</Text>
                </View>
                <View style={styles.selectedText}>
                  <Text style={styles.userName}>{displayName(target)}</Text>
                  <Text style={styles.userMeta}>
                    {[target.email, target.phone].filter(Boolean).join(' · ') || 'Sans coordonnée'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTarget(null);
                    setQuery('');
                    setUsers([]);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.change}>Changer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="words"
                  autoCorrect={false}
                  placeholder="Nom, e-mail ou téléphone"
                  placeholderTextColor="#999"
                />
                <Text style={styles.hint}>
                  Tapez au moins 2 lettres. Les résultats s’affichent en dessous, touchez la personne.
                </Text>
                {loadingUsers ? <ActivityIndicator color="#444" style={{ marginVertical: 8 }} /> : null}
                {users.map((user) => (
                  <TouchableOpacity
                    key={user.user_id}
                    style={styles.userRow}
                    onPress={() => {
                      setTarget(user);
                      setUsers([]);
                    }}
                  >
                    <View style={styles.avatarSm}>
                      <Text style={styles.avatarText}>{initials(user)}</Text>
                    </View>
                    <View style={styles.selectedText}>
                      <Text style={styles.userName}>{displayName(user)}</Text>
                      <Text style={styles.userMeta}>
                        {[user.email, user.phone].filter(Boolean).join(' · ') || 'Sans coordonnée'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {!loadingUsers && query.trim().length >= 2 && users.length === 0 ? (
                  <Text style={styles.hint}>Aucune personne ne correspond.</Text>
                ) : null}
              </>
            )}
            <Text style={styles.label}>Quel message envoyer ?</Text>
            <View style={styles.chips}>
              <Choice label="Selon ses biens" active={template === 'auto'} onPress={() => setTemplate('auto')} />
              {LETTERS.map((letter) => (
                <Choice
                  key={letter.id}
                  label={letter.title}
                  active={template === letter.id}
                  onPress={() => setTemplate(letter.id)}
                />
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.note}>
            Chaque hôte, hôtelier et propriétaire de véhicule reçoit le courrier qui correspond à ses biens.
          </Text>
        )}

        {visibleLetters.map((letter) => (
          <View key={letter.id} style={styles.preview}>
            <Text style={styles.previewKicker}>{letter.title}</Text>
            <Text style={styles.previewSubject}>{letter.subject}</Text>
            <Text style={styles.previewHello}>Bonjour,</Text>
            {letter.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.previewBody}>
                {paragraph}
              </Text>
            ))}
            <Text style={styles.previewSign}>Cordialement,{'\n'}L’équipe AkwaHome</Text>
            <Text style={styles.previewPush}>Notification : {letter.push}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.primary} onPress={send} disabled={sending}>
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Envoyer l’e-mail et la notification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

function Choice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.choice, active && styles.choiceOn]} onPress={onPress}>
      <Text style={[styles.choiceText, active && styles.choiceTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#222' },
  content: { padding: 16, paddingBottom: 40 },
  lead: { color: '#444', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 8, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  hint: { color: '#78716c', fontSize: 12, lineHeight: 17, marginTop: 8 },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f5f4',
    borderRadius: 12,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1c1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSm: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e7e5e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#1c1917', fontWeight: '700', fontSize: 13 },
  avatarTextOn: { color: '#fff', fontWeight: '700', fontSize: 13 },
  selectedText: { flex: 1 },
  change: { color: '#1d4ed8', fontWeight: '600', fontSize: 14 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  userName: { color: '#111', fontWeight: '600' },
  userMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { color: '#444', fontSize: 13, lineHeight: 18, marginBottom: 12 },
  preview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#1c1917',
  },
  previewKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: '#78716c', marginBottom: 6 },
  previewSubject: { fontWeight: '700', color: '#111', marginBottom: 10 },
  previewHello: { color: '#1f2937', lineHeight: 20, marginBottom: 8 },
  previewBody: { color: '#1f2937', fontSize: 14, lineHeight: 21, marginBottom: 8 },
  previewSign: { color: '#1f2937', lineHeight: 20, marginTop: 4 },
  previewPush: { color: '#78716c', fontSize: 12, lineHeight: 18, marginTop: 12 },
  choice: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  choiceOn: { borderColor: '#1c1917', backgroundColor: '#1c1917' },
  choiceText: { color: '#333', fontSize: 13, textAlign: 'center' },
  choiceTextOn: { color: '#fff', fontWeight: '600' },
  primary: {
    backgroundColor: '#1c1917',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  blocked: { margin: 24, color: '#444' },
});

export default AdminCommissionNoticeScreen;
