import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCommissionRates, getTravelerServiceFeeTtcMultiplier, type ServiceType } from '../lib/commissions';
import { getCancellationPolicyText } from '../utils/cancellationPolicy';
import { calculateTotalPrice, calculateHostCommission, calculateVehiclePriceWithHours, type DiscountConfig } from '../hooks/usePricing';
import { calculateHostNetAmount as calculateHostNetAmountCentralized } from '../lib/hostNetAmount';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useCurrency } from '../hooks/useCurrency';
import akwaHomeLogo from '../../assets/icon.png';

interface InvoiceDisplayProps {
  type: 'traveler' | 'host' | 'admin';
  serviceType: ServiceType;
  booking: {
    id: string;
    check_in_date?: string;
    check_out_date?: string;
    start_date?: string;
    end_date?: string;
    guests_count?: number;
    total_price: number;
    created_at?: string;
    discount_amount?: number;
    discount_applied?: boolean;
    payment_method?: string;
    payment_plan?: string | null;
    status?: string;
    properties?: {
      service_fee?: number;
      taxes?: number;
      price_per_night?: number;
      cleaning_fee?: number;
      title?: string;
      discount_enabled?: boolean;
      discount_min_nights?: number | null;
      discount_percentage?: number | null;
      long_stay_discount_enabled?: boolean;
      long_stay_discount_min_nights?: number | null;
      long_stay_discount_percentage?: number | null;
      free_cleaning_min_days?: number | null;
      house_rules?: string | null;
      cancellation_policy?: string | null;
    };
    vehicle?: {
      rules?: string[];
      cancellation_policy?: string | null;
      discount_enabled?: boolean;
      discount_min_days?: number | null;
      discount_percentage?: number | null;
      long_stay_discount_enabled?: boolean;
      long_stay_discount_min_days?: number | null;
      long_stay_discount_percentage?: number | null;
    };
  };
  pricePerUnit: number;
  cleaningFee?: number;
  serviceFee?: number;
  taxes?: number;
  paymentMethod?: string;
  travelerName?: string;
  travelerEmail?: string;
  travelerPhone?: string;
  hostName?: string;
  hostEmail?: string;
  hostPhone?: string;
  propertyOrVehicleTitle?: string;
}

const formatPriceFCFA = (amount: number): string => {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// Fuseau utilisé pour l'affichage des réservations (aligné avec le PDF/email = UTC = Abidjan)
const BOOKING_DISPLAY_TIMEZONE = 'Africa/Abidjan';

const formatDateWithTime = (dateString?: string, dateTimeString?: string): string => {
  if (!dateString) return '-';
  try {
    const opts = { day: '2-digit' as const, month: '2-digit' as const, year: 'numeric' as const, timeZone: BOOKING_DISPLAY_TIMEZONE };
    const date = new Date(dateTimeString || dateString);
    const dateFormatted = date.toLocaleDateString('fr-FR', opts);
    if (dateTimeString) {
      const timeFormatted = date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: BOOKING_DISPLAY_TIMEZONE,
      });
      return `${dateFormatted} à ${timeFormatted}`;
    }
    return dateFormatted;
  } catch (error) {
    console.error('Erreur formatage date:', error);
    return dateString;
  }
};

const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTime = (timeString?: string | null): string => {
  if (!timeString) return '-';
  // Si le format est HH:MM:SS, ne garder que HH:MM
  if (timeString.includes(':')) {
    const parts = timeString.split(':');
    return `${parts[0]}:${parts[1]}`;
  }
  return timeString;
};

const getPaymentMethodLabel = (method?: string): string => {
  if (!method) return 'Non spécifié';
  const methods: { [key: string]: string } = {
    mobile_money: 'Mobile Money',
    bank_transfer: 'Virement bancaire',
    cash: 'Espèces',
    card: 'Carte bancaire',
    orange_money: 'Orange Money',
    mtn_money: 'MTN Money',
    moov_money: 'Moov Money',
  };
  return methods[method] || method;
};

const getServiceTypeLabel = (serviceType: ServiceType): string => {
  return serviceType === 'property' ? 'Résidence meublée' : 'Location de véhicule';
};

