import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEmailVerification } from '../hooks/useEmailVerification';

interface EmailVerificationModalProps {
  visible: boolean;
  email: string;
  firstName: string;
  onVerificationSuccess: () => void;
  onClose: () => void;
}

const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  visible,
  email,
  firstName,
  onVerificationSuccess,
  onClose,
}) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const { verifyCode, resendCode, loading, error } = useEmailVerification();

  useEffect(() => {
    if (visible) {
      setCode('');
      setTimeLeft(600); // 10 minutes en secondes
      setCanResend(false);
      startTimer();
    }
  }, [visible]);

  const startTimer = () => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (text: string) => {
    // Ne garder que les chiffres et limiter à 6 caractères
    const numericCode = text.replace(/\D/g, '').slice(0, 6);
    setCode(numericCode);
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer un code à 6 chiffres');
      return;
    }

    setIsVerifying(true);
    const result = await verifyCode(email, code);

    if (result.success) {
      Alert.alert(
        'Succès',
        'Votre email a été vérifié avec succès !',
        [
          {
            text: 'OK',
            onPress: onVerificationSuccess,
          },
        ]
      );
    } else {
      Alert.alert('Erreur', result.error || 'Code de vérification invalide');
    }

    setIsVerifying(false);
  };

  const handleResendCode = async () => {
    setIsResending(true);
    const result = await resendCode(email, firstName);

    if (result.success) {
      Alert.alert('Code renvoyé', 'Un nouveau code de vérification a été envoyé à votre email');
      setTimeLeft(600);
      setCanResend(false);
      startTimer();
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de renvoyer le code');
    }

    setIsResending(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.title}>Vérification d'email</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={64} color="#2E7D32" />
            </View>

            <Text style={styles.welcomeText}>
              Bienvenue {firstName} ! 👋
            </Text>

            <Text style={styles.description}>
              Nous avons envoyé un code de vérification à 6 chiffres à votre adresse email :
            </Text>

            <Text style={styles.emailText}>{email}</Text>

            <Text style={styles.instructionText}>
              Entrez le code reçu pour vérifier votre email :
            </Text>

            {/* Code Input */}
            <View style={styles.codeContainer}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={handleCodeChange}
                placeholder="000000"
                keyboardType="numeric"
                maxLength={6}
                textAlign="center"
                placeholderTextColor="#999"
              />
            </View>

            {/* Timer */}
            {timeLeft > 0 && (
              <Text style={styles.timerText}>
                Code valide pendant : {formatTime(timeLeft)}
              </Text>
            )}

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.verifyButton,
                (code.length !== 6 || isVerifying) && styles.verifyButtonDisabled
              ]}
              onPress={handleVerifyCode}
              disabled={code.length !== 6 || isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.verifyButtonText}>Vérifier le code</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Resend Button */}
            <TouchableOpacity
              style={[
                styles.resendButton,
                !canResend && styles.resendButtonDisabled
              ]}
              onPress={handleResendCode}
              disabled={!canResend || isResending}
            >
              {isResending ? (
                <ActivityIndicator color="#2E7D32" size="small" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={16} color="#2E7D32" />
                  <Text style={styles.resendButtonText}>Renvoyer le code</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                Vous n'avez pas reçu le code ? Vérifiez vos spams ou attendez la fin du timer pour en demander un nouveau.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
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
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 22,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  codeContainer: {
    marginBottom: 20,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    width: 200,
    letterSpacing: 8,
  },
  timerText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '500',
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    minWidth: 200,
    justifyContent: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  helpContainer: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 15,
    marginTop: 20,
  },
  helpText: {
    fontSize: 12,
    color: '#2E7D32',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default EmailVerificationModal;








