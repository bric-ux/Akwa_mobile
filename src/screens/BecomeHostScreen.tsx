import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../services/AuthContext';
import { useHostApplications } from '../hooks/useHostApplications';
import { useEmailService } from '../hooks/useEmailService';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import { useHostPaymentInfo } from '../hooks/useHostPaymentInfo';
import CitySearchInputModal from '../components/CitySearchInputModal';
import { supabase } from '../services/supabase';
import { Amenity } from '../types';

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
  { value: 'autre', label: 'Autres', icon: '📸', priority: 7 },
];

const BecomeHostScreen: React.FC = ({ route }: any) => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { submitApplication, getAmenities, getApplicationById, updateApplication, loading } = useHostApplications();
  const { sendHostApplicationSubmitted, sendHostApplicationReceived } = useEmailService();
  const { hasUploadedIdentity, verificationStatus, checkIdentityStatus } = useIdentityVerification();
  const { hasPaymentInfo, isPaymentInfoComplete, paymentInfo } = useHostPaymentInfo();
  
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
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
    experience: '',
    
    // Frais et règles
    cleaningFee: '',
    houseRules: '',
    minimumNights: '1',
    autoBooking: 'request',
    cancellationPolicy: 'flexible',
    
    // Réductions
    discountEnabled: false,
    discountMinNights: '',
    discountPercentage: '',
    
    // Conditions
    agreeTerms: false
  });
  
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [availableAmenities, setAvailableAmenities] = useState<Amenity[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [showPropertyTypeModal, setShowPropertyTypeModal] = useState(false);
  const [identityUploadedInSession, setIdentityUploadedInSession] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [selectedImages, setSelectedImages] = useState<Array<{uri: string, category: string, displayOrder: number}>>([]);
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
  
  const loadApplicationData = async (applicationId: string) => {
    console.log('📋 Chargement de la candidature pour édition:', applicationId);
    
    const application = await getApplicationById(applicationId);
    if (application) {
      console.log('📋 Candidature chargée:', application);
      
      setFormData({
        propertyType: application.property_type || '',
        location: application.location || '',
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
        experience: application.experience || '',
        cleaningFee: application.cleaning_fee?.toString() || '',
        houseRules: '',
        minimumNights: application.minimum_nights?.toString() || '1',
        autoBooking: application.auto_booking ? 'auto' : 'request',
        cancellationPolicy: application.cancellation_policy || 'flexible',
        discountEnabled: application.discount_enabled || false,
        discountMinNights: application.discount_min_nights?.toString() || '',
        discountPercentage: application.discount_percentage?.toString() || '',
        agreeTerms: false
      });
      
      // Charger les équipements
      setSelectedAmenities(application.amenities || []);
      
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
                displayOrder: photoDisplayOrder
              };
              
              console.log(`📸 Photo ${index} formatée:`, formattedPhoto);
              return formattedPhoto;
            });
            
            console.log('📸 Final formatted photos:', formattedPhotos);
            console.log('📸 Catégories des photos:', formattedPhotos.map(p => p.category));
            setSelectedImages(formattedPhotos);
          }
        } catch (e) {
          console.error('❌ Error parsing categorized_photos:', e);
        }
      } else if (application.images && application.images.length > 0) {
        console.log('📸 Pas de categorized_photos, chargement depuis images');
        const photos = application.images.map((url: string, index: number) => ({
          uri: url,
          category: 'autre',
          displayOrder: index
        }));
        setSelectedImages(photos as any);
      }
      
      console.log('✅ Données chargées avec succès');
    }
  };

  const loadAmenities = async () => {
    const amenities = await getAmenities();
    setAvailableAmenities(amenities);
  };

  const loadUserProfile = () => {
    if (user) {
      const metadata = user.user_metadata;
      setFormData(prev => ({
        ...prev,
        hostEmail: user.email || '',
        hostFullName: metadata?.first_name && metadata?.last_name 
          ? `${metadata.first_name} ${metadata.last_name}` 
          : '',
      }));
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleAmenity = (amenityId: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenityId) 
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
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

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const suggestedCategory = getSuggestedCategory();
      const newImage = {
        uri: result.assets[0].uri,
        category: suggestedCategory,
        displayOrder: selectedImages.length + 1
      };
      setSelectedImages(prev => [...prev, newImage]);
      
      // Proposer directement la catégorisation de la nouvelle image
      setTimeout(() => {
        openCategoryModal(selectedImages.length);
      }, 500);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
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
      
      // Passer automatiquement au champ suivant (nombre d'invités)
      setTimeout(() => {
        if (inputRefs.current['guests']) {
          inputRefs.current['guests']?.focus();
        }
      }, 300);
    } else {
      console.log('📍 Localisation effacée');
      handleInputChange('location', '');
    }
  };

  const getNextField = (currentField: string): string | undefined => {
    const fieldOrder = [
      'propertyType', 'location', 'guests', 'bedrooms', 'bathrooms',
      'title', 'description', 'price', 'addressDetails',
      'hostFullName', 'hostEmail', 'hostPhone', 'experience', 'hostGuide',
      'cleaningFee', 'houseRules', 'minimumNights', 'discountMinNights', 'discountPercentage',
      'autoBooking', 'cancellationPolicy'
    ];
    
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
      hostFullName: 'Nom complet',
      hostEmail: 'Email',
      hostPhone: 'Téléphone',
    };
    return fieldNames[fieldName] || fieldName;
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        // Étape 1: Informations sur le logement
        const step1Fields = ['propertyType', 'location', 'guests', 'bedrooms', 'bathrooms', 'title', 'description', 'price'];
        const missingStep1 = step1Fields.filter(field => !formData[field as keyof typeof formData]);
        
        if (missingStep1.length > 0) {
          const missingFieldsFrench = missingStep1.map(field => getFieldDisplayName(field)).join(', ');
          Alert.alert(
            'Champs obligatoires manquants',
            `Veuillez remplir tous les champs marqués d'un astérisque (*) avant de continuer.\n\nChamps manquants: ${missingFieldsFrench}`
          );
          return false;
        }
        
        // Validation spécifique pour les nombres
        if (parseInt(formData.guests) < 1 || parseInt(formData.bedrooms) < 1 || parseInt(formData.bathrooms) < 1) {
          Alert.alert(
            'Valeurs invalides',
            'Le nombre d\'invités, de chambres et de salles de bain doit être au moins 1.'
          );
          return false;
        }
        
        if (parseInt(formData.price) < 1000) {
          Alert.alert(
            'Prix trop bas',
            'Le prix par nuit doit être d\'au moins 1000 FCFA.'
          );
          return false;
        }
        
        // Validation des photos
        if (selectedImages.length === 0) {
          Alert.alert(
            'Photos obligatoires',
            'Vous devez ajouter au moins 1 photo de votre logement.'
          );
          return false;
        }
        
        return true;
        
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
    if (!isEditMode && !hasUploadedIdentity && !identityUploadedInSession) {
      Alert.alert(
        'Vérification d\'identité requise',
        'Vous devez télécharger une pièce d\'identité pour soumettre votre candidature.',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Vérifier mon identité', 
            onPress: () => {
              // Retourner à l'accueil pour permettre la navigation vers le profil
              navigation.goBack();
            }
          }
        ]
      );
      return;
    }

    // Vérifier les informations de paiement
    // Autoriser la soumission si:
    // 1. Les infos de paiement sont complètes ET vérifiées
    // 2. OU les infos de paiement sont complètes ET en cours d'étude
    // 3. OU les infos de paiement sont complètes (même si pas encore vérifiées)
    const hasCompletePaymentInfo = hasPaymentInfo() && isPaymentInfoComplete();
    const paymentPending = paymentInfo?.verification_status === 'pending';
    const paymentVerified = paymentInfo?.verification_status === 'verified';
    
    if (!hasCompletePaymentInfo) {
      Alert.alert(
        'Informations de paiement requises',
        'Vous devez configurer vos informations de paiement pour recevoir vos revenus. Elles seront vérifiées par notre équipe avant que votre candidature ne soit approuvée.',
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
    
    // Bloquer si les informations de paiement ont été rejetées
    if (paymentInfo?.verification_status === 'rejected') {
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

    // Validation finale de toutes les étapes
    for (let step = 1; step <= 5; step++) {
      if (!validateStep(step)) {
        // Si une étape n'est pas valide, retourner à cette étape
        setCurrentStep(step);
        return;
      }
    }

    const applicationPayload = {
      propertyType: formData.propertyType,
      location: formData.location,
      maxGuests: parseInt(formData.guests) || 1,
      bedrooms: parseInt(formData.bedrooms) || 1,
      bathrooms: parseInt(formData.bathrooms) || 1,
      title: formData.title,
      description: formData.description,
      pricePerNight: parseInt(formData.price),
      fullName: formData.hostFullName,
      email: formData.hostEmail,
      phone: formData.hostPhone,
      experience: formData.experience,
      images: selectedImages.map(img => img.uri),
      categorizedPhotos: selectedImages.map((img, index) => ({
        url: img.uri,
        category: img.category || 'autre',
        displayOrder: img.displayOrder ?? index
      })),
      amenities: selectedAmenities,
      minimumNights: parseInt(formData.minimumNights) || 1,
      autoBooking: formData.autoBooking === 'auto',
      cancellationPolicy: formData.cancellationPolicy,
      hostGuide: formData.hostGuide || undefined,
      discountEnabled: formData.discountEnabled,
      discountMinNights: formData.discountEnabled ? parseInt(formData.discountMinNights) || undefined : undefined,
      discountPercentage: formData.discountEnabled ? parseInt(formData.discountPercentage) || undefined : undefined,
      cleaningFee: parseInt(formData.cleaningFee) || 0,
    };

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
              // Email de notification standard
              await sendHostApplicationReceived(
                admin.email,
                formData.hostFullName,
                formData.hostEmail,
                formData.title,
                formData.propertyType,
                formData.location,
                parseInt(formData.price) || 0
              );
              
              console.log('✅ Email standard envoyé à l\'admin:', admin.email);
              
              // Email détaillé avec toutes les modifications et infos de paiement
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
          const { data: adminUsers } = await supabase
            .from('profiles')
            .select('email')
            .eq('role', 'admin');

          if (adminUsers && adminUsers.length > 0) {
            for (const admin of adminUsers) {
              await sendHostApplicationReceived(
                admin.email,
                formData.hostFullName,
                formData.hostEmail,
                formData.title,
                formData.propertyType,
                formData.location,
                parseInt(formData.price) || 0
              );
              
              console.log('✅ Email envoyé à l\'admin:', admin.email);
              
              // Envoyer un email avec les informations de paiement
              if (userPaymentInfo) {
                await supabase.functions.invoke('send-email', {
                  body: {
                    type: 'host_application_received',
                    to: admin.email,
                    data: {
                      hostName: formData.hostFullName,
                      hostEmail: formData.hostEmail,
                      propertyTitle: formData.title,
                      propertyType: formData.propertyType,
                      location: formData.location,
                      pricePerNight: parseInt(formData.price) || 0,
                      paymentInfo: userPaymentInfo,
                      message: 'Nouvelle candidature soumise'
                    }
                  }
                });
                console.log('✅ Email avec infos de paiement envoyé à l\'admin:', admin.email);
              }
            }
          } else {
            // Fallback vers l'email admin par défaut
            await sendHostApplicationReceived(
              'admin@akwahome.com',
              formData.hostFullName,
              formData.hostEmail,
              formData.title,
              formData.propertyType,
              formData.location,
              parseInt(formData.price) || 0
            );
            
            // Envoyer un email avec les informations de paiement
            if (userPaymentInfo) {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'host_application_received',
                  to: 'admin@akwahome.com',
                  data: {
                    hostName: formData.hostFullName,
                    hostEmail: formData.hostEmail,
                    propertyTitle: formData.title,
                    propertyType: formData.propertyType,
                    location: formData.location,
                    pricePerNight: parseInt(formData.price) || 0,
                    paymentInfo: userPaymentInfo,
                    message: 'Nouvelle candidature soumise'
                  }
                }
              });
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
            // Naviguer vers le tableau de bord hôte
            navigation.navigate('HostDashboard');
          }}]
        );
      }
    } else {
      Alert.alert('Erreur', isEditMode 
        ? 'Une erreur est survenue lors de la modification de votre candidature.'
        : 'Une erreur est survenue lors de la soumission de votre candidature.');
    }
  };

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

      {/* Localisation */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Localisation *</Text>
        <CitySearchInputModal
          value={formData.location}
          onChange={handleLocationSelect}
          placeholder="Rechercher ville, commune ou quartier..."
        />
        <Text style={styles.helpText}>
          Recherchez votre ville, commune ou quartier avec autocomplétion
        </Text>
      </View>

      {/* Capacité */}
      <View style={styles.row}>
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

      {/* Titre */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Titre de votre annonce *</Text>
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

      {/* Description */}
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

      {/* Prix */}
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

      {/* Indications complémentaires sur l'adresse */}
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
        <Text style={styles.label}>Photos de votre logement</Text>
        <Text style={styles.helpText}>
        <Text style={styles.subtitle}>
          Ajoutez jusqu'à 30 photos pour présenter votre logement
        </Text>
        </Text>
        
        {/* Grille des images */}
        <View style={styles.imageGrid}>
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image
                source={{ uri: image.uri }}
                style={styles.selectedImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={20} color="#ff4444" />
              </TouchableOpacity>
              
              {/* Catégorie actuelle - plus visible */}
              <View style={styles.categoryOverlay}>
                <TouchableOpacity
                  style={styles.categoryButton}
                  onPress={() => openCategoryModal(index)}
                >
                  <Text style={styles.categoryIcon}>{getCategoryIcon(image.category)}</Text>
                  <Text style={styles.categoryLabel}>{getCategoryLabel(image.category)}</Text>
                  <Ionicons name="pencil" size={12} color="#fff" style={styles.editIcon} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          
          {selectedImages.length < 30 && (
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <Ionicons name="camera" size={24} color="#666" />
              <Text style={styles.addImageText}>Ajouter une photo</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Instructions pour la catégorisation */}
        {selectedImages.length > 0 && (
          <View style={styles.categoryInstructions}>
            <Ionicons name="information-circle" size={16} color="#007bff" />
            <Text style={styles.categoryInstructionsText}>
              Appuyez sur la catégorie d'une photo pour la modifier
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

      {/* Expérience */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Expérience en hébergement</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['experience'] = ref; }}
          style={[styles.input, styles.textArea]}
          value={formData.experience}
          onChangeText={(value) => handleInputChange('experience', value)}
          placeholder="Parlez-nous de votre expérience..."
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('experience')}
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
                selectedAmenities.includes(amenity.id) && styles.amenityItemSelected
              ]}
              onPress={() => toggleAmenity(amenity.id)}
            >
              <Text style={[
                styles.amenityText,
                selectedAmenities.includes(amenity.id) && styles.amenityTextSelected
              ]}>
                {amenity.name}
              </Text>
            </TouchableOpacity>
          ))}
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
      </View>

      {/* Règles de la maison */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Règles de la maison</Text>
        <TextInput
          ref={(ref) => { inputRefs.current['houseRules'] = ref; }}
          style={[styles.input, styles.textArea]}
          value={formData.houseRules}
          onChangeText={(value) => handleInputChange('houseRules', value)}
          placeholder="Ex: Pas de fumeurs, pas d'animaux..."
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => handleInputSubmit('houseRules')}
        />
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

        {/* Alerte de vérification d'identité */}
        {!hasUploadedIdentity && !identityUploadedInSession && (
          <View style={styles.identityAlert}>
            <Ionicons 
              name={
                verificationStatus === 'pending' ? 'time-outline' :
                verificationStatus === 'rejected' ? 'close-circle-outline' : 
                'shield-checkmark-outline'
              } 
              size={24} 
              color={
                verificationStatus === 'pending' ? '#f59e0b' :
                verificationStatus === 'rejected' ? '#ef4444' : 
                '#f59e0b'
              } 
            />
            <View style={styles.identityAlertContent}>
              <Text style={styles.identityAlertTitle}>
                {verificationStatus === 'pending' ? 'Vérification en cours' :
                 verificationStatus === 'rejected' ? 'Document refusé' : 
                 'Vérification d\'identité requise'}
              </Text>
              <Text style={styles.identityAlertMessage}>
                {verificationStatus === 'pending' ? 'Votre identité est en cours de vérification. Vous pourrez soumettre votre candidature une fois validée.' :
                 verificationStatus === 'rejected' ? 'Votre document a été refusé. Veuillez télécharger un nouveau document valide.' :
                 'Vous devez vérifier votre identité avant de pouvoir devenir hôte.'}
              </Text>
              <TouchableOpacity 
                style={styles.identityAlertButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.identityAlertButtonText}>
                  {verificationStatus === 'pending' ? 'Voir le statut' :
                   verificationStatus === 'rejected' ? 'Télécharger un nouveau document' :
                   'Vérifier mon identité'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
              style={[styles.nextButton, loading && styles.nextButtonDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextButtonText}>Soumettre</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
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
                <Image
                  source={{ uri: selectedImages[selectedImageForCategory].uri }}
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
  identityAlert: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: 20,
    marginTop: 10,
    alignItems: 'flex-start',
  },
  identityAlertContent: {
    flex: 1,
    marginLeft: 12,
  },
  identityAlertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  identityAlertMessage: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
    marginBottom: 12,
  },
  identityAlertButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  identityAlertButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
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
  textArea: {
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
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  addImageButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  addImageText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
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
});

export default BecomeHostScreen;