import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../services/supabase';
import { useUserProfile } from '../hooks/useUserProfile';
import { getProfileContactEmail, isPhonePseudoEmail } from '../lib/displayContact';
import {
  assertEmailAvailableForProfile,
  isValidContactEmail,
} from '../lib/email';
import PhoneNumberField from '../components/PhoneNumberField';
import CountrySelectField from '../components/CountrySelectField';
import { resolveProfileCountryLabel } from '../lib/phoneAuth';
import {
  assertPhoneAvailableForProfile,
  buildE164,
  isPhoneAlreadyUsedError,
  normalizePhoneE164,
  resolveProfilePhoneForInput,
} from '../lib/phone';
import { useLanguage } from '../contexts/LanguageContext';

interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
}

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { updateProfileCache } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    contact_email: '',
    bio: '',
    country: '',
    city: '',
    address: '',
    postal_code: '',
  });
  const [phoneDial, setPhoneDial] = useState('+225');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [isPhoneAccount, setIsPhoneAccount] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Vérifier d'abord si l'utilisateur est connecté
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Erreur d\'authentification:', userError);
        Alert.alert(t('common.error'), t('editProfile.sessionExpired'));
        navigation.navigate('Auth');
        return;
      }
      
      if (!user) {
        console.log('Aucun utilisateur connecté');
        Alert.alert(t('common.error'), t('editProfile.mustBeLoggedIn'));
        navigation.navigate('Auth');
        return;
      }
      
      const { data: profileRow } = await supabase
        .from('profiles')
        .select(
          'first_name, last_name, phone, phone_e164, avatar_url, bio, email, country, city, address, postal_code',
        )
        .eq('user_id', user.id)
        .maybeSingle();

      const phoneAccount = isPhonePseudoEmail(user.email);
      setIsPhoneAccount(phoneAccount);

      const userProfile: UserProfile = {
        id: user.id,
        email: getProfileContactEmail(user.email, profileRow?.email) || user.email || '',
        first_name: profileRow?.first_name || user.user_metadata?.first_name || '',
        last_name: profileRow?.last_name || user.user_metadata?.last_name || '',
        phone:
          profileRow?.phone ||
          profileRow?.phone_e164 ||
          user.user_metadata?.phone ||
          '',
        avatar_url: profileRow?.avatar_url || user.user_metadata?.avatar_url || '',
        bio: profileRow?.bio || user.user_metadata?.bio || '',
      };
      
      const phoneResolved = resolveProfilePhoneForInput({
        phone: profileRow?.phone,
        phoneE164: profileRow?.phone_e164,
        profileCountry: profileRow?.country,
      });

      setProfile(userProfile);
      setPhoneDial(phoneResolved.dial);
      setPhoneLocal(phoneResolved.local);
      setFormData({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        contact_email: getProfileContactEmail(user.email, profileRow?.email),
        bio: userProfile.bio || '',
        country: resolveProfileCountryLabel(profileRow?.country) || profileRow?.country || '',
        city: profileRow?.city || '',
        address: profileRow?.address || '',
        postal_code: profileRow?.postal_code || '',
      });
      setAvatarUri(userProfile.avatar_url || null);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      Alert.alert(t('common.error'), t('editProfile.loadError'));
      navigation.navigate('Auth');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('editProfile.permissionRequired'), t('editProfile.galleryPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection d\'image:', error);
      Alert.alert(t('common.error'), t('editProfile.pickImageError'));
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('editProfile.permissionRequired'), t('editProfile.cameraPermission'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur lors de la prise de photo:', error);
      Alert.alert(t('common.error'), t('editProfile.takePhotoError'));
    }
  };

  const showImagePicker = () => {
    Alert.alert(
      t('editProfile.pickPhotoTitle'),
      t('editProfile.pickPhotoDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('editProfile.gallery'), onPress: pickImage },
        { text: t('editProfile.camera'), onPress: takePhoto },
      ]
    );
  };

  const uploadAvatar = async (uri: string): Promise<string | null> => {
    try {
      // Vérifier si l'utilisateur est connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Pour React Native, utiliser FormData au lieu de Blob
      const formData = new FormData();
      
      // Créer un objet fichier pour FormData
      const file = {
        uri: uri,
        type: 'image/jpeg',
        name: `avatar-${Date.now()}.jpg`,
      } as any;
      
      formData.append('file', file);
      
      const fileName = `avatar-${Date.now()}.jpg`;
      const filePath = `${user.id}/${fileName}`;

      console.log('Upload vers:', filePath);

      // Utiliser fetch avec FormData
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      
      // Convertir ArrayBuffer en Uint8Array pour Supabase
      const uint8Array = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, uint8Array, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Erreur upload:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      console.log('URL générée:', data.publicUrl);
      return data.publicUrl;
    } catch (error: any) {
      console.error('Erreur lors de l\'upload:', error);
      
      // Si l'upload échoue, utiliser l'URI locale
      console.log('Upload vers Supabase Storage échoué, utilisation de l\'URI locale');
      return uri;
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      
      // Récupérer l'utilisateur connecté
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Utilisateur non connecté');
      }

      const phoneAccountSave = isPhonePseudoEmail(user.email);
      const contactEmailTrimmed = formData.contact_email.trim().toLowerCase();

      if (phoneAccountSave && contactEmailTrimmed) {
        if (!isValidContactEmail(contactEmailTrimmed)) {
          Alert.alert(t('editProfile.invalidEmailTitle'), t('editProfile.invalidEmailDesc'));
          return;
        }
        const emailCheck = await assertEmailAvailableForProfile(contactEmailTrimmed, user.id);
        if (!emailCheck.ok) {
          Alert.alert(t('editProfile.emailInUseTitle'), emailCheck.message);
          return;
        }
      }

      const phoneLocalTrimmed = phoneLocal.trim();
      const phoneE164 = phoneLocalTrimmed ? buildE164(phoneDial, phoneLocalTrimmed) : '';
      const phoneNorm = phoneE164 ? normalizePhoneE164(phoneE164) : null;

      if (phoneLocalTrimmed) {
        if (!phoneNorm) {
          Alert.alert(
            t('editProfile.invalidPhoneTitle'),
            t('editProfile.invalidPhoneDesc'),
          );
          return;
        }
        const phoneCheck = await assertPhoneAvailableForProfile(phoneNorm, user.id);
        if (!phoneCheck.ok) {
          Alert.alert(t('editProfile.phoneInUseTitle'), phoneCheck.message);
          return;
        }
      }
      
      let avatarUrl = avatarUri;
      
      // Si une nouvelle image a été sélectionnée, essayer de l'uploader
      if (avatarUri && !avatarUri.startsWith('http')) {
        try {
          avatarUrl = await uploadAvatar(avatarUri);
        } catch (error: any) {
          console.log('Upload échoué, utilisation de l\'URI locale:', error.message);
          // Continuer avec l'URI locale si l'upload échoue
        }
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: phoneNorm || '',
          bio: formData.bio,
          avatar_url: avatarUrl,
        },
      });

      if (error) throw error;

      // Vérifier et mettre à jour la table profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const profilePhoneFields: Record<string, unknown> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: phoneNorm,
        phone_e164: phoneNorm,
        bio: formData.bio,
        avatar_url: avatarUrl,
        country: formData.country.trim() || null,
        city: formData.city.trim() || null,
        address: formData.address.trim() || null,
        postal_code: formData.postal_code.trim() || null,
      };
      if (phoneNorm && user.email && !isPhonePseudoEmail(user.email)) {
        profilePhoneFields.phone_verified = true;
      }
      if (phoneAccountSave && contactEmailTrimmed) {
        profilePhoneFields.email = contactEmailTrimmed;
        profilePhoneFields.email_verified = false;
      }

      if (existingProfile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profilePhoneFields)
          .eq('user_id', user.id);

        if (profileError) {
          if (isPhoneAlreadyUsedError(profileError)) {
            Alert.alert(
              t('editProfile.phoneInUseTitle'),
              t('editProfile.phoneInUseDesc'),
            );
            return;
          }
          console.error('Erreur lors de la mise à jour du profil:', profileError);
          throw profileError;
        }
      } else {
        // Créer un nouveau profil
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            ...profilePhoneFields,
            role: 'user',
            is_host: false,
          });

        if (profileError) {
          if (isPhoneAlreadyUsedError(profileError)) {
            Alert.alert(
              t('editProfile.phoneInUseTitle'),
              t('editProfile.phoneInUseDesc'),
            );
            return;
          }
          console.error('Erreur lors de la création du profil:', profileError);
          throw profileError;
        }
      }

      // Vérifier et mettre à jour la table host_public_info si l'utilisateur est hôte
      const { data: existingHostInfo } = await supabase
        .from('host_public_info')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingHostInfo) {
        // Mettre à jour les infos hôte existantes
        const { error: hostInfoError } = await supabase
          .from('host_public_info')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            bio: formData.bio,
            avatar_url: avatarUrl,
          })
          .eq('user_id', user.id);

        if (hostInfoError) {
          console.error('Erreur lors de la mise à jour des infos hôte:', hostInfoError);
        }
      } else {
        // Vérifier si l'utilisateur est hôte avant de créer l'entrée
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_host')
          .eq('user_id', user.id)
          .single();

        if (profileData?.is_host) {
          // Créer les infos hôte
          const { error: hostInfoError } = await supabase
            .from('host_public_info')
            .insert({
              user_id: user.id,
              first_name: formData.first_name,
              last_name: formData.last_name,
              bio: formData.bio,
              avatar_url: avatarUrl,
            });

          if (hostInfoError) {
            console.error('Erreur lors de la création des infos hôte:', hostInfoError);
          }
        }
      }

      // Mettre à jour le cache global avec les nouvelles données
      const updatedProfile: UserProfile = {
        id: profile?.id || '',
        email: phoneAccountSave && contactEmailTrimmed
          ? contactEmailTrimmed
          : profile?.email || user.email || '',
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: phoneNorm || '',
        bio: formData.bio,
        avatar_url: avatarUrl,
      };
      
      updateProfileCache(updatedProfile);

      Alert.alert(
        t('common.success'),
        t('editProfile.successDesc'),
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert(t('common.error'), error.message || t('editProfile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const generateAvatarUrl = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2E7D32&color=FFFFFF&size=100`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>{t('profile.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile.edit')}</Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#2E7D32" />
            ) : (
              <Text style={styles.saveButtonText}>{t('editProfile.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* Photo de profil */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={showImagePicker}
            >
              <Image
                source={{
                  uri: avatarUri || generateAvatarUrl(
                    `${formData.first_name} ${formData.last_name}`.trim() || t('profile.userFallback')
                  ),
                }}
                style={styles.avatar}
              />
              <View style={styles.avatarOverlay}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>{t('editProfile.avatarHint')}</Text>
          </View>

          {/* Formulaire */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.firstName')}</Text>
              <TextInput
                style={styles.input}
                value={formData.first_name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, first_name: text }))}
                placeholder={t('editProfile.firstNamePlaceholder')}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.lastName')}</Text>
              <TextInput
                style={styles.input}
                value={formData.last_name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, last_name: text }))}
                placeholder={t('editProfile.lastNamePlaceholder')}
                autoCapitalize="words"
              />
            </View>

            {isPhoneAccount ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.email')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.contact_email}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, contact_email: text }))
                  }
                  placeholder={t('editProfile.emailPlaceholder')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.fieldHint}>
                  {t('editProfile.phoneAccountEmailHint')}
                </Text>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.email')}</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={profile?.email || ''}
                  editable={false}
                  placeholder={t('auth.email')}
                />
                <Text style={styles.disabledHint}>{t('editProfile.emailDisabledHint')}</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('editProfile.addressSection')}</Text>

              <View style={styles.inputGroup}>
                <CountrySelectField
                  label={t('editProfile.country')}
                  value={formData.country}
                  onChange={(name, item) => {
                    setFormData((prev) => ({ ...prev, country: name }));
                    if (!phoneLocal.trim()) {
                      setPhoneDial(item.dial);
                    }
                  }}
                  hint={t('editProfile.countryHint')}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('editProfile.city')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, city: text }))}
                  placeholder={t('editProfile.cityPlaceholder')}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('editProfile.address')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.address}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, address: text }))}
                  placeholder={t('editProfile.addressPlaceholder')}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('editProfile.postalCode')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.postal_code}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, postal_code: text }))}
                  placeholder={t('editProfile.postalCodePlaceholder')}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.phone')}</Text>
              <PhoneNumberField
                dial={phoneDial}
                local={phoneLocal}
                onDialChange={setPhoneDial}
                onLocalChange={setPhoneLocal}
              />
              <Text style={styles.fieldHint}>
                {t('editProfile.phoneHint')}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('editProfile.bio')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bio}
                onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
                placeholder={t('editProfile.bioPlaceholder')}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#2E7D32',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarHint: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginTop: 8,
    marginBottom: 4,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  formContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  disabledInput: {
    backgroundColor: '#f8f9fa',
    color: '#666',
  },
  disabledHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  fieldHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    lineHeight: 18,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
});

export default EditProfileScreen;