import { Dimensions } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;

/** Largeur carte portrait sur l'accueil (carrousels horizontaux). */
export const EXPLORE_SHELF_CARD_WIDTH = Math.round(
  Math.max(198, Math.min(SCREEN_W * 0.56, 232)),
);

/** Ratio 3:4 portrait — format cartes accueil. */
export const EXPLORE_SHELF_IMAGE_HEIGHT = Math.round(EXPLORE_SHELF_CARD_WIDTH * (4 / 3));

export const EXPLORE_SHELF_IMAGE_RADIUS = 26;
