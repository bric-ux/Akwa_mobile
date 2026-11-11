/**
 * Déduit le sous-total hébergement (après réduction) du total payé.
 * Utilisé pour le calcul du prix effectif par nuit lors des annulations (cohérence avec modification).
 */
export function inferOriginalSubtotal(
  totalPrice: number,
  nights: number,
  prop: { cleaning_fee?: number; taxes?: number; free_cleaning_min_days?: number | null },
  /** Conservé pour compatibilité. */
  _isCardOrWavePayment?: boolean,
  /** Frais voyageur stockés sur la réservation (anciennes résas) — prioritaire. */
  storedServiceFee?: number | null,
): number {
  const total = Number(totalPrice);
  const isFreeCleaning = prop.free_cleaning_min_days != null && nights >= prop.free_cleaning_min_days;
  const cleaning = isFreeCleaning ? 0 : (prop.cleaning_fee || 0);
  const taxes = (prop.taxes || 0) * nights;
  if (storedServiceFee != null && Number.isFinite(Number(storedServiceFee))) {
    return Math.round(total - cleaning - taxes - Number(storedServiceFee));
  }
  // Anciennes résas sans service_fee stocké : modèle 12 % voyageur.
  // Nouvelles résas (0 % voyageur) : total ≈ subtotal + ménage + taxes.
  const legacyRate = 0.12;
  const withoutLegacy = total - cleaning - taxes;
  const withLegacy = Math.round(withoutLegacy / (1 + legacyRate));
  // Si le total « ressemble » au modèle legacy (écart faible), l’utiliser.
  const recomputedLegacy =
    withLegacy + Math.round(withLegacy * legacyRate) + cleaning + taxes;
  if (Math.abs(recomputedLegacy - total) <= 100) return withLegacy;
  return Math.round(withoutLegacy);
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
