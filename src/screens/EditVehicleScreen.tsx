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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { useAuth } from '../services/AuthContext';
import { VehicleType, TransmissionType, FuelType, Vehicle } from '../types';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';

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

type EditVehicleRouteParams = {
  vehicleId: string;
};

const EditVehicleScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ EditVehicle: EditVehicleRouteParams }, 'EditVehicle'>>();
  const { vehicleId } = route.params;
  const { user } = useAuth();
  const { getVehicleById, updateVehicle, loading } = useVehicles();
  const { t } = useLanguage();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
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
    auto_booking: false,
    features: [] as string[],
    rules: [] as string[],
  });

  const [images, setImages] = useState<string[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [customFeature, setCustomFeature] = useState('');
  const [customRule, setCustomRule] = useState('');

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const loadVehicle = async () => {
    try {
      setLoadingVehicle(true);
      const vehicleData = await getVehicleById(vehicleId);
      
      if (vehicleData) {
        setVehicle(vehicleData);
        
        // Charger les photos depuis vehicle_photos
        const { data: photos } = await supabase
          .from('vehicle_photos')
          .select('*')
          .eq('vehicle_id', vehicleId)
          .order('display_order', { ascending: true });

        const photoUrls = photos && photos.length > 0 
          ? photos.map(p => p.url)
          : (vehicleData.images || []);

        setFormData({
          title: vehicleData.title || '',
          description: vehicleData.description || '',
          vehicle_type: vehicleData.vehicle_type || '',
          brand: vehicleData.brand || '',
          model: vehicleData.model || '',
          year: vehicleData.year?.toString() || '',
          plate_number: vehicleData.plate_number || '',
          seats: vehicleData.seats?.toString() || '5',
          transmission: vehicleData.transmission || '',
          fuel_type: vehicleData.fuel_type || '',
          mileage: vehicleData.mileage?.toString() || '',
          location_id: vehicleData.location_id || '',
          location_name: vehicleData.location?.name || '',
          price_per_day: vehicleData.price_per_day?.toString() || '',
          price_per_week: vehicleData.price_per_week?.toString() || '',
          price_per_month: vehicleData.price_per_month?.toString() || '',
          security_deposit: vehicleData.security_deposit?.toString() || '0',
          minimum_rental_days: vehicleData.minimum_rental_days?.toString() || '1',
          auto_booking: vehicleData.auto_booking || false,
          features: vehicleData.features || [],
          rules: vehicleData.rules || [],
        });
        
        setImages(photoUrls);
      }
    } catch (err) {
      console.error('Erreur lors du chargement du véhicule:', err);
      Alert.alert('Erreur', 'Impossible de charger le véhicule');
    } finally {
      setLoadingVehicle(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de l\'accès à vos photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
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
    if (customFeature.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, customFeature.trim()],
      }));
      setCustomFeature('');
    }
  };

  const addRule = () => {
    if (customRule.trim()) {
      setFormData(prev => ({
        ...prev,
        rules: [...prev.rules, customRule.trim()],
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

  const handleLocationSelect = (location: { id: string; name: string }) => {
    setFormData(prev => ({
      ...prev,
      location_id: location.id,
      location_name: location.name,
    }));
    setShowLocationModal(false);
  };

  const handleSubmit = async () => {
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

    const result = await updateVehicle(vehicleId, {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      vehicle_type: formData.vehicle_type,
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      year: parseInt(formData.year),
      plate_number: formData.plate_number.trim() || null,
      seats: parseInt(formData.seats) || 5,
      transmission: formData.transmission || null,
      fuel_type: formData.fuel_type || null,
      mileage: formData.mileage ? parseInt(formData.mileage) : null,
      location_id: formData.location_id || null,
      price_per_day: parseInt(formData.price_per_day),
      price_per_week: formData.price_per_week ? parseInt(formData.price_per_week) : null,
      price_per_month: formData.price_per_month ? parseInt(formData.price_per_month) : null,
      security_deposit: parseInt(formData.security_deposit) || 0,
      minimum_rental_days: parseInt(formData.minimum_rental_days) || 1,
      auto_booking: formData.auto_booking,
      images: images,
      features: formData.features,
      rules: formData.rules,
    });

    if (result.success) {
      Alert.alert(
        'Succès',
        'Véhicule mis à jour avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      Alert.alert('Erreur', result.error || 'Une erreur est survenue');
    }
  };

  if (loadingVehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
          <Text style={styles.loadingText}>Chargement du véhicule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>Véhicule introuvable</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier le véhicule</Text>
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
            <TextInput
              style={styles.input}
              placeholder="Ex: Toyota"
              value={formData.brand}
              onChangeText={(value) => handleInputChange('brand', value)}
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

          {/* Réservation automatique */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Type de réservation</Text>
            <View style={styles.switchContainer}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Réservation instantanée</Text>
                <Text style={styles.switchDescription}>
                  Si activé, les réservations seront automatiquement confirmées. Sinon, elles nécessiteront votre approbation.
                </Text>
              </View>
              <Switch
                value={formData.auto_booking}
                onValueChange={(value) => setFormData(prev => ({ ...prev, auto_booking: value }))}
                trackColor={{ false: '#e0e0e0', true: '#2E7D32' }}
                thumbColor={formData.auto_booking ? '#fff' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
              <Ionicons name="camera-outline" size={24} color="#2E7D32" />
              <Text style={styles.addPhotoText}>Ajouter des photos</Text>
            </TouchableOpacity>
            {images.length > 0 && (
              <View style={styles.imagesContainer}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
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
            </View>
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.input, styles.customInput]}
                placeholder="Ajouter un équipement personnalisé"
                value={customFeature}
                onChangeText={setCustomFeature}
              />
              <TouchableOpacity style={styles.addButton} onPress={addCustomFeature}>
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
              />
              <TouchableOpacity style={styles.addButton} onPress={addRule}>
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
                <Text style={styles.submitButtonText}>Enregistrer les modifications</Text>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        {showLocationModal && (
          <CitySearchInputModal
            visible={showLocationModal}
            onClose={() => setShowLocationModal(false)}
            onSelect={handleLocationSelect}
            onChange={(result) => {
              if (result) {
                handleLocationSelect(result);
              }
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Utiliser les mêmes styles que AddVehicleScreen
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 12,
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
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
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
    color: '#2c3e50',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    gap: 12,
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
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
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
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32',
  },
  featureText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  featureTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
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
  },
  ruleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    backgroundColor: '#e67e22',
    padding: 16,
    borderRadius: 8,
    margin: 20,
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
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default EditVehicleScreen;

