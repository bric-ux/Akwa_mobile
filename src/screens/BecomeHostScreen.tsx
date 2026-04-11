import React, { useState, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from 'react-native';
import MediaThumb from '../components/MediaThumb';
import { uploadPropertyMediaToStorage } from '../lib/uploadPropertyMedia';
import { isMediaRowVideo, normalizeHostMediaRows } from '../utils/media';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../services/AuthContext';
import { useHostApplications } from '../hooks/useHostApplications';
import { useEmailService } from '../hooks/useEmailService';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import { useHostPaymentInfo } from '../hooks/useHostPaymentInfo';
import { useReferrals } from '../hooks/useReferrals';
import { useLanguage } from '../contexts/LanguageContext';
import CitySearchInputModal from '../components/CitySearchInputModal';
import IdentityVerificationAlert from '../components/IdentityVerificationAlert';
import { supabase } from '../services/supabase';
import { Amenity } from '../types';
import { FEATURE_MONTHLY_RENTAL } from '../constants/features';

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
  { value: 'guesthouse', label: 'Maison d\'hôtes' },
  { value: 'eco_lodge', label: 'Éco-lodge' },
];

const CANCELLATION_POLICIES = [
  { 
    value: 'flexible', 
    label: 'Flexible', 
    description: 'Remboursement intégral jusqu\'à 24h avant l\'arrivée',
    details: 'Annulation gratuite jusqu\'à 24h avant'
  },
  { 
    value: 'moderate', 
    label: 'Modérée', 
    description: 'Remboursement intégral jusqu\'à 5 jours avant l\'arrivée',
    details: 'Annulation gratuite jusqu\'à 5 jours avant'
  },
  { 
    value: 'strict', 
    label: 'Stricte', 
    description: 'Remboursement de 50% jusqu\'à 7 jours avant l\'arrivée',
    details: 'Remboursement partiel jusqu\'à 7 jours avant'
  },
  { 
    value: 'non_refundable', 
    label: 'Non remboursable', 
    description: 'Aucun remboursement possible',
    details: 'Aucun remboursement en cas d\'annulation'
  },
];

const PHOTO_CATEGORIES = [
  { value: 'exterieur', label: 'Extérieur', icon: '🏠', priority: 1 },
  { value: 'salon', label: 'Salon', icon: '🛋️', priority: 2 },
  { value: 'chambre', label: 'Chambre', icon: '🛏️', priority: 3 },
  { value: 'salle_de_bain', label: 'Salle de bain', icon: '🚿', priority: 4 },
  { value: 'cuisine', label: 'Cuisine', icon: '🍳', priority: 5 },
  { value: 'jardin', label: 'Jardin', icon: '🌳', priority: 6 },
  { value: 'terrasse', label: 'Terrasse', icon: '☀️', priority: 7 },
  { value: 'balcon', label: 'Balcon', icon: '🪴', priority: 8 },
  { value: 'salle_a_manger', label: 'Salle à manger', icon: '🍽️', priority: 9 },
  { value: 'cave', label: 'Cave', icon: '🍷', priority: 10 },
  { value: 'toilette', label: 'Toilette', icon: '🚽', priority: 11 },
  { value: 'buanderie', label: 'Buanderie', icon: '🧺', priority: 12 },
  { value: 'wc', label: 'WC', icon: '🚾', priority: 13 },
  { value: 'piscine', label: 'Piscine', icon: '🏊', priority: 14 },
  { value: 'autre', label: 'Autres', icon: '📸', priority: 15 },
];

const MAX_PROPERTY_VIDEOS = 5;

