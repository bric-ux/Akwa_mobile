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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useHostHotels } from '../hooks/useHostHotels';
import HotelMediaPickerRow from '../components/HotelMediaPickerRow';
import HotelRoomDiscountFields, {
  emptyHotelRoomDiscounts,
  hotelRoomDiscountsFromRoom,
  parseHotelRoomDiscounts,
  type HotelRoomDiscountValues,
} from '../components/HotelRoomDiscountFields';
import { uploadPropertyMediaToStorage } from '../lib/uploadPropertyMedia';
import { MAX_HOTEL_ROOM_MEDIA, MAX_HOTEL_ROOM_VIDEOS } from '../constants/hotelMedia';
import { HOTEL_COLORS } from '../constants/colors';
import {
  HOTEL_ROOM_AMENITIES,
  HOTEL_ROOM_CATEGORIES,
  type HotelRoomCategory,
} from '../constants/hotelListingForm';
import type { RootStackParamList } from '../types';

type AddRoute = RouteProp<RootStackParamList, 'AddHotelRoomType'>;
type EditRoute = RouteProp<RootStackParamList, 'EditHotelRoomType'>;

interface Props {
  mode: 'add' | 'edit';
}

const HotelRoomTypeFormScreen: React.FC<Props> = ({ mode }) => {
  const navigation = useNavigation<any>();
  const route = useRoute<AddRoute | EditRoute>();
  const { establishmentId } = route.params;
  const roomTypeId = mode === 'edit' ? (route.params as EditRoute['params']).roomTypeId : undefined;
  const { user } = useAuth();
  const { createRoomType, updateRoomType, getRoomTypeById, loading } = useHostHotels();
  const [loadingData, setLoadingData] = useState(mode === 'edit');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [roomCategory, setRoomCategory] = useState<HotelRoomCategory>('standard');
  const [roomAmenities, setRoomAmenities] = useState<string[]>([]);
  const [discounts, setDiscounts] = useState<HotelRoomDiscountValues>(emptyHotelRoomDiscounts());
  const [form, setForm] = useState({
    name: '',
    description: '',
    max_guests: '2',
    bedrooms: '1',
    bathrooms: '1',
    price_per_night: '',
    cleaning_fee: '0',
    inventory_count: '1',
    minimum_nights: '1',
  });

  useEffect(() => {
    if (mode !== 'edit' || !roomTypeId) return;
    (async () => {
      const rt = await getRoomTypeById(roomTypeId, establishmentId);
      if (!rt) {
        Alert.alert('Erreur', 'Type de chambre introuvable');
        navigation.goBack();
        return;
      }
      setForm({
        name: rt.name,
        description: rt.description || '',
        max_guests: String(rt.max_guests),
        bedrooms: String(rt.bedrooms),
        bathrooms: String(rt.bathrooms),
        price_per_night: String(rt.price_per_night),
        cleaning_fee: String(rt.cleaning_fee ?? 0),
        inventory_count: String(rt.inventory_count),
        minimum_nights: String(rt.minimum_nights ?? 1),
      });
      setImageUris(rt.images || []);
      setRoomCategory((rt.room_category as HotelRoomCategory) || 'standard');
      setRoomAmenities(rt.amenities || []);
      setDiscounts(hotelRoomDiscountsFromRoom(rt));
      setIsActive(rt.status === 'active');
      setLoadingData(false);
    })();
  }, [mode, roomTypeId, establishmentId, getRoomTypeById, navigation]);

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateAndParse = () => {
    if (!form.name.trim()) {
      Alert.alert('Champ requis', 'Nom du type de chambre.');
      return null;
    }
    const maxGuests = parseInt(form.max_guests, 10);
    const bedrooms = parseInt(form.bedrooms, 10);
    const bathrooms = parseInt(form.bathrooms, 10);
    const price = parseInt(form.price_per_night, 10);
    const cleaningFee = parseInt(form.cleaning_fee, 10) || 0;
    const inventory = parseInt(form.inventory_count, 10);
    const minNights = parseInt(form.minimum_nights, 10) || 1;

    if (isNaN(maxGuests) || maxGuests < 1) {
      Alert.alert('Valeur invalide', 'Capacité minimum 1 personne.');
      return null;
    }
    if (isNaN(price) || price < 1000) {
      Alert.alert('Prix invalide', 'Prix par nuit minimum 1 000 FCFA.');
      return null;
    }
    if (isNaN(inventory) || inventory < 1) {
      Alert.alert('Inventaire invalide', 'Nombre d\'unités minimum 1.');
      return null;
    }

    return {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      max_guests: maxGuests,
      bedrooms: bedrooms >= 1 ? bedrooms : 1,
      bathrooms: bathrooms >= 1 ? bathrooms : 1,
      price_per_night: price,
      cleaning_fee: cleaningFee,
      inventory_count: inventory,
      minimum_nights: minNights,
      status: (isActive ? 'active' : 'hidden') as 'active' | 'hidden',
    };
  };

  const handleSubmit = async () => {
    const parsed = validateAndParse();
    if (!parsed) return;

    const discountPayload = parseHotelRoomDiscounts(discounts);
    if (discounts.discount_enabled && (!discountPayload.discount_min_nights || discountPayload.discount_percentage == null)) {
      Alert.alert('Réduction', 'Indiquez le nombre de nuits minimum et le pourcentage.');
      return;
    }
    if (
      discounts.long_stay_discount_enabled &&
      (!discountPayload.long_stay_discount_min_nights || discountPayload.long_stay_discount_percentage == null)
    ) {
      Alert.alert('Réduction long séjour', 'Indiquez le nombre de nuits minimum et le pourcentage.');
      return;
    }

    let imageUrls = imageUris;
    const needsUpload = imageUris.some((u) => !u.startsWith('http'));
    if (needsUpload) {
      setUploadingImages(true);
      try {
        imageUrls = [];
        for (const uri of imageUris) {
          imageUrls.push(await uploadPropertyMediaToStorage(uri));
        }
      } catch {
        setUploadingImages(false);
        Alert.alert('Erreur', 'Impossible d\'envoyer certains médias.');
        return;
      }
      setUploadingImages(false);
    }

    if (mode === 'add') {
      const result = await createRoomType({
        establishment_id: establishmentId,
        ...parsed,
        ...discountPayload,
        room_category: roomCategory,
        amenities: roomAmenities,
        imageUrls,
      });
      if (result.success) {
        Alert.alert('Succès', 'Type de chambre ajouté.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Erreur', result.error);
      }
    } else if (roomTypeId) {
      const result = await updateRoomType(roomTypeId, establishmentId, {
        ...parsed,
        ...discountPayload,
        room_category: roomCategory,
        amenities: roomAmenities,
        imageUrls,
      });
      if (result.success) {
        Alert.alert('Succès', 'Type de chambre mis à jour.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Erreur', result.error);
      }
    }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'add' ? 'Nouveau type de chambre' : 'Modifier la chambre'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Catégorie *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
            {HOTEL_ROOM_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.catChip, roomCategory === cat.value && styles.catChipSelected]}
                onPress={() => setRoomCategory(cat.value)}
              >
                <Text
                  style={[
                    styles.catChipText,
                    roomCategory === cat.value && styles.catChipTextSelected,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Nom *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="Ex. Chambre Standard, Suite Deluxe"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            multiline
          />

          <View style={styles.row}>
            <View style={styles.third}>
              <Text style={styles.label}>Pers.</Text>
              <TextInput
                style={styles.input}
                value={form.max_guests}
                onChangeText={(v) => set('max_guests', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.third}>
              <Text style={styles.label}>Chambres</Text>
              <TextInput
                style={styles.input}
                value={form.bedrooms}
                onChangeText={(v) => set('bedrooms', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.third}>
              <Text style={styles.label}>Sdb</Text>
              <TextInput
                style={styles.input}
                value={form.bathrooms}
                onChangeText={(v) => set('bathrooms', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.label}>Prix par nuit (FCFA) *</Text>
          <TextInput
            style={styles.input}
            value={form.price_per_night}
            onChangeText={(v) => set('price_per_night', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Frais ménage</Text>
              <TextInput
                style={styles.input}
                value={form.cleaning_fee}
                onChangeText={(v) => set('cleaning_fee', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Unités (stock) *</Text>
              <TextInput
                style={styles.input}
                value={form.inventory_count}
                onChangeText={(v) => set('inventory_count', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.label}>Nuits minimum</Text>
          <TextInput
            style={styles.input}
            value={form.minimum_nights}
            onChangeText={(v) => set('minimum_nights', v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Équipements de la chambre</Text>
          <View style={styles.chips}>
            {HOTEL_ROOM_AMENITIES.map((amenity) => {
              const selected = roomAmenities.includes(amenity);
              return (
                <TouchableOpacity
                  key={amenity}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() =>
                    setRoomAmenities((prev) =>
                      prev.includes(amenity)
                        ? prev.filter((a) => a !== amenity)
                        : [...prev, amenity],
                    )
                  }
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {amenity}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mode === 'edit' && (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Chambre active</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ true: HOTEL_COLORS.primary }}
              />
            </View>
          )}

          <HotelRoomDiscountFields values={discounts} onChange={setDiscounts} />

          <HotelMediaPickerRow
            label="Photos et vidéos de la chambre"
            mediaUris={imageUris}
            onChange={setImageUris}
            maxTotal={MAX_HOTEL_ROOM_MEDIA}
            maxVideos={MAX_HOTEL_ROOM_VIDEOS}
          />

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading || uploadingImages}
          >
            {loading || uploadingImages ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'add' ? 'Ajouter' : 'Enregistrer'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const AddHotelRoomTypeScreen: React.FC = () => (
  <HotelRoomTypeFormScreen mode="add" />
);

export const EditHotelRoomTypeScreen: React.FC = () => (
  <HotelRoomTypeFormScreen mode="edit" />
);

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
  content: { padding: 16, paddingBottom: 40 },
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  third: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: HOTEL_COLORS.primary,
    borderStyle: 'dashed',
  },
  addPhotoText: { color: HOTEL_COLORS.primary, fontWeight: '600' },
  photoWrap: { marginRight: 10, marginTop: 10, position: 'relative' },
  photo: { width: 80, height: 80, borderRadius: 8 },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  submitBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: HOTEL_COLORS.primary,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700' },
  catRow: { marginBottom: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catChipSelected: { backgroundColor: HOTEL_COLORS.light, borderColor: HOTEL_COLORS.primary },
  catChipText: { fontSize: 13, color: '#64748b' },
  catChipTextSelected: { color: HOTEL_COLORS.primary, fontWeight: '700' },
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
});

export default AddHotelRoomTypeScreen;
