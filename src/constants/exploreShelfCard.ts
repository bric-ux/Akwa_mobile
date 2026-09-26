import { Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;

/** Largeur carte portrait sur l'accueil (carrousels horizontaux). */
export const EXPLORE_SHELF_CARD_WIDTH = Math.round(
  Math.max(198, Math.min(SCREEN_W * 0.56, 232)),
);

/** Ratio 3:4 portrait — format cartes accueil. */
export const EXPLORE_SHELF_IMAGE_HEIGHT = Math.round(EXPLORE_SHELF_CARD_WIDTH * (4 / 3));

export const EXPLORE_SHELF_IMAGE_RADIUS = 26;

/** Marge horizontale standard des cartes liste (16 + 16). */
const LIST_CARD_SIDE_MARGIN = 32;

/** Format 3:2 pour les cartes résultats recherche (aligné site web). */
export const LIST_CARD_IMAGE_HEIGHT = Math.round(
  (SCREEN_W - LIST_CARD_SIDE_MARGIN) * (2 / 3),
);

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

/**
 * Titre carte résultats : coupe sur un mot, ou type de bien si trop long / marketing.
 */
export function formatListCardTitle({
  title,
  typeLabel,
  maxLength = 52,
}: {
  title: string;
  typeLabel?: string | null;
  maxLength?: number;
}): string {
  const raw = title.trim().replace(/\s+/g, ' ');
  if (raw.length <= maxLength) return raw;
  if (typeLabel?.trim() && raw.length > 70) return typeLabel.trim();
  const clipped = raw.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  return lastSpace > 24 ? clipped.slice(0, lastSpace) : clipped;
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
