import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import IdentityUpload from './IdentityUpload';

interface IdentityVerificationAlertProps {
  onVerificationComplete?: () => void;
  showUploadForm?: boolean;
}

export const IdentityVerificationAlert: React.FC<IdentityVerificationAlertProps> = ({ 
  onVerificationComplete, 
  showUploadForm = false 
}) => {
  const { verificationStatus, loading, checkIdentityStatus } = useIdentityVerification();
  const [showUpload, setShowUpload] = useState(showUploadForm);

  if (loading) return null;

  // Messages selon le statut
  const alertConfig = {
    rejected: {
      icon: 'close-circle' as const,
      color: '#dc2626',
      title: 'Document refusé',
      message: 'Votre pièce d\'identité a été refusée. Veuillez envoyer un nouveau document valide pour effectuer une réservation.',
      showUploadButton: true
    },
    pending: {
      icon: 'time-outline' as const,
      color: '#f59e0b',
      title: 'Vérification en cours',
      message: 'Votre pièce d\'identité est en cours de vérification par notre équipe. Vous pourrez réserver une fois qu\'elle sera validée.',
      showUploadButton: false
    },
    null: {
      icon: 'warning-outline' as const,
      color: '#f59e0b',
      title: 'Vérification d\'identité requise',
      message: 'Pour effectuer une réservation, vous devez d\'abord vérifier votre identité en téléchargeant une pièce d\'identité valide.',
      showUploadButton: true
    }
  };

  const config = alertConfig[verificationStatus || 'null'];

  // Si l'utilisateur est vérifié, ne pas afficher l'alerte
  if (verificationStatus === 'verified') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.alert, { borderColor: config.color }]}>
        <View style={styles.alertHeader}>
          <Ionicons name={config.icon} size={24} color={config.color} />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: config.color }]}>
              {config.title}
            </Text>
            <Text style={styles.alertMessage}>
              {config.message}
            </Text>
          </View>
        </View>

        {/* Instructions pour les documents acceptés */}
        {verificationStatus !== 'verified' && (
          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>Documents acceptés :</Text>
            <View style={styles.documentList}>
              <Text style={styles.documentItem}>• Carte Nationale d'Identité</Text>
              <Text style={styles.documentItem}>• Passeport</Text>
              <Text style={styles.documentItem}>• Permis de Conduire</Text>
              <Text style={styles.documentItem}>• Tout autre document officiel permettant l'identification</Text>
            </View>
          </View>
        )}
        
        {!showUpload ? (
          config.showUploadButton && (
            <TouchableOpacity 
              style={[styles.uploadButton, { backgroundColor: config.color }]}
              onPress={() => setShowUpload(true)}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>
                {verificationStatus === 'rejected' ? 'Envoyer un nouveau document' : 'Vérifier mon identité maintenant'}
              </Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.uploadForm}>
            <Text style={styles.uploadFormTitle}>
              Téléchargez une pièce d'identité valide
            </Text>
            <IdentityUpload 
              userId="current" // Sera remplacé par l'ID de l'utilisateur connecté
              onUploadSuccess={() => {
                setShowUpload(false);
                // Mettre à jour le statut de vérification
                checkIdentityStatus(true);
                onVerificationComplete?.();
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  alert: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  instructions: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  documentList: {
    marginLeft: 8,
  },
  documentItem: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  uploadForm: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  uploadFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
});

export default IdentityVerificationAlert;
