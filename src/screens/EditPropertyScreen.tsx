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
  Switch,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useProperties } from '../hooks/useProperties';
import { useAuth } from '../services/AuthContext';
import { Property, CategorizedPhoto } from '../types';
import { supabase } from '../services/supabase';

type EditPropertyRouteParams = {
  propertyId: string;
};

const EditPropertyScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ EditProperty: EditPropertyRouteParams }, 'EditProperty'>>();
  const { propertyId } = route.params;
  const { user } = useAuth();
  const { getPropertyById } = useProperties();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // États du formulaire
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price_per_night: '',
    max_guests: '',
    bedrooms: '',
    bathrooms: '',
    property_type: 'apartment',
    cleaning_fee: '',
    service_fee: '',
    minimum_nights: '',
    auto_booking: false,
    discount_enabled: false,
    discount_min_nights: '',
    discount_percentage: '',
  });

  const propertyTypes = [
    { value: 'apartment', label: 'Appartement' },
    { value: 'house', label: 'Maison' },
    { value: 'villa', label: 'Villa' },
    { value: 'eco_lodge', label: 'Éco-lodge' },
    { value: 'other', label: 'Autre' },
  ];

  // États pour la gestion des photos
  const [photos, setPhotos] = useState<CategorizedPhoto[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      setLoading(true);
      const propertyData = await getPropertyById(propertyId);
      
      if (propertyData) {
        setProperty(propertyData);
        setFormData({
          title: propertyData.title || '',
          description: propertyData.description || '',
          price_per_night: propertyData.price_per_night?.toString() || '',
          max_guests: propertyData.max_guests?.toString() || '',
          bedrooms: propertyData.bedrooms?.toString() || '',
          bathrooms: propertyData.bathrooms?.toString() || '',
          property_type: propertyData.property_type || 'apartment',
          cleaning_fee: propertyData.cleaning_fee?.toString() || '',
          service_fee: propertyData.service_fee?.toString() || '',
          minimum_nights: propertyData.minimum_nights?.toString() || '',
          auto_booking: propertyData.auto_booking || false,
          discount_enabled: propertyData.discount_enabled || false,
          discount_min_nights: propertyData.discount_min_nights?.toString() || '',
          discount_percentage: propertyData.discount_percentage?.toString() || '',
        });

        // Charger les photos
        if (propertyData.photos && propertyData.photos.length > 0) {
          setPhotos(propertyData.photos);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la propriété:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la propriété');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validation des champs obligatoires
      if (!formData.title.trim()) {
        Alert.alert('Erreur', 'Le titre est obligatoire');
        return;
      }

      if (!formData.price_per_night || isNaN(Number(formData.price_per_night))) {
        Alert.alert('Erreur', 'Le prix par nuit doit être un nombre valide');
        return;
      }

      // Préparer les données pour la mise à jour
      const updateData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price_per_night: Number(formData.price_per_night),
        max_guests: formData.max_guests ? Number(formData.max_guests) : null,
        bedrooms: formData.bedrooms ? Number(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
        property_type: formData.property_type,
        cleaning_fee: formData.cleaning_fee ? Number(formData.cleaning_fee) : null,
        service_fee: formData.service_fee ? Number(formData.service_fee) : null,
        minimum_nights: formData.minimum_nights ? Number(formData.minimum_nights) : null,
        auto_booking: formData.auto_booking,
        discount_enabled: formData.discount_enabled,
        discount_min_nights: formData.discount_min_nights ? Number(formData.discount_min_nights) : null,
        discount_percentage: formData.discount_percentage ? Number(formData.discount_percentage) : null,
        updated_at: new Date().toISOString(),
      };

      // Mettre à jour la propriété
      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', propertyId);

      if (error) {
        throw error;
      }

      // Supprimer les anciennes photos
      await supabase
        .from('property_photos')
        .delete()
        .eq('property_id', propertyId);

      // Ajouter les nouvelles photos
      if (photos.length > 0) {
        const photosToInsert = photos.map((photo, index) => ({
          property_id: propertyId,
          url: photo.url,
          category: photo.category,
          display_order: index,
        }));

        const { error: photosError } = await supabase
          .from('property_photos')
          .insert(photosToInsert);

        if (photosError) {
          console.error('Erreur lors de la sauvegarde des photos:', photosError);
        }

        // Mettre à jour l'array images dans properties
        const imageUrls = photos.map(p => p.url);
        await supabase
          .from('properties')
          .update({ images: imageUrls })
          .eq('id', propertyId);
      }

      Alert.alert(
        'Succès',
        'Propriété mise à jour avec succès',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Fonctions pour gérer les photos
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
      const newPhotos = result.assets.map((asset, index) => ({
        id: `temp-${Date.now()}-${index}`,
        property_id: propertyId,
        url: asset.uri,
        category: 'autre' as const,
        display_order: photos.length + index,
        created_at: new Date().toISOString(),
      }));
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const removeImage = (index: number) => {
    Alert.alert(
      'Supprimer la photo',
      'Êtes-vous sûr de vouloir supprimer cette photo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const newPhotos = photos.filter((_, i) => i !== index);
            setPhotos(newPhotos);
          },
        },
      ]
    );
  };

  const openCategoryModal = (index: number) => {
    setCurrentPhotoIndex(index);
    setShowCategoryModal(true);
  };

  const selectCategory = (category: string) => {
    const newPhotos = [...photos];
    if (newPhotos[currentPhotoIndex]) {
      newPhotos[currentPhotoIndex] = {
        ...newPhotos[currentPhotoIndex],
        category: category as CategorizedPhoto['category'],
      };
      setPhotos(newPhotos);
    }
    setShowCategoryModal(false);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'chambre': '🛏️ Chambre',
      'salle_de_bain': '🚿 Salle de bain',
      'cuisine': '🍳 Cuisine',
      'jardin': '🌳 Jardin',
      'salon': '🛋️ Salon',
      'exterieur': '🏡 Extérieur',
      'terrasse': '☀️ Terrasse',
      'balcon': '🪴 Balcon',
      'autre': '📷 Autre',
    };
    return labels[category] || '📷 Autre';
  };

  const renderPhotosSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Photos de la propriété</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
        {photos.map((photo, index) => (
          <View key={photo.id || index} style={styles.photoContainer}>
            <Image source={{ uri: photo.url }} style={styles.photo} />
            
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => removeImage(index)}
            >
              <Ionicons name="close-circle" size={24} color="#ff4444" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.categoryButton}
              onPress={() => openCategoryModal(index)}
            >
              <Text style={styles.categoryText}>
                {getCategoryLabel(photo.category)}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        
        {photos.length < 30 && (
          <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
            <Ionicons name="add" size={40} color="#999" />
            <Text style={styles.addPhotoButtonText}>Ajouter</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal de sélection de catégorie */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir une catégorie</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView>
              {[
                { value: 'chambre', label: '🛏️ Chambre' },
                { value: 'salle_de_bain', label: '🚿 Salle de bain' },
                { value: 'cuisine', label: '🍳 Cuisine' },
                { value: 'jardin', label: '🌳 Jardin' },
                { value: 'salon', label: '🛋️ Salon' },
                { value: 'exterieur', label: '🏡 Extérieur' },
                { value: 'terrasse', label: '☀️ Terrasse' },
                { value: 'balcon', label: '🪴 Balcon' },
                { value: 'autre', label: '📷 Autre' },
              ].map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={styles.categoryOption}
                  onPress={() => selectCategory(category.value)}
                >
                  <Text style={styles.categoryOptionText}>{category.label}</Text>
                  {photos[currentPhotoIndex]?.category === category.value && (
                    <Ionicons name="checkmark" size={24} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderInputField = (
    label: string,
    field: string,
    value: string,
    placeholder: string,
    keyboardType: 'default' | 'numeric' = 'default',
    multiline: boolean = false
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={(text) => handleInputChange(field, text)}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );

  const renderSwitchField = (
    label: string,
    field: string,
    value: boolean,
    description?: string
  ) => (
    <View style={styles.switchGroup}>
      <View style={styles.switchHeader}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Switch
          value={value}
          onValueChange={(newValue) => handleInputChange(field, newValue)}
          trackColor={{ false: '#e0e0e0', true: '#2E7D32' }}
          thumbColor={value ? '#fff' : '#f4f3f4'}
        />
      </View>
      {description && (
        <Text style={styles.switchDescription}>{description}</Text>
      )}
    </View>
  );

  const renderSelectField = (
    label: string,
    field: string,
    value: string,
    options: { value: string; label: string }[]
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.selectContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.selectOption,
              value === option.value && styles.selectOptionActive,
            ]}
            onPress={() => handleInputChange(field, option.value)}
          >
            <Text
              style={[
                styles.selectOptionText,
                value === option.value && styles.selectOptionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement de la propriété...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Ionicons name="home-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Propriété non trouvée</Text>
          <Text style={styles.emptySubtitle}>
            Cette propriété n'existe pas ou vous n'avez pas les permissions pour la modifier.
          </Text>
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier la propriété</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.saveButton}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#2E7D32" />
          ) : (
            <Text style={styles.saveButtonText}>Sauvegarder</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Informations de base */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations de base</Text>
          
          {renderInputField(
            'Titre *',
            'title',
            formData.title,
            'Titre de votre propriété'
          )}
          
          {renderInputField(
            'Description',
            'description',
            formData.description,
            'Décrivez votre propriété',
            'default',
            true
          )}
          
          {renderSelectField(
            'Type de propriété',
            'property_type',
            formData.property_type,
            propertyTypes
          )}
        </View>

        {/* Photos */}
        {renderPhotosSection()}

        {/* Capacité et équipements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capacité et équipements</Text>
          
          {renderInputField(
            'Capacité maximale',
            'max_guests',
            formData.max_guests,
            'Nombre de voyageurs',
            'numeric'
          )}
          
          {renderInputField(
            'Nombre de chambres',
            'bedrooms',
            formData.bedrooms,
            'Nombre de chambres',
            'numeric'
          )}
          
          {renderInputField(
            'Nombre de salles de bain',
            'bathrooms',
            formData.bathrooms,
            'Nombre de salles de bain',
            'numeric'
          )}
        </View>

        {/* Tarification */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarification</Text>
          
          {renderInputField(
            'Prix par nuit (XOF) *',
            'price_per_night',
            formData.price_per_night,
            'Prix par nuit en francs CFA',
            'numeric'
          )}
          
          {renderInputField(
            'Frais de ménage (XOF)',
            'cleaning_fee',
            formData.cleaning_fee,
            'Frais de ménage',
            'numeric'
          )}
          
          {renderInputField(
            'Frais de service (XOF)',
            'service_fee',
            formData.service_fee,
            'Frais de service',
            'numeric'
          )}
          
          {renderInputField(
            'Nuitées minimum',
            'minimum_nights',
            formData.minimum_nights,
            'Nombre de nuits minimum',
            'numeric'
          )}
        </View>

        {/* Réductions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Réductions</Text>
          
          {renderSwitchField(
            'Activer les réductions',
            'discount_enabled',
            formData.discount_enabled,
            'Proposer des réductions pour les séjours longs'
          )}
          
          {formData.discount_enabled && (
            <>
              {renderInputField(
                'Nuitées minimum pour réduction',
                'discount_min_nights',
                formData.discount_min_nights,
                'Nombre de nuits minimum',
                'numeric'
              )}
              
              {renderInputField(
                'Pourcentage de réduction',
                'discount_percentage',
                formData.discount_percentage,
                'Pourcentage de réduction (%)',
                'numeric'
              )}
            </>
          )}
        </View>

        {/* Paramètres de réservation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres de réservation</Text>
          
          {renderSwitchField(
            'Réservation automatique',
            'auto_booking',
            formData.auto_booking,
            'Accepter automatiquement les réservations sans validation manuelle'
          )}
        </View>

        {/* Bouton de sauvegarde */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={[styles.saveButtonLarge, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonLargeText}>Sauvegarder les modifications</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 20,
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
  headerButton: {
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
    borderRadius: 6,
    backgroundColor: '#2E7D32',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  switchGroup: {
    marginBottom: 20,
  },
  switchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectOptionActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectOptionTextActive: {
    color: '#fff',
  },
  saveSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonLargeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Styles pour les photos
  photoScroll: {
    flexGrow: 0,
  },
  photoContainer: {
    width: 120,
    height: 120,
    marginRight: 10,
    borderRadius: 8,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  categoryButton: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoButtonText: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});

export default EditPropertyScreen;


