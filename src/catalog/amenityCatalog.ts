/**
 * Catalogue équipements logement : slug stable ↔ libellé FR historique.
 * L’affichage passe par t(`amenity.${slug}`) ; le FR sert à migrer / résoudre le legacy.
 */

export type AmenityDef = {
  slug: string;
  /** Nom historique en base (property_amenities.name / properties.amenities[]) */
  fr: string;
};

/** Liste canonique (slugs) — garder synchro avec la migration SQL. */
export const PROPERTY_AMENITY_CATALOG: AmenityDef[] = [
  { slug: 'wifi', fr: 'WiFi gratuit' },
  { slug: 'ac', fr: 'Climatisation' },
  { slug: 'heating', fr: 'Chauffage' },
  { slug: 'fan', fr: 'Ventilateur' },
  { slug: 'kitchenette', fr: 'Coin cuisine' },
  { slug: 'equipped_kitchen', fr: 'Cuisine équipée' },
  { slug: 'microwave', fr: 'Micro-ondes' },
  { slug: 'fridge', fr: 'Réfrigérateur' },
  { slug: 'freezer', fr: 'Congélateur' },
  { slug: 'dishwasher', fr: 'Lave-vaisselle' },
  { slug: 'stove', fr: 'Cuisinière' },
  { slug: 'oven', fr: 'Four' },
  { slug: 'coffee_maker', fr: 'Cafetière' },
  { slug: 'kettle', fr: 'Bouilloire' },
  { slug: 'toaster', fr: 'Grille-pain' },
  { slug: 'kitchen_utensils', fr: 'Ustensiles de cuisine' },
  { slug: 'dishes_cutlery', fr: 'Vaisselle et couverts' },
  { slug: 'washer', fr: 'Machine à laver' },
  { slug: 'dryer', fr: 'Sèche-linge' },
  { slug: 'iron', fr: 'Fer à repasser' },
  { slug: 'free_parking', fr: 'Parking gratuit' },
  { slug: 'garage', fr: 'Garage' },
  { slug: 'pool', fr: 'Piscine' },
  { slug: 'jacuzzi', fr: 'Jacuzzi' },
  { slug: 'sauna', fr: 'Sauna' },
  { slug: 'garden', fr: 'Jardin' },
  { slug: 'balcony', fr: 'Balcon' },
  { slug: 'balcony_terrace', fr: 'Balcon/Terrasse' },
  { slug: 'terrace', fr: 'Terrasse' },
  { slug: 'flat_tv', fr: 'TV écran plat' },
  { slug: 'tv', fr: 'Télévision' },
  { slug: 'cable_satellite', fr: 'Câble/Satellite' },
  { slug: 'netflix', fr: 'Netflix' },
  { slug: 'video_games', fr: 'Jeux vidéo' },
  { slug: 'books', fr: 'Livres' },
  { slug: 'music', fr: 'Musique' },
  { slug: 'gym', fr: 'Salle de sport' },
  { slug: 'fitness', fr: 'Équipement fitness' },
  { slug: 'yoga', fr: 'Yoga' },
  { slug: 'beach_access', fr: 'Accès plage' },
  { slug: 'sea_view', fr: 'Vue sur mer' },
  { slug: 'city_center', fr: 'Centre-ville' },
  { slug: 'public_transport', fr: 'Transport public' },
  { slug: 'cleaning_service', fr: 'Service de ménage' },
  { slug: 'breakfast', fr: 'Petit-déjeuner inclus' },
  { slug: 'concierge', fr: 'Concierge' },
  { slug: 'airport_transfer', fr: 'Transfer aéroport' },
  { slug: 'reception_24h', fr: 'Réception 24h/24' },
  { slug: 'room_service', fr: 'Room service' },
  { slug: 'pets_allowed', fr: 'Animaux acceptés' },
  { slug: 'non_smoking', fr: 'Non-fumeur' },
  { slug: 'smoking_allowed', fr: 'Fumeur autorisé' },
  { slug: 'safe', fr: 'Coffre-fort' },
  { slug: 'security_system', fr: 'Système de sécurité' },
  { slug: 'cameras', fr: 'Caméras de surveillance' },
  { slug: 'intercom', fr: 'Interphone' },
  { slug: 'linens', fr: 'Linge de maison fourni' },
  { slug: 'sheets', fr: 'drap' },
  { slug: 'towels', fr: 'Serviettes' },
  { slug: 'toiletries', fr: 'Produits de toilette' },
  { slug: 'elevator', fr: 'Ascenseur' },
  { slug: 'stairs', fr: 'Escalier' },
  { slug: 'accessible', fr: 'Accès handicapés' },
  { slug: 'central_heating', fr: 'Chauffage central' },
  { slug: 'hot_water', fr: 'Eau chaude' },
  { slug: 'storage', fr: 'Espace de rangement' },
  { slug: 'wardrobe', fr: 'Armoire' },
];

const bySlug = new Map(PROPERTY_AMENITY_CATALOG.map((a) => [a.slug, a]));
const byFrLower = new Map(
  PROPERTY_AMENITY_CATALOG.map((a) => [a.fr.toLowerCase(), a]),
);

/** Alias FR → slug (renommages historiques). */
const FR_ALIASES: Record<string, string> = {
  'cuisine équipée': 'kitchenette',
  'linge de maison fourni': 'sheets',
};

export function amenitySlugFromValue(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (bySlug.has(v)) return v;
  const fromFr = byFrLower.get(v.toLowerCase());
  if (fromFr) return fromFr.slug;
  const alias = FR_ALIASES[v.toLowerCase()];
  if (alias) return alias;
  return null;
}

export type TranslateFn = (key: string, params?: Record<string, string>) => string;

/** Libellé localisé ; fallback = texte stocké (custom amenity). */
export function amenityLabel(value: string | null | undefined, t: TranslateFn): string {
  if (!value?.trim()) return '';
  const slug = amenitySlugFromValue(value);
  if (slug) {
    const key = `amenity.${slug}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    return bySlug.get(slug)?.fr ?? value;
  }
  return value.trim();
}

export function amenityLabels(
  values: Array<string | { name?: string; id?: string }> | null | undefined,
  t: TranslateFn,
): string[] {
  if (!values?.length) return [];
  return values.map((v) => {
    if (typeof v === 'string') return amenityLabel(v, t);
    return amenityLabel(v.name ?? v.id ?? '', t);
  });
}
