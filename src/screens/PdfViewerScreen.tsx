import React, { useState } from 'react';
import { View, StyleSheet, Platform, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Text } from 'react-native';

type RouteParams = { url: string; title?: string };

const PdfViewerScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { url, title } = (route.params || {}) as RouteParams;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vérifier si l'URL est valide
  if (!url) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Document PDF'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
          <Text style={styles.errorText}>URL du document invalide</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Sur Android, utiliser un viewer embarqué pour fiabilité
  // Pour iOS, utiliser directement l'URL ou un viewer alternatif
  const viewerUrl = Platform.select({
    ios: url.includes('.pdf') 
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`
      : url,
    android: `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`,
    default: url,
  });

  const handleOpenInBrowser = async () => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir cette URL');
      }
    } catch (err) {
      console.error('Erreur ouverture navigateur:', err);
      Alert.alert('Erreur', 'Impossible d\'ouvrir dans le navigateur');
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('Erreur WebView:', nativeEvent);
    setError('Impossible de charger le document');
    setLoading(false);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Document PDF'}</Text>
        <TouchableOpacity 
          style={styles.openButton}
          onPress={handleOpenInBrowser}
        >
          <Ionicons name="open-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>
            Le document ne peut pas être affiché dans l'application.
          </Text>
          <TouchableOpacity 
            style={styles.openBrowserButton}
            onPress={handleOpenInBrowser}
          >
            <Ionicons name="open-outline" size={20} color="#fff" />
            <Text style={styles.openBrowserButtonText}>Ouvrir dans le navigateur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Chargement du document...</Text>
            </View>
          )}
          <WebView
            source={{ uri: viewerUrl as string }}
            style={styles.webview}
            startInLoadingState
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowUniversalAccessFromFileURLs
            setSupportMultipleWindows={false}
            onError={handleError}
            onLoadEnd={handleLoadEnd}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('Erreur HTTP:', nativeEvent);
              if (nativeEvent.statusCode >= 400) {
                setError(`Erreur ${nativeEvent.statusCode}: Impossible de charger le document`);
                setLoading(false);
              }
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e74c3c',
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  openBrowserButton: {
    marginTop: 24,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  openBrowserButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default PdfViewerScreen;






