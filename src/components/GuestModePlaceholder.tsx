import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import BottomNavigationBar from './BottomNavigationBar';
import { TRAVELER_COLORS } from '../constants/colors';

export type GuestBottomNavScreen = 'explorer' | 'recherche' | 'messages' | 'favoris' | 'compte';

interface GuestModePlaceholderProps {
  icon: keyof typeof Ionicons.glyphMap;
  /** Clé i18n pour le texte sous le titre (ex. guest.messagesSubtitle) */
  subtitleKey: string;
  isInTabNavigator: boolean;
  /** Barre du bas custom uniquement hors onglets système */
  bottomNavScreen?: GuestBottomNavScreen;
}

/**
 * Même expérience « mode invité » que sur Mon compte : titre, explication, Se connecter / S’inscrire, reset vers Auth.
 */
const GuestModePlaceholder: React.FC<GuestModePlaceholderProps> = ({
  icon,
  subtitleKey,
  isInTabNavigator,
  bottomNavScreen = 'explorer',
}) => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { loading: authLoading } = useAuth();

  const goToAuthScreen = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Auth' as never }],
      }),
    );
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>{t('profile.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.centerContainer, styles.content]}>
        <Ionicons name={icon} size={80} color="#bbb" />
        <Text style={styles.title}>{t('profile.guestTitle')}</Text>
        <Text style={styles.subtitle}>{t(subtitleKey)}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={goToAuthScreen}>
          <Text style={styles.primaryButtonText}>{t('auth.signIn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={goToAuthScreen}>
          <Text style={styles.secondaryButtonText}>{t('auth.signUp')}</Text>
        </TouchableOpacity>
      </View>
      {!isInTabNavigator && <BottomNavigationBar activeScreen={bottomNavScreen} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 28,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: 28,
    backgroundColor: TRAVELER_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: TRAVELER_COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GuestModePlaceholder;
