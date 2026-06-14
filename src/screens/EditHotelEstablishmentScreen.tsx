import React, { useEffect, useState } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useHostHotels } from '../hooks/useHostHotels';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { supabase } from '../services/supabase';
import { HOTEL_COLORS } from '../constants/colors';
import { getHotelGalleryUrls } from '../lib/hotelUtils';
import { HOTEL_ESTABLISHMENT_TYPES } from '../constants/hotelListingForm';
import type { HotelEstablishmentType, RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'EditHotelEstablishment'>;

const ESTABLISHMENT_TYPES = HOTEL_ESTABLISHMENT_TYPES.map(({ value, label }) => ({ value, label }));

const COMMON_AMENITIES = [
  'Wi-Fi',
  'Parking',
  'Piscine',
  'Climatisation',
  'Petit-déjeuner',
  'Restaurant',
  'Ascenseur',
  'Service de chambre',
];

const EditHotelEstablishmentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { establishmentId } = route.params;
  const { user } = useAuth();
  const { getEstablishmentById, updateEstablishment, loading } = useHostHotels();
  const [loadingData, setLoadingData] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    establishment_type: '' as HotelEstablishmentType | '',
    address: '',
    star_rating: '',
    check_in_time: '',
    check_out_time: '',
    house_rules: '',
  });

  useEffect(() => {
    (async () => {
      const est = await getEstablishmentById(establishmentId);
      if (!est) {
        Alert.alert('Erreur', 'Établissement introuvable');
        navigation.goBack();
        return;
      }
      setForm({
        title: est.title,
        description: est.description || '',
        establishment_type: est.establishment_type,
        address: est.address || '',
        star_rating: est.star_rating ? String(est.star_rating) : '',
        check_in_time: est.check_in_time || '14:00',
        check_out_time: est.check_out_time || '11:00',
        house_rules: est.house_rules || '',
      });
      setLocationLabel(est.locations?.name || '');
      setLocationId(est.location_id || null);
      setSelectedAmenities(est.amenities || []);
      setImageUris(getHotelGalleryUrls(est));
      setLoadingData(false);
    })();
  }, [establishmentId, getEstablishmentById, navigation]);

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const uploadImageToStorage = async (uri: string): Promise<string> => {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `hotel/${user?.id || 'anon'}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : 'image/jpeg';
    const { error } = await supabase.storage
      .from('property-images')
      .upload(fileName, new Uint8Array(arrayBuffer), { contentType, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(fileName);
    return publicUrl;
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Accès aux photos nécessaire.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: 20 - imageUris.length,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setImageUris((prev) => [...prev, ...result.assets!.map((a) => a.uri)]);
    }
  };

  const toggleAmenity = (name: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
    );
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Champ requis', 'Saisissez le nom de l\'établissement.');
      return;
    }

    let imageUrls = imageUris;
    const needsUpload = imageUris.some((u) => !u.startsWith('http'));
    if (needsUpload) {
      setUploadingImages(true);
      try {
        imageUrls = [];
        for (const uri of imageUris) {
          imageUrls.push(await uploadImageToStorage(uri));
        }
      } catch {
        setUploadingImages(false);
        Alert.alert('Erreur', 'Impossible d\'envoyer certaines photos.');
        return;
      }
      setUploadingImages(false);
    }

    const starRating = form.star_rating ? parseInt(form.star_rating, 10) : null;
    const result = await updateEstablishment(establishmentId, {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      establishment_type: form.establishment_type || undefined,
      location_id: locationId,
      address: form.address.trim() || locationLabel || undefined,
      star_rating: starRating && starRating >= 1 && starRating <= 5 ? starRating : null,
      amenities: selectedAmenities,
      imageUrls,
      check_in_time: form.check_in_time || undefined,
      check_out_time: form.check_out_time || undefined,
      house_rules: form.house_rules.trim() || undefined,
    });

    if (result.success) {
      Alert.alert('Succès', 'Établissement mis à jour.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('Erreur', result.error);
    }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      </SafeAreaView>
    );
  }

  const typeLabel = ESTABLISHMENT_TYPES.find((t) => t.value === form.establishment_type)?.label;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier l&apos;établissement</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nom *</Text>
          <TextInput style={styles.input} value={form.title} onChangeText={(v) => set('title', v)} />

          <Text style={styles.label}>Type</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTypeModal(true)}>
            <Text style={styles.pickerValue}>{typeLabel}</Text>
            <Ionicons name="chevron-down" size={20} color="#64748b" />
          </TouchableOpacity>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            multiline
          />

          <Text style={styles.label}>Ville / quartier</Text>
          <CitySearchInputModal
            value={locationLabel}
            onChange={(result) => {
              if (result) {
                setLocationLabel(result.name);
                setLocationId(result.id);
              } else {
                setLocationLabel('');
                setLocationId(null);
              }
            }}
          />

          <Text style={styles.label}>Adresse</Text>
          <TextInput style={styles.input} value={form.address} onChangeText={(v) => set('address', v)} />

          <Text style={styles.label}>Équipements</Text>
          <View style={styles.chips}>
            {COMMON_AMENITIES.map((amenity) => {
              const selected = selectedAmenities.includes(amenity);
              return (
                <TouchableOpacity
                  key={amenity}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleAmenity(amenity)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{amenity}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImages}>
            <Ionicons name="camera-outline" size={22} color={HOTEL_COLORS.primary} />
            <Text style={styles.addPhotoText}>Photos</Text>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {imageUris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setImageUris((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={loading || uploadingImages}
          >
            {loading || uploadingImages ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {showTypeModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {ESTABLISHMENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.modalItem}
                onPress={() => {
                  set('establishment_type', type.value);
                  setShowTypeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTypeModal(false)}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerValue: { fontSize: 15, color: '#1e293b' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipSelected: { backgroundColor: HOTEL_COLORS.light, borderColor: HOTEL_COLORS.primary },
  chipText: { fontSize: 13, color: '#64748b' },
  chipTextSelected: { color: HOTEL_COLORS.primary, fontWeight: '600' },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HOTEL_COLORS.primary,
    borderStyle: 'dashed',
  },
  addPhotoText: { color: HOTEL_COLORS.primary, fontWeight: '600' },
  photoRow: { marginTop: 12 },
  photoWrap: { marginRight: 10, position: 'relative' },
  photo: { width: 90, height: 90, borderRadius: 8 },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  saveBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: HOTEL_COLORS.primary,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalItemText: { fontSize: 16 },
  modalCancel: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  modalCancelText: { color: '#64748b', fontWeight: '600' },
});

export default EditHotelEstablishmentScreen;
