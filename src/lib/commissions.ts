/**
 * Module de calcul des commissions AkwaHome
 *
 * Résidences meublées : 1 % frais de service voyageur (HT) + TVA 20 % sur ces frais ; 2 % hôte (HT) + TVA.
 * Location de véhicules : 1 % frais locataire (HT) + TVA 20 % ; 2 % propriétaire (HT) + TVA.
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

/** TVA sur les frais de service / commission (HT), alignée produit. */
export const SERVICE_FEE_VAT_RATE = 0.2;

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
 * Multiplicateur pour passer du prix « base » au total incluant frais de service voyageur TTC :
 * total = base × (1 + (traveler% / 100) × (1 + TVA sur frais)).
 */
export function getTravelerServiceFeeTtcMultiplier(
  serviceType: ServiceType,
  currency?: CurrencyCode,
  isCardPayment?: boolean
): number {
  const rates = getCommissionRates(serviceType, currency, isCardPayment);
  return 1 + (rates.travelerFeePercent / 100) * (1 + SERVICE_FEE_VAT_RATE);
}




























