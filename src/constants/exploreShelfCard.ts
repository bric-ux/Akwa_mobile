import { Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;

/** Largeur carte portrait sur l'accueil (carrousels horizontaux). */
export const EXPLORE_SHELF_CARD_WIDTH = Math.round(
  Math.max(198, Math.min(SCREEN_W * 0.56, 232)),
);

/** Ratio 3:4 portrait — format cartes accueil. */
export const EXPLORE_SHELF_IMAGE_HEIGHT = Math.round(EXPLORE_SHELF_CARD_WIDTH * (4 / 3));

export const EXPLORE_SHELF_IMAGE_RADIUS = 26;

/** Titre court sur une ligne (avec note à droite sur la carte). */
export const EXPLORE_SHELF_TITLE_ONE_LINE_MAX = 26;

export function formatExploreShelfHeadline({
  title,
  typeLabel,
  maxLength = EXPLORE_SHELF_TITLE_ONE_LINE_MAX,
}: {
  title: string;
  typeLabel?: string | null;
  maxLength?: number;
}): string {
  const normalized = title.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) return normalized;
  return typeLabel?.trim() || 'Logement';
}

export function formatExploreShelfRatingSubtitle(
  rating: number | undefined | null,
  reviewCount: number | undefined | null,
): string | undefined {
  const r = Number(rating) || 0;
  const count = Number(reviewCount) || 0;
  if (r <= 0 && count <= 0) return undefined;
  const label = `⭐ ${r.toFixed(1)}`;
  return count > 0 ? `${label} (${count})` : label;
}
