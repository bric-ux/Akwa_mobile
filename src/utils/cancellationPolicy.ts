/**
 * Texte descriptif des conditions d'annulation selon la politique.
 * Utilisé pour l'affichage dans les modals de modification (véhicule, résidence).
 */
export type ServiceType = 'property' | 'vehicle';

export const getCancellationPolicyText = (
  policy?: string | null,
  serviceType: ServiceType = 'property'
): string => {
  const fallbackProperty = "Annulation gratuite jusqu'à 1 jour avant l'arrivée. Remboursement intégral.";
  const fallbackVehicle = "Annulation gratuite jusqu'à 24h avant le début. Remboursement intégral.";
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
        return "Annulation gratuite jusqu'à 7 jours avant l'arrivée. Après, 50% de pénalité.";
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
      return "Stricte – Remboursement 50% jusqu'à 7 jours avant le début. Après, pénalité plus forte.";
    case 'non_refundable':
      return "Non remboursable – Aucun remboursement en cas d'annulation.";
    default:
      return fallbackVehicle;
  }
};
