export type HelpFaqItem = {
  id: string;
  /** Mots-clés (synonymes, morceaux, ou expressions). Matching via score sur texte normalisé. */
  keywords: string[];
  answer: string;
};

export const HELP_ASSISTANT_FAQS: HelpFaqItem[] = [
  {
    id: 'reservation',
    keywords: [
      'reserver',
      'reservation',
      'demande',
      'disponible',
      'indisponible',
      'confirmer',
      'refuse',
      'accepter',
      'calendrier',
      'dates',
    ],
    answer:
      "Pour réserver : ouvrez l’annonce (logement ou véhicule), choisissez les dates/heures puis validez. L’hôte / propriétaire a en général 24 h pour accepter ou refuser. Vous suivez l’état dans « Mes réservations ».",
  },
  {
    id: 'reservation_problem',
    keywords: [
      'probleme reservation',
      'impossible reserver',
      'erreur',
      'bug',
      'bloque',
      'echec',
      'ne marche pas',
      'pas possible',
      'indisponible',
      'paiement refuse',
      'verification',
    ],
    answer:
      "Si une réservation échoue : vérifiez d’abord la connexion, puis réessayez. Vérifiez aussi que les dates/heures sont disponibles (pas de dates bloquées) et que le moyen de paiement est supporté. Si l’erreur persiste, envoyez le message au support via le bouton « Envoyer au support » (avec une capture si possible).",
  },
  {
    id: 'cancel',
    keywords: ['annul', 'annulation', 'rembours'],
    answer:
      "Les conditions d'annulation et de remboursement dépendent de la politique indiquée sur l'annonce et du délai avant le début du séjour ou de la location. Ouvrez le détail de la réservation pour voir les options d'annulation disponibles.",
  },
  {
    id: 'payment',
    keywords: [
      'paiement',
      'payer',
      'carte',
      'wave',
      'stripe',
      'echec paiement',
      'paiement refuse',
      'checkout',
      'facture',
      'recu',
      'pdf',
    ],
    answer:
      "Les moyens de paiement proposés s'affichent au moment du paiement (selon la résidence ou le véhicule). Après un paiement en ligne, gardez la confirmation dans « Mes réservations ». En cas d'échec, vérifiez votre connexion et réessayez.",
  },
  {
    id: 'host',
    keywords: [
      'hote',
      'devenir hote',
      'candidature',
      'heberger',
      'propriete',
      'ajouter propriete',
      'annonce',
      'publier',
      'masquer',
      'active',
    ],
    answer:
      "Pour proposer un logement : déposez une candidature hôte depuis l'app. Une fois acceptée, vous pourrez créer votre annonce, tarifs et disponibilités. Les réservations se gèrent dans l'espace hôte.",
  },
  {
    id: 'vehicle',
    keywords: [
      'vehicule',
      'voiture',
      'location voiture',
      'ajouter vehicule',
      'mettre en ligne',
      'annonce vehicule',
      'chauffeur',
      'surplus chauffeur',
      'permis',
      'caution',
      'heure',
      'par heure',
      'horaire',
    ],
    answer:
      "Les locations véhicule fonctionnent comme les logements mais avec créneaux, permis si requis et option chauffeur selon l'annonce. Les tarifs (jour / heure) et la caution sont indiqués sur la fiche véhicule.",
  },
  {
    id: 'add_vehicle_howto',
    keywords: [
      'ajouter un vehicule',
      'ajout vehicule',
      'creer vehicule',
      'publier vehicule',
      'mettre vehicule',
      'mes vehicules',
      'proprietaire vehicule',
      'owner',
    ],
    answer:
      "Pour ajouter un véhicule : passez en mode Propriétaire véhicule (si disponible), puis ouvrez « Mes véhicules » → « Ajouter ». Remplissez les infos (marque/modèle, photos, tarifs par jour/heure si activés, caution, permis si requis) puis enregistrez. Après validation, l’annonce peut être visible aux locataires selon le statut et l’activation.",
  },
  {
    id: 'vehicle_driver_fee',
    keywords: ['chauffeur', 'driver', 'surplus chauffeur', 'frais chauffeur', 'par jour', 'prorata', 'pro rata', 'heure'],
    answer:
      "Le « surplus chauffeur » est configuré comme un montant par jour. Pour les réservations à l’heure (ou les heures en plus des jours), il est appliqué au prorata (sur la base de 24 h = 1 jour).",
  },
  {
    id: 'identity',
    keywords: ['identite', 'verification', 'piece', 'passeport', 'cni'],
    answer:
      "La vérification d'identité peut être requise pour certaines réservations. Déposez les documents demandés depuis votre profil ou l'écran indiqué ; le traitement est ensuite effectué par l'équipe.",
  },
  {
    id: 'calendar_checkout_rule',
    keywords: [
      '24 au 25',
      '25 au 26',
      'check out',
      'checkout',
      'check in',
      'chevauchement',
      'overlap',
      'calendrier',
      'date depart',
    ],
    answer:
      "Règle calendrier : le jour de départ (check-out / restitution) est libre pour une nouvelle réservation le même jour. Exemple : une réservation 24→25 ne doit pas bloquer 25→26.",
  },
  {
    id: 'fees',
    keywords: ['frais', 'commission', 'service', 'prix', 'caution'],
    answer:
      "Le détail du prix (nuits ou jours, frais de service plateforme, taxes éventuelles, caution) est affiché avant le paiement. Les frais de service sont calculés sur le montant indiqué dans le récapitulatif.",
  },
  {
    id: 'hidden_property',
    keywords: ['propriete masquee', 'masquee', 'cachee', 'is_active', 'inactive', 'admin masque', 'je ne vois plus', 'espace hote'],
    answer:
      "Si une propriété est masquée (inactive), elle peut ne plus être visible au public. Dans l’espace hôte, elle doit rester visible pour gestion et pour voir les réservations. Si vous ne voyez plus l’annonce, envoyez un message au support avec l’ID du bien (ou le titre) pour vérification.",
  },
  {
    id: 'messaging',
    keywords: ['message', 'discussion', 'contacter', 'chat'],
    answer:
      "Utilisez la messagerie intégrée pour échanger avec l'hôte ou le propriétaire après une demande ou une réservation, depuis l'onglet Messages.",
  },
  {
    id: 'account',
    keywords: ['compte', 'mot de passe', 'email', 'profil', 'supprimer'],
    answer:
      "Profil et mot de passe : menu Profil / Paramètres. Pour la suppression de compte, utilisez l'option dédiée dans les paramètres (action irréversible selon nos conditions).",
  },
];