const BecomeHostScreen: React.FC = ({ route }: any) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { t } = useLanguage();
  
  useEffect(() => {
    console.log('🟢 [BecomeHostScreen] Écran BecomeHost monté');
    return () => {
      console.log('🔴 [BecomeHostScreen] Écran BecomeHost démonté');
    };
  }, []);
  const navigateToProfileIdentity = () => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Home',
        params: { screen: 'ProfileTab' },
      })
    );
  };

  const { submitApplication, getAmenities, getApplicationById, updateApplication, loading } = useHostApplications();
  const { sendHostApplicationSubmitted, sendHostApplicationReceived } = useEmailService();
  const { hasUploadedIdentity, verificationStatus, checkIdentityStatus } = useIdentityVerification();
  const { hasPaymentInfo, isPaymentInfoComplete, paymentInfo, fetchPaymentInfo } = useHostPaymentInfo();
  const { verifyReferralCode } = useReferrals();
  
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [fieldsToRevise, setFieldsToRevise] = useState<Record<string, boolean>>({});
  const [enteredReferralCode, setEnteredReferralCode] = useState<string>('');
  const [referralCodeError, setReferralCodeError] = useState<string>('');
  const [referrerName, setReferrerName] = useState<string>('');
  const [isReferred, setIsReferred] = useState(false);
  const [isAlreadyHost, setIsAlreadyHost] = useState(false);
  /** Type d'annonce : pour l’instant seule la résidence meublée (court séjour) — pas d’écran de choix */
  const [listingType, setListingType] = useState<'short_term' | 'monthly' | null>('short_term');
  const [listingTypeConfirmed, setListingTypeConfirmed] = useState(true);
  /** Empêche les doubles envois (loading du hook ne couvre pas fetchPaymentInfo + validations avant insert). */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  const [formData, setFormData] = useState({
    // Informations sur le logement
    propertyType: '',
    location: '',
    guests: '',
    bedrooms: '',
    bathrooms: '',
    title: '',
    description: '',
    price: '',
    addressDetails: '',
    hostGuide: '', // Guide de l'hôte - manquant
    
    // Informations hôte
    hostFullName: '',
    hostEmail: '',
    hostPhone: '',
    
    // Frais et règles
    cleaningFee: '',
    taxes: '',
    freeCleaningMinDays: '',
    houseRules: '',
    minimumNights: '1',
    autoBooking: 'request',
    cancellationPolicy: 'flexible',
    
    // Horaires et règles intérieures
    checkInTime: '14:00',
    checkOutTime: '11:00',
    allowPets: false,
    allowSmoking: false,
    allowEvents: false,
    otherRules: '',
    
    // Réductions
    discountEnabled: false,
    discountMinNights: '',
    discountPercentage: '',
    longStayDiscountEnabled: false,
    longStayDiscountMinNights: '',
    longStayDiscountPercentage: '',
    
    // Conditions
    agreeTerms: false,
    // Location mensuelle (longue durée)
    monthlyRentPrice: '',
    securityDeposit: '',
    minimumDurationMonths: '',
    chargesIncluded: false,
    surfaceM2: '',           // Surface habitable (m²)
    numberOfRooms: '',       // Nombre de pièces (total)
    isFurnished: false,      // Bien meublé ou non
  });
  
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [availableAmenities, setAvailableAmenities] = useState<Amenity[]>([]);
  const [customAmenities, setCustomAmenities] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(1);
  const [showPropertyTypeModal, setShowPropertyTypeModal] = useState(false);
  const [identityUploadedInSession, setIdentityUploadedInSession] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedImages, setSelectedImages] = useState<
    Array<{ uri: string; category: string; displayOrder: number; isMain?: boolean; isVideo?: boolean }>
  >([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedImageForCategory, setSelectedImageForCategory] = useState<number | null>(null);

  // Références pour la navigation entre champs
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});

  useEffect(() => {
    loadAmenities();
    loadUserProfile();
    
    // Vérifier si on est en mode édition
    const editId = route?.params?.editApplicationId;
    if (editId) {
      setEditingApplicationId(editId);
      setIsEditMode(true);
      loadApplicationData(editId);
    }
  }, [route?.params]);

  // Recharger les informations de paiement quand l'écran devient actif
  // (utile quand l'utilisateur revient de l'écran de configuration du paiement)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('🔄 Rechargement des informations de paiement...');
        fetchPaymentInfo().then(() => {
          console.log('✅ Informations de paiement rechargées');
        }).catch((error) => {
          console.error('❌ Erreur lors du rechargement des informations de paiement:', error);
        });
      }
    }, [user])
  );
  
  // Fonction pour vérifier si un champ doit être affiché en mode révision
  const shouldShowField = (fieldName: string) => {
    // Si on n'est pas en mode édition ou s'il n'y a pas de champs de révision, afficher tous les champs
    if (!isEditMode || Object.keys(fieldsToRevise).length === 0) return true;
    // Sinon, n'afficher que les champs présents dans fields_to_revise
    return fieldsToRevise[fieldName] === true;
  };

  const loadApplicationData = async (applicationId: string) => {
    console.log('📋 Chargement de la candidature pour édition:', applicationId);
    
    const application = await getApplicationById(applicationId);
    if (application) {
      console.log('📋 Candidature chargée:', application);
      
      // Formater les horaires
      const formatTime = (time: string | null | undefined): string => {
        if (!time) return '14:00';
        // Si le format est HH:MM:SS, ne garder que HH:MM
        if (time.includes(':')) {
          const parts = time.split(':');
          return `${parts[0]}:${parts[1]}`;
        }
        return time;
      };
      
      // Parser les règles depuis house_rules
      const rules = application.house_rules || '';
      const allowPets = rules.includes('Animaux autorisés');
      const allowSmoking = rules.includes('Fumer autorisé');
      const allowEvents = rules.includes('Événements autorisés');
      const otherRules = rules.split('\n').filter((line: string) => 
        !line.includes('Animaux autorisés') && 
        !line.includes('Fumer autorisé') && 
        !line.includes('Événements autorisés') &&
        line.trim() !== ''
      ).join('\n');
      
      const locationStr = typeof application.location === 'string'
        ? application.location
        : (application.location && typeof application.location === 'object' && 'name' in application.location
          ? String((application.location as { name?: string }).name ?? '')
          : '');
      setFormData({
        propertyType: application.property_type || '',
        location: locationStr,
        guests: application.max_guests?.toString() || '',
        bedrooms: application.bedrooms?.toString() || '',
        bathrooms: application.bathrooms?.toString() || '',
        title: application.title || '',
        description: application.description || '',
        price: application.price_per_night?.toString() || '',
        addressDetails: '',
        hostGuide: application.host_guide || '',
        hostFullName: application.full_name || '',
        hostEmail: application.email || '',
        hostPhone: application.phone || '',
        cleaningFee: application.cleaning_fee?.toString() || '',
        taxes: application.taxes?.toString() || '',
        freeCleaningMinDays: application.free_cleaning_min_days?.toString() || '',
        houseRules: '',
        minimumNights: application.minimum_nights?.toString() || '1',
        autoBooking: application.auto_booking ? 'auto' : 'request',
        cancellationPolicy: application.cancellation_policy || 'flexible',
        checkInTime: formatTime(application.check_in_time),
        checkOutTime: formatTime(application.check_out_time),
        allowPets: allowPets,
        allowSmoking: allowSmoking,
        allowEvents: allowEvents,
        otherRules: otherRules,
        discountEnabled: application.discount_enabled || false,
        discountMinNights: application.discount_min_nights?.toString() || '',
        discountPercentage: application.discount_percentage?.toString() || '',
        longStayDiscountEnabled: application.long_stay_discount_enabled || false,
        longStayDiscountMinNights: application.long_stay_discount_min_nights?.toString() || '',
        longStayDiscountPercentage: application.long_stay_discount_percentage?.toString() || '',
        agreeTerms: false,
        monthlyRentPrice: (application as any).monthly_rent_price?.toString() || '',
        securityDeposit: (application as any).security_deposit?.toString() || '',
        minimumDurationMonths: (application as any).minimum_duration_months?.toString() || '',
        chargesIncluded: (application as any).charges_included || false,
        surfaceM2: (application as any).surface_m2?.toString() || '',
        numberOfRooms: (application as any).number_of_rooms?.toString() || '',
        isFurnished: (application as any).is_furnished || false,
      });
      setListingType((application as any).is_monthly_rental ? 'monthly' : 'short_term');
      setListingTypeConfirmed(true);
      
      // Charger les équipements
        setSelectedAmenities(application.amenities || []);
        
        // Charger les équipements personnalisés
        if (application.custom_amenities && Array.isArray(application.custom_amenities)) {
          setCustomAmenities(application.custom_amenities.join(', '));
        } else if (application.custom_amenities) {
          setCustomAmenities(application.custom_amenities);
        }
      
      // Charger les champs de révision
      if (application.fields_to_revise && application.status === 'reviewing') {
        setFieldsToRevise(application.fields_to_revise);
        console.log('🔍 Champs de révision:', application.fields_to_revise);
      } else {
        setFieldsToRevise({});
      }
      
      // Charger les photos
      console.log('📸 Données brutes categorized_photos:', JSON.stringify(application.categorized_photos, null, 2));
      console.log('📸 Type de categorized_photos:', typeof application.categorized_photos);
      console.log('📸 Est-ce un array?', Array.isArray(application.categorized_photos));
      
      if (application.categorized_photos) {
        try {
          let photos = [];
          
          // Parser les photos catégorisées
          if (typeof application.categorized_photos === 'string') {
            photos = JSON.parse(application.categorized_photos);
          } else if (Array.isArray(application.categorized_photos)) {
            photos = application.categorized_photos;
          }
          
          console.log('📸 Photos parsées brutes:', photos);
          
          if (Array.isArray(photos) && photos.length > 0) {
            // Convertir les photos au bon format attendu par le formulaire
            const formattedPhotos = photos.map((photo: any, index: number) => {
              console.log(`📸 Photo ${index} avant formatage:`, photo);
              
              // S'assurer qu'on extrait bien l'URI et la catégorie
              const photoUri = photo.url || photo.uri || '';
              const photoCategory = photo.category || 'autre';
              const photoDisplayOrder = photo.displayOrder ?? photo.display_order ?? index;
              
              console.log(`📸 Photo ${index} URI:`, photoUri, 'Category:', photoCategory);
              
              const formattedPhoto = {
                uri: photoUri,
                category: photoCategory,
                displayOrder: photoDisplayOrder,
                isMain: photo.isMain || photo.is_main || (index === 0 && !photos.some((p: any) => p.isMain || p.is_main)),
              };
              
              console.log(`📸 Photo ${index} formatée:`, formattedPhoto);
              return formattedPhoto;
            });
            
            console.log('📸 Final formatted photos:', formattedPhotos);
            console.log('📸 Catégories des photos:', formattedPhotos.map(p => p.category));
            setSelectedImages(normalizeHostMediaRows(formattedPhotos));
          }
        } catch (e) {
          console.error('❌ Error parsing categorized_photos:', e);
        }
      } else if (application.images && application.images.length > 0) {
        console.log('📸 Pas de categorized_photos, chargement depuis images');
        const photos = application.images.map((url: string, index: number) => ({
          uri: url,
          category: 'autre',
          displayOrder: index,
          isMain: index === 0,
        }));
        setSelectedImages(normalizeHostMediaRows(photos as any));
      }
      
      console.log('✅ Données chargées avec succès');
    }
  };

  const loadAmenities = async () => {
    const amenities = await getAmenities();
    setAvailableAmenities(amenities);
  };

  const loadUserProfile = async () => {
    if (user) {
      const metadata = user.user_metadata;
      setFormData(prev => ({
        ...prev,
        hostEmail: user.email || '',
        hostFullName: metadata?.first_name && metadata?.last_name 
          ? `${metadata.first_name} ${metadata.last_name}` 
          : '',
      }));

      // Vérifier si l'utilisateur est déjà hôte
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_host')
          .eq('user_id', user.id)
          .single();

        if (!error && profile) {
          setIsAlreadyHost(profile.is_host || false);
        }
      } catch (error) {
        console.error('Error checking host status:', error);
      }
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleAmenity = (amenityName: string) => {
    // Utiliser les noms des équipements au lieu des UUIDs (comme sur le site web)
    setSelectedAmenities(prev => 
      prev.includes(amenityName) 
        ? prev.filter(name => name !== amenityName)
        : [...prev, amenityName]
    );
  };

  // Fonctions pour gérer les images
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de l\'accès à vos photos pour ajouter des images à votre propriété.');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const remainingSlots = 30 - selectedImages.length;
    if (remainingSlots <= 0) {
      Alert.alert('Limite atteinte', 'Vous pouvez ajouter jusqu\'à 30 médias maximum (photos + vidéos).');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      Alert.alert('Upload en cours', `Upload de ${result.assets.length} photo(s)...`);
      
      const suggestedCategory = getSuggestedCategory();
      const newImages: Array<{
        uri: string;
        category: string;
        displayOrder: number;
        isMain?: boolean;
        isVideo?: boolean;
      }> = [];
      const indexBeforeAdd = selectedImages.length;
      
      try {
        for (let i = 0; i < result.assets.length; i++) {
          const asset = result.assets[i];
          console.log(`📤 Upload de l'image ${i + 1}/${result.assets.length}...`);
          
          try {
            const publicUrl = await uploadPropertyMediaToStorage(asset.uri);
            console.log(`✅ Image ${i + 1} uploadée:`, publicUrl);
            
            newImages.push({
              uri: publicUrl,
              category: suggestedCategory,
              displayOrder: indexBeforeAdd + i + 1,
              isMain: indexBeforeAdd === 0 && i === 0,
              isVideo: false,
            });
          } catch (error) {
            console.error(`❌ Erreur upload image ${i + 1}:`, error);
            Alert.alert(
              'Erreur d\'upload',
              `Impossible d'uploader l'image ${i + 1}. Veuillez réessayer.`
            );
          }
        }
        
        if (newImages.length > 0) {
          setSelectedImages(prev => normalizeHostMediaRows([...prev, ...newImages]));
          
          if (newImages.length === 1) {
            setTimeout(() => {
              openCategoryModal(indexBeforeAdd);
            }, 500);
          } else {
            Alert.alert(
              `${newImages.length} photos ajoutées`,
              'Vous pouvez maintenant catégoriser vos photos et définir la photo principale en appuyant sur chaque photo.',
              [{ text: 'OK' }]
            );
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload des images:', error);
        Alert.alert(
          'Erreur',
          'Une erreur est survenue lors de l\'upload des images. Veuillez réessayer.'
        );
      }
    }
  };

  const pickVideo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const videoCount = selectedImages.filter((i) => isMediaRowVideo(i)).length;
    if (videoCount >= MAX_PROPERTY_VIDEOS) {
      Alert.alert('Limite vidéos', `Vous pouvez ajouter au maximum ${MAX_PROPERTY_VIDEOS} vidéos.`);
      return;
    }

    const remainingSlots = 30 - selectedImages.length;
    if (remainingSlots <= 0) {
      Alert.alert('Limite atteinte', 'Vous pouvez ajouter jusqu\'à 30 médias maximum (photos + vidéos).');
      return;
    }

    const maxPick = Math.min(remainingSlots, MAX_PROPERTY_VIDEOS - videoCount);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: true,
      selectionLimit: maxPick,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length) {
      Alert.alert('Upload en cours', `Upload de ${result.assets.length} vidéo(s)...`);
      const additions: Array<{
        uri: string;
        category: string;
        displayOrder: number;
        isMain?: boolean;
        isVideo?: boolean;
      }> = [];
      const start = selectedImages.length;

      for (let i = 0; i < result.assets.length; i++) {
        const asset = result.assets[i];
        try {
          const publicUrl = await uploadPropertyMediaToStorage(asset.uri);
          additions.push({
            uri: publicUrl,
            category: 'autre',
            displayOrder: start + i + 1,
            isMain: false,
            isVideo: true,
          });
        } catch (error) {
          console.error(`Erreur upload vidéo ${i + 1}:`, error);
          Alert.alert('Erreur d\'upload', `Impossible d'uploader la vidéo ${i + 1}.`);
        }
      }

      if (additions.length > 0) {
        setSelectedImages(prev => normalizeHostMediaRows([...prev, ...additions]));
        Alert.alert(
          `${additions.length} vidéo(s) ajoutée(s)`,
          'Les vidéos sont affichées avec vos photos ; la photo principale doit rester une image.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const removed = prev[index];
      const updated = prev.filter((_, i) => i !== index);
      
      if (removed?.isMain && updated.length > 0) {
        updated[0].isMain = true;
      }
      
      const reordered = updated.map((img, i) => ({
        ...img,
        displayOrder: i + 1,
      }));
      return normalizeHostMediaRows(reordered);
    });
  };

  const setMainImage = (index: number) => {
    const row = selectedImages[index];
    if (!row || isMediaRowVideo(row)) {
      Alert.alert(
        'Photo principale',
        'La vignette d’annonce doit être une image. Choisissez une photo, pas une vidéo.'
      );
      return;
    }
    setSelectedImages(prev =>
      normalizeHostMediaRows(prev.map((img, i) => ({ ...img, isMain: i === index })))
    );
  };

  const openCategoryModal = (index: number) => {
    setSelectedImageForCategory(index);
    setShowCategoryModal(true);
  };

  const setImageCategory = (category: string) => {
    if (selectedImageForCategory !== null) {
      setSelectedImages(prev => prev.map((img, index) => 
        index === selectedImageForCategory 
          ? { ...img, category }
          : img
      ));
    }
    setShowCategoryModal(false);
    setSelectedImageForCategory(null);
    
    // Si c'était une nouvelle photo, suggérer d'ajouter une autre photo
    if (selectedImageForCategory !== null && selectedImages[selectedImageForCategory]?.category === 'autre') {
      setTimeout(() => {
        Alert.alert(
          'Photo ajoutée',
          'Souhaitez-vous ajouter une autre photo?',
          [
            { text: 'Non merci', style: 'cancel' },
            { text: 'Ajouter', onPress: pickImage }
          ]
        );
      }, 1000);
    }
    
    // Si c'était une nouvelle photo, suggérer d'ajouter une autre photo
    if (selectedImageForCategory !== null && selectedImages[selectedImageForCategory]?.category === 'other') {
      setTimeout(() => {
        Alert.alert(
          "Photo ajoutée !",
          "Voulez-vous ajouter une autre photo ?",
          [
            { text: "Non", style: "cancel" },
            { text: "Oui", onPress: pickImage }
          ]
        );
      }, 1000);
    }
  };

  const getCategoryIcon = (category: string) => {
    return PHOTO_CATEGORIES.find(cat => cat.value === category)?.icon || '📸';
  };

  const getCategoryLabel = (category: string) => {
    return PHOTO_CATEGORIES.find(cat => cat.value === category)?.label || 'Autres';
  };

  // Suggérer la prochaine catégorie à utiliser
  const getSuggestedCategory = () => {
    const usedCategories = selectedImages.map(img => img.category);
    const unusedCategories = PHOTO_CATEGORIES.filter(cat => !usedCategories.includes(cat.value));
    
    if (unusedCategories.length > 0) {
      return unusedCategories[0].value;
    }
    return 'other';
  };

  // Navigation automatique entre les champs
  const handleInputSubmit = (fieldName: string) => {
    const nextField = getNextField(fieldName);
    if (nextField && inputRefs.current[nextField]) {
      inputRefs.current[nextField]?.focus();
    } else if (fieldName === 'bathrooms') {
      // Après avoir rempli les salles de bain, passer au titre
      setTimeout(() => {
        if (inputRefs.current['title']) {
          inputRefs.current['title']?.focus();
        }
      }, 100);
    }
  };

  // Navigation intelligente après sélection de type de propriété
  const handlePropertyTypeSelect = (propertyType: string) => {
    handleInputChange('propertyType', propertyType);
    setShowPropertyTypeModal(false);
    
    // Passer automatiquement au champ suivant (localisation)
    setTimeout(() => {
      if (inputRefs.current['location']) {
        inputRefs.current['location']?.focus();
      }
    }, 300);
  };

  // Navigation intelligente après sélection de localisation
  const handleLocationSelect = (result: any) => {
    console.log('📍 Sélection de localisation reçue:', result);
    setSelectedLocation(result);
    if (result) {
      console.log('📍 Nom de la localisation:', result.name);
      handleInputChange('location', result.name);
      
      // Passer au champ suivant (invités en court séjour, surface en location mensuelle)
      setTimeout(() => {
        const nextRef = listingType === 'monthly' ? inputRefs.current['surfaceM2'] : inputRefs.current['guests'];
        nextRef?.focus();
      }, 300);
    } else {
      console.log('📍 Localisation effacée');
      handleInputChange('location', '');
    }
  };

  const getNextField = (currentField: string): string | undefined => {
    const shortTermOrder = [
      'propertyType', 'location', 'guests', 'bedrooms', 'bathrooms',
      'title', 'description', 'price', 'addressDetails',
      'hostFullName', 'hostEmail', 'hostPhone', 'hostGuide',
      'cleaningFee', 'freeCleaningMinDays', 'checkInTime', 'checkOutTime', 'minimumNights', 'discountMinNights', 'discountPercentage', 'longStayDiscountMinNights', 'longStayDiscountPercentage',
      'autoBooking', 'cancellationPolicy'
    ];
    const monthlyOrder = [
      'propertyType', 'location', 'surfaceM2', 'numberOfRooms', 'bedrooms', 'bathrooms',
      'title', 'description', 'monthlyRentPrice', 'securityDeposit', 'minimumDurationMonths', 'addressDetails',
      'hostFullName', 'hostEmail', 'hostPhone', 'hostGuide',
      'cleaningFee', 'freeCleaningMinDays', 'checkInTime', 'checkOutTime', 'minimumNights', 'discountMinNights', 'discountPercentage', 'longStayDiscountMinNights', 'longStayDiscountPercentage',
      'autoBooking', 'cancellationPolicy'
    ];
    const fieldOrder = listingType === 'monthly' ? monthlyOrder : shortTermOrder;
    const currentIndex = fieldOrder.indexOf(currentField);
    return currentIndex < fieldOrder.length - 1 ? fieldOrder[currentIndex + 1] : undefined;
  };

  const getInputStyle = (fieldName: string) => {
    return styles.input;
  };

  const getFieldDisplayName = (fieldName: string): string => {
    const fieldNames: { [key: string]: string } = {
      propertyType: 'Type de propriété',
      location: 'Localisation',
      guests: 'Nombre d\'invités',
      bedrooms: 'Chambres',
      bathrooms: 'Salles de bain',
      title: 'Titre',
      description: 'Description',
      price: 'Prix par nuit',
      monthlyRentPrice: 'Loyer mensuel',
      surfaceM2: 'Surface habitable',
      numberOfRooms: 'Nombre de pièces',
      hostFullName: 'Nom complet',
      hostEmail: 'Email',
      hostPhone: 'Téléphone',
    };
    return fieldNames[fieldName] || fieldName;
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1: {
        // Étape 1: Informations sur le logement
        const isShortTerm = listingType === 'short_term';
        const step1Base = isShortTerm
          ? ['propertyType', 'location', 'guests', 'bedrooms', 'bathrooms', 'title', 'description']
          : ['propertyType', 'location', 'surfaceM2', 'numberOfRooms', 'bedrooms', 'bathrooms', 'title', 'description'];
        const step1Fields = isShortTerm
          ? [...step1Base, 'price']
          : [...step1Base, 'monthlyRentPrice'];
        const missingStep1 = step1Fields.filter(field => {
          const v = formData[field as keyof typeof formData];
          return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
        });

        if (missingStep1.length > 0) {
          const missingFieldsFrench = missingStep1.map(field => getFieldDisplayName(field)).join(', ');
          Alert.alert(
            'Champs obligatoires manquants',
            `Veuillez remplir tous les champs marqués d'un astérisque (*) avant de continuer.\n\nChamps manquants: ${missingFieldsFrench}`
          );
          return false;
        }

        // Validation spécifique pour les nombres
        if (isShortTerm) {
          if (parseInt(formData.guests) < 1 || parseInt(formData.bedrooms) < 1 || parseInt(formData.bathrooms) < 1) {
            Alert.alert(
              'Valeurs invalides',
              'Le nombre d\'invités, de chambres et de salles de bain doit être au moins 1.'
            );
            return false;
          }
        } else {
          const surface = parseInt(formData.surfaceM2, 10);
          if (isNaN(surface) || surface < 1) {
            Alert.alert('Surface invalide', 'La surface habitable doit être d\'au moins 1 m².');
            return false;
          }
          const rooms = parseInt(formData.numberOfRooms, 10);
          if (isNaN(rooms) || rooms < 1) {
            Alert.alert('Nombre de pièces invalide', 'Le nombre de pièces doit être au moins 1.');
            return false;
          }
          if (parseInt(formData.bedrooms) < 1 || parseInt(formData.bathrooms) < 1) {
            Alert.alert(
              'Valeurs invalides',
              'Le nombre de chambres et de salles de bain doit être au moins 1.'
            );
            return false;
          }
        }

        if (isShortTerm) {
          if (parseInt(formData.price) < 1000) {
            Alert.alert(
              'Prix trop bas',
              'Le prix par nuit doit être d\'au moins 1000 FCFA.'
            );
            return false;
          }
        } else {
          const rent = parseInt(formData.monthlyRentPrice, 10);
          if (isNaN(rent) || rent < 10000) {
            Alert.alert(
              'Loyer invalide',
              'Le loyer mensuel doit être d\'au moins 10 000 FCFA.'
            );
            return false;
          }
          if (formData.minimumDurationMonths.trim() !== '') {
            const minMonths = parseInt(formData.minimumDurationMonths, 10);
            if (isNaN(minMonths) || minMonths < 1) {
              Alert.alert(
                'Durée minimale invalide',
                'La durée minimale doit être au moins 1 mois si renseignée.'
              );
              return false;
            }
          }
        }

        // Validation des photos / médias
        if (selectedImages.length === 0) {
          Alert.alert(
            'Médias obligatoires',
            'Vous devez ajouter au moins 1 photo ou vidéo de votre logement.'
          );
          return false;
        }
        if (!selectedImages.some((img) => !isMediaRowVideo(img))) {
          Alert.alert(
            'Photo obligatoire',
            'Ajoutez au moins une image pour la vignette. Les vidéos seules ne suffisent pas.'
          );
          return false;
        }

        return true;
      }
        
      case 2:
        // Étape 2: Informations hôte
        const step2Fields = ['hostFullName', 'hostEmail', 'hostPhone'];
        const missingStep2 = step2Fields.filter(field => !formData[field as keyof typeof formData]);
        
        if (missingStep2.length > 0) {
          const missingFieldsFrench = missingStep2.map(field => getFieldDisplayName(field)).join(', ');
          Alert.alert(
            'Champs obligatoires manquants',
            `Veuillez remplir tous les champs marqués d'un astérisque (*) avant de continuer.\n\nChamps manquants: ${missingFieldsFrench}`
          );
          return false;
        }
        
        // Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.hostEmail)) {
          Alert.alert(
            'Email invalide',
            'Veuillez saisir une adresse email valide.'
          );
          return false;
        }
        
        // Validation téléphone
        const phoneRegex = /^[0-9+\-\s()]{8,}$/;
        if (!phoneRegex.test(formData.hostPhone)) {
          Alert.alert(
            'Numéro de téléphone invalide',
            'Veuillez saisir un numéro de téléphone valide (au moins 8 chiffres).'
          );
          return false;
        }
        
        return true;
        
      case 3:
        // Étape 3: Équipements et règles (pas de champs obligatoires)
        return true;
        
      case 4:
        // Étape 4: Conditions
        if (!formData.agreeTerms) {
          Alert.alert(
            'Conditions non acceptées',
            'Vous devez accepter les conditions d\'utilisation pour soumettre votre candidature.'
          );
          return false;
        }
        return true;
        
      case 5:
        // Étape 5: Informations de paiement
        if (!hasPaymentInfo() || !isPaymentInfoComplete()) {
          Alert.alert(
            'Informations de paiement requises',
            'Vous devez configurer vos informations de paiement pour recevoir vos revenus.'
          );
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 5) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour soumettre une candidature.');
      return;
    }

    // Vérifier l'identité avant de permettre la soumission (seulement pour les nouvelles candidatures)
    // Ne pas demander l'identité lors de la modification d'une candidature existante
    // Permettre la soumission si l'identité est uploadée, même si elle est en cours de vérification
    if (!isEditMode && !hasUploadedIdentity && !identityUploadedInSession) {
      Alert.alert(
        'Vérification d\'identité requise',
        'Vous devez envoyer une pièce d\'identité pour soumettre votre candidature.',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Vérifier mon identité', 
            onPress: navigateToProfileIdentity,
          }
        ]
      );
      return;
    }

    // Si l'identité est en cours de vérification, c'est OK - on peut soumettre
    // (la vérification sera faite par l'admin avant l'approbation)
    if (hasUploadedIdentity && verificationStatus === 'pending') {
      console.log('ℹ️ Identité en cours de vérification - soumission autorisée');
    }

    if (submitInFlightRef.current || loading) {
      return;
    }
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
    // Recharger les informations de paiement avant la validation
    // (au cas où elles n'auraient pas été rechargées automatiquement)
    console.log('🔄 Rechargement des informations de paiement avant validation...');
    const freshPaymentInfo = await fetchPaymentInfo();
    
    // Utiliser les données fraîchement récupérées pour la validation
    const hasPayment = freshPaymentInfo !== null;
    const isComplete = isPaymentInfoComplete(freshPaymentInfo);
    const paymentPending = freshPaymentInfo?.verification_status === 'pending';
    const paymentVerified = freshPaymentInfo?.verification_status === 'verified';
    
    // Autoriser la soumission si:
    // 1. Les informations de paiement sont complètes
    // 2. OU les informations sont en cours de validation (pending) - cela signifie qu'elles ont déjà été acceptées
    // 3. OU les informations sont vérifiées
    const canSubmit = hasPayment && (isComplete || paymentPending || paymentVerified);
    
    console.log('💳 Vérification paiement:', {
      hasPayment,
      isComplete,
      paymentPending,
      paymentVerified,
      canSubmit,
      paymentInfo: freshPaymentInfo ? {
        preferred_payment_method: freshPaymentInfo.preferred_payment_method,
        bank_name: freshPaymentInfo.bank_name,
        account_number: freshPaymentInfo.account_number,
        mobile_money_provider: freshPaymentInfo.mobile_money_provider,
        mobile_money_number: freshPaymentInfo.mobile_money_number,
        paypal_email: freshPaymentInfo.paypal_email,
        verification_status: freshPaymentInfo.verification_status
      } : null
    });
    
    if (!canSubmit) {
      console.log('❌ Paiement incomplet ou manquant');
      
      // Message plus détaillé selon la situation
      let message = 'Vous devez configurer vos informations de paiement pour recevoir vos revenus.';
      if (!hasPayment) {
        message += '\n\nAucune information de paiement trouvée. Veuillez les configurer maintenant.';
      } else if (!isComplete) {
        message += '\n\nVos informations de paiement sont incomplètes. Veuillez les compléter.';
      }
      message += '\n\nElles seront vérifiées par notre équipe avant que votre candidature ne soit approuvée.';
      
      Alert.alert(
        'Informations de paiement requises',
        message,
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Configurer le paiement', 
            onPress: () => {
              // Naviguer vers l'écran de paiement
              navigation.navigate('HostPaymentInfo');
            }
          }
        ]
      );
      return;
    }
    
    console.log('✅ Informations de paiement complètes');
    
    // Bloquer si les informations de paiement ont été rejetées
    if (freshPaymentInfo?.verification_status === 'rejected') {
      Alert.alert(
        'Informations de paiement rejetées',
        'Vos informations de paiement ont été rejetées. Veuillez les mettre à jour avant de soumettre votre candidature.',
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Mettre à jour', 
            onPress: () => {
              navigation.navigate('HostPaymentInfo');
            }
          }
        ]
      );
      return;
    }
    
    if (paymentPending || paymentVerified) {
      console.log('ℹ️ Informations de paiement', paymentPending ? 'en cours d\'étude' : 'vérifiées', ', autorisation de la soumission');
    }

    // Validation du code de parrainage si activé (seulement pour les nouveaux hôtes)
    if (!isEditMode && isReferred && enteredReferralCode) {
      if (referralCodeError || !referrerName) {
        Alert.alert(
          "Code de parrainage invalide",
          "Veuillez vérifier le code de parrainage ou désactiver l'option.",
        );
        return;
      }
    }

    // Validation finale de toutes les étapes
    for (let step = 1; step <= 5; step++) {
      if (!validateStep(step)) {
        // Si une étape n'est pas valide, retourner à cette étape
        setCurrentStep(step);
        return;
      }
    }

    // Valider que le propertyType est valide avant de soumettre
    const validPropertyTypes = ['apartment', 'house', 'villa', 'studio', 'guesthouse', 'eco_lodge', 'other'];
    if (!validPropertyTypes.includes(formData.propertyType)) {
      Alert.alert(
        'Type de propriété invalide',
        `Le type de propriété "${formData.propertyType}" n'est pas valide. Veuillez en sélectionner un autre.`
      );
      return;
    }

    // S'assurer que toutes les images sont uploadées (URI publique, pas locale)
    // Les images devraient déjà être uploadées lors de la sélection, mais on vérifie quand même
    const imagesToUpload = selectedImages.filter(img => 
      img.uri && (img.uri.startsWith('http://') || img.uri.startsWith('https://'))
    );
    
    if (imagesToUpload.length !== selectedImages.length) {
      Alert.alert(
        'Images non uploadées',
        'Certaines images ne sont pas encore uploadées. Veuillez réessayer.'
      );
      return;
    }

    const isMonthly = listingType === 'monthly';
    const applicationPayload = {
      propertyType: formData.propertyType,
      location: formData.location?.trim() || '',
      maxGuests: parseInt(formData.guests) || 1,
      bedrooms: parseInt(formData.bedrooms) || 1,
      bathrooms: parseInt(formData.bathrooms) || 1,
      title: formData.title,
      description: formData.description,
      pricePerNight: isMonthly ? 0 : parseInt(formData.price),
      isMonthlyRental: isMonthly,
      ...(isMonthly && {
        monthlyRentPrice: parseInt(formData.monthlyRentPrice, 10) || 0,
        securityDeposit: formData.securityDeposit ? parseInt(formData.securityDeposit, 10) : undefined,
        minimumDurationMonths: formData.minimumDurationMonths ? parseInt(formData.minimumDurationMonths, 10) : undefined,
        chargesIncluded: formData.chargesIncluded,
        surfaceM2: parseInt(formData.surfaceM2, 10) || undefined,
        numberOfRooms: parseInt(formData.numberOfRooms, 10) || undefined,
        isFurnished: formData.isFurnished,
      }),
      fullName: formData.hostFullName,
      email: formData.hostEmail,
      phone: formData.hostPhone,
      // Format exact comme sur le site web
      images: selectedImages.map(img => img.uri), // URLs publiques
      categorizedPhotos: selectedImages.map((img, index) => {
        const vid = isMediaRowVideo(img);
        return {
          url: img.uri,
          category: vid ? 'autre' : img.category || 'autre',
          displayOrder: img.displayOrder ?? index,
          isMain: vid ? false : Boolean(img.isMain),
        };
      }),
      amenities: selectedAmenities,
      customAmenities: customAmenities.trim() 
        ? customAmenities.split(',').map(a => a.trim()).filter(a => a.length > 0)
        : undefined,
      minimumNights: parseInt(formData.minimumNights) || 1,
      autoBooking: formData.autoBooking === 'auto',
      cancellationPolicy: formData.cancellationPolicy,
      hostGuide: formData.hostGuide || undefined,
      checkInTime: formData.checkInTime || null,
      checkOutTime: formData.checkOutTime || null,
      houseRules: [
        formData.allowPets && 'Animaux autorisés',
        formData.allowSmoking && 'Fumer autorisé',
        formData.allowEvents && 'Événements autorisés',
        formData.otherRules
      ].filter(Boolean).join('\n') || null,
      discountEnabled: formData.discountEnabled,
      discountMinNights: formData.discountEnabled ? parseInt(formData.discountMinNights) || undefined : undefined,
      discountPercentage: formData.discountEnabled ? parseInt(formData.discountPercentage) || undefined : undefined,
      longStayDiscountEnabled: formData.longStayDiscountEnabled,
      longStayDiscountMinNights: formData.longStayDiscountEnabled ? parseInt(formData.longStayDiscountMinNights) || undefined : undefined,
      longStayDiscountPercentage: formData.longStayDiscountEnabled ? parseInt(formData.longStayDiscountPercentage) || undefined : undefined,
      cleaningFee: parseInt(formData.cleaningFee) || 0,
      taxes: parseInt(formData.taxes) || 0,
      freeCleaningMinDays: formData.freeCleaningMinDays ? parseInt(formData.freeCleaningMinDays) || undefined : undefined,
    };

    // Enregistrer le code de parrainage dans le profil si fourni (seulement pour les nouveaux hôtes)
    if (!isEditMode && isReferred && enteredReferralCode && referrerName && !referralCodeError) {
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ referral_code_used: enteredReferralCode.toUpperCase() })
          .eq('user_id', user?.id);

        if (profileError) {
          console.error('Erreur lors de l\'enregistrement du code de parrainage:', profileError);
        }
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement du code de parrainage:', error);
      }
    }

    const result = isEditMode && editingApplicationId
      ? await updateApplication(editingApplicationId, applicationPayload)
      : await submitApplication(applicationPayload);

    if (result.success) {
      if (isEditMode) {
        // Envoyer un email aux admins lorsqu'une candidature est modifiée
        try {
          console.log('📧 Envoi email aux admins pour candidature modifiée...');
          
          // Récupérer les informations de paiement de l'utilisateur
          const { data: userPaymentInfo } = await supabase
            .from('host_payment_info')
            .select('*')
            .eq('user_id', user?.id)
            .single();
          
          const { data: adminUsers } = await supabase
            .from('profiles')
            .select('email')
            .eq('role', 'admin');

          if (adminUsers && adminUsers.length > 0) {
            for (const admin of adminUsers) {
              // Email pour modification seulement (pas email de nouvelle candidature)
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'host_application_updated',
                  to: admin.email,
                  data: {
                    hostName: formData.hostFullName,
                    hostEmail: formData.hostEmail,
                    hostPhone: formData.hostPhone,
                    propertyTitle: formData.title,
                    propertyType: formData.propertyType,
                    location: formData.location,
                    pricePerNight: parseInt(formData.price) || 0,
                    maxGuests: parseInt(formData.guests) || 1,
                    bedrooms: parseInt(formData.bedrooms) || 1,
                    bathrooms: parseInt(formData.bathrooms) || 1,
                    description: formData.description,
                    amenities: selectedAmenities,
                    paymentInfo: userPaymentInfo,
                    message: '⚠️ CANDIDATURE MODIFIÉE - L\'utilisateur a modifié sa candidature et l\'a renvoyée en révision',
                    isUpdated: true,
                    updatedAt: new Date().toISOString()
                  }
                }
              });
              
              console.log('✅ Email détaillé avec modifications envoyé à l\'admin:', admin.email);
            }
          }
          
          console.log('✅ Tous les emails de modification envoyés');
        } catch (emailError) {
          console.error('❌ Erreur lors de l\'envoi des emails de modification:', emailError);
        }
        
        Alert.alert(
          'Candidature modifiée !', 
          'Votre candidature a été mise à jour avec succès. Elle repasse en révision. L\'admin a été notifié.',
          [{ text: 'OK', onPress: () => {
            navigation.goBack();
          }}]
        );
      } else {
        // Envoyer les emails après une soumission réussie
        try {
          // Récupérer les informations de paiement de l'utilisateur
          const { data: userPaymentInfo } = await supabase
            .from('host_payment_info')
            .select('*')
            .eq('user_id', user?.id)
            .single();
          
          console.log('💳 Informations de paiement récupérées:', userPaymentInfo);
          
          // Email de confirmation au candidat
          await sendHostApplicationSubmitted(
            formData.hostEmail,
            formData.hostFullName,
            formData.title,
            formData.propertyType,
            formData.location
          );

          // Email de notification aux admins
          const { data: adminUsers, error: adminError } = await supabase
            .from('profiles')
            .select('email, first_name')
            .eq('role', 'admin');

          if (adminError) {
            console.error('❌ Erreur lors de la récupération des admins:', adminError);
          }

          if (adminUsers && adminUsers.length > 0) {
            console.log(`📧 ${adminUsers.length} admin(s) trouvé(s), envoi des emails...`);
            for (const admin of adminUsers) {
              try {
                // Envoyer l'email principal avec toutes les informations
                const emailResult = await supabase.functions.invoke('send-email', {
                  body: {
                    type: 'host_application_received',
                    to: admin.email,
                    data: {
                      hostName: formData.hostFullName,
                      hostEmail: formData.hostEmail,
                      hostPhone: formData.hostPhone,
                      propertyTitle: formData.title,
                      propertyType: formData.propertyType,
                      location: formData.location,
                      pricePerNight: parseInt(formData.price) || 0,
                      maxGuests: parseInt(formData.guests) || 1,
                      bedrooms: parseInt(formData.bedrooms) || 1,
                      bathrooms: parseInt(formData.bathrooms) || 1,
                      description: formData.description,
                      amenities: selectedAmenities,
                      paymentInfo: userPaymentInfo,
                      message: 'Nouvelle candidature soumise'
                    }
                  }
                });

                if (emailResult.error) {
                  console.error(`❌ Erreur lors de l'envoi à ${admin.email}:`, emailResult.error);
                } else {
                  console.log('✅ Email envoyé avec succès à l\'admin:', admin.email);
                }
                
                // Délai pour éviter le rate limit
                await new Promise(resolve => setTimeout(resolve, 600));
              } catch (emailError) {
                console.error(`❌ Erreur lors de l'envoi à ${admin.email}:`, emailError);
              }
            }
          } else {
            // Fallback vers l'email admin par défaut
            console.warn('⚠️ Aucun admin trouvé dans la base de données, envoi à admin@akwahome.com');
            try {
              const emailResult = await supabase.functions.invoke('send-email', {
                body: {
                  type: 'host_application_received',
                  to: 'admin@akwahome.com',
                  data: {
                    hostName: formData.hostFullName,
                    hostEmail: formData.hostEmail,
                    hostPhone: formData.hostPhone,
                    propertyTitle: formData.title,
                    propertyType: formData.propertyType,
                    location: formData.location,
                    pricePerNight: parseInt(formData.price) || 0,
                    maxGuests: parseInt(formData.guests) || 1,
                    bedrooms: parseInt(formData.bedrooms) || 1,
                    bathrooms: parseInt(formData.bathrooms) || 1,
                    description: formData.description,
                    amenities: selectedAmenities,
                    paymentInfo: userPaymentInfo,
                    message: 'Nouvelle candidature soumise'
                  }
                }
              });

              if (emailResult.error) {
                console.error('❌ Erreur lors de l\'envoi à admin@akwahome.com:', emailResult.error);
              } else {
                console.log('✅ Email envoyé avec succès à admin@akwahome.com');
              }
            } catch (emailError) {
              console.error('❌ Erreur lors de l\'envoi à admin@akwahome.com:', emailError);
            }
          }

          console.log('✅ Emails de candidature envoyés avec succès');
        } catch (emailError) {
          console.error('❌ Erreur lors de l\'envoi des emails:', emailError);
          // Continue même si les emails échouent
        }

        Alert.alert(
          'Candidature soumise !', 
          'Votre candidature a été soumise avec succès. Nous vous contacterons bientôt.',
          [{ text: 'OK', onPress: () => {
            // Naviguer vers l'écran d'accueil
            navigation.navigate('Home');
          }}]
        );
      }
    } else {
      // Afficher le message d'erreur détaillé si disponible
      const resultWithError = result as any;
      const errorMessage = resultWithError?.error || (isEditMode 
        ? 'Une erreur est survenue lors de la modification de votre candidature.'
        : 'Une erreur est survenue lors de la soumission de votre candidature.');
      
      console.error('❌ Erreur lors de la soumission:', {
        result,
        formData: {
          propertyType: formData.propertyType,
          location: formData.location,
          maxGuests: formData.guests,
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          title: formData.title,
          description: formData.description,
          price: formData.price,
        },
        applicationPayload: {
          propertyType: applicationPayload.propertyType,
          location: applicationPayload.location,
          maxGuests: applicationPayload.maxGuests,
          bedrooms: applicationPayload.bedrooms,
          bathrooms: applicationPayload.bathrooms,
        }
      });
      
      Alert.alert(
        'Erreur', 
        errorMessage,
        [
          { text: 'OK' },
          { 
            text: 'Voir les détails', 
            onPress: () => {
              console.log('Détails de l\'erreur:', resultWithError?.errorDetails);
            }
          }
        ]
      );
    }
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  /** Écran de choix du type d'annonce : résidence meublée (court séjour) ou location mensuelle (longue durée) */
  const renderListingTypeChoice = () => (
    <View style={styles.listingTypeContainer}>
      <Text style={styles.listingTypeTitle}>Quel type d'annonce souhaitez-vous créer ?</Text>
      <Text style={styles.listingTypeSubtitle}>
        Choisissez le type de location pour afficher le formulaire adapté.
      </Text>
      <TouchableOpacity
        style={[styles.listingTypeCard, listingType === 'short_term' && styles.listingTypeCardSelected]}
        onPress={() => setListingType('short_term')}
        activeOpacity={0.8}
      >
        <View style={styles.listingTypeCardIcon}>
          <Ionicons name="bed-outline" size={36} color={listingType === 'short_term' ? '#fff' : '#e67e22'} />
        </View>
        <Text style={styles.listingTypeCardTitle}>Résidence meublée</Text>
        <Text style={styles.listingTypeCardLabel}>(court séjour)</Text>
        <Text style={styles.listingTypeCardDesc}>
          Pour les voyageurs : location à la nuitée, réservations courtes.
        </Text>
      </TouchableOpacity>
      {FEATURE_MONTHLY_RENTAL && (
      <TouchableOpacity
        style={[styles.listingTypeCard, listingType === 'monthly' && styles.listingTypeCardSelected]}
        onPress={() => setListingType('monthly')}
        activeOpacity={0.8}
      >
        <View style={[styles.listingTypeCardIcon, listingType === 'monthly' && styles.listingTypeCardIconSelected]}>
          <Ionicons name="calendar-outline" size={36} color={listingType === 'monthly' ? '#fff' : '#2E7D32'} />
        </View>
        <Text style={styles.listingTypeCardTitle}>Location mensuelle</Text>
        <Text style={styles.listingTypeCardLabel}>(longue durée)</Text>
        <Text style={styles.listingTypeCardDesc}>
          Pour les locataires : loyer au mois, bail, caution.
        </Text>
      </TouchableOpacity>
      )}
      {listingType && (
        <TouchableOpacity
          style={styles.listingTypeContinueButton}
          onPress={() => {
            if (FEATURE_MONTHLY_RENTAL && listingType === 'monthly') {
              navigation.navigate('AddMonthlyRentalListing');
              return;
            }
            setListingTypeConfirmed(true);
          }}
        >
          <Text style={styles.listingTypeContinueButtonText}>Continuer</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4, 5].map((step) => (
        <View key={step} style={styles.stepContainer}>
          <View style={[
            styles.stepCircle,
            currentStep >= step && styles.stepCircleActive
          ]}>
            <Text style={[
              styles.stepText,
              currentStep >= step && styles.stepTextActive
            ]}>
              {step}
            </Text>
          </View>
          {step < 5 && <View style={styles.stepLine} />}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Informations sur le logement</Text>
      
      {/* Type de propriété */}
      {(!isEditMode || shouldShowField('property_type')) && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type de propriété *</Text>
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={() => setShowPropertyTypeModal(true)}
          >
            <Text style={styles.selectButtonText}>
              {formData.propertyType ? 
                PROPERTY_TYPES.find(t => t.value === formData.propertyType)?.label : 
                'Sélectionner un type'
              }
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Localisation */}
      {(!isEditMode || shouldShowField('location')) && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Localisation *</Text>
          <CitySearchInputModal
            value={typeof formData.location === 'string' ? formData.location : (formData.location?.name ?? '')}
            onChange={handleLocationSelect}
            placeholder="Rechercher ville, commune ou quartier..."
          />
          <Text style={styles.helpText}>
            Recherchez votre ville, commune ou quartier avec autocomplétion
          </Text>
        </View>
      )}

      {/* Capacité : court séjour (invités, chambres, sdb) ou location mensuelle (surface, pièces, chambres, sdb, meublé) */}
      {listingType === 'short_term' && (!isEditMode || shouldShowField('max_guests') || shouldShowField('bedrooms') || shouldShowField('bathrooms')) && (
        <View style={styles.row}>
          {(!isEditMode || shouldShowField('max_guests')) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre d'invités *</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['guests'] = ref; }}
                style={getInputStyle('guests')}
                value={formData.guests}
                onChangeText={(value) => handleInputChange('guests', value)}
                placeholder="2"
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => handleInputSubmit('guests')}
              />
            </View>
          )}
          {(!isEditMode || shouldShowField('bedrooms')) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Chambres *</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['bedrooms'] = ref; }}
                style={getInputStyle('bedrooms')}
                value={formData.bedrooms}
                onChangeText={(value) => handleInputChange('bedrooms', value)}
                placeholder="1"
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => handleInputSubmit('bedrooms')}
              />
            </View>
          )}
          {(!isEditMode || shouldShowField('bathrooms')) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Salles de bain *</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['bathrooms'] = ref; }}
                style={getInputStyle('bathrooms')}
                value={formData.bathrooms}
                onChangeText={(value) => handleInputChange('bathrooms', value)}
                placeholder="1"
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => handleInputSubmit('bathrooms')}
              />
            </View>
          )}
        </View>
      )}
      {listingType === 'monthly' && (
        <>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Surface habitable (m²) *</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['surfaceM2'] = ref; }}
                style={getInputStyle('surfaceM2')}
                value={formData.surfaceM2}
                onChangeText={(value) => handleInputChange('surfaceM2', value)}
                placeholder="45"
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => handleInputSubmit('surfaceM2')}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre de pièces *</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['numberOfRooms'] = ref; }}
                style={getInputStyle('numberOfRooms')}
                value={formData.numberOfRooms}
                onChangeText={(value) => handleInputChange('numberOfRooms', value)}
                placeholder="3"
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => handleInputSubmit('numberOfRooms')}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre de chambres *</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['bedrooms'] = ref; }}
                style={getInputStyle('bedrooms')}
                value={formData.bedrooms}
                onChangeText={(value) => handleInputChange('bedrooms', value)}
                placeholder="2"
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => handleInputSubmit('bedrooms')}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Salles de bain *</Text>
              <TextInput
                ref={(ref) => { inputRefs.current['bathrooms'] = ref; }}
                style={getInputStyle('bathrooms')}
                value={formData.bathrooms}
                onChangeText={(value) => handleInputChange('bathrooms', value)}
                placeholder="1"
                keyboardType="numeric"
                placeholderTextColor="#999"
                returnKeyType="next"
                onSubmitEditing={() => handleInputSubmit('bathrooms')}
              />
            </View>
          </View>
          <View style={[styles.inputGroup, styles.switchRow]}>
            <Text style={styles.label}>Le bien est-il meublé ?</Text>
            <Switch
              value={formData.isFurnished}
              onValueChange={(value) => handleInputChange('isFurnished', value)}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
        </>
      )}

      {/* Titre */}
      {(!isEditMode || shouldShowField('title')) && (
        <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('becomeHost.title')} *</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['title'] = ref; }}
          style={getInputStyle('title')}
          value={formData.title}
          onChangeText={(value) => handleInputChange('title', value)}
          placeholder="Ex: Magnifique appartement avec vue sur mer"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('title')}
        />
        </View>
      )}

      {/* Description */}
          {(!isEditMode || shouldShowField('description')) && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            ref={(ref) => { inputRefs.current['description'] = ref; }}
            style={[getInputStyle('description'), styles.textArea]}
            value={formData.description}
            onChangeText={(value) => handleInputChange('description', value)}
            placeholder="Décrivez votre logement..."
            multiline
            numberOfLines={4}
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => handleInputSubmit('description')}
          />
        </View>
      )}

      {/* Prix (court séjour) ou loyer mensuel (longue durée) */}
      {listingType === 'short_term' && (!isEditMode || shouldShowField('price_per_night')) && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Prix par nuit (FCFA) *</Text>
          <TextInput
            ref={(ref) => { inputRefs.current['price'] = ref; }}
            style={getInputStyle('price')}
            value={formData.price}
            onChangeText={(value) => handleInputChange('price', value)}
            placeholder="25000"
            keyboardType="numeric"
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => handleInputSubmit('price')}
          />
        </View>
      )}
      {listingType === 'monthly' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Loyer mensuel (FCFA) *</Text>
            <TextInput
              ref={(ref) => { inputRefs.current['monthlyRentPrice'] = ref; }}
              style={getInputStyle('monthlyRentPrice')}
              value={formData.monthlyRentPrice}
              onChangeText={(value) => handleInputChange('monthlyRentPrice', value)}
              placeholder="150000"
              keyboardType="numeric"
              placeholderTextColor="#999"
              returnKeyType="next"
              onSubmitEditing={() => handleInputSubmit('monthlyRentPrice')}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Caution (FCFA)</Text>
            <TextInput
              ref={(ref) => { inputRefs.current['securityDeposit'] = ref; }}
              style={getInputStyle('securityDeposit')}
              value={formData.securityDeposit}
              onChangeText={(value) => handleInputChange('securityDeposit', value)}
              placeholder="Optionnel"
              keyboardType="numeric"
              placeholderTextColor="#999"
              returnKeyType="next"
              onSubmitEditing={() => handleInputSubmit('securityDeposit')}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Durée minimale (mois)</Text>
            <TextInput
              ref={(ref) => { inputRefs.current['minimumDurationMonths'] = ref; }}
              style={getInputStyle('minimumDurationMonths')}
              value={formData.minimumDurationMonths}
              onChangeText={(value) => handleInputChange('minimumDurationMonths', value)}
              placeholder="1"
              keyboardType="numeric"
              placeholderTextColor="#999"
              returnKeyType="next"
              onSubmitEditing={() => handleInputSubmit('minimumDurationMonths')}
            />
          </View>
          <View style={[styles.inputGroup, styles.switchRow]}>
            <Text style={styles.label}>Charges comprises dans le loyer</Text>
            <Switch
              value={formData.chargesIncluded}
              onValueChange={(value) => handleInputChange('chargesIncluded', value)}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
        </>
      )}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Indications complémentaires sur l'adresse</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['addressDetails'] = ref; }}
          style={[getInputStyle('addressDetails'), styles.textArea]}
          value={formData.addressDetails}
          onChangeText={(value) => handleInputChange('addressDetails', value)}
          placeholder="Étage, digicode, points de repère, instructions d'accès..."
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('addressDetails')}
        />
        <Text style={styles.helpText}>
          Aidez les voyageurs à trouver facilement votre logement
        </Text>
      </View>

      {/* Photos */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Photos et vidéos de votre logement</Text>
        <Text style={styles.subtitle}>
          Jusqu&apos;à 30 médias (photos + vidéos, max. {MAX_PROPERTY_VIDEOS} vidéos). La photo principale doit être une image, pas une vidéo.
        </Text>
        
        {/* Grille des images */}
        <View style={styles.imageGrid}>
          {selectedImages.map((image, index) => (
            <View key={index} style={[styles.imageContainer, image.isMain && styles.mainImageContainer]}>
              <MediaThumb
                uri={image.uri}
                isVideo={isMediaRowVideo(image)}
                style={styles.selectedImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={20} color="#ff4444" />
              </TouchableOpacity>
              
              {/* Badge photo principale - en haut à gauche */}
              {image.isMain && !isMediaRowVideo(image) && (
                <View style={styles.mainImageBadge}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.mainImageBadgeText}>Principale</Text>
                </View>
              )}
              {isMediaRowVideo(image) && (
                <View style={styles.videoTypeBadge}>
                  <Ionicons name="videocam" size={12} color="#fff" />
                  <Text style={styles.videoTypeBadgeText}>Vidéo</Text>
                </View>
              )}
              
              {/* Boutons d'action en bas - côte à côte */}
              <View style={styles.imageActionsContainer}>
                {/* Bouton pour définir comme principale */}
                {!image.isMain && !isMediaRowVideo(image) && (
                  <TouchableOpacity
                    style={styles.setMainButtonSmall}
                    onPress={() => setMainImage(index)}
                  >
                    <Ionicons name="star-outline" size={14} color="#fff" />
                  </TouchableOpacity>
                )}
                
                {/* Catégorie actuelle */}
                <TouchableOpacity
                  style={[styles.categoryButtonSmall, image.isMain && styles.categoryButtonSmallWithMain]}
                  onPress={() => openCategoryModal(index)}
                >
                  <Text style={styles.categoryIconSmall}>{getCategoryIcon(image.category)}</Text>
                  <Text style={styles.categoryLabelSmall} numberOfLines={1}>{getCategoryLabel(image.category)}</Text>
                  <Ionicons name="pencil" size={10} color="#fff" style={styles.editIconSmall} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {selectedImages.length < 30 && (
            <>
              <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                <Ionicons name="camera" size={24} color="#666" />
                <Text style={styles.addImageText}>Ajouter des photos</Text>
                <Text style={styles.addImageSubtext}>(Sélection multiple possible)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addImageButton, styles.addVideoButton]} onPress={pickVideo}>
                <Ionicons name="videocam-outline" size={24} color="#666" />
                <Text style={styles.addImageText}>Ajouter une vidéo</Text>
                <Text style={styles.addImageSubtext}>(max. {MAX_PROPERTY_VIDEOS} vidéos)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        
        {/* Instructions pour la catégorisation et photo principale */}
        {selectedImages.length > 0 && (
          <View style={styles.categoryInstructions}>
            <Ionicons name="information-circle" size={16} color="#007bff" />
            <Text style={styles.categoryInstructionsText}>
              Appuyez sur la catégorie d'une photo pour la modifier. Appuyez sur "Définir principale" pour choisir la photo principale.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Informations hôte</Text>
      
      {/* Nom complet */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nom complet *</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['hostFullName'] = ref; }}
          style={getInputStyle('hostFullName')}
          value={formData.hostFullName}
          onChangeText={(value) => handleInputChange('hostFullName', value)}
          placeholder="Votre nom complet"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('hostFullName')}
        />
      </View>

      {/* Email */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['hostEmail'] = ref; }}
          style={getInputStyle('hostEmail')}
          value={formData.hostEmail}
          onChangeText={(value) => handleInputChange('hostEmail', value)}
          placeholder="votre@email.com"
          keyboardType="email-address"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('hostEmail')}
        />
      </View>

      {/* Téléphone */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Téléphone *</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['hostPhone'] = ref; }}
          style={getInputStyle('hostPhone')}
          value={formData.hostPhone}
          onChangeText={(value) => handleInputChange('hostPhone', value)}
          placeholder="+225 XX XX XX XX"
          keyboardType="phone-pad"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('hostPhone')}
        />
      </View>

      {/* Guide de l'hôte */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Guide de l'hôte</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['hostGuide'] = ref; }}
          style={[styles.input, styles.textArea]}
          value={formData.hostGuide}
          onChangeText={(value) => handleInputChange('hostGuide', value)}
          placeholder="Conseils pour les voyageurs, recommandations locales..."
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('hostGuide')}
        />
        <Text style={styles.helpText}>
          Partagez vos conseils et recommandations pour aider les voyageurs
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Équipements et règles</Text>
      
      {/* Équipements */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Équipements disponibles</Text>
        <View style={styles.amenitiesGrid}>
          {availableAmenities.map((amenity) => (
            <TouchableOpacity
              key={amenity.id}
              style={[
                styles.amenityItem,
                selectedAmenities.includes(amenity.name) && styles.amenityItemSelected
              ]}
              onPress={() => toggleAmenity(amenity.name)}
            >
              <Text style={[
                styles.amenityText,
                selectedAmenities.includes(amenity.name) && styles.amenityTextSelected
              ]}>
                {amenity.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Champ pour les équipements personnalisés */}
        <View style={styles.customAmenitiesSection}>
          <Text style={styles.label}>Autres équipements (non listés ci-dessus)</Text>
          <Text style={styles.hint}>
            Ajoutez des équipements supplémentaires qui ne figurent pas dans la liste (séparés par des virgules)
          </Text>
          <TextInput
            style={styles.textArea}
            value={customAmenities}
            onChangeText={setCustomAmenities}
            placeholder="Exemple: Lave-vaisselle, Sèche-linge, Barbecue, etc."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Section Réductions */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réductions par durée de séjour</Text>
        <Text style={styles.helpText}>
          Offrez des réductions pour les séjours longs
        </Text>
        
        <View style={styles.discountContainer}>
          <TouchableOpacity
            style={styles.switchContainer}
            onPress={() => handleInputChange('discountEnabled', !formData.discountEnabled)}
          >
            <View style={[styles.switch, formData.discountEnabled && styles.switchActive]}>
              <View style={[styles.switchThumb, formData.discountEnabled && styles.switchThumbActive]} />
            </View>
            <Text style={styles.switchLabel}>Activer les réductions</Text>
          </TouchableOpacity>
          
          {formData.discountEnabled && (
            <View style={styles.discountFields}>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nuits minimum pour réduction</Text>
                  <TextInput
                    ref={(ref) => { inputRefs.current['discountMinNights'] = ref; }}
                    style={styles.input}
                    value={formData.discountMinNights}
                    onChangeText={(value) => handleInputChange('discountMinNights', value)}
                    placeholder="5"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onSubmitEditing={() => handleInputSubmit('discountMinNights')}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pourcentage de réduction</Text>
                  <TextInput
                    ref={(ref) => { inputRefs.current['discountPercentage'] = ref; }}
                    style={styles.input}
                    value={formData.discountPercentage}
                    onChangeText={(value) => handleInputChange('discountPercentage', value)}
                    placeholder="15"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onSubmitEditing={() => handleInputSubmit('discountPercentage')}
                  />
                </View>
              </View>
              
              {/* Aperçu du calcul */}
              {formData.price && formData.discountMinNights && formData.discountPercentage && (
                <View style={styles.discountPreview}>
                  <Text style={styles.discountPreviewTitle}>Aperçu de la réduction :</Text>
                  <Text style={styles.discountPreviewText}>
                    Prix normal : {parseInt(formData.price).toLocaleString()} FCFA/nuit
                  </Text>
                  <Text style={styles.discountPreviewText}>
                    Réduction de {formData.discountPercentage}% à partir de {formData.discountMinNights} nuit{formData.discountMinNights !== "1" ? "s" : ""}
                  </Text>
                  <Text style={styles.discountPreviewPrice}>
                    Prix réduit : {Math.round(parseInt(formData.price) * (1 - parseInt(formData.discountPercentage) / 100)).toLocaleString()} FCFA/nuit
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

      {/* Section Réductions long séjour */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Réductions pour très long séjour</Text>
        <Text style={styles.helpText}>
          Offrez des réductions supplémentaires pour les séjours très longs (ex: 30+ nuits)
        </Text>
        
        <View style={styles.discountContainer}>
          <TouchableOpacity
            style={styles.switchContainer}
            onPress={() => handleInputChange('longStayDiscountEnabled', !formData.longStayDiscountEnabled)}
          >
            <View style={[styles.switch, formData.longStayDiscountEnabled && styles.switchActive]}>
              <View style={[styles.switchThumb, formData.longStayDiscountEnabled && styles.switchThumbActive]} />
            </View>
            <Text style={styles.switchLabel}>Activer les réductions long séjour</Text>
          </TouchableOpacity>
          
          {formData.longStayDiscountEnabled && (
            <View style={styles.discountFields}>
              <View style={styles.row}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nuits minimum pour réduction long séjour</Text>
                  <TextInput
                    ref={(ref) => { inputRefs.current['longStayDiscountMinNights'] = ref; }}
                    style={styles.input}
                    value={formData.longStayDiscountMinNights}
                    onChangeText={(value) => handleInputChange('longStayDiscountMinNights', value)}
                    placeholder="30"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onSubmitEditing={() => handleInputSubmit('longStayDiscountMinNights')}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pourcentage de réduction long séjour</Text>
                  <TextInput
                    ref={(ref) => { inputRefs.current['longStayDiscountPercentage'] = ref; }}
                    style={styles.input}
                    value={formData.longStayDiscountPercentage}
                    onChangeText={(value) => handleInputChange('longStayDiscountPercentage', value)}
                    placeholder="25"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onSubmitEditing={() => handleInputSubmit('longStayDiscountPercentage')}
                  />
                </View>
              </View>
              
              {/* Aperçu du calcul */}
              {formData.price && formData.longStayDiscountMinNights && formData.longStayDiscountPercentage && (
                <View style={styles.discountPreview}>
                  <Text style={styles.discountPreviewTitle}>Aperçu de la réduction long séjour :</Text>
                  <Text style={styles.discountPreviewText}>
                    Prix normal : {parseInt(formData.price).toLocaleString()} FCFA/nuit
                  </Text>
                  <Text style={styles.discountPreviewText}>
                    Réduction de {formData.longStayDiscountPercentage}% à partir de {formData.longStayDiscountMinNights} nuit{formData.longStayDiscountMinNights !== "1" ? "s" : ""}
                  </Text>
                  <Text style={styles.discountPreviewPrice}>
                    Prix réduit : {Math.round(parseInt(formData.price) * (1 - parseInt(formData.longStayDiscountPercentage) / 100)).toLocaleString()} FCFA/nuit
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
      </View>

      {/* Horaires */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Horaires</Text>
        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.sublabel}>Heure d'arrivée</Text>
            <TextInput
              style={styles.input}
              value={formData.checkInTime}
              onChangeText={(value) => handleInputChange('checkInTime', value)}
              placeholder="14:00"
              placeholderTextColor="#999"
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.sublabel}>Heure de départ</Text>
            <TextInput
              style={styles.input}
              value={formData.checkOutTime}
              onChangeText={(value) => handleInputChange('checkOutTime', value)}
              placeholder="11:00"
              placeholderTextColor="#999"
            />
          </View>
        </View>
      </View>

      {/* Règles intérieures */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Règlement intérieur</Text>
        
        {/* Événements autorisés */}
        <View style={styles.switchContainer}>
          <TouchableOpacity
            style={[styles.switch, formData.allowEvents && styles.switchActive]}
            onPress={() => handleInputChange('allowEvents', !formData.allowEvents)}
          >
            <View style={[styles.switchThumb, formData.allowEvents && styles.switchThumbActive]} />
          </TouchableOpacity>
          <Text style={styles.switchLabel}>Événements autorisés</Text>
        </View>

        {/* Fumer autorisé */}
        <View style={styles.switchContainer}>
          <TouchableOpacity
            style={[styles.switch, formData.allowSmoking && styles.switchActive]}
            onPress={() => handleInputChange('allowSmoking', !formData.allowSmoking)}
          >
            <View style={[styles.switchThumb, formData.allowSmoking && styles.switchThumbActive]} />
          </TouchableOpacity>
          <Text style={styles.switchLabel}>Fumer autorisé</Text>
        </View>

        {/* Animaux autorisés */}
        <View style={styles.switchContainer}>
          <TouchableOpacity
            style={[styles.switch, formData.allowPets && styles.switchActive]}
            onPress={() => handleInputChange('allowPets', !formData.allowPets)}
          >
            <View style={[styles.switchThumb, formData.allowPets && styles.switchThumbActive]} />
          </TouchableOpacity>
          <Text style={styles.switchLabel}>Animaux autorisés</Text>
        </View>

        {/* Autres règles */}
        <View style={{ marginTop: 10 }}>
          <Text style={styles.sublabel}>Autres règles</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.otherRules}
            onChangeText={(value) => handleInputChange('otherRules', value)}
            placeholder="Ex: Respecter les voisins, Ne pas utiliser la piscine après 22h..."
            multiline
            numberOfLines={3}
            placeholderTextColor="#999"
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Frais */}
      <View style={styles.row}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Frais de nettoyage (FCFA)</Text>
          <TextInput
            ref={(ref) => { inputRefs.current['cleaningFee'] = ref; }}
            style={styles.input}
            value={formData.cleaningFee}
            onChangeText={(value) => handleInputChange('cleaningFee', value)}
            placeholder="5000"
            keyboardType="numeric"
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => handleInputSubmit('cleaningFee')}
          />
        </View>
      </View>

      {/* Ménage gratuit */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Ménage gratuit pour les longs séjours</Text>
        <Text style={styles.helpText}>
          Offrez un service de ménage gratuit pour inciter les réservations longue durée
        </Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>À partir de combien de jours offrez-vous le ménage gratuit ?</Text>
          <TextInput
            ref={(ref) => { inputRefs.current['freeCleaningMinDays'] = ref; }}
            style={styles.input}
            value={formData.freeCleaningMinDays}
            onChangeText={(value) => handleInputChange('freeCleaningMinDays', value)}
            placeholder="ex: 7 (optionnel)"
            keyboardType="numeric"
            placeholderTextColor="#999"
            returnKeyType="next"
            onSubmitEditing={() => handleInputSubmit('freeCleaningMinDays')}
          />
          <Text style={styles.helpText}>
            Laissez vide si vous ne proposez pas de ménage gratuit
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Conditions et soumission</Text>
      
      {/* Politique d'annulation */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Politique d'annulation</Text>
        <TouchableOpacity 
          style={styles.selectButton}
          onPress={() => setShowCancellationModal(true)}
        >
          <Text style={styles.selectButtonText}>
            {CANCELLATION_POLICIES.find(p => p.value === formData.cancellationPolicy)?.label}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Nuits minimum */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nuits minimum</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['minimumNights'] = ref; }}
          style={styles.input}
          value={formData.minimumNights}
          onChangeText={(value) => handleInputChange('minimumNights', value)}
          placeholder="1"
          keyboardType="numeric"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('minimumNights')}
        />
      </View>

      {/* Section Parrainage - Masquée si l'utilisateur est déjà hôte */}
      {!isEditMode && !isAlreadyHost && (
        <View style={styles.inputGroup}>
          <View style={styles.referralSection}>
            <TouchableOpacity
              style={styles.switchContainer}
              onPress={() => {
                setIsReferred(!isReferred);
                if (!isReferred) {
                  setEnteredReferralCode('');
                  setReferralCodeError('');
                  setReferrerName('');
                }
              }}
            >
              <View style={[styles.switch, isReferred && styles.switchActive]}>
                <View style={[styles.switchThumb, isReferred && styles.switchThumbActive]} />
              </View>
              <Text style={styles.switchLabel}>J'ai un code de parrainage</Text>
            </TouchableOpacity>

            {isReferred && (
              <View style={styles.referralInputContainer}>
                <Text style={styles.label}>Code de parrainage *</Text>
                <TextInput
                  style={[
                    styles.input,
                    referralCodeError ? styles.inputError : referrerName ? styles.inputSuccess : null
                  ]}
                  placeholder="Entrez le code de parrainage"
                  value={enteredReferralCode}
                  onChangeText={async (code) => {
                    const upperCode = code.toUpperCase();
                    setEnteredReferralCode(upperCode);
                    setReferralCodeError('');
                    setReferrerName('');

                    if (upperCode.length >= 6) {
                      const result = await verifyReferralCode(upperCode);
                      if (result.valid) {
                        setReferrerName(result.referrerName || '');
                      } else {
                        setReferralCodeError(result.error || 'Code invalide');
                      }
                    }
                  }}
                  autoCapitalize="characters"
                  placeholderTextColor="#999"
                />
                {referralCodeError && (
                  <Text style={styles.errorText}>{referralCodeError}</Text>
                )}
                {referrerName && !referralCodeError && (
                  <View style={styles.successContainer}>
                    <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                    <Text style={styles.successText}>
                      Code valide ! Parrainé par {referrerName}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Conditions d'utilisation */}
      <View style={styles.inputGroup}>
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => handleInputChange('agreeTerms', !formData.agreeTerms)}
        >
          <View style={[
            styles.checkbox,
            formData.agreeTerms && styles.checkboxChecked
          ]}>
            {formData.agreeTerms && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={styles.checkboxText}>
            J'accepte les conditions d'utilisation et la politique de confidentialité *
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Informations de paiement</Text>
      
      <View style={styles.paymentInfoContainer}>
        <Ionicons name="card" size={48} color="#e67e22" />
        <Text style={styles.paymentInfoTitle}>Configuration du paiement</Text>
        <Text style={styles.paymentInfoDescription}>
          Pour recevoir vos revenus, vous devez configurer vos informations de paiement.
        </Text>
        
        {hasPaymentInfo() ? (
          <View style={styles.paymentStatusContainer}>
            <Ionicons 
              name={isPaymentInfoComplete() ? 'checkmark-circle' : 'alert-circle'} 
              size={24} 
              color={isPaymentInfoComplete() ? '#10b981' : '#f59e0b'} 
            />
            <Text style={styles.paymentStatusText}>
              {isPaymentInfoComplete() 
                ? 'Informations de paiement configurées' 
                : 'Informations de paiement incomplètes'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.paymentStatusContainer}>
            <Ionicons name="add-circle" size={24} color="#e67e22" />
            <Text style={styles.paymentStatusText}>
              Aucune information de paiement configurée
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.configurePaymentButton}
          onPress={() => navigation.navigate('HostPaymentInfo')}
        >
          <Ionicons name="settings" size={20} color="#fff" />
          <Text style={styles.configurePaymentButtonText}>
            {hasPaymentInfo() ? 'Modifier le paiement' : 'Configurer le paiement'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView style={styles.scrollView}>
        {/* Bouton de retour */}
        <View style={styles.backButtonContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
        
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEditMode ? 'Modifier votre candidature' : 'Devenir hôte'}
          </Text>
          <Text style={styles.subtitle}>
            {isEditMode 
              ? 'Modifiez les informations de votre candidature ci-dessous'
              : 'Partagez votre logement et générez des revenus supplémentaires'}
          </Text>
        </View>

        {/* Vérification d'identité : même composant que Mon compte + upload possible sans quitter l'écran */}
        {((!hasUploadedIdentity && !identityUploadedInSession) ||
          (hasUploadedIdentity && verificationStatus === 'pending') ||
          (hasUploadedIdentity && verificationStatus === 'rejected')) && (
          <View style={styles.identityInFormWrap}>
            <IdentityVerificationAlert
              onVerificationComplete={() => {
                checkIdentityStatus(true);
              }}
            />
            {verificationStatus === 'pending' ? (
              <Text style={styles.identityInFormHint}>
                Vous pouvez soumettre votre candidature : la validation finale sera faite par notre équipe.
              </Text>
            ) : null}
          </View>
        )}

        {/* Choix du type d'annonce (désactivé tant que seule la résidence meublée est proposée) */}
        {(!listingType || !listingTypeConfirmed) ? (
          renderListingTypeChoice()
        ) : (
          <>
            {/* Indicateur d'étapes */}
            {renderStepIndicator()}

            {/* Contenu des étapes */}
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}

            {/* Boutons de navigation */}
            <View style={styles.navigationButtons}>
              {currentStep > 1 && (
                <TouchableOpacity style={styles.prevButton} onPress={prevStep}>
                  <Text style={styles.prevButtonText}>Précédent</Text>
                </TouchableOpacity>
              )}

              {currentStep < 4 ? (
                <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
                  <Text style={styles.nextButtonText}>Suivant</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.nextButton, (loading || isSubmitting) && styles.nextButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading || isSubmitting}
                >
                  {loading || isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.nextButtonText}>Soumettre</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal type de propriété */}
      {showPropertyTypeModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Type de propriété</Text>
            {PROPERTY_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={styles.modalItem}
                onPress={() => handlePropertyTypeSelect(type.value)}
              >
                <Text style={styles.modalItemText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowPropertyTypeModal(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal politique d'annulation */}
      {showCancellationModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Politique d'annulation</Text>
            <ScrollView style={styles.modalScrollView}>
              {CANCELLATION_POLICIES.map((policy) => (
                <TouchableOpacity
                  key={policy.value}
                  style={styles.modalItem}
                  onPress={() => {
                    handleInputChange('cancellationPolicy', policy.value);
                    setShowCancellationModal(false);
                  }}
                >
                  <View style={styles.policyItem}>
                    <Text style={styles.modalItemText}>{policy.label}</Text>
                    <Text style={styles.policyDescription}>{policy.description}</Text>
                  </View>
                  {formData.cancellationPolicy === policy.value && (
                    <Ionicons name="checkmark" size={20} color="#007bff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowCancellationModal(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal catégorisation des photos */}
      {showCategoryModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Catégoriser la photo</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowCategoryModal(false);
                  setSelectedImageForCategory(null);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Aperçu de la photo */}
            {selectedImageForCategory !== null && (
              <View style={styles.photoPreview}>
                <MediaThumb
                  uri={selectedImages[selectedImageForCategory].uri}
                  isVideo={isMediaRowVideo(selectedImages[selectedImageForCategory])}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <Text style={styles.previewText}>
                  Photo {selectedImageForCategory + 1} sur {selectedImages.length}
                </Text>
              </View>
            )}
            
            <Text style={styles.modalSubtitle}>
              {selectedImageForCategory !== null && selectedImages[selectedImageForCategory]?.category === 'other' 
                ? "Cette photo vient d'être ajoutée. Choisissez sa catégorie :"
                : "Choisissez la catégorie qui correspond le mieux à cette photo"
              }
            </Text>
            
            <ScrollView style={styles.categoryList}>
              {PHOTO_CATEGORIES.map((category) => {
                const isSuggested = selectedImageForCategory !== null && 
                  selectedImages[selectedImageForCategory]?.category === category.value &&
                  category.value === getSuggestedCategory();
                
                return (
                  <TouchableOpacity
                    key={category.value}
                    style={[
                      styles.categoryOption,
                      selectedImageForCategory !== null && 
                      selectedImages[selectedImageForCategory]?.category === category.value && 
                      styles.categoryOptionSelected,
                      isSuggested && styles.categoryOptionSuggested
                    ]}
                    onPress={() => setImageCategory(category.value)}
                  >
                    <Text style={styles.categoryOptionIcon}>{category.icon}</Text>
                    <Text style={styles.categoryOptionLabel}>{category.label}</Text>
                    {selectedImageForCategory !== null && 
                     selectedImages[selectedImageForCategory]?.category === category.value && (
                      <Ionicons name="checkmark-circle" size={20} color="#007bff" />
                    )}
                    {isSuggested && (
                      <Text style={styles.suggestedText}>Suggéré</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  backButtonContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginLeft: 8,
  },
  header: {
    padding: 20,
    paddingTop: 10, // Réduire le padding top pour éviter le chevauchement
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  listingTypeContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  listingTypeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  listingTypeSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
  },
  listingTypeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  listingTypeCardSelected: {
    borderColor: '#007bff',
    backgroundColor: '#f0f9ff',
  },
  listingTypeCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff5eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  listingTypeCardIconSelected: {
    backgroundColor: '#e3f2fd',
  },
  listingTypeCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  listingTypeCardLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  listingTypeCardDesc: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  listingTypeContinueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  listingTypeContinueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  identityInFormWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  identityInFormHint: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
    lineHeight: 18,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#e67e22',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  stepTextActive: {
    color: '#fff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 8,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textAreaBase: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  amenityItemSelected: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  amenityText: {
    fontSize: 14,
    color: '#374151',
  },
  amenityTextSelected: {
    color: '#fff',
  },
  customAmenitiesSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 80,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 8,
  },
  discountContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginTop: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchActive: {
    backgroundColor: '#e67e22',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  discountFields: {
    marginTop: 10,
  },
  discountPreview: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  discountPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  discountPreviewText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  discountPreviewPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e67e22',
    marginTop: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#e67e22',
    borderColor: '#e67e22',
  },
  checkboxText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  prevButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  prevButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#e67e22',
    paddingVertical: 16,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalScrollView: {
    maxHeight: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalItemText: {
    fontSize: 16,
    color: '#374151',
  },
  policyItem: {
    flex: 1,
  },
  policyDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    lineHeight: 16,
  },
  modalCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#e67e22',
    fontWeight: '600',
  },
  categoryButton: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  categoryLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  categoryList: {
    maxHeight: 300,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryOptionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  categoryOptionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  categoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  editIcon: {
    marginLeft: 4,
  },
  categoryInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  categoryInstructionsText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#007bff',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 5,
  },
  photoPreview: {
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 12,
    color: '#666',
  },
  categoryOptionSelected: {
    backgroundColor: '#f0f8ff',
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  categoryOptionSuggested: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  suggestedText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '600',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  // Styles pour les images
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  mainImageContainer: {
    borderWidth: 3,
    borderColor: '#FFD700',
    borderRadius: 8,
    padding: 2,
  },
  selectedImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  mainImageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  mainImageBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  videoTypeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
    gap: 4,
  },
  videoTypeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  imageActionsContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 5,
  },
  setMainButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  categoryButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    minHeight: 32,
  },
  categoryButtonSmallWithMain: {
    flex: 1,
  },
  categoryIconSmall: {
    fontSize: 12,
    marginRight: 4,
  },
  categoryLabelSmall: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    flex: 1,
    marginRight: 2,
  },
  editIconSmall: {
    marginLeft: 2,
  },
  addImageButton: {
    width: 150,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    marginRight: 10,
  },
  addVideoButton: {
    borderColor: '#94a3b8',
  },
  addImageText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  addImageSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Styles pour l'étape 5 - Informations de paiement
  paymentInfoContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  paymentInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  paymentInfoDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  paymentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  paymentStatusText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  configurePaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  configurePaymentButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  referralSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginTop: 10,
  },
  referralInputContainer: {
    marginTop: 15,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  inputSuccess: {
    borderColor: '#2E7D32',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 5,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  successText: {
    color: '#2E7D32',
    fontSize: 12,
    marginLeft: 8,
  },
});

export default BecomeHostScreen;