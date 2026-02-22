import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { supabase } from '../services/supabase';
import type { MonthlyRentalListing } from '../types';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import { useCurrency } from '../hooks/useCurrency';

type RouteProps = RouteProp<RootStackParamList, 'MonthlyRentalListingDetail'>;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MonthlyRentalListingDetailScreen: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const { listingId } = route.params;
  const { formatPrice } = useCurrency();
  const [listing, setListing] = useState<MonthlyRentalListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('monthly_rental_listings')
        .select('*')
        .eq('id', listingId)
        .eq('status', 'approved')
        .single();

      if (error || !data) {
        setListing(null);
        setLoading(false);
        return;
      }
      setListing(data as MonthlyRentalListing);
      setLoading(false);
    };
    load();
  }, [listingId]);

  const handlePostuler = () => {
    if (!listing) return;
    Alert.alert(
      'Postuler',
      'La candidature pour ce logement sera bientôt disponible. En attendant, vous pouvez contacter le propriétaire via Messages.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'OK' },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={MONTHLY_RENTAL_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Annonce introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const images = Array.isArray(listing.images) ? listing.images : [];
  const mainImage = images[0] || 'https://via.placeholder.com/400x250';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.badgeLongueDuree}>
          <Text style={styles.badgeText}>Location longue durée</Text>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: mainImage }} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.body}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.location}>📍 {listing.location}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(listing.monthly_rent_price)}</Text>
            <Text style={styles.priceUnit}>/mois</Text>
          </View>
          <View style={styles.specs}>
            <View style={styles.spec}>
              <Ionicons name="resize-outline" size={20} color="#666" />
              <Text style={styles.specText}>{listing.surface_m2} m²</Text>
            </View>
            <View style={styles.spec}>
              <Ionicons name="grid-outline" size={20} color="#666" />
              <Text style={styles.specText}>{listing.number_of_rooms} pièces</Text>
            </View>
            <View style={styles.spec}>
              <Ionicons name="bed-outline" size={20} color="#666" />
              <Text style={styles.specText}>{listing.bedrooms} chambres</Text>
            </View>
            <View style={styles.spec}>
              <Ionicons name="water-outline" size={20} color="#666" />
              <Text style={styles.specText}>{listing.bathrooms} SdB</Text>
            </View>
            {listing.is_furnished && (
              <View style={styles.spec}>
                <Ionicons name="cube-outline" size={20} color="#666" />
                <Text style={styles.specText}>Meublé</Text>
              </View>
            )}
          </View>
          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}
          {listing.amenities && listing.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Équipements</Text>
              <View style={styles.amenityList}>
                {listing.amenities.map((a, i) => (
                  <Text key={i} style={styles.amenityTag}>{a}</Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.postulerBtn} onPress={handlePostuler} activeOpacity={0.8}>
          <Ionicons name="document-text-outline" size={22} color="#fff" />
          <Text style={styles.postulerBtnText}>Postuler</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { padding: 8 },
  badgeLongueDuree: {
    flex: 1,
    alignItems: 'center',
  },
  badgeText: { fontSize: 14, fontWeight: '600', color: MONTHLY_RENTAL_COLORS.primary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#666' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  heroImage: { width: SCREEN_WIDTH, height: 250, backgroundColor: '#ddd' },
  body: { padding: 20, backgroundColor: '#fff', marginTop: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  location: { fontSize: 15, color: '#666', marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  price: { fontSize: 24, fontWeight: '700', color: MONTHLY_RENTAL_COLORS.primary },
  priceUnit: { fontSize: 16, color: '#666', marginLeft: 4 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  spec: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 8 },
  specText: { fontSize: 14, color: '#444', marginLeft: 6 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  description: { fontSize: 15, color: '#555', lineHeight: 22 },
  amenityList: { flexDirection: 'row', flexWrap: 'wrap' },
  amenityTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    fontSize: 13,
    color: '#555',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  postulerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  postulerBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

export default MonthlyRentalListingDetailScreen;
