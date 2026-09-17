const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  studio: 'Studio',
  guesthouse: "Maison d'hôtes",
  eco_lodge: 'Éco-lodge',
  other: 'Autre',
};

export function getPropertyTypeLabel(type?: string | null): string {
  if (!type) return 'Logement';
  return (
    PROPERTY_TYPE_LABELS[type] ??
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
