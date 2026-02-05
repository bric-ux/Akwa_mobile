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

/**
 * Retourne les taux de commission selon le type de service
 */
export function getCommissionRates(serviceType: ServiceType): CommissionRates {
  if (serviceType === 'property') {
    return {
      travelerFeePercent: 12,
      hostFeePercent: 2,
      totalAkwahomePercent: 14
    };
  } else {
    return {
      travelerFeePercent: 10,
      hostFeePercent: 2,
      totalAkwahomePercent: 12
    };
  }
}

























