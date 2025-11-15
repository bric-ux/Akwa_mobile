import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from '../hooks/useEmailService';
import { clearProfileCache } from '../hooks/useUserProfile';
import { supabase } from '../services/supabase';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { sendPasswordReset } = useEmailService();
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  
  // États pour les notifications
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [bookingNotifications, setBookingNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [marketingNotifications, setMarketingNotifications] = useState(false);
  
  // (Sélection de devise déplacée dans l'en-tête d'accueil)

  const handleNotificationToggle = async (type: string, value: boolean) => {
    try {
      // Ici on pourrait sauvegarder les préférences dans Supabase
      // Pour l'instant, on met juste à jour l'état local
      switch (type) {
        case 'push':
          setPushNotifications(value);
          break;
        case 'email':
          setEmailNotifications(value);
          break;
        case 'booking':
          setBookingNotifications(value);
          break;
        case 'message':
          setMessageNotifications(value);
          break;
        case 'marketing':
          setMarketingNotifications(value);
          break;
      }
      
      // Sauvegarder dans les préférences utilisateur (à implémenter)
      // await supabase.from('user_preferences').upsert({
      //   user_id: user?.id,
      //   [type]: value
      // });
      
    } catch (error) {
      console.error('Erreur sauvegarde préférences:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les préférences');
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      Alert.alert('Erreur', 'Email non trouvé');
      return;
    }

    setLoading(true);
    try {
      // Utiliser la fonction native de Supabase qui gère l'envoi d'email et le token
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: 'https://akwahome.com/reset-password.html', // URL de votre page de réinitialisation
      });

      if (error) {
        console.error('Erreur Supabase:', error);
        Alert.alert('Erreur', 'Impossible d\'envoyer l\'email de réinitialisation');
        return;
      }

      Alert.alert(
        'Email envoyé',
        'Un email de réinitialisation a été envoyé à votre adresse email. Vérifiez votre boîte de réception.',
        [{ text: 'OK' }]
      );
      setShowResetModal(false);
    } catch (error) {
      console.error('Erreur réinitialisation mot de passe:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de l\'email');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'SUPPRIMER') {
      Alert.alert('Erreur', 'Veuillez taper "SUPPRIMER" pour confirmer');
      return;
    }

    setLoading(true);
    try {
      if (!user) return;

      // Utiliser la fonction sécurisée pour supprimer complètement le compte
      // (même fonction que le site web)
      const { error: deleteError } = await supabase.rpc('delete_user_account_safely', {
        user_id_to_delete: user.id
      });

      if (deleteError) {
        console.error('Erreur suppression compte:', deleteError);
        Alert.alert('Erreur', 'Impossible de supprimer le compte. Veuillez réessayer.');
        return;
      }

      // Nettoyer le cache du profil
      clearProfileCache();
      
      // Déconnecter l'utilisateur
      await signOut();

      Alert.alert(
        'Compte supprimé',
        'Votre compte a été supprimé avec succès.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Home' as never);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erreur suppression compte:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setDeleteConfirmation('');
    }
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    danger = false 
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, danger && styles.dangerIcon]}>
          <Ionicons 
            name={icon as any} 
            size={24} 
            color={danger ? '#FF3B30' : '#2E7D32'} 
          />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, danger && styles.dangerText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const NotificationItem = ({ 
    icon, 
    title, 
    subtitle, 
    value, 
    onToggle,
    disabled = false
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onToggle: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <View style={[styles.settingItem, disabled && styles.disabledItem]}>
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, disabled && styles.disabledIcon]}>
          <Ionicons 
            name={icon as any} 
            size={24} 
            color={disabled ? '#ccc' : '#2E7D32'} 
          />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, disabled && styles.disabledText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.settingSubtitle, disabled && styles.disabledText]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.switch,
          value && styles.switchActive,
          disabled && styles.switchDisabled
        ]}
        onPress={() => !disabled && onToggle(!value)}
        disabled={disabled}
      >
        <View style={[
          styles.switchThumb,
          value && styles.switchThumbActive,
          disabled && styles.switchThumbDisabled
        ]} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Compte */}
        <Text style={styles.sectionTitle}>Compte</Text>
        <View style={styles.section}>
          <SettingItem
            icon="lock-closed-outline"
            title="Mot de passe"
            subtitle="Changer votre mot de passe"
            onPress={() => setShowResetModal(true)}
          />
        </View>

        {/* Section Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.section}>
          <NotificationItem
            icon="notifications-outline"
            title="Notifications push"
            subtitle="Recevoir des notifications sur votre appareil"
            value={pushNotifications}
            onToggle={(value) => handleNotificationToggle('push', value)}
          />
          
          <NotificationItem
            icon="mail-outline"
            title="Notifications email"
            subtitle="Recevoir des emails de notification"
            value={emailNotifications}
            onToggle={(value) => handleNotificationToggle('email', value)}
          />
          
          <NotificationItem
            icon="calendar-outline"
            title="Réservations"
            subtitle="Nouvelles réservations et confirmations"
            value={bookingNotifications}
            onToggle={(value) => handleNotificationToggle('booking', value)}
            disabled={!emailNotifications}
          />
          
          <NotificationItem
            icon="chatbubbles-outline"
            title="Messages"
            subtitle="Nouveaux messages des voyageurs"
            value={messageNotifications}
            onToggle={(value) => handleNotificationToggle('message', value)}
            disabled={!emailNotifications}
          />
          
          <NotificationItem
            icon="megaphone-outline"
            title="Marketing"
            subtitle="Offres spéciales et actualités"
            value={marketingNotifications}
            onToggle={(value) => handleNotificationToggle('marketing', value)}
            disabled={!emailNotifications}
          />
        </View>

        {/* Section Général (sélection de devise retirée) */}

        {/* Section Confidentialité */}
        <Text style={styles.sectionTitle}>Confidentialité</Text>
        <View style={styles.section}>
          <SettingItem
            icon="shield-outline"
            title="Politique de confidentialité"
            subtitle="Lire notre politique"
            onPress={() => (navigation as any).navigate('PrivacyPolicy')}
          />
          
          <SettingItem
            icon="document-text-outline"
            title="Conditions d'utilisation"
            subtitle="Lire nos conditions"
            onPress={() => (navigation as any).navigate('Terms')}
          />
        </View>

        {/* Section Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.section}>
          <SettingItem
            icon="mail-outline"
            title="Support AkwaHome"
            subtitle="support@akwahome.com"
            onPress={() => Alert.alert('Support', 'Écrivez-nous à support@akwahome.com')}
          />
        </View>

        {/* Section Danger */}
        <Text style={styles.sectionTitle}>Zone dangereuse</Text>
        <View style={styles.section}>
          <SettingItem
            icon="trash-outline"
            title="Supprimer mon compte"
            subtitle="Cette action est irréversible"
            onPress={() => setShowDeleteModal(true)}
            danger={true}
          />
        </View>

        {/* Informations de l'app */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>AkwaHome Mobile</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Modal de réinitialisation de mot de passe */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Réinitialiser le mot de passe</Text>
              <TouchableOpacity onPress={() => setShowResetModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalText}>
              Un email de réinitialisation sera envoyé à votre adresse email.
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowResetModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButtonPrimary, loading && styles.disabledButton]}
                onPress={handlePasswordReset}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de suppression de compte */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, styles.dangerText]}>Supprimer le compte</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalText}>
              Cette action est irréversible. Toutes vos données seront supprimées définitivement.
            </Text>
            
            <Text style={styles.modalText}>
              Tapez "SUPPRIMER" pour confirmer :
            </Text>
            
            <TextInput
              style={styles.confirmationInput}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="SUPPRIMER"
              autoCapitalize="characters"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
              >
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButtonDanger, 
                  loading && styles.disabledButton,
                  deleteConfirmation.toLowerCase() !== 'supprimer' && styles.disabledButton
                ]}
                onPress={handleDeleteAccount}
                disabled={loading || deleteConfirmation.toLowerCase() !== 'supprimer'}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonDangerText}>Supprimer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal de sélection de devise supprimée (présente dans l'en-tête) */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dangerIcon: {
    backgroundColor: '#fff5f5',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  dangerText: {
    color: '#FF3B30',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  confirmationInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButtonSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    color: '#666',
  },
  modalButtonPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalButtonDanger: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
  },
  modalButtonDangerText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledItem: {
    opacity: 0.5,
  },
  disabledIcon: {
    backgroundColor: '#f5f5f5',
  },
  disabledText: {
    color: '#ccc',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ddd',
    padding: 2,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#2E7D32',
  },
  switchDisabled: {
    backgroundColor: '#f0f0f0',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  switchThumbDisabled: {
    backgroundColor: '#f5f5f5',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalPlaceholder: {
    width: 40,
  },
});

export default SettingsScreen;
