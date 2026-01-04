import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/services/AuthContext';
import { CurrencyProvider } from './src/contexts/CurrencyContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { SearchDatesProvider } from './src/contexts/SearchDatesContext';
import AppNavigator from './src/navigation/AppNavigator';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <CurrencyProvider>
            <SearchDatesProvider>
              <AuthProvider>
                <AuthGate>
                  <AppNavigator />
                </AuthGate>
              </AuthProvider>
            </SearchDatesProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#e67e22" />
      </View>
    );
  }
  return <>{children}</>;
};
