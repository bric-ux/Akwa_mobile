import { getCommissionRates, type CurrencyCode } from './commissions';
import { calculateTotalPrice, type DiscountConfig } from '../hooks/usePricing';

export interface HotelBookingLineInput {
  price_per_night: number;
  cleaning_fee?: number;
  taxes_per_night?: number;
  quantity: number;
  discount_enabled?: boolean;
  discount_min_nights?: number | null;
  discount_percentage?: number | null;
  long_stay_discount_enabled?: boolean;
  long_stay_discount_min_nights?: number | null;
  long_stay_discount_percentage?: number | null;
}

export interface HotelBookingPricingResult {
  nights: number;
  basePrice: number;
  priceAfterDiscount: number;
  discountAmount: number;
  discountApplied: boolean;
  discountType?: 'normal' | 'long_stay';
  totalCleaningFee: number;
  totalTaxes: number;
  serviceFee: number;
  hostCommission: number;
  hostNetAmount: number;
  finalTotal: number;
  lineTotals: {
    lineTotal: number;
    quantity: number;
    price_per_night: number;
    cleaning_fee: number;
    discountAmount?: number;
  }[];
}

function discountConfigs(line: HotelBookingLineInput): {
  standard: DiscountConfig;
  longStay?: DiscountConfig;
} {
  const standard: DiscountConfig = {
    enabled: Boolean(line.discount_enabled),
    minNights: line.discount_min_nights ?? null,
    percentage: line.discount_percentage ?? null,
  };
  const longStay: DiscountConfig | undefined = line.long_stay_discount_enabled
    ? {
        enabled: true,
        minNights: line.long_stay_discount_min_nights ?? null,
        percentage: line.long_stay_discount_percentage ?? null,
      }
    : undefined;
  return { standard, longStay };
}

export function calculateHotelBookingPricing(
  lines: HotelBookingLineInput[],
  nights: number,
  currency: CurrencyCode = 'XOF',
  isCardPayment?: boolean,
): HotelBookingPricingResult {
  let basePrice = 0;
  let priceAfterDiscount = 0;
  let discountAmount = 0;
  let discountApplied = false;
  let discountType: 'normal' | 'long_stay' | undefined;
  let totalCleaningFee = 0;
  let totalTaxes = 0;
  const lineTotals: HotelBookingPricingResult['lineTotals'] = [];

  for (const line of lines) {
    const qty = Math.max(1, line.quantity);
    const { standard, longStay } = discountConfigs(line);
    const unitPricing = calculateTotalPrice(line.price_per_night, nights, standard, longStay);
    const lineBase = unitPricing.originalTotal * qty;
    const lineAfter = unitPricing.totalPrice * qty;
    const lineDiscount = unitPricing.discountAmount * qty;

    basePrice += lineBase;
    priceAfterDiscount += lineAfter;
    discountAmount += lineDiscount;
    if (unitPricing.discountApplied) {
      discountApplied = true;
      discountType = unitPricing.discountType;
    }

    const cleaning = (line.cleaning_fee || 0) * qty;
    const taxes = (line.taxes_per_night || 0) * nights * qty;
    totalCleaningFee += cleaning;
    totalTaxes += taxes;
    lineTotals.push({
      lineTotal: lineAfter + cleaning,
      quantity: qty,
      price_per_night: line.price_per_night,
      cleaning_fee: line.cleaning_fee || 0,
      discountAmount: lineDiscount,
    });
  }

  const rates = getCommissionRates('property', currency, isCardPayment);
  const serviceFee = Math.round(priceAfterDiscount * (rates.travelerFeePercent / 100));
  const hostCommission = Math.round(priceAfterDiscount * (rates.hostFeePercent / 100));
  const hostNetAmount = priceAfterDiscount + totalCleaningFee + totalTaxes - hostCommission;
  const finalTotal = priceAfterDiscount + totalCleaningFee + totalTaxes + serviceFee;

  return {
    nights,
    basePrice,
    priceAfterDiscount,
    discountAmount,
    discountApplied,
    discountType,
    totalCleaningFee,
    totalTaxes,
    serviceFee,
    hostCommission,
    hostNetAmount,
    finalTotal,
    lineTotals,
  };
}

/** Montant à encaisser en ligne (carte / Wave), avec plan fractionné optionnel. */
export function getHotelOnlineChargeAmount(
  finalTotal: number,
  serviceFee: number,
  paymentPlan: 'full' | 'split',
): number {
  if (paymentPlan !== 'split') return finalTotal;
  const remainderBase = finalTotal - serviceFee;
  return Math.round(remainderBase * 0.5) + serviceFee;
}
