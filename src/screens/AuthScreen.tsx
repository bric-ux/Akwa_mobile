import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import PasswordValidation from '../components/PasswordValidation';

type AuthScreenRouteProp = RouteProp<RootStackParamList, 'Auth'>;

const AuthScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AuthScreenRouteProp>();
  const { returnTo, returnParams } = route.params || {};
  const { signIn, signUp } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Fonction de validation du mot de passe
  const validatePassword = (password: string) => {
    const rules = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    };
    
    return {
      isValid: Object.values(rules).every(Boolean),
      rules
    };
  };

  // Fonction de validation de l'âge
  const validateAdultAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return { isValid: false, message: 'La date de naissance est requise' };
    
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;
    
    return {
      isValid: actualAge >= 18,
      message: actualAge >= 18 ? '' : 'Vous devez avoir au moins 18 ans pour vous inscrire'
    };
  };

  // Fonction de validation complète
  const validateSignupForm = () => {
    if (!firstName.trim()) return 'Le prénom est requis';
    if (!lastName.trim()) return 'Le nom est requis';
    if (!email.trim()) return 'L\'email est requis';
    if (!dateOfBirth) return 'La date de naissance est requise';
    
    const ageValidation = validateAdultAge(dateOfBirth);
    if (!ageValidation.isValid) return ageValidation.message;
    
    if (!password) return 'Le mot de passe est requis';
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) return 'Le mot de passe doit contenir au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&)';
    
    if (password !== confirmPassword) return 'Les mots de passe ne correspondent pas';
    if (!agreeTerms) return 'Vous devez accepter les conditions générales d\'utilisation';
    
    return null;
  };

  const handleAuth = async () => {
    if (isLogin) {
      // Validation pour la connexion
      if (!email || !password) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        return;
      }
    } else {
      // Validation complète pour l'inscription
      const validationError = validateSignupForm();
      if (validationError) {
        Alert.alert('Erreur de validation', validationError);
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Connexion
        await signIn(email, password);

        // Redirection automatique après connexion réussie
        if (returnTo && returnTo !== 'Auth') {
          if (returnParams) {
            navigation.replace(returnTo as any, returnParams);
          } else {
            navigation.replace(returnTo as any);
          }
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        }
      } else {
        // Inscription
        await signUp(email, password, {
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirth
        });

        // Créer automatiquement le profil dans la table profiles
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: profileError } = await supabase
              .from('profiles')
              .insert({
                user_id: user.id,
                first_name: firstName,
                last_name: lastName,
                email: email,
                date_of_birth: dateOfBirth,
                role: 'user',
                is_host: false,
              });

            if (profileError) {
              console.error('Erreur création profil:', profileError);
            } else {
              console.log('✅ Profil créé automatiquement');
            }
          }
        } catch (profileError) {
          console.error('Erreur création profil:', profileError);
        }

        Alert.alert(
          'Inscription réussie',
          'Votre compte a été créé avec succès !',
          [
            {
              text: 'OK',
              onPress: () => {
                // Retourner à la page d'origine si spécifiée
                if (returnTo && returnParams) {
                  navigation.replace(returnTo as any, returnParams);
                } else {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                }
              }
            }
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setDateOfBirth('');
    setAgreeTerms(false);
  };

  const openTerms = async () => {
    try {
      // URL des conditions générales sur le site web AkwaHome
      const termsUrl = 'https://akwahome.com/terms';
      
      // Vérifier si l'URL peut être ouverte
      const canOpen = await Linking.canOpenURL(termsUrl);
      
      if (canOpen) {
        try {
          await Linking.openURL(termsUrl);
          return; // Si l'ouverture réussit, on s'arrête ici
        } catch (openError) {
          console.log('URL externe non accessible, affichage du modal local');
          // Si l'ouverture échoue, on affiche le modal local
          setShowTermsModal(true);
        }
      } else {
        // Si l'URL ne peut pas être ouverte, afficher le modal local
        setShowTermsModal(true);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture des conditions générales:', error);
      // En cas d'erreur, afficher le modal local
      setShowTermsModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.navigate('Home')}
            >
              <Ionicons name="arrow-back" size={24} color="#2E7D32" />
              <Text style={styles.backButtonText}>Retour</Text>
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/akwa-home-logo-transparent.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>AkwaHome</Text>
              <Text style={styles.logoSubtext}>Ici c'est chez vous !</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {isLogin ? 'Connexion' : 'Créer un compte'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Connectez-vous pour accéder à votre compte'
                : 'Rejoignez-nous pour découvrir de magnifiques hébergements'}
            </Text>

            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Prénom"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nom"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Date de naissance (JJ/MM/AAAA)"
                    value={dateOfBirth}
                    onChangeText={setDateOfBirth}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholderTextColor="#999"
                  />
                </View>
              </>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            
            {/* Validation du mot de passe - seulement pour l'inscription */}
            {!isLogin && (
              <PasswordValidation password={password} />
            )}

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            )}

            {!isLogin && (
              <View style={styles.termsContainer}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setAgreeTerms(!agreeTerms)}
                >
                  <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
                    {agreeTerms && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.termsText}>
                    J'accepte les{' '}
                    <Text style={styles.termsLink} onPress={openTerms}>conditions générales d'utilisation</Text>
                    {' '}d'AkwaHome
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.authButton, (loading || (!isLogin && !agreeTerms)) && styles.authButtonDisabled]}
              onPress={handleAuth}
              disabled={loading || (!isLogin && !agreeTerms)}
            >
              <Text style={styles.authButtonText}>
                {loading
                  ? 'Chargement...'
                  : isLogin
                  ? 'Se connecter'
                  : 'Créer un compte'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleButton} onPress={toggleAuthMode}>
              <Text style={styles.toggleButtonText}>
                {isLogin
                  ? "Vous n'avez pas de compte ? S'inscrire"
                  : 'Vous avez déjà un compte ? Se connecter'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              En continuant, vous acceptez nos{' '}
              <Text style={styles.linkText}>Conditions d'utilisation</Text> et notre{' '}
              <Text style={styles.linkText}>Politique de confidentialité</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal des conditions générales (fallback) */}
      {showTermsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conditions Générales d'Utilisation</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowTermsModal(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollView}>
              <Text style={styles.modalText}>
                <Text style={styles.modalSectionTitle}>1. Objet et champ d'application</Text>
                {'\n\n'}
                Les présentes conditions générales d'utilisation (CGU) régissent l'utilisation de la plateforme 
                AkwaHome, service de mise en relation entre propriétaires de logements et voyageurs en Côte d'Ivoire. 
                L'utilisation de la plateforme implique l'acceptation pleine et entière des présentes CGU.
                {'\n\n'}
                <Text style={styles.modalSectionTitle}>2. Définitions</Text>
                {'\n\n'}
                • "Plateforme" désigne le site web et l'application mobile AkwaHome{'\n'}
                • "Utilisateur" désigne toute personne utilisant la plateforme{'\n'}
                • "Hôte" désigne le propriétaire ou gestionnaire d'un logement{'\n'}
                • "Voyageur" désigne la personne réservant un logement{'\n'}
                {'\n\n'}
                <Text style={styles.modalSectionTitle}>3. Acceptation des conditions</Text>
                {'\n\n'}
                En utilisant AkwaHome, vous acceptez automatiquement les présentes conditions générales. 
                Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.
                {'\n\n'}
                <Text style={styles.modalSectionTitle}>4. Utilisation de la plateforme</Text>
                {'\n\n'}
                Vous vous engagez à utiliser AkwaHome de manière légale et responsable. Il est interdit de :
                {'\n'}
                • Publier des informations fausses ou trompeuses{'\n'}
                • Utiliser la plateforme à des fins illégales{'\n'}
                • Porter atteinte aux droits d'autrui{'\n'}
                {'\n\n'}
                <Text style={styles.modalSectionTitle}>5. Responsabilité</Text>
                {'\n\n'}
                AkwaHome agit en tant qu'intermédiaire entre les hôtes et les voyageurs. Nous ne sommes pas 
                responsables des dommages causés par les logements ou les services proposés par les hôtes.
                {'\n\n'}
                <Text style={styles.modalSectionTitle}>6. Modification des conditions</Text>
                {'\n\n'}
                Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications 
                seront effectives dès leur publication sur la plateforme.
                {'\n\n'}
                <Text style={styles.modalSectionTitle}>7. Contact</Text>
                {'\n\n'}
                Pour toute question concernant ces conditions générales, vous pouvez nous contacter à : 
                nkouadioaristide@gmail.com
                {'\n\n'}
                <Text style={styles.modalFooterText}>
                  Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
                </Text>
              </Text>
            </ScrollView>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTermsModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 15,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  logoSubtext: {
    fontSize: 16,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 5,
  },
  authButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  authButtonDisabled: {
    backgroundColor: '#ccc',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  termsContainer: {
    marginVertical: 15,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2E7D32',
    textDecorationLine: 'underline',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  toggleButtonText: {
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalScrollView: {
    maxHeight: 400,
    marginBottom: 15,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 10,
  },
  modalFooterText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 10,
  },
  modalCloseButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AuthScreen;