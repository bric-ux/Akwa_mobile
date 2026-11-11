/**
 * Module de calcul des commissions AkwaHome
 *
 * À partir de nov. 2026 (nouvelles réservations) :
 * - Résidences / hôtels : 10 % commission hôte uniquement (0 % frais voyageur)
 * - Véhicules           : 7 % commission propriétaire uniquement (0 % frais locataire)
 * Sans TVA sur les frais / commissions.
 *
 * Les anciennes réservations conservent les montants déjà stockés
 * (service_fee, host_commission, host_net_amount, booking_calculations).
 * Ne pas recalculer une ancienne résa avec ces taux.
 *
 * ORDRE DE CALCUL (nouvelles résas) :
 * 1. Prix de base × nombre de nuits/jours
 * 2. Application de la réduction (si applicable)
 * 3. Commission hôte sur le prix APRÈS réduction
 */

export type ServiceType = 'property' | 'vehicle' | 'hotel';

export interface CommissionRates {
  travelerFeePercent: number;  // Frais de service payés par le voyageur (0 depuis nov. 2026)
  hostFeePercent: number;      // Commission prélevée sur l'hôte/propriétaire
  totalAkwahomePercent: number; // Total commission Akwahome
}

/** Devise optionnelle (XOF | EUR) */
export type CurrencyCode = 'XOF' | 'EUR' | 'USD';

/** Plus de TVA sur les frais de service / commission (conservé à 0 pour compatibilité des formules). */
export const SERVICE_FEE_VAT_RATE = 0;

/**
 * Taux historiques (avant nov. 2026) — affichage / fallback anciennes réservations uniquement.
 */
export function getLegacyCommissionRates(serviceType: ServiceType): CommissionRates {
  const travelerPercent = serviceType === 'vehicle' ? 10 : 12;
  return {
    travelerFeePercent: travelerPercent,
    hostFeePercent: 2,
    totalAkwahomePercent: travelerPercent + 2,
  };
}

/**
 * Taux de commission pour les NOUVELLES réservations.
 * Résidences / hôtels : 10 % hôte.
 * Véhicules           : 7 % propriétaire.
 */
export function getCommissionRates(
  serviceType: ServiceType,
  _currency?: CurrencyCode,
  _isCardPayment?: boolean
): CommissionRates {
  const hostPercent = serviceType === 'vehicle' ? 7 : 10;
  return {
    travelerFeePercent: 0,
    hostFeePercent: hostPercent,
    totalAkwahomePercent: hostPercent,
  };
}

/**
 * Montants hôtel (mêmes règles que les résidences meublées).
 * Commissions sur le sous-total chambres ; taxes + ménage hors base commission.
 */
export function calculateHotelBookingAmounts(
  roomSubtotal: number,
  taxesTotal: number = 0,
  cleaningFee: number = 0,
) {
  const rates = getCommissionRates('hotel');
  const serviceFee = Math.round(roomSubtotal * (rates.travelerFeePercent / 100));
  const hostCommission = Math.round(roomSubtotal * (rates.hostFeePercent / 100));
  const hostGross = roomSubtotal + taxesTotal + cleaningFee;
  const total = hostGross + serviceFee;
  const hostNetAmount = hostGross - hostCommission;
  return {
    travelerFeePercent: rates.travelerFeePercent,
    hostFeePercent: rates.hostFeePercent,
    serviceFee,
    hostCommission,
    total,
    hostNetAmount,
  };
}

/**
 * Multiplicateur pour passer du prix « base » au total incluant frais de service voyageur (sans TVA).
 */
export function getTravelerServiceFeeTtcMultiplier(
  serviceType: ServiceType,
  currency?: CurrencyCode,
  isCardPayment?: boolean
): number {
  const rates = getCommissionRates(serviceType, currency, isCardPayment);
  return 1 + (rates.travelerFeePercent / 100) * (1 + SERVICE_FEE_VAT_RATE);
}
