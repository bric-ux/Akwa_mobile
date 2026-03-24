/**
 * Texte descriptif des conditions d'annulation selon la politique.
 * Utilisé pour l'affichage dans les modals de modification (véhicule, résidence).
 */
export type ServiceType = 'property' | 'vehicle';

/** Libellé court pour affichage « Modérée : … » */
export const getCancellationPolicyLabel = (
  policy?: string | null,
  _serviceType: ServiceType = 'property'
): string => {
  switch (policy) {
    case 'flexible':
      return 'Flexible';
    case 'moderate':
      return 'Modérée';
    case 'strict':
      return 'Stricte';
    case 'non_refundable':
      return 'Non remboursable';
    default:
      return 'Politique d’annulation';
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
  policy?: string | null,
  serviceType: ServiceType = 'property'
): string => {
  // Quand la politique n'est pas renseignée, éviter d'afficher un texte générique trompeur
  const fallbackProperty = "Politique d'annulation non précisée pour cette propriété. Contactez l'hôte pour plus d'informations.";
  const fallbackVehicle = "Politique d'annulation non précisée pour ce véhicule. Contactez le propriétaire pour plus d'informations.";
  if (!policy) {
    return serviceType === 'property' ? fallbackProperty : fallbackVehicle;
  }

  if (serviceType === 'property') {
    switch (policy) {
      case 'flexible':
        return "Annulation gratuite jusqu'à 24h avant l'arrivée. Remboursement intégral.";
      case 'moderate':
        return "Annulation gratuite jusqu'à 5 jours avant l'arrivée. Après, 50% de pénalité.";
      case 'strict':
        return "Annulation gratuite jusqu'à 28 jours avant l'arrivée. Entre 7 et 28 jours : 50% remboursé. Moins de 7 jours : aucun remboursement.";
      case 'non_refundable':
        return "Aucun remboursement en cas d'annulation.";
      default:
        return fallbackProperty;
    }
  }
  // Véhicule
  switch (policy) {
    case 'flexible':
      return "Flexible – Annulation gratuite jusqu'à 24h avant le début. Remboursement intégral.";
    case 'moderate':
      return "Modérée – Annulation gratuite jusqu'à 5 jours avant le début. Après, 50% de pénalité.";
    case 'strict':
      return "Stricte – Gratuit jusqu'à 28 jours avant. Entre 7 et 28 jours : 50% remboursé. Moins de 7 jours : aucun remboursement.";
    case 'non_refundable':
      return "Non remboursable – Aucun remboursement en cas d'annulation.";
    default:
      return fallbackVehicle;
  }
};
