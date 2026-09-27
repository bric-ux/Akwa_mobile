import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import type { RootStackParamList } from '../types';
import { HOTEL_COLORS } from '../constants/colors';

type Route = RouteProp<RootStackParamList, 'HotelEstablishmentDetail'>;

export default function HotelEstablishmentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { establishmentId } = route.params;
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('hotel_establishments')
        .select('*')
        .eq('id', establishmentId)
        .eq('status', 'active')
        .eq('hidden_by_admin', false)
        .maybeSingle();
      if (!cancelled) {
        setItem(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [establishmentId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Hôtel
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      ) : !item ? (
        <Text style={styles.empty}>Établissement introuvable.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {Array.isArray(item.images) && item.images[0] ? (
            <Image source={{ uri: item.images[0] }} style={styles.hero} resizeMode="cover" />
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Ionicons name="business-outline" size={48} color="#fff" />
            </View>
          )}
          <Text style={styles.title}>{item.title}</Text>
          {item.star_rating ? (
            <Text style={styles.meta}>{item.star_rating}★ · {item.establishment_type}</Text>
          ) : (
            <Text style={styles.meta}>{item.establishment_type}</Text>
          )}
          {item.address ? (
            <Text style={styles.address}>
              <Ionicons name="location-outline" size={14} color="#666" /> {item.address}
            </Text>
          ) : null}
          {item.description ? (
            <Text style={styles.desc}>{item.description}</Text>
          ) : (
            <Text style={styles.desc}>
              Réservation en ligne bientôt disponible. Contactez l’établissement pour réserver.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#333' },
  empty: { marginTop: 40, textAlign: 'center', color: '#666' },
  content: { paddingBottom: 40 },
  hero: { width: '100%', height: 220, backgroundColor: HOTEL_COLORS.primary },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  title: {
    marginTop: 16,
    marginHorizontal: 20,
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  meta: { marginHorizontal: 20, marginTop: 6, fontSize: 14, color: HOTEL_COLORS.primary, fontWeight: '600' },
  address: { marginHorizontal: 20, marginTop: 8, fontSize: 14, color: '#666' },
  desc: { marginHorizontal: 20, marginTop: 16, fontSize: 15, lineHeight: 22, color: '#444' },
});
