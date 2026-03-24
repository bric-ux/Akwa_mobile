import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VehicleBooking } from '../types';
import { useVehicleBookingModifications } from '../hooks/useVehicleBookingModifications';
import VehicleDateTimePickerModal from './VehicleDateTimePickerModal';
import { useCurrency } from '../contexts/CurrencyContext';
import { getCommissionRates } from '../lib/commissions';
import { calculateVehiclePriceWithHours, calculateTotalPrice, calculateHostCommission, type DiscountConfig } from '../hooks/usePricing';
import VehicleModificationSurplusPaymentModal from './VehicleModificationSurplusPaymentModal';
import { supabase } from '../services/supabase';
import { useBookingCancellation } from '../hooks/useBookingCancellation';
import {
  getCancellationPolicyText,
  ownerReceivedFundsForModificationRefundVehicle,
} from '../utils/cancellationPolicy';
import { computeVehicleRentalDurationFromIso as computeVehicleRentalDurationBase } from '../lib/vehicleRentalDuration';

/** YYYY-MM-DD du créneau ISO dans le fuseau des réservations (évite jour décalé avec toISOString().split UTC). */
const BOOKING_DISPLAY_TZ = 'Africa/Abidjan';
function isoUtcToYmdInTz(isoUtc: string, timeZone: string): string {
  const d = new Date(isoUtc);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !day) {
    return d.toISOString().split('T')[0];
  }
  return `${y}-${m}-${day}`;
}

/**
 * Alignement avec le sélecteur (VehicleDateTimePickerModal) : ISO avec chiffres = UTC.
 * Sans fuseau explicite, JS interprète en heure locale → décalage d’instant vs `…Z` et durée/prix faux.
 */
function normalizeVehicleBookingIsoUtc(iso: string | null | undefined): string | null {
  if (iso == null || typeof iso !== 'string') return null;
  const s = iso.trim();
  if (!s) return null;
  if (/Z|[+-]\d{2}:?\d{2}$/.test(s)) return s;
  const withoutMs = s.replace(/\.\d{1,3}$/, '');
  return `${withoutMs}Z`;
}

/** Même base que recherche / réservation ; &lt; 24 h : minimum 1 jour affiché (pas de facturation horaire seule ici). */
function computeRentalDurationFromIso(
  startIso: string | null,
  endIso: string | null
): { rentalDays: number; remainingHours: number; totalHours: number } {
  const d = computeVehicleRentalDurationBase(startIso, endIso);
  if (d.totalHours < 24 && d.totalHours > 0) {
    return { rentalDays: 1, remainingHours: 0, totalHours: d.totalHours };
  }
  return d;
}

interface VehicleModificationModalProps {
  visible: boolean;
  onClose: () => void;
  booking: VehicleBooking | null;
  onModified: () => void;
}

const VehicleModificationModal: React.FC<VehicleModificationModalProps> = (props) => {
  const { visible, onClose, booking, onModified } = props;
  if (!booking) return null;
  return <VehicleModificationModalContent {...props} booking={booking} />;
};

