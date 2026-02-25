import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Property } from '../types';
import { useBookings } from '../hooks/useBookings';
import { useAuth } from '../services/AuthContext';
import { usePricing, calculateFinalPrice } from '../hooks/usePricing';
import { useEmailService } from '../hooks/useEmailService';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import BookingIdentityAlert from './BookingIdentityAlert';
import { supabase } from '../services/supabase';
import AvailabilityCalendar from './AvailabilityCalendar';
import { getAveragePriceForPeriod } from '../utils/priceCalculator';
import { useLanguage } from '../contexts/LanguageContext';
import { useSearchDatesContext } from '../contexts/SearchDatesContext';
import { useCurrency } from '../hooks/useCurrency';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: number;
  initialChildren?: number;
  initialBabies?: number;
  onDatesChange?: (dates: { checkIn?: string; checkOut?: string; adults?: number; children?: number; babies?: number }) => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ 
  visible, 
  onClose, 
  property,
  initialCheckIn,
  initialCheckOut,
  initialAdults,
  initialChildren,
  initialBabies,
  onDatesChange,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { currency, rates, formatPrice: formatPriceCurrency, formatPriceForPayment } = useCurrency();
  const { createBooking, loading } = useBookings();
  const { sendBookingRequestSent, sendBookingRequest } = useEmailService();
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } = useIdentityVerification();
  const { dates: contextDates, setDates: saveSearchDates } = useSearchDatesContext();
  
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [message, setMessage] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'orange_money' | 'mtn_money' | 'moov_money' | 'wave' | 'paypal' | 'cash'>('card');
  const [paymentPlan, setPaymentPlan] = useState<'full' | 'split'>('full');
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: '',
    cardHolder: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    phoneNumber: '',
    pin: '',
    paypalEmail: ''
  });
  const [effectivePrice, setEffectivePrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState<{
    valid: boolean;
    discountPercentage?: number;
    discountAmount?: number;
    error?: string;
  } | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const lastInitialGuestsRef = useRef<{ adults?: number; children?: number; babies?: number } | null>(null);

  const totalGuests = adults + children + infants;

  // Fonction pour normaliser une date à minuit (évite les problèmes de fuseau horaire)
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Fonction pour formater une date sans problème de fuseau horaire
  const formatDateDisplay = (date: Date): string => {
    const normalized = normalizeDate(date);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const day = String(normalized.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  };

  // Fonction pour formater une date en string ISO sans problème de fuseau horaire (YYYY-MM-DD)
  const formatDateToISOString = (date: Date): string => {
    const normalized = normalizeDate(date);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, '0');
    const day = String(normalized.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 0;
    const diffTime = checkOut.getTime() - checkIn.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Initialiser les valeurs depuis les props OU le context quand le modal s'ouvre
  // Priorité aux props (dates de la route), sinon utiliser le context
  useEffect(() => {
    if (visible) {
      // Utiliser les props en priorité, sinon le context
      const checkInToUse = initialCheckIn || contextDates.checkIn;
      const checkOutToUse = initialCheckOut || contextDates.checkOut;
      const adultsToUse = initialAdults !== undefined ? initialAdults : (contextDates.adults || 1);
      const childrenToUse = initialChildren !== undefined ? initialChildren : (contextDates.children || 0);
      const babiesToUse = initialBabies !== undefined ? initialBabies : (contextDates.babies || 0);
      
      if (__DEV__) console.log('📅 BookingModal - useEffect déclenché:', { 
        visible,
        initialCheckIn, 
        initialCheckOut,
        initialAdults,
        initialChildren,
        initialBabies,
        contextCheckIn: contextDates.checkIn,
        contextCheckOut: contextDates.checkOut,
        contextAdults: contextDates.adults,
        contextChildren: contextDates.children,
        contextBabies: contextDates.babies,
        checkInToUse,
        checkOutToUse,
        adultsToUse,
        childrenToUse,
        babiesToUse,
      });
      
      // Initialiser avec les valeurs finales - normaliser les dates pour éviter les problèmes de fuseau horaire
      if (checkInToUse) {
        try {
          // Parser la date en utilisant les composants pour éviter les problèmes de fuseau horaire
          let initialDate: Date;
          if (typeof checkInToUse === 'string' && checkInToUse.includes('-')) {
            // Format ISO (YYYY-MM-DD) - parser manuellement pour éviter UTC
            const [year, month, day] = checkInToUse.split('-').map(Number);
            initialDate = new Date(year, month - 1, day);
          } else {
            initialDate = new Date(checkInToUse);
          }
          
          if (!isNaN(initialDate.getTime())) {
            const normalizedDate = normalizeDate(initialDate);
            setCheckIn(normalizedDate);
            if (__DEV__) console.log('✅ CheckIn initialisé:', normalizedDate);
          } else {
            if (__DEV__) console.log('❌ Date checkIn invalide:', checkInToUse);
            setCheckIn(null);
          }
        } catch (e) {
          console.error('❌ Erreur parsing checkIn:', e);
          setCheckIn(null);
        }
      } else {
        if (__DEV__) console.log('⚠️ Pas de checkIn disponible');
        setCheckIn(null);
      }
      
      if (checkOutToUse) {
        try {
          // Parser la date en utilisant les composants pour éviter les problèmes de fuseau horaire
          let initialDate: Date;
          if (typeof checkOutToUse === 'string' && checkOutToUse.includes('-')) {
            // Format ISO (YYYY-MM-DD) - parser manuellement pour éviter UTC
            const [year, month, day] = checkOutToUse.split('-').map(Number);
            initialDate = new Date(year, month - 1, day);
          } else {
            initialDate = new Date(checkOutToUse);
          }
          
          if (!isNaN(initialDate.getTime())) {
            const normalizedDate = normalizeDate(initialDate);
            setCheckOut(normalizedDate);
            if (__DEV__) console.log('✅ CheckOut initialisé:', normalizedDate);
          } else {
            if (__DEV__) console.log('❌ Date checkOut invalide:', checkOutToUse);
            setCheckOut(null);
          }
        } catch (e) {
          console.error('❌ Erreur parsing checkOut:', e);
          setCheckOut(null);
        }
      } else {
        if (__DEV__) console.log('⚠️ Pas de checkOut disponible');
        setCheckOut(null);
      }
      
      // Ne réinitialiser les voyageurs que si les valeurs initiales ont changé
      // Cela permet à l'utilisateur de modifier les valeurs sans qu'elles soient réinitialisées
      const currentInitialGuests = {
        adults: initialAdults !== undefined ? initialAdults : (contextDates.adults || 1),
        children: initialChildren !== undefined ? initialChildren : (contextDates.children || 0),
        babies: initialBabies !== undefined ? initialBabies : (contextDates.babies || 0),
      };
      
      // Si c'est la première fois ou si les valeurs initiales ont changé, réinitialiser
      const hasInitialGuestsChanged = 
        !lastInitialGuestsRef.current ||
        lastInitialGuestsRef.current.adults !== currentInitialGuests.adults ||
        lastInitialGuestsRef.current.children !== currentInitialGuests.children ||
        lastInitialGuestsRef.current.babies !== currentInitialGuests.babies;
      
      if (hasInitialGuestsChanged) {
        setAdults(adultsToUse);
        setChildren(childrenToUse);
        setInfants(babiesToUse);
        lastInitialGuestsRef.current = currentInitialGuests;
        if (__DEV__) console.log('✅ Voyageurs initialisés:', { adultsToUse, childrenToUse, babiesToUse });
      } else {
        if (__DEV__) console.log('ℹ️ Voyageurs non réinitialisés (valeurs initiales inchangées, l\'utilisateur peut modifier)');
      }
    }
  }, [visible, initialCheckIn, initialCheckOut, initialAdults, initialChildren, initialBabies, contextDates.checkIn, contextDates.checkOut, contextDates.adults, contextDates.children, contextDates.babies]);

  // Fonction helper pour sauvegarder les dates
  const saveDates = useCallback((checkInDate?: Date | null, checkOutDate?: Date | null, adultsCount?: number, childrenCount?: number, babiesCount?: number) => {
    const checkInStr = checkInDate ? formatDateToISOString(checkInDate) : undefined;
    const checkOutStr = checkOutDate ? formatDateToISOString(checkOutDate) : undefined;
    
    const datesToSave = {
      checkIn: checkInStr,
      checkOut: checkOutStr,
      adults: adultsCount !== undefined ? adultsCount : adults,
      children: childrenCount !== undefined ? childrenCount : children,
      babies: babiesCount !== undefined ? babiesCount : infants,
    };
    
    if (__DEV__) console.log('📅 BookingModal - saveDates appelé avec:', {
      checkInDate,
      checkOutDate,
      checkInStr,
      checkOutStr,
      datesToSave,
    });
    
    // Sauvegarder dans AsyncStorage
    saveSearchDates(datesToSave);
    
    // Notifier le parent (PropertyDetailsScreen)
    if (onDatesChange) {
      if (__DEV__) console.log('📅 BookingModal - Appel de onDatesChange avec:', datesToSave);
      onDatesChange(datesToSave);
    } else {
      if (__DEV__) console.log('⚠️ BookingModal - onDatesChange n\'est pas défini!');
    }
  }, [adults, children, infants, saveSearchDates, onDatesChange]);

  // Charger le prix effectif quand les dates changent
  useEffect(() => {
    const loadEffectivePrice = async () => {
      if (checkIn && checkOut && property.id) {
        setLoadingPrice(true);
        try {
          const avgPrice = await getAveragePriceForPeriod(
            property.id,
            checkIn,
            checkOut,
            property.price_per_night || 0
          );
          setEffectivePrice(avgPrice);
        } catch (error) {
          console.error('Error loading effective price:', error);
          setEffectivePrice(property.price_per_night || 0);
        } finally {
          setLoadingPrice(false);
        }
      } else {
        setEffectivePrice(null);
      }
    };

    loadEffectivePrice();
  }, [checkIn, checkOut, property.id, property.price_per_night]);

  // Sauvegarder les dates et voyageurs quand ils changent
  // Utiliser un ref pour éviter les sauvegardes multiples
  const lastSavedRef = useRef<string>('');
  
  useEffect(() => {
    // Ne sauvegarder que si on a au moins une date ET que le modal est visible
    if (visible && (checkIn || checkOut)) {
      // Utiliser formatDateToISOString pour la clé de comparaison aussi
      const checkInKey = checkIn ? formatDateToISOString(checkIn) : '';
      const checkOutKey = checkOut ? formatDateToISOString(checkOut) : '';
      const key = `${checkInKey}_${checkOutKey}_${adults}_${children}_${infants}`;
      
      // Ne sauvegarder que si les valeurs ont changé
      if (lastSavedRef.current !== key) {
        if (__DEV__) console.log('📅 BookingModal - Sauvegarde des dates (valeurs changées)');
        lastSavedRef.current = key;
        
        // Sauvegarder directement sans passer par saveDates pour éviter la boucle
        // Utiliser formatDateToISOString pour éviter les problèmes de fuseau horaire
        const checkInStr = checkIn ? formatDateToISOString(checkIn) : undefined;
        const checkOutStr = checkOut ? formatDateToISOString(checkOut) : undefined;
        const datesToSave = {
          checkIn: checkInStr,
          checkOut: checkOutStr,
          adults,
          children,
          babies: infants,
        };
        saveSearchDates(datesToSave);
        if (onDatesChange) {
          onDatesChange(datesToSave);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn, checkOut, adults, children, infants, visible]);

  // Fonction pour valider le code promotionnel
  const validateVoucherCode = async (code: string) => {
    if (!code || !code.trim()) {
      setVoucherDiscount(null);
      return;
    }

    if (!user) {
      setVoucherDiscount({
        valid: false,
        error: 'Vous devez être connecté pour utiliser un code promotionnel'
      });
      return;
    }

    setValidatingVoucher(true);
    try {
      const { data, error } = await supabase
        .from('user_discount_vouchers')
        .select('*')
        .eq('voucher_code', code.toUpperCase().trim())
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        setVoucherDiscount({
          valid: false,
          error: 'Code promotionnel invalide ou déjà utilisé'
        });
        return;
      }

      // Vérifier si le code a expiré
      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        setVoucherDiscount({
          valid: false,
          error: 'Ce code promotionnel a expiré'
        });
        return;
      }

      // Code valide
      setVoucherDiscount({
        valid: true,
        discountPercentage: data.discount_percentage,
        discountAmount: data.discount_amount
      });
    } catch (error) {
      console.error('Error validating voucher:', error);
      setVoucherDiscount({
        valid: false,
        error: 'Erreur lors de la validation du code'
      });
    } finally {
      setValidatingVoucher(false);
    }
  };

  // Valider le code quand il change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (voucherCode.trim()) {
        validateVoucherCode(voucherCode);
      } else {
        setVoucherDiscount(null);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherCode, user?.id]);

  const calculateTotal = () => {
    const nights = calculateNights();
    // Utiliser le prix effectif (moyenne des prix dynamiques) si disponible, sinon le prix de base
    const basePrice = effectivePrice !== null ? effectivePrice : (property.price_per_night || 0);
    
    // Configuration de réduction normale
    const discountConfig = {
      enabled: property.discount_enabled || false,
      minNights: property.discount_min_nights || null,
      percentage: property.discount_percentage || null
    };
    
    // Configuration de réduction longue durée
    const longStayDiscountConfig = property.long_stay_discount_enabled ? {
      enabled: property.long_stay_discount_enabled || false,
      minNights: property.long_stay_discount_min_nights || null,
      percentage: property.long_stay_discount_percentage || null
    } : undefined;
    
    if (__DEV__) console.log('🔍 Calcul des prix:', {
      basePrice,
      nights,
      discountConfig,
      longStayDiscountConfig,
      property: {
        discount_enabled: property.discount_enabled,
        discount_min_nights: property.discount_min_nights,
        discount_percentage: property.discount_percentage,
        long_stay_discount_enabled: property.long_stay_discount_enabled,
        long_stay_discount_min_nights: property.long_stay_discount_min_nights,
        long_stay_discount_percentage: property.long_stay_discount_percentage
      }
    });
    
    const pricing = calculateFinalPrice(basePrice, nights, discountConfig, {
      cleaning_fee: property.cleaning_fee,
      service_fee: property.service_fee,
      taxes: property.taxes,
      free_cleaning_min_days: property.free_cleaning_min_days
    }, longStayDiscountConfig, 'property');
    
    // Appliquer la réduction du code promotionnel si valide
    let finalTotal = pricing.finalTotal;
    let voucherDiscountAmount = 0;
    
    if (voucherDiscount?.valid && voucherDiscount.discountPercentage) {
      // Calculer la réduction sur le total (après toutes les autres réductions)
      voucherDiscountAmount = Math.round(finalTotal * (voucherDiscount.discountPercentage / 100));
      finalTotal = finalTotal - voucherDiscountAmount;
    } else if (voucherDiscount?.valid && voucherDiscount.discountAmount) {
      // Réduction fixe
      voucherDiscountAmount = voucherDiscount.discountAmount;
      finalTotal = Math.max(0, finalTotal - voucherDiscountAmount);
    }
    
    if (__DEV__) console.log('💰 Résultat du calcul:', {
      pricing,
      fees,
      finalTotal,
      voucherDiscountAmount
    });
    
    return {
      nights,
      pricing: pricing.pricing,
      fees: pricing.fees,
      finalTotal,
      voucherDiscountAmount,
      voucherApplied: voucherDiscount?.valid || false
    };
  };

  const formatDateForAPI = (date: Date) => {
    // Normaliser la date avant de la formater pour éviter les problèmes de fuseau horaire
    const normalized = normalizeDate(date);
    return formatDateToISOString(normalized);
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour faire une réservation');
      return;
    }

    if (!checkIn || !checkOut) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates d\'arrivée et de départ');
      return;
    }

    const nights = calculateNights();
    const minimumNights = property.minimum_nights || 1;
    
    if (nights < minimumNights) {
      Alert.alert(
        'Durée insuffisante',
        `Cette propriété nécessite un minimum de ${minimumNights} nuit${minimumNights > 1 ? 's' : ''}`
      );
      return;
    }

    if (totalGuests > (property.max_guests || 10)) {
      Alert.alert(
        'Erreur',
        `Le nombre maximum de voyageurs est ${property.max_guests || 10}`
      );
      return;
    }

    // Valider les informations de paiement
    if (!validatePaymentInfo()) {
      return;
    }

    const pricing = calculateTotal();
    
    // Extraire discountAmount et discountApplied depuis pricing.pricing
    // Le discountAmount doit inclure la réduction de la propriété + la réduction du voucher
    const propertyDiscountAmount = pricing.pricing.discountAmount || 0;
    const voucherDiscountAmount = pricing.voucherDiscountAmount || 0;
    const totalDiscountAmount = propertyDiscountAmount + voucherDiscountAmount;
    const discountApplied = pricing.pricing.discountApplied || pricing.voucherApplied || false;
    const originalTotal = pricing.pricing.originalTotal || pricing.finalTotal;
    
    if (__DEV__) console.log('🔍 [BookingModal] Données de réduction:', {
      propertyDiscountAmount,
      voucherDiscountAmount,
      totalDiscountAmount,
      discountApplied,
      originalTotal,
      finalTotal: pricing.finalTotal
    });
    
    const result = await createBooking({
      propertyId: property.id,
      checkInDate: formatDateForAPI(checkIn),
      checkOutDate: formatDateForAPI(checkOut),
      guestsCount: totalGuests,
      adultsCount: adults,
      childrenCount: children,
      infantsCount: infants,
      totalPrice: pricing.finalTotal,
      discountAmount: totalDiscountAmount, // Inclure la réduction totale (propriété + voucher)
      discountApplied: discountApplied,
      originalTotal: originalTotal,
      messageToHost: message.trim() || undefined,
      voucherCode: voucherDiscount?.valid ? voucherCode.trim() : undefined,
      paymentMethod: selectedPaymentMethod,
      paymentPlan: paymentPlan,
    });

    // Vérifier les erreurs d'identité (même logique que le site web)
    if (!result.success && 'error' in result) {
      if (result.error === 'IDENTITY_REQUIRED') {
        Alert.alert(
          'Vérification d\'identité requise',
          'Vous devez envoyer une pièce d\'identité pour effectuer une réservation. Rendez-vous dans votre profil.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (result.error === 'IDENTITY_NOT_VERIFIED') {
        Alert.alert(
          'Identité en cours de vérification',
          'Votre pièce d\'identité est en cours de vérification. Vous pourrez réserver une fois qu\'elle sera validée par notre équipe.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    if (result.success) {
      // Paiement par carte : redirection vers Stripe Checkout (comme sur le site web)
      if (selectedPaymentMethod === 'card' && result.booking?.id) {
        try {
          const body: Record<string, unknown> = {
            booking_id: result.booking.id,
            amount: pricing.finalTotal,
            property_title: property.title,
            check_in: formatDateForAPI(checkIn!),
            check_out: formatDateForAPI(checkOut!),
          };
          if (currency === 'EUR' && rates.EUR) {
            body.currency = 'eur';
            body.rate = rates.EUR;
          }
          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout-session', {
            body,
          });

          if (checkoutError || !checkoutData?.url) {
            console.error('Stripe checkout error:', checkoutError, checkoutData);
            Alert.alert(
              'Paiement',
              'Votre réservation a été créée mais la page de paiement n\'a pas pu s\'ouvrir. Vous pourrez régler plus tard depuis "Mes réservations".',
              [{
                text: 'OK',
                onPress: () => {
                  setCheckIn(null);
                  setCheckOut(null);
                  setAdults(1);
                  setChildren(0);
                  setInfants(0);
                  setMessage('');
                  setVoucherCode('');
                  setVoucherDiscount(null);
                  onClose();
                },
              }]
            );
            return;
          }

          Alert.alert(
            'Paiement sécurisé',
            'Vous allez être redirigé vers la page de paiement Stripe. Une fois le paiement terminé, revenez à l\'application.',
            [
              { text: 'Annuler', style: 'cancel', onPress: () => {} },
              {
                text: 'Ouvrir',
                onPress: () => {
                  Linking.openURL(checkoutData.url);
                  setCheckIn(null);
                  setCheckOut(null);
                  setAdults(1);
                  setChildren(0);
                  setInfants(0);
                  setMessage('');
                  setVoucherCode('');
                  setVoucherDiscount(null);
                  onClose();
                },
              },
            ]
          );
          return;
        } catch (stripeErr) {
          console.error('Stripe checkout error:', stripeErr);
          Alert.alert(
            'Paiement',
            'Votre réservation a été créée mais le paiement n\'a pas pu être initié. Vous pourrez régler depuis "Mes réservations".',
            [{
              text: 'OK',
              onPress: () => {
                setCheckIn(null);
                setCheckOut(null);
                setAdults(1);
                setChildren(0);
                setInfants(0);
                setMessage('');
                setVoucherCode('');
                setVoucherDiscount(null);
                onClose();
              },
            }]
          );
          return;
        }
      }

      // IMPORTANT: Les emails sont maintenant gérés dans useBookings.ts
      // Ne plus envoyer d'emails depuis BookingModal pour éviter les doublons
      const isAutoBooking = property.auto_booking === true;

      Alert.alert(
        isAutoBooking ? 'Réservation confirmée !' : 'Demande envoyée !',
        isAutoBooking
          ? 'Votre réservation a été confirmée automatiquement. Vous recevrez une confirmation par email.'
          : 'Votre demande de réservation a été envoyée au propriétaire. Vous recevrez une notification lorsqu\'il répondra.',
        [{
          text: 'OK',
          onPress: () => {
            setCheckIn(null);
            setCheckOut(null);
            setAdults(1);
            setChildren(0);
            setInfants(0);
            setMessage('');
            setVoucherCode('');
            setVoucherDiscount(null);
            onClose();
          },
        }]
      );
    } else {
      console.error('Erreur de réservation:', result.error || 'Erreur inconnue');
      Alert.alert(
        'Erreur', 
        result.error || 'Une erreur est survenue lors de l\'envoi de votre réservation. Veuillez réessayer.'
      );
    }
  };

  const formatPrice = (price: number, showOriginal?: boolean) =>
    formatPriceCurrency(price, showOriginal ?? false);
  const formatPayment = (price: number) => formatPriceForPayment(price);

  const validatePaymentInfo = () => {
    // Carte : pas de saisie dans l'app, redirection vers Stripe Checkout
    if (selectedPaymentMethod === 'card') {
      return true;
    }
    if (selectedPaymentMethod === 'wave') {
      return true;
    } else if (selectedPaymentMethod === 'paypal') {
      if (!paymentInfo.paypalEmail) {
        Alert.alert('Erreur', 'Veuillez entrer votre email PayPal');
        return false;
      }
      // Validation basique de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(paymentInfo.paypalEmail)) {
        Alert.alert('Erreur', 'Veuillez entrer une adresse email PayPal valide');
        return false;
      }
    } else if (['orange_money', 'mtn_money', 'moov_money'].includes(selectedPaymentMethod)) {
      return true;
    }
    return true;
  };

  const { nights, pricing, fees, finalTotal } = calculateTotal();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('booking.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Informations de la propriété */}
          <View style={styles.propertyInfo}>
            <Text style={styles.propertyTitle}>{property.title}</Text>
            <Text style={styles.propertyLocation}>
              📍 {typeof property.location === 'object' && property.location !== null && 'name' in property.location
                ? (property.location as any).name 
                : typeof property.location === 'string' 
                ? property.location 
                : (property as any).locations?.name || 'Localisation inconnue'}
            </Text>
            <Text style={styles.propertyPrice}>
              {formatPrice(property.price_per_night || 0)}/{t('common.perNight')}
            </Text>
          </View>

          {/* Vérification d'identité - Afficher seulement si pas de document OU document rejeté */}
          {!hasUploadedIdentity || (!isVerified && verificationStatus === 'rejected') ? (
            <View style={styles.identitySection}>
              <BookingIdentityAlert />
            </View>
          ) : null}

          {/* Sélection des dates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('booking.stayDates')}</Text>
            <TouchableOpacity 
              style={styles.dateSelector}
              onPress={() => setShowCalendar(true)}
            >
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>{t('booking.arrival')}</Text>
                <Text style={styles.dateValue}>
                  {checkIn ? formatDateDisplay(checkIn) : t('booking.selectDates')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>{t('booking.departure')}</Text>
                <Text style={styles.dateValue}>
                  {checkOut ? formatDateDisplay(checkOut) : t('booking.selectDates')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Nombre de voyageurs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('booking.guests')}</Text>
            
            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>{t('booking.adults')}</Text>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setAdults(Math.max(1, adults - 1))}
                >
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{adults}</Text>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setAdults(adults + 1)}
                >
                  <Ionicons name="add" size={20} color="#2E7D32" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>{t('booking.children')}</Text>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setChildren(Math.max(0, children - 1))}
                >
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{children}</Text>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setChildren(children + 1)}
                >
                  <Ionicons name="add" size={20} color="#2E7D32" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>{t('booking.infants')}</Text>
              <View style={styles.guestControls}>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setInfants(Math.max(0, infants - 1))}
                >
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{infants}</Text>
                <TouchableOpacity
                  style={styles.guestButton}
                  onPress={() => setInfants(infants + 1)}
                >
                  <Ionicons name="add" size={20} color="#2E7D32" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Code promotionnel */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('booking.voucherCode')}</Text>
            <View style={styles.voucherContainer}>
              <TextInput
                style={[
                  styles.voucherInput,
                  voucherDiscount?.valid && styles.voucherInputValid,
                  voucherDiscount?.valid === false && styles.voucherInputError
                ]}
                placeholder={t('booking.voucherPlaceholder')}
                value={voucherCode}
                onChangeText={(text) => setVoucherCode(text.toUpperCase())}
                autoCapitalize="characters"
                placeholderTextColor="#999"
              />
              {validatingVoucher && (
                <ActivityIndicator size="small" color="#e67e22" style={styles.voucherLoader} />
              )}
              {voucherDiscount?.valid && !validatingVoucher && (
                <Ionicons name="checkmark-circle" size={20} color="#2E7D32" style={styles.voucherIcon} />
              )}
              {voucherDiscount?.valid === false && !validatingVoucher && (
                <Ionicons name="close-circle" size={20} color="#e74c3c" style={styles.voucherIcon} />
              )}
            </View>
            {voucherDiscount?.error && (
              <Text style={styles.voucherError}>{voucherDiscount.error}</Text>
            )}
            {voucherDiscount?.valid && voucherDiscount.discountPercentage && (
              <Text style={styles.voucherSuccess}>
                {t('booking.voucherValid')} {voucherDiscount.discountPercentage}% {t('booking.voucherApplied')}
              </Text>
            )}
            {voucherDiscount?.valid && voucherDiscount.discountAmount && (
              <Text style={styles.voucherSuccess}>
                {t('booking.voucherValid')} {formatPrice(voucherDiscount.discountAmount)} {t('booking.voucherApplied')}
              </Text>
            )}
          </View>

          {/* Message à l'hôte */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('booking.messageToHost')}</Text>
            <TextInput
              style={styles.messageInput}
              placeholder={t('booking.messagePlaceholder')}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Plan de paiement - Affiché après sélection des dates */}
          {checkIn && checkOut && nights > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.paymentPlan')}</Text>
              <View style={styles.paymentPlanContainer}>
                <TouchableOpacity
                  style={[
                    styles.paymentPlanOption,
                    paymentPlan === 'full' && styles.paymentPlanSelected
                  ]}
                  onPress={() => {
                    setPaymentPlan('full');
                    // Si espèces est sélectionné et on passe à full, on peut garder espèces
                  }}
                >
                  <View style={styles.paymentPlanContent}>
                    <Ionicons 
                      name="card" 
                      size={24} 
                      color={paymentPlan === 'full' ? '#2E7D32' : '#666'} 
                    />
                    <View style={styles.paymentPlanInfo}>
                      <Text style={[
                        styles.paymentPlanTitle,
                        paymentPlan === 'full' && styles.paymentPlanTitleSelected
                      ]}>
                        {t('booking.payFull')}
                      </Text>
                      <Text style={styles.paymentPlanDescription}>
                        {t('booking.payFullDesc')}
                      </Text>
                      <Text style={styles.paymentPlanAmount}>
                        {formatPayment(finalTotal)} {t('common.now')}
                      </Text>
                    </View>
                    {paymentPlan === 'full' && (
                      <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentPlanOption,
                    paymentPlan === 'split' && styles.paymentPlanSelected,
                    selectedPaymentMethod === 'cash' && styles.paymentPlanDisabled
                  ]}
                  onPress={() => {
                    if (selectedPaymentMethod === 'cash') {
                      Alert.alert(
                        t('common.error'),
                        t('booking.splitNotAvailableCash')
                      );
                      return;
                    }
                    setPaymentPlan('split');
                    // Si espèces était sélectionné, changer pour carte
                    if (selectedPaymentMethod === 'cash') {
                      setSelectedPaymentMethod('card');
                    }
                  }}
                  disabled={selectedPaymentMethod === 'cash'}
                >
                  <View style={styles.paymentPlanContent}>
                    <Ionicons 
                      name="calendar" 
                      size={24} 
                      color={paymentPlan === 'split' && selectedPaymentMethod !== 'cash' ? '#2E7D32' : '#666'} 
                    />
                    <View style={styles.paymentPlanInfo}>
                      <Text style={[
                        styles.paymentPlanTitle,
                        paymentPlan === 'split' && styles.paymentPlanTitleSelected
                      ]}>
                        {t('booking.paySplit')}
                      </Text>
                      <Text style={styles.paymentPlanDescription}>
                        {t('booking.paySplitDesc')}
                      </Text>
                      <Text style={styles.paymentPlanAmount}>
                        50% {t('common.now')} ({formatPayment(finalTotal * 0.5)}), 50% {t('booking.onArrival')}
                      </Text>
                    </View>
                    {paymentPlan === 'split' && selectedPaymentMethod !== 'cash' && (
                      <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Méthode de paiement - Affiché avant le résumé */}
          {checkIn && checkOut && nights > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.paymentMethod')}</Text>
              
              {/* Bouton pour ouvrir la pop-up de sélection */}
              <TouchableOpacity
                style={styles.paymentMethodSelector}
                onPress={() => setShowPaymentMethodModal(true)}
              >
                <View style={styles.paymentMethodSelectorContent}>
                  {selectedPaymentMethod === 'card' && (
                    <>
                      <Ionicons name="card" size={24} color="#2563eb" />
                      <Text style={styles.paymentMethodSelectorText}>Carte bancaire</Text>
                    </>
                  )}
                  {selectedPaymentMethod === 'orange_money' && (
                    <>
                      <Ionicons name="phone-portrait" size={24} color="#f97316" />
                      <Text style={styles.paymentMethodSelectorText}>Orange Money</Text>
                    </>
                  )}
                  {selectedPaymentMethod === 'mtn_money' && (
                    <>
                      <Ionicons name="phone-portrait" size={24} color="#eab308" />
                      <Text style={styles.paymentMethodSelectorText}>MTN Money</Text>
                    </>
                  )}
                  {selectedPaymentMethod === 'moov_money' && (
                    <>
                      <Ionicons name="phone-portrait" size={24} color="#3b82f6" />
                      <Text style={styles.paymentMethodSelectorText}>Moov Money</Text>
                    </>
                  )}
                  {selectedPaymentMethod === 'wave' && (
                    <>
                      <Ionicons name="phone-portrait" size={24} color="#8b5cf6" />
                      <Text style={styles.paymentMethodSelectorText}>Wave</Text>
                    </>
                  )}
                  {selectedPaymentMethod === 'paypal' && (
                    <>
                      <Ionicons name="globe" size={24} color="#0070ba" />
                      <Text style={styles.paymentMethodSelectorText}>PayPal</Text>
                    </>
                  )}
                  {selectedPaymentMethod === 'cash' && (
                    <>
                      <Ionicons name="cash" size={24} color="#6b7280" />
                      <Text style={styles.paymentMethodSelectorText}>Espèces</Text>
                    </>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>

              {/* Informations de paiement - Affiché juste en dessous de la méthode sélectionnée */}
              {selectedPaymentMethod === 'card' && (
                <View style={styles.paymentInfoContainer}>
                  <View style={styles.securityInfo}>
                    <Ionicons name="card" size={20} color="#2563eb" />
                    <Text style={styles.securityText}>
                      Paiement sécurisé par Stripe. Après confirmation de la réservation, vous serez redirigé vers la page Stripe pour saisir votre carte (Visa, Mastercard).
                    </Text>
                  </View>
                </View>
              )}

              {selectedPaymentMethod === 'wave' && (
                <View style={styles.paymentInfoContainer}>
                  <View style={styles.securityInfo}>
                    <Ionicons name="shield-checkmark" size={20} color="#8b5cf6" />
                    <Text style={styles.securityText}>
                      Vous serez redirigé vers un paiement sécurisé via Wave pour finaliser votre réservation.
                    </Text>
                  </View>
                </View>
              )}

              {/* Informations de paiement pour PayPal - Affiché juste en dessous */}
              {selectedPaymentMethod === 'paypal' && (
                <View style={styles.paymentInfoContainer}>
                  <Text style={styles.paymentInfoTitle}>Informations de paiement</Text>
                  <View style={styles.paymentForm}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email PayPal *</Text>
                        <TextInput
                        style={styles.input}
                        placeholder="votre.email@example.com"
                        value={paymentInfo.paypalEmail}
                        onChangeText={(value) => setPaymentInfo(prev => ({ ...prev, paypalEmail: value }))}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View style={styles.paypalInfoBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#0070ba" />
                      <Text style={styles.paypalInfoText}>
                        Vous serez redirigé vers PayPal pour finaliser le paiement de manière sécurisée. Sans frais d'envoi.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {(selectedPaymentMethod === 'orange_money' || selectedPaymentMethod === 'mtn_money' || selectedPaymentMethod === 'moov_money') && (
                <View style={styles.paymentInfoContainer}>
                  <View style={styles.securityInfo}>
                    <Ionicons name="shield-checkmark" size={20} color={selectedPaymentMethod === 'orange_money' ? '#f97316' : selectedPaymentMethod === 'mtn_money' ? '#eab308' : '#3b82f6'} />
                    <Text style={styles.securityText}>
                      Vous serez redirigé vers un paiement sécurisé via {selectedPaymentMethod === 'orange_money' ? 'Orange Money' : selectedPaymentMethod === 'mtn_money' ? 'MTN Money' : 'Moov Money'} pour finaliser votre réservation.
                    </Text>
                  </View>
                </View>
              )}

              {/* Informations pour espèces - Affiché juste en dessous */}
              {selectedPaymentMethod === 'cash' && (
                <View style={styles.paymentInfoContainer}>
                  <Text style={styles.paymentInfoTitle}>Informations de paiement</Text>
                  <View style={styles.paymentForm}>
                    <View style={styles.cashInfo}>
                      <Ionicons name="cash" size={48} color="#6b7280" />
                      <Text style={styles.cashTitle}>Paiement en espèces</Text>
                      <Text style={styles.cashDescription}>
                        Vous paierez directement à l'hôte lors de votre arrivée. 
                        Assurez-vous d'avoir le montant exact en espèces.
                      </Text>
                      <View style={styles.cashAmount}>
                        <Text style={styles.cashAmountLabel}>Montant à payer :</Text>
                        <Text style={styles.cashAmountValue}>{formatPayment(finalTotal)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Résumé des prix */}
          {checkIn && checkOut && nights > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('booking.priceSummary')}</Text>
                <View style={styles.priceBreakdown}>
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.priceLabel}>
                      {formatPayment(effectivePrice !== null ? effectivePrice : (property.price_per_night || 0))} × {nights} nuit{nights > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.priceValue}>{formatPayment(pricing.originalTotal)}</Text>
                </View>
                
                {pricing.discountApplied && (
                  <View style={styles.priceRow}>
                    <Text style={styles.discountLabel}>
                      {pricing.discountType === 'long_stay' 
                        ? `Réduction long séjour (${property.long_stay_discount_percentage}% pour ${property.long_stay_discount_min_nights}+ nuits)`
                        : `Réduction (${property.discount_percentage}% pour ${property.discount_min_nights}+ nuits)`
                      }
                    </Text>
                    <Text style={styles.discountValue}>-{formatPayment(pricing.discountAmount)}</Text>
                  </View>
                )}
                
                {fees.cleaningFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{t('booking.cleaningFee')}</Text>
                    <Text style={styles.priceValue}>{formatPayment(fees.cleaningFee)}</Text>
                  </View>
                )}
                
                {fees.serviceFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{t('booking.serviceFee')}</Text>
                    <Text style={styles.priceValue}>{formatPayment(fees.serviceFee)}</Text>
                  </View>
                )}
                
                {fees.taxes > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>{t('booking.taxes')}</Text>
                    <Text style={styles.priceValue}>{formatPayment(fees.taxes)}</Text>
                  </View>
                )}
                
                {voucherDiscount?.valid && (voucherDiscount.discountPercentage || voucherDiscount.discountAmount) && (
                  <View style={styles.priceRow}>
                    <Text style={styles.discountLabel}>
                      Réduction code promo
                    </Text>
                    <Text style={styles.discountValue}>-{formatPayment(
                      voucherDiscount.discountPercentage 
                        ? Math.round((pricing.totalPrice + fees.totalFees) * (voucherDiscount.discountPercentage / 100))
                        : (voucherDiscount.discountAmount || 0)
                    )}</Text>
                  </View>
                )}
                
                <View style={[styles.priceRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>{t('booking.total')}</Text>
                  <Text style={styles.totalValue}>{formatPayment(finalTotal)}</Text>
                </View>
              </View>
            </View>
          )}

        </ScrollView>

        {/* Bouton de réservation */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.bookButton, 
              (loading || identityLoading || !hasUploadedIdentity || (!isVerified && verificationStatus !== 'pending')) && styles.bookButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={loading || identityLoading || !hasUploadedIdentity || (!isVerified && verificationStatus !== 'pending')}
          >
            {loading || identityLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.bookButtonText}>
                {!hasUploadedIdentity
                  ? t('booking.identityRequired')
                  : hasUploadedIdentity && !isVerified && verificationStatus === 'rejected'
                    ? 'Identité rejetée'
                    : selectedPaymentMethod === 'cash'
                      ? t('booking.confirmBooking')
                      : selectedPaymentMethod === 'paypal'
                        ? property.auto_booking 
                          ? t('booking.payWithPaypalAndBook')
                          : t('booking.payWithPaypal')
                        : paymentPlan === 'split'
                          ? `${t('booking.pay')} ${formatPayment(finalTotal * 0.5)} ${t('common.now')}`
                          : property.auto_booking 
                            ? t('booking.payAndBook')
                            : t('booking.sendRequest')
                }
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Calendrier de disponibilité */}
      {showCalendar && (
        <Modal
          visible={showCalendar}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCalendar(false)}
        >
          <AvailabilityCalendar
            propertyId={property.id}
            selectedCheckIn={checkIn}
            selectedCheckOut={checkOut}
            onDateSelect={(checkInDate, checkOutDate) => {
              // Normaliser les dates à minuit pour éviter les problèmes de fuseau horaire
              const normalizedCheckIn = checkInDate ? normalizeDate(checkInDate) : null;
              const normalizedCheckOut = checkOutDate ? normalizeDate(checkOutDate) : null;
              setCheckIn(normalizedCheckIn);
              setCheckOut(normalizedCheckOut);
              // La sauvegarde sera faite automatiquement par le useEffect
            }}
            onClose={() => setShowCalendar(false)}
          />
        </Modal>
      )}

      {/* Modal de sélection de méthode de paiement */}
      <Modal
        visible={showPaymentMethodModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentMethodModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPaymentMethodModal(false)} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('booking.paymentMethod')}</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.paymentMethods}>
              {/* Carte bancaire */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'card' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('card');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                  setShowPaymentMethodModal(false);
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="card" size={24} color="#2563eb" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Carte bancaire</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Visa, Mastercard, American Express
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'card' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'card' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Orange Money */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'orange_money' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('orange_money');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                  setShowPaymentMethodModal(false);
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#f97316" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Orange Money</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile Orange
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'orange_money' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'orange_money' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* MTN Money */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'mtn_money' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('mtn_money');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                  setShowPaymentMethodModal(false);
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#eab308" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>MTN Money</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile MTN
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'mtn_money' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'mtn_money' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Moov Money */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'moov_money' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('moov_money');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                  setShowPaymentMethodModal(false);
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#3b82f6" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Moov Money</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile Moov
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'moov_money' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'moov_money' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Wave */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'wave' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('wave');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: ''
                  });
                  setShowPaymentMethodModal(false);
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="phone-portrait" size={24} color="#8b5cf6" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Wave</Text>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement mobile Wave
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'wave' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'wave' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* PayPal */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'paypal' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('paypal');
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: '',
                    paypalEmail: ''
                  });
                  setShowPaymentMethodModal(false);
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="globe" size={24} color="#0070ba" />
                  <View style={styles.paymentMethodInfo}>
                    <View style={styles.paypalHeader}>
                      <Text style={styles.paymentMethodTitle}>PayPal</Text>
                      <View style={styles.recommendedBadge}>
                        <Ionicons name="star" size={10} color="#FFD700" />
                        <Text style={styles.recommendedText}>Recommandé</Text>
                      </View>
                    </View>
                    <Text style={styles.paymentMethodDescription}>
                      Paiement sécurisé via PayPal
                    </Text>
                    <Text style={styles.paypalNote}>
                      💡 Sans frais d'envoi
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'paypal' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'paypal' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>

              {/* Espèces */}
              <TouchableOpacity
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === 'cash' && styles.paymentMethodSelected
                ]}
                onPress={() => {
                  setSelectedPaymentMethod('cash');
                  setPaymentPlan('full'); // Espèces = paiement complet à l'arrivée
                  setPaymentInfo({
                    cardNumber: '',
                    cardHolder: '',
                    expiryMonth: '',
                    expiryYear: '',
                    cvv: '',
                    phoneNumber: '',
                    pin: '',
                    paypalEmail: ''
                  });
                  setShowPaymentMethodModal(false);
                }}
              >
                <View style={styles.paymentMethodContent}>
                  <Ionicons name="cash" size={24} color="#6b7280" />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={styles.paymentMethodTitle}>Espèces</Text>
                    <Text style={styles.paymentMethodDescription}>
                      {t('booking.payFullOnArrival')} ({formatPayment(finalTotal)})
                    </Text>
                  </View>
                </View>
                <Ionicons 
                  name={selectedPaymentMethod === 'cash' ? 'checkmark-circle' : 'ellipse-outline'} 
                  size={20} 
                  color={selectedPaymentMethod === 'cash' ? '#e67e22' : '#ccc'} 
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Modal>
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
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  propertyInfo: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  propertyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  identitySection: {
    marginHorizontal: 20,
    marginVertical: 10,
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dateValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  guestLabel: {
    fontSize: 16,
    color: '#333',
  },
  guestControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  guestButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 20,
    textAlign: 'center',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    textAlignVertical: 'top',
  },
  voucherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  voucherInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    paddingRight: 40,
  },
  voucherInputValid: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0f9f0',
  },
  voucherInputError: {
    borderColor: '#e74c3c',
    backgroundColor: '#fff5f5',
  },
  voucherLoader: {
    position: 'absolute',
    right: 12,
  },
  voucherIcon: {
    position: 'absolute',
    right: 12,
  },
  voucherError: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 4,
  },
  voucherSuccess: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 4,
    fontWeight: '500',
  },
  priceBreakdown: {
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333',
  },
  discountLabel: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  // Styles pour les plans de paiement
  paymentPlanContainer: {
    gap: 12,
  },
  paymentPlanOption: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
  },
  paymentPlanSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#f0f9f0',
  },
  paymentPlanContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentPlanInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentPlanTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paymentPlanTitleSelected: {
    color: '#2E7D32',
  },
  paymentPlanDescription: {
    fontSize: 14,
    color: '#666',
  },
  paymentPlanAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 4,
  },
  paymentPlanDisabled: {
    opacity: 0.5,
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
  // Styles pour les options de paiement
  paymentMethods: {
    gap: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  paymentMethodSelected: {
    borderColor: '#e67e22',
    backgroundColor: '#fef7f0',
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paypalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#856404',
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  paypalNote: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
    marginTop: 2,
  },
  paypalInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0070ba',
  },
  paypalInfoText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#0070ba',
    flex: 1,
    lineHeight: 18,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  securityText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  // Styles pour les formulaires de paiement
  paymentForm: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  selectContainer: {
    flex: 1,
  },
  // Styles pour le paiement en espèces
  cashInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cashTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
  },
  cashDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  cashAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cashAmountLabel: {
    fontSize: 16,
    color: '#374151',
    marginRight: 8,
  },
  cashAmountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  bookButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: '#ccc',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Styles pour le sélecteur de méthode de paiement
  paymentMethodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  paymentMethodSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentMethodSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  // Styles pour le modal de sélection de méthode de paiement
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
});

export default BookingModal;
