import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

// Politique de confidentialité (requise par le Play Store - distincte des CGU)
const LEGAL_PAGE_URL = 'https://akwahome.com/privacy';
const LEGAL_PDF_URL = 'https://akwahome.com/documents/privacy-policy.pdf';

const PrivacyPolicyScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Politique de confidentialité</Text>
        <TouchableOpacity onPress={() => Linking.openURL(LEGAL_PAGE_URL)} style={styles.externalButton}>
          <Ionicons name="open-outline" size={22} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      <WebView
        source={{ uri: LEGAL_PDF_URL }}
        style={styles.webview}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
          </View>
        )}
        onError={() => Linking.openURL(LEGAL_PDF_URL)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef'
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1 },
  externalButton: { padding: 8 },
  webview: { flex: 1 },
  loadingContainer: { position: 'absolute', top: '50%', left: '50%', marginLeft: -25, marginTop: -25 },
});

export default PrivacyPolicyScreen;







