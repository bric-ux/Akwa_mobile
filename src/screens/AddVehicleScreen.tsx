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
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { useAuth } from '../services/AuthContext';
import { VehicleType, TransmissionType, FuelType } from '../types';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import VehicleBrandAutocomplete from '../components/VehicleBrandAutocomplete';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'car', label: 'Voiture' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Camion' },
  { value: 'motorcycle', label: 'Moto' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'bicycle', label: 'Vélo' },
  { value: 'other', label: 'Autre' },
];

const TRANSMISSION_TYPES: { value: TransmissionType; label: string }[] = [
  { value: 'manual', label: 'Manuelle' },
  { value: 'automatic', label: 'Automatique' },
];

const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: 'essence', label: 'Essence' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Électrique' },
  { value: 'hybrid', label: 'Hybride' },
];

const COMMON_FEATURES = [
  'Climatisation',
  'GPS',
  'Bluetooth',
  'Sièges en cuir',
  'Toit ouvrant',
  'Caméra de recul',
  'Régulateur de vitesse',
  'Détecteur de pluie',
  'Phares automatiques',
  'Parking assisté',
];

const VEHICLE_PHOTO_CATEGORIES = [
  { value: 'exterior', label: 'Extérieur', icon: 'car-outline', color: '#2563eb' },
  { value: 'interior', label: 'Intérieur', icon: 'home-outline', color: '#059669' },
  { value: 'engine', label: 'Moteur', icon: 'settings-outline', color: '#dc2626' },
  { value: 'documents', label: 'Documents', icon: 'document-text-outline', color: '#f59e0b' },
  { value: 'other', label: 'Autre', icon: 'camera-outline', color: '#7c3aed' },
];

