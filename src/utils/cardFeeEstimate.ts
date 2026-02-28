export type CardFeePaymentCurrency = 'XOF' | 'EUR' | 'USD';

type CardRegion = 'eea' | 'uk' | 'international';

const EEA_COUNTRY_CODES = new Set([
  'AD', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR',
  'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL',
  'PT', 'RO', 'SE', 'SI', 'SK', 'GI', 'GG', 'IM', 'JE', 'MC', 'SM', 'VA', 'GL',
  'FO', 'PM', 'TR', 'GB',
]);

const BASE_RATE_BY_REGION: Record<CardRegion, number> = {
  eea: 0.019,
  uk: 0.025,
  international: 0.0325,
};

const FX_SURCHARGE_RATE = 0.02;
const FIXED_FEE_EUR = 0.25;
const EUR_XOF_REFERENCE_RATE = 655.957;

const normalizeCountryCode = (countryCode?: string): string => {
  if (!countryCode) return '';
  return countryCode.trim().toUpperCase().slice(0, 2);
};

const resolveCardRegion = (countryCode?: string): CardRegion => {
  const normalized = normalizeCountryCode(countryCode);
  if (normalized === 'GB') return 'uk';
  if (EEA_COUNTRY_CODES.has(normalized)) return 'eea';
  return 'international';
};

export const estimateCardProcessingFeeXOF = ({
  baseAmountXof,
  paymentCurrency,
  customerCountryCode,
}: {
  baseAmountXof: number;
  paymentCurrency: CardFeePaymentCurrency;
  customerCountryCode?: string;
}) => {
  const safeBaseAmount = Math.max(0, Math.round(baseAmountXof || 0));
  const region = resolveCardRegion(customerCountryCode);
  const baseRate = BASE_RATE_BY_REGION[region];
  const needsFx = paymentCurrency !== 'EUR';
  const effectiveRate = baseRate + (needsFx ? FX_SURCHARGE_RATE : 0);
  const fixedFeeXof = Math.round(FIXED_FEE_EUR * EUR_XOF_REFERENCE_RATE);
  const feeAmountXof = Math.round(safeBaseAmount * effectiveRate + fixedFeeXof);

  return {
    region,
    baseRate,
    needsFx,
    effectiveRate,
    fixedFeeXof,
    feeAmountXof,
    totalAmountXof: safeBaseAmount + feeAmountXof,
  };
};
