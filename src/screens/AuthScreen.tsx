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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import PasswordValidation from '../components/PasswordValidation';
import EmailVerificationModal from '../components/EmailVerificationModal';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { useLanguage } from '../contexts/LanguageContext';

type AuthScreenRouteProp = RouteProp<RootStackParamList, 'Auth'>;

const AuthScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AuthScreenRouteProp>();
  const { t } = useLanguage();
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
  const [dateError, setDateError] = useState<string | null>(null);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<{
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  const { generateVerificationCode } = useEmailVerification();

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

  // Fonction pour convertir la date du format DD/MM/YYYY vers YYYY-MM-DD (ISO)
  const convertDateToISO = (dateString: string): string | null => {
    if (!dateString) return null;
    
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    
    // Retourner au format YYYY-MM-DD
    return `${year}-${month}-${day}`;
  };

  // Fonction de validation de l'âge
  const validateAdultAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return { isValid: false, message: t('auth.dateOfBirthRequired') };
    
    // Parser la date au format DD/MM/YYYY
    const parts = dateOfBirth.split('/');
    if (parts.length !== 3) {
      return { isValid: false, message: t('auth.invalidDateFormat') };
    }
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Les mois commencent à 0 en JavaScript
    const year = parseInt(parts[2], 10);
    
    // Vérifier que les valeurs sont valides
    if (isNaN(day) || isNaN(month) || isNaN(year) || 
        day < 1 || day > 31 || month < 0 || month > 11 || year < 1900) {
      return { isValid: false, message: t('auth.invalidDate') };
    }
    
    const birthDate = new Date(year, month, day);
    const today = new Date();
    
    // Vérifier que la date de naissance est dans le passé
    if (birthDate > today) {
      return { isValid: false, message: t('auth.dateCannotBeFuture') };
    }
    
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;
    
    return {
      isValid: actualAge >= 18,
      message: actualAge >= 18 ? '' : t('auth.mustBe18')
    };
  };

  // Fonction de validation complète
  const validateSignupForm = () => {
    if (!firstName.trim()) return t('auth.firstNameRequired');
    if (!lastName.trim()) return t('auth.lastNameRequired');
    if (!email.trim()) return t('auth.emailRequired');
    if (!dateOfBirth) return t('auth.dateOfBirthRequired');
    
    const ageValidation = validateAdultAge(dateOfBirth);
    if (!ageValidation.isValid) return ageValidation.message;
    
    if (!password) return t('auth.passwordRequired');
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) return t('auth.passwordRequirements');
    
    if (password !== confirmPassword) return t('auth.passwordsDontMatch');
    if (!agreeTerms) return t('auth.mustAgreeTerms');
    
    return null;
  };

  const handleEmailVerificationSuccess = () => {
    setShowEmailVerification(false);
    setPendingUserData(null);
    
    // Naviguer vers l'écran approprié
    if (returnTo) {
      navigation.navigate(returnTo as any, returnParams);
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  };

  const handleCloseEmailVerification = () => {
    setShowEmailVerification(false);
    setPendingUserData(null);
    // L'utilisateur peut continuer sans vérifier l'email
  };

  const handleAuth = async () => {
    if (isLogin) {
      // Validation pour la connexion
      if (!email || !password) {
        Alert.alert(t('common.error'), t('auth.fillAllFields'));
        return;
      }
    } else {
      // Validation complète pour l'inscription
      const validationError = validateSignupForm();
      if (validationError) {
        Alert.alert(t('auth.validationError'), validationError);
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Connexion
        await signIn(email, password);

        // Attendre un peu pour que l'utilisateur soit disponible
        await new Promise(resolve => setTimeout(resolve, 500));

        // Récupérer l'utilisateur actuel
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        // Redirection automatique après connexion réussie
        if (returnTo && returnTo !== 'Auth') {
          if (returnParams) {
            navigation.replace(returnTo as any, returnParams);
          } else {
            navigation.replace(returnTo as any);
          }
        } else {
          // Vérifier le mode préféré sauvegardé
          try {
            const preferredMode = await AsyncStorage.getItem('preferredMode');
            if (preferredMode === 'host' && currentUser) {
              // Vérifier que l'utilisateur est bien hôte
              const { data: profile } = await supabase
                .from('profiles')
                .select('is_host')
                .eq('user_id', currentUser.id)
                .single();

              const { data: properties } = await supabase
                .from('properties')
                .select('id')
                .eq('host_id', currentUser.id)
                .limit(1);

              const isHost = profile?.is_host || (properties && properties.length > 0);

              if (isHost) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'HostSpace' }],
                });
              } else {
                // L'utilisateur n'est pas hôte, réinitialiser le mode préféré
                await AsyncStorage.setItem('preferredMode', 'traveler');
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }
            } else if (preferredMode === 'vehicle' && currentUser) {
              // Vérifier si l'utilisateur a des véhicules
              const { data: vehicles } = await supabase
                .from('vehicles')
                .select('id')
                .eq('owner_id', currentUser.id)
                .limit(1);

              if (vehicles && vehicles.length > 0) {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'VehicleOwnerSpace' }],
                });
              } else {
                // L'utilisateur n'a pas de véhicules, réinitialiser le mode préféré
                await AsyncStorage.setItem('preferredMode', 'traveler');
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }
            } else {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            }
          } catch (error) {
            console.error('Error checking preferred mode:', error);
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }
      } else {
        // Inscription
        // Convertir la date au format ISO (YYYY-MM-DD) pour la base de données
        const dateOfBirthISO = convertDateToISO(dateOfBirth);
        
        await signUp(email, password, {
          first_name: firstName,
          last_name: lastName,
          date_of_birth: dateOfBirthISO || dateOfBirth
        });

        // Créer ou mettre à jour le profil dans la table profiles
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Vérifier si le profil existe déjà
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('user_id')
              .eq('user_id', user.id)
              .single();

            const profileData: any = {
              first_name: firstName,
              last_name: lastName,
              email: email,
              date_of_birth: dateOfBirthISO, // Utiliser le format ISO
            };


            if (existingProfile) {
              // Le profil existe déjà, le mettre à jour
              // Utiliser la même approche que le site web
              const { error: profileError } = await supabase
                .from('profiles')
                .update(profileData)
                .eq('user_id', user.id);

              if (profileError) {
                console.error('Erreur mise à jour profil:', profileError);
                // Ne pas bloquer l'inscription si la mise à jour du profil échoue
                // Le profil existe déjà et l'utilisateur peut continuer
              } else {
                console.log('✅ Profil mis à jour automatiquement');
              }
            } else {
              // Le profil n'existe pas, le créer
              const insertData: any = {
                user_id: user.id,
                first_name: firstName,
                last_name: lastName,
                email: email,
                date_of_birth: dateOfBirthISO, // Utiliser le format ISO
                role: 'user',
                is_host: false,
              };


              const { error: profileError } = await supabase
                .from('profiles')
                .insert(insertData);

              if (profileError) {
                // Si l'erreur est due à un doublon, essayer de mettre à jour
                if (profileError.code === '23505') {
                  console.log('⚠️ Profil existe déjà, mise à jour...');
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                      first_name: firstName,
                      last_name: lastName,
                      email: email,
                      date_of_birth: dateOfBirthISO,
                    })
                    .eq('user_id', user.id);
                  
                  if (updateError) {
                    console.error('Erreur mise à jour profil:', updateError);
                    // Ne pas bloquer l'inscription si la mise à jour du profil échoue
                  } else {
                    console.log('✅ Profil mis à jour automatiquement');
                  }
                } else {
                  console.error('Erreur création profil:', profileError);
                }
              } else {
                console.log('✅ Profil créé automatiquement');
              }
            }

        // Générer et envoyer le code de vérification email
        const codeResult = await generateVerificationCode(email, firstName);
        
        if (codeResult.success) {
          console.log('✅ Email de vérification envoyé');
          
          // Stocker les données utilisateur pour la vérification
          setPendingUserData({
            email,
            firstName,
            lastName
          });
          
          // Afficher la modal de vérification
          setShowEmailVerification(true);
        } else {
          console.error('❌ Erreur envoi email:', codeResult.error);
          Alert.alert(t('common.error'), t('emailVerification.sendError'));
          setLoading(false);
          return;
        }
          }
        } catch (profileError) {
          console.error('Erreur création profil:', profileError);
        }

        Alert.alert(
          t('auth.signupSuccess'),
          t('emailVerification.codeSentDesc'),
          [
            {
              text: t('common.ok'),
              onPress: () => {
                // La modal de vérification sera affichée automatiquement
                setLoading(false);
              }
            }
          ]
        );
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('common.errorOccurred'));
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

  // Fonction pour formater automatiquement la date avec les séparateurs
  const handleDateInputChange = (text: string) => {
    // Supprimer tous les caractères non numériques
    const numericText = text.replace(/\D/g, '');
    
    // Limiter à 8 chiffres (DDMMYYYY)
    const limitedText = numericText.slice(0, 8);
    
    // Formater avec les séparateurs
    let formattedText = '';
    if (limitedText.length >= 1) {
      formattedText = limitedText.slice(0, 2);
    }
    if (limitedText.length >= 3) {
      formattedText += '/' + limitedText.slice(2, 4);
    }
    if (limitedText.length >= 5) {
      formattedText += '/' + limitedText.slice(4, 8);
    }
    
    setDateOfBirth(formattedText);
    
    // Validation en temps réel si la date est complète
    if (formattedText.length === 10) { // DD/MM/YYYY
      const ageValidation = validateAdultAge(formattedText);
      setDateError(ageValidation.isValid ? null : ageValidation.message);
    } else {
      setDateError(null);
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
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.navigate('Home')}
            >
              <Ionicons name="arrow-back" size={24} color="#2E7D32" />
              <Text style={styles.backButtonText}>{t('common.back')}</Text>
            </TouchableOpacity>
            
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/akwahome_logo.png')} 
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
              {isLogin ? t('auth.login') : t('auth.createAccount')}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? t('auth.loginSubtitle')
                : t('auth.signupSubtitle')}
            </Text>

            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.firstName')}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.lastName')}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, dateError && styles.inputError]}
                    placeholder={t('auth.dateOfBirth')}
                    value={dateOfBirth}
                    onChangeText={handleDateInputChange}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholderTextColor="#999"
                  />
                </View>
                {dateError && (
                  <Text style={styles.errorText}>{dateError}</Text>
                )}
              </>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
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
                placeholder={t('auth.password')}
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
                  placeholder={t('auth.confirmPassword')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            )}

            {!isLogin && (
              <>
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
                      {t('auth.acceptTerms')}{' '}
                      <Text style={styles.termsLink} onPress={openTerms}>{t('auth.termsOfService')}</Text>
                      {' '}{t('auth.ofAkwaHome')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.authButton, (loading || (!isLogin && !agreeTerms)) && styles.authButtonDisabled]}
              onPress={handleAuth}
              disabled={loading || (!isLogin && !agreeTerms)}
            >
              <Text style={styles.authButtonText}>
                {loading
                  ? t('common.loading')
                  : isLogin
                  ? t('auth.signIn')
                  : t('auth.createAccount')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleButton} onPress={toggleAuthMode}>
              <Text style={styles.toggleButtonText}>
                {isLogin
                  ? t('auth.dontHaveAccount') + ' ' + t('auth.signup')
                  : t('auth.alreadyHaveAccount') + ' ' + t('auth.login')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('auth.byContinuing')}{' '}
              <Text style={styles.linkText}>{t('auth.termsOfService')}</Text> {t('auth.and')}{' '}
              <Text style={styles.linkText}>{t('settings.privacyPolicy')}</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal des conditions générales (fallback) */}
      {showTermsModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('auth.termsOfService')}</Text>
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
              <Text style={styles.modalCloseButtonText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal de vérification d'email */}
      {pendingUserData && (
        <EmailVerificationModal
          visible={showEmailVerification}
          email={pendingUserData.email}
          firstName={pendingUserData.firstName}
          onVerificationSuccess={handleEmailVerificationSuccess}
          onClose={handleCloseEmailVerification}
          canClose={false} // Ne peut pas être fermée sans vérification lors de la création de compte
        />
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
  inputError: {
    borderColor: '#dc2626',
  },
  inputSuccess: {
    borderColor: '#2E7D32',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 15,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    marginLeft: 15,
  },
  successText: {
    color: '#2E7D32',
    fontSize: 12,
    marginLeft: 8,
  },
});

export default AuthScreen;