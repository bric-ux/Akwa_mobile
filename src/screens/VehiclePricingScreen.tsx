import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useVehicles } from '../hooks/useVehicles';
import { Vehicle } from '../types';
import { VEHICLE_COLORS } from '../constants/colors';
import { RootStackParamList } from '../types';

type VehiclePricingRouteProp = RouteProp<RootStackParamList, 'VehiclePricing'>;

const VehiclePricingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehiclePricingRouteProp>();
  const { vehicleId } = route.params;
  const { getVehicleById, updateVehicle, loading } = useVehicles();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [pricePerDay, setPricePerDay] = useState('');
  const [pricePerWeek, setPricePerWeek] = useState('');
  const [pricePerMonth, setPricePerMonth] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('');

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  useEffect(() => {
    if (vehicle) {
      setPricePerDay(vehicle.price_per_day?.toString() || '');
      setPricePerWeek(vehicle.price_per_week?.toString() || '');
      setPricePerMonth(vehicle.price_per_month?.toString() || '');
      setSecurityDeposit(vehicle.security_deposit?.toString() || '');
    }
  }, [vehicle]);

  const loadVehicle = async () => {
    try {
      const data = await getVehicleById(vehicleId);
      setVehicle(data);
    } catch (err) {
      console.error('Erreur lors du chargement du véhicule:', err);
      Alert.alert('Erreur', 'Impossible de charger le véhicule');
    }
  };

  const handleSave = async () => {
    if (!vehicleId) return;

    try {
      setSaving(true);

      const result = await updateVehicle(vehicleId, {
        price_per_day: pricePerDay ? parseInt(pricePerDay, 10) : null,
        price_per_week: pricePerWeek ? parseInt(pricePerWeek, 10) : null,
        price_per_month: pricePerMonth ? parseInt(pricePerMonth, 10) : null,
        security_deposit: securityDeposit ? parseInt(securityDeposit, 10) : null,
      });

      if (result.success) {
        Alert.alert('Succès', 'Les tarifs ont été enregistrés');
        navigation.goBack();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de sauvegarder les tarifs');
      }
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder les tarifs');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !vehicle) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={VEHICLE_COLORS.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tarification</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveButtonText, saving && styles.saveButtonTextDisabled]}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Prix par jour */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color="#475569" />
            <Text style={styles.sectionTitle}>Prix par jour</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tarif journalier (XOF)</Text>
            <TextInput
              style={styles.input}
              value={pricePerDay}
              onChangeText={setPricePerDay}
              placeholder="Ex: 25000"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
          </View>
        </View>

        {/* Prix par semaine */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color="#475569" />
            <Text style={styles.sectionTitle}>Prix par semaine (optionnel)</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tarif hebdomadaire (XOF)</Text>
            <TextInput
              style={styles.input}
              value={pricePerWeek}
              onChangeText={setPricePerWeek}
              placeholder="Ex: 150000"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <Text style={styles.hint}>
              Laissez vide si vous ne souhaitez pas proposer de tarif hebdomadaire
            </Text>
          </View>
        </View>

        {/* Prix par mois */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color="#475569" />
            <Text style={styles.sectionTitle}>Prix par mois (optionnel)</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Tarif mensuel (XOF)</Text>
            <TextInput
              style={styles.input}
              value={pricePerMonth}
              onChangeText={setPricePerMonth}
              placeholder="Ex: 500000"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <Text style={styles.hint}>
              Laissez vide si vous ne souhaitez pas proposer de tarif mensuel
            </Text>
          </View>
        </View>

        {/* Caution */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag-outline" size={20} color="#475569" />
            <Text style={styles.sectionTitle}>Caution (optionnel)</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Montant de la caution (XOF)</Text>
            <TextInput
              style={styles.input}
              value={securityDeposit}
              onChangeText={setSecurityDeposit}
              placeholder="Ex: 100000"
              keyboardType="numeric"
              placeholderTextColor="#999"
            />
            <Text style={styles.hint}>
              Laissez vide si vous ne demandez pas de caution
            </Text>
          </View>
        </View>

        {/* Aperçu des tarifs */}
        {pricePerDay && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aperçu des tarifs</Text>
            <View style={styles.previewContainer}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Prix par jour:</Text>
                <Text style={styles.previewValue}>
                  {parseInt(pricePerDay || '0', 10).toLocaleString('fr-FR')} XOF
                </Text>
              </View>
              {pricePerWeek && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Prix par semaine:</Text>
                  <Text style={styles.previewValue}>
                    {parseInt(pricePerWeek, 10).toLocaleString('fr-FR')} XOF
                  </Text>
                </View>
              )}
              {pricePerMonth && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Prix par mois:</Text>
                  <Text style={styles.previewValue}>
                    {parseInt(pricePerMonth, 10).toLocaleString('fr-FR')} XOF
                  </Text>
                </View>
              )}
              {securityDeposit && (
                <View style={[styles.previewRow, styles.previewRowBorder]}>
                  <Text style={styles.previewLabel}>Caution:</Text>
                  <Text style={styles.previewValue}>
                    {parseInt(securityDeposit, 10).toLocaleString('fr-FR')} XOF
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  inputContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  previewContainer: {
    marginTop: 8,
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewRowBorder: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
});

export default VehiclePricingScreen;









