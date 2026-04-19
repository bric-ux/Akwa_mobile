/** Types et listes alignés sur BecomeHostScreen + assistant Smart */

export const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
  { value: 'guesthouse', label: 'Maison d\'hôtes' },
  { value: 'eco_lodge', label: 'Éco-lodge' },
] as const;

export type HostListingPropertyType = (typeof PROPERTY_TYPES)[number]['value'];

export const ASSISTANT_GUEST_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '14', '16'] as const;

export const ASSISTANT_BEDROOM_OPTIONS = ['1', '2', '3', '4', '5', '6', '8'] as const;

export const ASSISTANT_BATHROOM_OPTIONS = ['1', '2', '3', '4', '5'] as const;
