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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useHostApplications, HostApplicationData } from '../hooks/useHostApplications';
import { useAuth } from '../services/AuthContext';

const BecomeHostScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { submitApplication, getAmenities, loading } = useHostApplications();

  const [formData, setFormData] = useState({
    property_type: '',
    location: '',
    max_guests: '',
    bedrooms: '',
    bathrooms: '',
    title: '',
    description: '',
    price_per_night: '',
    full_name: '',
    email: '',
    phone: '',
    experience: '',
    address_details: '',
    cleaning_fee: '',
    taxes: '',
  });

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [availableAmenities, setAvailableAmenities] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Vous devez être connecté pour devenir hôte.',
        [
          {
            text: 'Se connecter',
            onPress: () => navigation.navigate('Auth'),
          },
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }

    loadAmenities();
    // Pré-remplir avec les données utilisateur
    if (user.user_metadata) {
      setFormData(prev => ({
        ...prev,
        full_name: `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim(),
        email: user.email || '',
        phone: user.user_metadata.phone || '',
      }));
    }
  }, [user]);

  const loadAmenities = async () => {
    try {
      const amenities = await getAmenities();
      setAvailableAmenities(amenities);
    } catch (error) {
      console.error('Error loading amenities:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAmenityToggle = (amenityName: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenityName)
        ? prev.filter(name => name !== amenityName)
        : [...prev, amenityName]
    );
  };

  const validateForm = () => {
    const requiredFields = [
      'property_type', 'location', 'max_guests', 'bedrooms', 'bathrooms',
      'title', 'description', 'price_per_night', 'full_name', 'email', 'phone'
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof typeof formData]) {
        Alert.alert('Champ requis', `Le champ ${field} est requis`);
        return false;
      }
    }

    // Validation numérique
    if (isNaN(Number(formData.max_guests)) || Number(formData.max_guests) < 1) {
      Alert.alert('Erreur', 'Le nombre de voyageurs doit être supérieur à 0');
      return false;
    }

    if (isNaN(Number(formData.bedrooms)) || Number(formData.bedrooms) < 1) {
      Alert.alert('Erreur', 'Le nombre de chambres doit être supérieur à 0');
      return false;
    }

    if (isNaN(Number(formData.bathrooms)) || Number(formData.bathrooms) < 1) {
      Alert.alert('Erreur', 'Le nombre de salles de bain doit être supérieur à 0');
      return false;
    }

    if (isNaN(Number(formData.price_per_night)) || Number(formData.price_per_night) < 1000) {
      Alert.alert('Erreur', 'Le prix par nuit doit être d\'au moins 1000 FCFA');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const applicationData: HostApplicationData = {
        property_type: formData.property_type as any,
        location: formData.location,
        max_guests: Number(formData.max_guests),
        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        title: formData.title,
        description: formData.description,
        price_per_night: Number(formData.price_per_night),
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        experience: formData.experience || undefined,
        address_details: formData.address_details || undefined,
        cleaning_fee: formData.cleaning_fee ? Number(formData.cleaning_fee) : undefined,
        taxes: formData.taxes ? Number(formData.taxes) : undefined,
        amenities: selectedAmenities,
      };

      const result = await submitApplication(applicationData);

      if (result.success) {
        Alert.alert(
          'Candidature soumise',
          'Votre candidature pour devenir hôte a été soumise avec succès. Notre équipe va l\'examiner et vous contacter sous peu.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Erreur', 'Impossible de soumettre la candidature. Veuillez réessayer.');
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const propertyTypes = [
    { value: 'apartment', label: 'Appartement' },
    { value: 'house', label: 'Maison' },
    { value: 'villa', label: 'Villa' },
    { value: 'studio', label: 'Studio' },
    { value: 'guesthouse', label: 'Maison d\'hôtes' },
  ];

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Connexion requise</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Devenir hôte</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Informations sur votre propriété</Text>

        {/* Type de propriété */}
        <Text style={styles.label}>Type de propriété *</Text>
        <View style={styles.propertyTypeContainer}>
          {propertyTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.propertyTypeButton,
                formData.property_type === type.value && styles.propertyTypeButtonActive,
              ]}
              onPress={() => handleInputChange('property_type', type.value)}
            >
              <Text
                style={[
                  styles.propertyTypeText,
                  formData.property_type === type.value && styles.propertyTypeTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Localisation */}
        <Text style={styles.label}>Localisation *</Text>
        <TextInput
          style={styles.input}
          value={formData.location}
          onChangeText={(text) => handleInputChange('location', text)}
          placeholder="Ex: Cocody, Abidjan"
        />

        {/* Capacité */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Voyageurs max *</Text>
            <TextInput
              style={styles.input}
              value={formData.max_guests}
              onChangeText={(text) => handleInputChange('max_guests', text)}
              placeholder="4"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Chambres *</Text>
            <TextInput
              style={styles.input}
              value={formData.bedrooms}
              onChangeText={(text) => handleInputChange('bedrooms', text)}
              placeholder="2"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.label}>Salles de bain *</Text>
        <TextInput
          style={styles.input}
          value={formData.bathrooms}
          onChangeText={(text) => handleInputChange('bathrooms', text)}
          placeholder="1"
          keyboardType="numeric"
        />

        {/* Titre et description */}
        <Text style={styles.label}>Titre de votre annonce *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => handleInputChange('title', text)}
          placeholder="Ex: Magnifique villa avec piscine"
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => handleInputChange('description', text)}
          placeholder="Décrivez votre propriété..."
          multiline
          numberOfLines={4}
        />

        {/* Prix */}
        <Text style={styles.label}>Prix par nuit (FCFA) *</Text>
        <TextInput
          style={styles.input}
          value={formData.price_per_night}
          onChangeText={(text) => handleInputChange('price_per_night', text)}
          placeholder="25000"
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Vos informations</Text>

        {/* Informations personnelles */}
        <Text style={styles.label}>Nom complet *</Text>
        <TextInput
          style={styles.input}
          value={formData.full_name}
          onChangeText={(text) => handleInputChange('full_name', text)}
          placeholder="Votre nom complet"
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => handleInputChange('email', text)}
          placeholder="votre@email.com"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Téléphone *</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => handleInputChange('phone', text)}
          placeholder="+225 XX XX XX XX"
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Expérience (optionnel)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.experience}
          onChangeText={(text) => handleInputChange('experience', text)}
          placeholder="Parlez-nous de votre expérience..."
          multiline
          numberOfLines={3}
        />

        {/* Équipements */}
        <Text style={styles.sectionTitle}>Équipements disponibles</Text>
        <View style={styles.amenitiesContainer}>
          {availableAmenities.map((amenity) => (
            <TouchableOpacity
              key={amenity.id}
              style={[
                styles.amenityButton,
                selectedAmenities.includes(amenity.name) && styles.amenityButtonActive,
              ]}
              onPress={() => handleAmenityToggle(amenity.name)}
            >
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

        {/* Bouton de soumission */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting || loading}
        >
          {submitting || loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Soumettre ma candidature</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          * Champs obligatoires. Notre équipe examinera votre candidature et vous contactera sous 48h.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  propertyTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  propertyTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  propertyTypeButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  propertyTypeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  propertyTypeTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  amenityButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 15,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  amenityButtonActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  amenityText: {
    fontSize: 12,
    color: '#666',
  },
  amenityTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
});

export default BecomeHostScreen;
