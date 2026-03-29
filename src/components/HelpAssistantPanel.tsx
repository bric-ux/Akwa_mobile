import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { findHelpFaqAnswer } from '../data/helpAssistantFaqs';
import { SUPPORT_EMAIL } from '../constants/supportEmail';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

const INTRO_MESSAGE =
  "Bonjour ! Je suis l'assistant AkwaHome. Posez votre question (en quelques mots) ou choisissez un thème ci-dessous. Si je n'ai pas la réponse, vous pourrez envoyer votre message à l'équipe par e-mail.";

const ESCALATION_HINT =
  "Je n'ai pas encore de réponse précise à cela. Un membre de l'équipe AkwaHome pourra vous répondre par e-mail. Utilisez le bouton « Envoyer au support » : nous transmettons votre question à support@akwahome.com.";

let msgSeq = 0;
function nextId(prefix: string) {
  msgSeq += 1;
  return `${prefix}-${Date.now()}-${msgSeq}`;
}

const HelpAssistantPanel: React.FC = () => {
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId('bot'), role: 'assistant', text: INTRO_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [extraDetail, setExtraDetail] = useState('');
  const [pendingUserQuestion, setPendingUserQuestion] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [sending, setSending] = useState(false);

  const appendMessages = useCallback((newOnes: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newOnes]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, []);

  const handleSendQuestion = () => {
    const q = input.trim();
    if (!q || sending) return;
    setInput('');
    appendMessages([{ id: nextId('user'), role: 'user', text: q }]);

    const answer = findHelpFaqAnswer(q);
    if (answer) {
      appendMessages([{ id: nextId('bot'), role: 'assistant', text: answer }]);
      setPendingUserQuestion(null);
      setExtraDetail('');
      return;
    }

    appendMessages([{ id: nextId('bot'), role: 'assistant', text: ESCALATION_HINT }]);
    setPendingUserQuestion(q);
  };

  const handleSendToSupport = async () => {
    if (!pendingUserQuestion) {
      Alert.alert('Question manquante', "Posez d'abord une question dans le champ du bas.");
      return;
    }
    const email = (user?.email || guestEmail).trim();
    if (!email) {
      Alert.alert(
        'E-mail requis',
        "Indiquez une adresse e-mail pour que l'equipe puisse vous repondre, ou connectez-vous a votre compte."
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('E-mail invalide', 'Vérifiez le format de votre adresse e-mail.');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'help_assistant_support',
          to: SUPPORT_EMAIL,
          data: {
            userMessage: pendingUserQuestion,
            extraDetails: extraDetail.trim() || undefined,
            userId: user?.id || null,
            userEmail: email,
            userDisplayName:
              ((user as any)?.user_metadata?.full_name as string) ||
              ((user as any)?.user_metadata?.first_name as string) ||
              '',
            sentAt: new Date().toISOString(),
          },
        },
      });
      if (error) throw error;

      appendMessages([
        {
          id: nextId('bot'),
          role: 'assistant',
          text:
            "Merci ! Votre message a ete transmis a l'equipe. Vous recevrez une reponse par e-mail a l'adresse indiquee, en general sous quelques jours ouvres.",
        },
      ]);
      setPendingUserQuestion(null);
      setExtraDetail('');
      setGuestEmail('');
    } catch (e: any) {
      console.error('HelpAssistant support email:', e);
      Alert.alert(
        'Envoi impossible',
        e?.message ||
          "Le message n'a pas pu être envoyé. Réessayez plus tard ou écrivez directement à support@akwahome.com depuis votre boîte mail."
      );
    } finally {
      setSending(false);
    }
  };

  const suggestionPresets = [
    { id: 'r1', label: 'Reserver', text: 'comment reserver' },
    { id: 'r2', label: 'Annuler', text: 'annulation remboursement' },
    { id: 'r3', label: 'Paiement', text: 'paiement carte wave' },
    { id: 'r4', label: 'Devenir hote', text: 'devenir hote candidature' },
    { id: 'r5', label: 'Vehicule', text: 'location vehicule' },
    { id: 'r6', label: 'Identite', text: 'verification identite' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.chipsTitle}>Suggestions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          {suggestionPresets.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.chip}
              onPress={() => {
                setInput(s.text);
              }}
            >
              <Text style={styles.chipText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {messages.map((m) => (
          <View
            key={m.id}
            style={[
              styles.bubbleWrap,
              m.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapBot,
            ]}
          >
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={[styles.bubbleText, m.role === 'user' && styles.bubbleTextUser]}>
                {m.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {pendingUserQuestion !== null && (
        <View style={styles.escalationBox}>
          <Text style={styles.escalationTitle}>Contacter le support</Text>
          {!user?.email ? (
            <TextInput
              style={styles.detailInput}
              placeholder="Votre e-mail pour la réponse"
              placeholderTextColor="#9ca3af"
              value={guestEmail}
              onChangeText={setGuestEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <Text style={styles.loggedEmail}>Réponse à : {user.email}</Text>
          )}
          <TextInput
            style={[styles.detailInput, styles.detailMultiline]}
            placeholder="Précisions (facultatif)"
            placeholderTextColor="#9ca3af"
            value={extraDetail}
            onChangeText={setExtraDetail}
            multiline
          />
          <TouchableOpacity
            style={[styles.supportBtn, sending && styles.supportBtnDisabled]}
            onPress={handleSendToSupport}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.supportBtnText}>Envoyer au support</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.mainInput}
          placeholder="Votre question…"
          placeholderTextColor="#9ca3af"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSendQuestion}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSendQuestion}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chatScroll: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 24 },
  chipsTitle: { fontSize: 13, color: '#64748b', marginBottom: 8 },
  chipsRow: { marginBottom: 16 },
  chip: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: { color: '#0369a1', fontSize: 14, fontWeight: '500' },
  bubbleWrap: { marginBottom: 10, flexDirection: 'row' },
  bubbleWrapUser: { justifyContent: 'flex-end' },
  bubbleWrapBot: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleUser: { backgroundColor: '#2E7D32' },
  bubbleBot: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { fontSize: 15, color: '#1f2937', lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  escalationBox: {
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  escalationTitle: { fontWeight: '600', color: '#92400e', marginBottom: 8 },
  loggedEmail: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  detailInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginBottom: 8,
    fontSize: 15,
    color: '#1f2937',
  },
  detailMultiline: { minHeight: 72, textAlignVertical: 'top' },
  supportBtn: {
    backgroundColor: '#b45309',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  supportBtnDisabled: { opacity: 0.7 },
  supportBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  mainInput: {
    flex: 1,
    marginRight: 8,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f8fafc',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HelpAssistantPanel;
