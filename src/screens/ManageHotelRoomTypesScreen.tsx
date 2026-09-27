import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { HOTEL_COLORS } from '../constants/colors';
import type { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'ManageHotelRoomTypes'>;

const MAX_ROOM_PHOTOS = 10;

const ROOM_CATEGORIES = [
  { value: 'standard', label: 'Standard', defaultName: 'Chambre Standard', guests: '2' },
  { value: 'double', label: 'Double', defaultName: 'Chambre Double', guests: '2' },
  { value: 'twin', label: 'Twin', defaultName: 'Chambre Twin', guests: '2' },
  { value: 'deluxe', label: 'Deluxe', defaultName: 'Chambre Deluxe', guests: '2' },
  { value: 'suite', label: 'Suite', defaultName: 'Suite', guests: '3' },
  { value: 'family', label: 'Familiale', defaultName: 'Chambre Familiale', guests: '4' },
  { value: 'studio', label: 'Studio', defaultName: 'Studio', guests: '2' },
  { value: 'executive', label: 'Executive', defaultName: 'Chambre Executive', guests: '2' },
  { value: 'other', label: 'Autre', defaultName: '', guests: '2' },
] as const;

type RoomType = {
  id: string;
  name: string;
  price_per_night: number;
  inventory_count: number;
  max_guests: number;
  status: string;
  cleaning_fee: number;
  room_category: string | null;
  images?: string[] | null;
};

const emptyForm = {
  room_category: 'standard',
  name: 'Chambre Standard',
  price_per_night: '',
  inventory_count: '1',
  max_guests: '2',
  cleaning_fee: '0',
};

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

export default function ManageHotelRoomTypesScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { establishmentId, establishmentTitle } = route.params;
  const { user } = useAuth();
  const [rows, setRows] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_room_types')
        .select(
          'id, name, price_per_night, inventory_count, max_guests, status, cleaning_fee, room_category, images',
        )
        .eq('establishment_id', establishmentId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setRows((data as RoomType[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, establishmentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const applyCategory = (category: string) => {
    const preset = ROOM_CATEGORIES.find((c) => c.value === category);
    setForm((f) => ({
      ...f,
      room_category: category,
      name: preset?.defaultName || f.name,
      max_guests: preset?.guests || f.max_guests,
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageUris([]);
    setModalOpen(true);
  };

  const openEdit = (row: RoomType) => {
    setEditingId(row.id);
    setForm({
      room_category: row.room_category || 'other',
      name: row.name,
      price_per_night: String(row.price_per_night),
      inventory_count: String(row.inventory_count),
      max_guests: String(row.max_guests),
      cleaning_fee: String(row.cleaning_fee || 0),
    });
    setImageUris(Array.isArray(row.images) ? row.images.map(String).filter(Boolean) : []);
    setModalOpen(true);
  };

  const pickImages = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l’accès à vos photos.');
      return;
    }
    const limit = MAX_ROOM_PHOTOS - imageUris.length;
    if (limit <= 0) {
      Alert.alert('Limite', `Max. ${MAX_ROOM_PHOTOS} photos par type.`);
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

  const handleSave = async () => {
    if (!user) return;
    const name = form.name.trim();
    const price = parseInt(form.price_per_night, 10);
    const inventory = Math.max(1, parseInt(form.inventory_count, 10) || 1);
    const maxGuests = parseInt(form.max_guests, 10) || 1;
    const cleaning = parseInt(form.cleaning_fee, 10) || 0;
    if (!name || !Number.isFinite(price) || price <= 0) {
      Alert.alert('Champs requis', 'Nom et prix / nuit (> 0) sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      const images: string[] = [];
      for (const uri of imageUris) {
        images.push(await uploadHotelImage(uri, user.id));
      }
      const payload = {
        name,
        room_category: form.room_category || null,
        price_per_night: price,
        inventory_count: inventory,
        max_guests: maxGuests,
        cleaning_fee: cleaning,
        images,
      };
      if (editingId) {
        const { error } = await supabase
          .from('hotel_room_types')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hotel_room_types').insert({
          establishment_id: establishmentId,
          ...payload,
          status: 'active',
        });
        if (error) throw error;
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const toggleHide = async (row: RoomType) => {
    const next = row.status === 'active' ? 'hidden' : 'active';
    const { error } = await supabase
      .from('hotel_room_types')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) Alert.alert('Erreur', error.message);
    else void load();
  };

  const handleDelete = (row: RoomType) => {
    Alert.alert('Supprimer', `Supprimer « ${row.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('hotel_room_types').delete().eq('id', row.id);
          if (error) Alert.alert('Erreur', error.message);
          else void load();
        },
      },
    ]);
  };

  const categoryLabel = (value: string | null) =>
    ROOM_CATEGORIES.find((c) => c.value === value)?.label || null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Types de chambres</Text>
          {!!establishmentTitle && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {establishmentTitle}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.helpBanner}>
        <Ionicons name="information-circle-outline" size={18} color={HOTEL_COLORS.primary} />
        <Text style={styles.helpText}>
          Un type = une catégorie (ex. Standard). Indiquez combien de chambres identiques vous avez
          — pas besoin de les créer une par une.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Aucun type de chambre</Text>
              <Text style={styles.emptyText}>
                Exemple : « Standard » × 12 chambres, « Suite » × 3. Un enregistrement suffit par
                catégorie.
              </Text>
              <TouchableOpacity style={styles.cta} onPress={openCreate}>
                <Text style={styles.ctaText}>Ajouter un type</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {categoryLabel(item.room_category) ? (
                  <Text style={styles.cardCategory}>{categoryLabel(item.room_category)}</Text>
                ) : null}
                <Text style={styles.cardMeta}>
                  {item.price_per_night.toLocaleString('fr-FR')} FCFA / nuit ·{' '}
                  {item.inventory_count} chambre{item.inventory_count > 1 ? 's' : ''} ·{' '}
                  {item.max_guests} pers.
                </Text>
                <Text style={styles.cardStatus}>
                  {item.status === 'active' ? 'Actif' : 'Masqué'}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                  <Ionicons name="pencil" size={18} color={HOTEL_COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void toggleHide(item)} style={styles.iconBtn}>
                  <Ionicons
                    name={item.status === 'active' ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#5c6bc0"
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color="#c62828" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingId ? 'Modifier le type' : 'Nouveau type de chambre'}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.chips}>
                {ROOM_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => applyCategory(c.value)}
                    style={[
                      styles.chip,
                      form.room_category === c.value && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        form.room_category === c.value && styles.chipTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Nom affiché *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Ex. Chambre Standard"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.label}>Combien de chambres de ce type ? *</Text>
              <Text style={styles.fieldHint}>
                Toutes les chambres partagent le même prix et les mêmes photos.
              </Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      inventory_count: String(Math.max(1, (parseInt(f.inventory_count, 10) || 1) - 1)),
                    }))
                  }
                >
                  <Ionicons name="remove" size={20} color="#0f172a" />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.stepperInput]}
                  keyboardType="number-pad"
                  value={form.inventory_count}
                  onChangeText={(v) => setForm((f) => ({ ...f, inventory_count: v }))}
                />
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      inventory_count: String((parseInt(f.inventory_count, 10) || 0) + 1),
                    }))
                  }
                >
                  <Ionicons name="add" size={20} color="#0f172a" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Prix / nuit (FCFA) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.price_per_night}
                onChangeText={(v) => setForm((f) => ({ ...f, price_per_night: v }))}
              />
              <Text style={styles.label}>Max voyageurs / chambre</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.max_guests}
                onChangeText={(v) => setForm((f) => ({ ...f, max_guests: v }))}
              />
              <Text style={styles.label}>Frais de ménage</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.cleaning_fee}
                onChangeText={(v) => setForm((f) => ({ ...f, cleaning_fee: v }))}
              />
              <Text style={styles.label}>Photos de la chambre</Text>
              <Text style={styles.fieldHint}>Depuis votre galerie (max. {MAX_ROOM_PHOTOS}).</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
                {imageUris.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={22} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ))}
                {imageUris.length < MAX_ROOM_PHOTOS ? (
                  <TouchableOpacity style={styles.photoAdd} onPress={pickImages}>
                    <Ionicons name="camera-outline" size={26} color="#64748b" />
                    <Text style={styles.photoAddText}>Ajouter</Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F5F2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  headerSub: { fontSize: 12, color: '#64748b' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: HOTEL_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBanner: {
    flexDirection: 'row',
    gap: 8,
    margin: 12,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  helpText: { flex: 1, fontSize: 13, color: '#1b5e20', lineHeight: 18 },
  list: { padding: 16, paddingTop: 0 },
  emptyWrap: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  emptyText: { marginTop: 6, fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: 16,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cardCategory: { marginTop: 2, fontSize: 12, fontWeight: '600', color: HOTEL_COLORS.primary },
  cardMeta: { marginTop: 4, fontSize: 13, color: '#64748b' },
  cardStatus: { marginTop: 4, fontSize: 12, fontWeight: '600', color: HOTEL_COLORS.primary },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  fieldHint: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  photosRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  photoWrap: { position: 'relative', marginRight: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#e2e8f0' },
  photoRemove: { position: 'absolute', top: -6, right: -6 },
  photoAdd: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  photoAddText: { marginTop: 2, fontSize: 11, color: '#64748b', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  chipActive: {
    borderColor: HOTEL_COLORS.primary,
    backgroundColor: HOTEL_COLORS.primary,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    flex: 1,
    marginBottom: 0,
    textAlign: 'center',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  cancelText: { fontWeight: '600', color: '#475569' },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: HOTEL_COLORS.primary,
  },
  saveText: { fontWeight: '700', color: '#fff' },
});
