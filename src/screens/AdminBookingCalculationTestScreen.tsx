import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { calculateHostNetAmount, HostNetAmountResult } from '../lib/hostNetAmount';
import { getCommissionRates } from '../lib/commissions';

interface CalculationLog {
  timestamp: string;
  type: 'property' | 'vehicle';
  input: any;
  result: HostNetAmountResult | VehicleCalculationResult;
  stepByStep: string[];
}

interface VehicleCalculationResult {
  basePrice: number;
  daysPrice: number;
  hoursPrice: number;
  priceAfterDiscount: number;
  ownerCommissionHT: number;
  ownerCommissionVAT: number;
  ownerCommission: number;
  ownerNetAmount: number;
}

const AdminBookingCalculationTestScreen: React.FC = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'property' | 'vehicle'>('property');
  const [propertyResult, setPropertyResult] = useState<HostNetAmountResult | null>(null);
  const [vehicleResult, setVehicleResult] = useState<VehicleCalculationResult | null>(null);
  const [logs, setLogs] = useState<CalculationLog[]>([]);

  // Form state for property
  const [propertyForm, setPropertyForm] = useState({
    pricePerNight: '15000',
    nights: '5',
    discountAmount: '0',
    discountPercent: '0',
    cleaningFee: '1000',
    taxesPerNight: '1000',
    freeCleaningMinDays: '',
    status: 'confirmed',
  });

  // Form state for vehicle
  const [vehicleForm, setVehicleForm] = useState({
    dailyRate: '25000',
    rentalDays: '3',
    hourlyRate: '5000',
    rentalHours: '0',
    discountAmount: '0',
    discountPercent: '0',
    status: 'confirmed',
  });

  const addLog = (
    type: 'property' | 'vehicle',
    input: any,
    result: HostNetAmountResult | VehicleCalculationResult,
    stepByStep: string[]
  ) => {
    const newLog: CalculationLog = {
      timestamp: new Date().toLocaleString('fr-FR'),
      type,
      input: { ...input },
      result: { ...result },
      stepByStep,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const calculateProperty = () => {
    console.log('🧮 ===== CALCUL PROPRIÉTÉ =====');
    console.log('📥 Paramètres d\'entrée:', propertyForm);

    const stepByStep: string[] = [];

    const pricePerNight = Number(propertyForm.pricePerNight);
    const nights = Number(propertyForm.nights);
    let discountAmount = Number(propertyForm.discountAmount);

    if (Number(propertyForm.discountPercent) > 0 && discountAmount === 0) {
      const basePrice = pricePerNight * nights;
      discountAmount = Math.round(basePrice * (Number(propertyForm.discountPercent) / 100));
      stepByStep.push(`💰 Réduction calculée: ${basePrice} × ${propertyForm.discountPercent}% = ${discountAmount} FCFA`);
    }

    const params = {
      pricePerNight,
      nights,
      discountAmount,
      cleaningFee: Number(propertyForm.cleaningFee),
      taxesPerNight: Number(propertyForm.taxesPerNight),
      freeCleaningMinDays: propertyForm.freeCleaningMinDays ? Number(propertyForm.freeCleaningMinDays) : null,
      status: propertyForm.status,
      serviceType: 'property' as const,
    };

    console.log('📊 Paramètres de calcul:', params);

    const result = calculateHostNetAmount(params);
    setPropertyResult(result);

    stepByStep.push(`1️⃣ Prix de base: ${params.pricePerNight} × ${params.nights} = ${result.basePrice} FCFA`);
    stepByStep.push(`2️⃣ Réduction appliquée: ${discountAmount} FCFA`);
    stepByStep.push(`3️⃣ Prix après réduction: ${result.basePrice} - ${discountAmount} = ${result.priceAfterDiscount} FCFA`);

    if (params.freeCleaningMinDays && params.nights >= params.freeCleaningMinDays) {
      stepByStep.push(`4️⃣ Frais de ménage: ${params.cleaningFee} FCFA → 0 FCFA (gratuit pour ${params.nights} nuits ≥ ${params.freeCleaningMinDays})`);
    } else {
      stepByStep.push(`4️⃣ Frais de ménage: ${result.effectiveCleaningFee} FCFA`);
    }

    stepByStep.push(`5️⃣ Taxe de séjour: ${params.taxesPerNight} × ${params.nights} = ${result.effectiveTaxes} FCFA`);
    stepByStep.push(`6️⃣ Commission HT (2%): ${result.priceAfterDiscount} × 2% = ${result.hostCommissionHT} FCFA`);
    stepByStep.push(`7️⃣ Commission TVA (20%): ${result.hostCommissionHT} × 20% = ${result.hostCommissionVAT} FCFA`);
    stepByStep.push(`8️⃣ Commission TTC: ${result.hostCommissionHT} + ${result.hostCommissionVAT} = ${result.hostCommission} FCFA`);
    stepByStep.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    stepByStep.push(`✅ MONTANT NET HÔTE: ${result.priceAfterDiscount} + ${result.effectiveCleaningFee} + ${result.effectiveTaxes} - ${result.hostCommission} = ${result.hostNetAmount} FCFA`);

    console.log('📊 Résultat du calcul:', result);
    console.log('📝 Étapes détaillées:', stepByStep);

    addLog('property', params, result, stepByStep);
  };

  const calculateVehicle = () => {
    console.log('🚗 ===== CALCUL VÉHICULE =====');
    console.log('📥 Paramètres d\'entrée:', vehicleForm);

    const stepByStep: string[] = [];

    const dailyRate = Number(vehicleForm.dailyRate);
    const rentalDays = Number(vehicleForm.rentalDays);
    const hourlyRate = Number(vehicleForm.hourlyRate);
    const rentalHours = Number(vehicleForm.rentalHours);

    const daysPrice = dailyRate * rentalDays;
    const hoursPrice = hourlyRate * rentalHours;
    const basePrice = daysPrice + hoursPrice;

    stepByStep.push(`1️⃣ Prix des jours: ${dailyRate} × ${rentalDays} = ${daysPrice} FCFA`);
    if (rentalHours > 0) {
      stepByStep.push(`2️⃣ Prix des heures: ${hourlyRate} × ${rentalHours} = ${hoursPrice} FCFA`);
    }
    stepByStep.push(`3️⃣ Prix de base: ${daysPrice} + ${hoursPrice} = ${basePrice} FCFA`);

    let discountAmount = Number(vehicleForm.discountAmount);
    if (Number(vehicleForm.discountPercent) > 0 && discountAmount === 0) {
      discountAmount = Math.round(basePrice * (Number(vehicleForm.discountPercent) / 100));
      stepByStep.push(`4️⃣ Réduction calculée: ${basePrice} × ${vehicleForm.discountPercent}% = ${discountAmount} FCFA`);
    } else if (discountAmount > 0) {
      stepByStep.push(`4️⃣ Réduction appliquée: ${discountAmount} FCFA`);
    }

    const priceAfterDiscount = basePrice - discountAmount;
    stepByStep.push(`5️⃣ Prix après réduction: ${basePrice} - ${discountAmount} = ${priceAfterDiscount} FCFA`);

    const commissionRates = getCommissionRates('vehicle');
    const ownerCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
    const ownerCommissionVAT = Math.round(ownerCommissionHT * 0.20);
    const ownerCommission = ownerCommissionHT + ownerCommissionVAT;

    stepByStep.push(`6️⃣ Commission HT (2%): ${priceAfterDiscount} × 2% = ${ownerCommissionHT} FCFA`);
    stepByStep.push(`7️⃣ Commission TVA (20%): ${ownerCommissionHT} × 20% = ${ownerCommissionVAT} FCFA`);
    stepByStep.push(`8️⃣ Commission TTC: ${ownerCommissionHT} + ${ownerCommissionVAT} = ${ownerCommission} FCFA`);
    stepByStep.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    stepByStep.push(`✅ MONTANT NET PROPRIÉTAIRE: ${priceAfterDiscount} - ${ownerCommission} = ${priceAfterDiscount - ownerCommission} FCFA`);

    const result: VehicleCalculationResult = {
      basePrice,
      daysPrice,
      hoursPrice,
      priceAfterDiscount,
      ownerCommissionHT,
      ownerCommissionVAT,
      ownerCommission,
      ownerNetAmount: priceAfterDiscount - ownerCommission,
    };

    if (vehicleForm.status === 'cancelled') {
      result.ownerNetAmount = 0;
      stepByStep.push(`⚠️ Réservation annulée → Montant net = 0 FCFA`);
    }

    setVehicleResult(result);

    console.log('📊 Résultat du calcul:', result);
    console.log('📝 Étapes détaillées:', stepByStep);

    addLog('vehicle', vehicleForm, result, stepByStep);
  };

  const renderPropertyForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Paramètres de Test - Propriété</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Prix par nuit (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={propertyForm.pricePerNight}
          onChangeText={(text) => setPropertyForm({ ...propertyForm, pricePerNight: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nombre de nuits</Text>
        <TextInput
          style={styles.input}
          value={propertyForm.nights}
          onChangeText={(text) => setPropertyForm({ ...propertyForm, nights: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réduction (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={propertyForm.discountAmount}
          onChangeText={(text) => setPropertyForm({ ...propertyForm, discountAmount: text, discountPercent: '0' })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réduction (%)</Text>
        <TextInput
          style={styles.input}
          value={propertyForm.discountPercent}
          onChangeText={(text) => setPropertyForm({ ...propertyForm, discountPercent: text, discountAmount: '0' })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Frais de ménage (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={propertyForm.cleaningFee}
          onChangeText={(text) => setPropertyForm({ ...propertyForm, cleaningFee: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Taxe de séjour par nuit (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={propertyForm.taxesPerNight}
          onChangeText={(text) => setPropertyForm({ ...propertyForm, taxesPerNight: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Ménage gratuit à partir de (jours)</Text>
        <TextInput
          style={styles.input}
          value={propertyForm.freeCleaningMinDays}
          onChangeText={(text) => setPropertyForm({ ...propertyForm, freeCleaningMinDays: text })}
          keyboardType="numeric"
          placeholder="Laisser vide si non applicable"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Statut</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={[styles.radioButton, propertyForm.status === 'confirmed' && styles.radioButtonActive]}
            onPress={() => setPropertyForm({ ...propertyForm, status: 'confirmed' })}
          >
            <Text style={[styles.radioText, propertyForm.status === 'confirmed' && styles.radioTextActive]}>Confirmée</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioButton, propertyForm.status === 'pending' && styles.radioButtonActive]}
            onPress={() => setPropertyForm({ ...propertyForm, status: 'pending' })}
          >
            <Text style={[styles.radioText, propertyForm.status === 'pending' && styles.radioTextActive]}>En attente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioButton, propertyForm.status === 'cancelled' && styles.radioButtonActive]}
            onPress={() => setPropertyForm({ ...propertyForm, status: 'cancelled' })}
          >
            <Text style={[styles.radioText, propertyForm.status === 'cancelled' && styles.radioTextActive]}>Annulée</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.calculateButton} onPress={calculateProperty}>
        <Ionicons name="calculator-outline" size={20} color="#fff" />
        <Text style={styles.calculateButtonText}>Calculer</Text>
      </TouchableOpacity>

      {propertyResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Résultat du Calcul</Text>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Prix de base:</Text>
            <Text style={styles.resultValue}>{propertyResult.basePrice.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Prix après réduction:</Text>
            <Text style={styles.resultValue}>{propertyResult.priceAfterDiscount.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Frais de ménage:</Text>
            <Text style={styles.resultValue}>{propertyResult.effectiveCleaningFee.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Taxe de séjour:</Text>
            <Text style={styles.resultValue}>{propertyResult.effectiveTaxes.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Commission HT (2%):</Text>
            <Text style={styles.resultValue}>{propertyResult.hostCommissionHT.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Commission TVA (20%):</Text>
            <Text style={styles.resultValue}>{propertyResult.hostCommissionVAT.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Commission TTC:</Text>
            <Text style={[styles.resultValue, { color: '#ef4444' }]}>{propertyResult.hostCommission.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.separator} />
          <View style={[styles.resultRow, styles.finalResult]}>
            <Text style={styles.finalResultLabel}>Montant net hôte:</Text>
            <Text style={styles.finalResultValue}>{propertyResult.hostNetAmount.toLocaleString('fr-FR')} FCFA</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderVehicleForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.sectionTitle}>Paramètres de Test - Véhicule</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tarif journalier (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.dailyRate}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, dailyRate: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nombre de jours</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.rentalDays}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, rentalDays: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tarif horaire (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.hourlyRate}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, hourlyRate: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nombre d'heures</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.rentalHours}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, rentalHours: text })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réduction (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.discountAmount}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, discountAmount: text, discountPercent: '0' })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réduction (%)</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.discountPercent}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, discountPercent: text, discountAmount: '0' })}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Statut</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={[styles.radioButton, vehicleForm.status === 'confirmed' && styles.radioButtonActive]}
            onPress={() => setVehicleForm({ ...vehicleForm, status: 'confirmed' })}
          >
            <Text style={[styles.radioText, vehicleForm.status === 'confirmed' && styles.radioTextActive]}>Confirmée</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioButton, vehicleForm.status === 'pending' && styles.radioButtonActive]}
            onPress={() => setVehicleForm({ ...vehicleForm, status: 'pending' })}
          >
            <Text style={[styles.radioText, vehicleForm.status === 'pending' && styles.radioTextActive]}>En attente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioButton, vehicleForm.status === 'cancelled' && styles.radioButtonActive]}
            onPress={() => setVehicleForm({ ...vehicleForm, status: 'cancelled' })}
          >
            <Text style={[styles.radioText, vehicleForm.status === 'cancelled' && styles.radioTextActive]}>Annulée</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.calculateButton} onPress={calculateVehicle}>
        <Ionicons name="calculator-outline" size={20} color="#fff" />
        <Text style={styles.calculateButtonText}>Calculer</Text>
      </TouchableOpacity>

      {vehicleResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Résultat du Calcul</Text>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Prix des jours:</Text>
            <Text style={styles.resultValue}>{vehicleResult.daysPrice.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          {vehicleResult.hoursPrice > 0 && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Prix des heures:</Text>
              <Text style={styles.resultValue}>{vehicleResult.hoursPrice.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          )}
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Prix de base:</Text>
            <Text style={styles.resultValue}>{vehicleResult.basePrice.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Prix après réduction:</Text>
            <Text style={styles.resultValue}>{vehicleResult.priceAfterDiscount.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Commission HT (2%):</Text>
            <Text style={styles.resultValue}>{vehicleResult.ownerCommissionHT.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Commission TVA (20%):</Text>
            <Text style={styles.resultValue}>{vehicleResult.ownerCommissionVAT.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Commission TTC:</Text>
            <Text style={[styles.resultValue, { color: '#ef4444' }]}>{vehicleResult.ownerCommission.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.separator} />
          <View style={[styles.resultRow, styles.finalResult]}>
            <Text style={styles.finalResultLabel}>Montant net propriétaire:</Text>
            <Text style={styles.finalResultValue}>{vehicleResult.ownerNetAmount.toLocaleString('fr-FR')} FCFA</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Test des Calculs</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'property' && styles.tabActive]}
          onPress={() => setActiveTab('property')}
        >
          <Ionicons name="home-outline" size={20} color={activeTab === 'property' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'property' && styles.tabTextActive]}>Propriété</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vehicle' && styles.tabActive]}
          onPress={() => setActiveTab('vehicle')}
        >
          <Ionicons name="car-outline" size={20} color={activeTab === 'vehicle' ? '#fff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'vehicle' && styles.tabTextActive]}>Véhicule</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'property' ? renderPropertyForm() : renderVehicleForm()}

        {/* Logs Section */}
        <View style={styles.logsContainer}>
          <View style={styles.logsHeader}>
            <Text style={styles.logsTitle}>Logs de Calcul ({logs.length})</Text>
            <TouchableOpacity onPress={() => setLogs([])}>
              <Text style={styles.clearLogsButton}>Effacer</Text>
            </TouchableOpacity>
          </View>

          {logs.length === 0 ? (
            <Text style={styles.noLogsText}>Aucun log pour le moment</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={[styles.logBadge, log.type === 'property' ? styles.logBadgeProperty : styles.logBadgeVehicle]}>
                    <Text style={styles.logBadgeText}>{log.type === 'property' ? 'Propriété' : 'Véhicule'}</Text>
                  </View>
                  <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                </View>
                <Text style={styles.logSectionTitle}>Paramètres:</Text>
                <Text style={styles.logContent}>{JSON.stringify(log.input, null, 2)}</Text>
                <Text style={styles.logSectionTitle}>Résultat:</Text>
                <Text style={styles.logContent}>{JSON.stringify(log.result, null, 2)}</Text>
                <Text style={styles.logSectionTitle}>Étapes détaillées:</Text>
                {log.stepByStep.map((step, i) => (
                  <Text key={i} style={styles.logStep}>{step}</Text>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerRight: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#f5f5f5',
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  radioButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  radioButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  radioText: {
    fontSize: 14,
    color: '#666',
  },
  radioTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  separator: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8,
  },
  finalResult: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  finalResultLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  finalResultValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  logsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  clearLogsButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noLogsText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 32,
  },
  logCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logBadgeProperty: {
    backgroundColor: '#007AFF',
  },
  logBadgeVehicle: {
    backgroundColor: '#34c759',
  },
  logBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  logSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    color: '#000',
  },
  logContent: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  logStep: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 4,
  },
});

export default AdminBookingCalculationTestScreen;


