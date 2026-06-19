export const MATCH_PREDICTION_KEY = 'civ-allemagne-2026-06-20';
export const MATCH_PREDICTION_LABEL = "Allemagne vs Côte d'Ivoire - 20 juin 2026";
export const MATCH_PREDICTION_DEADLINE = new Date('2026-06-20T20:00:00Z');
export const MATCH_PREDICTION_PENDING_STORAGE_KEY = 'match_prediction_pending_scores';
/** Bannière accueil masquée à partir du 21/06/2026 00:00 GMT */
export const MATCH_PREDICTION_HOME_BANNER_END = new Date('2026-06-21T00:00:00Z');

export function isMatchPredictionHomeBannerVisible(now = new Date()): boolean {
  return now.getTime() < MATCH_PREDICTION_HOME_BANNER_END.getTime();
}
