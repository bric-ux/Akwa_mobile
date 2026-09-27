import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';

type ListingChoice = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

/**
 * Choix du type de bien à publier.
 */
export default function AddListingChoiceScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { monthlyRental, hotel } = useFeatureFlags();

  const goAuthThen = (returnTo: string) => {
    navigation.navigate('Auth', { returnTo });
  };

  const options = useMemo((): ListingChoice[] => {
    const list: ListingChoice[] = [
      {
        id: 'property',
        title: 'Résidence meublée',
        subtitle: 'Court séjour · nuitées',
        icon: 'home-outline',
        onPress: () => {
          if (!user) {
            goAuthThen('BecomeHost');
            return;
          }
          navigation.navigate('BecomeHost');
        },
      },
      {
        id: 'vehicle',
        title: 'Véhicule',
        subtitle: 'Location à la journée',
        icon: 'car-outline',
        onPress: () => {
          if (!user) {
            goAuthThen('AddVehicle');
            return;
          }
          navigation.navigate('AddVehicle');
        },
      },
    ];

    if (hotel) {
      list.push({
        id: 'hotel',
        title: 'Hôtel',
        subtitle: 'Établissement · chambres',
        icon: 'business-outline',
        onPress: () => {
          if (!user) {
            goAuthThen('AddHotelEstablishment');
            return;
          }
          navigation.navigate('AddHotelEstablishment');
        },
      });
    }

    if (monthlyRental) {
      list.push({
        id: 'monthly',
        title: 'Location longue durée',
        subtitle: 'Loyer mensuel',
        icon: 'calendar-outline',
        onPress: () => {
          if (!user) {
            goAuthThen('AddMonthlyRentalListing');
            return;
          }
          navigation.navigate('AddMonthlyRentalListing');
        },
      });
    }

    return list;
  }, [user, navigation, monthlyRental, hotel]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter un bien</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Type de bien</Text>
        <View style={styles.section}>
          {options.map((opt, index) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.row,
                index === options.length - 1 && styles.rowLast,
              ]}
              onPress={opt.onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={opt.title}
            >
              <View style={styles.rowLeft}>
                <View style={styles.iconWrap}>
                  <Ionicons name={opt.icon} size={20} color="#333" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{opt.title}</Text>
                  <Text style={styles.rowSubtitle}>{opt.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#c0c0c0" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#666',
  },
});
