/** Équipements / mobilier proposés quand le logement est meublé (bail longue durée). */
export const MONTHLY_FURNITURE_OPTIONS = [
  { id: 'lit', label: 'Lit(s)' },
  { id: 'canape', label: 'Canapé' },
  { id: 'table_chaises', label: 'Table & chaises' },
  { id: 'armoire', label: 'Armoire / rangements' },
  { id: 'cuisine_equipee', label: 'Cuisine équipée' },
  { id: 'frigo', label: 'Réfrigérateur' },
  { id: 'cuisiniere', label: 'Cuisinière / plaques' },
  { id: 'micro_ondes', label: 'Micro-ondes' },
  { id: 'lave_linge', label: 'Machine à laver' },
  { id: 'clim', label: 'Climatisation' },
  { id: 'ventilateur', label: 'Ventilateur' },
  { id: 'tv', label: 'Télévision' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'eau_chaude', label: 'Eau chaude' },
  { id: 'balcon', label: 'Balcon / terrasse' },
] as const;

export type MonthlyFurnitureId = (typeof MONTHLY_FURNITURE_OPTIONS)[number]['id'];

export function monthlyFurnitureLabel(id: string): string {
  return MONTHLY_FURNITURE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}
