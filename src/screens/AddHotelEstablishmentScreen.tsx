import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { notifyHotelEstablishmentSubmitted } from '../services/moderationNotifications';
import { HOTEL_COLORS } from '../constants/colors';
import { useLanguage } from '../contexts/LanguageContext';
import type { RootStackParamList } from '../types';
import PropertyLocationPicker, {
  type PropertyLocationPickerValue,
} from '../components/PropertyLocationPicker';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { isLocationUuid } from '../lib/geolocation';
import {
  HOTEL_AMENITY_OPTIONS,
  HOTEL_CANCELLATION_OPTIONS,
  HOTEL_LANGUAGE_OPTIONS,
  HOTEL_ROOM_CATEGORIES,
  formatHotelTime,
} from '../constants/hotelListing';

type DraftRoom = {
  key: string;
  room_category: string;
  name: string;
  price_per_night: string;
  inventory_count: string;
  max_guests: string;
  cleaning_fee: string;
  imageUris: string[];
};

const emptyDraftRoom = (): DraftRoom => ({
  key: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  room_category: 'standard',
  name: '',
  price_per_night: '',
  inventory_count: '1',
  max_guests: '2',
  cleaning_fee: '0',
  imageUris: [],
});

const MAX_PHOTOS = 20;
const MAX_ROOM_PHOTOS = 10;

type Route = RouteProp<RootStackParamList, 'AddHotelEstablishment'>;

