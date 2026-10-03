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
import PropertyLocationPicker, {
  type PropertyLocationPickerValue,
} from '../components/PropertyLocationPicker';
import { isLocationUuid, matchLocationNearCoords } from '../lib/geolocation';
import { supabase } from '../services/supabase';
import {
  MONTHLY_RENTAL_DOCUMENT_OPTIONS,
} from '../constants/monthlyRentalDocuments';
import { MONTHLY_FURNITURE_OPTIONS } from '../constants/monthlyFurniture';
import { MONTHLY_FURNISHED_OPTIONS } from '../constants/monthlyFurnished';
import { useLanguage } from '../contexts/LanguageContext';

const AddMonthlyRentalListingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { createListing, submitForApproval, loading } = useMonthlyRentalListings(user?.id);
  const PROPERTY_TYPES = [
    { value: 'apartment', label: t('monthlyHost.typeApartment') },
    { value: 'house', label: t('monthlyHost.typeHouse') },
    { value: 'villa', label: t('monthlyHost.typeVilla') },
    { value: 'studio', label: t('monthlyHost.typeStudio') },
  ];
  const [showPropertyTypeModal, setShowPropertyTypeModal] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [preciseLocation, setPreciseLocation] = useState<PropertyLocationPickerValue>({
    coords: null,
    locationLabel: '',
    matchedLocation: null,
  });
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    property_type: '',
    surface_m2: '',
    number_of_rooms: '',
    bedrooms: '',
    bathrooms: '',
    toilets: '',
    is_furnished: false,
    monthly_rent_price: '',
    deposit_months: '',
    advance_months: '',
    minimum_duration_months: '1',
    charges_included: false,
    address_details: '',
  });
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);

  const set = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleRequiredDoc = (id: string) => {
    setRequiredDocuments((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const toggleAmenity = (id: string) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const setFurnished = (value: boolean) => {
    set('is_furnished', value);
    if (!value) setAmenities([]);
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
      Alert.alert(t('monthlyHost.permissionRequired'), t('monthlyHost.permissionPhotos'));
      return;
    }
    const limit = 30 - imageUris.length;
    if (limit <= 0) {
      Alert.alert(t('monthlyHost.photoLimit'), t('monthlyHost.photoLimitDesc'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
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

  const goMonthlySpace = () => {
    navigation.navigate('ModeTransition' as never, {
      targetMode: 'monthly_rental',
      targetPath: 'MonthlyRentalOwnerSpace',
      fromMode: 'traveler',
    });
  };

  const buildListingInput = async (requireFullValidation: boolean) => {
    const surface = parseInt(form.surface_m2, 10);
    const rooms = parseInt(form.number_of_rooms, 10);
    const beds = parseInt(form.bedrooms, 10);
    const baths = parseInt(form.bathrooms, 10);
    const rent = parseInt(form.monthly_rent_price, 10);
    if (!form.title.trim()) {
      Alert.alert(t('monthlyHost.fieldRequired'), t('monthlyHost.titleRequired'));
      return null;
    }
    if (requireFullValidation) {
      if (!form.location.trim()) {
        Alert.alert(t('monthlyHost.fieldRequired'), t('monthlyHost.locationRequired'));
        return null;
      }
      if (isNaN(surface) || surface < 1) {
        Alert.alert(t('monthlyHost.surfaceInvalid'), t('monthlyHost.surfaceInvalidDesc'));
        return null;
      }
      if (isNaN(rooms) || rooms < 1 || isNaN(beds) || beds < 1 || isNaN(baths) || baths < 1) {
        Alert.alert(t('monthlyHost.fieldsInvalid'), t('monthlyHost.roomsInvalidDesc'));
        return null;
      }
      if (isNaN(rent) || rent < 10000) {
        Alert.alert(t('monthlyHost.rentInvalid'), t('monthlyHost.rentInvalidDesc'));
        return null;
      }
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
        Alert.alert(t('common.error'), t('monthlyHost.photosError'));
        return null;
      }
      setUploadingImages(false);
    }

    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || t('monthlyHost.locationFallback'),
      location_id: locationId,
      latitude: preciseLocation.coords?.latitude ?? null,
      longitude: preciseLocation.coords?.longitude ?? null,
      property_type: form.property_type || null,
      surface_m2: Number.isFinite(surface) && surface > 0 ? surface : 1,
      number_of_rooms: Number.isFinite(rooms) && rooms > 0 ? rooms : 1,
      bedrooms: Number.isFinite(beds) && beds > 0 ? beds : 1,
      bathrooms: Number.isFinite(baths) && baths > 0 ? baths : 1,
      toilets: form.toilets.trim() ? parseInt(form.toilets, 10) : null,
      is_furnished: form.is_furnished,
      monthly_rent_price: Number.isFinite(rent) && rent > 0 ? rent : 10000,
      deposit_months: form.deposit_months.trim()
        ? parseInt(form.deposit_months, 10)
        : null,
      advance_months: form.advance_months.trim()
        ? parseInt(form.advance_months, 10)
        : null,
      minimum_duration_months: form.minimum_duration_months
        ? parseInt(form.minimum_duration_months, 10)
        : null,
      charges_included: form.charges_included,
      address_details: form.address_details.trim() || null,
      images: imageUrls,
      amenities: form.is_furnished ? amenities : [],
      required_documents: requiredDocuments,
      status: 'draft' as const,
    };
  };

  const handleSaveDraft = async () => {
    const input = await buildListingInput(false);
    if (!input) return;
    const result = await createListing(input);
    if (!result.success || !result.id) {
      Alert.alert(t('common.error'), result.error || t('monthlyHost.draftError'));
      return;
    }
    Alert.alert(t('monthlyHost.draftSaved'), t('monthlyHost.draftSavedDesc'));
    goMonthlySpace();
  };

  const handleSubmit = async () => {
    const input = await buildListingInput(true);
    if (!input) return;

    const result = await createListing(input);

    if (!result.success || !result.id) {
      Alert.alert(t('common.error'), result.error || t('monthlyHost.createError'));
      return;
    }

    const submit = await submitForApproval(result.id);
    if (!submit.success) {
      Alert.alert(
        t('monthlyHost.draftSaved'),
        submit.error || t('monthlyHost.draftSavedSubmitFailed'),
        [
          {
            text: t('monthlyHost.seeMyListings'),
            onPress: goMonthlySpace,
          },
          { text: t('common.ok') },
        ],
      );
      return;
    }

    Alert.alert(
      t('common.success'),
      t('monthlyHost.submitSuccess'),
      [
        {
          text: t('common.ok'),
          onPress: goMonthlySpace,
        },
      ],
      { cancelable: false },
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('monthlyHost.addTitle')}</Text>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelTitle')}</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => set('title', v)}
              placeholder={t('monthlyHost.placeholderTitle')}
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelLocation')}</Text>
            <CitySearchInputModal
              value={typeof form.location === 'string' ? form.location : ''}
              onChange={async (result) => {
                if (!result) {
                  set('location', '');
                  setLocationId(null);
                  return;
                }
                set('location', result.name);
                let locId = isLocationUuid(result.id) ? result.id : null;
                if (
                  !locId &&
                  result.latitude != null &&
                  result.longitude != null &&
                  Number.isFinite(Number(result.latitude)) &&
                  Number.isFinite(Number(result.longitude))
                ) {
                  try {
                    const matched = await matchLocationNearCoords({
                      latitude: Number(result.latitude),
                      longitude: Number(result.longitude),
                    });
                    if (matched?.id && isLocationUuid(matched.id)) {
                      locId = matched.id;
                    }
                  } catch {
                    // garder le nom
                  }
                }
                setLocationId(locId);
                if (
                  result.latitude != null &&
                  result.longitude != null &&
                  Number.isFinite(Number(result.latitude)) &&
                  Number.isFinite(Number(result.longitude))
                ) {
                  setPreciseLocation({
                    coords: {
                      latitude: Number(result.latitude),
                      longitude: Number(result.longitude),
                    },
                    locationLabel: result.name,
                    matchedLocation: locId
                      ? {
                          id: locId,
                          name: result.name,
                          type: 'city',
                          parent_id: null,
                          latitude: Number(result.latitude),
                          longitude: Number(result.longitude),
                        }
                      : null,
                  });
                }
              }}
              placeholder={t('monthlyHost.placeholderLocation')}
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelPrecisePosition')}</Text>
            <Text style={styles.hint}>
              {t('monthlyHost.hintPreciseLocation')}
            </Text>
            <PropertyLocationPicker
              value={preciseLocation}
              onChange={(next) => {
                setPreciseLocation(next);
                if (next.matchedLocation?.id && isLocationUuid(next.matchedLocation.id)) {
                  setLocationId(next.matchedLocation.id);
                }
                if (next.locationLabel && !form.location.trim()) {
                  set('location', next.locationLabel);
                }
              }}
              height={220}
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelPropertyType')}</Text>
            <TouchableOpacity style={styles.select} onPress={() => setShowPropertyTypeModal(true)}>
              <Text style={styles.selectText}>
                {PROPERTY_TYPES.find((pt) => pt.value === form.property_type)?.label || t('monthlyHost.choose')}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <View style={[styles.block, styles.half]}>
              <Text style={styles.label}>{t('monthlyHost.labelSurface')}</Text>
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
              <Text style={styles.label}>{t('monthlyHost.labelRooms')}</Text>
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
              <Text style={styles.label}>{t('monthlyHost.labelBedrooms')}</Text>
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
              <Text style={styles.label}>{t('monthlyHost.labelBathrooms')}</Text>
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
          <View style={styles.row}>
            <View style={[styles.block, styles.half]}>
              <Text style={styles.label}>{t('monthlyHost.labelToilets')}</Text>
              <TextInput
                style={styles.input}
                value={form.toilets}
                onChangeText={(v) => set('toilets', v)}
                placeholder={t('monthlyHost.placeholderToilets')}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>
            <View style={[styles.block, styles.half]} />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelRentalType')}</Text>
            <Text style={styles.helpText}>
              {t('monthlyHost.hintFurnished')}
            </Text>
            {MONTHLY_FURNISHED_OPTIONS.map((option) => {
              const selected = form.is_furnished === option.value;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[styles.furnishedCard, selected && styles.furnishedCardOn]}
                  onPress={() => setFurnished(option.value)}
                  activeOpacity={0.85}
                >
                  <View style={styles.furnishedCardHeader}>
                    <Text style={[styles.furnishedCardTitle, selected && styles.furnishedCardTitleOn]}>
                      {option.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color="#2E7D32" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color="#94a3b8" />
                    )}
                  </View>
                  <Text style={styles.furnishedCardDesc}>{option.description}</Text>
                  {!selected ? (
                    <Text style={styles.furnishedCardHint}>{option.hint}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {form.is_furnished ? (
            <View style={styles.block}>
              <Text style={styles.label}>{t('monthlyHost.labelFurnitureAmenities')}</Text>
              <Text style={styles.helpText}>
                {t('monthlyHost.hintFurniture')}
              </Text>
              <View style={styles.furnitureWrap}>
                {MONTHLY_FURNITURE_OPTIONS.map((item) => {
                  const on = amenities.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.furnitureChip, on && styles.furnitureChipOn]}
                      onPress={() => toggleAmenity(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.furnitureChipText, on && styles.furnitureChipTextOn]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelPhotos')}</Text>
            <Text style={styles.helpText}>{t('monthlyHost.hintPhotos')}</Text>
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
                  <Text style={styles.photoAddText}>{t('monthly.add')}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelDescription')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              placeholder={t('monthlyHost.placeholderDescription')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelRent')}</Text>
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
            <Text style={styles.label}>{t('monthlyHost.labelDepositMonths')}</Text>
            <TextInput
              style={styles.input}
              value={form.deposit_months}
              onChangeText={(v) => set('deposit_months', v)}
              placeholder={t('monthlyHost.placeholderDeposit')}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelAdvanceMonths')}</Text>
            <TextInput
              style={styles.input}
              value={form.advance_months}
              onChangeText={(v) => set('advance_months', v)}
              placeholder={t('monthlyHost.placeholderAdvance')}
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelMinDuration')}</Text>
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
            <Text style={styles.label}>{t('monthlyHost.labelChargesIncluded')}</Text>
            <Switch
              value={form.charges_included}
              onValueChange={(v) => set('charges_included', v)}
              trackColor={{ false: '#e5e7eb', true: '#2E7D32' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelAddress')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.address_details}
              onChangeText={(v) => set('address_details', v)}
              placeholder={t('monthlyHost.placeholderAddress')}
              placeholderTextColor="#999"
              multiline
              numberOfLines={2}
            />
          </View>
          <View style={styles.block}>
            <Text style={styles.label}>{t('monthlyHost.labelRequiredDocs')}</Text>
            <Text style={styles.hint}>
              {t('monthlyHost.hintDocs')}
            </Text>
            <View style={styles.docChips}>
              {MONTHLY_RENTAL_DOCUMENT_OPTIONS.map((doc) => {
                const on = requiredDocuments.includes(doc.id);
                return (
                  <TouchableOpacity
                    key={doc.id}
                    style={[styles.docChip, on && styles.docChipOn]}
                    onPress={() => toggleRequiredDoc(doc.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={on ? '#2E7D32' : '#94a3b8'}
                    />
                    <Text style={[styles.docChipText, on && styles.docChipTextOn]}>
                      {doc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.draftBtn, (loading || uploadingImages) && styles.submitDisabled]}
            onPress={handleSaveDraft}
            disabled={loading || uploadingImages}
          >
            <Text style={styles.draftBtnText}>{t('monthlyHost.saveDraft')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submit, (loading || uploadingImages) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading || uploadingImages}
          >
            {loading || uploadingImages ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('monthlyHost.submitForApproval')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {showPropertyTypeModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('monthlyHost.labelPropertyType')}</Text>
            {PROPERTY_TYPES.map((pt) => (
              <TouchableOpacity
                key={pt.value}
                style={styles.modalItem}
                onPress={() => {
                  set('property_type', pt.value);
                  setShowPropertyTypeModal(false);
                }}
              >
                <Text style={styles.modalItemText}>{pt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowPropertyTypeModal(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
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
  hint: { fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 17 },
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
  furnishedCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  furnishedCardOn: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0fdf4',
  },
  furnishedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  furnishedCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  furnishedCardTitleOn: { color: '#14532d' },
  furnishedCardDesc: { fontSize: 13, color: '#475569', lineHeight: 18 },
  furnishedCardHint: { marginTop: 8, fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  furnitureWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  furnitureChip: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  furnitureChipOn: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0fdf4',
  },
  furnitureChipText: { fontSize: 13, color: '#334155' },
  furnitureChipTextOn: { color: '#14532d', fontWeight: '600' },
  docChips: { gap: 8 },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  docChipOn: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0fdf4',
  },
  docChipText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 19 },
  docChipTextOn: { color: '#14532d', fontWeight: '600' },
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
  draftBtn: {
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  draftBtnText: {
    color: '#2E7D32',
    fontSize: 15,
    fontWeight: '700',
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
