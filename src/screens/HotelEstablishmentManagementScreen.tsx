import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useHostHotels } from '../hooks/useHostHotels';
import { HOTEL_COLORS } from '../constants/colors';
import {
  getEstablishmentLocationLabel,
  getEstablishmentTypeLabel,
  getHotelCoverUrl,
  getActiveRoomTypes,
} from '../lib/hotelUtils';
import type { HotelEstablishment, RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'HotelEstablishmentManagement'>;

const HotelEstablishmentManagementScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { establishmentId } = route.params;
  const { getEstablishmentById, setEstablishmentStatus, loading } = useHostHotels();
  const [establishment, setEstablishment] = useState<HotelEstablishment | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const load = useCallback(async () => {
    setLoadingData(true);
    const data = await getEstablishmentById(establishmentId);
    setEstablishment(data);
    setLoadingData(false);
  }, [establishmentId, getEstablishmentById]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleToggleStatus = () => {
    if (!establishment) return;

    if (establishment.hidden_by_admin) {
      Alert.alert('Masqué par l\'admin', 'Contactez le support pour réactiver cet établissement.');
      return;
    }

    const activeRooms = getActiveRoomTypes(establishment.hotel_room_types);
    if (establishment.status !== 'active' && activeRooms.length === 0) {
      Alert.alert(
        'Chambres requises',
        'Ajoutez au moins un type de chambre actif avant de publier.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ajouter des chambres',
            onPress: () => navigation.navigate('HotelRoomTypes', { establishmentId }),
          },
        ],
      );
      return;
    }

    const nextStatus = establishment.status === 'active' ? 'hidden' : 'active';
    const actionLabel = nextStatus === 'active' ? 'Publier' : 'Masquer';

    Alert.alert(
      actionLabel,
      nextStatus === 'active'
        ? 'Votre établissement sera visible par les voyageurs.'
        : 'Votre établissement ne sera plus visible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            const result = await setEstablishmentStatus(establishmentId, nextStatus);
            if (result.success) {
              load();
            } else {
              Alert.alert('Erreur', result.error);
            }
          },
        },
      ],
    );
  };

  if (loadingData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={HOTEL_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!establishment) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loader}>
          <Text style={styles.errorText}>Établissement introuvable</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cover = getHotelCoverUrl(establishment);
  const roomCount = establishment.hotel_room_types?.length ?? 0;
  const statusLabel =
    establishment.status === 'active'
      ? 'Publié'
      : establishment.status === 'hidden'
        ? 'Masqué'
        : 'Brouillon';

  const menuItems = [
    {
      id: 'edit',
      icon: 'create-outline' as const,
      title: 'Modifier l\'établissement',
      subtitle: 'Nom, description, photos, équipements',
      onPress: () => navigation.navigate('EditHotelEstablishment', { establishmentId }),
    },
    {
      id: 'rooms',
      icon: 'bed-outline' as const,
      title: 'Types de chambres',
      subtitle: `${roomCount} type${roomCount !== 1 ? 's' : ''} configuré${roomCount !== 1 ? 's' : ''}`,
      onPress: () => navigation.navigate('HotelRoomTypes', { establishmentId }),
    },
    {
      id: 'preview',
      icon: 'eye-outline' as const,
      title: 'Voir la fiche voyageur',
      subtitle: establishment.status === 'active' ? 'Aperçu public' : 'Disponible une fois publié',
      onPress: () => {
        if (establishment.status !== 'active') {
          Alert.alert('Non publié', 'Publiez l\'établissement pour le prévisualiser.');
          return;
        }
        navigation.navigate('HotelDetails', { establishmentId });
      },
      disabled: establishment.status !== 'active',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Gestion
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: cover }} style={styles.hero} />
        <View style={styles.heroInfo}>
          <Text style={styles.title}>{establishment.title}</Text>
          <Text style={styles.subtitle}>
            {getEstablishmentTypeLabel(establishment.establishment_type)}
            {getEstablishmentLocationLabel(establishment)
              ? ` • ${getEstablishmentLocationLabel(establishment)}`
              : ''}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    establishment.status === 'active'
                      ? '#dcfce7'
                      : establishment.status === 'hidden'
                        ? '#f1f5f9'
                        : '#fef3c7',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      establishment.status === 'active'
                        ? '#16a34a'
                        : establishment.status === 'hidden'
                          ? '#64748b'
                          : '#d97706',
                  },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            establishment.status === 'active' ? styles.toggleBtnHide : styles.toggleBtnPublish,
          ]}
          onPress={handleToggleStatus}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name={establishment.status === 'active' ? 'eye-off-outline' : 'checkmark-circle-outline'}
                size={20}
                color="#fff"
              />
              <Text style={styles.toggleBtnText}>
                {establishment.status === 'active' ? 'Masquer l\'établissement' : 'Publier l\'établissement'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
            onPress={item.onPress}
            disabled={item.disabled}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={22} color={HOTEL_COLORS.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: '#64748b', fontSize: 16 },
  link: { color: HOTEL_COLORS.primary, fontWeight: '600' },
  content: { paddingBottom: 32 },
  hero: { width: '100%', height: 200, backgroundColor: '#e2e8f0' },
  heroInfo: { padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  statusRow: { marginTop: 10 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  toggleBtnPublish: { backgroundColor: HOTEL_COLORS.primary },
  toggleBtnHide: { backgroundColor: '#64748b' },
  toggleBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  menuItemDisabled: { opacity: 0.5 },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: HOTEL_COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  menuSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
});

export default HotelEstablishmentManagementScreen;
