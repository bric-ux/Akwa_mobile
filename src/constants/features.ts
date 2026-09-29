/**
 * Produits expérimentaux (bail longue durée, hôtel) :
 * visibles UNIQUEMENT pour un admin connecté (tests internes).
 * Masqués pour tous les autres utilisateurs.
 */
export const FEATURE_FLAG_KEYS = {
  monthlyRental: 'monthly_rental',
  hotel: 'hotel',
} as const;

export type FeatureFlagKey =
  (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

/** Défauts : off pour tout le monde. */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  monthly_rental: false,
  hotel: false,
};

/**
 * Gate : seuls les admins connectés voient bail longue durée + hôtel.
 * Les flags DB / admin UI n’ouvrent pas le produit aux non-admins.
 */
export function applyExperimentalProductGate(
  flags: Record<FeatureFlagKey, boolean>,
  isAdmin: boolean,
): Record<FeatureFlagKey, boolean> {
  if (isAdmin) {
    return {
      ...flags,
      monthly_rental: true,
      hotel: true,
    };
  }
  return {
    ...flags,
    monthly_rental: false,
    hotel: false,
  };
}

/** @deprecated Préférer useFeatureFlags() — toujours false hors admin. */
export const FEATURE_MONTHLY_RENTAL = false;

/** @deprecated Préférer useFeatureFlags() — toujours false hors admin. */
export const FEATURE_HOTEL = false;
