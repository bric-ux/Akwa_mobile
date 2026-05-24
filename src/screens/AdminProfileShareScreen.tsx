import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { useEmailService } from '../hooks/useEmailService';
import { sendPushToUser } from '../services/pushNotificationService';
import {
  buildProfileUrlForRecipient,
  DEFAULT_PROFILE_SHARE_MESSAGE,
  fetchProfileShareRecipients,
  fillProfileShareMessage,
  getRecipientDisplayName,
  phoneForSmsE164,
  phoneForWhatsApp,
  recipientHasEmailChannel,
  recipientHasSmsChannel,
  truncateSmsBody,
  ProfileShareAudience,
  ProfileShareRecipient,
} from '../utils/adminProfileShare';

const AUDIENCE_OPTIONS: {
  id: ProfileShareAudience;
  label: string;
  description: string;
}[] = [
  {
    id: 'single',
    label: 'Une personne',
    description: 'Choisir un hôte ou propriétaire dans la liste',
  },
  {
    id: 'hosts',
    label: 'Tous les hôtes',
    description: 'Comptes hôtes et propriétaires de logements',
  },
  {
    id: 'vehicle_owners',
    label: 'Tous les propriétaires véhicules',
    description: 'Comptes avec au moins un véhicule publié',
  },
  {
    id: 'all_hosts_and_owners',
    label: 'Tous (hôtes + véhicules)',
    description: 'Envoi groupé sans doublon',
  },
];

const AdminProfileShareScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { sendProfileShareInviteSmart } = useEmailService();
  const initialLoadDone = useRef(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<ProfileShareRecipient[]>([]);
  const [audience, setAudience] = useState<ProfileShareAudience>('single');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_PROFILE_SHARE_MESSAGE);

  const loadRecipients = useCallback(async (force = false) => {
    if (!force && initialLoadDone.current) {
      return;
    }
    setLoading(true);
    try {
      const list = await fetchProfileShareRecipients();
      setRecipients(list);
      initialLoadDone.current = true;
    } catch (e) {
      console.error('[AdminProfileShare] loadRecipients', e);
      Alert.alert('Erreur', 'Impossible de charger les hôtes et propriétaires.');
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

  const filteredForPicker = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => {
      const name = getRecipientDisplayName(r).toLowerCase();
      const email = (r.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || r.user_id.includes(q);
    });
  }, [recipients, searchQuery]);

  const targetRecipients = useMemo((): ProfileShareRecipient[] => {
    switch (audience) {
      case 'single':
        return selectedUserId
          ? recipients.filter((r) => r.user_id === selectedUserId)
          : [];
      case 'hosts':
        return recipients.filter((r) => r.is_host);
      case 'vehicle_owners':
        return recipients.filter((r) => r.is_vehicle_owner);
      case 'all_hosts_and_owners':
      default:
        return recipients;
    }
  }, [audience, recipients, selectedUserId]);

  const previewRecipient = targetRecipients[0] ?? recipients[0] ?? null;

  const previewMessage = useMemo(() => {
    if (!previewRecipient) return messageTemplate;
    const firstName = previewRecipient.first_name?.trim() || 'Bonjour';
    const profileUrl = buildProfileUrlForRecipient(previewRecipient);
    return fillProfileShareMessage(messageTemplate, { firstName, profileUrl });
  }, [messageTemplate, previewRecipient]);

  const selectedRecipient = recipients.find((r) => r.user_id === selectedUserId);

  const channelStats = useMemo(() => {
    let sms = 0;
    let email = 0;
    let none = 0;
    for (const r of targetRecipients) {
      if (recipientHasSmsChannel(r)) sms += 1;
      else if (recipientHasEmailChannel(r)) email += 1;
      else none += 1;
    }
    return { sms, email, none };
  }, [targetRecipients]);

  const sendToRecipients = async (options: { push: boolean }) => {
    if (targetRecipients.length === 0) {
      Alert.alert(
        'Destinataire manquant',
        audience === 'single'
          ? 'Sélectionnez un hôte ou propriétaire dans la liste.'
          : 'Aucun destinataire pour ce filtre.',
      );
      return;
    }

    const channelLabel = [
      'SMS (ou email si pas de numéro)',
      options.push && 'notification push',
    ]
      .filter(Boolean)
      .join(' + ');

    Alert.alert(
      'Confirmer l’envoi',
      `${channelLabel}\n\n${channelStats.sms} par SMS · ${channelStats.email} par email${
        channelStats.none > 0 ? ` · ${channelStats.none} sans contact` : ''
      }`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            setSending(true);
            let pushOk = 0;
            let smsOk = 0;
            let emailOk = 0;
            let fail = 0;
            let skipped = 0;

            try {
              for (const recipient of targetRecipients) {
                const firstName = recipient.first_name?.trim() || 'Bonjour';
                const profileUrl = buildProfileUrlForRecipient(recipient);
                const body = fillProfileShareMessage(messageTemplate, {
                  firstName,
                  profileUrl,
                });
                const displayName = getRecipientDisplayName(recipient);
                const phoneE164 = phoneForSmsE164(recipient.phone, recipient.phone_e164);

                if (options.push) {
                  try {
                    await sendPushToUser(
                      recipient.user_id,
                      'Votre vitrine AkwaHome',
                      `Partagez votre profil : ${profileUrl}`,
                      { screen: 'HostProfile', userId: recipient.user_id, profileUrl },
                    );
                    pushOk += 1;
                  } catch {
                    /* continue */
                  }
                  await new Promise((r) => setTimeout(r, 80));
                }

                const res = await sendProfileShareInviteSmart({
                  phoneE164,
                  email: recipient.email,
                  data: {
                    firstName,
                    displayName,
                    profileUrl,
                    messageBody: body,
                    smsBody: truncateSmsBody(body),
                    userId: recipient.user_id,
                  },
                });

                if (res.success && res.channel === 'sms') smsOk += 1;
                else if (res.success && res.channel === 'email') emailOk += 1;
                else if (res.channel === 'none') skipped += 1;
                else fail += 1;

                await new Promise((r) => setTimeout(r, 150));
              }

              const parts: string[] = [];
              if (options.push) parts.push(`${pushOk} notification(s)`);
              parts.push(`${smsOk} SMS`);
              parts.push(`${emailOk} email(s)`);
              if (fail > 0) parts.push(`${fail} échec(s)`);
              if (skipped > 0) parts.push(`${skipped} sans contact`);
              Alert.alert('Terminé', parts.join(' · '));
            } catch (e) {
              console.error('[AdminProfileShare] send', e);
              Alert.alert('Erreur', 'Une erreur est survenue pendant l’envoi.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  const openWhatsApp = async () => {
    if (!selectedRecipient) {
      Alert.alert('Sélection requise', 'Choisissez une personne pour WhatsApp.');
      return;
    }
    const waPhone = phoneForWhatsApp(selectedRecipient.phone);
    if (!waPhone) {
      Alert.alert('Téléphone manquant', 'Ce compte n’a pas de numéro utilisable pour WhatsApp.');
      return;
    }
    const body = fillProfileShareMessage(messageTemplate, {
      firstName: selectedRecipient.first_name?.trim() || 'Bonjour',
      profileUrl: buildProfileUrlForRecipient(selectedRecipient),
    });
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erreur', 'Impossible d’ouvrir WhatsApp.');
    }
  };

  const shareNative = async () => {
    if (!selectedRecipient) {
      Alert.alert('Sélection requise', 'Choisissez une personne pour le partage.');
      return;
    }
    const body = fillProfileShareMessage(messageTemplate, {
      firstName: selectedRecipient.first_name?.trim() || 'Bonjour',
      profileUrl: buildProfileUrlForRecipient(selectedRecipient),
    });
    try {
      await Share.share({ message: body, title: 'AkwaHome — vitrine' });
    } catch {
      /* cancelled */
    }
  };

  const copyPreview = async () => {
    await Clipboard.setStringAsync(previewMessage);
    Alert.alert('Copié', 'Le message a été copié dans le presse-papiers.');
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
        <Text style={styles.headerTitle}>Partager les vitrines</Text>
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
          <Text style={styles.loadingText}>Chargement des hôtes et propriétaires…</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Invitez les hôtes et propriétaires à partager le lien de leur vitrine. L’envoi se fait
            par SMS si un numéro est renseigné, sinon par email.
          </Text>

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
                {filteredForPicker.length} hôte(s) / propriétaire(s)
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
                      <Text style={styles.userName}>{getRecipientDisplayName(r)}</Text>
                      <Text style={styles.userMeta}>{r.email || '—'}</Text>
                    </View>
                    <View style={styles.badges}>
                      {badges.map((b) => (
                        <Text key={b} style={styles.badge}>
                          {b}
                        </Text>
                      ))}
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color="#e74c3c" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.countBox}>
            <Ionicons name="people-outline" size={20} color="#e74c3c" />
            <Text style={styles.countText}>
              {targetRecipients.length} destinataire(s) — {channelStats.sms} SMS,{' '}
              {channelStats.email} email
              {channelStats.none > 0 ? `, ${channelStats.none} sans contact` : ''}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Message</Text>
          <Text style={styles.hint}>
            Variables : {'{{firstName}}'}, {'{{profileUrl}}'}
          </Text>
          <TextInput
            style={styles.messageInput}
            multiline
            value={messageTemplate}
            onChangeText={setMessageTemplate}
            textAlignVertical="top"
          />

          <Text style={styles.sectionTitle}>Aperçu</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewText}>{previewMessage}</Text>
          </View>
          <TouchableOpacity style={styles.secondaryBtn} onPress={copyPreview}>
            <Ionicons name="copy-outline" size={18} color="#333" />
            <Text style={styles.secondaryBtnText}>Copier l’aperçu</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Envoyer</Text>

          {audience === 'single' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.whatsappBtn]}
                onPress={openWhatsApp}
                disabled={sending || !selectedRecipient}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>WhatsApp (personne choisie)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shareBtn]}
                onPress={shareNative}
                disabled={sending || !selectedRecipient}
              >
                <Ionicons name="share-social-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Partager (SMS, mail, etc.)</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, styles.smsBtn]}
            onPress={() => sendToRecipients({ push: false })}
            disabled={sending || targetRecipients.length === 0}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Envoyer par SMS (ou email)</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.bothBtn]}
            onPress={() => sendToRecipients({ push: true })}
            disabled={sending || targetRecipients.length === 0}
          >
            <Ionicons name="send-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>SMS / email + notification push</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
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
  content: { flex: 1, padding: 16 },
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
  messageInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    minHeight: 140,
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  previewBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  previewText: { fontSize: 13, color: '#444', lineHeight: 19 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
    padding: 10,
  },
  secondaryBtnText: { color: '#333', fontWeight: '500' },
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
  whatsappBtn: { backgroundColor: '#25D366' },
  shareBtn: { backgroundColor: '#6366f1' },
  smsBtn: { backgroundColor: '#e74c3c' },
  bothBtn: { backgroundColor: '#111827' },
});

export default AdminProfileShareScreen;
