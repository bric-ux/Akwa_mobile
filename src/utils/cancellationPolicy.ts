/**
 * Texte descriptif des conditions d'annulation selon la politique.
 * Utilisé pour l'affichage dans les modals de modification (véhicule, résidence).
 */
export type ServiceType = 'property' | 'vehicle';

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
