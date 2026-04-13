import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title?: string;
  message?: string;
  iosUrl?: string;
  androidUrl?: string;
};

export default function ForceUpdateScreen({
  title = 'Mise à jour requise',
  message = 'Veuillez mettre à jour l’application pour continuer.',
  iosUrl,
  androidUrl,
}: Props) {
  const url = Platform.OS === 'ios' ? iosUrl : androidUrl;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="cloud-download-outline" size={56} color="#e67e22" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity
          style={[styles.button, !url && styles.buttonDisabled]}
          disabled={!url}
          onPress={() => url && Linking.openURL(url)}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Mettre à jour</Text>
        </TouchableOpacity>
        {!url ? (
          <Text style={styles.smallNote}>
            Lien de mise à jour indisponible. Contacte le support.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#444',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e67e22',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  smallNote: {
    marginTop: 10,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
