/**
 * Bouton flottant global (non monté par défaut : voir AppNavigator).
 * Pour le réactiver : import + <FloatingHelpAssistant /> à côté des autres handlers racine.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import HelpAssistantPanel from './HelpAssistantPanel';

const TAB_BAR_EXTRA = 52;

/** Contenu modale : hook insets à l’intérieur d’un SafeAreaProvider (Modal hors arbre par défaut). */
const HelpAssistantModalBody: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const statusTop =
    insets.top > 0
      ? insets.top
      : Platform.OS === 'android'
        ? StatusBar.currentHeight ?? 0
        : 0;

  return (
    <View
      style={[
        styles.modalSafe,
        {
          paddingTop: statusTop,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.modalHeader}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Fermer l'aide"
        >
          <Ionicons name="close" size={28} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Aide AkwaHome</Text>
        <View style={styles.headerSpacer} />
      </View>
      <HelpAssistantPanel />
    </View>
  );
};

/**
 * Bouton flottant + modale conversation (accessible depuis tout l'app).
 */
const FloatingHelpAssistant: React.FC = () => {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const fabBottom = insets.bottom + TAB_BAR_EXTRA;

  return (
    <>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaProvider>
          <HelpAssistantModalBody onClose={() => setOpen(false)} />
        </SafeAreaProvider>
      </Modal>

      {!open && (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              bottom: fabBottom,
              ...(Platform.OS === 'android' ? { elevation: 10 } : {}),
            },
          ]}
          onPress={() => setOpen(true)}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir l'assistant d'aide"
        >
          <Ionicons name="chatbubbles" size={26} color="#fff" />
        </TouchableOpacity>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalSafe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeBtn: {
    padding: 8,
    width: 44,
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
  },
  headerSpacer: { width: 44 },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});

export default FloatingHelpAssistant;
