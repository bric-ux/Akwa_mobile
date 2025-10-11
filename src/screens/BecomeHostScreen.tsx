import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useHostApplications } from '../hooks/useHostApplications';
import { useEmailService } from '../hooks/useEmailService';
import { useAmenities } from '../hooks/useAmenities';
import LocationSearchInput from '../components/LocationSearchInput';
import { LocationResult } from '../hooks/useLocationSearch';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

interface FormData {
  // Informations sur le logement
  propertyType: string;
  location: string;
  guests: string;
  bedrooms: string;
  bathrooms: string;
  title: string;
  description: string;
  price: string;
  addressDetails: string;
  hostGuide: string;
  
  // Informations hôte
  hostFullName: string;
  hostEmail: string;
  hostPhone: string;
  experience: string;
  
  // Frais et règles
  cleaningFee: string;
  taxes: string;
  houseRules: string;
  minimumNights: string;
  autoBooking: 'auto' | 'request';
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  
  // Réductions (pour aperçu seulement, pas envoyées dans la candidature)
  discountEnabled: boolean;
  discountMinNights: string;
  discountPercentage: string;
  
  // Conditions
  agreeTerms: boolean;
}

const BecomeHostScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { submitApplication, loading } = useHostApplications();
  const { sendHostApplicationSubmitted, sendHostApplicationReceived } = useEmailService();
  const { amenities, loading: amenitiesLoading } = useAmenities();
  
  const [formData, setFormData] = useState<FormData>({
    propertyType: '',
    location: '',
    guests: '',
    bedrooms: '',
    bathrooms: '',
    title: '',
    description: '',
    price: '',
    addressDetails: '',
    hostGuide: '',
    hostFullName: '',
    hostEmail: '',
    hostPhone: '',
    experience: '',
    cleaningFee: '',
    taxes: '',
    houseRules: '',
    minimumNights: '1',
    autoBooking: 'request',
    cancellationPolicy: 'flexible',
    discountEnabled: false,
    discountMinNights: '',
    discountPercentage: '',
    agreeTerms: false,
  });
  
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPropertyTypes, setShowPropertyTypes] = useState(false);
  const [showCancellationPolicies, setShowCancellationPolicies] = useState(false);

  const propertyTypes = [
    { value: 'apartment', label: 'Appartement', icon: '🏢' },
    { value: 'house', label: 'Maison', icon: '🏠' },
    { value: 'villa', label: 'Villa', icon: '🏡' },
    { value: 'studio', label: 'Studio', icon: '🏠' },
    { value: 'guesthouse', label: 'Maison d\'hôtes', icon: '🏨' },
  ];

  const cancellationPolicies = [
    { value: 'flexible', label: 'Flexible', description: 'Annulation gratuite jusqu\'à 24h avant' },
    { value: 'moderate', label: 'Modérée', description: 'Annulation gratuite jusqu\'à 5 jours avant' },
    { value: 'strict', label: 'Stricte', description: 'Annulation gratuite jusqu\'à 7 jours avant' },
  ];

  useEffect(() => {
    // Pré-remplir les informations utilisateur si disponibles
    if (user?.user_metadata) {
      setFormData(prev => ({
        ...prev,
        hostFullName: user.user_metadata.full_name || '',
        hostEmail: user.email || '',
        hostPhone: user.user_metadata.phone || '',
      }));
    }
  }, [user]);

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationSelect = (location: LocationResult) => {
    // Mettre à jour le champ location avec la valeur sélectionnée
    setFormData(prev => ({
      ...prev,
      location: location.name
    }));
    console.log('Localisation sélectionnée:', location.name);
  };

  const handleAmenityToggle = (amenityName: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenityName) 
        ? prev.filter(name => name !== amenityName)
        : [...prev, amenityName]
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.propertyType && formData.location && formData.guests && 
                 formData.bedrooms && formData.bathrooms && formData.title && 
                 formData.description && formData.price);
      case 2:
        return !!(formData.hostFullName && formData.hostEmail && formData.hostPhone);
      case 3:
        return images.length > 0;
      case 4:
        return formData.agreeTerms;
      default:
        return true;
    }
  };

  const validateLocation = (): boolean => {
    // Vérifier que la localisation existe dans la base
    // Cette validation sera faite côté serveur aussi
    return formData.location.length >= 2;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    } else {
      Alert.alert('Informations manquantes', 'Veuillez remplir tous les champs obligatoires.');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour soumettre une candidature.');
      navigation.navigate('Auth' as never);
      return;
    }

    if (!validateStep(4)) {
      Alert.alert('Informations manquantes', 'Veuillez remplir tous les champs obligatoires et accepter les conditions.');
      return;
    }

    try {
      const result = await submitApplication({
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
        images: images,
        minimumNights: parseInt(formData.minimumNights) || 1,
        autoBooking: formData.autoBooking === 'auto',
        cancellationPolicy: formData.cancellationPolicy,
        hostGuide: formData.hostGuide || null,
        amenities: selectedAmenities,
        cleaningFee: parseInt(formData.cleaningFee) || 0,
        taxes: parseInt(formData.taxes) || 0,
        discountEnabled: formData.discountEnabled,
        discountMinNights: parseInt(formData.discountMinNights) || null,
        discountPercentage: parseFloat(formData.discountPercentage) || null,
      });

      if (result.success) {
        // Envoyer l'email de confirmation à l'hôte
        try {
          await sendHostApplicationSubmitted(
            formData.hostEmail,
            formData.hostFullName,
            formData.title,
            formData.propertyType,
            formData.location
          );
          console.log('✅ Email de confirmation envoyé à l\'hôte');
        } catch (emailError) {
          console.error('❌ Erreur envoi email hôte:', emailError);
        }

        // Envoyer l'email de notification à l'admin
        try {
          await sendHostApplicationReceived(
            'admin@akwahome.com', // Email admin
            formData.hostFullName,
            formData.hostEmail,
            formData.title,
            formData.propertyType,
            formData.location,
            parseInt(formData.price)
          );
          console.log('✅ Email de notification envoyé à l\'admin');
        } catch (emailError) {
          console.error('❌ Erreur envoi email admin:', emailError);
        }

        Alert.alert(
          'Candidature soumise !',
          'Votre candidature a été soumise avec succès. Vous recevrez un email de confirmation.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home' as never),
            },
          ]
        );
      } else {
        Alert.alert('Erreur', result.error || 'Une erreur est survenue lors de la soumission.');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue.');
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((step) => (
        <View
          key={step}
          style={[
            styles.stepDot,
            currentStep >= step && styles.stepDotActive,
          ]}
        />
      ))}
      <Text style={styles.stepText}>
        Étape {currentStep} sur 4
      </Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Informations sur votre logement</Text>
      
      {/* Type de propriété */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Type de propriété *</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowPropertyTypes(!showPropertyTypes)}
        >
          <Text style={styles.dropdownText}>
            {formData.propertyType 
              ? propertyTypes.find(t => t.value === formData.propertyType)?.label
              : 'Sélectionner un type'
            }
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
        
        {showPropertyTypes && (
          <View style={styles.dropdown}>
            {propertyTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.dropdownItem}
                onPress={() => {
                  handleInputChange('propertyType', type.value);
                  setShowPropertyTypes(false);
                }}
              >
                <Text style={styles.dropdownItemText}>
                  {type.icon} {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Localisation */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Localisation *</Text>
        <LocationSearchInput
          value={formData.location}
          onChangeText={(value) => handleInputChange('location', value)}
          onLocationSelect={handleLocationSelect}
          placeholder="Rechercher ville ou quartier..."
          style={styles.locationInput}
        />
      </View>

      {/* Capacité */}
      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Invités max *</Text>
          <TextInput
            style={styles.input}
            value={formData.guests}
            onChangeText={(value) => handleInputChange('guests', value)}
            placeholder="4"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Chambres *</Text>
          <TextInput
            style={styles.input}
            value={formData.bedrooms}
            onChangeText={(value) => handleInputChange('bedrooms', value)}
            placeholder="2"
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Salles de bain *</Text>
        <TextInput
          style={styles.input}
          value={formData.bathrooms}
          onChangeText={(value) => handleInputChange('bathrooms', value)}
          placeholder="1"
          keyboardType="numeric"
        />
      </View>

      {/* Titre */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Titre de votre annonce *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(value) => handleInputChange('title', value)}
          placeholder="Ex: Magnifique villa avec piscine"
        />
      </View>

      {/* Description */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(value) => handleInputChange('description', value)}
          placeholder="Décrivez votre logement..."
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Prix */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Prix par nuit (FCFA) *</Text>
        <TextInput
          style={styles.input}
          value={formData.price}
          onChangeText={(value) => handleInputChange('price', value)}
          placeholder="25000"
          keyboardType="numeric"
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Vos informations</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom complet *</Text>
        <TextInput
          style={styles.input}
          value={formData.hostFullName}
          onChangeText={(value) => handleInputChange('hostFullName', value)}
          placeholder="Jean Dupont"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={formData.hostEmail}
          onChangeText={(value) => handleInputChange('hostEmail', value)}
          placeholder="jean@example.com"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Téléphone *</Text>
        <TextInput
          style={styles.input}
          value={formData.hostPhone}
          onChangeText={(value) => handleInputChange('hostPhone', value)}
          placeholder="+225 07 12 34 56 78"
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Expérience (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.experience}
          onChangeText={(value) => handleInputChange('experience', value)}
          placeholder="Parlez-nous de votre expérience..."
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Politique d'annulation */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Politique d'annulation</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowCancellationPolicies(!showCancellationPolicies)}
        >
          <Text style={styles.dropdownText}>
            {cancellationPolicies.find(p => p.value === formData.cancellationPolicy)?.label}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
        
        {showCancellationPolicies && (
          <View style={styles.dropdown}>
            {cancellationPolicies.map((policy) => (
              <TouchableOpacity
                key={policy.value}
                style={styles.dropdownItem}
                onPress={() => {
                  handleInputChange('cancellationPolicy', policy.value);
                  setShowCancellationPolicies(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{policy.label}</Text>
                <Text style={styles.dropdownItemDescription}>{policy.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Photos de votre logement</Text>
      <Text style={styles.stepSubtitle}>
        Ajoutez au moins une photo pour attirer les voyageurs
      </Text>

      <View style={styles.imagesContainer}>
        {images.map((image, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => removeImage(index)}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        
        {images.length < 10 && (
          <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
            <Ionicons name="camera" size={30} color="#666" />
            <Text style={styles.addImageText}>Ajouter une photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Équipements */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Équipements disponibles</Text>
        <View style={styles.amenitiesContainer}>
          {amenities.map((amenity) => (
            <TouchableOpacity
              key={amenity.id}
              style={[
                styles.amenityButton,
                selectedAmenities.includes(amenity.name) && styles.amenityButtonActive,
              ]}
              onPress={() => handleAmenityToggle(amenity.name)}
            >
              <Text style={styles.amenityIcon}>{amenity.icon}</Text>
              <Text
                style={[
                  styles.amenityText,
                  selectedAmenities.includes(amenity.name) && styles.amenityTextActive,
                ]}
              >
                {amenity.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Conditions et finalisation</Text>
      
      {/* Règles de la maison */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Règles de la maison (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.houseRules}
          onChangeText={(value) => handleInputChange('houseRules', value)}
          placeholder="Ex: Pas de fête, pas d'animaux..."
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Guide hôte */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Guide pour les invités (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.hostGuide}
          onChangeText={(value) => handleInputChange('hostGuide', value)}
          placeholder="Instructions spéciales pour vos invités..."
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Section Réductions (pour aperçu seulement) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réductions pour séjours longs</Text>
        
        {/* Activer les réductions */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => handleInputChange('discountEnabled', !formData.discountEnabled)}
        >
          <View style={[styles.checkbox, formData.discountEnabled && styles.checkboxActive]}>
            {formData.discountEnabled && (
              <Ionicons name="checkmark" size={16} color="#fff" />
            )}
          </View>
          <Text style={styles.checkboxText}>
            Proposer des réductions pour les séjours de longue durée
          </Text>
        </TouchableOpacity>

        {/* Configuration des réductions */}
        {formData.discountEnabled && (
          <View style={styles.discountConfig}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Nuits minimum *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.discountMinNights}
                  onChangeText={(value) => handleInputChange('discountMinNights', value)}
                  placeholder="7"
                  keyboardType="numeric"
                />
                <Text style={styles.helpText}>Nombre de nuits minimum</Text>
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Réduction (%) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.discountPercentage}
                  onChangeText={(value) => handleInputChange('discountPercentage', value)}
                  placeholder="15"
                  keyboardType="numeric"
                />
                <Text style={styles.helpText}>Pourcentage de réduction</Text>
              </View>
            </View>
            
            {/* Aperçu du calcul */}
            {formData.discountMinNights && formData.discountPercentage && formData.price && (
              <View style={styles.discountPreview}>
                <Text style={styles.previewTitle}>Aperçu de la réduction :</Text>
                <Text style={styles.previewText}>
                  Séjour de {formData.discountMinNights} nuits : 
                  {parseInt(formData.price) * parseInt(formData.discountMinNights)} FCFA
                </Text>
                <Text style={styles.previewText}>
                  Avec {formData.discountPercentage}% de réduction : 
                  {Math.round(parseInt(formData.price) * parseInt(formData.discountMinNights) * (1 - parseInt(formData.discountPercentage) / 100))} FCFA
                </Text>
                <Text style={styles.previewText}>
                  Économie : {Math.round(parseInt(formData.price) * parseInt(formData.discountMinNights) * parseInt(formData.discountPercentage) / 100)} FCFA
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Conditions */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => handleInputChange('agreeTerms', !formData.agreeTerms)}
      >
        <View style={[styles.checkbox, formData.agreeTerms && styles.checkboxActive]}>
          {formData.agreeTerms && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
        <Text style={styles.checkboxText}>
          J'accepte les conditions d'utilisation et la politique de confidentialité d'AkwaHome
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Devenir hôte</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderStepIndicator()}

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {renderCurrentStep()}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.previousButton} onPress={handlePrevious}>
            <Text style={styles.previousButtonText}>Précédent</Text>
          </TouchableOpacity>
        )}
        
        {currentStep < 4 ? (
          <TouchableOpacity
            style={[styles.nextButton, !validateStep(currentStep) && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!validateStep(currentStep)}
          >
            <Text style={styles.nextButtonText}>Suivant</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, !validateStep(4) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!validateStep(4) || loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Soumission...' : 'Soumettre ma candidature'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e9ecef',
    marginRight: 8,
  },
  stepDotActive: {
    backgroundColor: '#007bff',
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContainer: {
    paddingVertical: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  dropdownButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    marginTop: 4,
    zIndex: 2000,
    elevation: 10,
  },
  dropdownItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  amenityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  amenityButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  amenityIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  amenityText: {
    fontSize: 14,
    color: '#333',
  },
  amenityTextActive: {
    color: '#fff',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  previousButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  previousButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#28a745',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#e9ecef',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  discountConfig: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  discountPreview: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 13,
    color: '#424242',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  locationInput: {
    zIndex: 1000,
  },
});

export default BecomeHostScreen;