/**
 * Module de calcul des commissions AkwaHome
 * 
 * Règles de tarification:
 * 
 * Résidences meublées (Properties):
 * - 13% frais de service voyageur quand paiement par carte (CB), 12% sinon
 * - 2% prélevés sur le gain de l'hôte
 *
 * Location de véhicules:
 * - 11% frais de service quand paiement par carte (CB), 10% pour les autres
 * - 2% prélevés sur le gain du propriétaire
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

/**
 * Retourne les taux de commission selon le type de service et le moyen de paiement.
 * - Résidence meublée : 13% quand CB sélectionnée, 12% sinon
 * - Location de véhicule : 11% quand CB, 10% pour les autres
 */
export function getCommissionRates(
  serviceType: ServiceType,
  currency?: CurrencyCode,
  isCardPayment?: boolean
): CommissionRates {
  if (serviceType === 'property') {
    const travelerPercent = isCardPayment ? 13 : 12;
    return {
      travelerFeePercent: travelerPercent,
      hostFeePercent: 2,
      totalAkwahomePercent: travelerPercent + 2
    };
  }
  // Véhicule : 11% si CB, 10% sinon
  const travelerPercent = isCardPayment ? 11 : 10;
  return {
    travelerFeePercent: travelerPercent,
    hostFeePercent: 2,
    totalAkwahomePercent: travelerPercent + 2
  };
}




























