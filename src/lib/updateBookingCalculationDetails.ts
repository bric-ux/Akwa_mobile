/**
 * Fonction helper pour mettre à jour booking_calculation_details lors d'une modification de réservation
 * Utilise la même logique que lors de la création pour garantir la cohérence
 */

import { supabase } from '../services/supabase';
import { calculateFees, calculateHostCommission } from '../hooks/usePricing';
import { calculateHostNetAmount } from './hostNetAmount';
import { calculateVehiclePriceWithHours, type DiscountConfig } from '../hooks/usePricing';

/**
 * Met à jour booking_calculation_details pour une réservation propriété modifiée
 */
export async function updatePropertyBookingCalculationDetails(
  bookingId: string,
  bookingData: {
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    discount_amount?: number | null;
    discount_applied?: boolean;
    original_total?: number | null;
  },
  propertyData: {
    price_per_night: number;
    cleaning_fee?: number | null;
    taxes?: number | null;
    free_cleaning_min_days?: number | null;
    discount_enabled?: boolean;
    discount_min_nights?: number | null;
    discount_percentage?: number | null;
    long_stay_discount_enabled?: boolean;
    long_stay_discount_min_nights?: number | null;
    long_stay_discount_percentage?: number | null;
  },
  status: string = 'confirmed'
): Promise<void> {
  try {
    // Calculer le nombre de nuits
    const checkIn = new Date(bookingData.check_in_date);
    const checkOut = new Date(bookingData.check_out_date);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Calculer le prix de base
    const basePrice = propertyData.price_per_night * nights;
    
    // Utiliser discount_amount stocké ou recalculer
    let discountAmount = bookingData.discount_amount || 0;
    let discountApplied = bookingData.discount_applied || false;
    let originalTotal = bookingData.original_total || basePrice;
    
    if (!discountAmount && propertyData.discount_enabled) {
      // Recalculer la réduction si nécessaire
      const discountConfig: DiscountConfig = {
        enabled: propertyData.discount_enabled || false,
        minNights: propertyData.discount_min_nights || null,
        percentage: propertyData.discount_percentage || null
      };
      
      const longStayDiscountConfig: DiscountConfig | undefined = propertyData.long_stay_discount_enabled ? {
        enabled: propertyData.long_stay_discount_enabled || false,
        minNights: propertyData.long_stay_discount_min_nights || null,
        percentage: propertyData.long_stay_discount_percentage || null
      } : undefined;
      
      // Utiliser calculateTotalPrice pour obtenir la réduction
      const { calculateTotalPrice } = await import('../hooks/usePricing');
      const pricing = calculateTotalPrice(propertyData.price_per_night, nights, discountConfig, longStayDiscountConfig);
      discountAmount = pricing.discountAmount || 0;
      discountApplied = pricing.discountApplied || false;
      originalTotal = pricing.originalTotal || basePrice;
    }
    
    const priceAfterDiscount = basePrice - discountAmount;
    
    // Calculer les frais de service
    const fees = calculateFees(
      priceAfterDiscount,
      nights,
      'property',
      {
        cleaning_fee: propertyData.cleaning_fee || 0,
        taxes: propertyData.taxes || 0,
        free_cleaning_min_days: propertyData.free_cleaning_min_days || null
      }
    );
    
    // Calculer la commission hôte
    const hostCommissionData = calculateHostCommission(priceAfterDiscount, 'property');
    
    // Calculer host_net_amount
    const hostNetAmountResult = calculateHostNetAmount({
      pricePerNight: propertyData.price_per_night,
      nights: nights,
      discountAmount: discountAmount,
      cleaningFee: propertyData.cleaning_fee || 0,
      taxesPerNight: propertyData.taxes || 0,
      freeCleaningMinDays: propertyData.free_cleaning_min_days || null,
      status: status,
      serviceType: 'property',
    });
    
    // Mettre à jour ou créer booking_calculation_details
    const calculationDetails = {
      booking_id: bookingId,
      booking_type: 'property',
      base_price: basePrice,
      price_after_discount: priceAfterDiscount,
      base_price_with_driver: null,
      discount_amount: discountAmount,
      discount_applied: discountApplied,
      original_total: originalTotal,
      discount_type: discountApplied ? 'normal' : null, // TODO: détecter long_stay si applicable
      service_fee: fees.serviceFee,
      service_fee_ht: fees.serviceFeeHT,
      service_fee_vat: fees.serviceFeeVAT,
      host_commission: hostCommissionData.hostCommission,
      host_commission_ht: hostCommissionData.hostCommissionHT,
      host_commission_vat: hostCommissionData.hostCommissionVAT,
      effective_cleaning_fee: fees.cleaningFee,
      effective_taxes: fees.taxes,
      days_price: null,
      hours_price: null,
      driver_fee: null,
      total_before_discount: null,
      total_price: bookingData.total_price,
      host_net_amount: hostNetAmountResult.hostNetAmount,
      calculation_snapshot: {
        serviceType: 'property',
        pricePerNight: propertyData.price_per_night,
        nights: nights,
        discountAmount: discountAmount,
        cleaningFee: propertyData.cleaning_fee || 0,
        taxesPerNight: propertyData.taxes || 0,
        freeCleaningMinDays: propertyData.free_cleaning_min_days || null,
        status: status,
        commissionRates: {
          travelerFeePercent: 12,
          hostFeePercent: 2
        },
        calculatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    
    // Vérifier si un enregistrement existe déjà
    const { data: existing } = await supabase
      .from('booking_calculation_details')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('booking_type', 'property')
      .single();
    
    if (existing) {
      // Mettre à jour
      const { error } = await supabase
        .from('booking_calculation_details')
        .update(calculationDetails)
        .eq('id', existing.id);
      
      if (error) {
        console.error('❌ Erreur mise à jour calculation_details:', error);
        throw error;
      }
    } else {
      // Créer
      const { error } = await supabase
        .from('booking_calculation_details')
        .insert(calculationDetails);
      
      if (error) {
        console.error('❌ Erreur création calculation_details:', error);
        throw error;
      }
    }
    
    if (__DEV__) console.log('✅ [updatePropertyBookingCalculationDetails] Détails de calcul mis à jour pour réservation:', bookingId);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des détails de calcul:', error);
    // Ne pas faire échouer la modification si l'update des détails échoue
  }
}

/**
 * Met à jour booking_calculation_details pour une réservation véhicule modifiée
 */
export async function updateVehicleBookingCalculationDetails(
  bookingId: string,
  bookingData: {
    start_date: string;
    end_date: string;
    total_price: number;
    rental_days?: number;
    rental_hours?: number | null;
    daily_rate?: number | null;
    hourly_rate?: number | null;
    discount_amount?: number | null;
    discount_applied?: boolean;
    original_total?: number | null;
    with_driver?: boolean;
  },
  vehicleData: {
    price_per_day: number;
    price_per_hour?: number | null;
    driver_fee?: number | null;
    with_driver?: boolean;
    discount_enabled?: boolean;
    discount_min_days?: number | null;
    discount_percentage?: number | null;
    long_stay_discount_enabled?: boolean;
    long_stay_discount_min_days?: number | null;
    long_stay_discount_percentage?: number | null;
    security_deposit?: number | null;
  },
  status: string = 'confirmed'
): Promise<void> {
  try {
    const rentalDays = bookingData.rental_days || 0;
    const rentalHours = bookingData.rental_hours || 0;
    const dailyRate = bookingData.daily_rate || vehicleData.price_per_day;
    const hourlyRate = bookingData.hourly_rate || vehicleData.price_per_hour || 0;
    const rentalType = rentalDays > 0 ? 'daily' : 'hourly';
    
    // Calculer les prix
    let basePrice: number;
    let discountAmount = bookingData.discount_amount || 0;
    let discountApplied = bookingData.discount_applied || false;
    let originalTotal: number;
    let daysPrice = 0;
    let hoursPrice = 0;
    let totalBeforeDiscount = 0;
    
    if (rentalType === 'hourly') {
      hoursPrice = hourlyRate * rentalHours;
      basePrice = hoursPrice;
      originalTotal = basePrice;
    } else {
      daysPrice = dailyRate * rentalDays;
      hoursPrice = rentalHours > 0 && hourlyRate > 0 ? rentalHours * hourlyRate : 0;
      totalBeforeDiscount = daysPrice + hoursPrice;
      
      // Recalculer la réduction si nécessaire
      if (!discountAmount && vehicleData.discount_enabled) {
        const discountConfig: DiscountConfig = {
          enabled: vehicleData.discount_enabled || false,
          minNights: vehicleData.discount_min_days || null,
          percentage: vehicleData.discount_percentage || null
        };
        
        const longStayDiscountConfig: DiscountConfig | undefined = vehicleData.long_stay_discount_enabled ? {
          enabled: vehicleData.long_stay_discount_enabled || false,
          minNights: vehicleData.long_stay_discount_min_days || null,
          percentage: vehicleData.long_stay_discount_percentage || null
        } : undefined;
        
        const priceCalculation = calculateVehiclePriceWithHours(
          dailyRate,
          rentalDays,
          rentalHours,
          hourlyRate,
          discountConfig,
          longStayDiscountConfig
        );
        
        basePrice = priceCalculation.basePrice;
        discountAmount = priceCalculation.discountAmount;
        discountApplied = priceCalculation.discountApplied;
        originalTotal = priceCalculation.originalTotal;
      } else {
        basePrice = totalBeforeDiscount - discountAmount;
        originalTotal = bookingData.original_total || totalBeforeDiscount;
      }
    }
    
    // Ajouter le surplus chauffeur
    const driverFee = (vehicleData.with_driver && bookingData.with_driver === true && vehicleData.driver_fee) 
      ? vehicleData.driver_fee 
      : 0;
    const basePriceWithDriver = basePrice + driverFee;
    
    // Calculer les frais de service
    const fees = calculateFees(basePriceWithDriver, rentalType === 'hourly' ? rentalHours : rentalDays, 'vehicle');
    
    // Calculer la commission propriétaire
    const hostCommissionData = calculateHostCommission(basePriceWithDriver, 'vehicle');
    
    // Calculer host_net_amount
    const hostNetAmount = basePriceWithDriver - hostCommissionData.hostCommission;
    
    // Mettre à jour ou créer booking_calculation_details
    const calculationDetails = {
      booking_id: bookingId,
      booking_type: 'vehicle',
      base_price: basePrice,
      price_after_discount: basePrice,
      base_price_with_driver: basePriceWithDriver,
      discount_amount: discountAmount,
      discount_applied: discountApplied,
      original_total: originalTotal,
      discount_type: discountApplied ? 'normal' : null, // TODO: détecter long_stay si applicable
      service_fee: fees.serviceFee,
      service_fee_ht: fees.serviceFeeHT,
      service_fee_vat: fees.serviceFeeVAT,
      host_commission: hostCommissionData.hostCommission,
      host_commission_ht: hostCommissionData.hostCommissionHT,
      host_commission_vat: hostCommissionData.hostCommissionVAT,
      effective_cleaning_fee: 0,
      effective_taxes: 0,
      days_price: daysPrice,
      hours_price: hoursPrice,
      driver_fee: driverFee,
      total_before_discount: totalBeforeDiscount || basePrice,
      total_price: bookingData.total_price,
      host_net_amount: hostNetAmount,
      calculation_snapshot: {
        serviceType: 'vehicle',
        rentalType: rentalType,
        dailyRate: dailyRate,
        hourlyRate: hourlyRate || null,
        rentalDays: rentalDays,
        rentalHours: rentalHours || null,
        discountConfig: {
          enabled: vehicleData.discount_enabled || false,
          minDays: vehicleData.discount_min_days || null,
          percentage: vehicleData.discount_percentage || null
        },
        longStayDiscountConfig: vehicleData.long_stay_discount_enabled ? {
          enabled: vehicleData.long_stay_discount_enabled || false,
          minDays: vehicleData.long_stay_discount_min_days || null,
          percentage: vehicleData.long_stay_discount_percentage || null
        } : null,
        withDriver: bookingData.with_driver === true,
        driverFee: driverFee,
        securityDeposit: vehicleData.security_deposit ?? 0,
        commissionRates: {
          travelerFeePercent: 10,
          hostFeePercent: 2
        },
        calculatedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    };
    
    // Vérifier si un enregistrement existe déjà
    const { data: existing } = await supabase
      .from('booking_calculation_details')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('booking_type', 'vehicle')
      .single();
    
    if (existing) {
      // Mettre à jour
      const { error } = await supabase
        .from('booking_calculation_details')
        .update(calculationDetails)
        .eq('id', existing.id);
      
      if (error) {
        console.error('❌ Erreur mise à jour calculation_details:', error);
        throw error;
      }
    } else {
      // Créer
      const { error } = await supabase
        .from('booking_calculation_details')
        .insert(calculationDetails);
      
      if (error) {
        console.error('❌ Erreur création calculation_details:', error);
        throw error;
      }
    }
    
    if (__DEV__) console.log('✅ [updateVehicleBookingCalculationDetails] Détails de calcul mis à jour pour réservation:', bookingId);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des détails de calcul:', error);
    // Ne pas faire échouer la modification si l'update des détails échoue
  }
}

