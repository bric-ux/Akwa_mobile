import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  adminSendPushNotifications,
  fetchPushNotificationRecipients,
  filterRecipientsByAudience,
  getPushRecipientDisplayName,
  PushNotificationAudience,
  PushNotificationRecipient,
} from '../utils/adminPushNotifications';

const AUDIENCE_OPTIONS: {
  id: PushNotificationAudience;
  label: string;
  description: string;
}[] = [
  {
    id: 'single',
    label: 'Une personne',
    description: 'Choisir un utilisateur avec l’app installée',
  },
  {
    id: 'all_push_users',
    label: 'Tous les utilisateurs (push)',
    description: 'Comptes avec token push actif',
  },
  {
    id: 'hosts',
    label: 'Tous les hôtes',
    description: 'Hôtes ayant activé les notifications',
  },
  {
    id: 'vehicle_owners',
    label: 'Propriétaires véhicules',
    description: 'Propriétaires avec notifications actives',
  },
  {
    id: 'all_hosts_and_owners',
    label: 'Hôtes + propriétaires véhicules',
    description: 'Envoi groupé sans doublon',
  },
];

const AdminPushNotificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const initialLoadDone = useRef(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<PushNotificationRecipient[]>([]);
  const [audience, setAudience] = useState<PushNotificationAudience>('single');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToFocusedField = useCallback((toEnd = false) => {
    const delay = Platform.OS === 'ios' ? 80 : 120;
    setTimeout(() => {
      if (toEnd) {
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, delay);
  }, []);

  const loadRecipients = useCallback(async (force = false) => {
    if (!force && initialLoadDone.current) return;
    setLoading(true);
    try {
      const list = await fetchPushNotificationRecipients();
      setRecipients(list);
      initialLoadDone.current = true;
    } catch (e) {
      console.error('[AdminPushNotification] loadRecipients', e);
      Alert.alert('Erreur', 'Impossible de charger les destinataires push.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user && profile?.role === 'admin') {
        loadRecipients(false);
      }
    }, [user, profile, loadRecipients]),
  );

  const pushReadyRecipients = useMemo(
    () => recipients.filter((r) => r.push_ready),
    [recipients],
  );

  const filteredForPicker = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pushReadyRecipients;
    return pushReadyRecipients.filter((r) => {
      const name = getPushRecipientDisplayName(r).toLowerCase();
      const email = (r.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || r.user_id.includes(q);
    });
  }, [pushReadyRecipients, searchQuery]);

  const targetRecipients = useMemo(
    () => filterRecipientsByAudience(recipients, audience, selectedUserId),
    [recipients, audience, selectedUserId],
  );

  const sendPush = () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      Alert.alert('Titre requis', 'Saisissez un titre pour la notification.');
      return;
    }

    if (targetRecipients.length === 0) {
      Alert.alert(
        'Destinataire manquant',
        audience === 'single'
          ? 'Sélectionnez une personne avec notifications push actives.'
          : 'Aucun destinataire push pour ce filtre.',
      );
      return;
    }

    Alert.alert(
      'Confirmer l’envoi',
      `Notification push uniquement\n\n${targetRecipients.length} destinataire(s)`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            setSending(true);
            try {
              const result = await adminSendPushNotifications({
                userIds: targetRecipients.map((r) => r.user_id),
                title: trimmedTitle,
                body: trimmedBody,
                type: 'admin_broadcast',
              });

              const parts = [
                `${result.delivered} envoyée(s)`,
                result.skipped > 0 ? `${result.skipped} ignorée(s)` : null,
                result.failed > 0 ? `${result.failed} échec(s)` : null,
              ].filter(Boolean);

              Alert.alert('Terminé', parts.join(' · '));
            } catch (e) {
              console.error('[AdminPushNotification] send', e);
              Alert.alert('Erreur', 'Impossible d’envoyer les notifications push.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.deniedText}>Accès réservé aux administrateurs.</Text>
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
        <Text style={styles.headerTitle}>Notifications push</Text>
        <TouchableOpacity
          onPress={() => loadRecipients(true)}
          style={styles.backButton}
          disabled={loading}
        >
          <Ionicons name="refresh" size={22} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Chargement des destinataires…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.content}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(40, keyboardInset > 0 ? keyboardInset * 0.35 : 40) },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
          <Text style={styles.intro}>
            Envoyez un message uniquement en notification push sur l’application mobile. Seuls les
            utilisateurs ayant installé l’app et activé les notifications sont ciblés.
          </Text>

          <View style={styles.countBox}>
            <Ionicons name="notifications-outline" size={20} color="#e74c3c" />
            <Text style={styles.countText}>
              {pushReadyRecipients.length} utilisateur(s) avec push actif
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Destinataires</Text>
          {AUDIENCE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.optionRow, audience === opt.id && styles.optionRowActive]}
              onPress={() => setAudience(opt.id)}
            >
              <Ionicons
                name={audience === opt.id ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={audience === opt.id ? '#e74c3c' : '#999'}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionDesc}>{opt.description}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {audience === 'single' && (
            <View style={styles.pickerBlock}>
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher par nom ou email…"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              <Text style={styles.pickerHint}>
                {filteredForPicker.length} utilisateur(s) avec push actif
              </Text>
              {filteredForPicker.slice(0, 40).map((r) => {
                const active = r.user_id === selectedUserId;
                const badges: string[] = [];
                if (r.is_host) badges.push('Hôte');
                if (r.is_vehicle_owner) badges.push('Véhicule');
                return (
                  <TouchableOpacity
                    key={r.user_id}
                    style={[styles.userRow, active && styles.userRowActive]}
                    onPress={() => setSelectedUserId(r.user_id)}
                  >
                    <View style={styles.userRowMain}>
                      <Text style={styles.userName}>{getPushRecipientDisplayName(r)}</Text>
                      <Text style={styles.userMeta}>{r.email ?? r.user_id}</Text>
                    </View>
                    <View style={styles.badges}>
                      {badges.map((b) => (
                        <Text key={b} style={styles.badge}>
                          {b}
                        </Text>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {audience !== 'single' && (
            <View style={styles.countBox}>
              <Ionicons name="people-outline" size={20} color="#333" />
              <Text style={styles.countText}>
                {targetRecipients.length} destinataire(s) pour cet envoi
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Message</Text>
          <Text style={styles.hint}>Titre affiché sur l’écran de verrouillage</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Titre de la notification"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            onFocus={() => scrollToFocusedField(true)}
          />
          <Text style={styles.hint}>Corps du message (optionnel)</Text>
          <TextInput
            style={styles.messageInput}
            multiline
            placeholder="Contenu de la notification…"
            value={body}
            onChangeText={setBody}
            textAlignVertical="top"
            maxLength={500}
            onFocus={() => scrollToFocusedField(true)}
          />

          <Text style={styles.sectionTitle}>Envoyer</Text>
          <TouchableOpacity
            style={[styles.actionBtn, styles.pushBtn]}
            onPress={sendPush}
            disabled={sending || targetRecipients.length === 0 || !title.trim()}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="notifications" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Envoyer en push uniquement</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 24 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  keyboardAvoid: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { padding: 16, flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#666' },
  deniedText: { color: '#666', fontSize: 16 },
  intro: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  optionRowActive: { borderWidth: 1, borderColor: '#e74c3c' },
  optionText: { flex: 1 },
  optionLabel: { fontWeight: '600', color: '#333', fontSize: 15 },
  optionDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  pickerBlock: { marginBottom: 12 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  pickerHint: { fontSize: 12, color: '#888', marginBottom: 6 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    gap: 8,
  },
  userRowActive: { borderWidth: 1, borderColor: '#e74c3c' },
  userRowMain: { flex: 1 },
  userName: { fontWeight: '600', color: '#333' },
  userMeta: { fontSize: 12, color: '#888' },
  badges: { flexDirection: 'row', gap: 4 },
  badge: {
    fontSize: 10,
    backgroundColor: '#fef2f2',
    color: '#e74c3c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  countBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginVertical: 12,
  },
  countText: { fontSize: 14, color: '#333', flex: 1 },
  hint: { fontSize: 12, color: '#888', marginBottom: 6 },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 12,
  },
  messageInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  pushBtn: { backgroundColor: '#111827' },
});

export default AdminPushNotificationScreen;
