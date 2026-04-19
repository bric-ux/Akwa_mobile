import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  ScrollView,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, StackActions } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import {
  HostAssistantFormDraft,
  HostAssistantLocationPlace,
  mergeAssistantPatch,
  saveHostAssistantDraft,
  getAssistantDraftBlockingMessage,
} from '../lib/hostOnboardingAssistant';
import CitySearchInputModal from '../components/CitySearchInputModal';
import {
  PROPERTY_TYPES,
  ASSISTANT_GUEST_OPTIONS,
  ASSISTANT_BEDROOM_OPTIONS,
  ASSISTANT_BATHROOM_OPTIONS,
} from '../constants/hostListingForm';

type Role = 'user' | 'assistant';

type ChatRow = { id: string; role: Role; content: string };

function buildMessagesForApi(rows: ChatRow[]): { role: Role; content: string }[] {
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

type CitySearchResult = {
  id: string;
  name: string;
  type: 'city' | 'neighborhood' | 'commune';
  region?: string;
  commune?: string;
  city_id?: string;
};

function CountChipRow({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: readonly string[];
  selected?: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.qBlock}>
      <Text style={styles.qLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {values.map((v) => (
          <TouchableOpacity
            key={`${label}-${v}`}
            style={[styles.miniChip, selected === v && styles.miniChipOn]}
            onPress={() => onSelect(v)}
            activeOpacity={0.85}
          >
            <Text style={[styles.miniChipText, selected === v && styles.miniChipTextOn]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const HostOnboardingAssistantScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const statusTop =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? StatusBar.currentHeight ?? 0
        : 0;

  const [rows, setRows] = useState<ChatRow[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [mergedDraft, setMergedDraft] = useState<HostAssistantFormDraft>({});
  const [lastComplete, setLastComplete] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const listRef = useRef<FlatList<ChatRow>>(null);

  const draftBlocked = getAssistantDraftBlockingMessage(mergedDraft) !== null;

  const selectTitle = useCallback((title: string) => {
    setMergedDraft((prev) => ({ ...prev, title }));
  }, []);

  const onLocationChange = useCallback((result: CitySearchResult | null) => {
    if (!result) {
      setMergedDraft((prev) => ({
        ...prev,
        location: '',
        locationPlace: undefined,
      }));
      return;
    }
    const place: HostAssistantLocationPlace = {
      id: result.id,
      name: result.name,
      type: result.type,
      region: result.region,
      commune: result.commune,
      city_id: result.city_id,
    };
    setMergedDraft((prev) => ({
      ...prev,
      location: result.name,
      locationPlace: place,
    }));
  }, []);

  const callAssistant = useCallback(
    async (apiMessages: { role: Role; content: string }[]) => {
      const { data, error } = await supabase.functions.invoke<{
        reply?: string;
        draft_patch?: Record<string, unknown>;
        is_complete?: boolean;
        title_suggestions?: unknown;
        error?: string;
      }>('host-onboarding-assistant', {
        body: { messages: apiMessages },
      });

      if (error) {
        throw new Error(error.message || 'Erreur Edge Function');
      }
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error));
      }
      const reply = data?.reply?.trim();
      if (!reply) throw new Error('Réponse vide');
      const patch = data?.draft_patch && typeof data.draft_patch === 'object'
        ? (data.draft_patch as Record<string, unknown>)
        : {};
      setMergedDraft((prev) => mergeAssistantPatch(prev, patch));
      setLastComplete(Boolean(data?.is_complete));
      const rawTitles = data?.title_suggestions;
      const titles = Array.isArray(rawTitles)
        ? (rawTitles as unknown[])
            .map((t) => String(t).trim())
            .filter((t) => t.length > 0 && t.length <= 120)
            .slice(0, 4)
        : [];
      setTitleSuggestions(titles);
      return reply;
    },
    [],
  );

  const bootstrap = useCallback(async () => {
    setBootLoading(true);
    try {
      const reply = await callAssistant([]);
      setRows([{ id: `a-${Date.now()}`, role: 'assistant', content: reply }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Impossible de démarrer l’assistant';
      Alert.alert('Assistant', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } finally {
      setBootLoading(false);
    }
  }, [callAssistant, navigation]);

  React.useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const sendUser = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userRow: ChatRow = { id: `u-${Date.now()}`, role: 'user', content: text };
    const nextRows = [...rows, userRow];
    setRows(nextRows);
    setLoading(true);
    try {
      const apiMessages = buildMessagesForApi(nextRows);
      const reply = await callAssistant(apiMessages);
      setRows((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: reply }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      Alert.alert('Envoi', msg);
      setRows((p) => p.filter((r) => r.id !== userRow.id));
    } finally {
      setLoading(false);
    }
  }, [input, loading, rows, callAssistant]);

  const continueToForm = useCallback(async () => {
    const block = getAssistantDraftBlockingMessage(mergedDraft);
    if (block) {
      Alert.alert('Fiche rapide', block);
      return;
    }
    try {
      await saveHostAssistantDraft(mergedDraft);
      const idx = navigation.getState()?.index ?? 0;
      const pops = idx >= 1 ? 1 : 0;
      if (pops > 0) {
        navigation.dispatch(StackActions.pop(pops));
      }
      InteractionManager.runAfterInteractions(() => {
        navigation.navigate('BecomeHost' as never);
      });
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible');
    }
  }, [mergedDraft, navigation]);

  const listHeader = (
    <View style={styles.quickCard}>
      <Text style={styles.quickCardTitle}>À remplir en premier</Text>
      <Text style={styles.quickCardHint}>
        Même liste que le formulaire manuel : type, ville ou quartier enregistré, capacité. Ensuite, la
        conversation aide pour titre, description et prix.
      </Text>

      <Text style={styles.qLabel}>Type de logement</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PROPERTY_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeChip, mergedDraft.propertyType === t.value && styles.typeChipOn]}
            onPress={() =>
              setMergedDraft((p) => ({
                ...p,
                propertyType: t.value,
              }))
            }
            activeOpacity={0.85}
          >
            <Text style={[styles.typeChipText, mergedDraft.propertyType === t.value && styles.typeChipTextOn]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.locBlock}>
        <Text style={styles.qLabel}>Localisation</Text>
        <CitySearchInputModal
          value={mergedDraft.location ?? ''}
          onChange={(result) => onLocationChange(result as CitySearchResult | null)}
          placeholder="Rechercher ville, commune ou quartier…"
        />
      </View>

      <CountChipRow
        label="Voyageurs"
        values={[...ASSISTANT_GUEST_OPTIONS]}
        selected={mergedDraft.guests}
        onSelect={(v) => setMergedDraft((p) => ({ ...p, guests: v }))}
      />
      <CountChipRow
        label="Chambres"
        values={[...ASSISTANT_BEDROOM_OPTIONS]}
        selected={mergedDraft.bedrooms}
        onSelect={(v) => setMergedDraft((p) => ({ ...p, bedrooms: v }))}
      />
      <CountChipRow
        label="Salles de bain"
        values={[...ASSISTANT_BATHROOM_OPTIONS]}
        selected={mergedDraft.bathrooms}
        onSelect={(v) => setMergedDraft((p) => ({ ...p, bathrooms: v }))}
      />

      <Text style={styles.qLabel}>Prix par nuit (FCFA)</Text>
      <TextInput
        style={styles.priceInput}
        placeholder="ex. 45000"
        placeholderTextColor="#9ca3af"
        keyboardType="number-pad"
        value={mergedDraft.price ?? ''}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, 9);
          setMergedDraft((p) => ({ ...p, price: digits ? digits : undefined }));
        }}
      />
    </View>
  );

  const listFooter = (
    <View style={styles.footerExtras}>
      {titleSuggestions.length > 0 ? (
        <View style={styles.suggestionsBlock}>
          <Text style={styles.suggestionsLabel}>Titres proposés</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsRow}
          >
            {titleSuggestions.map((t, i) => (
              <TouchableOpacity
                key={`title-${i}-${t.slice(0, 24)}`}
                style={styles.titleChip}
                onPress={() => selectTitle(t)}
                activeOpacity={0.85}
              >
                <Text style={styles.titleChipText} numberOfLines={3}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {lastComplete ? (
        <View style={styles.completeBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#166534" style={styles.completeIcon} />
          <Text style={styles.completeText}>
            L’assistant a assez d’éléments pour la description — vérifiez la fiche rapide puis ouvrez le
            formulaire.
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.applyBtn, draftBlocked && styles.applyBtnDisabled]}
        onPress={continueToForm}
        disabled={draftBlocked}
        activeOpacity={0.9}
      >
        <Ionicons name="arrow-forward-circle" size={22} color="#fff" style={styles.applyBtnIcon} />
        <Text style={styles.applyBtnText}>Continuer vers le formulaire</Text>
      </TouchableOpacity>
      {draftBlocked ? (
        <Text style={styles.applyHint}>{getAssistantDraftBlockingMessage(mergedDraft)}</Text>
      ) : (
        <Text style={styles.applyHintMuted}>
          Vous arrivez directement sur « Devenir hôte » avec les champs préremplis (photos à ajouter).
        </Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Réponse libre (titre, description, détails…)…"
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={2000}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={sendUser}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.safe, { paddingTop: statusTop }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AkwaHome Smart</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.subtitle}>
        Renseignez la fiche structurée ci-dessous (comme sur le formulaire classique), puis utilisez le chat
        pour affiner. Un bouton ouvre directement le formulaire complet.
      </Text>

      {bootLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e67e22" />
          <Text style={styles.hint}>Préparation…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={statusTop + 52}
        >
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubbleWrap,
                  item.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      item.role === 'user' && styles.bubbleTextUser,
                    ]}
                  >
                    {item.content}
                  </Text>
                </View>
              </View>
            )}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1f2937' },
  headerSpacer: { width: 38 },
  subtitle: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { marginTop: 12, color: '#64748b' },
  listContent: { padding: 16, paddingBottom: 24 },
  quickCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 16,
  },
  quickCardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  quickCardHint: { fontSize: 13, color: '#64748b', lineHeight: 18, marginBottom: 14 },
  qBlock: { marginBottom: 12 },
  qLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  locBlock: { marginBottom: 12 },
  chipRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', paddingRight: 8 },
  typeChip: {
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeChipOn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fdba74',
  },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  typeChipTextOn: { color: '#9a3412' },
  miniChip: {
    marginRight: 8,
    minWidth: 40,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  miniChipOn: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  miniChipText: { fontSize: 15, fontWeight: '700', color: '#334155' },
  miniChipTextOn: { color: '#fff' },
  priceInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  bubbleWrap: { marginBottom: 10, width: '100%' },
  bubbleWrapUser: { alignItems: 'flex-end' },
  bubbleWrapAssistant: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '88%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  bubbleUser: { backgroundColor: '#e67e22' },
  bubbleAssistant: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  bubbleText: { fontSize: 15, lineHeight: 22, color: '#1f2937' },
  bubbleTextUser: { color: '#fff' },
  suggestionsBlock: {
    marginBottom: 12,
    paddingTop: 4,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingRight: 12,
  },
  titleChip: {
    maxWidth: 280,
    marginRight: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  titleChipText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#9a3412',
    fontWeight: '600',
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#dcfce7',
    borderRadius: 10,
  },
  completeIcon: { marginRight: 8 },
  completeText: { flex: 1, fontSize: 13, color: '#166534' },
  footerExtras: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingBottom: 4,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  applyBtnDisabled: { backgroundColor: '#94a3b8' },
  applyBtnIcon: { marginRight: 8 },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  applyHint: { fontSize: 12, color: '#b45309', marginBottom: 10, lineHeight: 17 },
  applyHintMuted: { fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 17 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  input: {
    flex: 1,
    marginRight: 8,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
});

export default HostOnboardingAssistantScreen;