const VehicleModificationModalContent: React.FC<VehicleModificationModalProps & { booking: VehicleBooking }> = ({
  visible,
  onClose,
  booking,
  onModified,
}) => {
  const { formatPrice } = useCurrency();
  const { modifyBooking, loading, getBookingPendingRequest } = useVehicleBookingModifications();
  const { calculateCancellationInfoForVehicle } = useBookingCancellation();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startDateTime, setStartDateTime] = useState<string | null>(null);
  const [endDateTime, setEndDateTime] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingModificationData, setPendingModificationData] = useState<any>(null);
  /** Payload snake_case pour le draft surplus (création demande par le webhook après paiement carte). */
  const [pendingRequestPayload, setPendingRequestPayload] = useState<Record<string, unknown> | null>(null);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [surplusBreakdown, setSurplusBreakdown] = useState<{
    daysPriceDiff?: number;
    hoursPriceDiff?: number;
    basePriceBeforeDiscountDiff?: number;
    discountDiff?: number;
    basePriceAfterDiscountDiff?: number;
    /** Forfait chauffeur (montant appliqué sur le nouveau total) */
    driverFeeAmount?: number;
    driverFeeDiff?: number;
    /** base location + chauffeur, avant frais de service Akwa */
    subtotalWithDriverDiff?: number;
    serviceFeeDiff?: number;
    serviceFeeHTDiff?: number;
    serviceFeeVATDiff?: number;
  } | null>(null);
  /** Remboursement selon la politique d'annulation (en cas de réduction) */
  const [reductionRefundAmount, setReductionRefundAmount] = useState<number | null>(null);
  /** Aligné sur VehicleBookingScreen : le picker ne bloque pas les créneaux ; on vérifie après chaque choix. */
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);

  useEffect(() => {
    if (visible) {
      setStartDate(booking.start_date);
      setEndDate(booking.end_date);
      // Si pas de datetime, dériver de start_date/end_date pour éviter rentalDays=0 et faux calculs
      const startDt =
        normalizeVehicleBookingIsoUtc(booking.start_datetime) ||
        (booking.start_date ? `${booking.start_date}T08:00:00.000Z` : null);
      const endDt =
        normalizeVehicleBookingIsoUtc(booking.end_datetime) ||
        (booking.end_date ? `${booking.end_date}T18:00:00.000Z` : null);
      setStartDateTime(startDt);
      setEndDateTime(endDt);
      setMessage('');
    }
  }, [booking.id, visible, booking.start_date, booking.end_date, booking.start_datetime, booking.end_datetime]);

  const vehicle = booking.vehicle;

  useEffect(() => {
    if (!visible || !startDateTime || !endDateTime || !vehicle?.id) {
      setAvailabilityError(null);
      setAvailabilityChecking(false);
      return;
    }
    let cancelled = false;
    setAvailabilityChecking(true);
    (async () => {
      try {
        const { data: isAvailable, error: rpcError } = await supabase.rpc('check_vehicle_hourly_availability', {
          p_vehicle_id: vehicle.id,
          p_start_datetime: startDateTime,
          p_end_datetime: endDateTime,
          p_exclude_booking_id: booking.id,
        });
        if (cancelled) return;
        if (rpcError) {
          console.error('[VehicleModificationModal] Erreur vérification disponibilité:', rpcError);
          setAvailabilityError('Erreur lors de la vérification de disponibilité');
          return;
        }
        if (!isAvailable) {
          setAvailabilityError('Ce créneau (dates et heures) n\'est pas disponible pour ce véhicule');
        } else {
          setAvailabilityError(null);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[VehicleModificationModal] disponibilité:', e);
          setAvailabilityError('Erreur lors de la vérification de disponibilité');
        }
      } finally {
        if (!cancelled) setAvailabilityChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, booking.id, vehicle?.id, startDateTime, endDateTime]);

  const dailyRate = booking.daily_rate || vehicle?.price_per_day || 0;

  /** Comparaison d’instants ISO (évite faux écarts Z vs +00:00) */
  const isoTimesEqual = (a: string | null | undefined, b: string | null | undefined): boolean => {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    const ta = new Date(a).getTime();
    const tb = new Date(b).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
    return ta === tb;
  };

  /** ISO de référence de la réservation (alignés sur l’init du modal + même convention UTC que le picker) */
  const bookingRefStartIso =
    normalizeVehicleBookingIsoUtc(booking.start_datetime) ||
    (booking.start_date ? `${booking.start_date}T08:00:00.000Z` : null);
  const bookingRefEndIso =
    normalizeVehicleBookingIsoUtc(booking.end_datetime) ||
    (booking.end_date ? `${booking.end_date}T18:00:00.000Z` : null);

  /** Durée « avant » et « après » : même formule (ISO → heures → jours + h restantes). */
  const referenceDuration = computeRentalDurationFromIso(bookingRefStartIso, bookingRefEndIso);
  const selectedDuration = computeRentalDurationFromIso(startDateTime, endDateTime);

  const rentalDays = selectedDuration.rentalDays;
  const remainingHours = selectedDuration.remainingHours;
  const durationCalculation = selectedDuration;

  /** Même créneau que la réservation : comparer aux refs normalisées (évite échec si format ISO diffère). */
  const sameBookingWindow =
    startDateTime != null &&
    endDateTime != null &&
    bookingRefStartIso != null &&
    bookingRefEndIso != null &&
    isoTimesEqual(startDateTime, bookingRefStartIso) &&
    isoTimesEqual(endDateTime, bookingRefEndIso);

  const hasDatesChanged = !sameBookingWindow;
  const hasDurationChanged =
    selectedDuration.totalHours !== referenceDuration.totalHours;
  const hasModification = hasDatesChanged || hasDurationChanged;
  
  // Utiliser hourly_rate de la réservation si disponible, sinon price_per_hour du véhicule
  const hourlyRate = booking.hourly_rate || vehicle?.price_per_hour || 0;
  
  // Référence « avant » = même règle que la sélection (pas rental_days en base, souvent décalé)
  const currentRentalDays = referenceDuration.rentalDays;
  const currentRentalHours = referenceDuration.remainingHours;
  const currentDailyRate = booking.daily_rate || vehicle?.price_per_day || 0;
  const currentHourlyRate = booking.hourly_rate || vehicle?.price_per_hour || 0;
  const currentDaysPrice = currentDailyRate * currentRentalDays;
  const currentHoursPrice = currentRentalHours > 0 && currentHourlyRate > 0 ? currentRentalHours * currentHourlyRate : 0;
  const currentBasePrice = currentDaysPrice + currentHoursPrice;
  const currentDiscountAmount = booking.discount_amount || 0;
  const currentPriceAfterDiscount = currentBasePrice - currentDiscountAmount;
  const currentDriverFee = (booking.with_driver && vehicle?.driver_fee) ? vehicle.driver_fee : 0;
  const currentBaseForService = currentPriceAfterDiscount + currentDriverFee;
  const vehicleUsesPlatformCardRate = booking.payment_method === 'card' || booking.payment_method === 'wave';
  const currentCommissionRates = getCommissionRates('vehicle', undefined, vehicleUsesPlatformCardRate);
  const currentServiceFeeHT = Math.round(currentBaseForService * (currentCommissionRates.travelerFeePercent / 100));
  const currentServiceFeeVAT = Math.round(currentServiceFeeHT * 0.20);
  const currentServiceFee = currentServiceFeeHT + currentServiceFeeVAT;
  const currentTotalPrice = currentBaseForService + currentServiceFee;
  // Total réel payé (inclut chauffeur, frais) - pour affichage Avant et calcul surplus
  const originalTotalPrice = booking.total_price ?? currentTotalPrice;

  // Calculer le surplus (différence entre nouvelles et anciennes valeurs)
  const daysDifference = rentalDays - currentRentalDays;
  const hoursDifference = remainingHours - currentRentalHours;
  
  // Pour le calcul du surplus, utiliser le tarif horaire actuel de la réservation
  const surplusDaysPrice = daysDifference > 0 ? daysDifference * dailyRate : 0;
  const surplusHoursPrice = hoursDifference > 0 && currentHourlyRate > 0 ? hoursDifference * currentHourlyRate : 0;
  const surplusBasePrice = surplusDaysPrice + surplusHoursPrice;
  
  // Debug: vérifier le calcul du surplus
  console.log('🔍 [VehicleModificationModal] Calcul surplus détaillé:', {
    daysDifference,
    hoursDifference,
    dailyRate,
    currentHourlyRate,
    vehiclePricePerHour: vehicle?.price_per_hour,
    surplusDaysPrice,
    surplusHoursPrice,
    surplusBasePrice
  });
  
  // Debug: afficher les informations actuelles et le surplus
  console.log('📊 [VehicleModificationModal] === RÉSERVATION ACTUELLE ===');
  console.log('📅 Dates actuelles:', {
    startDate: booking.start_date,
    endDate: booking.end_date,
    startDateTime: booking.start_datetime,
    endDateTime: booking.end_datetime
  });
  console.log('⏱️ Durée actuelle:', {
    rentalDays: currentRentalDays,
    rentalHours: currentRentalHours,
    totalHours: (currentRentalDays * 24) + currentRentalHours
  });
  console.log('💰 Prix actuel:', {
    dailyRate: currentDailyRate,
    hourlyRate: currentHourlyRate,
    daysPrice: currentDaysPrice,
    hoursPrice: currentHoursPrice,
    basePrice: currentBasePrice,
    discountAmount: currentDiscountAmount,
    priceAfterDiscount: currentPriceAfterDiscount,
    serviceFee: currentServiceFee,
    totalPrice: currentTotalPrice
  });
  
  console.log('📊 [VehicleModificationModal] === NOUVELLES VALEURS ===');
  console.log('📅 Nouvelles dates:', {
    startDate,
    endDate,
    startDateTime,
    endDateTime
  });
  console.log('⏱️ Nouvelle durée:', {
    rentalDays,
    remainingHours,
    totalHours: durationCalculation.totalHours
  });
  
  console.log('📊 [VehicleModificationModal] === SURPLUS (DIFFÉRENCE) ===');
  console.log('📈 Différence:', {
    daysDifference,
    hoursDifference,
    totalHoursDifference: (daysDifference * 24) + hoursDifference
  });
  console.log('💰 Prix du surplus:', {
    surplusDaysPrice,
    surplusHoursPrice,
    surplusBasePrice
  });
  
  // Réduction de durée : recalcul complet (seuils promo / long séjour) — peut augmenter le total
  // si le locataire ne remplit plus les conditions → surplus à payer.
  // Extension / même durée : on conserve la réduction de la réservation et on ajoute seulement le delta.
  const daysDiff = rentalDays - currentRentalDays;
  const hoursDiff = remainingHours - currentRentalHours;
  const isReductionDuration = daysDiff < 0 || hoursDiff < 0;

  const commissionRates = getCommissionRates('vehicle', undefined, vehicleUsesPlatformCardRate);
  const driverFee = (booking.with_driver && vehicle?.driver_fee) ? vehicle.driver_fee : 0;

  let basePrice: number;
  let discountAmount: number;
  let daysPrice: number;
  let hoursPrice: number;
  let totalBeforeDiscount: number;
  let basePriceWithDriver: number;
  let serviceFeeHT: number;
  let serviceFeeVAT: number;
  let effectiveServiceFee: number;
  let totalPrice: number;

  const priceDelta = (daysDiff * dailyRate) + (hoursDiff * hourlyRate);
  const additionalDaysPrice = daysDiff > 0 ? daysDiff * dailyRate : 0;
  const additionalHoursPrice = hoursDiff > 0 ? hoursDiff * hourlyRate : 0;
  const additionalPrice = additionalDaysPrice + additionalHoursPrice;

  if (isReductionDuration) {
    const discountConfig: DiscountConfig = {
      enabled: vehicle?.discount_enabled || false,
      minNights: vehicle?.discount_min_days ?? null,
      percentage: vehicle?.discount_percentage ?? null,
    };
    const longStayDiscountConfig: DiscountConfig | undefined = vehicle?.long_stay_discount_enabled
      ? {
          enabled: vehicle.long_stay_discount_enabled,
          minNights: vehicle.long_stay_discount_min_days ?? null,
          percentage: vehicle.long_stay_discount_percentage ?? null,
        }
      : undefined;
    const vp = calculateVehiclePriceWithHours(
      dailyRate,
      rentalDays,
      remainingHours,
      hourlyRate,
      discountConfig,
      longStayDiscountConfig
    );
    daysPrice = vp.daysPrice;
    hoursPrice = vp.hoursPrice;
    totalBeforeDiscount = vp.totalBeforeDiscount;
    discountAmount = vp.discountAmount;
    basePrice = vp.basePrice;
    basePriceWithDriver = basePrice + driverFee;
    serviceFeeHT = Math.round(basePriceWithDriver * (commissionRates.travelerFeePercent / 100));
    serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
    effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
    totalPrice = basePriceWithDriver + effectiveServiceFee;
  } else {
    basePrice = Math.max(0, currentPriceAfterDiscount + priceDelta);
    discountAmount = currentDiscountAmount;
    daysPrice = rentalDays * dailyRate;
    hoursPrice = remainingHours > 0 && hourlyRate > 0 ? remainingHours * hourlyRate : 0;
    totalBeforeDiscount = daysPrice + hoursPrice;
    basePriceWithDriver = basePrice + driverFee;
    serviceFeeHT = Math.round(basePriceWithDriver * (commissionRates.travelerFeePercent / 100));
    serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
    effectiveServiceFee = serviceFeeHT + serviceFeeVAT;
    const modelTotalExtension = basePriceWithDriver + effectiveServiceFee;
    // Ancrer sur le montant réellement payé : le « recalcul » de l’ancien séjour (currentTotalPrice) peut
    // différer de la facture (promo, arrondis). Sans ça, le surplus ≠ somme des lignes du détail.
    const paid = originalTotalPrice ?? 0;
    totalPrice =
      paid > 0
        ? paid + (modelTotalExtension - currentTotalPrice)
        : modelTotalExtension;
  }

  // Même durée facturable ou même créneau : conserver le total payé (évite surplus ~arrondis frais / recalcul)
  if (sameBookingWindow || (daysDiff === 0 && hoursDiff === 0)) {
    totalPrice = originalTotalPrice;
  }

  const priceDiffVsBooking = totalPrice - originalTotalPrice;
  /** Afficher le détail / surplus dès qu’il y a un écart de prix ou de durée, ou des dates/heures différentes de la réservation */
  const showModificationSummary =
    Boolean(startDateTime && endDateTime && rentalDays > 0) &&
    (!sameBookingWindow || Math.abs(priceDiffVsBooking) >= 1);
  const isReduction = (rentalDays - currentRentalDays) < 0 || (remainingHours - currentRentalHours) < 0;
  const amountSaved = originalTotalPrice - totalPrice;
  useEffect(() => {
    if (!visible || !booking || !isReduction || amountSaved <= 0) {
      setReductionRefundAmount(null);
      return;
    }
    let cancelled = false;
    const policy = (vehicle as any)?.cancellation_policy ?? (booking as any).cancellation_policy ?? 'flexible';
    const currentBase = currentDaysPrice + currentHoursPrice;
    calculateCancellationInfoForVehicle(
      booking.start_date,
      booking.end_date,
      originalTotalPrice,
      Math.max(1, currentBase),
      currentRentalDays,
      policy,
      booking.status || 'confirmed'
    ).then((info) => {
      if (cancelled || !info) {
        setReductionRefundAmount(0);
        return;
      }
      const refundRate = originalTotalPrice > 0 && info.refundAmount != null
        ? info.refundAmount / originalTotalPrice
        : 0;
      let refund = Math.round(refundRate * amountSaved);
      if (
        !ownerReceivedFundsForModificationRefundVehicle({
          start_date: booking.start_date,
          start_datetime: booking.start_datetime,
          payment_method: booking.payment_method,
        })
      ) {
        refund = 0;
      }
      setReductionRefundAmount(refund);
    });
    return () => { cancelled = true; };
  }, [visible, booking?.id, isReduction, amountSaved, originalTotalPrice, currentDaysPrice, currentHoursPrice, currentRentalDays, vehicle?.cancellation_policy, booking?.status, booking?.start_date, booking?.end_date, booking?.start_datetime, booking?.payment_method, calculateCancellationInfoForVehicle]);

  const handleDateTimeChange = (start: string, end: string) => {
    setStartDateTime(start);
    setEndDateTime(end);
    setStartDate(isoUtcToYmdInTz(start, BOOKING_DISPLAY_TZ));
    setEndDate(isoUtcToYmdInTz(end, BOOKING_DISPLAY_TZ));
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates de location');
      return;
    }

    // Comparer les dates en format string pour éviter les problèmes de fuseau horaire
    // Permettre l'égalité pour les locations d'un jour (ex: du 1er au 1er janvier)
    if (endDate < startDate) {
      Alert.alert('Erreur', 'La date de fin ne peut pas être avant la date de début');
      return;
    }

    if (rentalDays < 1) {
      Alert.alert('Erreur', 'La durée de location doit être d\'au moins 1 jour');
      return;
    }

    if (availabilityChecking) {
      Alert.alert('Patientez', 'Vérification de la disponibilité en cours…');
      return;
    }
    if (availabilityError) {
      Alert.alert('Créneau indisponible', availabilityError);
      return;
    }

    // Vérifier s'il y a déjà une demande de modification en cours
    try {
      const pendingRequest = await getBookingPendingRequest(booking.id);
      if (pendingRequest) {
        Alert.alert(
          'Demande en cours',
          'Vous avez déjà une demande de modification en attente. Veuillez attendre la réponse du propriétaire ou annuler la demande existante.'
        );
        return;
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la demande en cours:', error);
      Alert.alert('Erreur', 'Impossible de vérifier les demandes en cours. Veuillez réessayer.');
      return;
    }

    if (!startDateTime || !endDateTime) {
      Alert.alert('Erreur', 'Veuillez sélectionner les dates et heures de prise et de rendu');
      return;
    }

    // Surplus = nouveau total − ancien total (réduction de durée recalculée avec seuils promo → peut être > 0)
    const priceDifference = totalPrice - originalTotalPrice;
    const reducing = daysDiff < 0 || hoursDiff < 0;

    const daysPriceDiff = reducing
      ? daysPrice - currentDaysPrice
      : additionalDaysPrice;
    const hoursPriceDiff = reducing
      ? hoursPrice - currentHoursPrice
      : additionalHoursPrice;
    const totalBeforeDiscountDiff = reducing
      ? totalBeforeDiscount - (currentDaysPrice + currentHoursPrice)
      : additionalPrice;
    const discountDiff = reducing
      ? discountAmount - currentDiscountAmount
      : 0;
    const basePriceAfterDiscountDiff = reducing
      ? basePrice - currentPriceAfterDiscount
      : additionalPrice;
    
    // Frais de service
    const serviceFeeHTDiff = serviceFeeHT - currentServiceFeeHT;
    const serviceFeeVATDiff = serviceFeeVAT - currentServiceFeeVAT;
    const serviceFeeDiff = effectiveServiceFee - currentServiceFee;

    const driverFeeDiffSubmit = driverFee - currentDriverFee;
    const subtotalWithDriverDiffSubmit = basePriceWithDriver - currentBaseForService;

    // Vérification de cohérence : sous-total (location + chauffeur) + frais de service
    const calculatedSurplus = subtotalWithDriverDiffSubmit + serviceFeeDiff;
    const surplusDifference = Math.abs(calculatedSurplus - priceDifference);
    
    console.log('🔍 [VehicleModificationModal] ===== CALCUL SURPLUS (RÉDUCTION PRÉSERVÉE) =====');
    console.log('📊 Ancienne réservation:', {
      jours: currentRentalDays,
      heures: currentRentalHours,
      'prix jours': currentDaysPrice,
      'prix heures': currentHoursPrice,
      'total avant réduction': currentDaysPrice + currentHoursPrice,
      réduction: currentDiscountAmount,
      'prix après réduction': currentPriceAfterDiscount,
      'frais service': currentServiceFee,
      'total': currentTotalPrice
    });
    console.log('📊 Modification:', {
      'diff jours': daysDiff,
      'diff heures': hoursDiff,
      'prix jours supplémentaires': additionalDaysPrice,
      'prix heures supplémentaires': additionalHoursPrice,
      'prix supplémentaire total': additionalPrice
    });
    console.log('📊 Nouvelle réservation:', {
      jours: rentalDays,
      heures: remainingHours,
      'prix jours': daysPrice,
      'prix heures': hoursPrice,
      'total avant réduction': totalBeforeDiscount,
      réduction: discountAmount, // PRÉSERVÉE de l'ancienne réservation
      'prix après réduction': basePrice,
      'frais service': effectiveServiceFee,
      'total': totalPrice
    });
    console.log('💰 Surplus:', {
      'surplus total': priceDifference,
      'prix supplémentaire': additionalPrice,
      'différence frais service': serviceFeeDiff,
      'surplus calculé': calculatedSurplus,
      'écart': surplusDifference,
      'est cohérent': surplusDifference < 1
    });
    
    const calculatedSurplusBreakdown = {
      daysPriceDiff,
      hoursPriceDiff,
      totalBeforeDiscountDiff,
      discountDiff, // Positif = perte de réduction (on paie plus), Négatif = gain de réduction (on paie moins)
      basePriceAfterDiscountDiff,
      driverFeeAmount: driverFee > 0 ? driverFee : undefined,
      driverFeeDiff: driverFeeDiffSubmit,
      subtotalWithDriverDiff: subtotalWithDriverDiffSubmit,
      serviceFeeHTDiff,
      serviceFeeVATDiff,
      serviceFeeDiff,
    };
    setSurplusBreakdown(calculatedSurplusBreakdown);

    // Préparer les données de modification
    const modificationData = {
      bookingId: booking.id,
      requestedStartDate: startDate,
      requestedEndDate: endDate,
      requestedStartDateTime: startDateTime,
      requestedEndDateTime: endDateTime,
      requestedRentalDays: rentalDays,
      requestedRentalHours: remainingHours,
      requestedTotalPrice: totalPrice,
      message: message.trim() || undefined,
    };

    // Si le surplus est positif, afficher le modal de paiement
    if (priceDifference > 0) {
      const surplusTravelerMultiplier = 1 + (commissionRates.travelerFeePercent / 100) * 1.2;
      const surplusBasePrice = Math.round(priceDifference / surplusTravelerMultiplier);
      const surplusHostCommissionData = surplusBasePrice > 0 ? calculateHostCommission(surplusBasePrice, 'vehicle') : { hostCommission: 0 };
      const surplusNetOwner = surplusBasePrice - surplusHostCommissionData.hostCommission;
      const requestPayload: Record<string, unknown> = {
        booking_id: booking.id,
        renter_id: booking.renter_id,
        owner_id: booking.vehicle?.owner_id ?? '',
        original_start_date: booking.start_date,
        original_end_date: booking.end_date,
        original_rental_days: booking.rental_days ?? 0,
        original_total_price: booking.total_price ?? 0,
        requested_start_date: startDate,
        requested_end_date: endDate,
        requested_rental_days: rentalDays,
        requested_total_price: totalPrice,
        surplus_amount: priceDifference,
        surplus_net_owner: surplusNetOwner,
        renter_message: message.trim() || null,
      };
      if (booking.start_datetime) requestPayload.original_start_datetime = booking.start_datetime;
      if (booking.end_datetime) requestPayload.original_end_datetime = booking.end_datetime;
      if ((booking.rental_hours ?? 0) > 0) requestPayload.original_rental_hours = booking.rental_hours;
      if (startDateTime) requestPayload.requested_start_datetime = startDateTime;
      if (endDateTime) requestPayload.requested_end_datetime = endDateTime;
      if ((remainingHours ?? 0) > 0) requestPayload.requested_rental_hours = remainingHours;
      setPendingRequestPayload(requestPayload);
      setPendingModificationData(modificationData);
      setShowPaymentModal(true);
    } else {
      // Si pas de surplus, soumettre directement
      setIsSubmitting(true);
      try {
        const result = await modifyBooking(modificationData);

        if (result.success) {
          Alert.alert('Succès', 'La réservation a été modifiée avec succès');
          onModified();
          onClose();
        } else {
          Alert.alert('Erreur', result.error || 'Impossible de modifier la réservation');
        }
      } catch (error: any) {
        Alert.alert('Erreur', error.message || 'Une erreur est survenue');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handlePaymentComplete = async (stripeSessionId?: string) => {
    console.log('[DEBUG][VehicleModificationModal] handlePaymentComplete appelé. stripeSessionId:', stripeSessionId ? `${stripeSessionId.substring(0, 24)}...` : 'undefined', 'pendingModificationData:', !!pendingModificationData);
    if (!pendingModificationData) return;

    if (stripeSessionId) {
      console.log('[DEBUG][VehicleModificationModal] → Carte: succès + onModified + onClose');
      // Carte : la demande a été créée par le webhook après paiement
      setSurplusBreakdown(null);
      setPendingModificationData(null);
      setPendingRequestPayload(null);
      Alert.alert('Succès', 'La demande de modification a été soumise avec succès');
      onModified();
      onClose();
      return;
    }

    console.log('[DEBUG][VehicleModificationModal] → Cash: modifyBooking');
    // Cash : créer la demande après confirmation du paiement cash
    setSurplusBreakdown(null);
    setIsSubmitting(true);
    try {
      const result = await modifyBooking(pendingModificationData);
      if (result.success) {
        setPendingModificationData(null);
        setPendingRequestPayload(null);
        Alert.alert('Succès', 'La demande de modification a été soumise avec succès');
        onModified();
        onClose();
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de soumettre la demande de modification');
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Ionicons name="create-outline" size={20} color="#2563eb" />
              <Text style={styles.headerTitle}>Modifier la réservation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Informations actuelles */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Réservation actuelle</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Véhicule:</Text>
                <Text style={styles.infoValue}>
                  {vehicle?.title || `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dates actuelles:</Text>
                <Text style={styles.infoValue}>
                  {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Durée actuelle:</Text>
                <Text style={styles.infoValue}>
                  {referenceDuration.rentalDays} jour{referenceDuration.rentalDays > 1 ? 's' : ''}
                  {referenceDuration.remainingHours > 0 &&
                    ` et ${referenceDuration.remainingHours} heure${referenceDuration.remainingHours > 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Prix actuel:</Text>
                <Text style={styles.infoValue}>{formatPrice(booking.total_price || 0)}</Text>
              </View>
            </View>

            {/* Nouvelles dates */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nouvelles dates et heures</Text>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDateTimePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                <View style={styles.dateTimeButtonContent}>
                  {startDateTime && endDateTime ? (
                    <>
                      <Text style={styles.dateTimeButtonText}>
                        {(() => {
                          const tz = 'Africa/Abidjan';
                          const startDate = new Date(startDateTime);
                          const dateStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: tz });
                          const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                          return `${dateStr} à ${timeStr}`;
                        })()}
                      </Text>
                      <Text style={styles.dateTimeButtonSubtext}>
                        {(() => {
                          const tz = 'Africa/Abidjan';
                          const endDate = new Date(endDateTime);
                          const dateStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: tz });
                          const timeStr = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                          return `Jusqu'au ${dateStr} à ${timeStr}`;
                        })()}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.dateTimeButtonText}>Sélectionner les dates et heures</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
              {availabilityChecking && (
                <View style={styles.availabilityCheckingRow}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.availabilityCheckingText}>Vérification du créneau…</Text>
                </View>
              )}
              {availabilityError ? (
                <View style={styles.availabilityErrorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#dc2626" />
                  <Text style={styles.availabilityErrorText}>{availabilityError}</Text>
                </View>
              ) : null}
              {showModificationSummary && (
                <View style={styles.summaryBox}>
                  {/* Détail des modifications : dates, durée, prix avant / après */}
                  <View style={styles.modificationDetailSection}>
                    <Text style={styles.modificationDetailTitle}>Détail des modifications</Text>
                    <View style={styles.modificationDetailRow}>
                      <Text style={styles.modificationDetailLabel}>Avant :</Text>
                      <Text style={styles.modificationDetailValue}>
                        {bookingRefStartIso && bookingRefEndIso
                          ? (() => {
                              const tz = 'Africa/Abidjan';
                              const start = new Date(bookingRefStartIso);
                              const end = new Date(bookingRefEndIso);
                              const d1 = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: tz });
                              const t1 = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                              const d2 = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: tz });
                              const t2 = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                              return `${d1} ${t1} → ${d2} ${t2}`;
                            })()
                          : `${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}`}
                        {' • '}{currentRentalDays} jour{currentRentalDays > 1 ? 's' : ''}
                        {currentRentalHours > 0 && ` et ${currentRentalHours} h`}
                        {' • '}{formatPrice(originalTotalPrice)}
                      </Text>
                    </View>
                    <View style={styles.modificationDetailRow}>
                      <Text style={[styles.modificationDetailLabel, styles.modificationDetailLabelAfter]}>Après :</Text>
                      <Text style={[styles.modificationDetailValue, styles.modificationDetailValueAfter]}>
                        {startDateTime && endDateTime
                          ? (() => {
                              const tz = 'Africa/Abidjan';
                              const start = new Date(startDateTime);
                              const end = new Date(endDateTime);
                              const d1 = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: tz });
                              const t1 = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                              const d2 = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: tz });
                              const t2 = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                              return `${d1} ${t1} → ${d2} ${t2}`;
                            })()
                          : `${formatDate(startDate)} → ${formatDate(endDate)}`}
                        {' • '}{rentalDays} jour{rentalDays > 1 ? 's' : ''}
                        {remainingHours > 0 && ` et ${remainingHours} h`}
                        {' • '}{formatPrice(totalPrice)}
                      </Text>
                    </View>
                  </View>
                  {/* Calculer les différences */}
                  {(() => {
                    const daysDiff = rentalDays - currentRentalDays;
                    const hoursDiff = remainingHours - currentRentalHours;
                    const daysPriceDiff = daysPrice - currentDaysPrice;
                    const hoursPriceDiff = hoursPrice - currentHoursPrice;
                    const discountDiff = currentDiscountAmount - discountAmount;
                    const basePriceDiff = basePrice - currentPriceAfterDiscount;
                    const serviceFeeDiff = effectiveServiceFee - currentServiceFee;
                    const serviceFeeHTDiffUi = serviceFeeHT - currentServiceFeeHT;
                    const serviceFeeVATDiffUi = serviceFeeVAT - currentServiceFeeVAT;
                    const driverFeeDiffUi = driverFee - currentDriverFee;
                    const subtotalWithDriverDiffUi = basePriceWithDriver - currentBaseForService;
                    const totalDiff = totalPrice - originalTotalPrice;
                    const isReduction = daysDiff < 0 || hoursDiff < 0;
                    const isExtensionDuration =
                      !isReduction && (daysDiff > 0 || hoursDiff > 0);
                    // Réduction avec remboursement : détail masqué (évite la confusion). Réduction avec surplus (perte de promo) : afficher le détail.
                    const showDetailedBreakdown = !isReduction || totalDiff > 0;
                    const showDriverFeeDetail = (driverFee > 0 || currentDriverFee > 0) && showDetailedBreakdown;
                    /** Écart entre recalcul théorique du séjour actuel et montant facturé (affiche pour transparence si notable) */
                    const invoiceVsModelDiff = originalTotalPrice - currentTotalPrice;
                    
                    return (
                      <>
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Durée:</Text>
                          <Text style={styles.summaryValue}>
                            {daysDiff !== 0 || hoursDiff !== 0 ? (
                              <>
                                {daysDiff !== 0 && `${daysDiff} jour${Math.abs(daysDiff) > 1 ? 's' : ''}`}
                                {daysDiff !== 0 && hoursDiff !== 0 && ' et '}
                                {hoursDiff !== 0 && `${hoursDiff} heure${Math.abs(hoursDiff) > 1 ? 's' : ''}`}
                              </>
                            ) : (
                              'Aucun changement'
                            )}
                          </Text>
                        </View>
                        {!isReduction && isExtensionDuration && Math.abs(invoiceVsModelDiff) >= 1 && (
                          <Text style={styles.reconciliationHint}>
                            Le nouveau total part de votre montant payé ({formatPrice(originalTotalPrice)})
                            {Math.abs(invoiceVsModelDiff) >= 5
                              ? ` et non du recalcul automatique du même séjour (${formatPrice(currentTotalPrice)}), pour rester aligné avec votre facture (promo, arrondis).`
                              : '.'}
                            {' '}Les lignes ci-dessous décomposent uniquement le supplément lié à la modification.
                          </Text>
                        )}
                        {showDetailedBreakdown && (daysPriceDiff !== 0 || hoursPriceDiff !== 0) && (
                          <>
                            {daysPriceDiff !== 0 && (
                              <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Prix des jours:</Text>
                                <Text style={styles.summaryValue} numberOfLines={2}>
                                  {daysPriceDiff > 0 ? '+' : ''}{formatPrice(daysPriceDiff)}{'\n'}
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                    ({daysDiff > 0 ? '+' : ''}{daysDiff} jour{Math.abs(daysDiff) > 1 ? 's' : ''} × {formatPrice(dailyRate)})
                                  </Text>
                                </Text>
                              </View>
                            )}
                            {hoursPriceDiff !== 0 && hoursDiff !== 0 && hourlyRate > 0 && (
                              <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Prix des heures:</Text>
                                <Text style={styles.summaryValue} numberOfLines={2}>
                                  {hoursPriceDiff > 0 ? '+' : ''}{formatPrice(hoursPriceDiff)}{'\n'}
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                    ({hoursDiff > 0 ? '+' : ''}{hoursDiff} h × {formatPrice(hourlyRate)}/h)
                                  </Text>
                                </Text>
                              </View>
                            )}
                          </>
                        )}
                        {showDetailedBreakdown && (daysPriceDiff !== 0 || hoursPriceDiff !== 0) && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Prix de base (avant réduction):</Text>
                            <Text style={styles.summaryValue}>
                              {(daysPriceDiff + hoursPriceDiff) > 0 ? '+' : ''}{formatPrice(daysPriceDiff + hoursPriceDiff)}
                            </Text>
                          </View>
                        )}
                        {showDetailedBreakdown && discountDiff !== 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, discountDiff > 0 ? { color: '#e74c3c' } : { color: '#059669' }]}>
                              {discountDiff > 0 ? 'Perte de réduction:' : 'Gain de réduction:'}
                            </Text>
                            <Text style={[styles.summaryValue, discountDiff > 0 ? { color: '#e74c3c' } : { color: '#059669' }]}>
                              {formatPrice(discountDiff)}
                            </Text>
                          </View>
                        )}
                        {showDetailedBreakdown && basePriceDiff !== 0 && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Prix après réduction:</Text>
                            <Text style={styles.summaryValue}>
                              {basePriceDiff > 0 ? '+' : ''}{formatPrice(basePriceDiff)}
                            </Text>
                          </View>
                        )}
                        {showDriverFeeDetail && (
                          <>
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Frais chauffeur (forfait)</Text>
                              <Text style={styles.summaryValue} numberOfLines={2}>
                                {driverFeeDiffUi !== 0 ? (
                                  <>
                                    {driverFeeDiffUi > 0 ? '+' : ''}{formatPrice(driverFeeDiffUi)}
                                    {'\n'}
                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                      Nouveau forfait : {formatPrice(driverFee)}
                                    </Text>
                                  </>
                                ) : (
                                  <>
                                    {formatPrice(driverFee)}
                                    {'\n'}
                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>(inchangé)</Text>
                                  </>
                                )}
                              </Text>
                            </View>
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Sous-total (location + chauffeur)</Text>
                              <Text style={styles.summaryValue}>
                                {subtotalWithDriverDiffUi > 0 ? '+' : ''}{formatPrice(subtotalWithDriverDiffUi)}
                              </Text>
                            </View>
                          </>
                        )}
                        {showDetailedBreakdown && serviceFeeDiff !== 0 && !showDriverFeeDetail && (
                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Frais de service:</Text>
                            <Text style={styles.summaryValue}>
                              {serviceFeeDiff > 0 ? '+' : ''}{formatPrice(serviceFeeDiff)}
                            </Text>
                          </View>
                        )}
                        {showDetailedBreakdown && serviceFeeDiff !== 0 && showDriverFeeDetail && (
                          <>
                            {serviceFeeHTDiffUi !== 0 && (
                              <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Frais de service (HT)</Text>
                                <Text style={styles.summaryValue}>
                                  {serviceFeeHTDiffUi > 0 ? '+' : ''}{formatPrice(serviceFeeHTDiffUi)}
                                </Text>
                              </View>
                            )}
                            {serviceFeeVATDiffUi !== 0 && (
                              <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>TVA (20 %)</Text>
                                <Text style={styles.summaryValue}>
                                  {serviceFeeVATDiffUi > 0 ? '+' : ''}{formatPrice(serviceFeeVATDiffUi)}
                                </Text>
                              </View>
                            )}
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Total frais de service (TTC)</Text>
                              <Text style={styles.summaryValue}>
                                {serviceFeeDiff > 0 ? '+' : ''}{formatPrice(serviceFeeDiff)}
                              </Text>
                            </View>
                          </>
                        )}
                        {totalDiff > 0 ? (
                          <View style={styles.surplusSection}>
                            <View style={styles.surplusRow}>
                              <Text style={styles.surplusLabel}>Surplus à payer :</Text>
                              <Text style={styles.surplusValue}>
                                +{formatPrice(totalDiff)}
                              </Text>
                            </View>
                            {isReduction ? (
                              <Text style={styles.surplusNote}>
                                En raccourcissant la location, le total est recalculé selon les tarifs et réductions
                                applicables à cette durée. Vous n’êtes plus éligible à certaines réductions du séjour
                                initial (par ex. séjour long) : la différence est à régler pour valider la modification.
                              </Text>
                            ) : isExtensionDuration ? (
                              <Text style={styles.surplusNote}>
                                Montant supplémentaire pour la durée demandée par rapport à votre réservation actuelle.
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <View style={[styles.summaryRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>
                              {totalDiff < 0 ? 'Remboursement:' : 'Aucun changement'}
                            </Text>
                            <Text style={[styles.totalValue, totalDiff < 0 ? { color: '#059669' } : { color: '#6b7280' }]}>
                              {totalDiff < 0
                                ? formatPrice(isReduction && reductionRefundAmount !== null ? reductionRefundAmount : Math.abs(totalDiff))
                                : formatPrice(0)}
                            </Text>
                          </View>
                        )}
                        {isReduction && totalDiff < 0 && (() => {
                          const policy = (vehicle as any)?.cancellation_policy ?? (booking as any).cancellation_policy ?? 'flexible';
                          return (
                            <View style={styles.policyNoteContainer}>
                              <Text style={styles.policyNoteLabel}>Conditions d'annulation :</Text>
                              <Text style={styles.policyNote}>
                                {getCancellationPolicyText(policy, 'vehicle')}
                              </Text>
                            </View>
                          );
                        })()}
                      </>
                    );
                  })()}
                </View>
              )}
            </View>

            {/* Message optionnel */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Message au propriétaire (optionnel)</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Expliquez la raison de la modification..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (isSubmitting || loading || !!availabilityError || availabilityChecking) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || loading || !!availabilityError || availabilityChecking}
            >
              {isSubmitting || loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Confirmer la modification</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Modal de paiement du surplus */}
      <VehicleModificationSurplusPaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPendingModificationData(null);
          setPendingRequestPayload(null);
          setSurplusBreakdown(null);
        }}
        surplusAmount={Math.max(0, totalPrice - originalTotalPrice)}
        bookingId={booking.id}
        onPaymentComplete={handlePaymentComplete}
        modificationRequestPayload={pendingRequestPayload ?? undefined}
        vehicleTitle={vehicle?.title || `${vehicle?.brand} ${vehicle?.model}`}
        vehicleId={vehicle?.id}
        originalTotalPrice={originalTotalPrice}
        newTotalPrice={totalPrice}
        priceBreakdown={surplusBreakdown || undefined}
      />

      {/* Modal de sélection dates/heures */}
      <VehicleDateTimePickerModal
        visible={showDateTimePicker}
        startDateTime={startDateTime}
        endDateTime={endDateTime}
        onClose={() => setShowDateTimePicker(false)}
        beforeConfirm={async (startISO, endISO) => {
          if (!vehicle?.id) return true;
          try {
            const { data: isAvailable, error: rpcError } = await supabase.rpc('check_vehicle_hourly_availability', {
              p_vehicle_id: vehicle.id,
              p_start_datetime: startISO,
              p_end_datetime: endISO,
              p_exclude_booking_id: booking.id,
            });
            if (rpcError) {
              console.error('[VehicleModificationModal] beforeConfirm disponibilité:', rpcError);
              Alert.alert('Erreur', 'Erreur lors de la vérification de disponibilité');
              return false;
            }
            if (!isAvailable) {
              Alert.alert(
                'Créneau indisponible',
                'Ce créneau n\'est pas disponible pour ce véhicule. Choisissez d\'autres dates ou heures.'
              );
              return false;
            }
            return true;
          } catch (e) {
            console.error('[VehicleModificationModal] beforeConfirm:', e);
            Alert.alert('Erreur', 'Erreur lors de la vérification de disponibilité');
            return false;
          }
        }}
        onConfirm={(start, end) => {
          handleDateTimeChange(start, end);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  modificationDetailSection: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modificationDetailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  modificationDetailRow: {
    marginBottom: 6,
  },
  modificationDetailLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  modificationDetailValue: {
    fontSize: 14,
    color: '#1f2937',
  },
  modificationDetailLabelAfter: {
    color: '#059669',
    fontWeight: '600',
  },
  modificationDetailValueAfter: {
    color: '#059669',
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    flexShrink: 1,
    textAlign: 'right',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  surplusSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  surplusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  surplusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  surplusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ea580c',
  },
  surplusNote: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
  },
  reconciliationHint: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 16,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  policyNoteContainer: {
    marginTop: 12,
    width: '100%',
  },
  policyNoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  policyNote: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 100,
    backgroundColor: '#fff',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
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
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  dateTimeButtonContent: {
    flex: 1,
    marginLeft: 12,
  },
  dateTimeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  dateTimeButtonSubtext: {
    fontSize: 13,
    color: '#6b7280',
  },
  availabilityCheckingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  availabilityCheckingText: {
    fontSize: 13,
    color: '#2563eb',
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
});

export default VehicleModificationModal;








