import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Booking } from '../hooks/useBookings';
import { useBookingModifications, BookingModificationRequest } from '../hooks/useBookingModifications';
import { useAuth } from '../services/AuthContext';
import AvailabilityCalendar from './AvailabilityCalendar';
import { getAveragePriceForPeriod } from '../utils/priceCalculator';
import ModificationSurplusPaymentModal from './ModificationSurplusPaymentModal';
import { calculateTotalPrice, calculateFees } from '../hooks/usePricing';
import { getCommissionRates } from '../lib/commissions';
import { supabase } from '../services/supabase';
import { useCurrency } from '../contexts/CurrencyContext';

interface BookingModificationModalProps {
  visible: boolean;
  onClose: () => void;
  booking: Booking;
  onModificationRequested?: () => void;
}

const BookingModificationModal: React.FC<BookingModificationModalProps> = ({
  visible,
  onClose,
  booking,
  onModificationRequested,
}) => {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { createModificationRequest, getBookingPendingRequest, cancelModificationRequest, loading } = useBookingModifications();
  
  // Initialiser les dates directement depuis booking
  const [checkIn, setCheckIn] = useState<Date | null>(() => {
    try {
      return booking.check_in_date ? new Date(booking.check_in_date) : null;
    } catch {
      return null;
    }
  });
  const [checkOut, setCheckOut] = useState<Date | null>(() => {
    try {
      return booking.check_out_date ? new Date(booking.check_out_date) : null;
    } catch {
      return null;
    }
  });
  const [guestsCount, setGuestsCount] = useState(booking.guests_count);
  const [message, setMessage] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'checkIn' | 'checkOut' | 'both'>('both');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<BookingModificationRequest | null>(null);
  const [checkingPending, setCheckingPending] = useState(true);
  const [effectivePrice, setEffectivePrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingModificationData, setPendingModificationData] = useState<any>(null);
  /** Surplus affiché quand on ajoute des nuits (calculé sur les nuits ajoutées uniquement) */
  const [extensionSurplus, setExtensionSurplus] = useState<number | null>(null);
  const [extensionSurplusLoading, setExtensionSurplusLoading] = useState(false);
  const [finalTotalPrice, setFinalTotalPrice] = useState<number | null>(null);
  const [surplusBreakdown, setSurplusBreakdown] = useState<{
    basePriceDiff?: number;
    discountDiff?: number;
    cleaningFeeDiff?: number;
    serviceFeeDiff?: number;
    serviceFeeHTDiff?: number;
    serviceFeeVATDiff?: number;
    taxesDiff?: number;
  } | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  /** Déduit le sous-total (après réduction) du total payé, pour garder le même prix/nuit sur les nuits existantes */
  const inferOriginalSubtotal = (
    totalPrice: number,
    nights: number,
    prop: { cleaning_fee?: number; taxes?: number; free_cleaning_min_days?: number | null }
  ): number => {
    const total = Number(totalPrice);
    const isFreeCleaning = prop.free_cleaning_min_days != null && nights >= prop.free_cleaning_min_days;
    const cleaning = isFreeCleaning ? 0 : (prop.cleaning_fee || 0);
    const taxes = (prop.taxes || 0) * nights;
    const serviceFeeRate = 0.12 * 1.2; // 12% HT + 20% TVA
    return Math.round((total - cleaning - taxes) / (1 + serviceFeeRate));
  };

  const property = booking.properties;
  const pricePerNight = property?.price_per_night || 0;
  const cleaningFee = property?.cleaning_fee || 0;
  const serviceFee = property?.service_fee || 0;
  const maxGuests = property?.max_guests || 10;
  const minimumNights = property?.minimum_nights || 1;

  useEffect(() => {
    if (visible) {
      const checkInDate = new Date(booking.check_in_date);
      const checkOutDate = new Date(booking.check_out_date);
      // S'assurer que les dates sont valides
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        console.error('❌ Dates invalides:', { checkInDate, checkOutDate, booking });
        Alert.alert('Erreur', 'Les dates de réservation sont invalides');
        return;
      }
      setCheckIn(checkInDate);
      setCheckOut(checkOutDate);
      setGuestsCount(booking.guests_count);
      setMessage('');
      setShowCalendar(false); // S'assurer que le calendrier est fermé
      setCalendarMode('both'); // Réinitialiser le mode calendrier
      checkPendingRequest();
      console.log('📅 Dates initialisées:', { checkInDate, checkOutDate, guestsCount: booking.guests_count, propertyId: property?.id });
    } else {
      // Réinitialiser quand le modal se ferme
      setShowCalendar(false);
      setCalendarMode('both');
    }
  }, [visible, booking]);
  
  // Log pour déboguer l'état de showCalendar
  useEffect(() => {
    console.log('📅 État showCalendar:', showCalendar);
  }, [showCalendar]);

  // Calculer les dates effectives pour le calcul du prix
  const effectiveCheckInForPrice = checkIn || new Date(booking.check_in_date);
  const effectiveCheckOutForPrice = checkOut || new Date(booking.check_out_date);

  useEffect(() => {
    const loadEffectivePrice = async () => {
      if (property?.id) {
        setLoadingPrice(true);
        try {
          // Utiliser les dates effectives (modifiées ou originales) pour calculer le prix
          const avgPrice = await getAveragePriceForPeriod(
            property.id,
            effectiveCheckInForPrice,
            effectiveCheckOutForPrice,
            pricePerNight
          );
          setEffectivePrice(avgPrice);
        } catch (error) {
          console.error('Error loading effective price:', error);
          setEffectivePrice(pricePerNight);
        } finally {
          setLoadingPrice(false);
        }
      } else {
        setEffectivePrice(null);
      }
    };

    loadEffectivePrice();
  }, [effectiveCheckInForPrice, effectiveCheckOutForPrice, property?.id, pricePerNight]);

  const checkPendingRequest = async () => {
    setCheckingPending(true);
    const pending = await getBookingPendingRequest(booking.id);
    setHasPendingRequest(!!pending);
    setPendingRequest(pending);
    setCheckingPending(false);
  };

  // Fonctions utilitaires pour le formatage des dates (définies en premier)
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateForAPI = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Utiliser les dates actuelles si elles ne sont pas modifiées
  const effectiveCheckIn = checkIn || new Date(booking.check_in_date);
  const effectiveCheckOut = checkOut || new Date(booking.check_out_date);
  
  const calculateNights = () => {
    if (!effectiveCheckIn || !effectiveCheckOut) return 0;
    const diffTime = effectiveCheckOut.getTime() - effectiveCheckIn.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };
  
  const nights = calculateNights();
  const originalNights = Math.ceil(
    (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) 
    / (1000 * 60 * 60 * 24)
  );
  const isExtension = nights > originalNights && checkOut != null && formatDateForAPI(checkOut) > booking.check_out_date;

  // Calcul du surplus quand on ajoute des nuits uniquement (pas de re-tarification des nuits déjà payées)
  useEffect(() => {
    if (!property?.id || !isExtension || nights <= originalNights) {
      setExtensionSurplus(null);
      return;
    }
    let cancelled = false;
    setExtensionSurplusLoading(true);
    setExtensionSurplus(null);
    (async () => {
      try {
        const addedNights = nights - originalNights;
        const originalSubtotal = inferOriginalSubtotal(Number(booking.total_price), originalNights, property);
        const addedEnd = new Date(booking.check_out_date);
        addedEnd.setDate(addedEnd.getDate() + addedNights - 1);
        const addedAvg = await getAveragePriceForPeriod(
          property.id,
          new Date(booking.check_out_date),
          addedEnd,
          pricePerNight
        );
        const discountConfig = {
          enabled: property.discount_enabled || false,
          minNights: property.discount_min_nights || null,
          percentage: property.discount_percentage || null
        };
        const longStayConfig = property.long_stay_discount_enabled ? {
          enabled: property.long_stay_discount_enabled || false,
          minNights: property.long_stay_discount_min_nights || null,
          percentage: property.long_stay_discount_percentage || null
        } : undefined;
        const addedPricing = calculateTotalPrice(addedAvg, addedNights, discountConfig, longStayConfig);
        const addedSubtotalAfterDiscount = addedPricing.totalPrice;
        const newSubtotal = originalSubtotal + addedSubtotalAfterDiscount;
        const newFees = calculateFees(newSubtotal, nights, 'property', {
          cleaning_fee: cleaningFee,
          service_fee: serviceFee,
          taxes: property.taxes || 0,
          free_cleaning_min_days: property.free_cleaning_min_days || null
        });
        const surplus = newSubtotal + newFees.totalFees - Number(booking.total_price);
        if (!cancelled && surplus >= 0) setExtensionSurplus(Math.round(surplus));
      } catch (e) {
        if (!cancelled) setExtensionSurplus(null);
      } finally {
        if (!cancelled) setExtensionSurplusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isExtension, nights, originalNights, booking.check_out_date, booking.total_price, property, pricePerNight, cleaningFee, serviceFee]);

  // Calculer le prix correctement avec réductions et TVA
  const basePricePerNight = effectivePrice || pricePerNight;
  const discountConfig = property ? {
    enabled: property.discount_enabled || false,
    minNights: property.discount_min_nights || null,
    percentage: property.discount_percentage || null
  } : { enabled: false, minNights: null, percentage: null };
  
  const longStayDiscountConfig = property?.long_stay_discount_enabled ? {
    enabled: property.long_stay_discount_enabled || false,
    minNights: property.long_stay_discount_min_nights || null,
    percentage: property.long_stay_discount_percentage || null
  } : undefined;
  
  const pricing = calculateTotalPrice(basePricePerNight, nights, discountConfig, longStayDiscountConfig);
  const priceAfterDiscount = pricing.totalPrice;
  
  // Calculer les frais avec TVA
  const fees = calculateFees(priceAfterDiscount, nights, 'property', {
    cleaning_fee: cleaningFee,
    service_fee: serviceFee,
    taxes: property?.taxes || 0,
    free_cleaning_min_days: property?.free_cleaning_min_days || null
  });
  
  const newTotalPrice = priceAfterDiscount + fees.totalFees;

  // Vérifier s'il y a des changements (dates ou nombre de voyageurs)
  const checkInChanged = checkIn && formatDateForAPI(checkIn) !== booking.check_in_date;
  const checkOutChanged = checkOut && formatDateForAPI(checkOut) !== booking.check_out_date;
  const guestsChanged = guestsCount !== booking.guests_count;
  
  const hasChanges = checkInChanged || checkOutChanged || guestsChanged;

  const originalTotal = Number(booking.total_price);
  const rawPriceDiff = (isExtension && extensionSurplus !== null)
    ? extensionSurplus
    : (newTotalPrice - originalTotal);
  // Quand on réduit les nuits : jamais de surplus à afficher (réduction = pas de paiement supplémentaire)
  const priceDifference = (!isExtension && nights < originalNights && rawPriceDiff > 0) ? 0 : rawPriceDiff;

  const handleDateSelect = (selectedCheckIn: Date | null, selectedCheckOut: Date | null) => {
    if (selectedCheckIn) {
      setCheckIn(selectedCheckIn);
    }
    if (selectedCheckOut) {
      setCheckOut(selectedCheckOut);
    }
  };

  const handleSubmit = async () => {
    // Fermer le clavier avant de soumettre
    Keyboard.dismiss();
    
    // Vérifier si une demande est déjà en cours
    if (hasPendingRequest) {
      Alert.alert(
        'Demande en cours',
        'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse de l\'hôte ou annuler la demande existante.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!user || !property?.host_id || !hasChanges) {
      return;
    }

    // Utiliser les dates actuelles si elles ne sont pas modifiées
    const finalCheckIn = checkIn || new Date(booking.check_in_date);
    const finalCheckOut = checkOut || new Date(booking.check_out_date);

    // Vérifier que les dates sont valides
    if (finalCheckOut <= finalCheckIn) {
      console.log('❌ [BookingModificationModal] Date de départ <= date d\'arrivée');
      Alert.alert('Erreur', 'La date de départ doit être après la date d\'arrivée');
      return;
    }

    const finalNights = Math.ceil(
      (finalCheckOut.getTime() - finalCheckIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log('📊 [BookingModificationModal] Calcul durée:', {
      finalNights,
      minimumNights,
      originalNights: Math.ceil(
        (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) 
        / (1000 * 60 * 60 * 24)
      ),
    });

    if (finalNights < 1) {
      console.log('❌ [BookingModificationModal] Durée < 1 nuit');
      Alert.alert('Erreur', 'La date de départ doit être après la date d\'arrivée');
      return;
    }

    // ✅ Vérifier le minimum de nuits requis
    if (finalNights < minimumNights) {
      console.log('❌ [BookingModificationModal] Durée < minimum_nights:', {
        finalNights,
        minimumNights,
      });
      Alert.alert(
        'Durée insuffisante',
        `Cette propriété nécessite un minimum de ${minimumNights} nuit${minimumNights > 1 ? 's' : ''}`
      );
      return;
    }

    if (guestsCount > maxGuests) {
      console.log('❌ [BookingModificationModal] Nombre de voyageurs > max:', {
        guestsCount,
        maxGuests,
      });
      Alert.alert('Erreur', `Le nombre maximum de voyageurs est ${maxGuests}`);
      return;
    }
    
    console.log('✅ [BookingModificationModal] Validations de base OK');

    // ✅ Vérifier la disponibilité des nouvelles dates (en excluant la réservation actuelle)
    // IMPORTANT: On exclut booking.id pour permettre de reporter la date d'arrivée ou raccourcir la date de départ
    // sans que la réservation actuelle soit considérée comme un conflit
    try {
      const { supabase } = await import('../services/supabase');
      const checkInDateStr = formatDateForAPI(finalCheckIn);
      const checkOutDateStr = formatDateForAPI(finalCheckOut);
      
      console.log('🔍 [BookingModificationModal] Vérification disponibilité:', {
        bookingId: booking.id,
        propertyId: property.id,
        originalCheckIn: booking.check_in_date,
        originalCheckOut: booking.check_out_date,
        newCheckIn: checkInDateStr,
        newCheckOut: checkOutDateStr,
        finalCheckIn: finalCheckIn.toISOString(),
        finalCheckOut: finalCheckOut.toISOString(),
      });
      
      // Vérifier les conflits avec d'autres réservations (pending ou confirmed)
      // On exclut booking.id pour permettre la modification de sa propre réservation
      const { data: conflictingBookings, error: conflictError } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date, status')
        .eq('property_id', property.id)
        .in('status', ['pending', 'confirmed'])
        .neq('id', booking.id) // ✅ EXCLURE la réservation actuelle pour permettre reporter/raccourcir
        .gte('check_out_date', new Date().toISOString().split('T')[0]) // Seulement les réservations futures
        .or(`and(check_in_date.lt.${checkOutDateStr},check_out_date.gt.${checkInDateStr})`);

      console.log('🔍 [BookingModificationModal] Résultat vérification disponibilité:', {
        conflictError: conflictError ? {
          message: conflictError.message,
          code: conflictError.code,
          details: conflictError.details,
          hint: conflictError.hint,
        } : null,
        conflictingBookingsCount: conflictingBookings?.length || 0,
        conflictingBookings: conflictingBookings?.map(b => ({
          id: b.id,
          check_in_date: b.check_in_date,
          check_out_date: b.check_out_date,
          status: b.status,
        })) || [],
      });

      if (conflictError) {
        console.error('❌ [BookingModificationModal] Erreur vérification disponibilité:', conflictError);
        Alert.alert('Erreur', 'Impossible de vérifier la disponibilité. Veuillez réessayer.');
        return;
      }

      if (conflictingBookings && conflictingBookings.length > 0) {
        console.log('⚠️ [BookingModificationModal] Conflit détecté avec:', conflictingBookings);
        Alert.alert('Dates non disponibles', 'Ces dates ne sont pas disponibles pour cette propriété.');
        return;
      }
      
      console.log('✅ [BookingModificationModal] Aucun conflit détecté, disponibilité OK');

      // Vérifier aussi les dates bloquées manuellement
      const { data: blockedDates, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('start_date, end_date')
        .eq('property_id', property.id);

      console.log('🔍 [BookingModificationModal] Vérification dates bloquées:', {
        blockedError: blockedError ? {
          message: blockedError.message,
          code: blockedError.code,
        } : null,
        blockedDatesCount: blockedDates?.length || 0,
        blockedDates: blockedDates || [],
      });

      if (blockedError) {
        console.error('❌ [BookingModificationModal] Erreur vérification dates bloquées:', blockedError);
      } else if (blockedDates && blockedDates.length > 0) {
        // Vérifier les conflits avec les dates bloquées
        const hasConflict = blockedDates.some((blocked: any) => {
          const blockedStart = new Date(blocked.start_date);
          const blockedEnd = new Date(blocked.end_date);
          const conflict = (
            (finalCheckIn >= blockedStart && finalCheckIn < blockedEnd) ||
            (finalCheckOut > blockedStart && finalCheckOut <= blockedEnd) ||
            (finalCheckIn <= blockedStart && finalCheckOut >= blockedEnd)
          );
          if (conflict) {
            console.log('⚠️ [BookingModificationModal] Conflit avec date bloquée:', {
              blockedStart: blockedStart.toISOString(),
              blockedEnd: blockedEnd.toISOString(),
              finalCheckIn: finalCheckIn.toISOString(),
              finalCheckOut: finalCheckOut.toISOString(),
            });
          }
          return conflict;
        });

        if (hasConflict) {
          console.log('❌ [BookingModificationModal] Dates bloquées détectées');
          Alert.alert('Dates non disponibles', 'Ces dates sont bloquées pour cette propriété.');
          return;
        }
      }
      
      console.log('✅ [BookingModificationModal] Vérification disponibilité terminée, aucune date bloquée');
    } catch (error) {
      console.error('❌ [BookingModificationModal] Erreur lors de la vérification de disponibilité:', error);
      Alert.alert('Erreur', 'Impossible de vérifier la disponibilité. Veuillez réessayer.');
      return;
    }

    const originalNightsSubmit = Math.ceil(
      (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) 
      / (1000 * 60 * 60 * 24)
    );
    const originalTotalPrice = Math.max(0, Number(booking.total_price) || 0);
    if (originalTotalPrice <= 0) {
      console.error('❌ [BookingModificationModal] total_price réservation invalide:', booking.total_price);
      Alert.alert('Erreur', 'Impossible de calculer le surplus : le montant de la réservation actuelle est invalide.');
      return;
    }
    const isExtensionSubmit = finalNights > originalNightsSubmit;

    let finalTotalPrice: number;
    let finalPriceDifference: number;
    let finalPriceAfterDiscount: number;
    let finalFees: { cleaningFee: number; serviceFee: number; totalFees: number; serviceFeeHT: number; serviceFeeVAT: number; taxes: number };
    let finalEffectivePrice: number;
    let finalPricing: { discountAmount?: number };

    if (isExtensionSubmit) {
      // Surplus = uniquement les nuits ajoutées + delta des frais (pas de re-tarification des nuits déjà payées)
      const originalSubtotal = inferOriginalSubtotal(originalTotalPrice, originalNightsSubmit, property);
      const addedNights = finalNights - originalNightsSubmit;
      const addedEnd = new Date(booking.check_out_date);
      addedEnd.setDate(addedEnd.getDate() + addedNights - 1);
      const addedAvg = await getAveragePriceForPeriod(
        property.id,
        new Date(booking.check_out_date),
        addedEnd,
        pricePerNight
      );
      const finalDiscountConfig = {
        enabled: property.discount_enabled || false,
        minNights: property.discount_min_nights || null,
        percentage: property.discount_percentage || null
      };
      const finalLongStayDiscountConfig = property.long_stay_discount_enabled ? {
        enabled: property.long_stay_discount_enabled || false,
        minNights: property.long_stay_discount_min_nights || null,
        percentage: property.long_stay_discount_percentage || null
      } : undefined;
      const addedPricing = calculateTotalPrice(addedAvg, addedNights, finalDiscountConfig, finalLongStayDiscountConfig);
      const addedSubtotalAfterDiscount = addedPricing.totalPrice;
      const newSubtotal = originalSubtotal + addedSubtotalAfterDiscount;
      finalFees = calculateFees(newSubtotal, finalNights, 'property', {
        cleaning_fee: cleaningFee,
        service_fee: serviceFee,
        taxes: property.taxes || 0,
        free_cleaning_min_days: property.free_cleaning_min_days || null
      });
      finalTotalPrice = newSubtotal + finalFees.totalFees;
      finalPriceDifference = Math.round(finalTotalPrice - originalTotalPrice);
      finalPriceAfterDiscount = newSubtotal;
      finalEffectivePrice = addedAvg;
      finalPricing = addedPricing;
    } else {
      // Recalcul complet (réduction de nuits ou autres changements)
      let effPrice = effectivePrice;
      if (!effPrice || loadingPrice) {
        try {
          effPrice = await getAveragePriceForPeriod(property.id, finalCheckIn, finalCheckOut, pricePerNight);
        } catch (error) {
          console.error('Error calculating final price:', error);
          effPrice = pricePerNight;
        }
      }
      finalEffectivePrice = effPrice;
      const finalDiscountConfig = {
        enabled: property.discount_enabled || false,
        minNights: property.discount_min_nights || null,
        percentage: property.discount_percentage || null
      };
      const finalLongStayDiscountConfig = property.long_stay_discount_enabled ? {
        enabled: property.long_stay_discount_enabled || false,
        minNights: property.long_stay_discount_min_nights || null,
        percentage: property.long_stay_discount_percentage || null
      } : undefined;
      finalPricing = calculateTotalPrice(finalEffectivePrice, finalNights, finalDiscountConfig, finalLongStayDiscountConfig);
      finalPriceAfterDiscount = finalPricing.totalPrice;
      finalFees = calculateFees(finalPriceAfterDiscount, finalNights, 'property', {
        cleaning_fee: cleaningFee,
        service_fee: serviceFee,
        taxes: property.taxes || 0,
        free_cleaning_min_days: property.free_cleaning_min_days || null
      });
      finalTotalPrice = finalPriceAfterDiscount + finalFees.totalFees;
      let rawPriceDifference = finalTotalPrice - originalTotalPrice;
      // Quand on réduit le nombre de nuits : jamais de surplus à payer (réduction = pas de paiement supplémentaire)
      const isReduction = finalNights < originalNightsSubmit;
      finalPriceDifference = isReduction && rawPriceDifference > 0 ? 0 : rawPriceDifference;
    }

    const originalNights = originalNightsSubmit;
    const originalBasePrice = pricePerNight * originalNights;
    const originalDiscountConfig = {
      enabled: property.discount_enabled || false,
      minNights: property.discount_min_nights || null,
      percentage: property.discount_percentage || null
    };
    const originalLongStayDiscountConfig = property.long_stay_discount_enabled ? {
      enabled: property.long_stay_discount_enabled || false,
      minNights: property.long_stay_discount_min_nights || null,
      percentage: property.long_stay_discount_percentage || null
    } : undefined;
    const originalPricing = calculateTotalPrice(pricePerNight, originalNights, originalDiscountConfig, originalLongStayDiscountConfig);
    const originalPriceAfterDiscount = originalPricing.totalPrice;
    const originalFees = calculateFees(originalPriceAfterDiscount, originalNights, 'property', {
      cleaning_fee: cleaningFee,
      service_fee: serviceFee,
      taxes: property.taxes || 0,
      free_cleaning_min_days: property.free_cleaning_min_days || null
    });

    // Calculer les différences pour le surplus (breakdown non utilisé en mode extension)
    const calculatedSurplusBreakdown = finalPriceDifference > 0 && !isExtensionSubmit ? {
      basePriceDiff: (finalEffectivePrice * finalNights) - originalBasePrice,
      discountDiff: (finalPricing.discountAmount || 0) - (originalPricing.discountAmount || 0),
      cleaningFeeDiff: finalFees.cleaningFee - originalFees.cleaningFee,
      serviceFeeDiff: finalFees.serviceFee - originalFees.serviceFee,
      serviceFeeHTDiff: finalFees.serviceFeeHT - originalFees.serviceFeeHT,
      serviceFeeVATDiff: finalFees.serviceFeeVAT - originalFees.serviceFeeVAT,
      taxesDiff: finalFees.taxes - originalFees.taxes,
    } : null;

    // Stocker les valeurs dans le state pour qu'elles soient accessibles dans le JSX
    setFinalTotalPrice(finalTotalPrice);
    setSurplusBreakdown(calculatedSurplusBreakdown);

    // requestedTotalPrice = NOUVEAU TOTAL (ancien + surplus), pas seulement le surplus. C'est ce montant qui sera enregistré en base à l'approbation.
    // surplusAmount = montant à prélever maintenant (différence à payer).
    const modificationData = {
      bookingId: booking.id,
      guestId: user.id,
      hostId: property.host_id,
      originalCheckIn: booking.check_in_date,
      originalCheckOut: booking.check_out_date,
      originalGuestsCount: booking.guests_count,
      originalTotalPrice: originalTotalPrice,
      requestedCheckIn: formatDateForAPI(finalCheckIn),
      requestedCheckOut: formatDateForAPI(finalCheckOut),
      requestedGuestsCount: guestsCount,
      requestedTotalPrice: finalTotalPrice, // ancien total + surplus (full new total)
      surplusAmount: finalPriceDifference > 0 ? finalPriceDifference : 0,
      guestMessage: message.trim() || undefined,
    };

    console.log('💰 [BookingModificationModal] Calcul prix terminé:', {
      finalTotalPrice,
      originalTotalPrice,
      finalPriceDifference,
      isExtension: isExtensionSubmit,
      modificationData: {
        bookingId: modificationData.bookingId,
        requestedCheckIn: modificationData.requestedCheckIn,
        requestedCheckOut: modificationData.requestedCheckOut,
        requestedTotalPrice: modificationData.requestedTotalPrice,
      },
    });

    // Si le surplus est positif, afficher le modal de paiement
    if (finalPriceDifference > 0) {
      console.log('💳 [BookingModificationModal] Surplus positif, affichage modal paiement');
      setPendingModificationData(modificationData);
      setShowPaymentModal(true);
    } else {
      console.log('📤 [BookingModificationModal] Pas de surplus, soumission directe');
      // Si pas de surplus, soumettre directement
      const result = await createModificationRequest(modificationData);
      console.log('📥 [BookingModificationModal] Résultat création demande:', {
        success: result.success,
        error: result.error,
      });
      if (result.success) {
        console.log('✅ [BookingModificationModal] Demande créée avec succès');
        onClose();
        onModificationRequested?.();
      } else {
        console.error('❌ [BookingModificationModal] Erreur création demande:', result.error);
      }
    }
  };

  const handlePaymentComplete = async (stripeSessionId?: string) => {
    console.log('[DEBUG][BookingModificationModal] handlePaymentComplete appelé. stripeSessionId:', stripeSessionId ? `${stripeSessionId.substring(0, 24)}...` : 'undefined', 'pendingModificationData:', !!pendingModificationData);
    if (!pendingModificationData) return;

    if (stripeSessionId) {
      console.log('[DEBUG][BookingModificationModal] → Carte: fermeture + onModificationRequested');
      // Carte : la demande a été créée par le webhook après paiement (draft → webhook)
      setFinalTotalPrice(null);
      setSurplusBreakdown(null);
      setPendingModificationData(null);
      onClose();
      onModificationRequested?.();
      return;
    }

    console.log('[DEBUG][BookingModificationModal] → Cash: createModificationRequest');
    // Cash : créer la demande après confirmation du paiement cash
    setFinalTotalPrice(null);
    setSurplusBreakdown(null);
    const result = await createModificationRequest(pendingModificationData);
    if (result.success) {
      setPendingModificationData(null);
      onClose();
      onModificationRequested?.();
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de soumettre la demande.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier la réservation</Text>
          <View style={styles.placeholder} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            scrollEnabled={true}
            nestedScrollEnabled={false}
            scrollEventThrottle={16}
          >
          {checkingPending ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>Vérification...</Text>
            </View>
          ) : hasPendingRequest && pendingRequest ? (
            <>
              <View style={styles.pendingRequestCard}>
                <View style={styles.pendingRequestHeader}>
                  <Ionicons name="time-outline" size={24} color="#f39c12" />
                  <Text style={styles.pendingRequestTitle}>Demande en attente</Text>
                </View>
                <Text style={styles.pendingRequestSubtitle}>
                  Votre demande de modification est en cours d'examen par l'hôte.
                </Text>

                {/* Détails de la demande */}
                <View style={styles.requestDetails}>
                  <Text style={styles.requestDetailsTitle}>Détails de votre demande</Text>
                  
                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Dates demandées:</Text>
                    <Text style={styles.requestDetailValue}>
                      {formatDate(new Date(pendingRequest.requested_check_in))} - {formatDate(new Date(pendingRequest.requested_check_out))}
                    </Text>
                  </View>

                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Nombre de voyageurs:</Text>
                    <Text style={styles.requestDetailValue}>{pendingRequest.requested_guests_count}</Text>
                  </View>

                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Nouveau total:</Text>
                    <Text style={styles.requestDetailValue}>{formatPrice(pendingRequest.requested_total_price)}</Text>
                  </View>

                  {pendingRequest.guest_message && (
                    <View style={styles.requestMessageBox}>
                      <Text style={styles.requestMessageLabel}>Votre message:</Text>
                      <Text style={styles.requestMessageText}>{pendingRequest.guest_message}</Text>
                    </View>
                  )}

                  <View style={styles.requestDetailRow}>
                    <Text style={styles.requestDetailLabel}>Date de la demande:</Text>
                    <Text style={styles.requestDetailValue}>
                      {formatDate(new Date(pendingRequest.created_at))}
                    </Text>
                  </View>
                </View>

                {/* Bouton d'annulation */}
                <TouchableOpacity
                  style={styles.cancelRequestButton}
                  onPress={async () => {
                    Alert.alert(
                      'Annuler la demande',
                      'Êtes-vous sûr de vouloir annuler cette demande de modification ?',
                      [
                        { text: 'Non', style: 'cancel' },
                        {
                          text: 'Oui, annuler',
                          style: 'destructive',
                          onPress: async () => {
                            const result = await cancelModificationRequest(pendingRequest.id);
                            if (result.success) {
                              setHasPendingRequest(false);
                              setPendingRequest(null);
                              checkPendingRequest();
                            }
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#e74c3c" />
                  <Text style={styles.cancelRequestButtonText}>Annuler la demande</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Propriété */}
              <View style={styles.propertyCard}>
                <Text style={styles.propertyTitle}>{property?.title || 'Propriété'}</Text>
                <Text style={styles.propertyDates}>
                  Réservation actuelle: {formatDate(new Date(booking.check_in_date))} - {formatDate(new Date(booking.check_out_date))}
                </Text>
              </View>

              {/* Nouvelles dates */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nouvelles dates</Text>
                <View style={styles.datesContainer}>
                  {/* Date d'arrivée */}
                  <TouchableOpacity
                    style={styles.dateButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (!property?.id) {
                        Alert.alert('Erreur', 'Propriété non trouvée');
                        return;
                      }
                      setCalendarMode('checkIn');
                      setShowCalendar(true);
                    }}
                  >
                    <View style={styles.dateButtonContent}>
                      <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                      <View style={styles.dateButtonTextContainer}>
                        <Text style={styles.dateButtonLabel}>Arrivée</Text>
                        <Text style={[styles.dateButtonValue, !checkIn && styles.dateButtonPlaceholder]}>
                          {checkIn ? formatDate(checkIn) : 'Sélectionner'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#666" />
                  </TouchableOpacity>

                  {/* Date de départ */}
                  <TouchableOpacity
                    style={styles.dateButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (hasPendingRequest) {
                        Alert.alert(
                          'Demande en cours',
                          'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse de l\'hôte ou annuler la demande existante.',
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      if (!property?.id) {
                        Alert.alert('Erreur', 'Propriété non trouvée');
                        return;
                      }
                      // Permettre la sélection de la date de départ même si l'arrivée n'est pas modifiée
                      // (on utilisera la date d'arrivée actuelle de la réservation)
                      setCalendarMode('checkOut');
                      setShowCalendar(true);
                    }}
                  >
                    <View style={styles.dateButtonContent}>
                      <Ionicons name="calendar-outline" size={20} color="#2E7D32" />
                      <View style={styles.dateButtonTextContainer}>
                        <Text style={styles.dateButtonLabel}>Départ</Text>
                        <Text style={[styles.dateButtonValue, !checkOut && styles.dateButtonPlaceholder]}>
                          {checkOut ? formatDate(checkOut) : 'Sélectionner'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
                {(effectiveCheckIn && effectiveCheckOut) && (
                  <View style={styles.nightsContainer}>
                    <Text style={styles.nightsText}>
                      {nights} {nights === 1 ? 'nuit' : 'nuits'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Nombre de voyageurs */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Nombre de voyageurs</Text>
                <View style={styles.guestsSelector}>
                  <TouchableOpacity
                    style={styles.guestButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      const newCount = Math.max(1, guestsCount - 1);
                      console.log('➖ Diminuer voyageurs:', guestsCount, '->', newCount);
                      setGuestsCount(newCount);
                    }}
                    disabled={guestsCount <= 1}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Ionicons name="remove-circle-outline" size={24} color={guestsCount <= 1 ? "#ccc" : "#2E7D32"} />
                  </TouchableOpacity>
                  <Text style={styles.guestCount}>{guestsCount}</Text>
                  <TouchableOpacity
                    style={styles.guestButton}
                    activeOpacity={0.7}
                    onPress={() => {
                      const newCount = Math.min(maxGuests, guestsCount + 1);
                      console.log('➕ Augmenter voyageurs:', guestsCount, '->', newCount);
                      setGuestsCount(newCount);
                    }}
                    disabled={guestsCount >= maxGuests}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={guestsCount >= maxGuests ? "#ccc" : "#2E7D32"} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Résumé des changements */}
              {hasChanges && (
                <View style={styles.changesCard}>
                  <Text style={styles.changesTitle}>Résumé des modifications</Text>
                  
                  {(checkInChanged || checkOutChanged) && (
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Dates:</Text>
                      <Text style={styles.changeValue}>
                        {formatDate(new Date(booking.check_in_date))} - {formatDate(new Date(booking.check_out_date))}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                      <Text style={styles.changeValueNew}>
                        {formatDate(effectiveCheckIn)} - {formatDate(effectiveCheckOut)}
                      </Text>
                    </View>
                  )}

                  {guestsChanged && (
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Voyageurs:</Text>
                      <Text style={styles.changeValue}>{booking.guests_count}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                      <Text style={styles.changeValueNew}>{guestsCount}</Text>
                    </View>
                  )}

                  {(checkInChanged || checkOutChanged) && (
                    <View style={styles.changeRow}>
                      <Text style={styles.changeLabel}>Nuits:</Text>
                      <Text style={styles.changeValue}>{originalNights}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#666" />
                      <Text style={styles.changeValueNew}>{nights}</Text>
                    </View>
                  )}

                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Nouveau total</Text>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceValue}>{formatPrice(newTotalPrice)}</Text>
                      {priceDifference !== 0 && (
                        <Text style={[
                          styles.priceDifference,
                          priceDifference > 0 ? styles.priceIncrease : styles.priceDecrease
                        ]}>
                          {priceDifference > 0 ? '+' : ''}{formatPrice(priceDifference)}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Message à l'hôte */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Message à l'hôte (optionnel)</Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Expliquez pourquoi vous souhaitez modifier votre réservation..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.submitButton, (!hasChanges || loading) && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!hasChanges || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Envoyer la demande</Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.infoText}>
                L'hôte devra approuver votre demande de modification.
                Vous serez notifié de sa réponse.
              </Text>
            </>
          )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Calendrier modal */}
        {property?.id && showCalendar && (
          <Modal
            visible={showCalendar}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => {
              setShowCalendar(false);
            }}
          >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
              <View style={styles.header}>
                <TouchableOpacity 
                  onPress={() => {
                    setShowCalendar(false);
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                  {calendarMode === 'checkIn' ? 'Sélectionner la date d\'arrivée' : 
                   calendarMode === 'checkOut' ? 'Sélectionner la date de départ' : 
                   'Sélectionner les dates'}
                </Text>
                <View style={styles.placeholder} />
              </View>
              <View style={{ flex: 1 }}>
                <AvailabilityCalendar
                  propertyId={property.id}
                  excludeBookingId={booking.id}
                  excludeBookingDates={{
                    checkIn: booking.check_in_date,
                    checkOut: booking.check_out_date,
                  }}
                  selectedCheckIn={calendarMode === 'checkIn' || calendarMode === 'both' ? checkIn : null}
                  selectedCheckOut={calendarMode === 'checkOut' || calendarMode === 'both' ? checkOut : null}
                  mode={calendarMode}
                  showHeader={false}
                  onDateSelect={(selectedCheckIn, selectedCheckOut) => {
                    if (calendarMode === 'checkIn' && selectedCheckIn) {
                      setCheckIn(selectedCheckIn);
                      // Si la nouvelle date d'arrivée est >= date de départ, ajuster la date de départ
                      if (checkOut && selectedCheckIn >= checkOut) {
                        const newCheckOut = new Date(selectedCheckIn);
                        newCheckOut.setDate(newCheckOut.getDate() + 1);
                        setCheckOut(newCheckOut);
                      }
                    } else if (calendarMode === 'checkOut' && selectedCheckOut) {
                      setCheckOut(selectedCheckOut);
                    } else if (calendarMode === 'both') {
                      if (selectedCheckIn) {
                        setCheckIn(selectedCheckIn);
                      }
                      if (selectedCheckOut) {
                        setCheckOut(selectedCheckOut);
                      }
                    }
                  }}
                  onClose={() => {
                    setShowCalendar(false);
                  }}
                />
              </View>
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
      
      {/* Modal de paiement du surplus */}
      <ModificationSurplusPaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPendingModificationData(null);
          setFinalTotalPrice(null);
          setSurplusBreakdown(null);
        }}
        surplusAmount={pendingModificationData?.surplusAmount ?? (priceDifference > 0 ? priceDifference : 0)}
        bookingId={booking.id}
        onPaymentComplete={handlePaymentComplete}
        modificationRequestPayload={pendingModificationData ? {
          booking_id: pendingModificationData.bookingId,
          guest_id: pendingModificationData.guestId,
          host_id: pendingModificationData.hostId,
          original_check_in: pendingModificationData.originalCheckIn,
          original_check_out: pendingModificationData.originalCheckOut,
          original_guests_count: pendingModificationData.originalGuestsCount,
          original_total_price: pendingModificationData.originalTotalPrice,
          requested_check_in: pendingModificationData.requestedCheckIn,
          requested_check_out: pendingModificationData.requestedCheckOut,
          requested_guests_count: pendingModificationData.requestedGuestsCount,
          requested_total_price: pendingModificationData.requestedTotalPrice,
          guest_message: pendingModificationData.guestMessage ?? null,
        } : undefined}
        propertyTitle={property?.title}
        propertyId={property?.id}
        originalTotalPrice={booking.total_price}
        newTotalPrice={finalTotalPrice || newTotalPrice}
        priceBreakdown={surplusBreakdown || undefined}
      />
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
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40, // Espace supplémentaire pour le clavier
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  alertText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  propertyCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  propertyDates: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  datesContainer: {
    gap: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 60,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateButtonTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  dateButtonLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dateButtonValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  dateButtonPlaceholder: {
    color: '#999',
    fontWeight: '400',
  },
  nightsContainer: {
    marginTop: 8,
    paddingLeft: 4,
  },
  nightsText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  guestsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  guestButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonPressed: {
    opacity: 0.6,
  },
  guestButtonDisabled: {
    opacity: 0.3,
  },
  guestCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center',
  },
  changesCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  changesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  changeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  changeValue: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  changeValueNew: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  priceDifference: {
    fontSize: 14,
    marginTop: 4,
  },
  priceIncrease: {
    color: '#e74c3c',
  },
  priceDecrease: {
    color: '#27ae60',
  },
  messageInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  pendingRequestCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  pendingRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingRequestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  pendingRequestSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  requestDetails: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  requestDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  requestDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  requestDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  requestMessageBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
  requestMessageLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  requestMessageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  cancelRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e74c3c',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelRequestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e74c3c',
  },
});

export default BookingModificationModal;

