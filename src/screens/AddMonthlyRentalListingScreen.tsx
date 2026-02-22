import React, { useState } from 'react';
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
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useMonthlyRentalListings } from '../hooks/useMonthlyRentalListings';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { supabase } from '../services/supabase';

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
];

const AddMonthlyRentalListingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { createListing, loading } = useMonthlyRentalListings(user?.id);
  const [showPropertyTypeModal, setShowPropertyTypeModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    property_type: '',
    surface_m2: '',
    number_of_rooms: '',
    bedrooms: '',
    bathrooms: '',
    is_furnished: false,
    monthly_rent_price: '',
    security_deposit: '',
    minimum_duration_months: '1',
    charges_included: false,
    address_details: '',
  });
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const set = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const uploadImageToStorage = async (uri: string): Promise<string> => {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `monthly-rental/${user?.id || 'anon'}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : 'image/jpeg';
    const { error } = await supabase.storage.from('property-images').upload(fileName, new Uint8Array(arrayBuffer), { contentType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(fileName);
    return publicUrl;
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de l\'accès à vos photos.');
      return;
    }
    const limit = 30 - imageUris.length;
    if (limit <= 0) {
      Alert.alert('Limite', 'Vous pouvez ajouter jusqu\'à 30 photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setImageUris((prev) => [...prev, ...result.assets!.map((a) => a.uri)]);
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const surface = parseInt(form.surface_m2, 10);
    const rooms = parseInt(form.number_of_rooms, 10);
    const beds = parseInt(form.bedrooms, 10);
    const baths = parseInt(form.bathrooms, 10);
    const rent = parseInt(form.monthly_rent_price, 10);
    if (!form.title.trim()) {
      Alert.alert('Champ requis', 'Saisissez un titre.');
      return;
    }
    if (!form.location.trim()) {
      Alert.alert('Champ requis', 'Saisissez une localisation.');
      return;
    }
    if (isNaN(surface) || surface < 1) {
      Alert.alert('Surface invalide', 'Surface habitable au moins 1 m².');
      return;
    }
    if (isNaN(rooms) || rooms < 1 || isNaN(beds) || beds < 1 || isNaN(baths) || baths < 1) {
      Alert.alert('Champs invalides', 'Pièces, chambres et salles de bain au moins 1.');
      return;
    }
    if (isNaN(rent) || rent < 10000) {
      Alert.alert('Loyer invalide', 'Loyer mensuel au moins 10 000 FCFA.');
      return;
    }

    let imageUrls: string[] = [];
    if (imageUris.length > 0) {
      setUploadingImages(true);
      try {
        for (const uri of imageUris) {
          const url = await uploadImageToStorage(uri);
          imageUrls.push(url);
        }
      } catch (e) {
        setUploadingImages(false);
        Alert.alert('Erreur', 'Impossible d\'envoyer certaines photos. Réessayez.');
        return;
      }
      setUploadingImages(false);
    }

    const result = await createListing({
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim(),
      property_type: form.property_type || null,
      surface_m2: surface,
      number_of_rooms: rooms,
      bedrooms: beds,
      bathrooms: baths,
      is_furnished: form.is_furnished,
      monthly_rent_price: rent,
      security_deposit: form.security_deposit ? parseInt(form.security_deposit, 10) : null,
      minimum_duration_months: form.minimum_duration_months ? parseInt(form.minimum_duration_months, 10) : null,
      charges_included: form.charges_included,
      address_details: form.address_details.trim() || null,
      images: imageUrls,
      amenities: [],
      status: 'draft',
    });

    if (result.success) {
      Alert.alert(
        'Succès',
        'Logement enregistré en brouillon. Passez en mode logement longue durée pour le gérer (soumettre, modifier, candidatures).',
        [
          {
            text: 'Mode logement longue durée',
            onPress: () => {
              navigation.navigate('ModeTransition' as never, {
                targetMode: 'monthly_rental',
                targetPath: 'MonthlyRentalOwnerSpace',
                fromMode: 'traveler',
              });
            },
          },
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d\'ajouter le logement.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter un logement</Text>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.block}>
            <Text style={styles.label}>Titre *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => set('title', v)}
              placeholder="Ex: Appartement 3 pièces centre-ville"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Localisation *</Text>
            <CitySearchInputModal
              value={typeof form.location === 'string' ? form.location : ''}
              onChange={(result) => set('location', result?.name ?? '')}
              placeholder="Ville, commune ou quartier..."
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Type de bien</Text>
            <TouchableOpacity style={styles.select} onPress={() => setShowPropertyTypeModal(true)}>
              <Text style={styles.selectText}>
                {PROPERTY_TYPES.find((t) => t.value === form.property_type)?.label || 'Choisir'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <View style={[styles.block, styles.half]}>
              <Text style={styles.label}>Surface (m²) *</Text>
              <TextInput
                style={styles.input}
                value={form.surface_m2}
                onChangeText={(v) => set('surface_m2', v)}
                placeholder="45"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
            <View style={[styles.block, styles.half]}>
              <Text style={styles.label}>Nombre de pièces *</Text>
              <TextInput
                style={styles.input}
                value={form.number_of_rooms}
                onChangeText={(v) => set('number_of_rooms', v)}
                placeholder="3"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.block, styles.half]}>
              <Text style={styles.label}>Chambres *</Text>
              <TextInput
                style={styles.input}
                value={form.bedrooms}
                onChangeText={(v) => set('bedrooms', v)}
                placeholder="2"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
            <View style={[styles.block, styles.half]}>
              <Text style={styles.label}>Salles de bain *</Text>
              <TextInput
                style={styles.input}
                value={form.bathrooms}
                onChangeText={(v) => set('bathrooms', v)}
                placeholder="1"
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          <View style={[styles.block, styles.switchRow]}>
            <Text style={styles.label}>Meublé</Text>
            <Switch
              value={form.is_furnished}
              onValueChange={(v) => set('is_furnished', v)}
              trackColor={{ false: '#e5e7eb', true: '#2E7D32' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Photos</Text>
            <Text style={styles.helpText}>Ajoutez au moins une photo du logement (max. 30).</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
              {imageUris.map((uri, index) => (
                <View key={index} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={24} color="#e74c3c" />
                  </TouchableOpacity>
                </View>
              ))}
              {imageUris.length < 30 && (
                <TouchableOpacity style={styles.photoAdd} onPress={pickImages}>
                  <Ionicons name="add" size={32} color="#666" />
                  <Text style={styles.photoAddText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              placeholder="Décrivez le logement..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Loyer mensuel (FCFA) *</Text>
            <TextInput
              style={styles.input}
              value={form.monthly_rent_price}
              onChangeText={(v) => set('monthly_rent_price', v)}
              placeholder="150000"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Caution (FCFA)</Text>
            <TextInput
              style={styles.input}
              value={form.security_deposit}
              onChangeText={(v) => set('security_deposit', v)}
              placeholder="Optionnel"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Durée minimale (mois)</Text>
            <TextInput
              style={styles.input}
              value={form.minimum_duration_months}
              onChangeText={(v) => set('minimum_duration_months', v)}
              placeholder="1"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>
          <View style={[styles.block, styles.switchRow]}>
            <Text style={styles.label}>Charges comprises</Text>
            <Switch
              value={form.charges_included}
              onValueChange={(v) => set('charges_included', v)}
              trackColor={{ false: '#e5e7eb', true: '#2E7D32' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>Adresse / accès</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.address_details}
              onChangeText={(v) => set('address_details', v)}
              placeholder="Étage, digicode..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={2}
            />
          </View>
          <TouchableOpacity
            style={[styles.submit, (loading || uploadingImages) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading || uploadingImages}
          >
            {loading || uploadingImages ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Enregistrer le logement</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {showPropertyTypeModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Type de bien</Text>
            {PROPERTY_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={styles.modalItem}
                onPress={() => {
                  set('property_type', t.value);
                  setShowPropertyTypeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{t.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPropertyTypeModal(false)}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginLeft: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  block: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectText: { fontSize: 16, color: '#333' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helpText: { fontSize: 12, color: '#666', marginBottom: 8 },
  photosRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  photoWrap: { position: 'relative' },
  photoThumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#eee' },
  photoRemove: { position: 'absolute', top: -4, right: -4 },
  photoAdd: {
    width: 88,
    height: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAddText: { fontSize: 12, color: '#666', marginTop: 4 },
  submit: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalItemText: { fontSize: 16, color: '#333' },
  modalCancel: { marginTop: 16, paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { fontSize: 16, color: '#666' },
});

export default AddMonthlyRentalListingScreen;
