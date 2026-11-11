import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Rappel affiché aux admins et semi-admins avant d’attribuer un bien à un tiers. */
const StaffCreateForOtherHint: React.FC = () => (
  <View style={styles.box}>
    <Ionicons name="information-circle" size={20} color="#1d4ed8" />
    <Text style={styles.text}>
      Pour ajouter ce bien au compte d’un autre utilisateur, cochez « Mode administrateur » sur le formulaire, puis vérifiez son e-mail ou son téléphone.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  text: {
    flex: 1,
    color: '#1e3a8a',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default StaffCreateForOtherHint;
