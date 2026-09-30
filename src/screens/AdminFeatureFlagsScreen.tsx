import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import {
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
} from '../constants/features';

type FlagMeta = {
  key: FeatureFlagKey;
  label: string;
  description: string;
};

const FLAG_META: FlagMeta[] = [
  {
    key: FEATURE_FLAG_KEYS.monthlyRental,
    label: 'Bail longue durée',
    description:
      'Si activé : tous les utilisateurs peuvent publier et voir le catalogue bail longue durée.',
  },
  {
    key: FEATURE_FLAG_KEYS.hotel,
    label: 'Hôtels',
    description:
      'Si activé : tous les utilisateurs peuvent publier et voir le catalogue hôtels.',
  },
];

export default function AdminFeatureFlagsScreen() {
  const navigation = useNavigation();
  const { rawFlags, refresh, setFlag } = useFeatureFlags();
  const [savingKey, setSavingKey] = useState<FeatureFlagKey | null>(null);
  const [loadingDb, setLoadingDb] = useState(true);
  /** État réel en base (pas le forçage admin) */
  const [dbEnabled, setDbEnabled] = useState<Record<FeatureFlagKey, boolean>>({
    ...FEATURE_FLAG_DEFAULTS,
  });
  const [rows, setRows] = useState<
    { key: FeatureFlagKey; label: string; description: string | null }[]
  >([]);

  const loadFromDb = useCallback(async () => {
    setLoadingDb(true);
    try {
      const { data, error } = await supabase
        .from('platform_feature_flags')
        .select('key, enabled, label, description')
        .in('key', Object.values(FEATURE_FLAG_KEYS));

      if (error) throw error;

      const enabledMap: Record<FeatureFlagKey, boolean> = {
        ...FEATURE_FLAG_DEFAULTS,
      };
      for (const r of data ?? []) {
        if (r.key in enabledMap) {
          enabledMap[r.key as FeatureFlagKey] = !!r.enabled;
        }
      }
      setDbEnabled(enabledMap);

      if (data?.length) {
        setRows(
          data.map((r) => ({
            key: r.key as FeatureFlagKey,
            label: r.label,
            description: r.description,
          })),
        );
      } else {
        setRows(FLAG_META.map((m) => ({ ...m, description: m.description })));
      }
    } catch (e: any) {
      console.warn('[AdminFeatureFlags] loadFromDb', e?.message);
      setDbEnabled({ ...FEATURE_FLAG_DEFAULTS, ...rawFlags });
      setRows(FLAG_META.map((m) => ({ ...m, description: m.description })));
    } finally {
      setLoadingDb(false);
    }
  }, [rawFlags]);

  useEffect(() => {
    void loadFromDb();
    void refresh({ silent: true });
  }, [loadFromDb, refresh]);

  const onToggle = async (key: FeatureFlagKey, enabled: boolean) => {
    try {
      setSavingKey(key);
      // Optimistic UI sur l’état DB réel
      setDbEnabled((prev) => ({ ...prev, [key]: enabled }));
      await setFlag(key, enabled);
      Alert.alert(
        enabled ? 'Activé pour tous' : 'Désactivé pour le public',
        enabled
          ? 'Les utilisateurs non-admin voient maintenant ce produit (publication + catalogue).'
          : 'Seuls les admins voient encore ce produit.',
      );
      await loadFromDb();
      await refresh({ silent: true });
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de mettre à jour le flag.');
      await loadFromDb();
      await refresh();
    } finally {
      setSavingKey(null);
    }
  };

  const displayRows = rows.length
    ? rows
    : FLAG_META.map((m) => ({ key: m.key, label: m.label, description: m.description }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visibilité produits</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Ces interrupteurs contrôlent la visibilité pour tous les utilisateurs (pas
          seulement admin). Vert = produit ouvert au public. Rouge = réservé aux
          admins.
        </Text>

        {loadingDb && displayRows.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#e74c3c" />
        ) : (
          <View style={styles.section}>
            {displayRows.map((row, index) => {
              const on = !!dbEnabled[row.key];
              return (
                <View
                  key={row.key}
                  style={[
                    styles.row,
                    index === displayRows.length - 1 && styles.rowLast,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{row.label}</Text>
                    {!!row.description && (
                      <Text style={styles.rowDesc}>{row.description}</Text>
                    )}
                    <Text style={[styles.badge, on ? styles.badgeOn : styles.badgeOff]}>
                      {on ? 'Ouvert au public' : 'Admin seulement'}
                    </Text>
                  </View>
                  {savingKey === row.key ? (
                    <ActivityIndicator size="small" color="#e74c3c" />
                  ) : (
                    <Switch
                      value={on}
                      onValueChange={(v) => void onToggle(row.key, v)}
                      trackColor={{ false: '#d1d5db', true: '#86efac' }}
                      thumbColor={on ? '#16a34a' : '#f4f4f5'}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  placeholder: { width: 44 },
  content: { padding: 20, paddingBottom: 40 },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '500', color: '#333', marginBottom: 4 },
  rowDesc: { fontSize: 13, lineHeight: 18, color: '#666' },
  badge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeOn: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeOff: { backgroundColor: '#f3f4f6', color: '#6b7280' },
});
