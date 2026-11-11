/**
 * Texte descriptif des conditions d'annulation selon la politique.
 * Utilisé pour l'affichage dans les modals de modification (véhicule, résidence).
 */
export type ServiceType = 'property' | 'vehicle';

type TranslateFn = (key: string, params?: Record<string, string>) => string;

/** Libellé court pour affichage « Modérée : … » */
export const getCancellationPolicyLabel = (
  policy: string | null | undefined,
  _serviceType: ServiceType = 'property',
  t: TranslateFn,
): string => {
  switch (policy) {
    case 'flexible':
      return t('cancel.labelFlexible');
    case 'moderate':
      return t('cancel.labelModerate');
    case 'strict':
      return t('cancel.labelStrict');
    case 'non_refundable':
      return t('cancel.labelNonRefundable');
    default:
      return t('cancel.policyDefault');
  }
};

/**
 * Espèces / virement (résidence) : le voyageur remet l'argent à l'hôte à l'arrivée (jour du check-in).
 */
export function hostHasReceivedGuestCashProperty(booking: {
  check_in_date: string;
  payment_method?: string | null;
}): boolean {
  const pm = booking.payment_method;
  if (pm === 'card' || pm === 'wave') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ci = new Date(booking.check_in_date);
  ci.setHours(0, 0, 0, 0);
  return today.getTime() >= ci.getTime();
}

/**
 * Espèces / virement (véhicule) : le locataire paie le propriétaire à la remise du véhicule (début de location).
 */
export function ownerHasReceivedRenterCashVehicle(booking: {
  start_date: string;
  start_datetime?: string | null;
  payment_method?: string | null;
}): boolean {
  const pm = booking.payment_method;
  if (pm === 'card' || pm === 'wave') return false;
  const start = booking.start_datetime ? new Date(booking.start_datetime) : new Date(booking.start_date);
  return !Number.isNaN(start.getTime()) && Date.now() >= start.getTime();
}

/**
 * Réduction de séjour (modification) : remboursement théorique uniquement si l’hôte est réputé avoir
 * reçu les fonds — aligné sur l’annulation (CB/Wave : 48 h après le check-in ; espèces : jour du check-in).
 */
export function hostReceivedFundsForModificationRefundProperty(booking: {
  check_in_date: string;
  payment_method?: string | null;
}): boolean {
  const pm = booking.payment_method;
  if (pm === 'card' || pm === 'wave') {
    const t =
      new Date(booking.check_in_date).getTime() + 48 * 60 * 60 * 1000;
    return Date.now() >= t;
  }
  return hostHasReceivedGuestCashProperty(booking);
}

/**
 * Réduction de durée (modification véhicule) : idem pour le propriétaire (CB/Wave : 48 h après le début de location).
 */
export function ownerReceivedFundsForModificationRefundVehicle(booking: {
  start_date: string;
  start_datetime?: string | null;
  payment_method?: string | null;
}): boolean {
  const pm = booking.payment_method;
  if (pm === 'card' || pm === 'wave') {
    const start = booking.start_datetime
      ? new Date(booking.start_datetime)
      : new Date(booking.start_date);
    if (Number.isNaN(start.getTime())) return false;
    const t = start.getTime() + 48 * 60 * 60 * 1000;
    return Date.now() >= t;
  }
  return ownerHasReceivedRenterCashVehicle(booking);
}

export const getCancellationPolicyText = (
  policy: string | null | undefined,
  serviceType: ServiceType = 'property',
  t: TranslateFn,
): string => {
  if (!policy) {
    return serviceType === 'property' ? t('cancel.propertyFallback') : t('cancel.vehicleFallback');
  }

  if (serviceType === 'property') {
    switch (policy) {
      case 'flexible':
        return t('cancel.propertyFlexible');
      case 'moderate':
        return t('cancel.propertyModerate');
      case 'strict':
        return t('cancel.propertyStrict');
      case 'non_refundable':
        return t('cancel.propertyNonRefundable');
      default:
        return t('cancel.propertyFallback');
    }
  }
  switch (policy) {
    case 'flexible':
      return t('cancel.vehicleFlexible');
    case 'moderate':
      return t('cancel.vehicleModerate');
    case 'strict':
      return t('cancel.vehicleStrict');
    case 'non_refundable':
      return t('cancel.vehicleNonRefundable');
    default:
      return t('cancel.vehicleFallback');
  }
};
