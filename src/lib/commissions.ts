/**
 * Module de calcul des commissions AkwaHome
 *
 * Résidences / véhicules : frais de service voyageur (% sur prix après réduction) et commission hôte (%), sans TVA.
 *
 * ORDRE DE CALCUL:
 * 1. Prix de base × nombre de nuits/jours
 * 2. Application de la réduction (si applicable)
 * 3. Calcul des commissions sur le prix APRÈS réduction
 */

export type ServiceType = 'property' | 'vehicle';

export interface CommissionRates {
  travelerFeePercent: number;  // Frais de service payés par le voyageur
  hostFeePercent: number;      // Commission prélevée sur l'hôte/propriétaire
  totalAkwahomePercent: number; // Total commission Akwahome
}

/** Devise optionnelle (XOF | EUR) */
export type CurrencyCode = 'XOF' | 'EUR' | 'USD';

/** Plus de TVA sur les frais de service / commission (conservé à 0 pour compatibilité des formules). */
export const SERVICE_FEE_VAT_RATE = 0;

/**
 * Retourne les taux de commission selon le type de service.
 * Frais voyageur / locataire : 1 % HT (CB ou autre : même taux).
 */
export function getCommissionRates(
  _serviceType: ServiceType,
  _currency?: CurrencyCode,
  _isCardPayment?: boolean
): CommissionRates {
  const travelerPercent = 1;
  return {
    travelerFeePercent: travelerPercent,
    hostFeePercent: 2,
    totalAkwahomePercent: travelerPercent + 2
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




























