import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import IdentityUpload from './IdentityUpload';
import { useAuth } from '../services/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface BookingIdentityAlertProps {
  onVerificationComplete?: () => void;
}

export const BookingIdentityAlert: React.FC<BookingIdentityAlertProps> = ({ 
  onVerificationComplete 
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { verificationStatus, isVerified, checkIdentityStatus } = useIdentityVerification();
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Si l'utilisateur est vérifié, ne pas afficher l'alerte
  if (isVerified) {
    return null;
  }

  const getStatusInfo = () => {
    switch (verificationStatus) {
      case 'pending':
        return {
          icon: 'time-outline',
          color: '#f59e0b',
          title: t('identity.pendingTitle'),
          message: t('identity.pendingMessage'),
        };
      case 'rejected':
        return {
          icon: 'close-circle-outline',
          color: '#ef4444',
          title: t('profile.identityRejected'),
          message: t('identity.rejectedMessage'),
        };
      default:
        return {
          icon: 'shield-checkmark-outline',
          color: '#f59e0b',
          title: t('booking.identityRequired'),
          message: t('identity.requiredMessage'),
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleVerifyIdentity = () => {
    if (verificationStatus === 'pending') {
      // Si en cours, on peut afficher les détails ou permettre un nouveau upload
      setShowUploadForm(true);
    } else {
      // Si pas encore uploadé ou refusé, afficher le formulaire
      setShowUploadForm(true);
    }
  };

  const handleUploadSuccess = () => {
    setShowUploadForm(false);
    // Mettre à jour le statut de vérification
    checkIdentityStatus(true);
    onVerificationComplete?.();
  };

  // Si on affiche le formulaire d'upload (pour tous les cas sauf vérifié)
  if (showUploadForm && user) {
    return (
      <View style={styles.uploadContainer}>
        <View style={styles.uploadHeader}>
          <Text style={styles.uploadTitle}>
            {verificationStatus === 'pending' ? t('identity.statusTitle') : t('identity.verifyTitle')}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowUploadForm(false)}
          >
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        {/* Message spécial pour vérification en cours */}
        {verificationStatus === 'pending' && (
          <View style={styles.pendingStatus}>
            <View style={styles.pendingHeader}>
              <Ionicons name="time-outline" size={24} color="#f59e0b" />
              <Text style={styles.pendingTitle}>{t('identity.pendingTitle')}</Text>
            </View>
            <Text style={styles.pendingMessage}>
              {t('identity.pendingDetail')}
            </Text>
            <View style={styles.pendingInfo}>
              <Text style={styles.pendingInfoTitle}>{t('identity.whatHappensNow')}</Text>
              <View style={styles.pendingSteps}>
                <View style={styles.pendingStep}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.pendingStepText}>{t('identity.docReceived')}</Text>
                </View>
                <View style={styles.pendingStep}>
                  <Ionicons name="time" size={16} color="#f59e0b" />
                  <Text style={styles.pendingStepText}>{t('identity.pendingTitle')}</Text>
                </View>
                <View style={styles.pendingStep}>
                  <Ionicons name="hourglass-outline" size={16} color="#6b7280" />
                  <Text style={styles.pendingStepText}>{t('identity.notificationComing')}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        
        {/* Formulaire d'upload pour les autres cas */}
        {(verificationStatus === null || verificationStatus === 'rejected') && (
          <IdentityUpload 
            userId={user.id} 
            onUploadSuccess={handleUploadSuccess}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.alert}>
        <View style={styles.alertHeader}>
          <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: statusInfo.color }]}>
              {statusInfo.title}
            </Text>
            <Text style={styles.alertMessage}>
              {statusInfo.message}
            </Text>
          </View>
        </View>

        {/* Bouton d'action compact */}
        {(verificationStatus === null || verificationStatus === 'rejected' || verificationStatus === 'pending') && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: statusInfo.color }]}
            onPress={handleVerifyIdentity}
          >
            <Ionicons 
              name={
                verificationStatus === 'pending' ? 'eye-outline' : 
                verificationStatus === 'rejected' ? 'refresh-outline' : 
                'camera-outline'
              } 
              size={16} 
              color="#fff" 
            />
            <Text style={styles.actionButtonText}>
              {verificationStatus === 'pending' ? t('identity.viewStatus') :
               verificationStatus === 'rejected' ? t('identity.sendNewDoc') : 
               t('identity.verifyMine')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  alert: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertContent: {
    flex: 1,
    marginLeft: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  uploadContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  pendingStatus: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 8,
  },
  pendingMessage: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
    marginBottom: 16,
  },
  pendingInfo: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 12,
  },
  pendingInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pendingSteps: {
    gap: 6,
  },
  pendingStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingStepText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
  },
});

export default BookingIdentityAlert;
