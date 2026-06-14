import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { HOTEL_COLORS } from '../constants/colors';

const MyHotelBookingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Ionicons name="bed-outline" size={56} color="#cbd5e1" />
        <Text style={styles.title}>Aucune réservation hôtel</Text>
        <Text style={styles.subtitle}>
          Vos séjours en hôtel ou maison d&apos;hôtes apparaîtront ici.
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('HotelsTab')}
        >
          <Text style={styles.ctaText}>Découvrir les hôtels</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#334155' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: 12,
    backgroundColor: HOTEL_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: { color: '#fff', fontWeight: '700' },
});

export default MyHotelBookingsScreen;
