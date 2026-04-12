/**
 * Libellés et détails du parcours filleul (parrainage hôte).
 * Utilisé sur l’écran « Système de parrainage » pour indiquer où en est chaque personne.
 */
/** Aligné sur REFERRAL_CAMPAIGN_UNIT_FCFA dans useReferrals (évite import circulaire). */
const CAMPAIGN_UNIT_FCFA = 1000;

export type FilleulStatusInfo = {
  label: string;
  /** Phrase courte : où en est le filleul dans le tunnel */
  detail: string;
  color: string;
  /** Nom d’icône Ionicons */
  icon: string;
  /** Étape affichée (1 = début du parcours utile) */
  step: number;
  totalSteps: number;
};

const TOTAL = 5;

export function getFilleulStatusInfo(referral: {
  status: string;
  approval_campaign_reward?: boolean | null;
  reward_amount?: number | null;
  cash_reward_amount?: number | null;
  cash_reward_paid?: boolean | null;
}): FilleulStatusInfo {
  const status = referral.status || '';

  switch (status) {
    case 'pending':
      return {
        label: 'En attente',
        detail:
          "Invitation enregistrée : le filleul n'a pas encore utilisé votre code ou terminé son inscription.",
        color: '#f59e0b',
        icon: 'hourglass-outline',
        step: 1,
        totalSteps: TOTAL,
      };
    case 'registered':
      return {
        label: 'Inscrit avec votre code',
        detail: 'Compte créé. Prochaine étape : déposer la candidature hôte (logement).',
        color: '#3498db',
        icon: 'person-add-outline',
        step: 2,
        totalSteps: TOTAL,
      };
    case 'application_submitted':
      return {
        label: 'Candidature déposée',
        detail: "La candidature est en cours d'examen par l'équipe AkwaHome.",
        color: '#6366f1',
        icon: 'document-text-outline',
        step: 3,
        totalSteps: TOTAL,
      };
    // Ancien statut BDD (première propriété créée) : même lecture que « candidature en cours »,
    // le parrainage actuel se conclut à l’approbation de la candidature, pas à la réservation.
    case 'first_property':
      return {
        label: 'Candidature déposée',
        detail: "La candidature est en cours d'examen par l'équipe AkwaHome.",
        color: '#6366f1',
        icon: 'document-text-outline',
        step: 3,
        totalSteps: TOTAL,
      };
    case 'completed': {
      const isCampaign = referral.approval_campaign_reward === true;
      const amt = referral.reward_amount ?? referral.cash_reward_amount ?? 0;
      const paid = referral.cash_reward_paid === true;

      if (isCampaign && amt >= CAMPAIGN_UNIT_FCFA) {
        return {
          label: paid ? 'Récompense versée' : 'Candidature approuvée — récompense à venir',
          detail: paid
            ? `Campagne ${CAMPAIGN_UNIT_FCFA.toLocaleString('fr-FR')} FCFA créditée (selon règles en vigueur).`
            : `Candidature approuvée : ${CAMPAIGN_UNIT_FCFA.toLocaleString('fr-FR')} FCFA prévus après validation du versement.`,
          color: '#2E7D32',
          icon: paid ? 'checkmark-done-outline' : 'wallet-outline',
          step: 5,
          totalSteps: TOTAL,
        };
      }
      if (isCampaign && amt === 0) {
        return {
          label: 'Validé — plafond atteint',
          detail: 'La campagne actuelle ne crédite plus de bonus pour ce filleul (plafond 30 filleuls ou équivalent).',
          color: '#64748b',
          icon: 'alert-circle-outline',
          step: 5,
          totalSteps: TOTAL,
        };
      }
      return {
        label: 'Complété',
        detail:
          amt > 0
            ? `Parcours terminé — récompense enregistrée (${amt.toLocaleString('fr-FR')} FCFA).`
            : 'Parcours de parrainage terminé.',
        color: '#2E7D32',
        icon: 'trophy-outline',
        step: 5,
        totalSteps: TOTAL,
      };
    }
    default:
      return {
        label: status ? String(status) : 'Statut inconnu',
        detail: 'Statut renvoyé par le serveur ; contactez le support si besoin.',
        color: '#64748b',
        icon: 'help-circle-outline',
        step: 1,
        totalSteps: TOTAL,
      };
  }
}