export function normalizeHelpText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(n: string): string[] {
  if (!n) return [];
  return n
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      // mini-stemming FR très simple
      if (t.length > 5 && t.endsWith('s')) return t.slice(0, -1);
      return t;
    });
}

function scoreKeywordMatch(normalizedQuestion: string, tokens: Set<string>, keyword: string): number {
  const kw = normalizeHelpText(keyword);
  if (!kw) return 0;

  // expression exacte -> gros score
  if (normalizedQuestion.includes(kw)) {
    // plus l’expression est longue, plus c’est discriminant
    return 4 + Math.min(4, Math.floor(kw.length / 8));
  }

  // match token par token (ex: "ajouter vehicule")
  const kwTokens = tokenize(kw);
  if (kwTokens.length === 0) return 0;

  let hits = 0;
  for (const t of kwTokens) {
    if (tokens.has(t)) hits += 1;
  }

  if (hits === 0) return 0;
  // score proportionnel + petit bonus si expression multi-mots
  const ratio = hits / kwTokens.length;
  const bonus = kwTokens.length >= 2 && hits >= 2 ? 2 : 0;
  return ratio * 3 + bonus;
}

/**
 * “Mini-modèle” local : score par intention (FAQ) basé sur tokens + expressions.
 * Retourne une réponse seulement si le score dépasse un seuil (évite réponses hors-sujet).
 */
export function findHelpFaqAnswer(userText: string): string | null {
  const n = normalizeHelpText(userText);
  if (!n) return null;
  const tokenList = tokenize(n);
  const tokenSet = new Set(tokenList);

  // Indices rapides
  const hasReservationSignal =
    tokenSet.has('reservation') || tokenSet.has('reserver') || tokenSet.has('date') || tokenSet.has('calendrier');
  const hasVehicleSignal = tokenSet.has('vehicule') || tokenSet.has('voiture');

  let best: { score: number; answer: string } | null = null;

  for (const item of HELP_ASSISTANT_FAQS) {
    let score = 0;
    for (const kw of item.keywords) {
      score += scoreKeywordMatch(n, tokenSet, kw);
    }

    // petits ajustements par “intention”
    if (item.id.startsWith('vehicle') || item.id.includes('vehicle')) {
      if (hasVehicleSignal) score += 1.5;
    }
    if (item.id.includes('reservation')) {
      if (hasReservationSignal) score += 1.0;
    }

    if (!best || score > best.score) best = { score, answer: item.answer };
  }

  // Seuil : on évite de répondre si question trop vague (“salut”, “?”)
  return best && best.score >= 5 ? best.answer : null;
}
