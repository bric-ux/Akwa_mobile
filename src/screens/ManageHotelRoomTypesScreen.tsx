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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { supabase } from '../services/supabase';
import { HOTEL_COLORS } from '../constants/colors';
import type { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'ManageHotelRoomTypes'>;

type RoomType = {
  id: string;
  name: string;
  price_per_night: number;
  inventory_count: number;
  max_guests: number;
  status: string;
  cleaning_fee: number;
  images?: string[] | null;
};

const emptyForm = {
  name: '',
  price_per_night: '',
  inventory_count: '1',
  max_guests: '2',
  cleaning_fee: '0',
  image_url: '',
};

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
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hotel_room_types')
        .select('id, name, price_per_night, inventory_count, max_guests, status, cleaning_fee, images')
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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: RoomType) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      price_per_night: String(row.price_per_night),
      inventory_count: String(row.inventory_count),
      max_guests: String(row.max_guests),
      cleaning_fee: String(row.cleaning_fee || 0),
      image_url: Array.isArray(row.images) && row.images[0] ? row.images[0] : '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const name = form.name.trim();
    const price = parseInt(form.price_per_night, 10);
    const inventory = parseInt(form.inventory_count, 10) || 1;
    const maxGuests = parseInt(form.max_guests, 10) || 1;
    const cleaning = parseInt(form.cleaning_fee, 10) || 0;
    const images = form.image_url.trim() ? [form.image_url.trim()] : [];
    if (!name || !Number.isFinite(price) || price <= 0) {
      Alert.alert('Champs requis', 'Nom et prix / nuit (> 0) sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('hotel_room_types')
          .update({
            name,
            price_per_night: price,
            inventory_count: inventory,
            max_guests: maxGuests,
            cleaning_fee: cleaning,
            images,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hotel_room_types').insert({
          establishment_id: establishmentId,
          name,
          price_per_night: price,
          inventory_count: inventory,
          max_guests: maxGuests,
          cleaning_fee: cleaning,
          images,
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
                Ajoutez au moins un type pour permettre les réservations.
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
                <Text style={styles.cardMeta}>
                  {item.price_per_night.toLocaleString('fr-FR')} FCFA / nuit · {item.inventory_count}{' '}
                  ch. · {item.max_guests} pers.
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
              <Text style={styles.label}>Nom *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Ex. Chambre Standard"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.label}>Prix / nuit (FCFA) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.price_per_night}
                onChangeText={(v) => setForm((f) => ({ ...f, price_per_night: v }))}
              />
              <Text style={styles.label}>Nombre de chambres</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={form.inventory_count}
                onChangeText={(v) => setForm((f) => ({ ...f, inventory_count: v }))}
              />
              <Text style={styles.label}>Max voyageurs</Text>
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
              <Text style={styles.label}>Photo de la chambre (URL)</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                value={form.image_url}
                onChangeText={(v) => setForm((f) => ({ ...f, image_url: v }))}
                placeholder="https://…"
                placeholderTextColor="#94a3b8"
              />
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
  list: { padding: 16 },
  emptyWrap: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  emptyText: { marginTop: 6, fontSize: 14, color: '#64748b', textAlign: 'center' },
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
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
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
