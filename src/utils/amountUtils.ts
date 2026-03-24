/**
 * Déduit le sous-total hébergement (après réduction) du total payé.
 * Utilisé pour le calcul du prix effectif par nuit lors des annulations (cohérence avec modification).
 */
export function inferOriginalSubtotal(
  totalPrice: number,
  nights: number,
  prop: { cleaning_fee?: number; taxes?: number; free_cleaning_min_days?: number | null },
  /** Aligné sur getCommissionRates(property) : 13 % si carte/Wave, 12 % sinon. */
  isCardOrWavePayment?: boolean
): number {
  const total = Number(totalPrice);
  const isFreeCleaning = prop.free_cleaning_min_days != null && nights >= prop.free_cleaning_min_days;
  const cleaning = isFreeCleaning ? 0 : (prop.cleaning_fee || 0);
  const taxes = (prop.taxes || 0) * nights;
  const travelerPct = isCardOrWavePayment ? 13 : 12;
  const serviceFeeRate = (travelerPct / 100) * 1.2;
  return Math.round((total - cleaning - taxes) / (1 + serviceFeeRate));
}

/**
 * Convertit un montant vers XOF pour affichage.
 * Si la réservation a été payée en EUR/USD, total_price peut être stocké dans cette devise.
 * exchange_rate = XOF par unité de devise (ex: 655.957 pour EUR).
 */
export function getAmountInXOF(
  amount: number,
  paymentCurrency?: string | null,
  exchangeRate?: number | null
): number {
  if (!amount || amount <= 0) return 0;
  const pc = (paymentCurrency || 'XOF').toUpperCase();
  const rate = exchangeRate && exchangeRate > 0 ? Number(exchangeRate) : 0;
  if ((pc === 'EUR' || pc === 'USD') && rate > 0) {
    return Math.round(amount * rate);
  }
  return Math.round(amount);
}
