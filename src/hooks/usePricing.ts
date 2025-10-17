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
 * Calcule les frais supplémentaires
 */
export function calculateFees(basePrice: number, nights: number): {
  cleaningFee: number;
  serviceFee: number;
  totalFees: number;
} {
  // Frais de nettoyage : 5% du prix de base par nuit
  const cleaningFee = Math.round(basePrice * 0.05);
  
  // Frais de service : 3% du prix de base par nuit
  const serviceFee = Math.round(basePrice * 0.03);
  
  const totalFees = cleaningFee + serviceFee;
  
  return {
    cleaningFee,
    serviceFee,
    totalFees
  };
}

/**
 * Calcule le prix total final avec tous les frais
 */
export function calculateFinalPrice(
  basePrice: number,
  nights: number,
  discountConfig: DiscountConfig
): {
  pricing: ReturnType<typeof calculateTotalPrice>;
  fees: ReturnType<typeof calculateFees>;
  finalTotal: number;
} {
  const pricing = calculateTotalPrice(basePrice, nights, discountConfig);
  const fees = calculateFees(basePrice, nights);
  const finalTotal = pricing.totalPrice + fees.totalFees;
  
  return {
    pricing,
    fees,
    finalTotal
  };
}


