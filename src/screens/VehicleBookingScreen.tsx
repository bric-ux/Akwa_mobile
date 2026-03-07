import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  Dimensions,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useVehicles } from '../hooks/useVehicles';
import { useVehicleBookings } from '../hooks/useVehicleBookings';
import { useAuth } from '../services/AuthContext';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import { useVehicleAvailabilityCalendar } from '../hooks/useVehicleAvailabilityCalendar';
import { useCurrency } from '../hooks/useCurrency';
import VehicleDateTimePickerModal from '../components/VehicleDateTimePickerModal';
import { useSearchDatesContext } from '../contexts/SearchDatesContext';
import { calculateTotalPrice, calculateFees, calculateVehiclePriceWithHours, DiscountConfig } from '../hooks/usePricing';
import { TRAVELER_COLORS } from '../constants/colors';
import { getCommissionRates } from '../lib/commissions';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../services/supabase';

type VehicleBookingRouteProp = RouteProp<RootStackParamList, 'VehicleBooking'>;

const VehicleBookingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<VehicleBookingRouteProp>();
  const { vehicleId } = route.params;
  const { user } = useAuth();
  const { currency, rates, formatPrice } = useCurrency();
  const { getVehicleById } = useVehicles();
  const { createBooking, loading } = useVehicleBookings();
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } = useIdentityVerification();
  const { dates: searchDates, setDates: saveSearchDates } = useSearchDatesContext();
  const { isDateUnavailable, isDateRangeUnavailable } = useVehicleAvailabilityCalendar(vehicleId);

  const [vehicle, setVehicle] = useState<any>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [startDate, setStartDate] = useState<string>(searchDates.checkIn || '');
  const [endDate, setEndDate] = useState<string>(searchDates.checkOut || '');
  const [startDateTime, setStartDateTime] = useState<string | null>(null);
  const [endDateTime, setEndDateTime] = useState<string | null>(null);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [message, setMessage] = useState('');
  const [hasLicense, setHasLicense] = useState(false);
  const [licenseYears, setLicenseYears] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState<string | null>(null);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [showLicenseYearsPicker, setShowLicenseYearsPicker] = useState(false);
  const [useDriver, setUseDriver] = useState<boolean | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'paypal' | 'cash'>('card');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageScrollViewRef = useRef<ScrollView>(null);
  const mainScrollViewRef = useRef<ScrollView>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [pendingStripeBookingId, setPendingStripeBookingId] = useState<string | null>(null);
  const [pendingStripeCheckoutToken, setPendingStripeCheckoutToken] = useState<string | null>(null);
  const [pendingStripeStartedAt, setPendingStripeStartedAt] = useState<number | null>(null);
  const [stripeTimeLeftSec, setStripeTimeLeftSec] = useState(0);
  const [checkingStripeStatus, setCheckingStripeStatus] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const STRIPE_PENDING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  useEffect(() => {
    const loadVehicle = async () => {
      try {
        setLoadingVehicle(true);
        const vehicleData = await getVehicleById(vehicleId);
        setVehicle(vehicleData);
      } catch (error) {
        console.error('Erreur lors du chargement du véhicule:', error);
        Alert.alert('Erreur', 'Impossible de charger les détails du véhicule');
        navigation.goBack();
      } finally {
        setLoadingVehicle(false);
      }
    };

    loadVehicle();
  }, [vehicleId]);

  // Initialiser les dates depuis le contexte si disponibles
  useEffect(() => {
    if (__DEV__) console.log(`📅 [VehicleBookingScreen] Initialisation depuis contexte:`, {
      checkIn: searchDates.checkIn,
      checkOut: searchDates.checkOut,
      checkInDateTime: searchDates.checkInDateTime,
      checkOutDateTime: searchDates.checkOutDateTime,
      startDateTime,
      endDateTime,
    });
    
    // Priorité 1 : Utiliser checkInDateTime/checkOutDateTime si disponibles (contiennent les heures)
    if (searchDates.checkInDateTime && !startDateTime) {
      const startDateObj = new Date(searchDates.checkInDateTime);
      setStartDate(startDateObj.toISOString().split('T')[0]);
      setStartDateTime(searchDates.checkInDateTime);
      if (__DEV__) console.log(`✅ [VehicleBookingScreen] Utilisation checkInDateTime depuis contexte:`, {
        checkInDateTime: searchDates.checkInDateTime,
        date: startDateObj.toISOString().split('T')[0],
        heures: startDateObj.getHours(),
        minutes: startDateObj.getMinutes(),
      });
    } else if (searchDates.checkIn && !startDateTime) {
      // Priorité 2 : Utiliser checkIn et créer une date/heure par défaut (9h)
      setStartDate(searchDates.checkIn);
      const defaultStart = new Date(searchDates.checkIn);
      defaultStart.setHours(9, 0, 0, 0);
      const defaultStartISO = defaultStart.toISOString();
      if (__DEV__) console.log(`📅 [VehicleBookingScreen] Création date/heure début par défaut (pas de checkInDateTime):`, {
        date: searchDates.checkIn,
        heure: 9,
        iso: defaultStartISO,
      });
      setStartDateTime(defaultStartISO);
    }
    
    if (searchDates.checkOutDateTime && !endDateTime) {
      const endDateObj = new Date(searchDates.checkOutDateTime);
      setEndDate(endDateObj.toISOString().split('T')[0]);
      setEndDateTime(searchDates.checkOutDateTime);
      if (__DEV__) console.log(`✅ [VehicleBookingScreen] Utilisation checkOutDateTime depuis contexte:`, {
        checkOutDateTime: searchDates.checkOutDateTime,
        date: endDateObj.toISOString().split('T')[0],
        heures: endDateObj.getHours(),
        minutes: endDateObj.getMinutes(),
      });
    } else if (searchDates.checkOut && !endDateTime) {
      // Priorité 2 : Utiliser checkOut et créer une date/heure par défaut (18h)
      setEndDate(searchDates.checkOut);
      const defaultEnd = new Date(searchDates.checkOut);
      defaultEnd.setHours(18, 0, 0, 0);
      const defaultEndISO = defaultEnd.toISOString();
      if (__DEV__) console.log(`📅 [VehicleBookingScreen] Création date/heure fin par défaut (pas de checkOutDateTime):`, {
        date: searchDates.checkOut,
        heure: 18,
        iso: defaultEndISO,
      });
      setEndDateTime(defaultEndISO);
    }
  }, [searchDates.checkIn, searchDates.checkOut, searchDates.checkInDateTime, searchDates.checkOutDateTime]);

  // Vérifier la disponibilité en temps réel quand les dates/heures changent
  useEffect(() => {
    if (startDateTime && endDateTime && vehicleId) {
      const checkAvailability = async () => {
        try {
          const { data: isAvailable, error: availabilityError } = await supabase
            .rpc('check_vehicle_hourly_availability', {
              p_vehicle_id: vehicleId,
              p_start_datetime: startDateTime,
              p_end_datetime: endDateTime,
              p_exclude_booking_id: null
            });
          
          if (availabilityError) {
            console.error('❌ [VehicleBookingScreen] Erreur lors de la vérification de disponibilité:', availabilityError);
            setAvailabilityError('Erreur lors de la vérification de disponibilité');
            return;
          }
          
          if (!isAvailable) {
            setAvailabilityError('Ce créneau (dates et heures) n\'est pas disponible pour ce véhicule');
          } else {
            setAvailabilityError(null);
          }
        } catch (error) {
          console.error('❌ [VehicleBookingScreen] Erreur dans la vérification de disponibilité:', error);
          setAvailabilityError('Erreur lors de la vérification de disponibilité');
        }
      };
      
      checkAvailability();
    } else {
      setAvailabilityError(null);
    }
  }, [startDateTime, endDateTime, vehicleId]);

  const requiresLicense = vehicle?.requires_license !== false;
  const minLicenseYears = vehicle?.min_license_years || 0;
  const withDriver = vehicle?.with_driver || false;
  // Le permis est TOUJOURS requis si le locataire ne prend pas de chauffeur (impératif)
  // Sinon, il est requis si le véhicule le nécessite et qu'il n'y a pas de chauffeur
  const isLicenseRequired = (withDriver && useDriver === false) || (!withDriver && requiresLicense);

  const calculateRentalDays = () => {
    // Utiliser les heures réelles si disponibles, sinon utiliser les dates
    if (startDateTime && endDateTime) {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 0;
      }
      
      const diffTime = end.getTime() - start.getTime();
      const totalHours = Math.ceil(diffTime / (1000 * 60 * 60));
      
      // Calculer les jours complets à partir des heures totales (plus précis)
      const fullDaysFromHours = Math.floor(totalHours / 24);
      
      // Logique corrigée : utiliser les heures réelles comme base principale
      // Si totalHours >= 24 : utiliser fullDaysFromHours (basé sur les heures réelles)
      // Si totalHours < 24 : 
      //   - Si le véhicule supporte la location par heure : rentalDays = 0 (facturer seulement les heures)
      //   - Si le véhicule ne supporte pas la location par heure : rentalDays = 1 (minimum 1 jour)
      if (totalHours >= 24) {
        return fullDaysFromHours; // Utiliser directement les jours calculés à partir des heures
      } else {
        // Si le véhicule ne supporte pas la location par heure, facturer au minimum 1 jour
        if (!vehicle?.hourly_rental_enabled || !vehicle?.price_per_hour) {
          return 1; // Minimum 1 jour pour les véhicules sans location horaire
        }
        return 0; // Pas de jour complet pour une location de moins de 24 heures avec location horaire
      }
    }
    
    // Fallback : utiliser les dates si les datetime ne sont pas disponibles
    // Dans ce cas, on calcule une estimation basée sur les dates uniquement
    if (!startDate || !endDate) return 0;
    
    // Si les dates sont identiques, c'est au minimum 1 jour de location
    if (startDate === endDate) {
      return 1;
    }
    
    // Si les dates sont différentes, calculer la différence en jours
    // Sans les heures, on suppose une location d'une journée complète par jour calendaire
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Ne pas ajouter +1 : si startDate = 2026-02-01 et endDate = 2026-02-02, 
    // la différence est de 1 jour, donc retourner 1 (pas 2)
    return diffDays;
  };

  const handleDateGuestsChange = (dates: { checkIn?: string; checkOut?: string }, guests: { adults: number; children: number; babies: number }) => {
    // Pour les véhicules, on utilise seulement les dates
    if (dates.checkIn) {
      setStartDate(dates.checkIn);
    }
    if (dates.checkOut) {
      setEndDate(dates.checkOut);
    }
    // Sauvegarder les dates dans le contexte
    saveSearchDates({
      checkIn: dates.checkIn || startDate,
      checkOut: dates.checkOut || endDate,
      adults: guests.adults,
      children: guests.children,
      babies: guests.babies,
    });
  };

  const handleDateTimeChange = (start: string, end: string) => {
    if (__DEV__) console.log(`🔄 [VehicleBookingScreen] handleDateTimeChange appelé avec:`, { start, end });
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    
    if (__DEV__) console.log(`🔄 [VehicleBookingScreen] Dates parsées:`, {
      startDateObj: startDateObj.toISOString(),
      startHours: startDateObj.getHours(),
      startMinutes: startDateObj.getMinutes(),
      endDateObj: endDateObj.toISOString(),
      endHours: endDateObj.getHours(),
      endMinutes: endDateObj.getMinutes(),
    });
    
    setStartDate(startDateObj.toISOString().split('T')[0]);
    setStartDateTime(start);
    setEndDate(endDateObj.toISOString().split('T')[0]);
    setEndDateTime(end);
    
    if (__DEV__) console.log(`✅ [VehicleBookingScreen] États mis à jour:`, {
      startDateTime: start,
      endDateTime: end,
    });
    
    // Sauvegarder les dates ET les heures dans le contexte
    saveSearchDates({
      checkIn: startDateObj.toISOString().split('T')[0],
      checkOut: endDateObj.toISOString().split('T')[0],
      checkInDateTime: start, // Sauvegarder avec les heures
      checkOutDateTime: end,   // Sauvegarder avec les heures
      adults: 1,
      children: 0,
      babies: 0,
    });
  };

  // Fonction pour uploader le document du permis
  const uploadLicenseDocument = async (uri: string, fileName: string, mimeType: string): Promise<string> => {
    setUploadingLicense(true);
    try {
      // Lire le fichier depuis l'URI locale
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      // Utiliser arrayBuffer() au lieu de blob() pour React Native
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Générer un nom de fichier unique
      const fileExt = fileName.split('.').pop() || 'jpg';
      const uniqueFileName = `${user?.id}/${Date.now()}.${fileExt}`;

      // Upload vers Supabase Storage dans le bucket license-documents
      const { data, error } = await supabase.storage
        .from('license-documents')
        .upload(uniqueFileName, uint8Array, {
          cacheControl: '3600',
          upsert: false,
          contentType: mimeType,
        });

      if (error) {
        console.error('Erreur upload permis:', error);
        throw error;
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('license-documents')
        .getPublicUrl(uniqueFileName);

      return publicUrl;
    } catch (error: any) {
      console.error('Erreur lors de l\'upload du permis:', error);
      Alert.alert('Erreur', 'Impossible d\'uploader le document. Veuillez réessayer.');
      throw error;
    } finally {
      setUploadingLicense(false);
    }
  };

  const pickLicenseImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de l\'accès à votre galerie pour envoyer votre permis.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = `license-${Date.now()}.jpg`;
        const url = await uploadLicenseDocument(asset.uri, fileName, 'image/jpeg');
        setLicenseDocumentUrl(url);
      }
    } catch (error: any) {
      console.error('Erreur lors de la sélection de l\'image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const pickLicenseDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const url = await uploadLicenseDocument(asset.uri, asset.name, asset.mimeType || 'application/pdf');
        setLicenseDocumentUrl(url);
      }
    } catch (error: any) {
      console.error('Erreur lors de la sélection du document:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le document');
    }
  };

  const showLicenseFilePicker = () => {
    Alert.alert(
      'Télécharger votre permis',
      'Choisissez le type de fichier à envoyer',
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Photo',
          onPress: pickLicenseImage
        },
        {
          text: 'PDF',
          onPress: pickLicenseDocument
        }
      ]
    );
  };

  const rentalDays = calculateRentalDays();
  
  // Calculer les heures restantes si applicable
  const calculateRemainingHours = () => {
    if (__DEV__) console.log(`🔍 [VehicleBookingScreen] calculateRemainingHours - startDateTime: ${startDateTime}, endDateTime: ${endDateTime}`);
    if (__DEV__) console.log(`🔍 [VehicleBookingScreen] calculateRemainingHours - vehicle:`, {
      hourly_rental_enabled: vehicle?.hourly_rental_enabled,
      price_per_hour: vehicle?.price_per_hour,
      rentalDays
    });
    
    if (!startDateTime || !endDateTime) {
      if (__DEV__) console.log(`⚠️ [VehicleBookingScreen] Pas de startDateTime ou endDateTime`);
      return 0;
    }
    
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      if (__DEV__) console.log(`⚠️ [VehicleBookingScreen] Dates invalides`);
      return 0;
    }
    
    const diffTime = end.getTime() - start.getTime();
    const totalHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    // Calculer les jours complets directement à partir des heures totales
    // Exemple: 260 heures = 10 jours complets (10 × 24 = 240h) + 20 heures restantes
    const fullDaysFromHours = Math.floor(totalHours / 24);
    const hoursInFullDays = fullDaysFromHours * 24;
    const remainingHours = totalHours - hoursInFullDays;
    
    if (__DEV__) console.log(`🔍 [VehicleBookingScreen] Calcul heures: totalHours=${totalHours}, fullDaysFromHours=${fullDaysFromHours}, hoursInFullDays=${hoursInFullDays}, remainingHours=${remainingHours}`);
    
    // Si le véhicule ne supporte pas la location par heure, ne pas retourner d'heures restantes
    // (elles seront facturées comme partie d'un jour minimum)
    if (!vehicle?.hourly_rental_enabled || !vehicle?.price_per_hour) {
      if (__DEV__) console.log(`⚠️ [VehicleBookingScreen] Véhicule ne supporte pas la location par heure - heures non facturées séparément`);
      return 0;
    }
    
    // Si totalHours < 24, toutes les heures sont "restantes" (pas de jour complet)
    // Si totalHours >= 24, on retourne seulement les heures au-delà des jours complets
    if (totalHours < 24) {
      return totalHours; // Toutes les heures sont facturées comme heures, pas de jour complet
    } else {
      return remainingHours > 0 ? remainingHours : 0;
    }
  };
  
  const remainingHours = calculateRemainingHours();
  
  // Log pour déboguer
  if (__DEV__) console.log(`🔍 [VehicleBookingScreen] Résumé - rentalDays: ${rentalDays}, remainingHours: ${remainingHours}, startDateTime: ${startDateTime}, endDateTime: ${endDateTime}`);
  
  // Calculer le prix de base par jour (en tenant compte des tarifs hebdomadaires/mensuels)
  const getBasePricePerDay = () => {
    if (!rentalDays || !vehicle) return vehicle?.price_per_day || 0;
    
    // Si on a un tarif mensuel et que la durée >= 30 jours
    if (vehicle.price_per_month && rentalDays >= 30) {
      const months = Math.floor(rentalDays / 30);
      const remainingDays = rentalDays % 30;
      const totalPrice = (months * vehicle.price_per_month) + (remainingDays * vehicle.price_per_day);
      return totalPrice / rentalDays; // Prix moyen par jour
    }
    
    // Si on a un tarif hebdomadaire et que la durée >= 7 jours
    if (vehicle.price_per_week && rentalDays >= 7) {
      const weeks = Math.floor(rentalDays / 7);
      const remainingDays = rentalDays % 7;
      const totalPrice = (weeks * vehicle.price_per_week) + (remainingDays * vehicle.price_per_day);
      return totalPrice / rentalDays; // Prix moyen par jour
    }
    
    return vehicle.price_per_day || 0;
  };

  const basePricePerDay = getBasePricePerDay();
  
  // Calculer le prix avec réductions (comme sur le site web)
  const discountConfig: DiscountConfig = {
    enabled: vehicle?.discount_enabled || false,
    minNights: vehicle?.discount_min_days || null,
    percentage: vehicle?.discount_percentage || null
  };
  
  const longStayDiscountConfig: DiscountConfig | undefined = vehicle?.long_stay_discount_enabled ? {
    enabled: vehicle?.long_stay_discount_enabled || false,
    minNights: vehicle?.long_stay_discount_min_days || null,
    percentage: vehicle?.long_stay_discount_percentage || null
  } : undefined;
  
  // Utiliser la fonction centralisée pour calculer le prix avec heures et réductions
  const hourlyRateValue = (remainingHours > 0 && vehicle?.hourly_rental_enabled && vehicle?.price_per_hour) 
    ? vehicle.price_per_hour 
    : 0;
  
  const priceCalculation = calculateVehiclePriceWithHours(
    basePricePerDay,
    rentalDays,
    remainingHours,
    hourlyRateValue,
    discountConfig,
    longStayDiscountConfig
  );
  
  const daysPrice = priceCalculation.daysPrice;
  const hoursPrice = priceCalculation.hoursPrice;
  const originalDaysPrice = daysPrice;
  const originalBasePrice = priceCalculation.originalTotal;
  const discountAmount = priceCalculation.discountAmount;
  const basePrice = priceCalculation.basePrice;
  const pricing = {
    discountApplied: priceCalculation.discountApplied,
    discountType: priceCalculation.discountType,
    discountAmount: discountAmount
  };
  
  if (hoursPrice > 0) {
    if (__DEV__) console.log(`💰 [VehicleBookingScreen] Calcul prix heures: ${remainingHours}h × ${hourlyRateValue} = ${hoursPrice}`);
  } else {
    if (__DEV__) console.log(`⚠️ [VehicleBookingScreen] Pas de calcul heures: remainingHours=${remainingHours}, hourly_rental_enabled=${vehicle?.hourly_rental_enabled}, price_per_hour=${vehicle?.price_per_hour}`);
  }
  
  // Ajouter le surplus chauffeur si le véhicule est proposé avec chauffeur et que le locataire choisit le chauffeur
  const driverFee = (withDriver && useDriver === true && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
  const basePriceWithDriver = basePrice + driverFee;
  
  // Frais de service véhicule : 11% si CB, 10% pour les autres (CB proposée seulement en XOF/EUR)
  const isCardPayment = (currency === 'EUR' || currency === 'XOF') && selectedPaymentMethod === 'card';
  const fees = calculateFees(basePriceWithDriver, rentalDays, 'vehicle', undefined, currency, isCardPayment);
  const totalPrice = basePriceWithDriver + fees.serviceFee;
  
  const securityDeposit = vehicle?.security_deposit || 0;
  const canPayByCard = currency === 'EUR' || currency === 'XOF';
  const [lastPaymentStatus, setLastPaymentStatus] = useState<{ payment_status: string; booking_status: string } | null>(null);

  const checkStripePaymentCompleted = useCallback(async (opts: { bookingId?: string; checkoutToken?: string }): Promise<{ paid: boolean; payment_status?: string; booking_status?: string; booking_id?: string; error?: string }> => {
    const { bookingId, checkoutToken } = opts;
    const fallback = { paid: false, payment_status: 'pending', booking_status: 'pending' };
    if (!bookingId && !checkoutToken) return fallback;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const body: Record<string, unknown> = { booking_type: 'vehicle' };
      if (checkoutToken) body.checkout_token = checkoutToken;
      else if (bookingId) body.booking_id = bookingId;
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body,
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });
      if (__DEV__ && (data || error)) {
        console.log('[Stripe] check-payment-status (vehicle):', { data, error: error?.message });
      }
      const ps = data?.payment_status != null ? String(data.payment_status) : 'pending';
      const bs = data?.booking_status != null ? String(data.booking_status) : 'pending';
      setLastPaymentStatus({ payment_status: ps, booking_status: bs });

      if (error) {
        const errMsg = data?.error || error?.message || 'Erreur de vérification';
        return { paid: false, payment_status: ps, booking_status: bs, error: errMsg };
      }
      const resolvedBookingId = data?.booking_id ?? bookingId;
      if (data) {
        if (data.is_confirmed === true) return { paid: true, payment_status: ps, booking_status: bs, booking_id: resolvedBookingId };
        const psLower = ps.toLowerCase();
        const bsLower = bs.toLowerCase();
        if (['completed', 'succeeded', 'paid'].includes(psLower) || ['confirmed', 'completed'].includes(bsLower)) {
          return { paid: true, payment_status: ps, booking_status: bs, booking_id: resolvedBookingId };
        }
      }

      if (!resolvedBookingId) return { paid: false, payment_status: ps, booking_status: bs };

      const { data: paymentData } = await supabase
        .from('vehicle_payments')
        .select('status')
        .eq('booking_id', resolvedBookingId)
        .order('created_at', { ascending: false })
        .limit(1);
      const directPaymentStatus = String(paymentData?.[0]?.status || '').toLowerCase();
      if (['completed', 'succeeded', 'paid'].includes(directPaymentStatus)) {
        setLastPaymentStatus({ payment_status: directPaymentStatus, booking_status: bs });
        return { paid: true, payment_status: directPaymentStatus, booking_status: bs };
      }

      const { data: bookingData } = await supabase
        .from('vehicle_bookings')
        .select('status')
        .eq('id', resolvedBookingId)
        .maybeSingle();
      const directBookingStatus = String(bookingData?.status || '').toLowerCase();
      if (['confirmed', 'completed'].includes(directBookingStatus)) {
        setLastPaymentStatus({ payment_status: ps, booking_status: directBookingStatus });
        return { paid: true, payment_status: ps, booking_status: directBookingStatus };
      }
      return { paid: false, payment_status: ps, booking_status: bs };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erreur vérification Stripe véhicule:', err);
      return { paid: false, error: msg, ...fallback };
    }
  }, []);

  const cancelPendingCardBooking = useCallback(async (bookingId: string, reason: string) => {
    try {
      const result = await checkStripePaymentCompleted({ bookingId });
      if (result.paid) return false;

      const { error } = await supabase
        .from('vehicle_bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_by: user?.id || null,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('renter_id', user?.id || '');

      if (error) {
        console.error('Erreur annulation réservation véhicule pending card:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Erreur inattendue annulation pending card véhicule:', err);
      return false;
    }
  }, [checkStripePaymentCompleted, user?.id]);

  const resetStripePendingState = useCallback(() => {
    setPendingStripeBookingId(null);
    setPendingStripeCheckoutToken(null);
    setPendingStripeStartedAt(null);
    setStripeTimeLeftSec(0);
    setCheckingStripeStatus(false);
    setOpeningStripe(false);
    setLastPaymentStatus(null);
  }, []);

  const verifyStripePaymentNow = useCallback(async () => {
    const idOrToken = pendingStripeBookingId ? { bookingId: pendingStripeBookingId } : pendingStripeCheckoutToken ? { checkoutToken: pendingStripeCheckoutToken } : null;
    if (!idOrToken || checkingStripeStatus) return;
    setCheckingStripeStatus(true);
    const result = await checkStripePaymentCompleted(idOrToken);
    setCheckingStripeStatus(false);

    if (result.paid) {
      resetStripePendingState();
      setLastPaymentStatus(null);
      setStartDate('');
      setEndDate('');
      setStartDateTime(null);
      setEndDateTime(null);
      setMessage('');
      setHasLicense(false);
      setLicenseYears('');
      setLicenseNumber('');
      setLicenseDocumentUrl(null);
      navigation.goBack();
      setTimeout(() => {
        Alert.alert(
          'Paiement confirmé',
          vehicle?.auto_booking
            ? 'Votre paiement est confirmé. La réservation est maintenant confirmée. Vous recevrez une confirmation par email.'
            : 'Votre paiement est confirmé. La demande a été envoyée au propriétaire. Vous recevrez une réponse par email.'
        );
      }, 400);
    } else if (result.error) {
      Alert.alert('Vérification', result.error + '\n\nRéessayez dans quelques secondes ou cliquez sur « Vérifier le paiement ».');
    }
  }, [pendingStripeBookingId, pendingStripeCheckoutToken, checkingStripeStatus, checkStripePaymentCompleted, vehicle?.auto_booking, resetStripePendingState, navigation]);

  const handleAbandonStripeOperation = useCallback(() => {
    const hasPending = pendingStripeBookingId || pendingStripeCheckoutToken;
    if (!hasPending) return;
    Alert.alert(
      'Abandonner le paiement ?',
      pendingStripeBookingId
        ? 'Cette action annulera la demande en attente et libérera immédiatement les dates.'
        : "Voulez-vous abandonner ? Aucune réservation n'a été créée tant que le paiement n'est pas effectué.",
      [
        { text: 'Continuer le paiement', style: 'cancel' },
        {
          text: 'J’abandonne',
          style: 'destructive',
          onPress: async () => {
            if (pendingStripeBookingId) {
              await cancelPendingCardBooking(pendingStripeBookingId, 'Paiement carte abandonné');
            }
            resetStripePendingState();
            navigation.goBack();
          },
        },
      ]
    );
  }, [pendingStripeBookingId, pendingStripeCheckoutToken, cancelPendingCardBooking, resetStripePendingState, navigation]);

  useEffect(() => {
    if (!pendingStripeStartedAt || (!pendingStripeBookingId && !pendingStripeCheckoutToken)) return;

    const timer = setInterval(() => {
      const elapsed = Date.now() - pendingStripeStartedAt;
      const remainingMs = Math.max(0, STRIPE_PENDING_TIMEOUT_MS - elapsed);
      setStripeTimeLeftSec(Math.floor(remainingMs / 1000));

      if (remainingMs <= 0) {
        clearInterval(timer);
        (async () => {
          if (pendingStripeBookingId) {
            await cancelPendingCardBooking(pendingStripeBookingId, 'Paiement carte expiré (timeout)');
          }
          resetStripePendingState();
          Alert.alert('Paiement expiré', 'Le délai de paiement est dépassé.');
          navigation.goBack();
        })();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingStripeBookingId, pendingStripeCheckoutToken, pendingStripeStartedAt, cancelPendingCardBooking, resetStripePendingState, navigation]);

  useEffect(() => {
    const hasPending = pendingStripeBookingId || pendingStripeCheckoutToken;
    if (!hasPending) return;
    const poller = setInterval(() => verifyStripePaymentNow(), 2000);
    return () => clearInterval(poller);
  }, [pendingStripeBookingId, pendingStripeCheckoutToken, verifyStripePaymentNow]);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const hasPending = pendingStripeBookingId || pendingStripeCheckoutToken;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      if (wasBackground && nextState === 'active' && hasPending) {
        verifyStripePaymentNow();
        retryTimeout = setTimeout(() => verifyStripePaymentNow(), 2000);
      }
      appStateRef.current = nextState;
    });
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      subscription.remove();
    };
  }, [pendingStripeBookingId, pendingStripeCheckoutToken, verifyStripePaymentNow]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!pendingStripeBookingId && !pendingStripeCheckoutToken) return;
      e.preventDefault();
      (async () => {
        const idOrToken = pendingStripeBookingId ? { bookingId: pendingStripeBookingId } : pendingStripeCheckoutToken ? { checkoutToken: pendingStripeCheckoutToken } : null;
        if (!idOrToken) return;
        const result = await checkStripePaymentCompleted(idOrToken);
        if (result.paid) {
          resetStripePendingState();
          setLastPaymentStatus(null);
          setStartDate('');
          setEndDate('');
          setStartDateTime(null);
          setEndDateTime(null);
          setMessage('');
          setHasLicense(false);
          setLicenseYears('');
          setLicenseNumber('');
          setLicenseDocumentUrl(null);
          navigation.goBack();
          setTimeout(() => {
            Alert.alert(
              'Paiement confirmé',
              vehicle?.auto_booking
                ? 'Votre paiement est confirmé. La réservation est maintenant confirmée. Vous recevrez une confirmation par email.'
                : 'Votre paiement est confirmé. La demande a été envoyée au propriétaire. Vous recevrez une réponse par email.'
            );
          }, 400);
        } else {
          handleAbandonStripeOperation();
        }
      })();
    });
    return unsubscribe;
  }, [navigation, pendingStripeBookingId, pendingStripeCheckoutToken, handleAbandonStripeOperation, checkStripePaymentCompleted, resetStripePendingState, vehicle?.auto_booking]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour effectuer une réservation');
      return;
    }

    if (identityLoading) {
      Alert.alert('Vérification en cours', 'Vérification de l\'identité en cours...');
      return;
    }

    if (!hasUploadedIdentity) {
      Alert.alert(
        'Vérification d\'identité requise',
        'Vous devez télécharger une pièce d\'identité pour effectuer une réservation. Rendez-vous dans votre profil.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Aller au profil', onPress: () => navigation.navigate('ProfileTab' as never) },
        ]
      );
      return;
    }

    // Permettre les réservations si le document est vérifié OU en cours d'examen (pending)
    // Bloquer seulement si le document a été rejeté (rejected) ou n'existe pas
    if (!isVerified && verificationStatus !== 'pending') {
      if (verificationStatus === 'rejected') {
        Alert.alert(
          'Identité rejetée',
          'Votre document d\'identité a été rejeté. Veuillez soumettre un nouveau document valide pour effectuer des réservations.'
        );
      } else {
        Alert.alert(
          'Identité requise',
          'Vous devez soumettre un document d\'identité pour effectuer une réservation.'
        );
      }
      return;
    }

    if (!startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates de début et de fin');
      return;
    }

    // Comparer les dates en format string pour éviter les problèmes de fuseau horaire
    // Le format "YYYY-MM-DD" est lexicographiquement comparable
    // La date de fin doit être strictement supérieure à la date de début
    if (endDate <= startDate) {
      Alert.alert('Erreur', 'La date de rendu doit être strictement supérieure à la date de prise. Vous ne pouvez pas commencer et terminer la location le même jour.');
      return;
    }

    if (withDriver && useDriver === null) {
      Alert.alert('Choix requis', 'Veuillez indiquer si vous souhaitez utiliser le service de chauffeur ou conduire vous-même.');
      return;
    }

    // Valider les informations de paiement (comme résidence meublée)
    const validatePaymentInfo = () => {
      if (selectedPaymentMethod === 'card' || selectedPaymentMethod === 'cash') {
        return true;
      }
      Alert.alert('Bientot disponible', 'Ce moyen de paiement sera bientot disponible. Utilisez Carte bancaire (Stripe) ou Espèces.');
      return false;
    };
    if (!validatePaymentInfo()) return;

    if (isLicenseRequired) {
      if (!hasLicense) {
        const message = (withDriver && useDriver === false) 
          ? 'Le permis de conduire est obligatoire lorsque vous conduisez vous-même. Veuillez cocher la case pour confirmer que vous possédez un permis.'
          : 'Vous devez posséder un permis de conduire pour réserver ce véhicule.';
        Alert.alert('Permis requis', message);
        return;
      }
      if (!licenseYears || licenseYears.trim() === '') {
        Alert.alert('Information manquante', 'Veuillez indiquer depuis combien d\'années vous possédez votre permis.');
        return;
      }
      const licenseYearsNum = parseInt(licenseYears);
      if (isNaN(licenseYearsNum) || licenseYearsNum < minLicenseYears) {
        Alert.alert('Permis insuffisant', `Ce véhicule nécessite au moins ${minLicenseYears} an(s) de permis.`);
        return;
      }
      // Le document du permis est OBLIGATOIRE
      if (!licenseDocumentUrl) {
        Alert.alert(
          'Document requis',
          'Vous devez télécharger votre permis de conduire pour réserver ce véhicule.'
        );
        return;
      }
    }

    await runVehicleBookingSubmit(currency, currency === 'EUR' ? rates.EUR : undefined);
  }

  const runVehicleBookingSubmit = async (payCurrency: 'XOF' | 'EUR', payRate?: number) => {
    setIsSubmitting(true);
    try {
      const startDateStr = startDate;
      const endDateStr = endDate;

      // Préparer useDriver AVANT l'appel
      const useDriverToPass = withDriver ? (useDriver ?? false) : undefined;
      
      // Logs AVANT l'appel pour voir exactement ce qui est passé
      console.log('📤 [VehicleBookingScreen] AVANT appel createBooking:', {
        withDriver,
        useDriver,
        'useDriver type': typeof useDriver,
        'useDriver === true': useDriver === true,
        'useDriver === false': useDriver === false,
        'useDriver === null': useDriver === null,
        'useDriverToPass': useDriverToPass,
        'useDriverToPass === true': useDriverToPass === true,
        'vehicle.driver_fee': vehicle?.driver_fee,
        'vehicle.with_driver': vehicle?.with_driver,
      });

      const result = await createBooking({
        vehicleId: vehicle.id,
        startDate: startDateStr,
        endDate: endDateStr,
        startDateTime: startDateTime!,
        endDateTime: endDateTime!,
        messageToOwner: message.trim() || undefined,
        licenseDocumentUrl: licenseDocumentUrl || undefined,
        hasLicense: isLicenseRequired ? hasLicense : undefined,
        licenseYears: isLicenseRequired && hasLicense ? licenseYears : undefined,
        licenseNumber: isLicenseRequired && hasLicense ? licenseNumber : undefined,
        useDriver: useDriverToPass,
        driverFee: useDriverToPass === true && vehicle?.driver_fee != null ? Number(vehicle.driver_fee) : undefined,
        paymentMethod: selectedPaymentMethod,
        paymentCurrency: payCurrency,
        paymentRate: payRate,
      });
      
      // Logs APRÈS l'appel pour confirmation
      console.log('✅ [VehicleBookingScreen] APRÈS appel createBooking:', {
        success: result.success,
        'useDriver passé': useDriverToPass,
      });

      if (result.success) {
        const isCardPayment = selectedPaymentMethod === 'card';
        const isConfirmed = result.status === 'confirmed';

        // Paiement carte: garder l'écran ouvert en attente de confirmation Stripe.
        if (isCardPayment) {
          const checkoutUrl = result.checkoutUrl ?? null;
          const checkoutToken = (result as any).checkoutToken ?? null;
          const bookingId = result.booking?.id ?? null;
          if (!checkoutUrl) {
            if (bookingId) {
              await cancelPendingCardBooking(bookingId, result.paymentInitError || 'Initialisation Stripe impossible');
            }
            Alert.alert(
              'Paiement indisponible',
              result.paymentInitError || 'Impossible d’ouvrir Stripe. Aucune réservation en attente n’a été conservée.'
            );
            return;
          }

          if (checkoutToken) {
            setPendingStripeCheckoutToken(checkoutToken);
            setPendingStripeBookingId(null);
          } else {
            setPendingStripeBookingId(bookingId!);
            setPendingStripeCheckoutToken(null);
          }
          setPendingStripeStartedAt(Date.now());
          setStripeTimeLeftSec(Math.floor(STRIPE_PENDING_TIMEOUT_MS / 1000));
          setOpeningStripe(false);
          Linking.openURL(checkoutUrl).catch(async (openErr: any) => {
            if (bookingId) await cancelPendingCardBooking(bookingId, 'Impossible d’ouvrir Stripe Checkout');
            resetStripePendingState();
            Alert.alert('Erreur', openErr?.message || 'Impossible d’ouvrir Stripe.');
          });
          return;
        }

        // Réinitialiser le formulaire pour les modes hors carte
        setStartDate('');
        setEndDate('');
        setStartDateTime(null);
        setEndDateTime(null);
        setMessage('');
        setHasLicense(false);
        setLicenseYears('');
        setLicenseNumber('');
        setLicenseDocumentUrl(null);

        // Fermer automatiquement l'écran et naviguer vers la page du véhicule
        navigation.goBack(); // Retour à la page précédente (page du véhicule)

        // Afficher l'alerte de confirmation (non bloquante) pour les autres moyens de paiement
        setTimeout(() => {
          Alert.alert(
            isConfirmed ? 'Réservation confirmée !' : 'Demande envoyée !',
            isConfirmed 
              ? 'Votre réservation a été confirmée automatiquement. Vous recevrez une confirmation par email.'
              : 'Votre demande de réservation a été envoyée au propriétaire. Vous recevrez une réponse sous peu.'
          );
        }, 300); // Petit délai pour laisser l'animation de navigation se faire
      } else {
        if (result.error === 'IDENTITY_REQUIRED') {
          Alert.alert(
            'Vérification d\'identité requise',
            'Vous devez télécharger une pièce d\'identité pour effectuer une réservation. Rendez-vous dans votre profil.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Aller au profil', onPress: () => navigation.navigate('ProfileTab' as never) },
            ]
          );
        } else if (result.error === 'IDENTITY_NOT_VERIFIED') {
          Alert.alert(
            'Identité en cours de vérification',
            'Votre pièce d\'identité est en cours de vérification. Vous pourrez réserver une fois qu\'elle sera validée par notre équipe.'
          );
        } else {
          Alert.alert('Erreur', result.error || 'Une erreur est survenue lors de l\'envoi de votre demande');
        }
      }
    } catch (error: any) {
      console.error('Erreur lors de la réservation:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi de votre demande');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingVehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Chargement du véhicule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>Véhicule introuvable</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Récupérer toutes les images du véhicule
  const vehicleImages = vehicle.images || vehicle.vehicle_photos?.map((p: any) => p.url) || [];
  const hasMultipleImages = vehicleImages.length > 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (pendingStripeBookingId || pendingStripeCheckoutToken) {
              handleAbandonStripeOperation();
              return;
            }
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réservation</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          ref={mainScrollViewRef}
        >
        {/* Véhicule */}
        <View style={styles.vehicleCard}>
          {vehicleImages.length > 0 ? (
            <View style={styles.imageContainer}>
              <ScrollView
                ref={imageScrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / 100);
                  setCurrentImageIndex(index);
                }}
                style={styles.imageScrollView}
              >
                {vehicleImages.map((imageUrl: string, index: number) => (
                  <Image
                    key={index}
                    source={{ uri: imageUrl }}
                    style={styles.vehicleImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {hasMultipleImages ? (
                <View style={styles.imageIndicators}>
                  {vehicleImages.map((_: string, index: number) => (
                    <View
                      key={index}
                      style={[
                        styles.indicator,
                        index === currentImageIndex && styles.activeIndicator,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.vehicleImage, styles.vehicleImagePlaceholder]}>
              <Ionicons name="car-outline" size={48} color="#ccc" />
            </View>
          )}
          <View style={styles.vehicleInfo}>
            <TouchableOpacity
              onPress={() => vehicle?.id && navigation.navigate('VehicleDetails', { vehicleId: vehicle.id })}
              activeOpacity={0.7}
            >
              <Text style={[styles.vehicleTitle, styles.vehicleTitleLink]}>
                {vehicle.title || `${vehicle.brand || ''} ${vehicle.model || ''}`.trim()}
              </Text>
            </TouchableOpacity>
            <Text style={styles.vehiclePrice}>
              {rentalDays > 0 && basePricePerDay !== vehicle.price_per_day 
                ? formatPrice(basePricePerDay) + ' / jour (tarif préférentiel)'
                : formatPrice(vehicle.price_per_day || 0) + ' / jour'}
            </Text>
            {vehicle.price_per_week && vehicle.price_per_week > 0 ? (
              <Text style={styles.vehiclePriceAlt}>
                {formatPrice(vehicle.price_per_week)} / semaine
              </Text>
            ) : null}
            {vehicle.price_per_month && vehicle.price_per_month > 0 ? (
              <Text style={styles.vehiclePriceAlt}>
                {formatPrice(vehicle.price_per_month)} / mois
              </Text>
            ) : null}
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates et heures de location</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDateTimePicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={TRAVELER_COLORS.primary} />
            <View style={styles.dateTimeButtonContent}>
              {startDateTime && endDateTime ? (
                <>
                  <Text style={styles.dateTimeButtonText}>
                    {(() => {
                      const startDate = new Date(startDateTime);
                      const dateStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                      const timeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
                      if (__DEV__) console.log(`📅 [VehicleBookingScreen] Affichage début: ${dateStr} ${timeStr} (startDateTime: ${startDateTime})`);
                      return `${dateStr} ${timeStr}`;
                    })()}
                  </Text>
                  <Text style={styles.dateTimeButtonText}>
                    {(() => {
                      const endDate = new Date(endDateTime);
                      const dateStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                      const timeStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
                      if (__DEV__) console.log(`📅 [VehicleBookingScreen] Affichage fin: ${dateStr} ${timeStr} (endDateTime: ${endDateTime})`);
                      return `${dateStr} ${timeStr}`;
                    })()}
                  </Text>
                </>
              ) : (
                <Text style={styles.dateTimeButtonPlaceholder}>Sélectionner les dates et heures</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          {startDateTime && endDateTime && (rentalDays > 0 || remainingHours > 0) ? (
            <Text style={styles.rentalDaysText}>
              {rentalDays > 0 && `${rentalDays} jour${rentalDays > 1 ? 's' : ''}`}
              {rentalDays > 0 && remainingHours > 0 && ' et '}
              {remainingHours > 0 && `${remainingHours} heure${remainingHours > 1 ? 's' : ''}`} de location
            </Text>
          ) : null}
          {availabilityError ? (
            <View style={styles.availabilityErrorContainer}>
              <Ionicons name="alert-circle" size={20} color="#dc2626" />
              <Text style={styles.availabilityErrorText}>{availabilityError}</Text>
            </View>
          ) : null}
        </View>

        {/* Choix du chauffeur */}
        {withDriver ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service de chauffeur</Text>
            <View style={styles.driverOptions}>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  useDriver === true && styles.driverOptionActive,
                ]}
                onPress={() => {
                  console.log('🚗 [VehicleBookingScreen] Sélection "Avec chauffeur"', {
                    'Avant': useDriver,
                    'Après': true,
                    'vehicle.with_driver': vehicle?.with_driver,
                    'vehicle.driver_fee': vehicle?.driver_fee,
                  });
                  setUseDriver(true);
                }}
              >
                <Ionicons
                  name={useDriver === true ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={useDriver === true ? '#2E7D32' : '#ccc'}
                />
                <Text style={styles.driverOptionText}>Avec chauffeur</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  useDriver === false && styles.driverOptionActive,
                ]}
                onPress={() => {
                  console.log('🚗 [VehicleBookingScreen] Sélection "Conduire moi-même"', {
                    'Avant': useDriver,
                    'Après': false,
                  });
                  setUseDriver(false);
                }}
              >
                <Ionicons
                  name={useDriver === false ? 'radio-button-on' : 'radio-button-off'}
                  size={24}
                  color={useDriver === false ? '#2E7D32' : '#ccc'}
                />
                <Text style={styles.driverOptionText}>Conduire moi-même</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Permis de conduire */}
        {isLicenseRequired ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Permis de conduire {(withDriver && useDriver === false) ? '(Obligatoire)' : ''}
            </Text>
            {(withDriver && useDriver === false) ? (
              <Text style={styles.requiredNote}>
                Le permis de conduire est obligatoire lorsque vous conduisez vous-même.
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setHasLicense(!hasLicense)}
            >
              <Ionicons
                name={hasLicense ? 'checkbox' : 'square-outline'}
                size={24}
                color={hasLicense ? '#2E7D32' : ((withDriver && useDriver === false) ? '#ef4444' : '#ccc')}
              />
              <Text style={[
                styles.checkboxLabel,
                (withDriver && useDriver === false) && !hasLicense && styles.requiredLabel
              ]}>
                Je possède un permis de conduire {(withDriver && useDriver === false) ? '*' : ''}
              </Text>
            </TouchableOpacity>
            {hasLicense ? (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Depuis combien d'années avez-vous votre permis ? *
                  </Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowLicenseYearsPicker(true)}
                  >
                    <Text style={[styles.selectButtonText, !licenseYears && styles.selectButtonPlaceholder]}>
                      {licenseYears ? (
                        licenseYears === '1' ? 'Moins d\'1 an' :
                        licenseYears === '2' ? '1-2 ans' :
                        licenseYears === '3' ? '2-3 ans' :
                        licenseYears === '5' ? '3-5 ans' :
                        licenseYears === '10' ? 'Plus de 5 ans' :
                        `${licenseYears} an(s)`
                      ) : 'Sélectionnez *'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Numéro de permis (optionnel)"
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                />
                
                {/* Upload du document du permis - OBLIGATOIRE */}
                <View style={styles.uploadSection}>
                  <Text style={styles.uploadLabel}>
                    Télécharger votre permis de conduire {(withDriver && useDriver === false) ? '*' : ''}
                  </Text>
                  {licenseDocumentUrl ? (
                    <View style={styles.uploadedFile}>
                      <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                      <Text style={styles.uploadedFileText}>Document téléchargé</Text>
                      <TouchableOpacity
                        onPress={() => setLicenseDocumentUrl(null)}
                        style={styles.removeFileButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={showLicenseFilePicker}
                      disabled={uploadingLicense}
                    >
                      {uploadingLicense ? (
                        <>
                          <ActivityIndicator size="small" color="#2E7D32" />
                          <Text style={styles.uploadButtonText}>Upload en cours...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={20} color="#2E7D32" />
                          <Text style={styles.uploadButtonText}>Télécharger le document</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <Text style={styles.uploadHint}>
                    Formats acceptés : JPG, PNG ou PDF (max 5MB)
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message au propriétaire (optionnel)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Ajoutez un message pour le propriétaire..."
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Moyen de paiement - Complet comme résidence meublée */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moyen de paiement</Text>
          <View style={styles.paymentMethodsContainer}>
            {[
              ...(canPayByCard ? [{ value: 'card' as const, label: 'Carte bancaire (euros)', icon: 'card' as const }] : []),
              { value: 'wave' as const, label: 'Wave', icon: 'wallet' as const },
              { value: 'orange_money' as const, label: 'Orange Money', icon: 'phone-portrait' as const },
              { value: 'mtn_money' as const, label: 'MTN Money', icon: 'phone-portrait' as const },
              { value: 'moov_money' as const, label: 'Moov Money', icon: 'phone-portrait' as const },
              { value: 'paypal' as const, label: 'PayPal', icon: 'logo-paypal' as const },
              { value: 'cash' as const, label: 'Espèces', icon: 'cash' as const },
            ].map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.paymentMethodOption,
                  selectedPaymentMethod === method.value && styles.paymentMethodOptionSelected,
                ]}
                onPress={() => {
                  if (method.value === 'cash') {
                    setSelectedPaymentMethod('cash');
                    return;
                  }
                  if (method.value === 'card') {
                    if (currency === 'XOF' && rates.EUR) {
                      const eurAmount = totalPrice / rates.EUR;
                      const eurText = eurAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      Alert.alert(
                        'Carte bancaire - Paiement en euros',
                        `La carte bancaire est disponible uniquement pour le paiement en euros.\n\nSouhaitez-vous effectuer le paiement en euros ? Si oui, le montant sera converti et débité en euros : ~${eurText} € (équivalent de ${totalPrice.toLocaleString('fr-FR')} FCFA).`,
                        [
                          { text: 'Non', style: 'cancel' },
                          { text: 'Oui, payer en euros', onPress: () => setSelectedPaymentMethod('card') },
                        ]
                      );
                      return;
                    }
                    setSelectedPaymentMethod('card');
                    return;
                  }
                  Alert.alert('Bientot disponible', `${method.label} sera bientot disponible. ${canPayByCard ? 'Utilisez Carte bancaire (Stripe) ou Espèces.' : 'Utilisez Espèces.'}`);
                }}
              >
                <Ionicons name={method.icon as any} size={24} color={selectedPaymentMethod === method.value ? '#2E7D32' : '#666'} />
                <Text style={[styles.paymentMethodOptionText, selectedPaymentMethod === method.value && styles.paymentMethodOptionTextSelected]}>
                  {method.label}{method.value !== 'card' ? ' • Recommandé' : ''}
                </Text>
                {selectedPaymentMethod === method.value && <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Carte bancaire: paiement uniquement via Stripe Checkout */}
          {selectedPaymentMethod === 'card' && (
            <View style={styles.paymentInfoContainer}>
                <View style={styles.securityInfo}>
                  <Ionicons name="shield-checkmark" size={16} color="#10b981" />
                  <Text style={styles.securityText}>
                    {vehicle?.auto_booking
                      ? 'Paiement sécurisé via Stripe. Après paiement validé, votre réservation sera confirmée automatiquement.'
                      : 'Paiement sécurisé via Stripe. Après paiement validé, votre demande sera transmise au propriétaire.'}
                  </Text>
                </View>
            </View>
          )}

          {(selectedPaymentMethod === 'wave' || selectedPaymentMethod === 'paypal' || selectedPaymentMethod === 'orange_money' || selectedPaymentMethod === 'mtn_money' || selectedPaymentMethod === 'moov_money') && (
            <View style={styles.paymentInfoContainer}>
              <View style={styles.securityInfo}>
                <Ionicons name="time-outline" size={20} color="#f59e0b" />
                <Text style={styles.securityText}>Ce moyen de paiement sera bientot disponible. {canPayByCard ? 'Utilisez Carte bancaire (Stripe) ou Espèces.' : 'Utilisez Espèces.'}</Text>
              </View>
            </View>
          )}

          {/* Espèces */}
          {selectedPaymentMethod === 'cash' && (
            <View style={styles.paymentInfoContainer}>
              <Text style={styles.paymentInfoTitle}>Paiement en espèces</Text>
              <View style={styles.cashInfo}>
                <Ionicons name="cash" size={40} color="#6b7280" />
                <Text style={styles.cashText}>Vous paierez directement au propriétaire lors de la prise en charge du véhicule. Assurez-vous d'avoir le montant exact en espèces.</Text>
              </View>
            </View>
          )}
        </View>

        {(pendingStripeBookingId || pendingStripeCheckoutToken) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {vehicle?.auto_booking ? 'Paiement en attente' : 'En attente d\'acceptation'}
            </Text>
            <View style={styles.stripePendingBox}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.stripePendingText}>
                {vehicle?.auto_booking
                  ? 'Finalisez le paiement sur Stripe. En revenant ici, la confirmation se fera automatiquement.'
                  : 'Finalisez le paiement sur Stripe. En revenant ici, votre demande sera enregistrée et vous serez en attente d\'acceptation par le propriétaire.'}
              </Text>
              {lastPaymentStatus && (
                <Text style={styles.stripeStatusText}>
                  Statut : paiement {lastPaymentStatus.payment_status} · réservation {lastPaymentStatus.booking_status}
                </Text>
              )}
              <Text style={styles.stripePendingCountdown}>
                Expiration dans {Math.max(0, Math.floor(stripeTimeLeftSec / 60))}:{String(Math.max(0, stripeTimeLeftSec % 60)).padStart(2, '0')}
              </Text>
              <View style={styles.stripePendingActions}>
                <TouchableOpacity
                  style={[styles.stripeActionButton, styles.stripeActionPrimary]}
                  onPress={verifyStripePaymentNow}
                  disabled={checkingStripeStatus}
                >
                  {checkingStripeStatus ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.stripeActionPrimaryText}>Verifier le paiement</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stripeActionButton, styles.stripeActionDanger]}
                  onPress={handleAbandonStripeOperation}
                >
                  <Text style={styles.stripeActionDangerText}>J’abandonne l’operation</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Résumé */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Résumé</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Prix par jour</Text>
            <Text style={styles.summaryValue}>
              {basePricePerDay !== vehicle.price_per_day 
                ? `${formatPrice(vehicle.price_per_day)} → ${formatPrice(basePricePerDay)}`
                : formatPrice(basePricePerDay)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Durée de location</Text>
            <Text style={styles.summaryValue}>
              {rentalDays > 0 && `${rentalDays} jour${rentalDays > 1 ? 's' : ''}`}
              {rentalDays > 0 && remainingHours > 0 && ' et '}
              {remainingHours > 0 && `${remainingHours} heure${remainingHours > 1 ? 's' : ''}`}
            </Text>
          </View>
          {/* Détail du calcul : jours */}
          {rentalDays > 0 && (
            <View style={styles.summaryRow}>
              <View style={{ flex: 1, flexShrink: 1 }}>
                <Text style={styles.summaryLabel} numberOfLines={2}>
                  {rentalDays} jour{rentalDays > 1 ? 's' : ''} × {formatPrice(basePricePerDay)}/jour
                </Text>
              </View>
              <Text style={styles.summaryValue}>
                {formatPrice(originalDaysPrice)}
              </Text>
            </View>
          )}
          {/* Détail du calcul : heures */}
          {(() => {
            const shouldShowHours = remainingHours > 0 && vehicle?.price_per_hour && hoursPrice > 0;
            if (__DEV__) console.log(`🔍 [VehicleBookingScreen] Affichage heures - shouldShowHours: ${shouldShowHours}, remainingHours: ${remainingHours}, price_per_hour: ${vehicle?.price_per_hour}, hoursPrice: ${hoursPrice}`);
            return shouldShowHours ? (
              <View style={styles.summaryRow}>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <Text style={styles.summaryLabel} numberOfLines={2}>
                    {remainingHours} heure{remainingHours > 1 ? 's' : ''} × {formatPrice(vehicle.price_per_hour)}/h
                  </Text>
                </View>
                <Text style={styles.summaryValue}>
                  {formatPrice(hoursPrice)}
                </Text>
              </View>
            ) : null;
          })()}
          {basePricePerDay !== vehicle.price_per_day ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tarif préférentiel appliqué</Text>
              <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>
                {vehicle.price_per_month && rentalDays >= 30 
                  ? 'Tarif mensuel'
                  : vehicle.price_per_week && rentalDays >= 7
                  ? 'Tarif hebdomadaire'
                  : 'Tarif préférentiel'}
              </Text>
            </View>
          ) : null}
          {pricing.discountApplied && discountAmount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Réduction {pricing.discountType === 'long_stay' ? 'séjour long' : ''} ({pricing.discountType === 'long_stay' 
                  ? longStayDiscountConfig?.percentage 
                  : discountConfig.percentage}%)
              </Text>
              <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>
                -{formatPrice(discountAmount)}
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(basePrice)}
            </Text>
          </View>
          {driverFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Surplus chauffeur</Text>
              <Text style={styles.summaryValue}>{formatPrice(driverFee)}</Text>
            </View>
          )}
          {fees.serviceFee > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Frais de service</Text>
              <Text style={styles.summaryValue}>{formatPrice(fees.serviceFee)}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>
              {selectedPaymentMethod === 'card' ? 'Total à payer par carte' : 'Total'}
            </Text>
            <Text style={styles.summaryTotalValue}>
              {selectedPaymentMethod === 'card' && currency === 'EUR' && rates.EUR
                ? `~${(totalPrice / rates.EUR).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (${totalPrice.toLocaleString('fr-FR')} FCFA)`
                : formatPrice(totalPrice)}
            </Text>
          </View>
          {securityDeposit > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Caution</Text>
              <Text style={styles.summaryValue}>{formatPrice(securityDeposit)}</Text>
            </View>
          ) : null}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bouton de réservation */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || loading || openingStripe || !!pendingStripeBookingId || !!pendingStripeCheckoutToken || checkingStripeStatus) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || loading || openingStripe || !!pendingStripeBookingId || !!pendingStripeCheckoutToken || checkingStripeStatus || !!availabilityError}
        >
          {isSubmitting || loading || openingStripe || checkingStripeStatus ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>
                {openingStripe
                  ? 'Ouverture de Stripe...'
                  : (pendingStripeBookingId || pendingStripeCheckoutToken)
                    ? (vehicle?.auto_booking ? 'Paiement en attente...' : 'En attente d\'acceptation...')
                  : selectedPaymentMethod === 'card'
                  ? (vehicle?.auto_booking ? 'Payer et réserver' : 'Payer et envoyer la demande')
                  : (vehicle?.auto_booking ? 'Réserver maintenant' : 'Envoyer la demande')}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal pour sélectionner le nombre d'années de permis */}
      <Modal
        visible={showLicenseYearsPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLicenseYearsPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Nombre d'années de permis</Text>
              <TouchableOpacity
                onPress={() => setShowLicenseYearsPicker(false)}
                style={styles.pickerModalClose}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[
                { value: '1', label: 'Moins d\'1 an' },
                { value: '2', label: '1-2 ans' },
                { value: '3', label: '2-3 ans' },
                { value: '5', label: '3-5 ans' },
                { value: '10', label: 'Plus de 5 ans' },
              ]}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    licenseYears === item.value && styles.pickerOptionSelected
                  ]}
                  onPress={() => {
                    setLicenseYears(item.value);
                    setShowLicenseYearsPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    licenseYears === item.value && styles.pickerOptionTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {licenseYears === item.value ? (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Modal de sélection dates/heures */}
      <VehicleDateTimePickerModal
        visible={showDateTimePicker}
        startDateTime={startDateTime}
        endDateTime={endDateTime}
        onClose={() => setShowDateTimePicker(false)}
        onConfirm={(start, end) => {
          handleDateTimeChange(start, end);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  imageScrollView: {
    width: 100,
    height: 100,
  },
  vehicleImage: {
    width: 100,
    height: 100,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  activeIndicator: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vehicleImagePlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  vehicleTitleLink: {
    textDecorationLine: 'underline',
    color: TRAVELER_COLORS.primary,
  },
  vehiclePrice: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  vehiclePriceAlt: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  paymentMethodsContainer: {
    gap: 12,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 12,
  },
  paymentMethodOptionSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#e8f5e9',
  },
  paymentMethodOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  paymentMethodOptionTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  paymentInfoContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  paymentForm: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  inputGroup: {
    flex: 1,
    minWidth: 120,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    gap: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
  },
  cashInfo: {
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  cashText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dateButtonContent: {
    marginLeft: 12,
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rentalDaysText: {
    marginTop: 12,
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  availabilityErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    gap: 8,
  },
  availabilityErrorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500',
  },
  driverOptions: {
    gap: 12,
  },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  driverOptionActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2E7D32',
  },
  driverOptionText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  requiredLabel: {
    color: '#ef4444',
    fontWeight: '600',
  },
  requiredNote: {
    fontSize: 14,
    color: '#ef4444',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  uploadSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E7D32',
    borderStyle: 'dashed',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  uploadedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    gap: 8,
  },
  uploadedFileText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  removeFileButton: {
    padding: 4,
  },
  uploadHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#333',
  },
  selectButtonPlaceholder: {
    color: '#999',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  pickerModalClose: {
    padding: 4,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerOptionSelected: {
    backgroundColor: '#e8f5e9',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  textArea: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  summarySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryTotalValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    gap: 12,
  },
  dateTimeButtonContent: {
    flex: 1,
  },
  dateTimeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  dateTimeButtonPlaceholder: {
    fontSize: 15,
    color: '#999',
  },
  stripePendingBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  stripePendingText: {
    color: '#1e3a8a',
    fontSize: 14,
    lineHeight: 20,
  },
  stripeStatusText: {
    color: '#1e40af',
    fontSize: 13,
    marginTop: 4,
  },
  stripePendingCountdown: {
    color: '#1e40af',
    fontSize: 13,
    fontWeight: '600',
  },
  stripePendingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  stripeActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeActionPrimary: {
    backgroundColor: '#2563eb',
  },
  stripeActionPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  stripeActionDanger: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  stripeActionDangerText: {
    color: '#b91c1c',
    fontWeight: '600',
    fontSize: 13,
  },
});

export default VehicleBookingScreen;

