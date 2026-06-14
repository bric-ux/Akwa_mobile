import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { HOST_COLORS, VEHICLE_COLORS, HOTEL_COLORS } from '../constants/colors';

const LISTING_OPTIONS = [
  {
    id: 'property',
    title: 'Résidence meublée',
    subtitle: 'Appartement, maison, villa — court séjour',
    icon: 'home-outline' as const,
    color: HOST_COLORS.primary,
    light: HOST_COLORS.light,
    route: 'BecomeHost' as const,
  },
  {
    id: 'vehicle',
    title: 'Véhicule',
    subtitle: 'Voiture, SUV, van — location à la journée',
    icon: 'car-outline' as const,
    color: VEHICLE_COLORS.primary,
    light: VEHICLE_COLORS.light,
    route: 'AddVehicle' as const,
  },
  {
    id: 'hotel',
    title: 'Hôtel & Appart\'hôtel',
    subtitle: 'Établissement multi-chambres avec inventaire',
    icon: 'bed-outline' as const,
    color: HOTEL_COLORS.primary,
    light: HOTEL_COLORS.light,
    route: 'AddHotelEstablishment' as const,
  },
];

const AddListingChoiceScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter un bien</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.intro}>
          Choisissez le type de bien que vous souhaitez proposer sur AkwaHome.
        </Text>

        {LISTING_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.card, { borderColor: option.color }]}
            onPress={() => navigation.navigate(option.route)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, { backgroundColor: option.light }]}>
              <Ionicons name={option.icon} size={28} color={option.color} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#cbd5e1" />
          </TouchableOpacity>
        ))}
      </View>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  content: { padding: 20, gap: 14 },
  intro: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
});

export default AddListingChoiceScreen;
