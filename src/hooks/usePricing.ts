export interface DiscountConfig {
  enabled: boolean;
  minNights: number | null;
  percentage: number | null;
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
 * Calcule le prix total pour une réservation
 */
export function calculateTotalPrice(
  basePrice: number,
  nights: number,
  discountConfig: DiscountConfig
): {
  pricePerNight: number;
  totalPrice: number;
  discountApplied: boolean;
  discountAmount: number;
  originalTotal: number;
} {
  const originalTotal = basePrice * nights;
  
  if (!shouldApplyDiscount(nights, discountConfig)) {
    return {
      pricePerNight: basePrice,
      totalPrice: originalTotal,
      discountApplied: false,
      discountAmount: 0,
      originalTotal
    };
  }
  
  const discountedPricePerNight = calculateDiscountedPrice(basePrice, nights, discountConfig);
  const totalPrice = discountedPricePerNight * nights;
  const discountAmount = originalTotal - totalPrice;
  
  return {
    pricePerNight: discountedPricePerNight,
    totalPrice,
    discountApplied: true,
    discountAmount,
    originalTotal
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
  }
): {
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  totalFees: number;
} {
  // Utiliser les vrais frais de la propriété ou des valeurs par défaut
  const cleaningFee = propertyFees?.cleaning_fee || 0;
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
  }
): {
  pricing: ReturnType<typeof calculateTotalPrice>;
  fees: ReturnType<typeof calculateFees>;
  finalTotal: number;
} {
  const pricing = calculateTotalPrice(basePrice, nights, discountConfig);
  const fees = calculateFees(basePrice, nights, propertyFees);
  const finalTotal = pricing.totalPrice + fees.totalFees;
  
  return {
    pricing,
    fees,
    finalTotal
  };
}


