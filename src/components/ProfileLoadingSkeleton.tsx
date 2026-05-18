import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TRAVELER_COLORS } from '../constants/colors';

/** Placeholder pendant le chargement du profil après connexion (évite le flash invité → texte). */
const ProfileLoadingSkeleton: React.FC = () => (
  <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
    <View style={styles.header}>
      <View style={styles.avatar} />
      <View style={styles.nameLine} />
      <View style={styles.emailLine} />
    </View>
    <View style={styles.menuBlock}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.menuRow} />
      ))}
    </View>
    <ActivityIndicator size="small" color={TRAVELER_COLORS.primary} style={styles.spinner} />
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e8ecef',
    marginBottom: 16,
  },
  nameLine: {
    width: 160,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#e8ecef',
    marginBottom: 8,
  },
  emailLine: {
    width: 200,
    height: 14,
    borderRadius: 6,
    backgroundColor: '#eef1f4',
  },
  menuBlock: {
    paddingHorizontal: 20,
    gap: 10,
  },
  menuRow: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#eef1f4',
  },
  spinner: {
    marginTop: 24,
    alignSelf: 'center',
  },
});

export default ProfileLoadingSkeleton;
