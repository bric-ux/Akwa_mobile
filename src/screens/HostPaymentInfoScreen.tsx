import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useHostPaymentInfo, PaymentInfoFormData } from '../hooks/useHostPaymentInfo';

const HostPaymentInfoScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    paymentInfo,
    loading,
    error,
    createPaymentInfo,
    updatePaymentInfo,
    validatePaymentInfo,
    hasPaymentInfo,
    isPaymentInfoComplete,
    isPaymentInfoVerified
  } = useHostPaymentInfo();

  const [isEditing, setIsEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PaymentInfoFormData>({
    preferred_payment_method: 'bank_transfer'
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (paymentInfo) {
      setFormData({
        bank_name: paymentInfo.bank_name || '',
        bank_code: paymentInfo.bank_code || '',
        account_number: paymentInfo.account_number || '',
        account_holder_name: paymentInfo.account_holder_name || '',
        mobile_money_provider: paymentInfo.mobile_money_provider,
        mobile_money_number: paymentInfo.mobile_money_number || '',
        paypal_email: paymentInfo.paypal_email || '',
        swift_code: paymentInfo.swift_code || '',
        iban: paymentInfo.iban || '',
        preferred_payment_method: paymentInfo.preferred_payment_method
      });
    }
  }, [paymentInfo]);

  const handleInputChange = (field: keyof PaymentInfoFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  const handlePaymentMethodSelect = (method: 'bank_transfer' | 'mobile_money' | 'paypal') => {
    if (!isEditing) {
      setIsEditing(true);
    }
    handleInputChange('preferred_payment_method', method);
    setCurrentStep(2);
  };

  const handleSave = async () => {
    const errors = validatePaymentInfo(formData);
    if (errors.length > 0) {
      setValidationErrors(errors);
      Alert.alert('Erreur de validation', errors.join('\n'));
      return;
    }

    try {
      let result;
      if (hasPaymentInfo()) {
        result = await updatePaymentInfo(formData);
      } else {
        result = await createPaymentInfo(formData);
      }

      if (result.error) {
        Alert.alert('Erreur', result.error);
        return;
      }

      Alert.alert(
        'Succès',
        'Vos informations de paiement ont été sauvegardées avec succès.',
        [{ text: 'OK', onPress: () => {
          setIsEditing(false);
          setCurrentStep(1);
        }}]
      );
    } catch (err) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la sauvegarde');
    }
  };

  const renderPaymentMethodSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Méthode de paiement préférée</Text>
      <Text style={styles.stepDescription}>
        Sélectionnez votre méthode de paiement préférée pour recevoir vos revenus
      </Text>

      <View style={styles.paymentMethods}>
        <TouchableOpacity
          style={[
            styles.paymentMethodCard,
            formData.preferred_payment_method === 'bank_transfer' && styles.paymentMethodCardSelected
          ]}
          onPress={() => handlePaymentMethodSelect('bank_transfer')}
        >
          <Ionicons name="card" size={24} color="#e67e22" />
          <View style={styles.paymentMethodContent}>
            <Text style={styles.paymentMethodTitle}>Virement bancaire</Text>
            <Text style={styles.paymentMethodDescription}>
              Transfert direct vers votre compte bancaire
            </Text>
          </View>
          <Ionicons 
            name={formData.preferred_payment_method === 'bank_transfer' ? 'checkmark-circle' : 'ellipse-outline'} 
            size={20} 
            color={formData.preferred_payment_method === 'bank_transfer' ? '#e67e22' : '#ccc'} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentMethodCard,
            formData.preferred_payment_method === 'mobile_money' && styles.paymentMethodCardSelected
          ]}
          onPress={() => handlePaymentMethodSelect('mobile_money')}
        >
          <Ionicons name="phone-portrait" size={24} color="#e67e22" />
          <View style={styles.paymentMethodContent}>
            <Text style={styles.paymentMethodTitle}>Mobile Money</Text>
            <Text style={styles.paymentMethodDescription}>
              Orange Money, MTN Money, Moov Money, Wave
            </Text>
          </View>
          <Ionicons 
            name={formData.preferred_payment_method === 'mobile_money' ? 'checkmark-circle' : 'ellipse-outline'} 
            size={20} 
            color={formData.preferred_payment_method === 'mobile_money' ? '#e67e22' : '#ccc'} 
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentMethodCard,
            formData.preferred_payment_method === 'paypal' && styles.paymentMethodCardSelected
          ]}
          onPress={() => handlePaymentMethodSelect('paypal')}
        >
          <Ionicons name="globe" size={24} color="#e67e22" />
          <View style={styles.paymentMethodContent}>
            <Text style={styles.paymentMethodTitle}>PayPal</Text>
            <Text style={styles.paymentMethodDescription}>
              Transfert international via PayPal
            </Text>
          </View>
          <Ionicons 
            name={formData.preferred_payment_method === 'paypal' ? 'checkmark-circle' : 'ellipse-outline'} 
            size={20} 
            color={formData.preferred_payment_method === 'paypal' ? '#e67e22' : '#ccc'} 
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.nextButton}
        onPress={() => setCurrentStep(2)}
        disabled={!formData.preferred_payment_method}
      >
        <Text style={styles.nextButtonText}>Continuer</Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderPaymentDetails = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Détails de paiement</Text>
      <Text style={styles.stepDescription}>
        Remplissez les informations requises pour votre méthode de paiement
      </Text>

      {formData.preferred_payment_method === 'bank_transfer' && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Informations bancaires</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom de la banque *</Text>
            <TextInput
              style={styles.input}
              value={formData.bank_name || ''}
              onChangeText={(value) => handleInputChange('bank_name', value)}
              placeholder="Ex: Société Générale, BICICI..."
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Code banque</Text>
            <TextInput
              style={styles.input}
              value={formData.bank_code || ''}
              onChangeText={(value) => handleInputChange('bank_code', value)}
              placeholder="Code de la banque"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numéro de compte *</Text>
            <TextInput
              style={styles.input}
              value={formData.account_number || ''}
              onChangeText={(value) => handleInputChange('account_number', value)}
              placeholder="Numéro de compte"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du titulaire *</Text>
            <TextInput
              style={styles.input}
              value={formData.account_holder_name || ''}
              onChangeText={(value) => handleInputChange('account_holder_name', value)}
              placeholder="Nom complet du titulaire"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Code SWIFT</Text>
            <TextInput
              style={styles.input}
              value={formData.swift_code || ''}
              onChangeText={(value) => handleInputChange('swift_code', value)}
              placeholder="Code SWIFT (international)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>IBAN</Text>
            <TextInput
              style={styles.input}
              value={formData.iban || ''}
              onChangeText={(value) => handleInputChange('iban', value)}
              placeholder="Code IBAN (international)"
            />
          </View>
        </View>
      )}

      {formData.preferred_payment_method === 'mobile_money' && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Mobile Money</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fournisseur *</Text>
            <View style={styles.providerButtons}>
              {['orange_money', 'mtn_money', 'moov_money', 'wave'].map((provider) => (
                <TouchableOpacity
                  key={provider}
                  style={[
                    styles.providerButton,
                    formData.mobile_money_provider === provider && styles.providerButtonSelected
                  ]}
                  onPress={() => handleInputChange('mobile_money_provider', provider)}
                >
                  <Text style={[
                    styles.providerButtonText,
                    formData.mobile_money_provider === provider && styles.providerButtonTextSelected
                  ]}>
                    {provider.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Numéro Mobile Money *</Text>
            <TextInput
              style={styles.input}
              value={formData.mobile_money_number || ''}
              onChangeText={(value) => handleInputChange('mobile_money_number', value)}
              placeholder="Numéro de téléphone"
              keyboardType="phone-pad"
            />
          </View>
        </View>
      )}

      {formData.preferred_payment_method === 'paypal' && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>PayPal</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email PayPal *</Text>
            <TextInput
              style={styles.input}
              value={formData.paypal_email || ''}
              onChangeText={(value) => handleInputChange('paypal_email', value)}
              placeholder="votre@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(1)}
        >
          <Ionicons name="arrow-back" size={20} color="#e67e22" />
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Sauvegarder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPaymentInfoStatus = () => (
    <View style={styles.statusContainer}>
      <View style={styles.statusHeader}>
        <Ionicons 
          name={isPaymentInfoVerified() ? 'checkmark-circle' : 'time'} 
          size={24} 
          color={isPaymentInfoVerified() ? '#10b981' : '#f59e0b'} 
        />
        <Text style={styles.statusTitle}>
          {isPaymentInfoVerified() ? 'Informations vérifiées' : 'En attente de vérification'}
        </Text>
      </View>

      <Text style={styles.statusDescription}>
        {isPaymentInfoVerified() 
          ? 'Vos informations de paiement ont été vérifiées par notre équipe.'
          : 'Vos informations de paiement sont en cours de vérification par notre équipe.'
        }
      </Text>

      {paymentInfo?.verification_notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesTitle}>Notes de vérification:</Text>
          <Text style={styles.notesText}>{paymentInfo.verification_notes}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => {
          setIsEditing(true);
          setCurrentStep(1);
        }}
      >
        <Ionicons name="create" size={20} color="#e67e22" />
        <Text style={styles.editButtonText}>Modifier</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Informations de paiement</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informations de paiement</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!hasPaymentInfo() || isEditing ? (
          <>
            {currentStep === 1 && renderPaymentMethodSelection()}
            {currentStep === 2 && renderPaymentDetails()}
          </>
        ) : (
          renderPaymentInfoStatus()
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#e67e22',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    color: '#ef4444',
    fontSize: 14,
  },
  stepContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  paymentMethods: {
    marginBottom: 24,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  paymentMethodCardSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fef7f0',
  },
  paymentMethodContent: {
    flex: 1,
    marginLeft: 12,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  providerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  providerButtonSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fef7f0',
  },
  providerButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  providerButtonTextSelected: {
    color: '#e67e22',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonText: {
    marginLeft: 8,
    color: '#e67e22',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#e67e22',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  notesContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e67e22',
    paddingVertical: 12,
    borderRadius: 8,
  },
  editButtonText: {
    marginLeft: 8,
    color: '#e67e22',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HostPaymentInfoScreen;
