import React, { useState, useEffect, useRef } from 'react';
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
import { formatPrice } from '../utils/priceCalculator';
import { VehicleDateTimeSelector } from '../components/VehicleDateTimeSelector';
import { useSearchDatesContext } from '../contexts/SearchDatesContext';
import { calculateTotalPrice, calculateFees, calculateVehiclePriceWithHours, DiscountConfig } from '../hooks/usePricing';
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
  const { getVehicleById } = useVehicles();
  const { createBooking, loading } = useVehicleBookings();
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } = useIdentityVerification();
  const { dates: searchDates, setDates: saveSearchDates } = useSearchDatesContext();
  const { isDateUnavailable, isDateRangeUnavailable } = useVehicleAvailabilityCalendar(vehicleId);

  const [vehicle, setVehicle] = useState<any>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [startDate, setStartDate] = useState<string>(searchDates.checkIn || '');
  const [endDate, setEndDate] = useState<string>(searchDates.checkOut || '');
  const [startDateTime, setStartDateTime] = useState<string | undefined>(undefined);
  const [endDateTime, setEndDateTime] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [hasLicense, setHasLicense] = useState(false);
  const [licenseYears, setLicenseYears] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseDocumentUrl, setLicenseDocumentUrl] = useState<string | null>(null);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [showLicenseYearsPicker, setShowLicenseYearsPicker] = useState(false);
  const [useDriver, setUseDriver] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

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
    if (searchDates.checkIn) {
      setStartDate(searchDates.checkIn);
    }
    if (searchDates.checkOut) {
      setEndDate(searchDates.checkOut);
    }
  }, [searchDates.checkIn, searchDates.checkOut]);

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
    if (!startDate || !endDate) return 0;
    
    // Normaliser les dates pour éviter les problèmes de fuseau horaire
    // Les dates sont au format "YYYY-MM-DD", on peut les comparer directement
    if (startDate === endDate) {
      // Si les dates sont identiques, c'est 1 jour de location
      return 1;
    }
    
    // Si les dates sont différentes, calculer la différence
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Ajouter 1 pour inclure le jour de départ
    // Ex: du 1er au 2 janvier = 1 jour de différence + 1 = 2 jours
    return diffDays + 1;
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

  const handleDateTimeChange = (start: string | undefined, end: string | undefined) => {
    if (start) {
      const startDateObj = new Date(start);
      setStartDate(startDateObj.toISOString().split('T')[0]);
      setStartDateTime(start);
    }
    if (end) {
      const endDateObj = new Date(end);
      setEndDate(endDateObj.toISOString().split('T')[0]);
      setEndDateTime(end);
    }
    // Sauvegarder les dates dans le contexte
    if (start && end) {
      const startDateObj = new Date(start);
      const endDateObj = new Date(end);
      saveSearchDates({
        checkIn: startDateObj.toISOString().split('T')[0],
        checkOut: endDateObj.toISOString().split('T')[0],
        adults: 1,
        children: 0,
        babies: 0,
      });
    }
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
    console.log(`🔍 [VehicleBookingScreen] calculateRemainingHours - startDateTime: ${startDateTime}, endDateTime: ${endDateTime}`);
    console.log(`🔍 [VehicleBookingScreen] calculateRemainingHours - vehicle:`, {
      hourly_rental_enabled: vehicle?.hourly_rental_enabled,
      price_per_hour: vehicle?.price_per_hour,
      rentalDays
    });
    
    if (!startDateTime || !endDateTime) {
      console.log(`⚠️ [VehicleBookingScreen] Pas de startDateTime ou endDateTime`);
      return 0;
    }
    
    if (!vehicle?.hourly_rental_enabled || !vehicle?.price_per_hour) {
      console.log(`⚠️ [VehicleBookingScreen] Véhicule ne supporte pas la location par heure`);
      return 0;
    }
    
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.log(`⚠️ [VehicleBookingScreen] Dates invalides`);
      return 0;
    }
    
    const diffTime = end.getTime() - start.getTime();
    const totalHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    // Calculer les jours complets directement à partir des heures totales
    // Exemple: 260 heures = 10 jours complets (10 × 24 = 240h) + 20 heures restantes
    // Ne pas utiliser rentalDays car il inclut un +1 et est calculé à partir des dates sans heures
    const fullDaysFromHours = Math.floor(totalHours / 24);
    const hoursInFullDays = fullDaysFromHours * 24;
    const remainingHours = totalHours - hoursInFullDays;
    
    console.log(`🔍 [VehicleBookingScreen] Calcul heures: totalHours=${totalHours}, fullDaysFromHours=${fullDaysFromHours}, hoursInFullDays=${hoursInFullDays}, remainingHours=${remainingHours}`);
    
    return remainingHours > 0 ? remainingHours : 0;
  };
  
  const remainingHours = calculateRemainingHours();
  
  // Log pour déboguer
  console.log(`🔍 [VehicleBookingScreen] Résumé - rentalDays: ${rentalDays}, remainingHours: ${remainingHours}, startDateTime: ${startDateTime}, endDateTime: ${endDateTime}`);
  
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
    console.log(`💰 [VehicleBookingScreen] Calcul prix heures: ${remainingHours}h × ${hourlyRateValue} = ${hoursPrice}`);
  } else {
    console.log(`⚠️ [VehicleBookingScreen] Pas de calcul heures: remainingHours=${remainingHours}, hourly_rental_enabled=${vehicle?.hourly_rental_enabled}, price_per_hour=${vehicle?.price_per_hour}`);
  }
  
  // Calculer les frais de service (10% du prix après réduction pour les véhicules)
  const fees = calculateFees(basePrice, rentalDays, 'vehicle');
  const totalPrice = basePrice + fees.serviceFee;
  
  const securityDeposit = vehicle?.security_deposit || 0;

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
    // Permettre l'égalité pour les locations d'un jour (ex: du 1er au 1er janvier)
    if (endDate < startDate) {
      Alert.alert('Erreur', 'La date de fin ne peut pas être avant la date de début');
      return;
    }

    if (withDriver && useDriver === null) {
      Alert.alert('Choix requis', 'Veuillez indiquer si vous souhaitez utiliser le service de chauffeur ou conduire vous-même.');
      return;
    }

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

    setIsSubmitting(true);
    try {
      const startDateStr = startDate;
      const endDateStr = endDate;

      const result = await createBooking({
        vehicleId: vehicle.id,
        startDate: startDateStr,
        endDate: endDateStr,
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        messageToOwner: message.trim() || undefined,
        licenseDocumentUrl: licenseDocumentUrl || undefined,
        hasLicense: isLicenseRequired ? hasLicense : undefined,
        licenseYears: isLicenseRequired && hasLicense ? licenseYears : undefined,
        licenseNumber: isLicenseRequired && hasLicense ? licenseNumber : undefined,
      });

      if (result.success) {
        const isConfirmed = result.status === 'confirmed';
        // Réinitialiser le formulaire
        setStartDate('');
        setEndDate('');
        setStartDateTime(undefined);
        setEndDateTime(undefined);
        setMessage('');
        setHasLicense(false);
        setLicenseYears('');
        setLicenseNumber('');
        setLicenseDocumentUrl(null);
        
        // Fermer automatiquement l'écran et naviguer vers la page du véhicule
        navigation.goBack(); // Retour à la page précédente (page du véhicule)
        
        // Afficher l'alerte de confirmation (non bloquante)
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
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Réservation</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Véhicule */}
        <View style={styles.vehicleCard}>
          {vehicleImages.length > 0 ? (
            <View style={styles.imageContainer}>
              <ScrollView
                ref={scrollViewRef}
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
            <Text style={styles.vehicleTitle}>
              {vehicle.title || `${vehicle.brand || ''} ${vehicle.model || ''}`.trim()}
            </Text>
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
          <VehicleDateTimeSelector
            startDateTime={startDateTime}
            endDateTime={endDateTime}
            onDateTimeChange={handleDateTimeChange}
          />
          {rentalDays > 0 ? (
            <Text style={styles.rentalDaysText}>
              {rentalDays} jour{rentalDays > 1 ? 's' : ''}
              {remainingHours > 0 && ` et ${remainingHours} heure${remainingHours > 1 ? 's' : ''}`} de location
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
                onPress={() => setUseDriver(true)}
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
                onPress={() => setUseDriver(false)}
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
              {rentalDays} jour{rentalDays > 1 ? 's' : ''}
              {remainingHours > 0 && ` et ${remainingHours} heure${remainingHours > 1 ? 's' : ''}`}
            </Text>
          </View>
          {/* Détail du calcul : jours */}
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
          {/* Détail du calcul : heures */}
          {(() => {
            const shouldShowHours = remainingHours > 0 && vehicle?.price_per_hour && hoursPrice > 0;
            console.log(`🔍 [VehicleBookingScreen] Affichage heures - shouldShowHours: ${shouldShowHours}, remainingHours: ${remainingHours}, price_per_hour: ${vehicle?.price_per_hour}, hoursPrice: ${hoursPrice}`);
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
          {fees.serviceFee > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Frais de service</Text>
              <Text style={styles.summaryValue}>{formatPrice(fees.serviceFee)}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{formatPrice(totalPrice)}</Text>
          </View>
          {securityDeposit > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Caution</Text>
              <Text style={styles.summaryValue}>{formatPrice(securityDeposit)}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bouton de réservation */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || loading || !!availabilityError}
        >
          {isSubmitting || loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Envoyer la demande</Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  vehiclePrice: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '600',
  },
  vehiclePriceAlt: {
    fontSize: 14,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
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
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryTotalValue: {
    fontSize: 18,
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
});

export default VehicleBookingScreen;

