import type { HotelEstablishmentType } from '../types';

export const HOTEL_ESTABLISHMENT_TYPES: { value: HotelEstablishmentType; label: string; icon: string }[] = [
  { value: 'hotel', label: 'Hôtel', icon: '🏨' },
  { value: 'guesthouse', label: "Maison d'hôtes", icon: '🛎️' },
  { value: 'residence', label: 'Résidence', icon: '🏢' },
  { value: 'aparthotel', label: "Appart'hôtel", icon: '🏙️' },
];

export const HOTEL_WIZARD_STEPS = [
  'Type',
  'Localisation',
  'Présentation',
  'Politiques',
  'Équipements',
  'Photos',
  'Chambres',
] as const;

export const HOTEL_CANCELLATION_POLICIES = [
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'Remboursement intégral jusqu\'à 24 h avant l\'arrivée',
  },
  {
    value: 'moderate',
    label: 'Modérée',
    description: 'Remboursement intégral jusqu\'à 5 jours avant',
  },
  {
    value: 'strict',
    label: 'Stricte',
    description: 'Remboursement 50 % jusqu\'à 7 jours avant',
  },
  {
    value: 'non_refundable',
    label: 'Non remboursable',
    description: 'Aucun remboursement en cas d\'annulation',
  },
] as const;

export type HotelCancellationPolicy = (typeof HOTEL_CANCELLATION_POLICIES)[number]['value'];

export const HOTEL_ESTABLISHMENT_AMENITIES = [
  'Wi-Fi',
  'Parking',
  'Piscine',
  'Climatisation',
  'Petit-déjeuner',
  'Restaurant',
  'Bar',
  'Spa',
  'Salle de sport',
  'Ascenseur',
  'Service de chambre',
  'Accès handicapé',
  'Navette aéroport',
  'Salle de réunion',
  'Jardin',
  'Terrasse',
  'Réception 24h/24',
  'Coffre-fort',
  'Blanchisserie',
];

export const HOTEL_ROOM_AMENITIES = [
  'Wi-Fi',
  'Climatisation',
  'Télévision',
  'Minibar',
  'Coffre-fort',
  'Bureau',
  'Balcon',
  'Vue mer',
  'Baignoire',
  'Douche à l\'italienne',
  'Peignoirs',
  'Chauffe-eau',
  'Kitchenette',
  'Linge fourni',
  'Room service',
];

export const HOTEL_ROOM_CATEGORIES = [
  { value: 'standard', label: 'Standard' },
  { value: 'double', label: 'Double' },
  { value: 'twin', label: 'Twin' },
  { value: 'deluxe', label: 'Deluxe' },
  { value: 'suite', label: 'Suite' },
  { value: 'family', label: 'Familiale' },
  { value: 'studio', label: 'Studio' },
  { value: 'executive', label: 'Executive' },
  { value: 'other', label: 'Autre' },
] as const;

export type HotelRoomCategory = (typeof HOTEL_ROOM_CATEGORIES)[number]['value'];

export function getRoomCategoryLabel(value?: string | null): string {
  return HOTEL_ROOM_CATEGORIES.find((c) => c.value === value)?.label ?? value ?? '';
}
