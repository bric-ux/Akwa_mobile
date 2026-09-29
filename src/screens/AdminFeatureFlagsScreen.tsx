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
      'Pastille accueil, publication et espace propriétaire pour les loyers mensuels.',
  },
  {
    key: FEATURE_FLAG_KEYS.hotel,
    label: 'Hôtels',
    description:
      'Pastille accueil, publication et espace établissement multi-chambres.',
  },
];

export default function AdminFeatureFlagsScreen() {
  const navigation = useNavigation();
  const { flags, loading, refresh, setFlag } = useFeatureFlags();
  const [savingKey, setSavingKey] = useState<FeatureFlagKey | null>(null);
  const [rows, setRows] = useState<
    { key: FeatureFlagKey; label: string; description: string | null }[]
  >([]);

  const loadMeta = useCallback(async () => {
    const { data } = await supabase
      .from('platform_feature_flags')
      .select('key, label, description')
      .in('key', Object.values(FEATURE_FLAG_KEYS));

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
  }, []);

  useEffect(() => {
    void loadMeta();
    void refresh();
  }, [loadMeta, refresh]);

  const onToggle = async (key: FeatureFlagKey, enabled: boolean) => {
    try {
      setSavingKey(key);
      await setFlag(key, enabled);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de mettre à jour le flag.');
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
          Bail longue durée et hôtels ne sont visibles que pour les comptes admin
          connectés (tests). Les autres utilisateurs ne les voient pas.
        </Text>

        {loading && displayRows.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#e74c3c" />
        ) : (
          <View style={styles.section}>
            {displayRows.map((row, index) => (
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
                </View>
                {savingKey === row.key ? (
                  <ActivityIndicator size="small" color="#e74c3c" />
                ) : (
                  <Switch
                    value={!!flags[row.key]}
                    onValueChange={(v) => void onToggle(row.key, v)}
                    trackColor={{ false: '#d1d5db', true: '#86efac' }}
                    thumbColor={flags[row.key] ? '#16a34a' : '#f4f4f5'}
                  />
                )}
              </View>
            ))}
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
});
