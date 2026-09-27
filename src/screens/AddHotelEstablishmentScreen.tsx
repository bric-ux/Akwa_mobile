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
import { HOTEL_COLORS } from '../constants/colors';
import type { RootStackParamList } from '../types';
import PropertyLocationPicker, {
  type PropertyLocationPickerValue,
} from '../components/PropertyLocationPicker';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { isLocationUuid } from '../lib/geolocation';

const ESTABLISHMENT_TYPES = [
  { value: 'hotel', label: 'Hôtel' },
  { value: 'guesthouse', label: 'Maison d’hôtes' },
  { value: 'residence', label: 'Résidence' },
  { value: 'aparthotel', label: 'Aparthotel' },
] as const;

const MAX_PHOTOS = 20;

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
  const [title, setTitle] = useState('');
  const [establishmentType, setEstablishmentType] = useState<string>('hotel');
  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [description, setDescription] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
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
          'title, establishment_type, address, address_details, description, status, images, latitude, longitude, location_id',
        )
        .eq('id', establishmentId)
        .eq('host_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        Alert.alert('Introuvable', 'Établissement introuvable.');
        navigation.goBack();
        return;
      }
      setTitle(data.title || '');
      setEstablishmentType(data.establishment_type || 'hotel');
      setAddress(data.address || '');
      setAddressDetails(data.address_details || '');
      setDescription(data.description || '');
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
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible');
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
      Alert.alert('Permission requise', 'Autorisez l’accès à vos photos.');
      return;
    }
    const limit = MAX_PHOTOS - imageUris.length;
    if (limit <= 0) {
      Alert.alert('Limite', `Vous pouvez ajouter jusqu’à ${MAX_PHOTOS} photos.`);
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

  const handleSubmit = async () => {
    if (!user) {
      navigation.navigate('Auth', { returnTo: 'AddHotelEstablishment' });
      return;
    }
    if (!title.trim()) {
      Alert.alert('Champ requis', 'Indiquez le nom de l’établissement.');
      return;
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
            updated_at: new Date().toISOString(),
          })
          .eq('id', establishmentId)
          .eq('host_id', user.id);
        if (error) throw error;
        Alert.alert('Enregistré', 'Établissement mis à jour.');
        navigation.goBack();
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
          status: 'draft',
        })
        .select('id')
        .single();

      if (error) throw error;

      Alert.alert(
        'Établissement créé',
        'Ajoutez maintenant vos types de chambres (ex. 10 chambres Standard, 4 Suites).',
        [
          {
            text: 'Ajouter des chambres',
            onPress: () => {
              navigation.replace('ManageHotelRoomTypes', {
                establishmentId: created.id,
                establishmentTitle: title.trim(),
              });
            },
          },
          {
            text: 'Plus tard',
            style: 'cancel',
            onPress: () => {
              navigation.navigate('ModeTransition', {
                targetMode: 'hotel',
                targetPath: 'HotelOwnerSpace',
                fromMode: 'traveler',
              });
            },
          },
        ],
      );
    } catch (e: unknown) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Impossible d’enregistrer l’établissement.',
      );
    } finally {
      setSaving(false);
    }
  };

  const setVisibility = async (next: 'active' | 'hidden' | 'draft') => {
    if (!user || !establishmentId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('hotel_establishments')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', establishmentId)
        .eq('host_id', user.id);
      if (error) throw error;
      setStatus(next);
      Alert.alert(
        'OK',
        next === 'active'
          ? 'Établissement publié.'
          : next === 'hidden'
            ? 'Établissement masqué.'
            : 'Repassé en brouillon.',
      );
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!user || !establishmentId) return;
    Alert.alert('Supprimer', 'Supprimer définitivement cet établissement ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
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
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression impossible');
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Modifier l’établissement' : 'Nouvel établissement'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Hôtel</Text>
          <Text style={styles.title}>
            {isEdit ? 'Modifier votre établissement' : 'Créer votre établissement'}
          </Text>

          <Text style={styles.label}>Nom de l’établissement *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex. Hôtel Palm Abidjan"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {ESTABLISHMENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setEstablishmentType(t.value)}
                style={[styles.chip, establishmentType === t.value && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, establishmentType === t.value && styles.chipTextActive]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Localisation *</Text>
          <Text style={styles.hint}>
            Recherchez une ville, commune ou quartier avec autocomplétion.
          </Text>
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
            placeholder="Rechercher ville, commune ou quartier…"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Complément d’adresse</Text>
          <TextInput
            style={styles.input}
            value={addressDetails}
            onChangeText={setAddressDetails}
            placeholder="Rue, immeuble, repère…"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Position sur la carte</Text>
          <Text style={styles.hint}>
            Affinez avec le GPS ou en déplaçant le pin après la sélection.
          </Text>
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

          <Text style={[styles.label, { marginTop: 16 }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Présentez votre établissement…"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Photos de l’établissement</Text>
          <Text style={styles.hint}>Ajoutez vos photos depuis la galerie (max. {MAX_PHOTOS}).</Text>
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
                <Text style={styles.photoAddText}>Ajouter</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submit, saving && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isEdit ? 'Enregistrer' : 'Créer l’établissement'}
              </Text>
            )}
          </TouchableOpacity>

          {isEdit && establishmentId ? (
            <View style={styles.manageBlock}>
              <Text style={styles.manageTitle}>Gestion</Text>
              <Text style={styles.statusLine}>
                Statut :{' '}
                {status === 'active' ? 'Publié' : status === 'hidden' ? 'Masqué' : 'Brouillon'}
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
                <Text style={styles.secondaryBtnText}>Types de chambres</Text>
              </TouchableOpacity>

              {status !== 'active' ? (
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => void setVisibility('active')}
                  disabled={saving}
                >
                  <Text style={styles.publishBtnText}>Publier</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.hideBtn}
                  onPress={() => void setVisibility('hidden')}
                  disabled={saving}
                >
                  <Text style={styles.hideBtnText}>Masquer</Text>
                </TouchableOpacity>
              )}

              {status === 'hidden' ? (
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => void setVisibility('active')}
                  disabled={saving}
                >
                  <Text style={styles.publishBtnText}>Remettre en ligne</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
                <Text style={styles.deleteBtnText}>Supprimer l’établissement</Text>
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
  deleteBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteBtnText: { color: '#c62828', fontWeight: '600' },
});
