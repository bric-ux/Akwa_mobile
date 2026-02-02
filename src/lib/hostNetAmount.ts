/**
 * Fonction centralisée pour calculer le montant net que l'hôte reçoit
 * 
 * Cette fonction garantit la cohérence des calculs dans toute l'application :
 * - Mobile (InvoiceDisplay, HostBookingsScreen, HostStatsScreen)
 * 
 * Formule de référence :
 * hostNetAmount = priceAfterDiscount + effectiveCleaningFee + effectiveTaxes - hostCommission
 * 
 * Où :
 * - priceAfterDiscount = basePrice - discountAmount
 * - effectiveCleaningFee = cleaningFee (ou 0 si free_cleaning_min_days applicable)
 * - effectiveTaxes = taxesPerNight * nights
 * - hostCommission = hostCommissionHT + hostCommissionVAT (TTC)
 *   - hostCommissionHT = priceAfterDiscount * 0.02
 *   - hostCommissionVAT = hostCommissionHT * 0.20
 */

import { getCommissionRates } from './commissions';

export interface HostNetAmountParams {
  // Données de base
  pricePerNight: number;
  nights: number;
  discountAmount?: number;
  
  // Frais additionnels
  cleaningFee?: number;
  taxesPerNight?: number;
  
  // Logique free_cleaning_min_days
  freeCleaningMinDays?: number | null;
  
  // Statut de la réservation
  status?: string;
  
  // Type de service
  serviceType?: 'property' | 'vehicle';
}

export interface HostNetAmountResult {
  // Montants de base
  basePrice: number;
  priceAfterDiscount: number;
  
  // Frais effectifs
  effectiveCleaningFee: number;
  effectiveTaxes: number;
  
  // Commission avec TVA
  hostCommissionHT: number;
  hostCommissionVAT: number;
  hostCommission: number; // TTC
  
  // Résultat final
  hostNetAmount: number;
}

/**
 * Calcule le montant net que l'hôte reçoit
 * 
 * @param params Paramètres de calcul
 * @returns Détails du calcul et montant net final
 */
export function calculateHostNetAmount(params: HostNetAmountParams): HostNetAmountResult {
  const {
    pricePerNight,
    nights,
    discountAmount = 0,
    cleaningFee = 0,
    taxesPerNight = 0,
    freeCleaningMinDays = null,
    status = 'confirmed',
    serviceType = 'property',
  } = params;

  // Si la réservation est annulée, le gain net est à zéro
  if (status === 'cancelled') {
    return {
      basePrice: 0,
      priceAfterDiscount: 0,
      effectiveCleaningFee: 0,
      effectiveTaxes: 0,
      hostCommissionHT: 0,
      hostCommissionVAT: 0,
      hostCommission: 0,
      hostNetAmount: 0,
    };
  }

  // 1. Calculer le prix de base
  const basePrice = pricePerNight * nights;

  // 2. Appliquer la réduction
  const priceAfterDiscount = basePrice - discountAmount;

  // 3. Calculer les frais de ménage (avec logique free_cleaning_min_days)
  let effectiveCleaningFee = cleaningFee;
  if (serviceType === 'property' && freeCleaningMinDays && nights >= freeCleaningMinDays) {
    effectiveCleaningFee = 0;
  }

  // 4. Calculer la taxe de séjour (uniquement pour les propriétés)
  const effectiveTaxes = serviceType === 'property' ? taxesPerNight * nights : 0;

  // 5. Calculer la commission hôte AVEC TVA
  const commissionRates = getCommissionRates(serviceType);
  const hostCommissionHT = Math.round(priceAfterDiscount * (commissionRates.hostFeePercent / 100));
  const hostCommissionVAT = Math.round(hostCommissionHT * 0.20);
  const hostCommission = hostCommissionHT + hostCommissionVAT; // TTC

  // 6. Calculer le montant net que l'hôte reçoit
  // Formule : prix après réduction + frais de ménage + taxe de séjour - commission
  const hostNetAmount = priceAfterDiscount + effectiveCleaningFee + effectiveTaxes - hostCommission;

  return {
    basePrice,
    priceAfterDiscount,
    effectiveCleaningFee,
    effectiveTaxes,
    hostCommissionHT,
    hostCommissionVAT,
    hostCommission,
    hostNetAmount,
  };
}

/**
 * Version simplifiée qui retourne uniquement le montant net
 * Utile pour les cas où on n'a pas besoin des détails
 */
export function getHostNetAmount(params: HostNetAmountParams): number {
  return calculateHostNetAmount(params).hostNetAmount;
}

