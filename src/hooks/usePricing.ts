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
 */
export function calculateFees(
  basePrice: number, 
  nights: number, 
  propertyFees?: {
    cleaning_fee?: number | null;
    service_fee?: number | null;
    taxes?: number | null;
    free_cleaning_min_days?: number | null;
  }
): {
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  totalFees: number;
} {
  // Utiliser les vrais frais de la propriété ou des valeurs par défaut
  const baseCleaningFee = propertyFees?.cleaning_fee || 0;
  // Calculer les frais de ménage (gratuit si nights >= free_cleaning_min_days)
  const isFreeCleaningApplicable = propertyFees?.free_cleaning_min_days && nights >= propertyFees.free_cleaning_min_days;
  const cleaningFee = isFreeCleaningApplicable ? 0 : baseCleaningFee;
  const serviceFee = propertyFees?.service_fee || 0;
  const taxes = propertyFees?.taxes || 0;
  
  const totalFees = cleaningFee + serviceFee + taxes;
  
  return {
    cleaningFee,
    serviceFee,
    taxes,
    totalFees
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
  longStayDiscountConfig?: DiscountConfig
): {
  pricing: ReturnType<typeof calculateTotalPrice>;
  fees: ReturnType<typeof calculateFees>;
  finalTotal: number;
} {
  const pricing = calculateTotalPrice(basePrice, nights, discountConfig, longStayDiscountConfig);
  const fees = calculateFees(basePrice, nights, propertyFees);
  const finalTotal = pricing.totalPrice + fees.totalFees;
  
  return {
    pricing,
    fees,
    finalTotal
  };
}


