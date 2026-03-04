import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/services/AuthContext';
import { CurrencyProvider } from './src/contexts/CurrencyContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { SearchDatesProvider } from './src/contexts/SearchDatesContext';
import AppNavigator from './src/navigation/AppNavigator';

const queryClient = new QueryClient();
const SPLASH_MIN_DURATION_MS = 1700;

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <CurrencyProvider>
            <AuthProvider>
              <SearchDatesProvider>
                <AuthGate>
                  <AppNavigator />
                </AuthGate>
              </SearchDatesProvider>
            </AuthProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
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
          source={require('./assets/images/akwahome_logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#e67e22" style={styles.splashSpinner} />
      </View>
    );
  }
  return <>{children}</>;
};

const styles = StyleSheet.create({
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
