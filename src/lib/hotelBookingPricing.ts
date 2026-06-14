import { getCommissionRates, type CurrencyCode } from './commissions';

export interface HotelBookingLineInput {
  price_per_night: number;
  cleaning_fee?: number;
  taxes_per_night?: number;
  quantity: number;
}

export interface HotelBookingPricingResult {
  nights: number;
  basePrice: number;
  priceAfterDiscount: number;
  totalCleaningFee: number;
  totalTaxes: number;
  serviceFee: number;
  hostCommission: number;
  hostNetAmount: number;
  finalTotal: number;
  lineTotals: { lineTotal: number; quantity: number; price_per_night: number; cleaning_fee: number }[];
}

export function calculateHotelBookingPricing(
  lines: HotelBookingLineInput[],
  nights: number,
  currency: CurrencyCode = 'XOF',
  isCardPayment?: boolean,
): HotelBookingPricingResult {
  let basePrice = 0;
  let totalCleaningFee = 0;
  let totalTaxes = 0;
  const lineTotals: HotelBookingPricingResult['lineTotals'] = [];

  for (const line of lines) {
    const qty = Math.max(1, line.quantity);
    const lineBase = line.price_per_night * nights * qty;
    const cleaning = (line.cleaning_fee || 0) * qty;
    const taxes = (line.taxes_per_night || 0) * nights * qty;
    basePrice += lineBase;
    totalCleaningFee += cleaning;
    totalTaxes += taxes;
    lineTotals.push({
      lineTotal: lineBase + cleaning,
      quantity: qty,
      price_per_night: line.price_per_night,
      cleaning_fee: line.cleaning_fee || 0,
    });
  }

  const priceAfterDiscount = basePrice;
  const rates = getCommissionRates('property', currency, isCardPayment);
  const serviceFee = Math.round(priceAfterDiscount * (rates.travelerFeePercent / 100));
  const hostCommission = Math.round(priceAfterDiscount * (rates.hostFeePercent / 100));
  const hostNetAmount = priceAfterDiscount + totalCleaningFee + totalTaxes - hostCommission;
  const finalTotal = priceAfterDiscount + totalCleaningFee + totalTaxes + serviceFee;

  return {
    nights,
    basePrice,
    priceAfterDiscount,
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
