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
