type TranslateFn = (key: string, params?: Record<string, string>) => string;

const PROPERTY_TYPE_KEYS: Record<string, string> = {
  apartment: 'property.typeApartment',
  house: 'property.typeHouse',
  villa: 'property.typeVilla',
  studio: 'property.typeStudio',
  guesthouse: 'property.typeGuesthouse',
  eco_lodge: 'property.typeEcoLodge',
  other: 'property.typeOther',
};

export function getPropertyTypeLabel(type: string | null | undefined, t: TranslateFn): string {
  if (!type) return t('property.typeFallback');
  const key = PROPERTY_TYPE_KEYS[type];
  if (key) return t(key);
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
