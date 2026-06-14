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
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useHostHotels } from '../hooks/useHostHotels';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { supabase } from '../services/supabase';
import { HOTEL_COLORS } from '../constants/colors';
import {
  HOTEL_CANCELLATION_POLICIES,
  HOTEL_ESTABLISHMENT_AMENITIES,
  HOTEL_ESTABLISHMENT_TYPES,
  HOTEL_ROOM_AMENITIES,
  HOTEL_ROOM_CATEGORIES,
  HOTEL_WIZARD_STEPS,
  getRoomCategoryLabel,
  type HotelCancellationPolicy,
  type HotelRoomCategory,
} from '../constants/hotelListingForm';
import type { HotelEstablishmentType } from '../types';
import AdminCreateForUserPanel, { AdminTargetUser } from '../components/admin/AdminCreateForUserPanel';

interface WizardRoomDraft {
  tempId: string;
  room_category: HotelRoomCategory;
  name: string;
  description: string;
  max_guests: string;
  bedrooms: string;
  bathrooms: string;
  price_per_night: string;
  cleaning_fee: string;
  inventory_count: string;
  minimum_nights: string;
  amenities: string[];
  imageUris: string[];
}

const emptyRoomDraft = (): WizardRoomDraft => ({
  tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  room_category: 'standard',
  name: '',
  description: '',
  max_guests: '2',
  bedrooms: '1',
  bathrooms: '1',
  price_per_night: '',
  cleaning_fee: '0',
  inventory_count: '1',
  minimum_nights: '1',
  amenities: [],
  imageUris: [],
});

const AddHotelEstablishmentScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { createEstablishment, createRoomType, loading } = useHostHotels();

  const [step, setStep] = useState(1);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [customAmenities, setCustomAmenities] = useState('');
  const [rooms, setRooms] = useState<WizardRoomDraft[]>([]);
  const [roomDraft, setRoomDraft] = useState<WizardRoomDraft>(emptyRoomDraft());
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCreateForEnabled, setAdminCreateForEnabled] = useState(false);
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    establishment_type: '' as HotelEstablishmentType | '',
    address: '',
    address_details: '',
    star_rating: '',
    check_in_time: '14:00',
    check_out_time: '11:00',
    house_rules: '',
    cancellation_policy: 'flexible' as HotelCancellationPolicy,
  });

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const totalSteps = HOTEL_WIZARD_STEPS.length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      const { data } = await supabase.rpc('is_admin');
      if (!cancelled) setIsAdmin(data === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const pickImages = async (target: 'establishment' | 'room') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Accès aux photos nécessaire.');
      return;
    }
    const current = target === 'establishment' ? imageUris : roomDraft.imageUris;
    const maxTotal = target === 'room' ? 10 : 20;
    const limit = maxTotal - current.length;
    if (limit <= 0) {
      Alert.alert(
        'Limite',
        target === 'room' ? 'Maximum 10 photos par chambre.' : 'Maximum 20 photos.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      const uris = result.assets.map((a) => a.uri);
      if (target === 'establishment') {
        setImageUris((prev) => [...prev, ...uris]);
      } else {
        setRoomDraft((prev) => ({ ...prev, imageUris: [...prev.imageUris, ...uris] }));
      }
    }
  };

  const toggleAmenity = (name: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(name) ? list.filter((a) => a !== name) : [...list, name]);
  };

  const parseCustomAmenities = (text: string): string[] =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const canGoNext = (): boolean => {
    switch (step) {
      case 1:
        return Boolean(form.establishment_type);
      case 2:
        return Boolean(locationLabel.trim() || form.address.trim());
      case 3:
        return Boolean(form.title.trim());
      case 4:
        return Boolean(form.cancellation_policy);
      case 5:
        return true;
      case 6:
        return true;
      case 7:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!canGoNext()) {
      Alert.alert('Champs requis', 'Complétez les informations de cette étape.');
      return;
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  const addRoomToList = () => {
    if (!roomDraft.name.trim()) {
      Alert.alert('Champ requis', 'Donnez un nom à ce type de chambre.');
      return;
    }
    const price = parseInt(roomDraft.price_per_night, 10);
    if (isNaN(price) || price < 1000) {
      Alert.alert('Prix invalide', 'Prix par nuit minimum 1 000 FCFA.');
      return;
    }
    setRooms((prev) => [...prev, { ...roomDraft }]);
    setRoomDraft(emptyRoomDraft());
    setShowRoomForm(false);
  };

  const removeRoom = (tempId: string) => {
    setRooms((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const uploadAllImages = async (uris: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of uris) {
      urls.push(await uploadImageToStorage(uri));
    }
    return urls;
  };

  const handleSubmit = async (publish: boolean) => {
    if (!form.title.trim() || !form.establishment_type) {
      Alert.alert('Champs requis', 'Nom et type d\'établissement obligatoires.');
      return;
    }
    if (adminCreateForEnabled && !adminTargetUser) {
      Alert.alert(
        'Utilisateur requis',
        'Vérifiez le compte du gestionnaire hôtel avant de créer l\'établissement.',
      );
      return;
    }
    if (publish && rooms.length === 0) {
      Alert.alert(
        'Chambres requises',
        'Ajoutez au moins un type de chambre avant de publier.',
      );
      return;
    }

    setUploadingImages(true);
    try {
      let establishmentImages: string[] = [];
      if (imageUris.length > 0) {
        establishmentImages = await uploadAllImages(imageUris);
      }

      const starRating = form.star_rating ? parseInt(form.star_rating, 10) : null;
      const allAmenities = [
        ...selectedAmenities,
        ...parseCustomAmenities(customAmenities),
      ];

      const estResult = await createEstablishment(
        {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          establishment_type: form.establishment_type,
          location_id: locationId,
          address: form.address.trim() || locationLabel || undefined,
          address_details: form.address_details.trim() || undefined,
          star_rating: starRating && starRating >= 1 && starRating <= 5 ? starRating : null,
          amenities: allAmenities,
          imageUrls: establishmentImages,
          check_in_time: form.check_in_time || undefined,
          check_out_time: form.check_out_time || undefined,
          cancellation_policy: form.cancellation_policy,
          house_rules: form.house_rules.trim() || undefined,
          status: publish ? 'active' : 'draft',
        },
        adminCreateForEnabled && adminTargetUser
          ? { hostId: adminTargetUser.user_id }
          : undefined,
      );

      if (!estResult.success || !estResult.establishmentId) {
        Alert.alert('Erreur', estResult.error || 'Impossible de créer l\'établissement.');
        return;
      }

      const establishmentId = estResult.establishmentId;

      for (const room of rooms) {
        let roomImages: string[] = [];
        if (room.imageUris.length > 0) {
          roomImages = await uploadAllImages(room.imageUris);
        }
        const roomResult = await createRoomType({
          establishment_id: establishmentId,
          name: room.name.trim(),
          room_category: room.room_category,
          description: room.description.trim() || undefined,
          max_guests: parseInt(room.max_guests, 10) || 1,
          bedrooms: parseInt(room.bedrooms, 10) || 1,
          bathrooms: parseInt(room.bathrooms, 10) || 1,
          price_per_night: parseInt(room.price_per_night, 10),
          cleaning_fee: parseInt(room.cleaning_fee, 10) || 0,
          inventory_count: parseInt(room.inventory_count, 10) || 1,
          minimum_nights: parseInt(room.minimum_nights, 10) || 1,
          amenities: room.amenities,
          imageUrls: roomImages,
        });
        if (!roomResult.success) {
          Alert.alert('Attention', `Établissement créé mais chambre « ${room.name} » non enregistrée.`);
        }
      }

      const createdForName =
        adminCreateForEnabled && adminTargetUser ? adminTargetUser.full_name : null;

      Alert.alert(
        'Succès',
        createdForName
          ? publish
            ? `Établissement publié pour le compte de ${createdForName}.`
            : `Brouillon créé pour le compte de ${createdForName}.`
          : publish
            ? 'Établissement publié avec succès.'
            : 'Brouillon enregistré. Vous pourrez ajouter des chambres plus tard.',
        createdForName
          ? [{ text: 'OK', onPress: () => navigation.goBack() }]
          : [
              {
                text: 'Gérer',
                onPress: () =>
                  navigation.replace('HotelEstablishmentManagement', { establishmentId }),
              },
              { text: 'OK', onPress: () => navigation.goBack() },
            ],
      );
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer certaines photos ou de finaliser.');
    } finally {
      setUploadingImages(false);
    }
  };

  const typeLabel = HOTEL_ESTABLISHMENT_TYPES.find((t) => t.value === form.establishment_type);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Text style={styles.sectionTitle}>Quel type d&apos;établissement ?</Text>
            {HOTEL_ESTABLISHMENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeCard,
                  form.establishment_type === type.value && styles.typeCardSelected,
                ]}
                onPress={() => set('establishment_type', type.value)}
              >
                <Text style={styles.typeEmoji}>{type.icon}</Text>
                <Text style={styles.typeLabel}>{type.label}</Text>
                {form.establishment_type === type.value && (
                  <Ionicons name="checkmark-circle" size={22} color={HOTEL_COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.sectionTitle}>Où se situe l&apos;établissement ?</Text>
            <Text style={styles.label}>Ville / quartier *</Text>
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
              placeholder="Rechercher une ville"
            />
            <Text style={styles.label}>Adresse</Text>
            <TextInput
              style={styles.input}
              value={form.address}
              onChangeText={(v) => set('address', v)}
              placeholder="Rue, numéro, quartier..."
            />
            <Text style={styles.label}>Complément d&apos;adresse</Text>
            <TextInput
              style={styles.input}
              value={form.address_details}
              onChangeText={(v) => set('address_details', v)}
              placeholder="Bâtiment, étage, repères..."
            />
          </>
        );

      case 3:
        return (
          <>
            <Text style={styles.sectionTitle}>Présentez votre établissement</Text>
            <Text style={styles.label}>Nom *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => set('title', v)}
              placeholder="Ex. Hôtel Cocody Riviera"
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              multiline
              placeholder="Atouts, ambiance, services..."
            />
            <Text style={styles.label}>Classification (étoiles, 1 à 5)</Text>
            <TextInput
              style={styles.input}
              value={form.star_rating}
              onChangeText={(v) => set('star_rating', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={1}
              placeholder="Optionnel"
            />
          </>
        );

      case 4:
        return (
          <>
            <Text style={styles.sectionTitle}>Horaires & politiques</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Arrivée</Text>
                <TextInput
                  style={styles.input}
                  value={form.check_in_time}
                  onChangeText={(v) => set('check_in_time', v)}
                  placeholder="14:00"
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Départ</Text>
                <TextInput
                  style={styles.input}
                  value={form.check_out_time}
                  onChangeText={(v) => set('check_out_time', v)}
                  placeholder="11:00"
                />
              </View>
            </View>
            <Text style={styles.label}>Politique d&apos;annulation *</Text>
            {HOTEL_CANCELLATION_POLICIES.map((policy) => (
              <TouchableOpacity
                key={policy.value}
                style={[
                  styles.policyCard,
                  form.cancellation_policy === policy.value && styles.policyCardSelected,
                ]}
                onPress={() => set('cancellation_policy', policy.value)}
              >
                <Text style={styles.policyLabel}>{policy.label}</Text>
                <Text style={styles.policyDesc}>{policy.description}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>Règlement intérieur</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.house_rules}
              onChangeText={(v) => set('house_rules', v)}
              multiline
              placeholder="Animaux, fumeurs, enfants..."
            />
          </>
        );

      case 5:
        return (
          <>
            <Text style={styles.sectionTitle}>Équipements de l&apos;établissement</Text>
            <View style={styles.chips}>
              {HOTEL_ESTABLISHMENT_AMENITIES.map((amenity) => {
                const selected = selectedAmenities.includes(amenity);
                return (
                  <TouchableOpacity
                    key={amenity}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() =>
                      toggleAmenity(amenity, selectedAmenities, setSelectedAmenities)
                    }
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {amenity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.label}>Autres équipements (séparés par des virgules)</Text>
            <TextInput
              style={styles.input}
              value={customAmenities}
              onChangeText={setCustomAmenities}
              placeholder="Ex. Piscine chauffée, Navette gratuite"
            />
          </>
        );

      case 6:
        return (
          <>
            <Text style={styles.sectionTitle}>Photos de l&apos;établissement</Text>
            <TouchableOpacity style={styles.addPhotoBtn} onPress={() => pickImages('establishment')}>
              <Ionicons name="camera-outline" size={22} color={HOTEL_COLORS.primary} />
              <Text style={styles.addPhotoText}>Ajouter des photos</Text>
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
          </>
        );

      case 7:
        return (
          <>
            <Text style={styles.sectionTitle}>Types de chambres</Text>
            <Text style={styles.hint}>
              Ajoutez au moins une chambre pour publier. Chaque type = une catégorie vendable
              (Standard, Suite…) avec son prix et son stock.
            </Text>

            {rooms.map((room) => (
              <View key={room.tempId} style={styles.roomSummary}>
                <View style={styles.roomSummaryBody}>
                  <Text style={styles.roomSummaryTitle}>{room.name}</Text>
                  <Text style={styles.roomSummaryMeta}>
                    {getRoomCategoryLabel(room.room_category)} • {room.price_per_night} F/nuit •{' '}
                    {room.inventory_count} unité(s)
                    {room.imageUris.length > 0 ? ` • ${room.imageUris.length} photo(s)` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeRoom(room.tempId)}>
                  <Ionicons name="trash-outline" size={20} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}

            {!showRoomForm ? (
              <TouchableOpacity style={styles.addRoomBtn} onPress={() => setShowRoomForm(true)}>
                <Ionicons name="add-circle-outline" size={22} color={HOTEL_COLORS.primary} />
                <Text style={styles.addRoomText}>Ajouter un type de chambre</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.roomForm}>
                <Text style={styles.label}>Catégorie *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
                  {HOTEL_ROOM_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.catChip,
                        roomDraft.room_category === cat.value && styles.catChipSelected,
                      ]}
                      onPress={() =>
                        setRoomDraft((prev) => ({ ...prev, room_category: cat.value }))
                      }
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          roomDraft.room_category === cat.value && styles.catChipTextSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.label}>Nom du type *</Text>
                <TextInput
                  style={styles.input}
                  value={roomDraft.name}
                  onChangeText={(v) => setRoomDraft((p) => ({ ...p, name: v }))}
                  placeholder="Ex. Suite Deluxe vue lagune"
                />

                <View style={styles.row}>
                  <View style={styles.third}>
                    <Text style={styles.label}>Pers.</Text>
                    <TextInput
                      style={styles.input}
                      value={roomDraft.max_guests}
                      onChangeText={(v) =>
                        setRoomDraft((p) => ({ ...p, max_guests: v.replace(/[^0-9]/g, '') }))
                      }
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.third}>
                    <Text style={styles.label}>Stock</Text>
                    <TextInput
                      style={styles.input}
                      value={roomDraft.inventory_count}
                      onChangeText={(v) =>
                        setRoomDraft((p) => ({ ...p, inventory_count: v.replace(/[^0-9]/g, '') }))
                      }
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.third}>
                    <Text style={styles.label}>Prix/nuit</Text>
                    <TextInput
                      style={styles.input}
                      value={roomDraft.price_per_night}
                      onChangeText={(v) =>
                        setRoomDraft((p) => ({ ...p, price_per_night: v.replace(/[^0-9]/g, '') }))
                      }
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Équipements chambre</Text>
                <View style={styles.chips}>
                  {HOTEL_ROOM_AMENITIES.slice(0, 8).map((amenity) => {
                    const selected = roomDraft.amenities.includes(amenity);
                    return (
                      <TouchableOpacity
                        key={amenity}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() =>
                          toggleAmenity(amenity, roomDraft.amenities, (next) =>
                            setRoomDraft((p) => ({ ...p, amenities: next })),
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

                <TouchableOpacity
                  style={styles.addPhotoBtn}
                  onPress={() => pickImages('room')}
                >
                  <Ionicons name="image-outline" size={20} color={HOTEL_COLORS.primary} />
                  <Text style={styles.addPhotoText}>
                    Photos chambre ({roomDraft.imageUris.length}/10)
                  </Text>
                </TouchableOpacity>
                {roomDraft.imageUris.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.photoRow}
                  >
                    {roomDraft.imageUris.map((uri, index) => (
                      <View key={`${uri}-${index}`} style={styles.photoWrap}>
                        <Image source={{ uri }} style={styles.photo} />
                        <TouchableOpacity
                          style={styles.removePhoto}
                          onPress={() =>
                            setRoomDraft((prev) => ({
                              ...prev,
                              imageUris: prev.imageUris.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                <View style={styles.roomFormActions}>
                  <TouchableOpacity
                    style={styles.cancelRoomBtn}
                    onPress={() => {
                      setShowRoomForm(false);
                      setRoomDraft(emptyRoomDraft());
                    }}
                  >
                    <Text style={styles.cancelRoomText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmRoomBtn} onPress={addRoomToList}>
                    <Text style={styles.confirmRoomText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>{form.title || 'Sans titre'}</Text>
              <Text style={styles.summaryMeta}>
                {typeLabel?.label} • {rooms.length} chambre(s) •{' '}
                {form.cancellation_policy}
              </Text>
            </View>
          </>
        );

      default:
        return null;
    }
  };

  const busy = loading || uploadingImages;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name={step === 1 ? 'close' : 'arrow-back'} size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nouvel hôtel</Text>
          <Text style={styles.headerStep}>
            Étape {step}/{totalSteps} — {HOTEL_WIZARD_STEPS[step - 1]}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {isAdmin && step === 1 ? (
            <AdminCreateForUserPanel
              assetKind="hotel"
              enabled={adminCreateForEnabled}
              onEnabledChange={setAdminCreateForEnabled}
              targetUser={adminTargetUser}
              onTargetUserChange={setAdminTargetUser}
            />
          ) : null}
          {renderStepContent()}
        </ScrollView>

        <View style={styles.footer}>
          {step < totalSteps ? (
            <TouchableOpacity
              style={[styles.nextBtn, !canGoNext() && styles.btnDisabled]}
              onPress={handleNext}
              disabled={!canGoNext()}
            >
              <Text style={styles.nextBtnText}>Suivant</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.finalActions}>
              <TouchableOpacity
                style={styles.draftBtn}
                onPress={() => handleSubmit(false)}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={HOTEL_COLORS.primary} />
                ) : (
                  <Text style={styles.draftBtnText}>Brouillon</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.publishBtn, rooms.length === 0 && styles.btnDisabled]}
                onPress={() => handleSubmit(true)}
                disabled={busy || rooms.length === 0}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.publishBtnText}>Publier</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
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
  },
  backBtn: { marginRight: 12 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  headerStep: { fontSize: 12, color: HOTEL_COLORS.primary, marginTop: 2 },
  progressTrack: { height: 4, backgroundColor: '#e2e8f0' },
  progressFill: { height: 4, backgroundColor: HOTEL_COLORS.primary },
  scrollContent: { padding: 16, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 14,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
  hint: { fontSize: 13, color: '#64748b', lineHeight: 20, marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  third: { flex: 1 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  typeCardSelected: { borderColor: HOTEL_COLORS.primary, backgroundColor: HOTEL_COLORS.light },
  typeEmoji: { fontSize: 24 },
  typeLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#334155' },
  policyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  policyCardSelected: { borderColor: HOTEL_COLORS.primary, backgroundColor: HOTEL_COLORS.light },
  policyLabel: { fontSize: 15, fontWeight: '700', color: '#334155' },
  policyDesc: { fontSize: 13, color: '#64748b', marginTop: 4 },
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
  roomSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  roomSummaryBody: { flex: 1 },
  roomSummaryTitle: { fontSize: 15, fontWeight: '700', color: '#334155' },
  roomSummaryMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  addRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOTEL_COLORS.primary,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  addRoomText: { color: HOTEL_COLORS.primary, fontWeight: '700' },
  roomForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
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
  roomFormActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelRoomBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelRoomText: { color: '#64748b', fontWeight: '600' },
  confirmRoomBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: HOTEL_COLORS.primary,
  },
  confirmRoomText: { color: '#fff', fontWeight: '700' },
  summaryBox: {
    backgroundColor: HOTEL_COLORS.light,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: HOTEL_COLORS.dark },
  summaryMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  nextBtn: {
    backgroundColor: HOTEL_COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  finalActions: { flexDirection: 'row', gap: 10 },
  draftBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: HOTEL_COLORS.primary,
    alignItems: 'center',
  },
  draftBtnText: { color: HOTEL_COLORS.primary, fontWeight: '700' },
  publishBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: HOTEL_COLORS.primary,
    alignItems: 'center',
  },
  publishBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
});

export default AddHotelEstablishmentScreen;
