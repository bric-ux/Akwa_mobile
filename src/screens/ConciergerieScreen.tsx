import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import { displayEmailOrPhone, isPhonePseudoEmail } from '../lib/displayContact';
import { HOST_COLORS, TRAVELER_COLORS } from '../constants/colors';

type ContactMethod = 'email' | 'phone';

type FormState = {
  name: string;
  contactMethod: ContactMethod;
  contactValue: string;
  propertyType: string;
  numberOfRooms: string;
  surface: string;
  propertyLocation: string;
  characteristics: string;
  needs: string;
  message: string;
  selectedPlan: string;
};

const emptyForm = (): FormState => ({
  name: '',
  contactMethod: 'email',
  contactValue: '',
  propertyType: '',
  numberOfRooms: '',
  surface: '',
  propertyLocation: '',
  characteristics: '',
  needs: '',
  message: '',
  selectedPlan: '',
});

const ConciergerieScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const scrollViewRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [formData, setFormData] = useState<FormState>(emptyForm);

  const plans = [
    {
      name: 'Basique',
      label: t('concierge.planBasic'),
      description: t('concierge.planBasicDesc'),
      features: [
        t('concierge.planBasicF1'),
        t('concierge.planBasicF2'),
        t('concierge.planBasicF3'),
        t('concierge.planBasicF4'),
      ],
      popular: false,
    },
    {
      name: 'Premium',
      label: t('concierge.planPremium'),
      description: t('concierge.planPremiumDesc'),
      features: [
        t('concierge.planPremiumF1'),
        t('concierge.planPremiumF2'),
        t('concierge.planPremiumF3'),
        t('concierge.planPremiumF4'),
      ],
      popular: true,
    },
    {
      name: 'Luxe',
      label: t('concierge.planLuxury'),
      description: t('concierge.planLuxuryDesc'),
      features: [
        t('concierge.planLuxuryF1'),
        t('concierge.planLuxuryF2'),
        t('concierge.planLuxuryF3'),
        t('concierge.planLuxuryF4'),
        t('concierge.planLuxuryF5'),
        t('concierge.planLuxuryF6'),
        t('concierge.planLuxuryF7'),
      ],
      popular: false,
    },
  ];

  useEffect(() => {
    if (!user || !profile || profileLoading) return;

    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
    const accountEmail = profile.email || user.email || '';
    const profilePhone = profile.phone || '';
    const phoneAccount = isPhonePseudoEmail(accountEmail);

    setFormData((prev) => ({
      ...prev,
      name: fullName || prev.name,
      contactMethod: phoneAccount || profilePhone ? 'phone' : 'email',
      contactValue: phoneAccount
        ? displayEmailOrPhone(accountEmail, profilePhone)
        : profilePhone && !phoneAccount
          ? profilePhone
          : accountEmail && !phoneAccount
            ? accountEmail
            : prev.contactValue,
    }));
  }, [user, profile, profileLoading]);

  const scrollToContact = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const contact = formData.contactValue.trim();
    if (!formData.name.trim() || !contact) {
      Alert.alert(t('concierge.missingFields'), t('concierge.missingFieldsDesc'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9+\-\s()]{8,}$/;
    if (formData.contactMethod === 'email' && !emailRegex.test(contact)) {
      Alert.alert(t('concierge.invalidContact'), t('concierge.invalidEmail'));
      return;
    }
    if (formData.contactMethod === 'phone' && !phoneRegex.test(contact)) {
      Alert.alert(t('concierge.invalidContact'), t('concierge.invalidPhone'));
      return;
    }

    const clientEmail = formData.contactMethod === 'email' ? contact : '';
    const clientPhone = formData.contactMethod === 'phone' ? contact : '';

    try {
      setLoading(true);

      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'conciergerie_request',
          to: 'accueil@akwahome.com',
          data: {
            clientName: formData.name,
            clientEmail,
            clientPhone,
            contactMethod: formData.contactMethod === 'email' ? 'Email' : 'Téléphone',
            propertyType: formData.propertyType || 'Non spécifié',
            numberOfRooms: formData.numberOfRooms || 'Non spécifié',
            surface: formData.surface || 'Non spécifié',
            propertyLocation: formData.propertyLocation || 'Non spécifié',
            characteristics: formData.characteristics || 'Non spécifié',
            selectedPlan: formData.selectedPlan || 'Non spécifié',
            needs: formData.needs || 'Aucun besoin spécifié',
            message: formData.message || 'Aucun message',
            submittedAt: new Date().toLocaleString('fr-FR'),
            requestId: null,
          },
        },
      });

      if (emailError) {
        throw new Error(emailError.message || "Erreur lors de l'envoi");
      }
      if (emailData?.error) {
        throw new Error(emailData.error.message || "Erreur lors de l'envoi");
      }

      Alert.alert(
        t('concierge.sentTitle'),
        t('concierge.sentDesc'),
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Home' as never);
            },
          },
        ],
      );

      setFormData(emptyForm());
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : t('concierge.errorDesc');
      Alert.alert(t('concierge.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home' as never);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('concierge.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroEyebrow}>{t('concierge.managementEyebrow')}</Text>
            <Text style={styles.heroTitle}>{t('concierge.heroTitle')}</Text>
            <Text style={styles.heroDescription}>
              {t('concierge.heroIntro')}
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={scrollToContact}>
              <Text style={styles.primaryButtonText}>{t('concierge.ctaContact')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('concierge.plansTitle')}</Text>
            <Text style={styles.sectionSubtitle}>
              {t('concierge.plansSubtitle')}
            </Text>

            {plans.map((plan) => {
              const isSelected = formData.selectedPlan === plan.name;
              return (
                <TouchableOpacity
                  key={plan.name}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    plan.popular && !formData.selectedPlan && styles.planCardPopular,
                  ]}
                  onPress={() => {
                    update('selectedPlan', plan.name);
                    setTimeout(scrollToContact, 250);
                  }}
                  activeOpacity={0.85}
                >
                  {plan.popular ? (
                    <Text style={styles.planHint}>
                      {isSelected ? t('concierge.selected') : t('concierge.popular')}
                    </Text>
                  ) : isSelected ? (
                    <Text style={styles.planHint}>{t('concierge.selected')}</Text>
                  ) : null}
                  <Text style={styles.planName}>{plan.label}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                  <View style={styles.planFeatures}>
                    {plan.features.map((feature) => (
                      <View key={feature} style={styles.planFeatureItem}>
                        <Ionicons name="checkmark" size={16} color={HOST_COLORS.primary} />
                        <Text style={styles.planFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('concierge.formTitle')}</Text>
            <Text style={styles.sectionSubtitle}>
              {t('concierge.formSubtitle')}
            </Text>

            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('concierge.name')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => update('name', text)}
                  placeholder={t('concierge.namePlaceholder')}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('concierge.contact')}</Text>
                <View style={styles.contactMethodRow}>
                  <TouchableOpacity
                    style={[
                      styles.contactMethodBtn,
                      formData.contactMethod === 'email' && styles.contactMethodBtnActive,
                    ]}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        contactMethod: 'email',
                        contactValue: prev.contactMethod === 'phone' ? '' : prev.contactValue,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.contactMethodBtnText,
                        formData.contactMethod === 'email' && styles.contactMethodBtnTextActive,
                      ]}
                    >
                      {t('concierge.email')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.contactMethodBtn,
                      formData.contactMethod === 'phone' && styles.contactMethodBtnActive,
                    ]}
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        contactMethod: 'phone',
                        contactValue: prev.contactMethod === 'email' ? '' : prev.contactValue,
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.contactMethodBtnText,
                        formData.contactMethod === 'phone' && styles.contactMethodBtnTextActive,
                      ]}
                    >
                      {t('concierge.phone')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={formData.contactValue}
                  onChangeText={(text) => update('contactValue', text)}
                  placeholder={
                    formData.contactMethod === 'email'
                      ? t('concierge.emailPlaceholder')
                      : t('concierge.phonePlaceholder')
                  }
                  placeholderTextColor="#9ca3af"
                  keyboardType={formData.contactMethod === 'email' ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('concierge.propertyType')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.propertyType}
                  onChangeText={(text) => update('propertyType', text)}
                  placeholder={t('concierge.propertyTypePlaceholder')}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.half]}>
                  <Text style={styles.inputLabel}>{t('concierge.numberOfRooms')}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.numberOfRooms}
                    onChangeText={(text) => update('numberOfRooms', text)}
                    placeholder={t('concierge.numberOfRoomsPlaceholder')}
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.inputGroup, styles.half]}>
                  <Text style={styles.inputLabel}>{t('concierge.surface')}</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.surface}
                    onChangeText={(text) => update('surface', text)}
                    placeholder={t('concierge.surfacePlaceholder')}
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('concierge.propertyLocation')}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.propertyLocation}
                  onChangeText={(text) => update('propertyLocation', text)}
                  placeholder={t('concierge.propertyLocationPlaceholder')}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('concierge.characteristics')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.characteristics}
                  onChangeText={(text) => update('characteristics', text)}
                  placeholder={t('concierge.characteristicsPlaceholder')}
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {formData.selectedPlan ? (
                <View style={styles.selectedPlanRow}>
                  <Ionicons name="checkmark-circle" size={18} color={HOST_COLORS.primary} />
                  <Text style={styles.selectedPlanText}>
                    {t('concierge.selectedPlanLabel', { plan: formData.selectedPlan })}
                  </Text>
                </View>
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('concierge.needs')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.needs}
                  onChangeText={(text) => update('needs', text)}
                  placeholder={t('concierge.needsPlaceholder')}
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('concierge.message')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.message}
                  onChangeText={(text) => update('message', text)}
                  placeholder={t('concierge.messagePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.submitButtonText}>{t('concierge.submit')}</Text>
                  </>
                )}
              </TouchableOpacity>
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: { width: 32 },
  keyboardAvoidingView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  heroSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: TRAVELER_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: TRAVELER_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  planCardPopular: {
    borderColor: TRAVELER_COLORS.primary,
  },
  planCardSelected: {
    borderColor: TRAVELER_COLORS.primary,
    backgroundColor: TRAVELER_COLORS.light,
  },
  planHint: {
    fontSize: 11,
    fontWeight: '600',
    color: TRAVELER_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  planFeatures: { gap: 8 },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  inputGroup: { marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  contactMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  contactMethodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  contactMethodBtnActive: {
    borderColor: TRAVELER_COLORS.primary,
    backgroundColor: TRAVELER_COLORS.light,
  },
  contactMethodBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  contactMethodBtnTextActive: {
    color: TRAVELER_COLORS.primary,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  selectedPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  selectedPlanText: {
    fontSize: 13,
    fontWeight: '600',
    color: HOST_COLORS.primary,
  },
  submitButton: {
    backgroundColor: TRAVELER_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ConciergerieScreen;
