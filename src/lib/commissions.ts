/**
 * Module de calcul des commissions AkwaHome
 * 
 * Règles de tarification:
 * 
 * Résidences meublées (Properties):
 * - Commission totale Akwahome: 14%
 *   - 12% frais de service facturés au voyageur
 *   - 2% prélevés sur le gain de l'hôte
 * 
 * Location de véhicules:
 * - Commission totale Akwahome: 12%
 *   - 10% frais de service facturés au locataire
 *   - 2% prélevés sur le gain du propriétaire
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

/** Devise optionnelle : quand EUR, commissions spécifiques (14% voyageur résidence, 12% locataire véhicule) */
export type CurrencyCode = 'XOF' | 'EUR' | 'USD';

/**
 * Retourne les taux de commission selon le type de service et la devise (si EUR).
 * Quand la devise euro est sélectionnée :
 * - Résidence meublée : 14% frais de service pour le voyageur (au lieu de 12%)
 * - Location de véhicule : 12% frais de service pour le locataire (au lieu de 10%)
 */
export function getCommissionRates(serviceType: ServiceType, currency?: CurrencyCode): CommissionRates {
  const isEur = currency === 'EUR';
  if (serviceType === 'property') {
    return {
      travelerFeePercent: isEur ? 14 : 12,
      hostFeePercent: 2,
      totalAkwahomePercent: isEur ? 16 : 14
    };
  } else {
    return {
      travelerFeePercent: isEur ? 12 : 10,
      hostFeePercent: 2,
      totalAkwahomePercent: isEur ? 14 : 12
    };
  }
}




























