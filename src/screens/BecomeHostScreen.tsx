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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthContext';
import { useHostApplications } from '../hooks/useHostApplications';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { Amenity } from '../types';

const PROPERTY_TYPES = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
  { value: 'studio', label: 'Studio' },
  { value: 'villa', label: 'Villa' },
  { value: 'chambre', label: 'Chambre privée' },
];

const CANCELLATION_POLICIES = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'moderate', label: 'Modérée' },
  { value: 'strict', label: 'Stricte' },
];

const BecomeHostScreen: React.FC = () => {
  const { user } = useAuth();
  const { submitApplication, getAmenities, loading } = useHostApplications();
  
  const [formData, setFormData] = useState({
    // Informations sur le logement
    propertyType: '',
    location: '',
    guests: '',
    bedrooms: '',
    bathrooms: '',
    title: '',
    description: '',
    price: '',
    addressDetails: '',
    
    // Informations hôte
    hostFullName: '',
    hostEmail: '',
    hostPhone: '',
    experience: '',
    
    // Frais et règles
    cleaningFee: '',
    taxes: '',
    houseRules: '',
    minimumNights: '1',
    autoBooking: 'request',
    cancellationPolicy: 'flexible',
    
    // Réductions
    discountEnabled: false,
    discountMinNights: '',
    discountPercentage: '',
    
    // Conditions
    agreeTerms: false
  });
  
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [availableAmenities, setAvailableAmenities] = useState<Amenity[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPropertyTypeModal, setShowPropertyTypeModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  useEffect(() => {
    loadAmenities();
    loadUserProfile();
  }, []);

  const loadAmenities = async () => {
    const amenities = await getAmenities();
    setAvailableAmenities(amenities);
  };

  const loadUserProfile = () => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        hostEmail: user.email || '',
        hostFullName: user.user_metadata?.first_name && user.user_metadata?.last_name 
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}` 
          : '',
      }));
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationSelect = (result: any) => {
    console.log('📍 Sélection de localisation reçue:', result);
    setSelectedLocation(result);
    if (result) {
      console.log('📍 Nom de la localisation:', result.name);
      handleInputChange('location', result.name);
    } else {
      console.log('📍 Localisation effacée');
      handleInputChange('location', '');
    }
  };

  const toggleAmenity = (amenityId: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenityId) 
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const getInputStyle = (fieldName: string) => {
    return styles.input;
  };

  const getFieldDisplayName = (fieldName: string): string => {
    const fieldNames: { [key: string]: string } = {
      propertyType: 'Type de propriété',
      location: 'Localisation',
      guests: 'Nombre d\'invités',
      bedrooms: 'Chambres',
      bathrooms: 'Salles de bain',
      title: 'Titre',
      description: 'Description',
      price: 'Prix par nuit',
      hostFullName: 'Nom complet',
      hostEmail: 'Email',
      hostPhone: 'Téléphone',
    };
    return fieldNames[fieldName] || fieldName;
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        // Étape 1: Informations sur le logement
        const step1Fields = ['propertyType', 'location', 'guests', 'bedrooms', 'bathrooms', 'title', 'description', 'price'];
        const missingStep1 = step1Fields.filter(field => !formData[field as keyof typeof formData]);
        
        if (missingStep1.length > 0) {
          const missingFieldsFrench = missingStep1.map(field => getFieldDisplayName(field)).join(', ');
          Alert.alert(
            'Champs obligatoires manquants',
            `Veuillez remplir tous les champs marqués d'un astérisque (*) avant de continuer.\n\nChamps manquants: ${missingFieldsFrench}`
          );
          return false;
        }
        
        // Validation spécifique pour les nombres
        if (parseInt(formData.guests) < 1 || parseInt(formData.bedrooms) < 1 || parseInt(formData.bathrooms) < 1) {
          Alert.alert(
            'Valeurs invalides',
            'Le nombre d\'invités, de chambres et de salles de bain doit être au moins 1.'
          );
          return false;
        }
        
        if (parseInt(formData.price) < 1000) {
          Alert.alert(
            'Prix trop bas',
            'Le prix par nuit doit être d\'au moins 1000 FCFA.'
          );
          return false;
        }
        
        return true;
        
      case 2:
        // Étape 2: Informations hôte
        const step2Fields = ['hostFullName', 'hostEmail', 'hostPhone'];
        const missingStep2 = step2Fields.filter(field => !formData[field as keyof typeof formData]);
        
        if (missingStep2.length > 0) {
          const missingFieldsFrench = missingStep2.map(field => getFieldDisplayName(field)).join(', ');
          Alert.alert(
            'Champs obligatoires manquants',
            `Veuillez remplir tous les champs marqués d'un astérisque (*) avant de continuer.\n\nChamps manquants: ${missingFieldsFrench}`
          );
          return false;
        }
        
        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.hostEmail)) {
          Alert.alert(
            'Email invalide',
            'Veuillez saisir une adresse email valide.'
          );
          return false;
        }
        
        // Validation téléphone
        const phoneRegex = /^[0-9+\-\s()]{8,}$/;
        if (!phoneRegex.test(formData.hostPhone)) {
          Alert.alert(
            'Numéro de téléphone invalide',
            'Veuillez saisir un numéro de téléphone valide (au moins 8 chiffres).'
          );
          return false;
        }
        
        return true;
        
      case 3:
        // Étape 3: Équipements et règles (pas de champs obligatoires)
        return true;
        
      case 4:
        // Étape 4: Conditions
        if (!formData.agreeTerms) {
          Alert.alert(
            'Conditions non acceptées',
            'Vous devez accepter les conditions d\'utilisation pour soumettre votre candidature.'
          );
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour soumettre une candidature.');
      return;
    }

    // Validation finale de toutes les étapes
    for (let step = 1; step <= 4; step++) {
      if (!validateStep(step)) {
        // Si une étape n'est pas valide, retourner à cette étape
        setCurrentStep(step);
        return;
      }
    }

    const applicationPayload = {
      propertyType: formData.propertyType,
      location: formData.location,
      maxGuests: parseInt(formData.guests) || 1,
      bedrooms: parseInt(formData.bedrooms) || 1,
      bathrooms: parseInt(formData.bathrooms) || 1,
      title: formData.title,
      description: formData.description,
      pricePerNight: parseInt(formData.price),
      fullName: formData.hostFullName,
      email: formData.hostEmail,
      phone: formData.hostPhone,
      experience: formData.experience,
      images: [], // Pour l'instant, pas d'upload d'images
      amenities: selectedAmenities,
      minimumNights: parseInt(formData.minimumNights) || 1,
      autoBooking: formData.autoBooking === 'auto',
      cancellationPolicy: formData.cancellationPolicy,
      hostGuide: formData.houseRules || undefined,
      discountEnabled: formData.discountEnabled,
      discountMinNights: formData.discountEnabled ? parseInt(formData.discountMinNights) || undefined : undefined,
      discountPercentage: formData.discountEnabled ? parseInt(formData.discountPercentage) || undefined : undefined,
      cleaningFee: parseInt(formData.cleaningFee) || 0,
      taxes: parseInt(formData.taxes) || 0,
    };

    const result = await submitApplication(applicationPayload);

    if (result.success) {
      Alert.alert(
        'Candidature soumise !', 
        'Votre candidature a été soumise avec succès. Nous vous contacterons bientôt.',
        [{ text: 'OK', onPress: () => setCurrentStep(1) }]
      );
    } else {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la soumission de votre candidature.');
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.stepContainer}>
          <View style={[
            styles.stepCircle,
            currentStep >= step && styles.stepCircleActive
          ]}>
            <Text style={[
              styles.stepText,
              currentStep >= step && styles.stepTextActive
            ]}>
              {step}
            </Text>
          </View>
          {step < 4 && <View style={styles.stepLine} />}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Informations sur le logement</Text>
      
      {/* Type de propriété */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Type de propriété *</Text>
        <TouchableOpacity 
          style={styles.selectButton}
          onPress={() => setShowPropertyTypeModal(true)}
        >
          <Text style={styles.selectButtonText}>
            {formData.propertyType ? 
              PROPERTY_TYPES.find(t => t.value === formData.propertyType)?.label : 
              'Sélectionner un type'
            }
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Localisation */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Localisation *</Text>
        <CitySearchInputModal
          value={formData.location}
          onChange={handleLocationSelect}
          placeholder="Rechercher ville, commune ou quartier..."
        />
        <Text style={styles.helpText}>
          Recherchez votre ville, commune ou quartier avec autocomplétion
        </Text>
      </View>

      {/* Capacité */}
      <View style={styles.row}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre d'invités *</Text>
        <TextInput
          style={getInputStyle('guests')}
          value={formData.guests}
          onChangeText={(value) => handleInputChange('guests', value)}
          placeholder="2"
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Chambres *</Text>
          <TextInput
            style={getInputStyle('bedrooms')}
            value={formData.bedrooms}
            onChangeText={(value) => handleInputChange('bedrooms', value)}
            placeholder="1"
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Salles de bain *</Text>
          <TextInput
            style={getInputStyle('bathrooms')}
            value={formData.bathrooms}
            onChangeText={(value) => handleInputChange('bathrooms', value)}
            placeholder="1"
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        </View>
      </View>

      {/* Titre */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Titre de votre annonce *</Text>
        <TextInput
          style={getInputStyle('title')}
          value={formData.title}
          onChangeText={(value) => handleInputChange('title', value)}
          placeholder="Ex: Magnifique appartement avec vue sur mer"
          placeholderTextColor="#999"
        />
      </View>

      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[getInputStyle('description'), styles.textArea]}
          value={formData.description}
          onChangeText={(value) => handleInputChange('description', value)}
          placeholder="Décrivez votre logement..."
          multiline
          numberOfLines={4}
          placeholderTextColor="#999"
        />
      </View>

      {/* Prix */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Prix par nuit (FCFA) *</Text>
        <TextInput
          style={getInputStyle('price')}
          value={formData.price}
          onChangeText={(value) => handleInputChange('price', value)}
          placeholder="25000"
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Informations hôte</Text>
      
      {/* Nom complet */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom complet *</Text>
        <TextInput
          style={getInputStyle('hostFullName')}
          value={formData.hostFullName}
          onChangeText={(value) => handleInputChange('hostFullName', value)}
          placeholder="Votre nom complet"
          placeholderTextColor="#999"
        />
      </View>

      {/* Email */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={getInputStyle('hostEmail')}
          value={formData.hostEmail}
          onChangeText={(value) => handleInputChange('hostEmail', value)}
          placeholder="votre@email.com"
          keyboardType="email-address"
          placeholderTextColor="#999"
        />
      </View>

      {/* Téléphone */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Téléphone *</Text>
        <TextInput
          style={getInputStyle('hostPhone')}
          value={formData.hostPhone}
          onChangeText={(value) => handleInputChange('hostPhone', value)}
          placeholder="+225 XX XX XX XX"
          keyboardType="phone-pad"
          placeholderTextColor="#999"
        />
      </View>

      {/* Expérience */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Expérience en hébergement</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.experience}
          onChangeText={(value) => handleInputChange('experience', value)}
          placeholder="Parlez-nous de votre expérience..."
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Équipements et règles</Text>
      
      {/* Équipements */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Équipements disponibles</Text>
        <View style={styles.amenitiesGrid}>
          {availableAmenities.map((amenity) => (
            <TouchableOpacity
              key={amenity.id}
              style={[
                styles.amenityItem,
                selectedAmenities.includes(amenity.id) && styles.amenityItemSelected
              ]}
              onPress={() => toggleAmenity(amenity.id)}
            >
              <Text style={[
                styles.amenityText,
                selectedAmenities.includes(amenity.id) && styles.amenityTextSelected
              ]}>
                {amenity.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Règles de la maison */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Règles de la maison</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.houseRules}
          onChangeText={(value) => handleInputChange('houseRules', value)}
          placeholder="Ex: Pas de fumeurs, pas d'animaux..."
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
        />
      </View>

      {/* Frais */}
      <View style={styles.row}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Frais de nettoyage (FCFA)</Text>
          <TextInput
            style={styles.input}
            value={formData.cleaningFee}
            onChangeText={(value) => handleInputChange('cleaningFee', value)}
            placeholder="5000"
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Taxes (FCFA)</Text>
          <TextInput
            style={styles.input}
            value={formData.taxes}
            onChangeText={(value) => handleInputChange('taxes', value)}
            placeholder="2000"
            keyboardType="numeric"
            placeholderTextColor="#999"
          />
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Conditions et soumission</Text>
      
      {/* Politique d'annulation */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Politique d'annulation</Text>
        <TouchableOpacity 
          style={styles.selectButton}
          onPress={() => setShowCancellationModal(true)}
        >
          <Text style={styles.selectButtonText}>
            {CANCELLATION_POLICIES.find(p => p.value === formData.cancellationPolicy)?.label}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Nuits minimum */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nuits minimum</Text>
        <TextInput
          style={styles.input}
          value={formData.minimumNights}
          onChangeText={(value) => handleInputChange('minimumNights', value)}
          placeholder="1"
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
      </View>

      {/* Conditions d'utilisation */}
      <View style={styles.inputGroup}>
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => handleInputChange('agreeTerms', !formData.agreeTerms)}
        >
          <View style={[
            styles.checkbox,
            formData.agreeTerms && styles.checkboxChecked
          ]}>
            {formData.agreeTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.checkboxText}>
            J'accepte les conditions d'utilisation et la politique de confidentialité *
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>Devenir hôte</Text>
          <Text style={styles.subtitle}>
            Partagez votre logement et générez des revenus supplémentaires
          </Text>
        </View>

        {/* Indicateur d'étapes */}
        {renderStepIndicator()}

        {/* Contenu des étapes */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}

        {/* Boutons de navigation */}
        <View style={styles.navigationButtons}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.prevButton} onPress={prevStep}>
              <Text style={styles.prevButtonText}>Précédent</Text>
            </TouchableOpacity>
          )}
          
          {currentStep < 4 ? (
            <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
              <Text style={styles.nextButtonText}>Suivant</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.nextButton, loading && styles.nextButtonDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>Soumettre</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Modal type de propriété */}
      {showPropertyTypeModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Type de propriété</Text>
            {PROPERTY_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.modalItem}
                onPress={() => {
                  handleInputChange('propertyType', type.value);
                  setShowPropertyTypeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowPropertyTypeModal(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal politique d'annulation */}
      {showCancellationModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Politique d'annulation</Text>
            {CANCELLATION_POLICIES.map((policy) => (
              <TouchableOpacity
                key={policy.value}
                style={styles.modalItem}
                onPress={() => {
                  handleInputChange('cancellationPolicy', policy.value);
                  setShowCancellationModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{policy.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowCancellationModal(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#e67e22',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  stepTextActive: {
    color: '#fff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  amenityItemSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  amenityText: {
    fontSize: 14,
    color: '#374151',
  },
  amenityTextSelected: {
    color: '#fff',
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
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  checkboxText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  prevButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  prevButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#e67e22',
    paddingVertical: 16,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalItemText: {
    fontSize: 16,
    color: '#374151',
  },
  modalCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#e67e22',
    fontWeight: '600',
  },
});

export default BecomeHostScreen;