export const InvoiceDisplay: React.FC<InvoiceDisplayProps> = ({
  type,
  serviceType,
  booking,
  pricePerUnit,
  cleaningFee = 0,
  serviceFee: providedServiceFee,
  taxes: providedTaxes,
  paymentMethod,
  travelerName,
  travelerEmail: providedTravelerEmail,
  travelerPhone,
  hostName,
  hostEmail: providedHostEmail,
  hostPhone,
  propertyOrVehicleTitle,
}) => {
  const { user } = useAuth();
  const { currency, rates } = useCurrency();
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [travelerEmail, setTravelerEmail] = useState<string | undefined>(providedTravelerEmail);
  const [hostEmail, setHostEmail] = useState<string | undefined>(providedHostEmail);
  const [approvedModification, setApprovedModification] = useState<any>(null);
  /** Pénalité(s) à déduire de la prochaine paie (choix "prélèvement sur prochaine réservation") — pour affichage facture hôte + PDF */
  const [hostPendingPenaltyDeduct, setHostPendingPenaltyDeduct] = useState<number>(0);

  // Debug: Vérifier les données disponibles
  useEffect(() => {
    if (__DEV__ && booking) {
      console.log('🔍 [InvoiceDisplay] Données booking:', {
        serviceType,
        hasProperties: !!booking.properties,
        check_in_time: booking.properties?.check_in_time,
        check_out_time: booking.properties?.check_out_time,
        house_rules: booking.properties?.house_rules ? 'PRÉSENT' : 'MANQUANT',
        house_rules_length: booking.properties?.house_rules?.length || 0,
      });
    }
  }, [booking, serviceType]);

  // Récupérer la pénalité "à déduire de la prochaine paie" pour l'hôte (affichage facture + PDF)
  useEffect(() => {
    if (type !== 'host' || !booking) {
      setHostPendingPenaltyDeduct(0);
      return;
    }
    const hostId = serviceType === 'property'
      ? (booking.properties as any)?.host_id
      : (booking.vehicle as any)?.owner_id;
    if (!hostId) {
      setHostPendingPenaltyDeduct(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from('penalty_tracking')
        .select('penalty_amount')
        .eq('host_id', hostId)
        .eq('payment_method', 'deduct_from_next_booking')
        .eq('status', 'pending');
      if (cancelled) return;
      if (error) {
        if (__DEV__) console.warn('[InvoiceDisplay] Erreur chargement pénalités à déduire:', error);
        setHostPendingPenaltyDeduct(0);
        return;
      }
      const total = (rows || []).reduce((sum, r) => sum + (Number(r.penalty_amount) || 0), 0);
      setHostPendingPenaltyDeduct(total);
    })();
    return () => { cancelled = true; };
  }, [type, booking?.id, serviceType, (booking as any)?.properties?.host_id, (booking as any)?.vehicle?.owner_id]);

  // Récupérer les emails si non fournis
  useEffect(() => {
    const fetchEmails = async () => {
      // Toujours utiliser l'email fourni en props s'il existe
      if (providedTravelerEmail) {
        setTravelerEmail(providedTravelerEmail);
      }
      if (providedHostEmail) {
        setHostEmail(providedHostEmail);
      }

      // Pour le voyageur : utiliser l'email de l'utilisateur connecté si type === 'traveler' et pas d'email fourni
      if (type === 'traveler' && !travelerEmail && user?.email) {
        setTravelerEmail(user.email);
      }

      // Pour les propriétés
      if (serviceType === 'property') {
        // Pour l'hôte : récupérer depuis le booking si disponible
        if (type === 'host' && !hostEmail && booking.properties?.host_id) {
          try {
            const { data: hostProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('user_id', booking.properties.host_id)
              .single();
            if (hostProfile?.email) {
              setHostEmail(hostProfile.email);
            }
          } catch (error) {
            console.error('Erreur récupération email hôte:', error);
          }
        }

        // Pour le voyageur depuis le booking (si on est hôte)
        if (type === 'host' && !travelerEmail && (booking as any).guest_profile?.email) {
          setTravelerEmail((booking as any).guest_profile.email);
        } else if (type === 'host' && !travelerEmail && (booking as any).profiles?.email) {
          setTravelerEmail((booking as any).profiles.email);
        }

        // Pour l'hôte depuis le booking (si on est voyageur)
        if (type === 'traveler' && !hostEmail && booking.properties?.host_id) {
          try {
            const { data: hostProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('user_id', booking.properties.host_id)
              .single();
            if (hostProfile?.email) {
              setHostEmail(hostProfile.email);
            }
          } catch (error) {
            console.error('Erreur récupération email hôte:', error);
          }
        }
      }

      // Pour les véhicules
      if (serviceType === 'vehicle') {
        // Récupérer depuis le booking (renter et owner sont souvent inclus)
        if (!travelerEmail && (booking as any).renter?.email) {
          setTravelerEmail((booking as any).renter.email);
        } else if (type === 'traveler' && !travelerEmail && user?.email) {
          setTravelerEmail(user.email);
        }

        if (!hostEmail && (booking as any).vehicle?.owner?.email) {
          setHostEmail((booking as any).vehicle.owner.email);
        } else if (!hostEmail && (booking as any).vehicle?.owner_id) {
          try {
            const { data: ownerProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('user_id', (booking as any).vehicle.owner_id)
              .single();
            if (ownerProfile?.email) {
              setHostEmail(ownerProfile.email);
            }
          } catch (error) {
            console.error('Erreur récupération email propriétaire:', error);
          }
        }
      }
    };

    fetchEmails();
  }, [type, serviceType, booking, user, providedTravelerEmail, providedHostEmail]);

  // Récupérer les modifications approuvées pour cette réservation
  useEffect(() => {
    const fetchApprovedModification = async () => {
      if (!booking?.id) {
        if (__DEV__) console.log('🔍 [InvoiceDisplay] Pas de booking.id, skip');
        return;
      }
      
      if (__DEV__) console.log('🔍 [InvoiceDisplay] Recherche modification pour booking:', booking.id, 'serviceType:', serviceType);
      
      try {
        if (serviceType === 'property') {
          const { data, error } = await supabase
            .from('booking_modification_requests')
            .select('*')
            .eq('booking_id', booking.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (__DEV__) {
            console.log('🔍 [InvoiceDisplay] Résultat requête modification propriété:', { data, error });
          }
          
          if (!error && data) {
            setApprovedModification(data);
            if (__DEV__) console.log('✅ [InvoiceDisplay] Modification approuvée trouvée:', data);
          } else if (error) {
            console.error('❌ [InvoiceDisplay] Erreur requête modification:', error);
          }
        } else {
          // Pour les véhicules
          const { data, error } = await supabase
            .from('vehicle_booking_modification_requests')
            .select('*')
            .eq('booking_id', booking.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (__DEV__) {
            console.log('🔍 [InvoiceDisplay] Résultat requête modification véhicule:', { data, error });
          }
          
          if (!error && data) {
            setApprovedModification(data);
            if (__DEV__) console.log('✅ [InvoiceDisplay] Modification approuvée trouvée:', data);
          } else if (error) {
            console.error('❌ [InvoiceDisplay] Erreur requête modification:', error);
          }
        }
      } catch (error) {
        console.error('❌ [InvoiceDisplay] Erreur lors de la récupération de la modification:', error);
      }
    };

    fetchApprovedModification();
  }, [booking?.id, serviceType]);

  const effectivePaymentMethod = paymentMethod || booking.payment_method || 'Non spécifié';
  const checkIn = booking.check_in_date || booking.start_date || '';
  const checkOut = booking.check_out_date || booking.end_date || '';
  
  // Debug pour vérifier les valeurs de start_datetime et end_datetime
  if (serviceType === 'vehicle' && __DEV__) {
    if (__DEV__) console.log('🔍 [InvoiceDisplay] Dates véhicule:', {
      checkIn,
      checkOut,
      start_datetime: (booking as any).start_datetime,
      end_datetime: (booking as any).end_datetime,
      approvedModification_start: approvedModification?.requested_start_datetime,
      approvedModification_end: approvedModification?.requested_end_datetime,
    });
  }
  
  // Pour les véhicules, utiliser rental_days si disponible, sinon calculer avec +1 (comme lors de la création)
  // Pour les propriétés, utiliser le calcul standard
  let nights = 1;
  if (serviceType === 'vehicle' && (booking as any).rental_days) {
    nights = (booking as any).rental_days;
  } else if (checkIn && checkOut) {
    if (serviceType === 'vehicle') {
      // Pour les véhicules: différence + 1 (comme lors de la création de la réservation)
      nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      // Pour les propriétés: calcul standard
      const calculatedNights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
      nights = calculatedNights > 0 ? calculatedNights : 1; // Minimum 1 nuit
    }
  }

  // Pour les véhicules, calculer le prix des heures supplémentaires si applicable
  let hoursPrice = 0;
  const rentalHours = serviceType === 'vehicle' ? ((booking as any).rental_hours || 0) : 0;
  // Utiliser hourly_rate de la réservation si disponible, sinon price_per_hour du véhicule
  const hourlyRate = serviceType === 'vehicle' 
    ? ((booking as any).hourly_rate || (booking as any).hourlyRate || (booking as any).vehicle?.price_per_hour || 0)
    : 0;
  if (__DEV__) console.log(`🔍 [InvoiceDisplay] rental_hours: ${rentalHours}, hourly_rate: ${hourlyRate}, vehicle:`, {
    hourly_rental_enabled: (booking as any).vehicle?.hourly_rental_enabled,
    price_per_hour: (booking as any).vehicle?.price_per_hour,
    booking_hourly_rate: (booking as any).hourly_rate
  });
  if (serviceType === 'vehicle' && rentalHours > 0 && hourlyRate > 0) {
    hoursPrice = rentalHours * hourlyRate;
    if (__DEV__) console.log(`💰 [InvoiceDisplay] Calcul prix heures: ${rentalHours}h × ${hourlyRate} = ${hoursPrice}`);
  }
  
  // Prix de base = prix des jours + prix des heures
  // Ces valeurs seront remplacées par calculationDetails si disponible (voir plus bas)
  let daysPrice = pricePerUnit * nights;
  
  // BUG FIX: Pour les véhicules, basePrice ne doit PAS inclure le chauffeur
  // Le chauffeur est ajouté APRÈS la réduction
  let basePrice = daysPrice + hoursPrice; // SANS chauffeur pour véhicules
  
  // ✅ PRIORITÉ: Récupérer driverFee depuis booking_calculation_details si disponible
  // Cette partie sera remplacée par les données stockées si calculationDetails existe
  // On garde ce calcul comme fallback pour les anciennes réservations
  let driverFee = 0;
  
  // Ces valeurs seront remplacées par calculationDetails si disponible (voir plus bas)
  if (serviceType === 'vehicle') {
    const vehicleWithDriver = (booking as any).vehicle?.with_driver;
    const vehicleDriverFee = (booking as any).vehicle?.driver_fee || 0;
    const bookingWithDriver = (booking as any).with_driver;
    
    // Si les deux conditions sont remplies, utiliser le driver_fee
    if (vehicleWithDriver && vehicleDriverFee > 0 && bookingWithDriver === true) {
      driverFee = vehicleDriverFee;
    } else if (vehicleWithDriver && vehicleDriverFee > 0) {
      // Fallback pour les anciennes réservations où booking.with_driver n'était pas stocké ou est incorrect
      // Si le véhicule propose un chauffeur, essayer de déduire depuis total_price
      const priceAfterDiscountTemp = basePrice - (booking.discount_amount || 0);
      const vehTtcMult = getTravelerServiceFeeTtcMultiplier('vehicle');
      const expectedTotalWithDriver = Math.round((priceAfterDiscountTemp + vehicleDriverFee) * vehTtcMult);
      const expectedTotalWithoutDriver = Math.round(priceAfterDiscountTemp * vehTtcMult);
      const actualTotal = booking.total_price || 0;
      
      const diffWithDriver = Math.abs(actualTotal - expectedTotalWithDriver);
      const diffWithoutDriver = Math.abs(actualTotal - expectedTotalWithoutDriver);
      
      // Inclure le chauffeur si :
      // 1. booking.with_driver est null/undefined (ancienne réservation) ET le véhicule propose un chauffeur
      // 2. Le total correspond mieux avec chauffeur
      // 3. booking.with_driver est false mais le total suggère qu'il devrait être true (données incorrectes)
      const shouldIncludeDriver = 
        (bookingWithDriver === null || bookingWithDriver === undefined) ||
        (diffWithDriver < diffWithoutDriver && actualTotal > 0) ||
        (bookingWithDriver === false && diffWithDriver < diffWithoutDriver + 5000); // Marge de 5000 pour éviter les faux positifs
      
      if (shouldIncludeDriver) {
        driverFee = vehicleDriverFee;
        if (__DEV__) console.log('🔍 [InvoiceDisplay] Chauffeur inclus (fallback):', {
          actualTotal,
          expectedTotalWithDriver,
          expectedTotalWithoutDriver,
          diffWithDriver,
          diffWithoutDriver,
          driverFee,
          booking_with_driver: bookingWithDriver,
          vehicle_with_driver: vehicleWithDriver,
          shouldIncludeDriver
        });
      }
    }
  }
  const basePriceWithDriver = serviceType === 'vehicle' ? basePrice + driverFee : basePrice; // AVEC chauffeur pour véhicules
  
  // Utiliser la valeur stockée en priorité, sinon recalculer
  let discountAmount = 0;
  if (serviceType === 'property' && booking.properties) {
    // Pour les propriétés, TOUJOURS utiliser la valeur stockée si elle existe (même si 0)
    // Ne recalculer QUE si discount_amount est null/undefined (anciennes réservations)
    if (booking.discount_amount !== undefined && booking.discount_amount !== null) {
      // Utiliser la valeur stockée en priorité (même si elle est 0)
      discountAmount = booking.discount_amount;
      if (__DEV__) console.log('📊 [InvoiceDisplay] Utilisation discount_amount stocké:', discountAmount);
    } else {
      // Sinon, recalculer la réduction (pour les anciennes réservations)
      if (__DEV__) console.log('⚠️ [InvoiceDisplay] discount_amount non disponible, recalcul...');
      const discountConfig: DiscountConfig = {
        enabled: booking.properties.discount_enabled || false,
        minNights: booking.properties.discount_min_nights || null,
        percentage: booking.properties.discount_percentage || null
      };
      const longStayDiscountConfig: DiscountConfig | undefined = booking.properties.long_stay_discount_enabled ? {
        enabled: booking.properties.long_stay_discount_enabled || false,
        minNights: booking.properties.long_stay_discount_min_nights || null,
        percentage: booking.properties.long_stay_discount_percentage || null
      } : undefined;
      
      try {
        const pricing = calculateTotalPrice(pricePerUnit, nights, discountConfig, longStayDiscountConfig);
        discountAmount = pricing.discountAmount || 0;
        if (__DEV__) console.log('📊 [InvoiceDisplay] Réduction recalculée:', discountAmount);
      } catch (error) {
        console.error('Erreur lors du calcul de la réduction dans InvoiceDisplay:', error);
        // En cas d'erreur, utiliser 0
        discountAmount = 0;
      }
    }
  } else if (serviceType === 'vehicle') {
    // Pour les véhicules, utiliser la valeur stockée si disponible, sinon recalculer
    if (booking.discount_amount && booking.discount_amount > 0) {
      // Utiliser la valeur stockée en priorité
      discountAmount = booking.discount_amount;
    } else if (booking.vehicle) {
      // Sinon, recalculer la réduction comme pour les propriétés
      const discountConfig: DiscountConfig = {
        enabled: booking.vehicle.discount_enabled || false,
        minNights: booking.vehicle.discount_min_days || null,
        percentage: booking.vehicle.discount_percentage || null
      };
      const longStayDiscountConfig: DiscountConfig | undefined = booking.vehicle.long_stay_discount_enabled ? {
        enabled: booking.vehicle.long_stay_discount_enabled || false,
        minNights: booking.vehicle.long_stay_discount_min_days || null,
        percentage: booking.vehicle.long_stay_discount_percentage || null
      } : undefined;
      
      try {
        // Utiliser la fonction centralisée pour calculer la réduction sur le total (jours + heures)
        // Utiliser hourly_rate de la réservation si disponible, sinon price_per_hour du véhicule
        const hourlyRateValue = (rentalHours > 0 && hourlyRate > 0)
          ? hourlyRate
          : 0;
        
        const priceCalculation = calculateVehiclePriceWithHours(
          pricePerUnit,
          nights,
          rentalHours,
          hourlyRateValue,
          discountConfig,
          longStayDiscountConfig
        );
        discountAmount = priceCalculation.discountAmount;
      } catch (error) {
        console.error('Erreur lors du calcul de la réduction véhicule dans InvoiceDisplay:', error);
        // En cas d'erreur, utiliser la valeur stockée
        discountAmount = booking.discount_amount || 0;
      }
    } else {
      // Fallback : utiliser la valeur stockée
      discountAmount = booking.discount_amount || 0;
    }
  } else {
    // Fallback : utiliser la valeur stockée
    discountAmount = booking.discount_amount || 0;
  }
  
  // Prix après réduction : la réduction s'applique sur le total (jours + heures)
  // Pour les véhicules : (prix_jours + prix_heures) - réduction
  // Pour les propriétés : prix_total - réduction (comme avant)
  // Ces valeurs seront remplacées par calculationDetails si disponible (voir plus bas)
  let priceAfterDiscount = basePrice - discountAmount; // Prix après réduction (sans chauffeur pour véhicules)
  let priceAfterDiscountWithDriver = serviceType === 'vehicle' ? priceAfterDiscount + driverFee : priceAfterDiscount; // Prix après réduction + chauffeur pour véhicules
  let actualDiscountAmount = discountAmount; // peut être écrasé par calculationDetails pour propriété
  // La taxe de séjour est par nuit, donc multiplier par le nombre de nuits
  const taxesPerNight = providedTaxes !== undefined 
    ? providedTaxes 
    : (booking.properties?.taxes || 0);
  // Note: effectiveTaxes sera déclaré plus bas dans le bloc if/else
  
  // Debug pour la taxe de séjour (sera fait après déclaration de effectiveTaxes)
  
  // ✅ PRIORITÉ ABSOLUE: Récupérer les données stockées AVANT tout calcul
  // Récupérer les détails de calcul stockés (si disponibles)
  const [calculationDetails, setCalculationDetails] = useState<any>(null);
  const [loadingCalcDetails, setLoadingCalcDetails] = useState(false);

  useEffect(() => {
    const fetchCalculationDetails = async () => {
      if (!booking?.id) return;
      
      setLoadingCalcDetails(true);
      try {
        const { data, error } = await supabase
          .from('booking_calculation_details')
          .select('*')
          .eq('booking_id', booking.id)
          .eq('booking_type', serviceType)
          .single();

        if (!error && data) {
          setCalculationDetails(data);
          if (__DEV__) console.log('✅ [InvoiceDisplay] Détails de calcul récupérés depuis la base:', data);
        } else {
          if (__DEV__) console.log('⚠️ [InvoiceDisplay] Pas de détails de calcul stockés, fallback sur recalcul');
        }
      } catch (err) {
        console.error('Erreur récupération détails calcul:', err);
      } finally {
        setLoadingCalcDetails(false);
      }
    };

    fetchCalculationDetails();
  }, [booking?.id, serviceType]);

  const snapshotCurrency = calculationDetails?.calculation_snapshot?.paymentCurrency;
  const snapshotRate = calculationDetails?.calculation_snapshot?.paymentRate;
  // Priorité à la devise choisie par l'utilisateur (EUR/USD) dans son compte, sinon devise de la réservation
  const displayCurrency = (currency !== 'XOF' ? currency : null) || snapshotCurrency || (booking as any)?.payment_currency || currency;
  const commissionRates = getCommissionRates(serviceType, displayCurrency as import('../lib/commissions').CurrencyCode);
  const displayRate =
    Number(snapshotRate) ||
    Number((booking as any)?.exchange_rate) ||
    (displayCurrency === 'EUR' ? Number(rates.EUR) : displayCurrency === 'USD' ? Number(rates.USD) : 0);

  const formatPriceFCFA = (amount: number): string => {
    if (displayCurrency === 'EUR' && displayRate > 0) {
      const eur = amount / displayRate;
      return `${eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
    if (displayCurrency === 'USD' && displayRate > 0) {
      const usd = amount / displayRate;
      return `${usd.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
    }
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  // ✅ Utiliser DIRECTEMENT les données stockées si disponibles, sinon recalculer (fallback uniquement)
  let effectiveServiceFee: number;
  let serviceFeeHT: number;
  let serviceFeeVAT: number;
  let hostCommission: number;
  let hostCommissionHT: number;
  let hostCommissionVAT: number;
  let hostNetAmount: number;
  let effectiveCleaningFee: number;
  let effectiveTaxes: number;
  let totalPaidByTraveler: number;
  let akwaHomeTotalRevenue: number;

  // Prix unitaire affiché : stocké à la réservation (calculation_snapshot) ou actuel (fallback)
  let effectivePricePerUnit = pricePerUnit;

  if (calculationDetails) {
    // ✅ UTILISER DIRECTEMENT les valeurs stockées - AUCUN calcul
    // Pour les propriétés : base_price, price_after_discount et prix/nuit au moment de la réservation
    if (serviceType === 'property') {
      basePrice = calculationDetails.base_price ?? basePrice;
      priceAfterDiscount = calculationDetails.price_after_discount ?? priceAfterDiscount;
      discountAmount = calculationDetails.discount_amount ?? discountAmount;
      actualDiscountAmount = discountAmount;
      daysPrice = basePrice; // Pour propriété, daysPrice = base_price (nuits × prix/nuit)
      effectivePricePerUnit = calculationDetails.calculation_snapshot?.pricePerNight
        ?? (nights > 0 ? Math.round((calculationDetails.base_price ?? 0) / nights) : pricePerUnit);
      if (__DEV__) {
        console.log('✅ [InvoiceDisplay] Utilisation données stockées propriété:', {
          base_price: basePrice,
          price_after_discount: priceAfterDiscount,
          effectivePricePerUnit,
          discount_amount: discountAmount,
        });
      }
    }
    // Pour les véhicules, utiliser aussi days_price, hours_price et driver_fee depuis calculationDetails
    if (serviceType === 'vehicle') {
      daysPrice = calculationDetails.days_price ?? daysPrice;
      hoursPrice = calculationDetails.hours_price ?? hoursPrice;
      basePrice = calculationDetails.base_price ?? basePrice; // ✅ Utiliser base_price stocké
      priceAfterDiscount = calculationDetails.price_after_discount ?? priceAfterDiscount; // ✅ Utiliser price_after_discount stocké
      // ✅ IMPORTANT: Utiliser ?? au lieu de || pour éviter que 0 soit remplacé par la valeur par défaut
      driverFee = calculationDetails.driver_fee ?? 0; // ✅ Utiliser driver_fee stocké (même si 0)
      priceAfterDiscountWithDriver = calculationDetails.base_price_with_driver ?? (priceAfterDiscount + driverFee); // ✅ Utiliser base_price_with_driver stocké
      effectivePricePerUnit = nights > 0 ? Math.round((calculationDetails.days_price ?? 0) / nights) : pricePerUnit;
      if (__DEV__) {
        console.log('✅ [InvoiceDisplay] Utilisation données stockées véhicule:', {
          'calculationDetails.driver_fee': calculationDetails.driver_fee,
          'driverFee final': driverFee,
          days_price: daysPrice,
          hours_price: hoursPrice,
          base_price: basePrice,
          price_after_discount: priceAfterDiscount,
          base_price_with_driver: priceAfterDiscountWithDriver,
          'type': type, // ✅ Ajouter type pour debug
        });
      }
    }
    
    effectiveServiceFee = calculationDetails.service_fee;
    serviceFeeHT = calculationDetails.service_fee_ht;
    serviceFeeVAT = calculationDetails.service_fee_vat;
    hostCommission = calculationDetails.host_commission;
    hostCommissionHT = calculationDetails.host_commission_ht;
    hostCommissionVAT = calculationDetails.host_commission_vat;
    hostNetAmount = calculationDetails.host_net_amount;
    effectiveCleaningFee = calculationDetails.effective_cleaning_fee || 0;
    effectiveTaxes = calculationDetails.effective_taxes || 0;
    totalPaidByTraveler = calculationDetails.total_price;
    akwaHomeTotalRevenue = effectiveServiceFee + hostCommission;
    
    if (__DEV__) {
      console.log('✅ [InvoiceDisplay] Utilisation DIRECTE des données stockées - AUCUN recalcul:', {
        host_net_amount: hostNetAmount,
        service_fee: effectiveServiceFee,
        host_commission: hostCommission,
        total_price: totalPaidByTraveler,
        driver_fee: driverFee, // ✅ Inclure driver_fee dans les logs
      });
    }
  } else {
    // ⚠️ FALLBACK: Recalculer uniquement pour les anciennes réservations sans données stockées
    if (__DEV__) console.log('⚠️ [InvoiceDisplay] Recalcul (fallback pour anciennes réservations)');
    
    // Frais de service (sans TVA)
    const priceForServiceFee = serviceType === 'vehicle' ? priceAfterDiscountWithDriver : priceAfterDiscount;
    serviceFeeHT = Math.round(priceForServiceFee * (commissionRates.travelerFeePercent / 100));
    serviceFeeVAT = 0;
    effectiveServiceFee = serviceFeeHT;
    
    // Commission hôte (sans TVA)
    // BUG FIX: Pour les véhicules, la commission est calculée sur priceAfterDiscountWithDriver (avec chauffeur)
    const priceForCommission = serviceType === 'vehicle' ? priceAfterDiscountWithDriver : priceAfterDiscount;
    const hostCommissionData = calculateHostCommission(priceForCommission, serviceType, displayCurrency as import('../lib/commissions').CurrencyCode);
    hostCommission = hostCommissionData.hostCommission;
    hostCommissionHT = hostCommissionData.hostCommissionHT;
    hostCommissionVAT = hostCommissionData.hostCommissionVAT;
    
    // Calculer les frais de ménage en tenant compte de free_cleaning_min_days
    // Utiliser le cleaningFee passé en paramètre si fourni, sinon utiliser celui de la propriété
    effectiveCleaningFee = cleaningFee !== undefined ? cleaningFee : (booking.properties?.cleaning_fee || 0);
    
    // Appliquer la logique free_cleaning_min_days si applicable
    if (serviceType === 'property' && booking.properties?.free_cleaning_min_days && nights >= booking.properties.free_cleaning_min_days) {
      effectiveCleaningFee = 0;
    }
    
    // Calculer effectiveTaxes pour le fallback
    effectiveTaxes = serviceType === 'property' ? taxesPerNight * nights : 0;
    
    // Calculer le total payé : prix après réduction + frais de service + frais de ménage + taxes
    // BUG FIX: Pour les véhicules, utiliser priceAfterDiscountWithDriver (avec chauffeur)
    const priceForTotal = serviceType === 'vehicle' ? priceAfterDiscountWithDriver : priceAfterDiscount;
    const calculatedTotal = priceForTotal + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;
    // Pour les véhicules, toujours utiliser le calcul pour s'assurer que les frais de service sont inclus
    // (même si booking.total_price existe, il peut ne pas inclure les frais de service pour les anciennes réservations)
    // Priorité au montant stocké en base (booking.total_price) pour éviter les écarts quand le prix/nuit a été modifié
    totalPaidByTraveler = (serviceType === 'vehicle') 
      ? (booking.total_price && typeof booking.total_price === 'number') ? booking.total_price : calculatedTotal
      : (booking.total_price && typeof booking.total_price === 'number') ? booking.total_price : calculatedTotal;
    
    // Calculer hostNetAmount
    if (serviceType === 'vehicle') {
      hostNetAmount = priceAfterDiscountWithDriver - hostCommission;
    } else {
      const result = calculateHostNetAmountCentralized({
        pricePerNight: effectivePricePerUnit,
        nights: nights,
        discountAmount: actualDiscountAmount,
        cleaningFee: effectiveCleaningFee,
        taxesPerNight: taxesPerNight,
        freeCleaningMinDays: booking.properties?.free_cleaning_min_days || null,
        status: booking.status || 'confirmed',
        serviceType: serviceType,
        currency: displayCurrency as import('../lib/commissions').CurrencyCode,
      });
      hostNetAmount = result.hostNetAmount;
    }
    
    akwaHomeTotalRevenue = effectiveServiceFee + hostCommission;
  }
  
  // Récupérer la caution pour les véhicules
  const securityDeposit = serviceType === 'vehicle' 
    ? ((booking as any).security_deposit || (booking as any).vehicle?.security_deposit || 0)
    : 0;

  // Paiement partiel : 100 % des frais de service au premier paiement, le reste en 50/50
  const splitFirstPayment = booking.payment_plan === 'split'
    ? Math.round((totalPaidByTraveler - (effectiveServiceFee ?? 0)) * 0.5) + (effectiveServiceFee ?? 0)
    : 0;
  const splitRemaining = booking.payment_plan === 'split' ? totalPaidByTraveler - splitFirstPayment : 0;
  
  if (__DEV__ && serviceType === 'vehicle') {
    console.log('🔍 [InvoiceDisplay] Caution:', {
      securityDeposit,
      booking_security_deposit: (booking as any).security_deposit,
      vehicle_security_deposit: (booking as any).vehicle?.security_deposit,
      type
    });
  }

  // Fonction pour envoyer la facture par email
  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPDF(true);

      // Déterminer le type d'email et le destinataire selon le serviceType
      let emailType: string;
      let recipientEmail: string | undefined;

      if (serviceType === 'property') {
        emailType = 'send_invoice_by_email';
        
        recipientEmail = type === 'traveler' 
          ? travelerEmail 
          : type === 'host' 
          ? hostEmail 
          : 'contact@akwahome.com';
      } else {
        // Pour les véhicules
        emailType = 'send_vehicle_invoice_by_email';
        
        recipientEmail = type === 'traveler' 
          ? travelerEmail 
          : type === 'host' 
          ? hostEmail 
          : 'contact@akwahome.com';
      }

      // Si l'email n'est toujours pas disponible, essayer de le récupérer une dernière fois
      if (!recipientEmail) {
        // Pour le voyageur, utiliser l'email de l'utilisateur connecté
        if (type === 'traveler' && user?.email) {
          recipientEmail = user.email;
        } else if (type === 'host' && user?.email) {
          // Pour l'hôte, utiliser l'email de l'utilisateur connecté
          recipientEmail = user.email;
        }
      }

      if (!recipientEmail) {
        throw new Error('Adresse email non disponible. Veuillez vérifier votre profil et réessayer.');
      }

      // Préparer les données pour l'email (l'Edge Function générera automatiquement le PDF)
      let emailData: any;

      if (serviceType === 'property') {
        emailData = {
          bookingId: booking.id,
          bookingCode: (booking as any).booking_code,
          created_at: (booking as any).created_at,
          bookingDate: (booking as any).created_at,
          recipientName: type === 'traveler' ? (travelerName || 'Voyageur') : (hostName || 'Hôte'),
          invoiceType: type === 'traveler' ? 'traveler' : 'host',
          propertyTitle: propertyOrVehicleTitle || '',
          checkIn: checkIn,
          checkOut: checkOut,
          guestsCount: booking.guests_count,
          totalPrice: totalPaidByTraveler,
          host_net_amount: hostNetAmount, // Inclure host_net_amount calculé
          discountApplied: actualDiscountAmount > 0,
          discountAmount: actualDiscountAmount,
          discount_applied: actualDiscountAmount > 0,
          discount_amount: actualDiscountAmount, // Utiliser snake_case
          originalTotal: booking.original_total || booking.total_price || totalPaidByTraveler,
          status: booking.status || 'confirmed',
          serviceType: 'property',
          property: {
            title: propertyOrVehicleTitle || '',
            address: booking.properties?.address || '',
            city_name: booking.properties?.locations?.name || '',
            price_per_night: effectivePricePerUnit,
            cleaning_fee: booking.properties?.cleaning_fee || 0, // Utiliser la valeur brute, pas effectiveCleaningFee
            service_fee: booking.properties?.service_fee || 0,
            taxes: taxesPerNight, // Utiliser taxesPerNight (par nuit), pas effectiveTaxes
            free_cleaning_min_days: booking.properties?.free_cleaning_min_days || null, // Important pour le calcul
            // BUG FIX: Ajouter les données de réduction pour que le PDF puisse recalculer correctement
            discount_enabled: booking.properties?.discount_enabled || false,
            discount_min_nights: booking.properties?.discount_min_nights || null,
            discount_percentage: booking.properties?.discount_percentage || null,
            long_stay_discount_enabled: booking.properties?.long_stay_discount_enabled || false,
            long_stay_discount_min_nights: booking.properties?.long_stay_discount_min_nights || null,
            long_stay_discount_percentage: booking.properties?.long_stay_discount_percentage || null,
            cancellation_policy: booking.properties?.cancellation_policy || 'flexible',
            check_in_time: booking.properties?.check_in_time,
            check_out_time: booking.properties?.check_out_time,
            house_rules: booking.properties?.house_rules || '',
          },
          guest: {
            first_name: travelerName?.split(' ')[0] || '',
            last_name: travelerName?.split(' ').slice(1).join(' ') || '',
            email: travelerEmail,
            phone: travelerPhone,
          },
          host: {
            first_name: hostName?.split(' ')[0] || '',
            last_name: hostName?.split(' ').slice(1).join(' ') || '',
            email: hostEmail,
            phone: hostPhone,
          },
          payment_method: effectivePaymentMethod,
          payment_plan: booking.payment_plan || '',
          payment_currency: displayCurrency,
          exchange_rate: displayRate > 0 ? displayRate : (displayCurrency === 'EUR' ? 655.957 : displayCurrency === 'USD' ? 600 : undefined),
          preferCurrency: displayCurrency,
          host_pending_penalty_deduct: type === 'host' ? hostPendingPenaltyDeduct : undefined,
        };
      } else {
        // Pour les véhicules - format attendu par l'Edge Function
        emailData = {
          bookingId: booking.id,
          vehicleBookingCode: (booking as any).vehicle_booking_code,
          created_at: (booking as any).created_at,
          bookingDate: (booking as any).created_at,
          recipientName: type === 'traveler' ? (travelerName || 'Locataire') : (hostName || 'Propriétaire'),
          invoiceType: type === 'traveler' ? 'renter' : 'owner',
          vehicleTitle: propertyOrVehicleTitle || '',
          vehicleBrand: booking.vehicle?.brand || '',
          vehicleModel: booking.vehicle?.model || '',
          vehicleYear: booking.vehicle?.year || '',
          fuelType: booking.vehicle?.fuel_type || '',
          renterName: travelerName || '',
          renterEmail: travelerEmail,
          renterPhone: travelerPhone,
          ownerName: hostName || '',
          ownerEmail: hostEmail,
          ownerPhone: hostPhone,
          startDate: checkIn,
          endDate: checkOut,
          startDateTime: approvedModification?.requested_start_datetime || (booking as any).start_datetime || undefined,
          endDateTime: approvedModification?.requested_end_datetime || (booking as any).end_datetime || undefined,
          rentalDays: nights,
          rentalHours: rentalHours,
          dailyRate: effectivePricePerUnit,
          hourlyRate: hourlyRate,
          basePrice: priceAfterDiscount,
          totalPrice: totalPaidByTraveler,
          ownerNetRevenue: serviceType === 'vehicle' && type === 'host' ? hostNetAmount : undefined, // Revenu net du propriétaire pour les véhicules
          discountAmount: actualDiscountAmount,
          vehicleDiscountEnabled: booking.vehicle?.discount_enabled || false,
          vehicleDiscountMinDays: booking.vehicle?.discount_min_days || null,
          vehicleDiscountPercentage: booking.vehicle?.discount_percentage || null,
          vehicleLongStayDiscountEnabled: booking.vehicle?.long_stay_discount_enabled || false,
          vehicleLongStayDiscountMinDays: booking.vehicle?.long_stay_discount_min_days || null,
          vehicleLongStayDiscountPercentage: booking.vehicle?.long_stay_discount_percentage || null,
          securityDeposit: booking.vehicle?.security_deposit || 0,
          paymentMethod: effectivePaymentMethod,
          withDriver: (booking as any).with_driver || booking.vehicle?.with_driver || false, // Vérifier booking.with_driver en priorité
          vehicleDriverFee: booking.vehicle?.driver_fee || 0, // BUG FIX: Ajouter vehicleDriverFee pour le calcul PDF
          payment_currency: displayCurrency,
          exchange_rate: displayRate > 0 ? displayRate : (displayCurrency === 'EUR' ? 655.957 : displayCurrency === 'USD' ? 600 : undefined),
          preferCurrency: displayCurrency,
          host_pending_penalty_deduct: type === 'host' ? hostPendingPenaltyDeduct : undefined,
        };
      }

      // Envoyer l'email avec le PDF généré automatiquement
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: emailType,
          to: recipientEmail,
          data: emailData,
        }
      });

      if (emailError) {
        throw new Error(`Erreur envoi email: ${emailError.message || 'Impossible d\'envoyer l\'email'}`);
      }

      Alert.alert(
        'Succès',
        `La facture a été envoyée par email à ${recipientEmail}.\n\nVérifiez votre boîte mail (y compris les spams).`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi de la facture par email:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible d\'envoyer la facture par email. Veuillez réessayer.'
      );
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'traveler':
        return serviceType === 'vehicle' ? 'Justificatif locataire' : 'Justificatif voyageur';
      case 'host': return 'Justificatif hôte';
      case 'admin': return 'Facture interne Akwahome';
    }
  };

  return (
    <View style={styles.container}>
      {/* En-tête avec logo */}
      <View style={styles.header}>
        <Image
          source={akwaHomeLogo}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <Text style={styles.headerType} numberOfLines={2}>{getTitle()}</Text>
        </View>
      </View>

      {/* Type de service */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type de service</Text>
        <Text style={styles.sectionValue}>{getServiceTypeLabel(serviceType)}</Text>
      </View>

      {/* Détails: numéro de réservation (code AKWA) */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Numéro de réservation</Text>
        <Text style={styles.sectionValue} numberOfLines={2}>
          {(booking as any).vehicle_booking_code || (booking as any).booking_code || `AKWA-${(booking.id || '').toString().substring(0, 8).toUpperCase()}`}
        </Text>
      </View>

      {/* Titre propriété/véhicule */}
      {propertyOrVehicleTitle && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {serviceType === 'property' ? 'Propriété' : 'Véhicule'}
          </Text>
          <Text style={styles.sectionValue}>{propertyOrVehicleTitle}</Text>
        </View>
      )}

      {/* Dates */}
      <View style={styles.datesRow}>
        <View style={styles.dateItem}>
          <Text style={styles.sectionLabel}>
            {serviceType === 'property' ? 'Arrivée' : 'Début'}
          </Text>
          <Text style={styles.sectionValue}>
            {serviceType === 'vehicle' 
              ? formatDateWithTime(
                  approvedModification?.requested_start_date || checkIn, 
                  approvedModification?.requested_start_datetime || (booking as any).start_datetime || undefined
                )
              : formatDate(checkIn)}
          </Text>
        </View>
        <View style={styles.dateItem}>
          <Text style={styles.sectionLabel}>
            {serviceType === 'property' ? 'Départ' : 'Fin'}
          </Text>
          <Text style={styles.sectionValue}>
            {serviceType === 'vehicle' 
              ? formatDateWithTime(
                  approvedModification?.requested_end_date || checkOut, 
                  approvedModification?.requested_end_datetime || (booking as any).end_datetime || undefined
                )
              : formatDate(checkOut)}
          </Text>
        </View>
      </View>

      {/* Durée - uniquement pour les propriétés */}
      {serviceType === 'property' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Durée</Text>
          <Text style={styles.sectionValue}>
            {String(nights)} {`nuit${nights > 1 ? 's' : ''}`}
          </Text>
        </View>
      )}

      {/* Avec chauffeur (véhicules uniquement) */}
      {serviceType === 'vehicle' && (booking as any).vehicle?.with_driver && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Service</Text>
          <Text style={styles.sectionValue}>Location avec chauffeur</Text>
        </View>
      )}

      {/* Nombre de voyageurs (propriétés uniquement) */}
      {serviceType === 'property' && booking.guests_count && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Voyageurs</Text>
          <Text style={styles.sectionValue}>{booking.guests_count}</Text>
        </View>
      )}

      {/* Section Modification de séjour */}
      {approvedModification && (
        <View style={styles.extensionSection}>
          <View style={styles.extensionHeader}>
            <Ionicons name="calendar-outline" size={20} color="#2563eb" />
            <Text style={styles.extensionTitle}>Modification de séjour</Text>
          </View>
          
          <View style={styles.extensionContent}>
            <View style={styles.extensionRow}>
              <Text style={styles.extensionLabel}>Dates originales:</Text>
              <Text style={styles.extensionValue}>
                {serviceType === 'property'
                  ? `${formatDate(approvedModification.original_check_in)} - ${formatDate(approvedModification.original_check_out)}`
                  : `${formatDateWithTime(approvedModification.original_start_date, approvedModification.original_start_datetime)} au ${formatDateWithTime(approvedModification.original_end_date, approvedModification.original_end_datetime)}`
                }
              </Text>
            </View>
            
            <View style={styles.extensionRow}>
              <Text style={styles.extensionLabel}>Nouvelles dates:</Text>
              <Text style={[styles.extensionValue, styles.extensionValueNew]}>
                {serviceType === 'property'
                  ? `${formatDate(approvedModification.requested_check_in)} - ${formatDate(approvedModification.requested_check_out)}`
                  : `${formatDateWithTime(approvedModification.requested_start_date, approvedModification.requested_start_datetime)} au ${formatDateWithTime(approvedModification.requested_end_date, approvedModification.requested_end_datetime)}`
                }
              </Text>
            </View>

            {serviceType === 'property' && approvedModification.original_guests_count !== approvedModification.requested_guests_count && (
              <View style={styles.extensionRow}>
                <Text style={styles.extensionLabel}>Nombre de voyageurs:</Text>
                <Text style={styles.extensionValue}>
                  {String(approvedModification.original_guests_count || 0)} → {String(approvedModification.requested_guests_count || 0)}
                </Text>
              </View>
            )}
            
            {serviceType === 'vehicle' && (approvedModification.original_rental_days !== approvedModification.requested_rental_days || (approvedModification.original_rental_hours || 0) !== (approvedModification.requested_rental_hours || 0)) && (
              <View style={styles.extensionRow}>
                <Text style={styles.extensionLabel}>Durée de location:</Text>
                <Text style={styles.extensionValue}>
                  {String(approvedModification.original_rental_days || 0)} jour{approvedModification.original_rental_days > 1 ? 's' : ''}
                  {approvedModification.original_rental_hours && approvedModification.original_rental_hours > 0 && ` et ${approvedModification.original_rental_hours} heure${approvedModification.original_rental_hours > 1 ? 's' : ''}`}
                  {' → '}
                  {String(approvedModification.requested_rental_days || 0)} jour{approvedModification.requested_rental_days > 1 ? 's' : ''}
                  {approvedModification.requested_rental_hours && approvedModification.requested_rental_hours > 0 && ` et ${approvedModification.requested_rental_hours} heure${approvedModification.requested_rental_hours > 1 ? 's' : ''}`}
                </Text>
              </View>
            )}

            {approvedModification.requested_total_price > approvedModification.original_total_price && (
              <View style={styles.extensionRow}>
                <Text style={styles.extensionLabel}>Surplus payé:</Text>
                <Text style={[styles.extensionValue, styles.extensionValueAmount]}>
                  {formatPriceFCFA(approvedModification.requested_total_price - approvedModification.original_total_price)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Heures d'arrivée et de départ (propriétés uniquement) */}
      {serviceType === 'property' && (booking.properties?.check_in_time || booking.properties?.check_out_time) && (
        <View style={styles.section}>
          <View style={styles.datesRow}>
            {booking.properties?.check_in_time && (
              <View style={styles.dateItem}>
                <Text style={styles.sectionLabel}>Heure d'arrivée</Text>
                <Text style={styles.sectionValue}>{formatTime(booking.properties.check_in_time)}</Text>
              </View>
            )}
            {booking.properties?.check_out_time && (
              <View style={styles.dateItem}>
                <Text style={styles.sectionLabel}>Heure de départ</Text>
                <Text style={styles.sectionValue}>{formatTime(booking.properties.check_out_time)}</Text>
              </View>
            )}
          </View>
        </View>
      )}
      
      {serviceType === 'vehicle' && booking.vehicle?.rules && booking.vehicle.rules.length > 0 && (
        <View style={styles.rulesSection}>
          <View style={styles.rulesHeader}>
            <Ionicons name="document-text-outline" size={18} color="#2563eb" />
            <Text style={styles.rulesTitle}>Règles de location</Text>
          </View>
          {booking.vehicle.rules.map((rule, index) => (
            <Text key={index} style={styles.rulesText}>
              • {rule}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.separator} />

      {/* === FACTURE VOYAGEUR === */}
      {type === 'traveler' && (
        <View style={styles.financialSection}>
          <Text style={styles.financialTitle}>Détails du paiement</Text>
          
          {/* Prix des jours */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              {String(nights)} {serviceType === 'property' ? 'nuit' : 'jour'}{nights > 1 ? 's' : ''} × {formatPriceFCFA(effectivePricePerUnit)}/{serviceType === 'property' ? 'nuit' : 'jour'}
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(daysPrice)}</Text>
          </View>
          
          {/* Prix des heures supplémentaires pour les véhicules */}
          {serviceType === 'vehicle' && rentalHours > 0 && hoursPrice > 0 && hourlyRate > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                {rentalHours} heure{rentalHours > 1 ? 's' : ''} × {formatPriceFCFA(hourlyRate)}/h
              </Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(hoursPrice)}</Text>
            </View>
          )}
          
          {/* Surplus chauffeur pour les véhicules */}
          {serviceType === 'vehicle' && driverFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Surplus chauffeur</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(driverFee)}</Text>
            </View>
          )}
          
          {/* Total avant réduction */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Prix initial{serviceType === 'property' ? ` (${String(nights)} ${nights > 1 ? 'nuits' : 'nuit'})` : ''}
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
          </View>

          {/* Réduction */}
          {actualDiscountAmount > 0 && (
            <>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, styles.discountText]}>Réduction appliquée</Text>
                <Text style={[styles.financialValue, styles.discountText]}>
                  -{formatPriceFCFA(actualDiscountAmount)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix après réduction</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
              </View>
            </>
          )}

          {/* Frais de ménage */}
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          {/* Taxe de séjour - toujours afficher si taxesPerNight > 0 */}
          {(effectiveTaxes > 0 || (serviceType === 'property' && taxesPerNight > 0 && nights > 0)) && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Taxe de séjour</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveTaxes > 0 ? effectiveTaxes : taxesPerNight * nights)}</Text>
            </View>
          )}

          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Frais de service Akwahome
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
          </View>

          <View style={styles.separator} />

          {/* Total */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Total {booking.payment_plan === 'split' ? 'de la réservation' : 'payé'}</Text>
            <Text style={styles.totalValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>
          {booking.payment_plan === 'split' && (
            <>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Payé à la réservation</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(splitFirstPayment)}</Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Restant à l'arrivée</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(splitRemaining)}</Text>
              </View>
            </>
          )}

          {/* Caution pour les véhicules */}
          {serviceType === 'vehicle' && securityDeposit > 0 && (
            <View style={styles.financialRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.financialLabel}>Caution</Text>
                <Text style={[styles.financialLabel, { fontSize: 12, color: '#666', marginTop: 4 }]}>
                  À payer en espèces lors de la récupération du véhicule
                </Text>
              </View>
              <Text style={styles.financialValue}>{formatPriceFCFA(securityDeposit)}</Text>
            </View>
          )}

          {/* Mode de paiement */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Mode de paiement</Text>
            <Text style={styles.financialValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>

          {/* Contact hôte */}
          {hostName && hostPhone && (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'completed') && (
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Ionicons name="call-outline" size={16} color="#333" />
                <Text style={styles.contactTitle}>Contact de l'hôte</Text>
              </View>
              <Text style={styles.contactName}>{hostName}</Text>
              <Text style={styles.contactPhone}>{hostPhone}</Text>
            </View>
          )}
        </View>
      )}

      {/* === JUSTIFICATIF HÔTE === */}
      {type === 'host' && (
        <View style={styles.financialSection}>
          {/* Détails du paiement du voyageur/locataire */}
          <Text style={styles.financialTitle}>Détails du paiement {serviceType === 'property' ? 'du voyageur' : 'du locataire'}</Text>
          
          {/* Prix des jours */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              {String(nights)} {serviceType === 'property' ? 'nuit' : 'jour'}{nights > 1 ? 's' : ''} × {formatPriceFCFA(effectivePricePerUnit)}/{serviceType === 'property' ? 'nuit' : 'jour'}
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(daysPrice)}</Text>
          </View>
          
          {/* Prix des heures supplémentaires pour les véhicules */}
          {serviceType === 'vehicle' && rentalHours > 0 && hoursPrice > 0 && hourlyRate > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                {rentalHours} heure{rentalHours > 1 ? 's' : ''} × {formatPriceFCFA(hourlyRate)}/h
              </Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(hoursPrice)}</Text>
            </View>
          )}
          
          {/* Surplus chauffeur pour les véhicules */}
          {serviceType === 'vehicle' && driverFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Surplus chauffeur</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(driverFee)}</Text>
            </View>
          )}
          
          {/* Total avant réduction */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Prix initial{serviceType === 'property' ? ` (${String(nights)} ${nights > 1 ? 'nuits' : 'nuit'})` : ''}
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
          </View>

          {/* Réduction */}
          {actualDiscountAmount > 0 && (
            <>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, styles.discountText]}>Réduction appliquée</Text>
                <Text style={[styles.financialValue, styles.discountText]}>
                  -{formatPriceFCFA(actualDiscountAmount)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix après réduction</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
              </View>
            </>
          )}

          {/* Frais de ménage */}
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          {/* Taxe de séjour - toujours afficher si taxesPerNight > 0 */}
          {(effectiveTaxes > 0 || (serviceType === 'property' && taxesPerNight > 0 && nights > 0)) && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Taxe de séjour</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveTaxes > 0 ? effectiveTaxes : taxesPerNight * nights)}</Text>
            </View>
          )}

          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Frais de service Akwahome
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
          </View>

          <View style={styles.separator} />

          {/* Total payé par le voyageur */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Total {booking.payment_plan === 'split' ? 'de la réservation' : 'payé'} {serviceType === 'property' ? 'par le voyageur' : 'par le locataire'}</Text>
            <Text style={styles.totalValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>
          {booking.payment_plan === 'split' && (
            <>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Payé à la réservation</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(splitFirstPayment)}</Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Restant à l'arrivée</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(splitRemaining)}</Text>
              </View>
            </>
          )}

          {/* Caution pour les véhicules */}
          {serviceType === 'vehicle' && securityDeposit > 0 && (
            <View style={styles.financialRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.financialLabel}>Caution</Text>
                <Text style={[styles.financialLabel, { fontSize: 12, color: '#666', marginTop: 4 }]}>
                  À payer en espèces lors de la récupération du véhicule
                </Text>
              </View>
              <Text style={styles.financialValue}>{formatPriceFCFA(securityDeposit)}</Text>
            </View>
          )}

          <View style={styles.separator} />

          {/* Versement de l'hôte/propriétaire */}
          <Text style={styles.financialTitle}>Votre versement</Text>
          
          {/* Prix initial */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Prix initial{serviceType === 'property' ? ` (${String(nights)} ${nights > 1 ? 'nuits' : 'nuit'})` : ''}
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
          </View>

          {/* Réduction */}
          {actualDiscountAmount > 0 && (
            <>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, styles.discountText]}>Réduction appliquée</Text>
                <Text style={[styles.financialValue, styles.discountText]}>
                  -{formatPriceFCFA(actualDiscountAmount)}
                </Text>
              </View>
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Prix après réduction</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
              </View>
            </>
          )}

          {/* Surplus chauffeur pour les véhicules - dans la section "Votre versement" */}
          {serviceType === 'vehicle' && driverFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Surplus chauffeur</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(driverFee)}</Text>
            </View>
          )}

          {/* Montant de la réservation (pour véhicules: avec chauffeur si applicable, sinon prix après réduction) */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Montant de la réservation</Text>
            <Text style={styles.financialValue}>
              {formatPriceFCFA(serviceType === 'vehicle' ? priceAfterDiscountWithDriver : priceAfterDiscount)}
            </Text>
          </View>

          {/* Frais de ménage */}
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          {/* Taxe de séjour */}
          {effectiveTaxes > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Taxe de séjour</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveTaxes)}</Text>
            </View>
          )}

          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Commission Akwahome ({commissionRates.hostFeePercent}%)
            </Text>
            <Text style={[styles.financialValue, styles.commissionText]}>
              -{formatPriceFCFA(hostCommission)}
            </Text>
          </View>

          <View style={styles.separator} />

          {/* Gain net */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Vous recevez</Text>
            <Text style={[styles.totalValue, styles.netAmountText]}>
              {formatPriceFCFA(hostNetAmount)}
            </Text>
          </View>

          {/* Pénalité à déduire de la prochaine paie (choix "prélèvement sur prochaine réservation") */}
          {hostPendingPenaltyDeduct > 0 && (
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, styles.penaltyDeductLabel]}>
                Pénalité d'annulation (sera déduite de votre prochaine paie)
              </Text>
              <Text style={[styles.financialValue, styles.penaltyDeductValue]}>
                -{formatPriceFCFA(hostPendingPenaltyDeduct)}
              </Text>
            </View>
          )}

          {/* Mode de paiement */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Mode de paiement</Text>
            <Text style={styles.financialValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>

          {/* Contact voyageur */}
          {travelerName && travelerPhone && (
            <View style={styles.contactSection}>
              <View style={styles.contactHeader}>
                <Ionicons name="call-outline" size={16} color="#333" />
                <Text style={styles.contactTitle}>Contact {serviceType === 'property' ? 'du voyageur' : 'du locataire'}</Text>
              </View>
              <Text style={styles.contactName}>{travelerName}</Text>
              <Text style={styles.contactPhone}>{travelerPhone}</Text>
            </View>
          )}
        </View>
      )}

      {/* === FACTURE INTERNE ADMIN === */}
      {type === 'admin' && (
        <View style={styles.financialSection}>
          {/* Infos voyageur */}
          {travelerName && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>Voyageur</Text>
              <Text style={styles.infoBoxText}>{travelerName}</Text>
              {travelerEmail && <Text style={styles.infoBoxSubtext}>{travelerEmail}</Text>}
              {travelerPhone && <Text style={styles.infoBoxSubtext}>{travelerPhone}</Text>}
            </View>
          )}

          {/* Infos hôte */}
          {hostName && (
            <View style={[styles.infoBox, styles.hostInfoBox]}>
              <Text style={styles.infoBoxTitle}>Hôte/Propriétaire</Text>
              <Text style={styles.infoBoxText}>{hostName}</Text>
              {hostEmail && <Text style={styles.infoBoxSubtext}>{hostEmail}</Text>}
              {hostPhone && <Text style={styles.infoBoxSubtext}>{hostPhone}</Text>}
            </View>
          )}

          <View style={styles.separator} />

          <Text style={styles.financialTitle}>Détails financiers complets</Text>
          
          {/* Prix initial */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Prix initial</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
          </View>

          {/* Réduction */}
          {discountAmount > 0 && (
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, styles.discountText]}>Réduction appliquée</Text>
              <Text style={[styles.financialValue, styles.discountText]}>
                -{formatPriceFCFA(discountAmount)}
              </Text>
            </View>
          )}

          {/* Prix après réduction */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Prix après réduction</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
          </View>

          {/* Frais de ménage */}
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          <View style={styles.separator} />

          <View style={styles.commissionBox}>
            <Text style={styles.commissionBoxTitle}>Commissions Akwahome</Text>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de service voyageur</Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(effectiveServiceFee)}
              </Text>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Commission hôte ({commissionRates.hostFeePercent}%)
              </Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(hostCommission)}
              </Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.financialRow}>
              <Text style={styles.totalLabel}>Revenu total Akwahome</Text>
              <Text style={[styles.totalValue, styles.commissionTotal]}>
                {formatPriceFCFA(serviceFeeHT + hostCommissionHT)}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Résumé */}
          <View style={styles.summaryRow}>
            <Text style={styles.financialLabel}>Total {booking.payment_plan === 'split' ? 'de la réservation' : 'payé'} par le voyageur</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>
          {booking.payment_plan === 'split' && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.financialLabel}>Payé à la réservation</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(splitFirstPayment)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.financialLabel}>Restant à l'arrivée</Text>
                <Text style={styles.financialValue}>{formatPriceFCFA(splitRemaining)}</Text>
              </View>
            </>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.financialLabel}>Versement net à l'hôte</Text>
            <Text style={[styles.financialValue, styles.netAmountText]}>
              {formatPriceFCFA(hostNetAmount)}
            </Text>
          </View>

          {/* Mode de paiement */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>Mode de paiement</Text>
            <Text style={styles.financialValue}>{getPaymentMethodLabel(effectivePaymentMethod)}</Text>
          </View>
        </View>
      )}

      {/* Conditions d'annulation */}
      <View style={styles.cancellationSection}>
        <View style={styles.cancellationHeader}>
          <Ionicons name="information-circle-outline" size={18} color="#f59e0b" />
          <Text style={styles.cancellationTitle}>Politique d'annulation</Text>
        </View>
        <Text style={styles.cancellationText}>
          {getCancellationPolicyText(
            serviceType === 'property' ? booking.properties?.cancellation_policy : booking.vehicle?.cancellation_policy,
            serviceType
          )}
        </Text>
      </View>

      {/* Règlement intérieur / Règles - Après la politique d'annulation */}
      {serviceType === 'property' && booking.properties?.house_rules && (
        <View style={styles.rulesSection}>
          <View style={styles.rulesHeader}>
            <Ionicons name="document-text-outline" size={18} color="#2563eb" />
            <Text style={styles.rulesTitle}>Règlement intérieur</Text>
          </View>
          <Text style={styles.rulesText}>{booking.properties.house_rules}</Text>
        </View>
      )}

      {/* Date de réservation */}
      {booking.created_at && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Date de réservation: {formatDateTime(booking.created_at)}
          </Text>
        </View>
      )}

      {/* Pied de page avec logo */}
      <View style={styles.footerSection}>
        <Image
          source={akwaHomeLogo}
          style={styles.footerLogo}
          resizeMode="contain"
        />
        <Text style={styles.footerBrandText}>
          AkwaHome - Votre plateforme de réservation en Côte d'Ivoire
        </Text>
        <Text style={styles.footerNcc}>NCC:2507662T</Text>
      </View>

      {/* Bouton de téléchargement PDF */}
      <View style={styles.downloadSection}>
        <TouchableOpacity 
          style={[styles.downloadButton, isDownloadingPDF && styles.downloadButtonDisabled]}
          onPress={handleDownloadPDF}
          disabled={isDownloadingPDF}
        >
          {isDownloadingPDF ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.downloadButtonText}>Envoi en cours...</Text>
            </>
          ) : (
            <>
              <Ionicons name="mail-outline" size={20} color="#fff" />
              <Text style={styles.downloadButtonText}>Envoyer la facture par email</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#F97316',
  },
  logo: {
    height: 48,
    width: 120,
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 12,
    minWidth: 0,
  },
  headerType: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  section: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  financialSection: {
    marginTop: 8,
  },
  financialTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  financialLabel: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  financialValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  discountText: {
    color: '#059669',
  },
  discountNote: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  commissionText: {
    color: '#dc2626',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  netAmountText: {
    color: '#059669',
  },
  penaltyDeductLabel: {
    color: '#b45309',
  },
  penaltyDeductValue: {
    color: '#b45309',
    fontWeight: '600',
  },
  contactSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 13,
    color: '#2563eb',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  hostInfoBox: {
    backgroundColor: '#f0fdf4',
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
  },
  infoBoxSubtext: {
    fontSize: 11,
    color: '#6b7280',
  },
  commissionBox: {
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  commissionBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c2410c',
    marginBottom: 8,
  },
  commissionValue: {
    color: '#ea580c',
  },
  commissionTotal: {
    color: '#c2410c',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rulesSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 6,
  },
  rulesText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  extensionSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  extensionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  extensionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 6,
  },
  extensionContent: {
    gap: 8,
  },
  extensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  extensionLabel: {
    fontSize: 13,
    color: '#6b7280',
    flex: 1,
  },
  extensionValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  extensionValueNew: {
    color: '#059669',
    fontWeight: '600',
  },
  extensionValueAmount: {
    color: '#2563eb',
    fontWeight: '600',
  },
  cancellationSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  cancellationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cancellationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 6,
  },
  cancellationText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  footerSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#F97316',
    alignItems: 'center',
  },
  footerLogo: {
    height: 32,
    width: 100,
    marginBottom: 8,
    opacity: 0.5,
  },
  footerBrandText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  footerNcc: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  // Styles pour détails TVA
  vatDetailsContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  vatDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vatDetailLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  vatDetailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  vatInvoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  vatInvoiceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007bff',
    marginLeft: 6,
  },
  // Styles pour modal facture avec TVA
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '95%',
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  vatInvoiceSection: {
    marginBottom: 24,
  },
  vatInvoiceSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  vatInvoiceCompanyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vatInvoiceAddress: {
    fontSize: 13,
    color: '#6b7280',
  },
  vatInvoiceRecipientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  vatInvoiceRecipientDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  vatInvoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vatInvoiceLabel: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  vatInvoiceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  vatInvoiceDescription: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  vatInvoiceDetailsTable: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  vatInvoiceTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  vatInvoiceTableLabel: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
  },
  vatInvoiceTableValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  vatInvoiceSeparator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  vatInvoiceSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vatInvoiceSubtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  vatInvoiceSubtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  // Styles pour bouton de téléchargement
  downloadSection: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default InvoiceDisplay;
