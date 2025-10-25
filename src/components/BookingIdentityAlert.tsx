import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import IdentityVerificationAlert from './IdentityVerificationAlert';

interface BookingIdentityAlertProps {
  onVerificationComplete?: () => void;
}

export const BookingIdentityAlert: React.FC<BookingIdentityAlertProps> = ({ 
  onVerificationComplete 
}) => {
  const { verificationStatus, isVerified } = useIdentityVerification();

  // Si l'utilisateur est vérifié, ne pas afficher l'alerte
  if (isVerified) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.alert}>
        <View style={styles.alertHeader}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#f59e0b" />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>
              Vérification d'identité requise
            </Text>
            <Text style={styles.alertMessage}>
              Pour effectuer une réservation, vous devez d'abord vérifier votre identité. 
              Cette mesure de sécurité protège les hôtes et garantit la sécurité de tous.
            </Text>
          </View>
        </View>

        {/* Instructions spécifiques aux réservations */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>Pourquoi cette vérification ?</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.benefitText}>Protection des hôtes contre les réservations frauduleuses</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.benefitText}>Sécurité renforcée pour tous les utilisateurs</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.benefitText}>Processus de réservation plus fiable</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.benefitText}>Conformité aux réglementations locales</Text>
            </View>
          </View>
        </View>

        {/* Composant d'upload d'identité */}
        <IdentityVerificationAlert 
          onVerificationComplete={onVerificationComplete}
          showUploadForm={verificationStatus === null || verificationStatus === 'rejected'}
        />
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
    borderColor: '#f59e0b',
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
    marginBottom: 16,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
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
    marginBottom: 12,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
  },
});

export default BookingIdentityAlert;
