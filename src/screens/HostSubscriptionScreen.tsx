import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MONTHLY_RENTAL_COLORS } from '../constants/colors';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Ancien écran d’abonnement payant.
 * La publication en bail longue durée est gratuite pour l’instant.
 */
const HostSubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('monthlyHost.subscriptionTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={48} color={MONTHLY_RENTAL_COLORS.primary} />
        </View>
        <Text style={styles.title}>{t('monthlyHost.subscriptionFree')}</Text>
        <Text style={styles.desc}>{t('monthlyHost.subscriptionDesc')}</Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            navigation.navigate('ModeTransition', {
              targetMode: 'monthly_rental',
              targetPath: 'MonthlyRentalOwnerSpace',
              fromMode: 'host',
            });
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>{t('monthlyHost.openSpace')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('AddMonthlyRentalListing' as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>{t('monthlyHost.addListing')}</Text>
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
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#333' },
  body: { padding: 24, alignItems: 'center' },
  iconWrap: { marginTop: 24, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 10 },
  desc: { fontSize: 14, lineHeight: 21, color: '#475569', textAlign: 'center', marginBottom: 28 },
  primaryBtn: {
    width: '100%',
    backgroundColor: MONTHLY_RENTAL_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#334155', fontWeight: '600', fontSize: 15 },
});

export default HostSubscriptionScreen;
