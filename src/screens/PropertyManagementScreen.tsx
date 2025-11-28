import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import { Property } from '../hooks/useProperties';
import PhotoCategoryDisplay from '../components/PhotoCategoryDisplay';
import { CategorizedPhoto } from '../types';
import { useMyProperties } from '../hooks/useMyProperties';

type PropertyManagementRouteProp = RouteProp<RootStackParamList, 'PropertyManagement'>;

const { width: screenWidth } = Dimensions.get('window');

const PropertyManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<PropertyManagementRouteProp>();
  const { propertyId } = route.params;

  const { hideProperty, showProperty, deleteProperty } = useMyProperties();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  // État pour la galerie de photos
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          locations:location_id (
            id,
            name,
            type,
            latitude,
            longitude,
            parent_id
          ),
          property_photos (
            id,
            url,
            category,
            display_order,
            created_at
          )
        `)
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      if (data) {
        setProperty(data as Property);
        
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la propriété:', error);
      Alert.alert('Erreur', 'Impossible de charger la propriété');
    } finally {
      setLoading(false);
    }
  };


  const getPropertyPhotos = (): CategorizedPhoto[] => {
    if (!property) return [];
    
    if (property.property_photos && Array.isArray(property.property_photos)) {
      return property.property_photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        category: photo.category || 'autre',
        displayOrder: photo.display_order || 0,
        createdAt: photo.created_at,
      }));
    }
    
    return [];
  };

  const handleToggleVisibility = async () => {
    if (!property) return;

    const action = property.is_active ? 'masquer' : 'afficher';
    const newStatus = !property.is_active;

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} la propriété`,
      `Êtes-vous sûr de vouloir ${action} "${property.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try {
              const result = newStatus ? await showProperty(property.id) : await hideProperty(property.id);
              if (result.success) {
                Alert.alert('Succès', `Propriété ${action}ée avec succès`);
                loadProperty(); // Recharger la propriété
              } else {
                Alert.alert('Erreur', `Impossible de ${action} la propriété`);
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleDeleteProperty = async () => {
    if (!property) return;

    Alert.alert(
      'Supprimer la propriété',
      `Êtes-vous sûr de vouloir supprimer définitivement "${property.title}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteProperty(property.id);
              if (result.success) {
                Alert.alert('Succès', 'Propriété supprimée avec succès');
                navigation.goBack();
              } else {
                Alert.alert('Erreur', 'Impossible de supprimer la propriété');
              }
            } catch (err) {
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  const handleEditProperty = () => {
    navigation.navigate('EditProperty', { propertyId });
  };

  const handleOpenCalendar = () => {
    navigation.navigate('PropertyCalendar', { propertyId });
  };

  const handleOpenPricing = () => {
    navigation.navigate('PropertyPricing', { propertyId } as never);
  };

  const handleOpenRules = () => {
    navigation.navigate('PropertyRules', { propertyId } as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e67e22" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Propriété non trouvée</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = getPropertyPhotos();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{property.title}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Photos */}
        <View style={[styles.section, styles.photosSection]}>
          {photos.length > 0 ? (
            <PhotoCategoryDisplay photos={photos} propertyTitle={property.title} />
          ) : (
            <View style={styles.emptyPhotosContainer}>
              <Ionicons name="images-outline" size={48} color="#ccc" />
              <Text style={styles.emptyPhotosText}>Aucune photo disponible</Text>
            </View>
          )}
        </View>

        {/* Options d'action */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpenCalendar}
          >
            <Ionicons name="calendar-outline" size={20} color="#3498db" />
            <Text style={styles.actionButtonText}>Calendrier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleEditProperty}
          >
            <Ionicons name="create-outline" size={20} color="#f39c12" />
            <Text style={styles.actionButtonText}>Modifier</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleToggleVisibility}
          >
            <Ionicons 
              name={property.is_active ? "eye-off-outline" : "eye-outline"} 
              size={20} 
              color="#3498db" 
            />
            <Text style={styles.actionButtonText}>
              {property.is_active ? 'Masquer' : 'Afficher'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Options d'action - Ligne 2 */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpenPricing}
          >
            <Ionicons name="pricetag-outline" size={20} color="#e67e22" />
            <Text style={styles.actionButtonText}>Tarification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOpenRules}
          >
            <Ionicons name="document-text-outline" size={20} color="#e67e22" />
            <Text style={styles.actionButtonText}>Règlement intérieur</Text>
          </TouchableOpacity>
        </View>

        {/* Option Supprimer */}
        <View style={styles.deleteSection}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteProperty}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Supprimer la propriété</Text>
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
  placeholder: {
    width: 80,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#e67e22',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  photosSection: {
    backgroundColor: '#fff',
    paddingBottom: 0,
  },
  emptyPhotosContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyPhotosText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
  deleteSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#e74c3c',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  optionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  optionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  optionContent: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
});

export default PropertyManagementScreen;

