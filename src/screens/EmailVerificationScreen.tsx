import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';

type EmailVerificationScreenRouteProp = RouteProp<RootStackParamList, 'EmailVerification'>;

const EmailVerificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<EmailVerificationScreenRouteProp>();
  const { email, firstName } = route.params;

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes en secondes

  // Timer pour l'expiration du code
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (value: string) => {
    // Ne garder que les chiffres et limiter à 6 caractères
    const numericCode = value.replace(/\D/g, '').slice(0, 6);
    setCode(numericCode);
    setError(null);
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Veuillez entrer un code à 6 chiffres');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Vérifier le code dans notre table email_verification_codes
      const { data: verificationData, error: verifyError } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (verifyError) {
        console.error('Erreur vérification:', verifyError);
        setError('Erreur lors de la vérification. Veuillez réessayer.');
        setIsLoading(false);
        return;
      }

      if (!verificationData || verificationData.length === 0) {
        setError('Code de vérification invalide. Veuillez réessayer.');
        setIsLoading(false);
        return;
      }

      const verification = verificationData[0];

      // Vérifier si le code a expiré
      if (new Date(verification.expires_at) < new Date()) {
        setError('Le code a expiré. Veuillez demander un nouveau code.');
        setIsLoading(false);
        return;
      }

      // Marquer le code comme utilisé
      await supabase
        .from('email_verification_codes')
        .update({ used: true })
        .eq('id', verification.id);

      // Mettre à jour le profil pour marquer l'email comme vérifié
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ email_verified: true })
          .eq('user_id', user.id);
      }

      Alert.alert(
        'Email vérifié avec succès !',
        'Votre compte a été activé. Bienvenue sur AkwaHome !',
        [{ text: 'OK', onPress: () => navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        })}]
      );
    } catch (err) {
      console.error('Verification error:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError(null);

    try {
      // Générer un nouveau code de vérification à 6 chiffres
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Stocker le nouveau code dans la base de données
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expire dans 10 minutes
      
      await supabase
        .from('email_verification_codes')
        .insert({
          email: email,
          code: verificationCode,
          expires_at: expiresAt.toISOString()
        });
        
      // Envoyer l'email avec le nouveau code
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'email_confirmation',
          to: email,
          data: {
            firstName: firstName,
            verificationCode: verificationCode
          }
        }
      });

      // Réinitialiser le timer
      setTimeLeft(600);
      
      Alert.alert(
        'Code renvoyé',
        'Un nouveau code de vérification a été envoyé à votre email.'
      );
    } catch (err) {
      console.error('Resend error:', err);
      setError('Impossible de renvoyer le code. Veuillez réessayer.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="mail" size={60} color="#2E7D32" />
              <Text style={styles.logoText}>AkwaHome</Text>
              <Text style={styles.logoSubtext}>Vérification d'email</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>
              Vérifiez votre email 📧
            </Text>
            
            <Text style={styles.subtitle}>
              Bonjour {firstName} ! Nous avons envoyé un code de vérification à 6 chiffres à :
            </Text>
            
            <Text style={styles.emailText}>{email}</Text>
            
            <Text style={styles.instruction}>
              Entrez le code reçu dans votre boîte mail :
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
                autoFocus
              />
            </View>

            {/* Timer */}
            {timeLeft > 0 && (
              <Text style={styles.timerText}>
                Code valide pendant : {formatTime(timeLeft)}
              </Text>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.verifyButton, (isLoading || code.length !== 6) && styles.verifyButtonDisabled]}
              onPress={handleVerifyCode}
              disabled={isLoading || code.length !== 6}
            >
              <Text style={styles.verifyButtonText}>
                {isLoading ? 'Vérification...' : 'Vérifier le code'}
              </Text>
            </TouchableOpacity>

            {/* Resend Code */}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={isResending}
            >
              <Text style={styles.resendButtonText}>
                {isResending ? 'Envoi en cours...' : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                Vous ne recevez pas l'email ? Vérifiez votre dossier spam ou renvoyez le code.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginTop: 10,
  },
  logoSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 30,
  },
  instruction: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 30,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  codeInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    width: 200,
    textAlign: 'center',
    letterSpacing: 8,
  },
  timerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
  },
  verifyButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '500',
  },
  helpContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default EmailVerificationScreen;

