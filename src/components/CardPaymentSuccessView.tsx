import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CHECK_COLOR = '#10b981';
const ICON_SIZE = 64;

export interface CardPaymentSuccessViewProps {
  /** Sous-titre optionnel sous "Paiement effectué" */
  subtitle?: string;
  /** Style du conteneur (optionnel) */
  style?: ViewStyle;
}

/**
 * Bloc uniforme affiché partout après un paiement par carte réussi :
 * coche verte + "Paiement effectué" + sous-titre optionnel.
 */
export default function CardPaymentSuccessView({ subtitle, style: styleProp }: CardPaymentSuccessViewProps) {
  return (
    <View style={[styles.container, styleProp]}>
      <Ionicons name="checkmark-circle" size={ICON_SIZE} color={CHECK_COLOR} />
      <Text style={styles.title}>Paiement effectué</Text>
      {subtitle != null && subtitle !== '' && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    margin: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});
