/**
 * Produits expérimentaux (bail longue durée, hôtel) :
 * - Admins : toujours visibles
 * - Autres : selon les flags DB (platform_feature_flags)
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
 * Gate : admins voient toujours ; non-admins suivent les flags DB.
 * (Évite l’espace hôtel / bail qui apparaît puis disparaît.)
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
  return { ...flags };
}

/** @deprecated Préférer useFeatureFlags() */
export const FEATURE_MONTHLY_RENTAL = false;

/** @deprecated Préférer useFeatureFlags() */
export const FEATURE_HOTEL = false;
