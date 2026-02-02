import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCommissionRates, type ServiceType } from '../lib/commissions';
import { calculateTotalPrice, calculateHostCommission, calculateVehiclePriceWithHours, type DiscountConfig } from '../hooks/usePricing';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import akwaHomeLogo from '../../assets/images/akwahome_logo.png';

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

const formatDateWithTime = (dateString?: string, dateTimeString?: string): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    if (dateTimeString) {
      const time = new Date(dateTimeString);
      const timeFormatted = time.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
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

const getCancellationPolicyText = (policy?: string | null, serviceType: ServiceType = 'property'): string => {
  if (!policy) {
    return serviceType === 'property' 
      ? 'Annulation gratuite jusqu\'à 1 jour avant l\'arrivée. Remboursement intégral.'
      : 'Annulation gratuite jusqu\'à 7 jours avant. Remboursement intégral.';
  }

  if (serviceType === 'property') {
    switch (policy) {
      case 'flexible':
        return 'Annulation gratuite jusqu\'à 24h avant l\'arrivée. Remboursement intégral.';
      case 'moderate':
        return 'Annulation gratuite jusqu\'à 5 jours avant l\'arrivée. Après, 50% de pénalité.';
      case 'strict':
        return 'Annulation gratuite jusqu\'à 7 jours avant l\'arrivée. Après, 50% de pénalité.';
      case 'non_refundable':
        return 'Aucun remboursement en cas d\'annulation.';
      default:
        return 'Annulation gratuite jusqu\'à 1 jour avant l\'arrivée. Remboursement intégral.';
    }
  } else {
    // Pour les véhicules, les règles sont différentes
    return 'Annulation gratuite jusqu\'à 7 jours avant. Entre 3 et 7 jours : 10% de pénalité. Moins de 3 jours : 20% de pénalité.';
  }
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
  const [showVATInvoice, setShowVATInvoice] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [travelerEmail, setTravelerEmail] = useState<string | undefined>(providedTravelerEmail);
  const [hostEmail, setHostEmail] = useState<string | undefined>(providedHostEmail);
  const [approvedModification, setApprovedModification] = useState<any>(null);

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
    console.log('🔍 [InvoiceDisplay] Dates véhicule:', {
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
  
  const commissionRates = getCommissionRates(serviceType);
  
  // Pour les véhicules, calculer le prix des heures supplémentaires si applicable
  let hoursPrice = 0;
  const rentalHours = serviceType === 'vehicle' ? ((booking as any).rental_hours || 0) : 0;
  // Utiliser hourly_rate de la réservation si disponible, sinon price_per_hour du véhicule
  const hourlyRate = serviceType === 'vehicle' 
    ? ((booking as any).hourly_rate || (booking as any).hourlyRate || (booking as any).vehicle?.price_per_hour || 0)
    : 0;
  console.log(`🔍 [InvoiceDisplay] rental_hours: ${rentalHours}, hourly_rate: ${hourlyRate}, vehicle:`, {
    hourly_rental_enabled: (booking as any).vehicle?.hourly_rental_enabled,
    price_per_hour: (booking as any).vehicle?.price_per_hour,
    booking_hourly_rate: (booking as any).hourly_rate
  });
  if (serviceType === 'vehicle' && rentalHours > 0 && hourlyRate > 0) {
    hoursPrice = rentalHours * hourlyRate;
    console.log(`💰 [InvoiceDisplay] Calcul prix heures: ${rentalHours}h × ${hourlyRate} = ${hoursPrice}`);
  }
  
  // Prix de base = prix des jours + prix des heures
  const daysPrice = pricePerUnit * nights;
  
  // Ajouter le surplus chauffeur si le véhicule est proposé avec chauffeur et que le locataire a choisi le chauffeur
  const driverFee = (serviceType === 'vehicle' && (booking as any).vehicle?.with_driver && (booking as any).vehicle?.driver_fee && (booking as any).with_driver) 
    ? (booking as any).vehicle.driver_fee 
    : 0;
  
  const basePrice = daysPrice + hoursPrice + driverFee;
  
  // Utiliser la valeur stockée en priorité, sinon recalculer
  let discountAmount = 0;
  if (serviceType === 'property' && booking.properties) {
    // Pour les propriétés, utiliser la valeur stockée en priorité (comme pour les véhicules)
    if (booking.discount_amount && booking.discount_amount > 0) {
      // Utiliser la valeur stockée en priorité
      discountAmount = booking.discount_amount;
    } else {
      // Sinon, recalculer la réduction
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
      } catch (error) {
        console.error('Erreur lors du calcul de la réduction dans InvoiceDisplay:', error);
        // En cas d'erreur, utiliser la valeur stockée
        discountAmount = booking.discount_amount || 0;
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
  const priceAfterDiscount = basePrice - discountAmount;
  const actualDiscountAmount = discountAmount;
  // La taxe de séjour est par nuit, donc multiplier par le nombre de nuits
  const taxesPerNight = providedTaxes !== undefined 
    ? providedTaxes 
    : (booking.properties?.taxes || 0);
  const effectiveTaxes = serviceType === 'property' ? taxesPerNight * nights : 0;
  
  // Debug pour la taxe de séjour
  if (__DEV__ && serviceType === 'property') {
    console.log('🔍 [InvoiceDisplay] Taxe de séjour:', {
      providedTaxes,
      taxesFromBooking: booking.properties?.taxes,
      taxesPerNight,
      nights,
      checkIn,
      checkOut,
      effectiveTaxes,
      willShow: effectiveTaxes > 0,
      serviceType
    });
  }
  
  // Calculer les frais de service avec TVA
  const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
  const effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
  
  // Calculer la commission hôte avec TVA
  const hostCommissionData = calculateHostCommission(priceAfterDiscount, serviceType);
  const hostCommission = hostCommissionData.hostCommission;
  const hostCommissionHT = hostCommissionData.hostCommissionHT;
  const hostCommissionVAT = hostCommissionData.hostCommissionVAT;
  
  // Calculer les frais de ménage en tenant compte de free_cleaning_min_days
  // Utiliser le cleaningFee passé en paramètre si fourni, sinon utiliser celui de la propriété
  let effectiveCleaningFee = cleaningFee !== undefined ? cleaningFee : (booking.properties?.cleaning_fee || 0);
  
  // Appliquer la logique free_cleaning_min_days si applicable
  if (serviceType === 'property' && booking.properties?.free_cleaning_min_days && nights >= booking.properties.free_cleaning_min_days) {
    effectiveCleaningFee = 0;
  }
  
  // Calculer le total payé : prix après réduction + frais de service + frais de ménage + taxes
  const calculatedTotal = priceAfterDiscount + effectiveServiceFee + effectiveCleaningFee + effectiveTaxes;
  // Pour les véhicules, toujours utiliser le calcul pour s'assurer que les frais de service sont inclus
  // (même si booking.total_price existe, il peut ne pas inclure les frais de service pour les anciennes réservations)
  // Pour les propriétés, utiliser booking.total_price s'il existe et correspond au calcul
  const totalPaidByTraveler = (serviceType === 'vehicle') 
    ? calculatedTotal // Toujours utiliser le calcul pour inclure les frais de service
    : (booking.total_price && Math.abs(booking.total_price - calculatedTotal) <= 100) 
      ? booking.total_price 
      : calculatedTotal;
  const hostNetAmount = booking.status === 'cancelled' ? 0 : (priceAfterDiscount - hostCommission);
  const akwaHomeTotalRevenue = effectiveServiceFee + hostCommission;

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
          recipientName: type === 'traveler' ? (travelerName || 'Voyageur') : (hostName || 'Hôte'),
          invoiceType: type === 'traveler' ? 'traveler' : 'host',
          propertyTitle: propertyOrVehicleTitle || '',
          checkIn: checkIn,
          checkOut: checkOut,
          guestsCount: booking.guests_count,
          totalPrice: totalPaidByTraveler,
          discountApplied: actualDiscountAmount > 0,
          discountAmount: actualDiscountAmount,
          property: {
            title: propertyOrVehicleTitle || '',
            address: booking.properties?.address || '',
            city_name: booking.properties?.locations?.name || '',
            price_per_night: pricePerUnit,
            cleaning_fee: effectiveCleaningFee,
            service_fee: serviceFeeHT,
            taxes: effectiveTaxes,
            cancellation_policy: booking.properties?.cancellation_policy || 'flexible',
            check_in_time: booking.properties?.check_in_time,
            check_out_time: booking.properties?.check_out_time,
            house_rules: booking.properties?.house_rules,
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
        };
      } else {
        // Pour les véhicules - format attendu par l'Edge Function
        emailData = {
          bookingId: booking.id,
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
          dailyRate: pricePerUnit,
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
          withDriver: booking.vehicle?.with_driver || false, // Ajouté pour afficher si avec chauffeur
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
      case 'traveler': return 'Facture voyageur';
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
          <Text style={styles.headerType}>{getTitle()}</Text>
          <Text style={styles.invoiceNumber}>
            N° {booking.id.substring(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.rccmNumber}>
            NCC:2507662T
          </Text>
        </View>
      </View>

      {/* Type de service */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type de service</Text>
        <Text style={styles.sectionValue}>{getServiceTypeLabel(serviceType)}</Text>
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

      {/* Durée */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Durée</Text>
        <Text style={styles.sectionValue}>
          {String(nights)} {serviceType === 'property' ? `nuit${nights > 1 ? 's' : ''}` : `jour${nights > 1 ? 's' : ''}`}
          {serviceType === 'vehicle' && (booking as any).rental_hours && (booking as any).rental_hours > 0 && 
            ` et ${(booking as any).rental_hours} heure${(booking as any).rental_hours > 1 ? 's' : ''}`}
        </Text>
      </View>

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

      {/* Section Prolongement de séjour */}
      {approvedModification && (
        <View style={styles.extensionSection}>
          <View style={styles.extensionHeader}>
            <Ionicons name="calendar-outline" size={20} color="#2563eb" />
            <Text style={styles.extensionTitle}>Prolongement de séjour</Text>
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
              {String(nights)} {serviceType === 'property' ? 'nuit' : 'jour'}{nights > 1 ? 's' : ''} × {formatPriceFCFA(pricePerUnit)}/{serviceType === 'property' ? 'nuit' : 'jour'}
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
          {serviceType === 'vehicle' && rentalHours > 0 && hoursPrice > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Prix initial ({String(nights)} {serviceType === 'property' ? 'nuits' : 'jours'}
                {serviceType === 'vehicle' && rentalHours > 0 && ` et ${rentalHours} heure${rentalHours > 1 ? 's' : ''}`})
              </Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
            </View>
          )}
          {(!serviceType || serviceType !== 'vehicle' || rentalHours === 0 || hoursPrice === 0) && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Prix initial ({String(nights)} {serviceType === 'property' ? 'nuits' : 'jours'})
              </Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
            </View>
          )}

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

          {/* Frais de service avec détails TVA */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Frais de service Akwahome
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
          </View>
          
          {/* Détails TVA pour frais de service */}
          <View style={styles.vatDetailsContainer}>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Frais de base (HT)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Total (TTC)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
            </View>
          </View>
          
          {/* Bouton voir facture avec TVA */}
          <TouchableOpacity 
            style={styles.vatInvoiceButton}
            onPress={() => setShowVATInvoice(true)}
          >
            <Ionicons name="document-text-outline" size={16} color="#007bff" />
            <Text style={styles.vatInvoiceButtonText}>Voir facture avec TVA</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Total */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Total payé</Text>
            <Text style={styles.totalValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>

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
              {String(nights)} {serviceType === 'property' ? 'nuit' : 'jour'}{nights > 1 ? 's' : ''} × {formatPriceFCFA(pricePerUnit)}/{serviceType === 'property' ? 'nuit' : 'jour'}
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
          {serviceType === 'vehicle' && rentalHours > 0 && hoursPrice > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Prix initial ({String(nights)} {serviceType === 'property' ? 'nuits' : 'jours'}
                {serviceType === 'vehicle' && rentalHours > 0 && ` et ${rentalHours} heure${rentalHours > 1 ? 's' : ''}`})
              </Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
            </View>
          )}
          {(!serviceType || serviceType !== 'vehicle' || rentalHours === 0 || hoursPrice === 0) && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Prix initial ({String(nights)} {serviceType === 'property' ? 'nuits' : 'jours'})
              </Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(basePrice)}</Text>
            </View>
          )}

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

          {/* Taxe de séjour - toujours afficher si taxesPerNight > 0 */}
          {(effectiveTaxes > 0 || (serviceType === 'property' && taxesPerNight > 0 && nights > 0)) && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Taxe de séjour</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveTaxes > 0 ? effectiveTaxes : taxesPerNight * nights)}</Text>
            </View>
          )}

          {/* Frais de ménage */}
          {effectiveCleaningFee > 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de ménage</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(effectiveCleaningFee)}</Text>
            </View>
          )}

          {/* Frais de service avec détails TVA */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Frais de service Akwahome
            </Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
          </View>
          
          {/* Détails TVA pour frais de service */}
          <View style={styles.vatDetailsContainer}>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Frais de base (HT)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Total (TTC)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Total payé par le voyageur */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Total payé {serviceType === 'property' ? 'par le voyageur' : 'par le locataire'}</Text>
            <Text style={styles.totalValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>

          <View style={styles.separator} />

          {/* Versement de l'hôte/propriétaire */}
          <Text style={styles.financialTitle}>Votre versement</Text>
          
          {/* Prix initial */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Prix initial ({String(nights)} {serviceType === 'property' ? 'nuits' : 'jours'})
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

          {/* Montant de la réservation (si pas de réduction, c'est le même que basePrice) */}
          {actualDiscountAmount === 0 && (
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Montant de la réservation</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(priceAfterDiscount)}</Text>
            </View>
          )}

          {/* Commission Akwahome avec détails TVA */}
          <View style={styles.financialRow}>
            <Text style={styles.financialLabel}>
              Commission Akwahome ({commissionRates.hostFeePercent}%)
            </Text>
            <Text style={[styles.financialValue, styles.commissionText]}>
              -{formatPriceFCFA(hostCommission)}
            </Text>
          </View>
          
          {/* Détails TVA pour commission hôte */}
          <View style={styles.vatDetailsContainer}>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Commission de base (HT)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionHT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionVAT)}</Text>
            </View>
            <View style={styles.vatDetailRow}>
              <Text style={styles.vatDetailLabel}>Total (TTC)</Text>
              <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommission)}</Text>
            </View>
          </View>
          
          {/* Bouton voir facture avec TVA */}
          <TouchableOpacity 
            style={styles.vatInvoiceButton}
            onPress={() => setShowVATInvoice(true)}
          >
            <Ionicons name="document-text-outline" size={16} color="#007bff" />
            <Text style={styles.vatInvoiceButtonText}>Voir facture avec TVA</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          {/* Gain net */}
          <View style={styles.financialRow}>
            <Text style={styles.totalLabel}>Vous recevez</Text>
            <Text style={[styles.totalValue, styles.netAmountText]}>
              {formatPriceFCFA(hostNetAmount)}
            </Text>
          </View>

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

          {/* Commissions détaillées avec TVA */}
          <View style={styles.commissionBox}>
            <Text style={styles.commissionBoxTitle}>Commissions Akwahome</Text>
            
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>Frais de service voyageur (TTC)</Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(effectiveServiceFee)}
              </Text>
            </View>
            <View style={styles.vatDetailsContainer}>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>Frais de base (HT)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
              </View>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
              </View>
            </View>

            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>
                Commission hôte ({commissionRates.hostFeePercent}%) (TTC)
              </Text>
              <Text style={[styles.financialValue, styles.commissionValue]}>
                +{formatPriceFCFA(hostCommission)}
              </Text>
            </View>
            <View style={styles.vatDetailsContainer}>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>Commission de base (HT)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionHT)}</Text>
              </View>
              <View style={styles.vatDetailRow}>
                <Text style={styles.vatDetailLabel}>TVA (20%)</Text>
                <Text style={styles.vatDetailValue}>{formatPriceFCFA(hostCommissionVAT)}</Text>
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.financialRow}>
              <Text style={styles.totalLabel}>Revenu total Akwahome (HT)</Text>
              <Text style={[styles.totalValue, styles.commissionTotal]}>
                {formatPriceFCFA(serviceFeeHT + hostCommissionHT)}
              </Text>
            </View>
            <View style={styles.financialRow}>
              <Text style={styles.financialLabel}>TVA totale collectée</Text>
              <Text style={styles.financialValue}>{formatPriceFCFA(serviceFeeVAT + hostCommissionVAT)}</Text>
            </View>
            
            {/* Bouton voir facture avec TVA */}
            <TouchableOpacity 
              style={styles.vatInvoiceButton}
              onPress={() => setShowVATInvoice(true)}
            >
              <Ionicons name="document-text-outline" size={16} color="#007bff" />
              <Text style={styles.vatInvoiceButtonText}>Voir facture avec TVA</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.separator} />

          {/* Résumé */}
          <View style={styles.summaryRow}>
            <Text style={styles.financialLabel}>Total payé par le voyageur</Text>
            <Text style={styles.financialValue}>{formatPriceFCFA(totalPaidByTraveler)}</Text>
          </View>
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
            serviceType === 'property' ? booking.properties?.cancellation_policy : undefined,
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

      {/* Modal Facture avec TVA */}
      <Modal
        visible={showVATInvoice}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVATInvoice(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Facture avec TVA</Text>
              <TouchableOpacity onPress={() => setShowVATInvoice(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {/* Informations émetteur */}
              <View style={styles.vatInvoiceSection}>
                <Text style={styles.vatInvoiceSectionTitle}>Facture émise par</Text>
                <Text style={styles.vatInvoiceCompanyName}>Akwahome</Text>
                <Text style={styles.vatInvoiceAddress}>CI-ABJ-03-2025-B12-06694</Text>
              </View>

              {/* Informations destinataire */}
              {type === 'traveler' && travelerName && (
                <View style={styles.vatInvoiceSection}>
                  <Text style={styles.vatInvoiceSectionTitle}>Facture envoyée à</Text>
                  <Text style={styles.vatInvoiceRecipientName}>{travelerName}</Text>
                  {travelerEmail && <Text style={styles.vatInvoiceRecipientDetail}>{travelerEmail}</Text>}
                  {travelerPhone && <Text style={styles.vatInvoiceRecipientDetail}>{travelerPhone}</Text>}
                </View>
              )}

              {type === 'host' && hostName && (
                <View style={styles.vatInvoiceSection}>
                  <Text style={styles.vatInvoiceSectionTitle}>Facture envoyée à</Text>
                  <Text style={styles.vatInvoiceRecipientName}>{hostName}</Text>
                  {hostEmail && <Text style={styles.vatInvoiceRecipientDetail}>{hostEmail}</Text>}
                  {hostPhone && <Text style={styles.vatInvoiceRecipientDetail}>{hostPhone}</Text>}
                </View>
              )}

              {/* Numéro et date de facture */}
              <View style={styles.vatInvoiceSection}>
                <View style={styles.vatInvoiceRow}>
                  <Text style={styles.vatInvoiceLabel}>Date d'émission de la facture</Text>
                  <Text style={styles.vatInvoiceValue}>{formatDate(booking.created_at || new Date().toISOString())}</Text>
                </View>
                <View style={styles.vatInvoiceRow}>
                  <Text style={styles.vatInvoiceLabel}>Numéro de facture</Text>
                  <Text style={styles.vatInvoiceValue}>AKWA-{booking.id.substring(0, 8).toUpperCase()}</Text>
                </View>
              </View>

              {/* Description */}
              <View style={styles.vatInvoiceSection}>
                <Text style={styles.vatInvoiceSectionTitle}>Description</Text>
                <Text style={styles.vatInvoiceDescription}>
                  Frais d'utilisation de la plateforme en ligne pour la réservation {booking.id.substring(0, 8).toUpperCase()} du {formatDate(booking.created_at || new Date().toISOString())}
                </Text>
              </View>

              {/* Détails avec TVA */}
              <View style={styles.vatInvoiceSection}>
                <Text style={styles.vatInvoiceSectionTitle}>Détails</Text>
                
                <View style={styles.vatInvoiceDetailsTable}>
                  <View style={styles.vatInvoiceTableRow}>
                    <Text style={styles.vatInvoiceTableLabel}>PAYS DE FACTURATION DE LA TVA</Text>
                    <Text style={styles.vatInvoiceTableValue}>CI</Text>
                  </View>
                  <View style={styles.vatInvoiceTableRow}>
                    <Text style={styles.vatInvoiceTableLabel}>TAUX DE TVA</Text>
                    <Text style={styles.vatInvoiceTableValue}>20,0%</Text>
                  </View>
                  
                  {type === 'traveler' && (
                    <>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>FRAIS DE BASE</Text>
                        <Text style={styles.vatInvoiceTableValue}>Frais de service</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(serviceFeeHT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT DE LA TVA</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(serviceFeeVAT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>TOTAL DES FRAIS, TVA INCLUSE</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(effectiveServiceFee)}</Text>
                      </View>
                    </>
                  )}

                  {type === 'host' && (
                    <>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>FRAIS DE BASE</Text>
                        <Text style={styles.vatInvoiceTableValue}>Commission Akwahome</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(hostCommissionHT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>MONTANT DE LA TVA</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(hostCommissionVAT)}</Text>
                      </View>
                      <View style={styles.vatInvoiceTableRow}>
                        <Text style={styles.vatInvoiceTableLabel}>TOTAL DES FRAIS, TVA INCLUSE</Text>
                        <Text style={styles.vatInvoiceTableValue}>{formatPriceFCFA(hostCommission)}</Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Sous-total */}
              <View style={styles.vatInvoiceSeparator} />
              <View style={styles.vatInvoiceSection}>
                <View style={styles.vatInvoiceSubtotalRow}>
                  <Text style={styles.vatInvoiceSubtotalLabel}>Sous-total</Text>
                  <Text style={styles.vatInvoiceSubtotalValue}>
                    {type === 'traveler' ? formatPriceFCFA(effectiveServiceFee) : formatPriceFCFA(hostCommission)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    alignItems: 'flex-end',
  },
  headerType: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  rccmNumber: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
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
