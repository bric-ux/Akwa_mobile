import { getCommissionRates } from '../lib/commissions';

export interface DiscountConfig {
  enabled: boolean;
  minNights: number | null;
  percentage: number | null;
}

/**
 * Détermine quelle réduction (normale ou long séjour) doit être appliquée
 * 
 * Logique de priorité :
 * 1. Si le seuil de réduction séjour long est atteint → toujours appliquer la réduction séjour long
 * 2. Sinon, appliquer la réduction normale si son seuil est atteint
 * 
 * La réduction séjour long est prioritaire car elle est destinée aux séjours plus longs
 */
export function getBestDiscount(
  nights: number, 
  discountConfig: DiscountConfig,
  longStayDiscountConfig?: DiscountConfig
): DiscountConfig | null {
  const canApplyNormal = shouldApplyDiscount(nights, discountConfig);
  const canApplyLongStay = longStayDiscountConfig ? shouldApplyDiscount(nights, longStayDiscountConfig) : false;
  
  // Priorité absolue à la réduction séjour long si son seuil est atteint
  if (canApplyLongStay && longStayDiscountConfig) {
    return longStayDiscountConfig;
  }
  
  // Sinon, appliquer la réduction normale si applicable
  return canApplyNormal ? discountConfig : null;
}

export interface PropertyPricing {
  basePrice: number;
  discountConfig: DiscountConfig;
  minNights: number;
}

/**
 * Calcule si une réduction doit être appliquée selon le nombre de nuits
 */
export function shouldApplyDiscount(nights: number, discountConfig: DiscountConfig): boolean {
  if (!discountConfig.enabled || !discountConfig.minNights || !discountConfig.percentage) {
    return false;
  }
  
  return nights >= discountConfig.minNights;
}

/**
 * Calcule le prix avec réduction appliquée
 */
export function calculateDiscountedPrice(
  basePrice: number, 
  nights: number, 
  discountConfig: DiscountConfig
): number {
  if (!shouldApplyDiscount(nights, discountConfig)) {
    return basePrice;
  }
  
  const discountAmount = (basePrice * discountConfig.percentage!) / 100;
  return Math.round(basePrice - discountAmount);
}

/**
 * Calcule le prix total pour une réservation avec support des réductions de longs séjours
 */
export function calculateTotalPrice(
  basePrice: number,
  nights: number,
  discountConfig: DiscountConfig,
  longStayDiscountConfig?: DiscountConfig
): {
  pricePerNight: number;
  totalPrice: number;
  discountApplied: boolean;
  discountAmount: number;
  originalTotal: number;
  discountType?: 'normal' | 'long_stay';
} {
  const originalTotal = basePrice * nights;
  
  // Déterminer la meilleure réduction à appliquer
  const bestDiscount = getBestDiscount(nights, discountConfig, longStayDiscountConfig);
  const isLongStay = bestDiscount === longStayDiscountConfig;
  
  if (!bestDiscount) {
    return {
      pricePerNight: basePrice,
      totalPrice: originalTotal,
      discountApplied: false,
      discountAmount: 0,
      originalTotal
    };
  }
  
  const discountedPricePerNight = calculateDiscountedPrice(basePrice, nights, bestDiscount);
  const totalPrice = discountedPricePerNight * nights;
  const discountAmount = originalTotal - totalPrice;
  
  return {
    pricePerNight: discountedPricePerNight,
    totalPrice,
    discountApplied: true,
    discountAmount,
    originalTotal,
    discountType: isLongStay ? 'long_stay' : 'normal'
  };
}

/**
 * Calcule les frais supplémentaires en utilisant les vrais frais de la propriété
 * IMPORTANT: Le serviceFee est calculé comme 12% du prix APRÈS réduction (comme sur le site web)
 * TVA de 20% appliquée sur les frais de service
 */
export function calculateFees(
  priceAfterDiscount: number, // Prix APRÈS application des réductions
  nights: number, 
  serviceType: 'property' | 'vehicle' = 'property',
  propertyFees?: {
    cleaning_fee?: number | null;
    service_fee?: number | null;
    taxes?: number | null;
    free_cleaning_min_days?: number | null;
  }
): {
  cleaningFee: number;
  serviceFee: number;
  serviceFeeHT: number;
  serviceFeeVAT: number;
  taxes: number;
  totalFees: number;
} {
  // Utiliser les vrais frais de la propriété ou des valeurs par défaut
  const baseCleaningFee = propertyFees?.cleaning_fee || 0;
  // Calculer les frais de ménage (gratuit si nights >= free_cleaning_min_days)
  const isFreeCleaningApplicable = propertyFees?.free_cleaning_min_days && nights >= propertyFees.free_cleaning_min_days;
  const cleaningFee = isFreeCleaningApplicable ? 0 : baseCleaningFee;
  
  // Calculer les frais de service comme un pourcentage du prix APRÈS réduction
  // Pour les propriétés: 12%, pour les véhicules: 10%
  const commissionRates = getCommissionRates(serviceType);
  const serviceFeeHT = Math.round(priceAfterDiscount * (commissionRates.travelerFeePercent / 100));
  // TVA de 20% sur les frais de service
  const serviceFeeVAT = Math.round(serviceFeeHT * 0.20);
  const serviceFee = serviceFeeHT + serviceFeeVAT;
  
  const taxes = propertyFees?.taxes || 0;
  
  const totalFees = cleaningFee + serviceFee + taxes;
  
  return {
    cleaningFee,
    serviceFee,
    serviceFeeHT,
    serviceFeeVAT,
    taxes,
    totalFees
  };
}

/**
 * Calcule la commission hôte/propriétaire avec TVA de 20%
 */
export function calculateHostCommission(
  priceAfterDiscount: number,
  serviceType: 'property' | 'vehicle' = 'property'
): {
  hostCommission: number;
  hostCommissionHT: number;
  hostCommissionVAT: number;
} {
  const commissionRates = getCommissionRates(serviceType);
  const hostCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  // TVA de 20% sur la commission hôte
  const hostCommissionVAT = Math.round(hostCommissionHT * 0.20);
  const hostCommission = hostCommissionHT + hostCommissionVAT;
  
  return {
    hostCommission,
    hostCommissionHT,
    hostCommissionVAT
  };
}

/**
 * Calcule le prix total final avec tous les frais
 */
export function calculateFinalPrice(
  basePrice: number,
  nights: number,
  discountConfig: DiscountConfig,
  propertyFees?: {
    cleaning_fee?: number | null;
    service_fee?: number | null;
    taxes?: number | null;
    free_cleaning_min_days?: number | null;
  },
  longStayDiscountConfig?: DiscountConfig,
  serviceType: 'property' | 'vehicle' = 'property'
): {
  pricing: ReturnType<typeof calculateTotalPrice>;
  fees: ReturnType<typeof calculateFees>;
  finalTotal: number;
} {
  const pricing = calculateTotalPrice(basePrice, nights, discountConfig, longStayDiscountConfig);
  // Passer le prix APRÈS réduction (pricing.totalPrice) au lieu de basePrice
  const fees = calculateFees(pricing.totalPrice, nights, serviceType, propertyFees);
  const finalTotal = pricing.totalPrice + fees.totalFees;
  
  return {
    pricing,
    fees,
    finalTotal
  };
}


