import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isExpoGo } from '../utils/expoGoCheck';

interface SafeWebViewProps {
  source: { html?: string; uri?: string };
  style?: any;
  [key: string]: any;
}

/**
 * Wrapper pour WebView qui fonctionne dans Expo Go
 * Affiche un fallback si WebView n'est pas disponible
 */
const SafeWebView = forwardRef<any, SafeWebViewProps>(({ source, style, ...props }, ref) => {
  const inExpoGo = isExpoGo();

  // Exposer des méthodes vides pour la compatibilité avec les refs
  useImperativeHandle(ref, () => ({
    reload: () => {
      console.log('SafeWebView: reload() appelé (non supporté dans Expo Go)');
    },
    postMessage: () => {
      console.log('SafeWebView: postMessage() appelé (non supporté dans Expo Go)');
    },
  }));

  // Si on est dans Expo Go, afficher un fallback
  if (inExpoGo) {
    const url = source.uri || (source.html ? undefined : 'https://www.openstreetmap.org/');
    
    return (
      <View style={[styles.fallbackContainer, style]}>
        <View style={styles.fallbackContent}>
          <Ionicons name="map-outline" size={48} color="#e67e22" />
          <Text style={styles.fallbackText}>
            La carte n'est pas disponible dans Expo Go
          </Text>
          <Text style={styles.fallbackSubtext}>
            Utilisez un développement build pour voir les cartes
          </Text>
          {url && (
            <TouchableOpacity
              style={styles.openButton}
              onPress={() => Linking.openURL(url)}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
              <Text style={styles.openButtonText}>Ouvrir dans le navigateur</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Sinon, utiliser WebView normalement
  try {
    const { WebView } = require('react-native-webview');
    return <WebView ref={ref} source={source} style={style} {...props} />;
  } catch (error) {
    // Fallback si l'import échoue
    return (
      <View style={[styles.fallbackContainer, style]}>
        <View style={styles.fallbackContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
          <Text style={styles.fallbackText}>
            WebView non disponible
          </Text>
        </View>
      </View>
    );
  }
});

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContent: {
    alignItems: 'center',
    padding: 20,
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  fallbackSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  openButton: {
    marginTop: 20,
    backgroundColor: '#e67e22',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

SafeWebView.displayName = 'SafeWebView';

export default SafeWebView;

