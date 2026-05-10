import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Share,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';

const teddyAsset = require('../../assets/teddy.png');

const DAILY_TEDDY_LIMIT = 3;
const DAILY_LIMIT_STORAGE_KEY = 'teddy_explore_daily_limit';

type TeddyExploreFabProps = {
  bottomOffset: number;
  /** Masquer le bouton flottant au scroll vers le bas (comme le site) ; la modale reste utilisable si déjà ouverte */
  fabVisibleFromScroll?: boolean;
};

export default function TeddyExploreFab({
  bottomOffset,
  fabVisibleFromScroll = true,
}: TeddyExploreFabProps) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'options' | 'chat'>('options');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const longPressTriggeredRef = useRef(false);
  const todayKey = new Date().toISOString().slice(0, 10);

  const opacityAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;
  const surfaceVisible = open || fabVisibleFromScroll;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: surfaceVisible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: surfaceVisible ? 0 : 14,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [surfaceVisible]);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DAILY_LIMIT_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { date?: string; count?: number };
        if (parsed?.date === todayKey) {
          setQuestionCount(Math.min(parsed.count || 0, DAILY_TEDDY_LIMIT));
        }
      } catch {
        /* ignore */
      }
    })();
  }, [todayKey]);

  const handleBecomeHost = useCallback(() => {
    setOpen(false);
    if (user) {
      navigation.navigate('BecomeHost');
    } else {
      navigation.navigate('Auth', { returnTo: 'BecomeHost' });
    }
  }, [navigation, user]);

  const shareTeddyLink = useCallback(async () => {
    try {
      await Share.share({
        title: 'Teddy IA AkwaHome',
        message:
          'Teste Teddy IA pour ajouter une résidence sur AkwaHome — https://akwahome.com/?teddy=1',
      });
    } catch {
      /* cancelled */
    }
  }, []);

  const sendGeneralQuestion = async () => {
    const q = input.trim();
    if (!q || assistantLoading || questionCount >= DAILY_TEDDY_LIMIT) return;
    const userMsg = { role: 'user' as const, content: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setAssistantLoading(true);

    try {
      const modeInstruction =
        "[Instruction interne] MODE=GENERAL. Tu reponds librement et clairement aux questions generales de l'utilisateur, avec un ton utile et concis.";
      const payloadMessages = [
        { role: 'user' as const, content: modeInstruction },
        ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const { data, error } = await supabase.functions.invoke<{
        reply?: string;
        error?: string;
      }>('host-onboarding-assistant', {
        body: { messages: payloadMessages },
      });

      if (error || data?.error || !data?.reply?.trim()) {
        throw new Error(data?.error || error?.message || 'Erreur IA');
      }

      const nextCount = questionCount + 1;
      const assistantReply =
        nextCount >= DAILY_TEDDY_LIMIT
          ? `${data.reply.trim()}\n\nTu as atteint la limite de 3 questions. Contactez accueil@akwahome.com pour plus d'informations.`
          : data.reply.trim();

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantReply }]);
      setQuestionCount(nextCount);
      try {
        await AsyncStorage.setItem(
          DAILY_LIMIT_STORAGE_KEY,
          JSON.stringify({ date: todayKey, count: Math.min(nextCount, DAILY_TEDDY_LIMIT) }),
        );
      } catch {
        /* ignore */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur IA';
      const noCredit = /insufficient_quota|quota|billing|credit|429/i.test(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: noCredit
            ? "Teddy IA est indisponible pour le moment."
            : `Je n'ai pas pu répondre (${msg}). Vérifie ta connexion ou réessaie plus tard.`,
        },
      ]);
    } finally {
      setAssistantLoading(false);
    }
  };

  const fabPress = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setOpen((prev) => {
      const next = !prev;
      if (next) setShowHint(false);
      return next;
    });
  };

  const onFabLongPress = () => {
    longPressTriggeredRef.current = true;
    void shareTeddyLink();
  };

  const openFromBubble = () => {
    setOpen(true);
    setShowHint(false);
  };

  return (
    <>
      <View style={[styles.anchor, { bottom: bottomOffset }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.fabColumn,
            {
              opacity: opacityAnim,
              transform: [{ translateY: translateAnim }],
            },
          ]}
          pointerEvents={surfaceVisible ? 'box-none' : 'none'}
        >
          {!open && showHint && (
            <Pressable
              onPress={openFromBubble}
              onLongPress={() => {
                longPressTriggeredRef.current = true;
                void shareTeddyLink();
              }}
              delayLongPress={450}
              style={styles.hintBubble}
              accessibilityRole="button"
              accessibilityLabel="Teddy IA, besoin d'aide"
            >
              <Text style={styles.hintText}>Teddy IA • Besoin d&apos;aide ?</Text>
            </Pressable>
          )}
          <Pressable
            onPress={fabPress}
            onLongPress={onFabLongPress}
            delayLongPress={450}
            style={styles.fabCircle}
            accessibilityLabel="Teddy IA"
          >
            <Image source={teddyAsset} style={styles.fabImage} contentFit="cover" />
          </Pressable>
        </Animated.View>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <Image source={teddyAsset} style={styles.sheetAvatar} contentFit="cover" />
                <View>
                  <Text style={styles.sheetTitle}>Teddy IA</Text>
                  <Text style={styles.sheetSubtitle}>Assistant AkwaHome</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.closeText}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              {mode === 'options' ? (
                <>
                  <View style={styles.optionsIntro}>
                    <Text style={styles.optionsIntroTitle}>Comment puis-je vous aider ?</Text>
                    <Text style={styles.optionsIntroSub}>
                      Choisissez une option pour commencer rapidement.
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.optionBtn} onPress={handleBecomeHost}>
                    <Text style={styles.optionBtnText}>Ajouter une résidence meublée sur AkwaHome</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.optionBtn}
                    onPress={() => {
                      setMode('chat');
                      if (messages.length === 0) {
                        setMessages([
                          {
                            role: 'assistant',
                            content:
                              'Parfait, je suis là. Pose-moi tes questions et je te réponds.',
                          },
                        ]);
                      }
                    }}
                  >
                    <Text style={styles.optionBtnText}>Chatter avec Teddy</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ScrollView style={styles.chatScroll} keyboardShouldPersistTaps="handled">
                    {messages.map((m, idx) => (
                      <View
                        key={`${m.role}-${idx}`}
                        style={[styles.msgBubble, m.role === 'user' ? styles.msgUser : styles.msgAssistant]}
                      >
                        <Text style={[styles.msgText, m.role === 'user' && styles.msgTextUser]}>
                          {m.content}
                        </Text>
                      </View>
                    ))}
                    {assistantLoading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator color="#059669" />
                      </View>
                    ) : null}
                  </ScrollView>
                  <View style={styles.chatInputRow}>
                    <TextInput
                      style={styles.chatInput}
                      value={input}
                      onChangeText={setInput}
                      placeholder={
                        questionCount >= DAILY_TEDDY_LIMIT
                          ? 'Limite atteinte (3/3 aujourd’hui)'
                          : 'Écris ta question...'
                      }
                      placeholderTextColor="#94a3b8"
                      editable={questionCount < DAILY_TEDDY_LIMIT && !assistantLoading}
                      onSubmitEditing={sendGeneralQuestion}
                      returnKeyType="send"
                    />
                    <TouchableOpacity
                      style={[
                        styles.sendBtn,
                        (!input.trim() || questionCount >= DAILY_TEDDY_LIMIT || assistantLoading) &&
                          styles.sendBtnDisabled,
                      ]}
                      disabled={!input.trim() || questionCount >= DAILY_TEDDY_LIMIT || assistantLoading}
                      onPress={sendGeneralQuestion}
                    >
                      <Text style={styles.sendBtnText}>{assistantLoading ? '…' : 'Envoyer'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.limitHint}>
                    Questions aujourd&apos;hui : {Math.min(questionCount, DAILY_TEDDY_LIMIT)}/
                    {DAILY_TEDDY_LIMIT}
                  </Text>
                  <TouchableOpacity style={styles.backOpts} onPress={() => setMode('options')}>
                    <Text style={styles.backOptsText}>← Retour aux options</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    right: 12,
    left: 12,
    zIndex: 21,
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
  },
  fabColumn: {
    alignItems: 'flex-end',
    maxWidth: '88%',
  },
  hintBubble: {
    marginBottom: 8,
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  hintText: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: '600',
  },
  fabCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  fabImage: {
    width: '100%',
    height: '100%',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 24,
    maxHeight: '78%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: 'rgba(255,255,255,0.98)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d1fae5',
    backgroundColor: '#ecfdf5',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  sheetBody: {
    padding: 12,
  },
  optionsIntro: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: 'rgba(224,242,254,0.65)',
    padding: 12,
    marginBottom: 12,
  },
  optionsIntroTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0c4a6e',
  },
  optionsIntroSub: {
    fontSize: 12,
    color: '#075985',
    marginTop: 4,
  },
  optionBtn: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  optionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  chatScroll: {
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#f8fafc',
    padding: 10,
    marginBottom: 10,
  },
  msgBubble: {
    maxWidth: '92%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  msgUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#ea580c',
  },
  msgAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  msgTextUser: {
    color: '#fff',
  },
  loadingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  sendBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  limitHint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
  },
  backOpts: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backOptsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});
