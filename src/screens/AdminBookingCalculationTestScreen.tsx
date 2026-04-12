import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { calculateHostNetAmount, HostNetAmountResult } from '../lib/hostNetAmount';
import { getCommissionRates } from '../lib/commissions';
import { calculateVehiclePriceWithHours, calculateFees, calculateHostCommission, DiscountConfig } from '../hooks/usePricing';
import { supabase } from '../services/supabase';

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
  priceAfterDiscountWithDriver: number;
  driverFee: number;
  serviceFee: number;
  totalPrice: number;
  discountAmount: number;
  ownerCommissionHT: number;
  ownerCommissionVAT: number;
  ownerCommission: number;
  ownerNetAmount: number;
  securityDeposit: number;
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
    discountMinDays: '0',
    longStayDiscountPercent: '0',
    longStayDiscountMinDays: '0',
    driverFee: '0',
    securityDeposit: '0',
    withDriver: false,
    status: 'confirmed',
    // Informations pour l'envoi des factures
    renterName: 'Test Locataire',
    renterEmail: '',
    ownerName: 'Test Propriétaire',
    ownerEmail: '',
    vehicleBrand: 'Toyota',
    vehicleModel: 'Corolla',
    vehicleYear: '2020',
    fuelType: 'Essence',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    startDateTime: (() => {
      const date = new Date();
      date.setHours(9, 0, 0, 0);
      return date.toISOString();
    })(),
    endDateTime: (() => {
      const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      date.setHours(18, 0, 0, 0);
      return date.toISOString();
    })(),
  });

  const [sendingInvoices, setSendingInvoices] = useState(false);

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
    stepByStep.push(`6️⃣ Commission Akwahome (${getCommissionRates('property').hostFeePercent}%): ${result.priceAfterDiscount} × ${getCommissionRates('property').hostFeePercent}% = ${result.hostCommissionHT} FCFA (pas de TVA)`);
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
    const driverFee = Number(vehicleForm.driverFee);
    const securityDeposit = Number(vehicleForm.securityDeposit);
    const withDriver = vehicleForm.withDriver;

    // Configuration des réductions
    const discountConfig: DiscountConfig = {
      enabled: Number(vehicleForm.discountPercent) > 0 || Number(vehicleForm.discountAmount) > 0,
      minNights: Number(vehicleForm.discountMinDays) > 0 ? Number(vehicleForm.discountMinDays) : null,
      percentage: Number(vehicleForm.discountPercent) > 0 ? Number(vehicleForm.discountPercent) : null,
    };

    const longStayDiscountConfig: DiscountConfig | undefined = Number(vehicleForm.longStayDiscountPercent) > 0 ? {
      enabled: true,
      minNights: Number(vehicleForm.longStayDiscountMinDays) > 0 ? Number(vehicleForm.longStayDiscountMinDays) : null,
      percentage: Number(vehicleForm.longStayDiscountPercent),
    } : undefined;

    // Utiliser la fonction centralisée pour calculer le prix avec heures et réductions
    const priceCalculation = calculateVehiclePriceWithHours(
      dailyRate,
      rentalDays,
      rentalHours,
      hourlyRate,
      discountConfig,
      longStayDiscountConfig
    );

    const daysPrice = priceCalculation.daysPrice;
    const hoursPrice = priceCalculation.hoursPrice;
    const basePrice = priceCalculation.basePrice; // Prix après réduction (sans chauffeur)
    const discountAmount = priceCalculation.discountAmount;

    stepByStep.push(`1️⃣ Prix des jours: ${dailyRate} × ${rentalDays} = ${daysPrice.toLocaleString('fr-FR')} FCFA`);
    if (rentalHours > 0) {
      stepByStep.push(`2️⃣ Prix des heures: ${hourlyRate} × ${rentalHours} = ${hoursPrice.toLocaleString('fr-FR')} FCFA`);
    }
    stepByStep.push(`3️⃣ Prix de base (jours + heures): ${daysPrice.toLocaleString('fr-FR')} + ${hoursPrice.toLocaleString('fr-FR')} = ${priceCalculation.totalBeforeDiscount.toLocaleString('fr-FR')} FCFA`);

    if (discountAmount > 0) {
      stepByStep.push(`4️⃣ Réduction appliquée: ${discountAmount.toLocaleString('fr-FR')} FCFA`);
      stepByStep.push(`5️⃣ Prix après réduction: ${priceCalculation.totalBeforeDiscount.toLocaleString('fr-FR')} - ${discountAmount.toLocaleString('fr-FR')} = ${basePrice.toLocaleString('fr-FR')} FCFA`);
    } else {
      stepByStep.push(`4️⃣ Aucune réduction appliquée`);
      stepByStep.push(`5️⃣ Prix après réduction: ${basePrice.toLocaleString('fr-FR')} FCFA`);
    }

    // Ajouter le surplus chauffeur si applicable
    const effectiveDriverFee = (withDriver && driverFee > 0) ? driverFee : 0;
    const priceAfterDiscountWithDriver = basePrice + effectiveDriverFee;

    if (effectiveDriverFee > 0) {
      stepByStep.push(`6️⃣ Surplus chauffeur: ${effectiveDriverFee.toLocaleString('fr-FR')} FCFA`);
      stepByStep.push(`7️⃣ Prix après réduction + chauffeur: ${basePrice.toLocaleString('fr-FR')} + ${effectiveDriverFee.toLocaleString('fr-FR')} = ${priceAfterDiscountWithDriver.toLocaleString('fr-FR')} FCFA`);
    } else {
      stepByStep.push(`6️⃣ Pas de surplus chauffeur`);
    }

    const fees = calculateFees(priceAfterDiscountWithDriver, rentalDays, 'vehicle');
    const totalPrice = priceAfterDiscountWithDriver + fees.serviceFee;
    const vRates = getCommissionRates('vehicle');

    stepByStep.push(`8️⃣ Frais de service locataire (${vRates.travelerFeePercent}%): ${priceAfterDiscountWithDriver.toLocaleString('fr-FR')} × ${vRates.travelerFeePercent}% = ${fees.serviceFee.toLocaleString('fr-FR')} FCFA (pas de TVA)`);
    stepByStep.push(`9️⃣ Total payé par locataire: ${priceAfterDiscountWithDriver.toLocaleString('fr-FR')} + ${fees.serviceFee.toLocaleString('fr-FR')} = ${totalPrice.toLocaleString('fr-FR')} FCFA`);

    const hostCommissionData = calculateHostCommission(priceAfterDiscountWithDriver, 'vehicle');
    const ownerNetAmount = priceAfterDiscountWithDriver - hostCommissionData.hostCommission + securityDeposit;

    stepByStep.push(`🔟 Commission Akwahome (${vRates.hostFeePercent}%): ${priceAfterDiscountWithDriver.toLocaleString('fr-FR')} × ${vRates.hostFeePercent}% = ${hostCommissionData.hostCommission.toLocaleString('fr-FR')} FCFA (pas de TVA)`);
    stepByStep.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    stepByStep.push(`✅ MONTANT NET PROPRIÉTAIRE: ${priceAfterDiscountWithDriver.toLocaleString('fr-FR')} - ${hostCommissionData.hostCommission.toLocaleString('fr-FR')} + ${securityDeposit.toLocaleString('fr-FR')} (caution) = ${ownerNetAmount.toLocaleString('fr-FR')} FCFA`);

    const result: VehicleCalculationResult = {
      basePrice,
      daysPrice,
      hoursPrice,
      priceAfterDiscount: basePrice,
      priceAfterDiscountWithDriver,
      driverFee: effectiveDriverFee,
      serviceFee: fees.serviceFee,
      totalPrice,
      discountAmount,
      ownerCommissionHT: hostCommissionData.hostCommissionHT,
      ownerCommissionVAT: hostCommissionData.hostCommissionVAT,
      ownerCommission: hostCommissionData.hostCommission,
      ownerNetAmount,
      securityDeposit,
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

  const sendInvoices = async () => {
    if (!vehicleResult) {
      Alert.alert('Erreur', 'Veuillez d\'abord calculer les prix');
      return;
    }

    if (!vehicleForm.renterEmail || !vehicleForm.ownerEmail) {
      Alert.alert('Erreur', 'Veuillez remplir les emails du locataire et du propriétaire');
      return;
    }

    setSendingInvoices(true);

    try {
      // Générer un ID de réservation de test
      const testBookingId = `test-${Date.now()}`;

      // Préparer les données pour l'email
      const emailData = {
        bookingId: testBookingId,
        vehicleTitle: `${vehicleForm.vehicleBrand} ${vehicleForm.vehicleModel}`,
        vehicleBrand: vehicleForm.vehicleBrand,
        vehicleModel: vehicleForm.vehicleModel,
        vehicleYear: vehicleForm.vehicleYear,
        fuelType: vehicleForm.fuelType,
        renterName: vehicleForm.renterName,
        renterEmail: vehicleForm.renterEmail,
        renterPhone: '',
        ownerName: vehicleForm.ownerName,
        ownerEmail: vehicleForm.ownerEmail,
        ownerPhone: '',
        startDate: vehicleForm.startDate,
        endDate: vehicleForm.endDate,
        startDateTime: vehicleForm.startDateTime,
        endDateTime: vehicleForm.endDateTime,
        rentalDays: Number(vehicleForm.rentalDays),
        rentalHours: Number(vehicleForm.rentalHours),
        dailyRate: Number(vehicleForm.dailyRate),
        hourlyRate: Number(vehicleForm.hourlyRate),
        basePrice: vehicleResult.priceAfterDiscountWithDriver, // Prix après réduction + chauffeur
        totalPrice: vehicleResult.totalPrice,
        ownerNetRevenue: vehicleResult.ownerNetAmount, // Revenu net du propriétaire (inclut la caution)
        securityDeposit: vehicleResult.securityDeposit,
        driverFee: vehicleResult.driverFee,
        withDriver: vehicleForm.withDriver,
        pickupLocation: '',
        isInstantBooking: vehicleForm.status === 'confirmed',
        paymentMethod: 'espèces',
        discountAmount: vehicleResult.discountAmount,
        vehicleDiscountEnabled: Number(vehicleForm.discountPercent) > 0,
        vehicleDiscountMinDays: Number(vehicleForm.discountMinDays) > 0 ? Number(vehicleForm.discountMinDays) : null,
        vehicleDiscountPercentage: Number(vehicleForm.discountPercent) > 0 ? Number(vehicleForm.discountPercent) : null,
        vehicleLongStayDiscountEnabled: Number(vehicleForm.longStayDiscountPercent) > 0,
        vehicleLongStayDiscountMinDays: Number(vehicleForm.longStayDiscountMinDays) > 0 ? Number(vehicleForm.longStayDiscountMinDays) : null,
        vehicleLongStayDiscountPercentage: Number(vehicleForm.longStayDiscountPercent) > 0 ? Number(vehicleForm.longStayDiscountPercent) : null,
      };

      // Envoyer l'email au locataire
      const renterResponse = await supabase.functions.invoke('send-email', {
        body: {
          type: 'vehicle_booking_confirmed_renter',
          to: vehicleForm.renterEmail,
          data: emailData
        }
      });

      if (renterResponse.error) {
        console.error('❌ Erreur envoi email locataire:', renterResponse.error);
        Alert.alert('Erreur', `Impossible d'envoyer l'email au locataire: ${renterResponse.error.message}`);
        setSendingInvoices(false);
        return;
      }

      // Envoyer l'email au propriétaire
      const ownerResponse = await supabase.functions.invoke('send-email', {
        body: {
          type: 'vehicle_booking_confirmed_owner',
          to: vehicleForm.ownerEmail,
          data: emailData
        }
      });

      if (ownerResponse.error) {
        console.error('❌ Erreur envoi email propriétaire:', ownerResponse.error);
        Alert.alert('Erreur', `Impossible d'envoyer l'email au propriétaire: ${ownerResponse.error.message}`);
        setSendingInvoices(false);
        return;
      }

      Alert.alert(
        'Succès',
        `Les factures ont été envoyées avec succès !\n\n📧 Locataire: ${vehicleForm.renterEmail}\n📧 Propriétaire: ${vehicleForm.ownerEmail}`,
        [{ text: 'OK' }]
      );

      console.log('✅ Factures envoyées avec succès');
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'envoi des factures:', error);
      Alert.alert('Erreur', `Une erreur est survenue: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setSendingInvoices(false);
    }
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
            <Text style={styles.resultLabel}>Commission Akwahome ({getCommissionRates('property').hostFeePercent}%):</Text>
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
        <Text style={styles.label}>Réduction minimum jours</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.discountMinDays}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, discountMinDays: text })}
          keyboardType="numeric"
          placeholder="Ex: 3"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réduction long séjour (%)</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.longStayDiscountPercent}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, longStayDiscountPercent: text })}
          keyboardType="numeric"
          placeholder="Ex: 15"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réduction long séjour minimum jours</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.longStayDiscountMinDays}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, longStayDiscountMinDays: text })}
          keyboardType="numeric"
          placeholder="Ex: 7"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Surplus chauffeur (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.driverFee}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, driverFee: text })}
          keyboardType="numeric"
          placeholder="Ex: 5000"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Caution (FCFA)</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.securityDeposit}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, securityDeposit: text })}
          keyboardType="numeric"
          placeholder="Ex: 50000"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Avec chauffeur</Text>
        <View style={styles.radioGroup}>
          <TouchableOpacity
            style={[styles.radioButton, vehicleForm.withDriver && styles.radioButtonActive]}
            onPress={() => setVehicleForm({ ...vehicleForm, withDriver: true })}
          >
            <Text style={[styles.radioText, vehicleForm.withDriver && styles.radioTextActive]}>Oui</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.radioButton, !vehicleForm.withDriver && styles.radioButtonActive]}
            onPress={() => setVehicleForm({ ...vehicleForm, withDriver: false })}
          >
            <Text style={[styles.radioText, !vehicleForm.withDriver && styles.radioTextActive]}>Non</Text>
          </TouchableOpacity>
        </View>
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

      <View style={styles.separatorSection} />

      <Text style={styles.sectionSubtitle}>Informations pour l'envoi des factures</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom locataire</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.renterName}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, renterName: text })}
          placeholder="Ex: Jean Dupont"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email locataire *</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.renterEmail}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, renterEmail: text })}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="locataire@example.com"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom propriétaire</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.ownerName}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, ownerName: text })}
          placeholder="Ex: Marie Martin"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email propriétaire *</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.ownerEmail}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, ownerEmail: text })}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="proprietaire@example.com"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Marque véhicule</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.vehicleBrand}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, vehicleBrand: text })}
          placeholder="Ex: Toyota"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Modèle véhicule</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.vehicleModel}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, vehicleModel: text })}
          placeholder="Ex: Corolla"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Année véhicule</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.vehicleYear}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, vehicleYear: text })}
          keyboardType="numeric"
          placeholder="Ex: 2020"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Type de carburant</Text>
        <TextInput
          style={styles.input}
          value={vehicleForm.fuelType}
          onChangeText={(text) => setVehicleForm({ ...vehicleForm, fuelType: text })}
          placeholder="Ex: Essence"
        />
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
            <Text style={styles.resultLabel}>Prix de base (jours + heures):</Text>
            <Text style={styles.resultValue}>{(vehicleResult.daysPrice + vehicleResult.hoursPrice).toLocaleString('fr-FR')} FCFA</Text>
          </View>
          {vehicleResult.discountAmount > 0 && (
            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: '#2E7D32' }]}>Réduction appliquée:</Text>
              <Text style={[styles.resultValue, { color: '#2E7D32' }]}>-{vehicleResult.discountAmount.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          )}
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Prix après réduction:</Text>
            <Text style={styles.resultValue}>{vehicleResult.priceAfterDiscount.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          {vehicleResult.driverFee > 0 && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Surplus chauffeur:</Text>
              <Text style={styles.resultValue}>{vehicleResult.driverFee.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          )}
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Prix après réduction + chauffeur:</Text>
            <Text style={styles.resultValue}>{vehicleResult.priceAfterDiscountWithDriver.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Frais de service ({getCommissionRates('vehicle').travelerFeePercent}%):</Text>
            <Text style={styles.resultValue}>{vehicleResult.serviceFee.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Total payé par locataire:</Text>
            <Text style={[styles.resultValue, { color: '#2E7D32', fontWeight: 'bold' }]}>{vehicleResult.totalPrice.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          {vehicleResult.securityDeposit > 0 && (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Caution:</Text>
              <Text style={styles.resultValue}>{vehicleResult.securityDeposit.toLocaleString('fr-FR')} FCFA</Text>
            </View>
          )}
          <View style={styles.separator} />
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Commission Akwahome ({getCommissionRates('vehicle').hostFeePercent}%):</Text>
            <Text style={[styles.resultValue, { color: '#ef4444' }]}>{vehicleResult.ownerCommission.toLocaleString('fr-FR')} FCFA</Text>
          </View>
          <View style={styles.separator} />
          <View style={[styles.resultRow, styles.finalResult]}>
            <Text style={styles.finalResultLabel}>Montant net propriétaire:</Text>
            <Text style={styles.finalResultValue}>{vehicleResult.ownerNetAmount.toLocaleString('fr-FR')} FCFA</Text>
          </View>

          {/* Bouton pour envoyer les factures */}
          <View style={styles.separator} />
          <TouchableOpacity 
            style={[styles.sendInvoiceButton, sendingInvoices && styles.sendInvoiceButtonDisabled]} 
            onPress={sendInvoices}
            disabled={sendingInvoices || !vehicleForm.renterEmail || !vehicleForm.ownerEmail}
          >
            {sendingInvoices ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="mail-outline" size={20} color="#fff" />
                <Text style={styles.sendInvoiceButtonText}>Envoyer les factures</Text>
              </>
            )}
          </TouchableOpacity>
          {(!vehicleForm.renterEmail || !vehicleForm.ownerEmail) && (
            <Text style={styles.warningText}>⚠️ Veuillez remplir les emails du locataire et du propriétaire</Text>
          )}
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
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    color: '#007AFF',
  },
  separatorSection: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 16,
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
  sendInvoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  sendInvoiceButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  sendInvoiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AdminBookingCalculationTestScreen;