async function uploadHotelImage(uri: string, userId: string): Promise<string> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const fileName = `hotel/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const contentType =
    fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : 'image/jpeg';
  const { error } = await supabase.storage
    .from('property-images')
    .upload(fileName, new Uint8Array(arrayBuffer), { contentType, upsert: false });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = supabase.storage.from('property-images').getPublicUrl(fileName);
  return publicUrl;
}

/**
 * Création / édition d’un établissement hôtelier.
 */
export default function AddHotelEstablishmentScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const establishmentId = route.params?.establishmentId;
  const isEdit = !!establishmentId;
  const { user } = useAuth();
  const { t } = useLanguage();

  const establishmentTypes = [
    { value: 'hotel', label: t('hotelEstablishment.typeHotel') },
    { value: 'guesthouse', label: t('hotelEstablishment.typeGuesthouse') },
    { value: 'residence', label: t('hotelEstablishment.typeResidence') },
    { value: 'aparthotel', label: t('hotelEstablishment.typeAparthotel') },
  ];

  const [title, setTitle] = useState('');
  const [establishmentType, setEstablishmentType] = useState<string>('hotel');
  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [description, setDescription] = useState('');
  const [starRating, setStarRating] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>(['fr']);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [houseRules, setHouseRules] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('flexible');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([]);
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(!!establishmentId);
  const [saving, setSaving] = useState(false);
  const [preciseLocation, setPreciseLocation] = useState<PropertyLocationPickerValue>({
    coords: null,
    locationLabel: '',
    matchedLocation: null,
  });

  const load = useCallback(async () => {
    if (!establishmentId || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_establishments')
        .select(
          'title, establishment_type, address, address_details, description, star_rating, status, images, latitude, longitude, location_id, check_in_time, check_out_time, amenities, house_rules, cancellation_policy, pets_allowed, spoken_languages',
        )
        .eq('id', establishmentId)
        .eq('host_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        Alert.alert(t('hotelEstablishment.notFoundTitle'), t('hotelEstablishment.notFound'));
        navigation.goBack();
        return;
      }
      setTitle(data.title || '');
      setEstablishmentType(data.establishment_type || 'hotel');
      setAddress(data.address || '');
      setAddressDetails(data.address_details || '');
      setDescription(data.description || '');
      setStarRating(
        (data as any).star_rating != null ? String((data as any).star_rating) : '',
      );
      setCheckInTime(formatHotelTime(data.check_in_time) || '14:00');
      setCheckOutTime(formatHotelTime(data.check_out_time) || '11:00');
      setAmenities(Array.isArray(data.amenities) ? data.amenities.map(String) : []);
      setSpokenLanguages(
        Array.isArray(data.spoken_languages) && data.spoken_languages.length > 0
          ? data.spoken_languages.map(String)
          : ['fr'],
      );
      setPetsAllowed(!!data.pets_allowed);
      setHouseRules(data.house_rules || '');
      setCancellationPolicy(data.cancellation_policy || 'flexible');
      setStatus(data.status || 'draft');
      setImageUris(
        Array.isArray(data.images) ? data.images.map(String).filter(Boolean) : [],
      );
      const lat = data.latitude != null ? Number(data.latitude) : NaN;
      const lng = data.longitude != null ? Number(data.longitude) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setPreciseLocation({
          coords: { latitude: lat, longitude: lng },
          locationLabel: data.address || '',
          matchedLocation: data.location_id
            ? {
                id: data.location_id,
                name: data.address || '',
                type: 'city',
                parent_id: null,
                latitude: lat,
                longitude: lng,
              }
            : null,
        });
      }
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('hotelEstablishment.loadError'));
    } finally {
      setLoading(false);
    }
  }, [establishmentId, user, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickImages = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert(t('hotelEstablishment.permissionTitle'), t('hotelEstablishment.permissionDesc'));
      return;
    }
    const limit = MAX_PHOTOS - imageUris.length;
    if (limit <= 0) {
      Alert.alert(t('hotelEstablishment.photoLimitTitle'), t('hotelEstablishment.photoLimit', { count: String(MAX_PHOTOS) }));
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

  const pickRoomImages = async (roomKey: string) => {
    const room = draftRooms.find((r) => r.key === roomKey);
    if (!room) return;
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert(t('hotelEstablishment.permissionTitle'), t('hotelEstablishment.permissionDesc'));
      return;
    }
    const limit = MAX_ROOM_PHOTOS - room.imageUris.length;
    if (limit <= 0) {
      Alert.alert(t('hotelEstablishment.photoLimitTitle'), t('hotelEstablishment.roomPhotoLimit', { count: String(MAX_ROOM_PHOTOS) }));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setDraftRooms((prev) =>
        prev.map((r) =>
          r.key === roomKey
            ? { ...r, imageUris: [...r.imageUris, ...result.assets!.map((a) => a.uri)] }
            : r,
        ),
      );
    }
  };

  const removeRoomImage = (roomKey: string, index: number) => {
    setDraftRooms((prev) =>
      prev.map((r) =>
        r.key === roomKey
          ? { ...r, imageUris: r.imageUris.filter((_, i) => i !== index) }
          : r,
      ),
    );
  };

  const toggleAmenity = (value: string) => {
    setAmenities((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const toggleLanguage = (value: string) => {
    setSpokenLanguages((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const goHotelSpace = () => {
    navigation.navigate('ModeTransition', {
      targetMode: 'hotel',
      targetPath: 'HotelOwnerSpace',
      fromMode: 'traveler',
    });
  };

  const insertDraftRooms = async (estId: string) => {
    if (!user) return;
    for (const room of draftRooms) {
      const name = room.name.trim();
      const price = parseInt(room.price_per_night, 10);
      if (!name || !Number.isFinite(price) || price <= 0) continue;
      const images: string[] = [];
      for (const uri of room.imageUris) {
        images.push(await uploadHotelImage(uri, user.id));
      }
      const { error } = await supabase.from('hotel_room_types').insert({
        establishment_id: estId,
        name,
        room_category: room.room_category || null,
        price_per_night: price,
        inventory_count: Math.max(1, parseInt(room.inventory_count, 10) || 1),
        max_guests: Math.max(1, parseInt(room.max_guests, 10) || 1),
        cleaning_fee: Math.max(0, parseInt(room.cleaning_fee, 10) || 0),
        images,
        status: 'active',
      });
      if (error) throw error;
    }
  };

  const handleSave = async (asDraft: boolean) => {
    if (!user) {
      navigation.navigate('Auth', { returnTo: 'AddHotelEstablishment' });
      return;
    }
    if (!title.trim()) {
      Alert.alert(t('hotelEstablishment.fieldRequired'), t('hotelEstablishment.nameRequired'));
      return;
    }
    if (!asDraft) {
      const incomplete = draftRooms.some((r) => {
        const price = parseInt(r.price_per_night, 10);
        return r.name.trim() && (!Number.isFinite(price) || price <= 0);
      });
      if (incomplete) {
        Alert.alert(t('hotelEstablishment.roomTypes'), t('hotelEstablishment.roomsPriceRequired'));
        return;
      }
    }

    setSaving(true);
    try {
      const images: string[] = [];
      for (const uri of imageUris) {
        images.push(await uploadHotelImage(uri, user.id));
      }
      const locationId =
        preciseLocation.matchedLocation?.id && isLocationUuid(preciseLocation.matchedLocation.id)
          ? preciseLocation.matchedLocation.id
          : null;
      const lat = preciseLocation.coords?.latitude ?? null;
      const lng = preciseLocation.coords?.longitude ?? null;
      const addressValue =
        address.trim() ||
        preciseLocation.locationLabel.trim() ||
        null;
      const addressDetailsValue = addressDetails.trim() || null;
      const listingExtras = {
        check_in_time: checkInTime.trim() || null,
        check_out_time: checkOutTime.trim() || null,
        amenities,
        spoken_languages: spokenLanguages,
        pets_allowed: petsAllowed,
        house_rules: houseRules.trim() || null,
        cancellation_policy: cancellationPolicy || null,
        star_rating: starRating.trim() ? Number(starRating) : null,
      };

      if (isEdit && establishmentId) {
        const { error } = await supabase
          .from('hotel_establishments')
          .update({
            title: title.trim(),
            establishment_type: establishmentType,
            address: addressValue,
            address_details: addressDetailsValue,
            description: description.trim() || null,
            images,
            latitude: lat,
            longitude: lng,
            location_id: locationId,
            ...listingExtras,
            updated_at: new Date().toISOString(),
          })
          .eq('id', establishmentId)
          .eq('host_id', user.id);
        if (error) throw error;
        if (draftRooms.length) {
          await insertDraftRooms(establishmentId);
          setDraftRooms([]);
        }
        if (!asDraft && (status === 'draft' || status === 'rejected' || status === 'hidden')) {
          const { error: submitErr } = await supabase
            .from('hotel_establishments')
            .update({
              status: 'pending',
              submitted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', establishmentId)
            .eq('host_id', user.id);
          if (submitErr) throw submitErr;
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', user.id)
            .maybeSingle();
          const hostName =
            [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || t('hotelEstablishment.hotelierFallback');
          notifyHotelEstablishmentSubmitted(establishmentId, title.trim(), hostName).catch(() => {});
          setStatus('pending');
          Alert.alert(t('hotelEstablishment.submittedTitle'), t('hotelEstablishment.submitted'));
        } else {
          Alert.alert(
            asDraft ? t('hotelEstablishment.draftSavedTitle') : t('hotelEstablishment.savedTitle'),
            asDraft
              ? t('hotelEstablishment.draftSavedDesc')
              : t('hotelEstablishment.updated'),
          );
        }
        goHotelSpace();
        return;
      }

      const { data: created, error } = await supabase
        .from('hotel_establishments')
        .insert({
          host_id: user.id,
          title: title.trim(),
          establishment_type: establishmentType,
          address: addressValue,
          address_details: addressDetailsValue,
          description: description.trim() || null,
          images,
          latitude: lat,
          longitude: lng,
          location_id: locationId,
          ...listingExtras,
          status: 'draft',
        })
        .select('id')
        .single();

      if (error) throw error;
      if (draftRooms.length) {
        await insertDraftRooms(created.id);
      }

      if (asDraft) {
        Alert.alert(t('hotelEstablishment.draftSavedTitle'), t('hotelEstablishment.draftSavedDesc'));
        goHotelSpace();
        return;
      }

      const { error: submitErr } = await supabase
        .from('hotel_establishments')
        .update({
          status: 'pending',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', created.id)
        .eq('host_id', user.id);

      if (submitErr) {
        Alert.alert(
          'Brouillon enregistré',
          submitErr.message ||
            'L’établissement a été créé, mais la soumission a échoué. Vous pouvez le soumettre depuis Mes établissements.',
          [{ text: 'Voir mes établissements', onPress: goHotelSpace }, { text: 'OK' }],
        );
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const hostName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || t('hotelEstablishment.hotelierFallback');
      notifyHotelEstablishmentSubmitted(created.id, title.trim(), hostName).catch(() => {});
      Alert.alert(t('hotelEstablishment.submittedTitle'), t('hotelEstablishment.submitted'));
      goHotelSpace();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('hotelEstablishment.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const setVisibility = async (next: 'active' | 'hidden' | 'draft' | 'pending') => {
    if (!user || !establishmentId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        status: next,
        updated_at: new Date().toISOString(),
      };
      if (next === 'pending') {
        payload.submitted_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('hotel_establishments')
        .update(payload)
        .eq('id', establishmentId)
        .eq('host_id', user.id);
      if (error) throw error;
      setStatus(next);
      if (next === 'pending') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .maybeSingle();
        const hostName =
          [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || t('hotelEstablishment.hotelierFallback');
        notifyHotelEstablishmentSubmitted(establishmentId, title.trim(), hostName).catch(() => {});
      }
      Alert.alert(
        t('common.ok'),
        next === 'pending'
          ? t('hotelEstablishment.submittedPendingMsg')
          : next === 'active'
            ? t('hotelEstablishment.publishedMsg')
            : next === 'hidden'
              ? t('hotelEstablishment.hiddenMsg')
              : t('hotelEstablishment.backToDraftMsg'),
      );
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('hotelEstablishment.actionImpossible'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!user || !establishmentId) return;
    Alert.alert(t('common.delete'), t('hotelEstablishment.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const { error } = await supabase
              .from('hotel_establishments')
              .delete()
              .eq('id', establishmentId)
              .eq('host_id', user.id);
            if (error) throw error;
            navigation.goBack();
          } catch (e) {
            Alert.alert(t('common.error'), e instanceof Error ? e.message : t('hotelEstablishment.deleteError'));
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? t('hotelEstablishment.editTitle') : t('hotelEstablishment.createTitle')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.eyebrow}>{t('hotelEstablishment.eyebrow')}</Text>
          <Text style={styles.title}>
            {isEdit
              ? t('hotelEstablishment.editHeading')
              : t('hotelEstablishment.createHeading')}
          </Text>

          <Text style={styles.label}>{t('hotelEstablishment.name')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('hotelEstablishment.estNamePlaceholder')}
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>{t('hotelEstablishment.type')}</Text>
          <View style={styles.chips}>
            {establishmentTypes.map((typ) => (
              <TouchableOpacity
                key={typ.value}
                onPress={() => setEstablishmentType(typ.value)}
                style={[styles.chip, establishmentType === typ.value && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    establishmentType === typ.value && styles.chipTextActive,
                  ]}
                >
                  {typ.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t('hotelEstablishment.location')}</Text>
          <Text style={styles.hint}>{t('hotelEstablishment.locationHint')}</Text>
          <CitySearchInputModal
            value={address}
            onChange={(result) => {
              if (!result) {
                setAddress('');
                setPreciseLocation({
                  coords: null,
                  locationLabel: '',
                  matchedLocation: null,
                });
                return;
              }
              setAddress(result.name);
              const lat = result.latitude != null ? Number(result.latitude) : NaN;
              const lng = result.longitude != null ? Number(result.longitude) : NaN;
              const matched =
                isLocationUuid(result.id)
                  ? {
                      id: result.id,
                      name: result.name,
                      type: result.type,
                      parent_id: result.parent_id ?? null,
                      latitude: Number.isFinite(lat) ? lat : null,
                      longitude: Number.isFinite(lng) ? lng : null,
                      region: result.region,
                      commune: result.commune,
                      city_id: result.city_id,
                    }
                  : null;
              setPreciseLocation({
                coords:
                  Number.isFinite(lat) && Number.isFinite(lng)
                    ? { latitude: lat, longitude: lng }
                    : null,
                locationLabel: result.name,
                matchedLocation: matched,
              });
            }}
            placeholder={t('hotelEstablishment.citySearchPlaceholder')}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>
            {t('hotelEstablishment.addressDetails')}
          </Text>
          <TextInput
            style={styles.input}
            value={addressDetails}
            onChangeText={setAddressDetails}
            placeholder={t('hotelEstablishment.addressDetailsPlaceholder')}
            placeholderTextColor="#94a3b8"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>{t('hotelEstablishment.stars')}</Text>
          <View style={styles.chips}>
            {['', '1', '2', '3', '4', '5'].map((v) => {
              const label = v === '' ? t('hotelEstablishment.starsNone') : `${v}★`;
              const selected = starRating === v;
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setStarRating(v)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>{t('hotelEstablishment.mapPosition')}</Text>
          <Text style={styles.hint}>{t('hotelEstablishment.mapHint')}</Text>
          <PropertyLocationPicker
            value={preciseLocation}
            onChange={(next) => {
              setPreciseLocation(next);
              if (next.locationLabel) {
                setAddress(next.locationLabel);
              }
            }}
            onLocationLabelChange={(label) => {
              if (label) setAddress(label);
            }}
            height={220}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>
            {t('hotelEstablishment.description')}
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('hotelEstablishment.descriptionPlaceholder')}
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>{t('hotelEstablishment.checkTimes')}</Text>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.subLabel}>{t('hotelEstablishment.checkIn')}</Text>
              <TextInput
                style={styles.input}
                value={checkInTime}
                onChangeText={setCheckInTime}
                placeholder="14:00"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.subLabel}>{t('hotelEstablishment.checkOut')}</Text>
              <TextInput
                style={styles.input}
                value={checkOutTime}
                onChangeText={setCheckOutTime}
                placeholder="11:00"
                placeholderTextColor="#94a3b8"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <Text style={styles.label}>{t('hotelEstablishment.amenities')}</Text>
          <View style={styles.chips}>
            {HOTEL_AMENITY_OPTIONS.map((a) => {
              const on = amenities.includes(a.value);
              return (
                <TouchableOpacity
                  key={a.value}
                  onPress={() => toggleAmenity(a.value)}
                  style={[styles.chip, on && styles.chipActive]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{a.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>{t('hotelEstablishment.languages')}</Text>
          <View style={styles.chips}>
            {HOTEL_LANGUAGE_OPTIONS.map((l) => {
              const on = spokenLanguages.includes(l.value);
              return (
                <TouchableOpacity
                  key={l.value}
                  onPress={() => toggleLanguage(l.value)}
                  style={[styles.chip, on && styles.chipActive]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setPetsAllowed((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t('hotelEstablishment.petsAllowed')}</Text>
              <Text style={styles.hint}>{t('hotelEstablishment.petsHint')}</Text>
            </View>
            <Ionicons
              name={petsAllowed ? 'checkbox' : 'square-outline'}
              size={26}
              color={petsAllowed ? HOTEL_COLORS.primary : '#94a3b8'}
            />
          </TouchableOpacity>

          <Text style={styles.label}>{t('hotelEstablishment.cancellation')}</Text>
          <View style={styles.chips}>
            {HOTEL_CANCELLATION_OPTIONS.map((c) => {
              const on = cancellationPolicy === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => setCancellationPolicy(c.value)}
                  style={[styles.chip, on && styles.chipActive]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.hint, { marginBottom: 12 }]}>
            {HOTEL_CANCELLATION_OPTIONS.find((c) => c.value === cancellationPolicy)?.hint}
          </Text>

          <Text style={styles.label}>{t('hotelEstablishment.houseRules')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={houseRules}
            onChangeText={setHouseRules}
            placeholder={t('hotelEstablishment.rulesPlaceholder')}
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>{t('hotelEstablishment.photos')}</Text>
          <Text style={styles.hint}>
            {t('hotelEstablishment.photosHint', { count: String(MAX_PHOTOS) })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {imageUris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => removeImage(index)}>
                  <Ionicons name="close-circle" size={22} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))}
            {imageUris.length < MAX_PHOTOS ? (
              <TouchableOpacity style={styles.photoAdd} onPress={pickImages}>
                <Ionicons name="camera-outline" size={28} color="#64748b" />
                <Text style={styles.photoAddText}>{t('hotelEstablishment.add')}</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <Text style={styles.label}>{t('hotelEstablishment.roomTypes')}</Text>
          <Text style={styles.hint}>{t('hotelEstablishment.roomTypesHint')}</Text>
          {draftRooms.map((room, index) => (
            <View key={room.key} style={styles.roomCard}>
              <View style={styles.roomCardHeader}>
                <Text style={styles.roomCardTitle}>{t('hotelEstablishment.roomN', { n: String(index + 1) })}</Text>
                <TouchableOpacity
                  onPress={() => setDraftRooms((prev) => prev.filter((r) => r.key !== room.key))}
                >
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {HOTEL_ROOM_CATEGORIES.map((c) => {
                  const on = room.room_category === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[styles.chip, on && styles.chipActive]}
                      onPress={() =>
                        setDraftRooms((prev) =>
                          prev.map((r) =>
                            r.key === room.key
                              ? {
                                  ...r,
                                  room_category: c.value,
                                  name: r.name.trim() ? r.name : c.defaultName,
                                  max_guests: c.guests,
                                }
                              : r,
                          ),
                        )
                      }
                    >
                      <Text style={[styles.chipText, on && styles.chipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                style={styles.input}
                value={room.name}
                onChangeText={(v) =>
                  setDraftRooms((prev) => prev.map((r) => (r.key === room.key ? { ...r, name: v } : r)))
                }
                placeholder={t('hotelEstablishment.roomTypeNamePlaceholder')}
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.roomRow}>
                <TextInput
                  style={[styles.input, styles.roomHalf]}
                  value={room.price_per_night}
                  onChangeText={(v) =>
                    setDraftRooms((prev) =>
                      prev.map((r) => (r.key === room.key ? { ...r, price_per_night: v } : r)),
                    )
                  }
                  placeholder={t('hotelEstablishment.pricePlaceholder')}
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, styles.roomHalf]}
                  value={room.inventory_count}
                  onChangeText={(v) =>
                    setDraftRooms((prev) =>
                      prev.map((r) => (r.key === room.key ? { ...r, inventory_count: v } : r)),
                    )
                  }
                  placeholder={t('hotelEstablishment.unitsPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.roomRow}>
                <TextInput
                  style={[styles.input, styles.roomHalf]}
                  value={room.max_guests}
                  onChangeText={(v) =>
                    setDraftRooms((prev) =>
                      prev.map((r) => (r.key === room.key ? { ...r, max_guests: v } : r)),
                    )
                  }
                  placeholder={t('hotelEstablishment.maxGuestsPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, styles.roomHalf]}
                  value={room.cleaning_fee}
                  onChangeText={(v) =>
                    setDraftRooms((prev) =>
                      prev.map((r) => (r.key === room.key ? { ...r, cleaning_fee: v } : r)),
                    )
                  }
                  placeholder={t('hotelEstablishment.cleaningPlaceholder')}
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
              </View>
              <Text style={[styles.hint, { marginTop: 4 }]}>
                {t('hotelEstablishment.roomPhotosDraft', { count: String(MAX_ROOM_PHOTOS) })}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                {room.imageUris.map((uri, imgIndex) => (
                  <View key={`${uri}-${imgIndex}`} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removeRoomImage(room.key, imgIndex)}
                    >
                      <Ionicons name="close-circle" size={22} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ))}
                {room.imageUris.length < MAX_ROOM_PHOTOS ? (
                  <TouchableOpacity
                    style={styles.photoAdd}
                    onPress={() => void pickRoomImages(room.key)}
                  >
                    <Ionicons name="camera-outline" size={28} color="#64748b" />
                    <Text style={styles.photoAddText}>{t('hotelEstablishment.photosBtn')}</Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addRoomBtn}
            onPress={() =>
              setDraftRooms((prev) => [
                ...prev,
                { ...emptyDraftRoom(), name: t('hotelEstablishment.defaultStandard') },
              ])
            }
          >
            <Ionicons name="add-circle-outline" size={20} color={HOTEL_COLORS.primary} />
            <Text style={styles.addRoomText}>{t('hotelEstablishment.addRoomType')}</Text>
          </TouchableOpacity>

          {!isEdit || status === 'draft' || status === 'rejected' || status === 'hidden' ? (
            <TouchableOpacity
              style={[styles.draftBtn, saving && { opacity: 0.7 }]}
              onPress={() => void handleSave(true)}
              disabled={saving}
            >
              <Text style={styles.draftBtnText}>{t('hotelEstablishment.saveDraft')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.submit, saving && { opacity: 0.7 }]}
            onPress={() => void handleSave(false)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isEdit
                  ? status === 'draft' || status === 'rejected' || status === 'hidden'
                    ? t('hotelEstablishment.submit')
                    : t('common.save')
                  : t('hotelEstablishment.submit')}
              </Text>
            )}
          </TouchableOpacity>

          {isEdit && establishmentId ? (
            <View style={styles.manageBlock}>
              <Text style={styles.manageTitle}>{t('hotelEstablishment.management')}</Text>
              <Text style={styles.statusLine}>
                {t('hotelEstablishment.statusPrefix')}{' '}
                {status === 'active'
                  ? t('hotelEstablishment.statusPublished')
                  : status === 'pending'
                    ? t('hotelEstablishment.statusPending')
                    : status === 'rejected'
                      ? t('hotelEstablishment.statusRejected')
                      : status === 'hidden'
                        ? t('hotelEstablishment.statusHidden')
                        : t('hotelEstablishment.statusDraft')}
              </Text>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() =>
                  navigation.navigate('ManageHotelRoomTypes', {
                    establishmentId,
                    establishmentTitle: title,
                  })
                }
              >
                <Ionicons name="bed-outline" size={18} color={HOTEL_COLORS.primary} />
                <Text style={styles.secondaryBtnText}>{t('hotelEstablishment.roomTypes')}</Text>
              </TouchableOpacity>

              {status === 'active' ? (
                <TouchableOpacity
                  style={styles.hideBtn}
                  onPress={() => void setVisibility('hidden')}
                  disabled={saving}
                >
                  <Text style={styles.hideBtnText}>{t('hotelEstablishment.hide')}</Text>
                </TouchableOpacity>
              ) : status === 'pending' ? (
                <View style={styles.pendingHint}>
                  <Text style={styles.pendingHintText}>
                    {t('hotelEstablishment.pendingHint')}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => void setVisibility('pending')}
                  disabled={saving}
                >
                  <Text style={styles.publishBtnText}>
                    {status === 'rejected' || status === 'hidden'
                      ? t('hotelEstablishment.resubmit')
                      : t('hotelEstablishment.submit')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
                <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: HOTEL_COLORS.primary,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  hint: { fontSize: 12, color: '#64748b', marginBottom: 8, lineHeight: 17 },
  photosRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  photoWrap: { position: 'relative', marginRight: 8 },
  photoThumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: '#e2e8f0' },
  photoRemove: { position: 'absolute', top: -6, right: -6 },
  photoAdd: {
    width: 88,
    height: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  photoAddText: { marginTop: 4, fontSize: 12, color: '#64748b', fontWeight: '600' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 16,
  },
  textarea: { minHeight: 100, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipActive: {
    borderColor: HOTEL_COLORS.primary,
    backgroundColor: HOTEL_COLORS.primary,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  subLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  roomCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  roomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roomCardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  roomRow: { flexDirection: 'row', gap: 8 },
  roomHalf: { flex: 1 },
  addRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 10,
  },
  addRoomText: { color: HOTEL_COLORS.primary, fontWeight: '700', fontSize: 14 },
  draftBtn: {
    borderWidth: 1.5,
    borderColor: HOTEL_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  draftBtnText: { color: HOTEL_COLORS.primary, fontSize: 15, fontWeight: '700' },
  submit: {
    marginTop: 8,
    backgroundColor: HOTEL_COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  manageBlock: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  manageTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  statusLine: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: HOTEL_COLORS.primary },
  publishBtn: {
    backgroundColor: HOTEL_COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  publishBtnText: { color: '#fff', fontWeight: '700' },
  hideBtn: {
    backgroundColor: '#e8eaf6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  hideBtnText: { color: '#5c6bc0', fontWeight: '700' },
  pendingHint: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  pendingHintText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
  deleteBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteBtnText: { color: '#c62828', fontWeight: '600' },
});
