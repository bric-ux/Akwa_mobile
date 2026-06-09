import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Image, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/services/AuthContext';
import { CurrencyProvider } from './src/contexts/CurrencyContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { SearchDatesProvider } from './src/contexts/SearchDatesContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import OfflineBanner from './src/components/OfflineBanner';
import AppNavigator from './src/navigation/AppNavigator';
import CurrencyDefaultFromCountry from './src/components/CurrencyDefaultFromCountry';
import ForceUpdateScreen from './src/screens/ForceUpdateScreen';

const queryClient = new QueryClient();
/** Délai minimum d’affichage du splash (évite un flash à peine visible). Réduit pour accélérer l’accès à l’app. */
const SPLASH_MIN_DURATION_MS = 400;

export default function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <StatusBar style="dark" {...(Platform.OS === 'android' ? { backgroundColor: '#ffffff', translucent: false } : {})} />
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <CurrencyProvider>
              <AuthProvider>
                <SearchDatesProvider>
                  <NetworkProvider>
                    <AuthGate>
                      <View style={styles.appRoot}>
                        <AppNavigator />
                        <OfflineBanner />
                      </View>
                    </AuthGate>
                  </NetworkProvider>
                </SearchDatesProvider>
              </AuthProvider>
            </CurrencyProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, updateRequired, updateTitle, updateMessage, updateIosUrl, updateAndroidUrl } = useAuth();
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), SPLASH_MIN_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  const showSplash = loading || !minSplashElapsed;
  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require('./assets/icon.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#e67e22" style={styles.splashSpinner} />
      </View>
    );
  }
  if (updateRequired) {
    return (
      <ForceUpdateScreen
        title={updateTitle}
        message={updateMessage}
        iosUrl={updateIosUrl}
        androidUrl={updateAndroidUrl}
      />
    );
  }
  return (
    <>
      <CurrencyDefaultFromCountry />
      {children}
    </>
  );
};

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  gestureRoot: {
    flex: 1,
  },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  splashLogo: {
    width: 220,
    height: 120,
    marginBottom: 24,
  },
  splashSpinner: {
    marginTop: 8,
  },
});
