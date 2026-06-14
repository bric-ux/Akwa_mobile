import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserProfile, clearProfileCache } from '../hooks/useUserProfile';
import { useAuth } from '../services/AuthContext';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import IdentityVerificationAlert from '../components/IdentityVerificationAlert';
import { useLanguage } from '../contexts/LanguageContext';
import { HOTEL_COLORS } from '../constants/colors';
import { APP_VERSION } from '../constants/appVersion';
import { displayEmailOrPhone } from '../lib/displayContact';

const HotelManagerAccountScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { profile, loading, error, refreshProfile } = useUserProfile();
  const { verificationStatus } = useIdentityVerification();

  useFocusEffect(
    React.useCallback(() => {
      if (user) refreshProfile();
    }, [user, refreshProfile]),
  );

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('preferredMode');
            clearProfileCache();
            await signOut();
            navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
          } catch (err: any) {
            if (err?.message?.includes('Auth session missing')) {
              clearProfileCache();
              navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
              return;
            }
            Alert.alert(t('common.error'), t('profile.logoutError'));
          }
        },
      },
    ]);
  };

  const handleSwitchToTraveler = () => {
    Alert.alert('Mode voyageur', 'Retourner à l\'exploration des logements ?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.yes'),
        onPress: () =>
          navigation.navigate('ModeTransition', {
            targetMode: 'traveler',
            targetPath: 'Home',
            fromMode: 'hotel_manager',
          }),
      },
    ]);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>{t('auth.redirecting')}</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>{t('profile.loading')}</Text>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      id: 'edit',
      title: t('profile.edit'),
      icon: 'person-outline' as const,
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'addListing',
      title: 'Ajouter un bien sur AkwaHome',
      icon: 'add-circle-outline' as const,
      onPress: () => navigation.navigate('AddListingChoice'),
    },
    {
      id: 'help',
      title: t('settings.helpAssistant'),
      icon: 'chatbubble-ellipses-outline' as const,
      onPress: () => navigation.navigate('HelpAssistant'),
    },
    {
      id: 'settings',
      title: t('settings.title'),
      icon: 'settings-outline' as const,
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <Image
              source={{
                uri:
                  profile?.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    (profile?.first_name || 'H') +
                      (profile?.last_name ? ' ' + profile.last_name : ''),
                  )}&background=4f46e5&color=FFFFFF&size=100`,
              }}
              style={styles.avatar}
            />
            {verificationStatus === 'verified' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
              </View>
            )}
          </View>
          <Text style={styles.name}>
            {profile?.first_name} {profile?.last_name}
          </Text>
          <Text style={styles.email}>
            {displayEmailOrPhone(profile?.email, (profile as { phone?: string } | null)?.phone)}
          </Text>
          <View style={styles.modeBadge}>
            <Ionicons name="bed-outline" size={14} color={HOTEL_COLORS.primary} />
            <Text style={styles.modeBadgeText}>Gestionnaire hôtel</Text>
          </View>
        </View>

        <IdentityVerificationAlert />

        <View style={styles.switchRow}>
          <TouchableOpacity style={[styles.switchBtn, styles.switchBtnFull]} onPress={handleSwitchToTraveler}>
            <Ionicons name="airplane-outline" size={20} color={HOTEL_COLORS.primary} />
            <Text style={styles.switchBtnText}>Mode voyageur</Text>
          </TouchableOpacity>
        </View>

        {menuItems.map((item) => (
          <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.onPress}>
            <Ionicons name={item.icon} size={22} color="#64748b" />
            <Text style={styles.menuText}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#dc2626" />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingBottom: 32 },
  loadingText: { textAlign: 'center', marginTop: 40, color: '#64748b' },
  header: { alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  verifiedBadge: { position: 'absolute', bottom: 0, right: -4, backgroundColor: '#fff', borderRadius: 12 },
  name: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginTop: 12 },
  email: { fontSize: 14, color: '#64748b', marginTop: 4 },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: HOTEL_COLORS.light,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeBadgeText: { color: HOTEL_COLORS.primary, fontWeight: '700', fontSize: 13 },
  switchRow: { flexDirection: 'row', gap: 10, padding: 16 },
  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOTEL_COLORS.light,
  },
  switchBtnFull: {
    flex: 1,
  },
  switchBtnText: { color: HOTEL_COLORS.primary, fontWeight: '600', fontSize: 13 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  menuText: { flex: 1, fontSize: 16, color: '#334155' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 16 },
  version: { textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20 },
});

export default HotelManagerAccountScreen;
