import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../contexts/NetworkContext';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Bannière globale affichée en haut de l'app lorsque l'appareil est hors ligne.
 */
export default function OfflineBanner() {
  const { isOffline } = useNetwork();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View
      style={[styles.banner, { paddingTop: Math.max(insets.top, 8) }]}
      accessibilityRole="alert"
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{t('common.offline')}</Text>
        <Text style={styles.subtitle}>{t('common.offlineHint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#b45309',
    paddingHorizontal: 16,
    paddingBottom: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  textWrap: { flex: 1 },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    marginTop: 2,
  },
});
