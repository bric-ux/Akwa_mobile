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
import { formatPrice } from '../utils/priceCalculator';
import DateGuestsSelector from '../components/DateGuestsSelector';
import { useSearchDatesContext } from '../contexts/SearchDatesContext';
import { calculateTotalPrice, calculateFees, DiscountConfig } from '../hooks/usePricing';
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
  const { hasUploadedIdentity, isVerified, loading: identityLoading } = useIdentityVerification();
  const { dates: searchDates, setDates: saveSearchDates } = useSearchDatesContext();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [startDate, setStartDate] = useState<string>(searchDates.checkIn || '');
  const [endDate, setEndDate] = useState<string>(searchDates.checkOut || '');
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

  const requiresLicense = vehicle?.requires_license !== false;
  const minLicenseYears = vehicle?.min_license_years || 0;
  const withDriver = vehicle?.with_driver || false;
  // Le permis est TOUJOURS requis si le locataire ne prend pas de chauffeur (impératif)
  // Sinon, il est requis si le véhicule le nécessite et qu'il n'y a pas de chauffeur
  const isLicenseRequired = (withDriver && useDriver === false) || (!withDriver && requiresLicense);

  const calculateRentalDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
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
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      adults: guests.adults,
      children: guests.children,
      babies: guests.babies,
    });
  };

  // Fonction pour uploader le document du permis
  const uploadLicenseDocument = async (uri: string, fileName: string, mimeType: string): Promise<string> => {
    setUploadingLicense(true);
    try {
      // Lire le fichier
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Générer un nom de fichier unique
      const fileExt = fileName.split('.').pop() || 'jpg';
      const uniqueFileName = `${user?.id}/${Date.now()}.${fileExt}`;

      // Upload vers Supabase Storage dans le bucket license-documents
      const { data, error } = await supabase.storage
        .from('license-documents')
        .upload(uniqueFileName, blob, {
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
  
  const pricing = calculateTotalPrice(basePricePerDay, rentalDays, discountConfig, longStayDiscountConfig);
  const basePrice = pricing.totalPrice; // Prix après réduction
  
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

    if (!isVerified) {
      Alert.alert(
        'Identité en cours de vérification',
        'Votre pièce d\'identité est en cours de vérification. Vous pourrez réserver une fois qu\'elle sera validée par notre équipe.'
      );
      return;
    }

    if (!startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates de début et de fin');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début');
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
        messageToOwner: message.trim() || undefined,
        licenseDocumentUrl: licenseDocumentUrl || undefined,
      });

      if (result.success) {
        Alert.alert(
          'Demande envoyée !',
          'Votre demande de réservation a été envoyée au propriétaire. Vous recevrez une réponse sous peu.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('MyVehicleBookings' as never);
              },
            },
          ]
        );
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
              {hasMultipleImages && (
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
              )}
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
            {vehicle.price_per_week && vehicle.price_per_week > 0 && (
              <Text style={styles.vehiclePriceAlt}>
                {formatPrice(vehicle.price_per_week)} / semaine
              </Text>
            )}
            {vehicle.price_per_month && vehicle.price_per_month > 0 && (
              <Text style={styles.vehiclePriceAlt}>
                {formatPrice(vehicle.price_per_month)} / mois
              </Text>
            )}
          </View>
        </View>

        {/* Dates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates de location</Text>
          <DateGuestsSelector
            checkIn={startDate}
            checkOut={endDate}
            adults={1}
            children={0}
            babies={0}
            onDateGuestsChange={handleDateGuestsChange}
          />
          {rentalDays > 0 && (
            <Text style={styles.rentalDaysText}>
              {rentalDays} jour{rentalDays > 1 ? 's' : ''} de location
            </Text>
          )}
        </View>

        {/* Choix du chauffeur */}
        {withDriver && (
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
        )}

        {/* Permis de conduire */}
        {isLicenseRequired && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Permis de conduire {(withDriver && useDriver === false) ? '(Obligatoire)' : ''}
            </Text>
            {(withDriver && useDriver === false) && (
              <Text style={styles.requiredNote}>
                Le permis de conduire est obligatoire lorsque vous conduisez vous-même.
              </Text>
            )}
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
            {hasLicense && (
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
            )}
          </View>
        )}

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
            <Text style={styles.summaryLabel}>Nombre de jours</Text>
            <Text style={styles.summaryValue}>{rentalDays}</Text>
          </View>
          {basePricePerDay !== vehicle.price_per_day && (
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
          )}
          {pricing.discountApplied && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Réduction {pricing.discountType === 'long_stay' ? 'séjour long' : ''} ({pricing.discountType === 'long_stay' 
                  ? longStayDiscountConfig?.percentage 
                  : discountConfig.percentage}%)
              </Text>
              <Text style={[styles.summaryValue, { color: '#2E7D32' }]}>
                -{formatPrice(pricing.discountAmount)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>
              {pricing.discountApplied && (
                <Text style={{ textDecorationLine: 'line-through', color: '#999', fontSize: 14 }}>
                  {formatPrice(pricing.originalTotal)}{' '}
                </Text>
              )}
              {formatPrice(basePrice)}
            </Text>
          </View>
          {fees.serviceFee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Frais de service</Text>
              <Text style={styles.summaryValue}>{formatPrice(fees.serviceFee)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{formatPrice(totalPrice)}</Text>
          </View>
          {securityDeposit > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Caution</Text>
              <Text style={styles.summaryValue}>{formatPrice(securityDeposit)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bouton de réservation */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting || loading}
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
                  {licenseYears === item.value && (
                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                  )}
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

