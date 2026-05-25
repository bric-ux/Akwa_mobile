/** Valeurs sûres pour host_applications (évite numeric field overflow DECIMAL(5,2) en prod). */

const MAX_MONEY = 999_999_999;

export function clampHostMoney(value?: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const n = Math.round(Number(value));
  if (n < 0) return 0;
  return Math.min(n, MAX_MONEY);
}

export function clampHostPercent(value?: number | null): number | null {
  if (value == null || Number.isNaN(value)) return null;
  const n = Math.round(Number(value));
  if (n < 1) return null;
  return Math.min(n, 100);
}

export function resolvePricePerNightForDb(
  isMonthly: boolean,
  pricePerNight?: number | null,
): number {
  if (isMonthly) return 1;
  const p = clampHostMoney(pricePerNight);
  return p != null && p >= 1000 ? p : 1000;
}

export function mapHostApplicationNumbers(data: {
  isMonthlyRental?: boolean;
  pricePerNight?: number | null;
  monthlyRentPrice?: number | null;
  securityDeposit?: number | null;
  surfaceM2?: number | null;
  cleaningFee?: number | null;
  taxes?: number | null;
  discountPercentage?: number | null;
  longStayDiscountPercentage?: number | null;
}) {
  const isMonthly = !!data.isMonthlyRental;
  return {
    price_per_night: resolvePricePerNightForDb(isMonthly, data.pricePerNight),
    monthly_rent_price: isMonthly ? clampHostMoney(data.monthlyRentPrice) : null,
    security_deposit: clampHostMoney(data.securityDeposit),
    surface_m2: clampHostMoney(data.surfaceM2),
    cleaning_fee: clampHostMoney(data.cleaningFee) ?? 0,
    taxes: clampHostMoney(data.taxes) ?? 0,
    discount_percentage: clampHostPercent(data.discountPercentage),
    long_stay_discount_percentage: clampHostPercent(data.longStayDiscountPercentage),
  };
}

export function friendlyHostApplicationDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('numeric field overflow')) {
    return 'Un montant ou un pourcentage est trop élevé. Vérifiez le prix, le loyer mensuel, les frais et les réductions (max. 100 %).';
  }
  if (m.includes('price_per_night') || m.includes('positive_price')) {
    return 'Le prix par nuit doit être d\'au moins 1 000 FCFA.';
  }
  return message;
}