// Fonction pour formater les dates en français
const formatDateFrench = (date: Date): string => {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  const weekdays = [
    'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const weekday = weekdays[date.getDay()];
  
  return `${weekday} ${day} ${month} ${year}`;
};

const formatDateShortFrench = (date: Date): string => {
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
};

const AddVehicleScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { addVehicle, loading } = useVehicles();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    vehicle_type: '' as VehicleType | '',
    brand: '',
    model: '',
    year: '',
    plate_number: '',
    seats: '5',
    transmission: '' as TransmissionType | '',
    fuel_type: '' as FuelType | '',
    mileage: '',
    location_id: '',
    location_name: '',
    price_per_day: '',
    price_per_week: '',
    price_per_month: '',
    security_deposit: '0',
    minimum_rental_days: '1',
    features: [] as string[],
    rules: [] as string[],
    ownerFullName: '',
    ownerEmail: '',
    ownerPhone: '',
    has_insurance: false,
    insurance_expiration_date: null as Date | null,
    insurance_details: '',
    with_driver: false,
    requires_license: true,
    min_license_years: '0',
    discount_enabled: false,
    discount_min_days: '7',
    discount_percentage: '10',
    long_stay_discount_enabled: false,
    long_stay_discount_min_days: '30',
    long_stay_discount_percentage: '20',
  });

  const [selectedImages, setSelectedImages] = useState<Array<{uri: string, category: string, displayOrder: number, isMain?: boolean}>>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [customFeature, setCustomFeature] = useState('');
  const [customRule, setCustomRule] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedImageForCategory, setSelectedImageForCategory] = useState<number | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showInsuranceDatePicker, setShowInsuranceDatePicker] = useState(false);
  const [tempInsuranceDate, setTempInsuranceDate] = useState<Date | null>(null);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Fonction pour uploader une image vers Supabase Storage
  const uploadImageToStorage = async (uri: string): Promise<string | null> => {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      console.log('Image déjà uploadée, skipping:', uri);
      return uri; // Already a public URL
    }

    setUploadingImages(true);
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `vehicle-images/${user?.id}/${fileName}`;

      const contentType = fileExt === 'png' ? 'image/png' : 
                         fileExt === 'gif' ? 'image/gif' : 
                         'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(filePath, uint8Array, {
          contentType: contentType,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        Alert.alert('Erreur d\'upload', `Impossible d'uploader l'image: ${uploadError.message}`);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);

      console.log('Image uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('Error in uploadImageToStorage:', error);
      Alert.alert('Erreur d\'upload', `Une erreur est survenue lors de l'upload de l'image: ${error.message}`);
      return null;
    } finally {
      setUploadingImages(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de l\'accès à vos photos.');
      return;
    }

    const remainingSlots = 30 - selectedImages.length;
    if (remainingSlots <= 0) {
      Alert.alert('Limite atteinte', 'Vous pouvez ajouter jusqu\'à 30 photos maximum.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploadingImages(true);
      const uploadedUrls: { uri: string; category: string; displayOrder: number; isMain: boolean }[] = [];
      const suggestedCategory = 'exterior';

      for (const asset of result.assets) {
        const publicUrl = await uploadImageToStorage(asset.uri);
        if (publicUrl) {
          uploadedUrls.push({
            uri: publicUrl,
            category: suggestedCategory,
            displayOrder: selectedImages.length + uploadedUrls.length + 1,
            isMain: selectedImages.length === 0 && uploadedUrls.length === 0 // First uploaded image is main if no others exist
          });
        }
      }
      setUploadingImages(false);

      if (uploadedUrls.length > 0) {
        setSelectedImages(prev => {
          const updated = [...prev, ...uploadedUrls];
          // Ensure only one main photo
          const hasMain = updated.some(img => img.isMain);
          if (!hasMain && updated.length > 0) {
            updated[0].isMain = true;
          }
          return updated;
        });

        if (uploadedUrls.length === 1) {
          setTimeout(() => {
            openCategoryModal(selectedImages.length);
          }, 500);
        } else {
          Alert.alert(
            `${uploadedUrls.length} photos ajoutées`,
            'Vous pouvez maintenant catégoriser vos photos et définir la photo principale en appuyant sur chaque photo.',
            [{ text: 'OK' }]
          );
        }
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const removed = prev[index];
      const updated = prev.filter((_, i) => i !== index);
      
      // Si la photo supprimée était principale et qu'il reste des photos, définir la première comme principale
      if (removed?.isMain && updated.length > 0) {
        updated[0].isMain = true;
      }
      
      return updated.map((img, i) => ({
        ...img,
        displayOrder: i + 1
      }));
    });
  };

  const setMainImage = (index: number) => {
    setSelectedImages(prev => prev.map((img, i) => ({
      ...img,
      isMain: i === index
    })));
  };

  const openCategoryModal = (index: number) => {
    setSelectedImageForCategory(index);
    setShowCategoryModal(true);
  };

  const setImageCategory = (category: string) => {
    if (selectedImageForCategory !== null) {
      setSelectedImages(prev => prev.map((img, index) => 
        index === selectedImageForCategory 
          ? { ...img, category }
          : img
      ));
    }
    setShowCategoryModal(false);
    setSelectedImageForCategory(null);
  };

  const getCategoryLabel = (category: string) => {
    const cat = VEHICLE_PHOTO_CATEGORIES.find(c => c.value === category);
    return cat ? `${cat.icon} ${cat.label}` : '📸 Autre';
  };

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const addCustomFeature = () => {
    const trimmedFeature = customFeature.trim();
    if (trimmedFeature) {
      // Vérifier si l'équipement n'existe pas déjà
      if (formData.features.includes(trimmedFeature)) {
        Alert.alert('Attention', 'Cet équipement est déjà ajouté');
        return;
      }
      
      Keyboard.dismiss();
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, trimmedFeature],
      }));
      setCustomFeature('');
    }
  };

  const addRule = () => {
    const trimmedRule = customRule.trim();
    if (trimmedRule) {
      // Vérifier si la règle n'existe pas déjà
      if (formData.rules.includes(trimmedRule)) {
        Alert.alert('Attention', 'Cette règle est déjà ajoutée');
        return;
      }
      
      Keyboard.dismiss();
      setFormData(prev => ({
        ...prev,
        rules: [...prev.rules, trimmedRule],
      }));
      setCustomRule('');
    }
  };

  const removeRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const handleLocationSelect = (location: { id: string; name: string; type?: string; city_id?: string; commune?: string }) => {
    setFormData(prev => ({
      ...prev,
      location_id: location.id,
      location_name: location.name,
    }));
    setShowLocationModal(false);
  };

  const handleLocationChange = (location: { id: string; name: string; type?: string; city_id?: string; commune?: string } | null) => {
    if (location) {
      handleLocationSelect(location);
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone')
        .eq('user_id', user.id)
        .single();

      if (profile && !error) {
        setFormData(prev => ({
          ...prev,
          ownerFullName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || prev.ownerFullName,
          ownerEmail: profile.email || prev.ownerEmail,
          ownerPhone: profile.phone || prev.ownerPhone,
        }));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour soumettre une candidature.');
      return;
    }

    // Validation
    if (!formData.title.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un titre');
      return;
    }
    if (!formData.vehicle_type) {
      Alert.alert('Erreur', 'Veuillez sélectionner un type de véhicule');
      return;
    }
    if (!formData.brand.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir la marque');
      return;
    }
    if (!formData.model.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le modèle');
      return;
    }
    if (!formData.year || parseInt(formData.year) < 1900 || parseInt(formData.year) > new Date().getFullYear() + 1) {
      Alert.alert('Erreur', 'Veuillez saisir une année valide');
      return;
    }
    if (!formData.price_per_day || parseFloat(formData.price_per_day) <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un prix par jour valide');
      return;
    }
    if (!formData.location_name) {
      Alert.alert('Erreur', 'Veuillez sélectionner une localisation');
      return;
    }
    if (selectedImages.length === 0) {
      Alert.alert('Erreur', 'Veuillez ajouter au moins une photo');
      return;
    }
    if (!formData.has_insurance) {
      Alert.alert(
        'Assurance requise',
        'Nous acceptons uniquement les véhicules possédant une assurance valide. Veuillez cocher la case "Véhicule assuré" et renseigner les informations d\'assurance.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (formData.has_insurance && !formData.insurance_expiration_date) {
      Alert.alert('Erreur', 'Veuillez renseigner la date d\'expiration de l\'assurance');
      return;
    }
    if (formData.has_insurance && formData.insurance_expiration_date && formData.insurance_expiration_date < new Date()) {
      Alert.alert('Erreur', 'La date d\'expiration de l\'assurance ne peut pas être dans le passé');
      return;
    }

    // Ensure all selected images have been uploaded and have public URLs
    const imagesToUpload = selectedImages.filter(img => !img.uri.startsWith('http'));
    if (imagesToUpload.length > 0) {
      Alert.alert('Images non uploadées', 'Veuillez attendre que toutes les images soient uploadées avant de soumettre.');
      return;
    }

    // Get user profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email, phone')
      .eq('user_id', user.id)
      .single();

    // Préparer les données pour la table vehicles (comme sur le site web)
    const vehiclePayload: Partial<any> = {
      vehicle_type: formData.vehicle_type,
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      year: parseInt(formData.year),
      plate_number: formData.plate_number.trim() || undefined,
      seats: parseInt(formData.seats) || 5,
      transmission: formData.transmission || undefined,
      fuel_type: formData.fuel_type || undefined,
      mileage: formData.mileage ? parseInt(formData.mileage) : undefined,
      location_id: formData.location_id || undefined,
      price_per_day: parseInt(formData.price_per_day),
      price_per_week: formData.price_per_week ? parseInt(formData.price_per_week) : undefined,
      price_per_month: formData.price_per_month ? parseInt(formData.price_per_month) : undefined,
      security_deposit: parseInt(formData.security_deposit) || 0,
      minimum_rental_days: parseInt(formData.minimum_rental_days) || 1,
      title: formData.title.trim(),
      description: formData.description.trim(),
      features: formData.features,
      rules: formData.rules,
      images: selectedImages.map(img => img.uri),
      has_insurance: formData.has_insurance,
      insurance_details: formData.insurance_details || undefined,
      with_driver: formData.with_driver,
      requires_license: formData.requires_license,
      min_license_years: parseInt(formData.min_license_years) || 0,
      discount_enabled: formData.discount_enabled,
      discount_min_days: formData.discount_enabled ? parseInt(formData.discount_min_days) || 7 : undefined,
      discount_percentage: formData.discount_enabled ? parseInt(formData.discount_percentage) || 10 : undefined,
      long_stay_discount_enabled: formData.long_stay_discount_enabled,
      long_stay_discount_min_days: formData.long_stay_discount_enabled ? parseInt(formData.long_stay_discount_min_days) || 30 : undefined,
      long_stay_discount_percentage: formData.long_stay_discount_enabled ? parseInt(formData.long_stay_discount_percentage) || 20 : undefined,
    };

    const result = await addVehicle(vehiclePayload);

    if (result.success) {
      Alert.alert(
        'Véhicule soumis',
        'Votre véhicule a été soumis avec succès !\n\nIl sera examiné par un administrateur et vous serez notifié une fois approuvé.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('MyVehicles' as never);
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('Erreur', result.error || 'Une erreur est survenue lors de l\'ajout du véhicule');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('MyVehicles' as never);
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ajouter un véhicule</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Informations de base */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations de base</Text>
            
            <Text style={styles.label}>Titre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Toyota Corolla 2020 - Confortable et économique"
              value={formData.title}
              onChangeText={(value) => handleInputChange('title', value)}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Décrivez votre véhicule..."
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Type de véhicule *</Text>
            <View style={styles.optionsGrid}>
              {VEHICLE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.optionButton,
                    formData.vehicle_type === type.value && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleInputChange('vehicle_type', type.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      formData.vehicle_type === type.value && styles.optionTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Marque *</Text>
            <VehicleBrandAutocomplete
              value={formData.brand}
              onChange={(value) => handleInputChange('brand', value)}
              placeholder="Ex: Toyota"
              mode="brand"
            />

            <Text style={styles.label}>Modèle *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Corolla"
              value={formData.model}
              onChangeText={(value) => handleInputChange('model', value)}
            />

            <Text style={styles.label}>Année *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 2020"
              value={formData.year}
              onChangeText={(value) => handleInputChange('year', value)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Plaque d'immatriculation</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: AB-123-CD"
              value={formData.plate_number}
              onChangeText={(value) => handleInputChange('plate_number', value)}
            />
          </View>

          {/* Caractéristiques */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Caractéristiques</Text>
            
            <Text style={styles.label}>Nombre de places *</Text>
            <TextInput
              style={styles.input}
              placeholder="5"
              value={formData.seats}
              onChangeText={(value) => handleInputChange('seats', value)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Transmission</Text>
            <View style={styles.optionsRow}>
              {TRANSMISSION_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.optionButton,
                    formData.transmission === type.value && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleInputChange('transmission', type.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      formData.transmission === type.value && styles.optionTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Type de carburant</Text>
            <View style={styles.optionsGrid}>
              {FUEL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.optionButton,
                    formData.fuel_type === type.value && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleInputChange('fuel_type', type.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      formData.fuel_type === type.value && styles.optionTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Kilométrage</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 50000"
              value={formData.mileage}
              onChangeText={(value) => handleInputChange('mileage', value)}
              keyboardType="numeric"
            />
          </View>

          {/* Localisation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Localisation</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setShowLocationModal(true)}
            >
              <Ionicons name="location-outline" size={20} color="#2E7D32" />
              <Text style={styles.locationText}>
                {formData.location_name || 'Sélectionner une localisation'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Tarification */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tarification</Text>
            
            <Text style={styles.label}>Prix par jour (XOF) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 15000"
              value={formData.price_per_day}
              onChangeText={(value) => handleInputChange('price_per_day', value)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Prix par semaine (XOF)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 90000"
              value={formData.price_per_week}
              onChangeText={(value) => handleInputChange('price_per_week', value)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Prix par mois (XOF)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 350000"
              value={formData.price_per_month}
              onChangeText={(value) => handleInputChange('price_per_month', value)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Caution (XOF)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 50000"
              value={formData.security_deposit}
              onChangeText={(value) => handleInputChange('security_deposit', value)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Durée minimum de location (jours)</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              value={formData.minimum_rental_days}
              onChangeText={(value) => handleInputChange('minimum_rental_days', value)}
              keyboardType="numeric"
            />
          </View>

          {/* Assurance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assurance *</Text>
            
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                const newValue = !formData.has_insurance;
                setFormData(prev => ({
                  ...prev,
                  has_insurance: newValue,
                  insurance_expiration_date: newValue ? prev.insurance_expiration_date : null,
                  insurance_details: newValue ? prev.insurance_details : '',
                }));
              }}
            >
              <View style={[styles.checkbox, formData.has_insurance && styles.checkboxChecked]}>
                {formData.has_insurance && (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </View>
              <View style={styles.checkboxLabelContainer}>
                <Text style={styles.checkboxLabel}>Véhicule assuré</Text>
                <Text style={styles.checkboxDescription}>
                  Ce véhicule dispose d'une assurance valide
                </Text>
              </View>
            </TouchableOpacity>

            {!formData.has_insurance && (
              <View style={styles.warningContainer}>
                <Ionicons name="warning-outline" size={20} color="#ef4444" />
                <Text style={styles.warningText}>
                  Nous acceptons uniquement les véhicules possédant une assurance valide.
                </Text>
              </View>
            )}

            {formData.has_insurance && (
              <View style={styles.insuranceDetailsContainer}>
                <Text style={styles.label}>Date d'expiration de l'assurance *</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setTempInsuranceDate(formData.insurance_expiration_date || new Date());
                    setShowInsuranceDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateButtonIconContainer}>
                    <Ionicons name="calendar-outline" size={24} color="#2E7D32" />
                  </View>
                  <View style={styles.dateButtonTextContainer}>
                    <Text style={[styles.dateButtonLabel, !formData.insurance_expiration_date && styles.dateButtonLabelPlaceholder]}>
                      {formData.insurance_expiration_date
                        ? 'Date sélectionnée'
                        : 'Sélectionner la date'}
                    </Text>
                    <Text style={[styles.dateButtonText, !formData.insurance_expiration_date && styles.dateButtonTextPlaceholder]}>
                      {formData.insurance_expiration_date
                        ? formatDateShortFrench(formData.insurance_expiration_date)
                        : 'Appuyez pour choisir'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <Text style={styles.label}>Détails de l'assurance (optionnel)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ex: Assurance tous risques NSIA, valide jusqu'au..."
                  value={formData.insurance_details}
                  onChangeText={(value) => handleInputChange('insurance_details', value)}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

        {/* Modal de sélection de date d'assurance */}
        <Modal
          visible={showInsuranceDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowInsuranceDatePicker(false)}
        >
          <View style={styles.dateModalOverlay}>
            <View style={styles.dateModalContent}>
              <View style={styles.dateModalHeader}>
                <Text style={styles.dateModalTitle}>Date d'expiration de l'assurance</Text>
                <TouchableOpacity
                  onPress={() => setShowInsuranceDatePicker(false)}
                  style={styles.dateModalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.datePickerContainer}>
                <Text style={styles.datePickerHint}>
                  Sélectionnez la date d'expiration de votre assurance
                </Text>
                {tempInsuranceDate && (
                  <View style={styles.selectedDatePreview}>
                    <Ionicons name="calendar" size={20} color="#2E7D32" />
                    <Text style={styles.selectedDateText}>
                      {formatDateFrench(tempInsuranceDate)}
                    </Text>
                  </View>
                )}
                <DateTimePicker
                  value={tempInsuranceDate || formData.insurance_expiration_date || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      setShowInsuranceDatePicker(false);
                      if (selectedDate) {
                        setFormData(prev => ({
                          ...prev,
                          insurance_expiration_date: selectedDate,
                        }));
                      }
                    } else if (Platform.OS === 'ios' && selectedDate) {
                      // Sur iOS, on met à jour la date temporaire
                      setTempInsuranceDate(selectedDate);
                    }
                  }}
                  style={styles.datePicker}
                />
              </View>

              {Platform.OS === 'ios' && (
                <View style={styles.dateModalFooter}>
                  <TouchableOpacity
                    style={styles.dateModalCancelButton}
                    onPress={() => {
                      setTempInsuranceDate(null);
                      setShowInsuranceDatePicker(false);
                    }}
                  >
                    <Text style={styles.dateModalCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dateModalConfirmButton}
                    onPress={() => {
                      if (tempInsuranceDate) {
                        setFormData(prev => ({
                          ...prev,
                          insurance_expiration_date: tempInsuranceDate,
                        }));
                      }
                      setTempInsuranceDate(null);
                      setShowInsuranceDatePicker(false);
                    }}
                  >
                    <Text style={styles.dateModalConfirmText}>Confirmer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
          </View>

          {/* Options et exigences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Options et exigences</Text>
            
            {/* Avec chauffeur */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleInputChange('with_driver', !formData.with_driver)}
            >
              <View style={[styles.checkbox, formData.with_driver && styles.checkboxChecked]}>
                {formData.with_driver && (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </View>
              <View style={styles.checkboxLabelContainer}>
                <Text style={styles.checkboxLabel}>Proposé avec chauffeur</Text>
                <Text style={styles.checkboxDescription}>
                  Je peux fournir un chauffeur pour ce véhicule
                </Text>
              </View>
            </TouchableOpacity>

            {/* Exigences de permis */}
            <View style={styles.licenseSection}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => handleInputChange('requires_license', !formData.requires_license)}
              >
                <View style={[styles.checkbox, formData.requires_license && styles.checkboxChecked]}>
                  {formData.requires_license && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </View>
                <View style={styles.checkboxLabelContainer}>
                  <Text style={styles.checkboxLabel}>Permis de conduire requis</Text>
                  <Text style={styles.checkboxDescription}>
                    Le locataire doit avoir un permis de conduire valide
                  </Text>
                </View>
              </TouchableOpacity>

              {formData.requires_license && (
                <View style={styles.licenseYearsContainer}>
                  <Text style={styles.label}>Nombre minimum d'années de permis requis</Text>
                  <View style={styles.optionsRow}>
                    {['0', '1', '2', '3', '5'].map((years) => (
                      <TouchableOpacity
                        key={years}
                        style={[
                          styles.optionButton,
                          formData.min_license_years === years && styles.optionButtonSelected,
                        ]}
                        onPress={() => handleInputChange('min_license_years', years)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            formData.min_license_years === years && styles.optionTextSelected,
                          ]}
                        >
                          {years === '0' ? 'Pas de minimum' : `${years} an${years !== '1' ? 's' : ''} minimum`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.hintText}>
                    Le locataire devra prouver qu'il possède son permis depuis ce nombre d'années
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Réductions automatiques */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Réductions automatiques</Text>
            <Text style={styles.sectionDescription}>
              Attirez plus de clients en offrant des réductions pour les locations longues durées
            </Text>

            {/* Réduction courte durée */}
            <View style={styles.discountCard}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => handleInputChange('discount_enabled', !formData.discount_enabled)}
              >
                <View style={[styles.checkbox, formData.discount_enabled && styles.checkboxChecked]}>
                  {formData.discount_enabled && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </View>
                <View style={styles.checkboxLabelContainer}>
                  <Text style={styles.checkboxLabel}>Réduction pour locations de plusieurs jours</Text>
                  <Text style={styles.checkboxDescription}>
                    Offrez une réduction automatique pour les locations plus longues
                  </Text>
                </View>
              </TouchableOpacity>

              {formData.discount_enabled && (
                <View style={styles.discountFieldsContainer}>
                  <View style={styles.discountFieldRow}>
                    <View style={styles.discountField}>
                      <Text style={styles.label}>À partir de (jours)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="7"
                        value={formData.discount_min_days}
                        onChangeText={(value) => handleInputChange('discount_min_days', value)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.discountField}>
                      <Text style={styles.label}>Réduction (%)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="10"
                        value={formData.discount_percentage}
                        onChangeText={(value) => handleInputChange('discount_percentage', value)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Réduction longue durée */}
            <View style={[styles.discountCard, styles.longStayDiscountCard]}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => handleInputChange('long_stay_discount_enabled', !formData.long_stay_discount_enabled)}
              >
                <View style={[styles.checkbox, formData.long_stay_discount_enabled && styles.checkboxChecked]}>
                  {formData.long_stay_discount_enabled && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </View>
                <View style={styles.checkboxLabelContainer}>
                  <Text style={styles.checkboxLabel}>Réduction longue durée (mensuelle)</Text>
                  <Text style={styles.checkboxDescription}>
                    Offrez une réduction supplémentaire pour les locations mensuelles
                  </Text>
                </View>
              </TouchableOpacity>

              {formData.long_stay_discount_enabled && (
                <View style={styles.discountFieldsContainer}>
                  <View style={styles.discountFieldRow}>
                    <View style={styles.discountField}>
                      <Text style={styles.label}>À partir de (jours)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="30"
                        value={formData.long_stay_discount_min_days}
                        onChangeText={(value) => handleInputChange('long_stay_discount_min_days', value)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.discountField}>
                      <Text style={styles.label}>Réduction (%)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="20"
                        value={formData.long_stay_discount_percentage}
                        onChangeText={(value) => handleInputChange('long_stay_discount_percentage', value)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos *</Text>
            <TouchableOpacity 
              style={styles.addPhotoButton} 
              onPress={pickImage}
              disabled={uploadingImages}
            >
              {uploadingImages ? (
                <ActivityIndicator color="#2E7D32" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={24} color="#2E7D32" />
                  <Text style={styles.addPhotoText}>Ajouter des photos</Text>
                </>
              )}
            </TouchableOpacity>
            {selectedImages.length > 0 && (
              <View style={styles.imagesContainer}>
                {selectedImages.map((img, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.imageWrapper}
                    onPress={() => openCategoryModal(index)}
                  >
                    <Image source={{ uri: img.uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#e74c3c" />
                    </TouchableOpacity>
                    {img.isMain && (
                      <View style={styles.mainPhotoBadge}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={styles.mainPhotoBadgeText}>Principale</Text>
                      </View>
                    )}
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{getCategoryLabel(img.category)}</Text>
                    </View>
                    {!img.isMain && (
                      <TouchableOpacity
                        style={styles.setMainButton}
                        onPress={() => setMainImage(index)}
                      >
                        <Ionicons name="star-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Équipements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Équipements</Text>
            <View style={styles.featuresContainer}>
              {COMMON_FEATURES.map((feature) => (
                <TouchableOpacity
                  key={feature}
                  style={[
                    styles.featureTag,
                    formData.features.includes(feature) && styles.featureTagSelected,
                  ]}
                  onPress={() => toggleFeature(feature)}
                >
                  <Text
                    style={[
                      styles.featureText,
                      formData.features.includes(feature) && styles.featureTextSelected,
                    ]}
                  >
                    {feature}
                  </Text>
                  {formData.features.includes(feature) && (
                    <Ionicons name="checkmark" size={16} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              ))}
              {/* Afficher les équipements personnalisés */}
              {formData.features
                .filter(f => !COMMON_FEATURES.includes(f))
                .map((feature, index) => (
                  <TouchableOpacity
                    key={`custom-${index}`}
                    style={[styles.featureTag, styles.featureTagCustom]}
                    onPress={() => toggleFeature(feature)}
                  >
                    <Text style={[styles.featureText, styles.featureTextSelected]}>
                      {feature}
                    </Text>
                    <Ionicons name="checkmark" size={16} color="#2E7D32" />
                  </TouchableOpacity>
                ))}
            </View>
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.input, styles.customInput]}
                placeholder="Ajouter un équipement personnalisé"
                value={customFeature}
                onChangeText={setCustomFeature}
                onSubmitEditing={addCustomFeature}
                returnKeyType="done"
              />
              <TouchableOpacity 
                style={[styles.addButton, !customFeature.trim() && styles.addButtonDisabled]} 
                onPress={addCustomFeature}
                disabled={!customFeature.trim()}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Règles */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Règles de location</Text>
            {formData.rules.map((rule, index) => (
              <View key={index} style={styles.ruleItem}>
                <Text style={styles.ruleText}>{rule}</Text>
                <TouchableOpacity onPress={() => removeRule(index)}>
                  <Ionicons name="close-circle" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.input, styles.customInput]}
                placeholder="Ajouter une règle"
                value={customRule}
                onChangeText={setCustomRule}
                onSubmitEditing={addRule}
                returnKeyType="done"
              />
              <TouchableOpacity 
                style={[styles.addButton, !customRule.trim() && styles.addButtonDisabled]} 
                onPress={addRule}
                disabled={!customRule.trim()}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Publier le véhicule</Text>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        <CitySearchInputModal
          visible={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onChange={handleLocationChange}
          onSelect={handleLocationSelect}
        />

        {/* Modal de catégorisation des photos */}
        {showCategoryModal && selectedImageForCategory !== null && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Catégoriser la photo</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCategoryModal(false);
                    setSelectedImageForCategory(null);
                  }}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.categoriesContainer}>
                {VEHICLE_PHOTO_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    style={styles.categoryCard}
                    onPress={() => setImageCategory(category.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.categoryIconContainer, { backgroundColor: `${category.color}15` }]}>
                      <Ionicons name={category.icon as any} size={32} color={category.color} />
                    </View>
                    <Text style={styles.categoryLabel}>{category.label}</Text>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  optionButtonSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#2E7D32',
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 8,
  },
  addPhotoText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  imageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    gap: 6,
  },
  featureTagSelected: {
    backgroundColor: '#f0f8f0',
    borderColor: '#2E7D32',
  },
  featureText: {
    fontSize: 14,
    color: '#666',
  },
  featureTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  featureTagCustom: {
    backgroundColor: '#f0f8f0',
    borderColor: '#2E7D32',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  customInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#2E7D32',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: '#2c3e50',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    padding: 16,
    margin: 20,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mainPhotoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  mainPhotoBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '600',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  setMainButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#2E7D32',
    padding: 6,
    borderRadius: 20,
    opacity: 0.9,
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
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  categoriesContainer: {
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  modalCancelButton: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#2E7D32',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2E7D32',
  },
  checkboxLabelContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 14,
    color: '#666',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#dc2626',
  },
  insuranceDetailsContainer: {
    marginTop: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#2E7D32',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: 12,
  },
  dateButtonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateButtonTextContainer: {
    flex: 1,
  },
  dateButtonLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
    fontWeight: '500',
  },
  dateButtonLabelPlaceholder: {
    color: '#94a3b8',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
  },
  dateButtonTextPlaceholder: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dateModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
    maxHeight: '80%',
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  dateModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  dateModalCloseButton: {
    padding: 4,
  },
  datePickerContainer: {
    padding: 20,
    alignItems: 'center',
  },
  datePickerHint: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedDatePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    width: '100%',
  },
  selectedDateText: {
    fontSize: 16,
    color: '#166534',
    fontWeight: '600',
    flex: 1,
  },
  datePicker: {
    width: '100%',
  },
  dateModalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  dateModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  dateModalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  licenseSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  licenseYearsContainer: {
    marginTop: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#2E7D32',
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  discountCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  longStayDiscountCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  discountFieldsContainer: {
    marginTop: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#f59e0b',
  },
  discountFieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  discountField: {
    flex: 1,
  },
});

export default AddVehicleScreen;

