/** Équipements / services hôtel (établissement). */
export const HOTEL_AMENITY_OPTIONS = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'parking', label: 'Parking' },
  { value: 'climatisation', label: 'Climatisation' },
  { value: 'petit_dejeuner', label: 'Petit-déjeuner' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'piscine', label: 'Piscine' },
  { value: 'salle_sport', label: 'Salle de sport' },
  { value: 'reception_24h', label: 'Réception 24h/24' },
  { value: 'ascenseur', label: 'Ascenseur' },
  { value: 'laverie', label: 'Laverie' },
  { value: 'room_service', label: 'Room service' },
  { value: 'bar', label: 'Bar' },
  { value: 'jardin', label: 'Jardin / terrasse' },
  { value: 'securite', label: 'Sécurité / gardien' },
  { value: 'generateur', label: 'Groupe électrogène' },
] as const;

export const HOTEL_LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
  { value: 'nouchi', label: 'Nouchi' },
  { value: 'dioula', label: 'Dioula' },
  { value: 'baoule', label: 'Baoulé' },
  { value: 'bete', label: 'Bété' },
  { value: 'es', label: 'Espagnol' },
  { value: 'pt', label: 'Portugais' },
  { value: 'ar', label: 'Arabe' },
  { value: 'zh', label: 'Chinois' },
] as const;

export const HOTEL_ROOM_CATEGORIES = [
  { value: 'standard', label: 'Standard', defaultName: 'Chambre Standard', guests: '2' },
  { value: 'double', label: 'Double', defaultName: 'Chambre Double', guests: '2' },
  { value: 'twin', label: 'Twin', defaultName: 'Chambre Twin', guests: '2' },
  { value: 'deluxe', label: 'Deluxe', defaultName: 'Chambre Deluxe', guests: '2' },
  { value: 'suite', label: 'Suite', defaultName: 'Suite', guests: '3' },
  { value: 'family', label: 'Familiale', defaultName: 'Chambre Familiale', guests: '4' },
  { value: 'studio', label: 'Studio', defaultName: 'Studio', guests: '2' },
  { value: 'executive', label: 'Executive', defaultName: 'Chambre Executive', guests: '2' },
  { value: 'other', label: 'Autre', defaultName: '', guests: '2' },
] as const;

export const HOTEL_CANCELLATION_OPTIONS = [
  {
    value: 'flexible',
    label: 'Flexible',
    hint: 'Annulation gratuite jusqu’à 24h avant l’arrivée',
  },
  {
    value: 'moderate',
    label: 'Modérée',
    hint: 'Annulation gratuite jusqu’à 5 jours avant',
  },
  {
    value: 'strict',
    label: 'Stricte',
    hint: '50 % remboursés jusqu’à 7 jours avant',
  },
] as const;

export function hotelAmenityLabel(value: string): string {
  return HOTEL_AMENITY_OPTIONS.find((a) => a.value === value)?.label || value;
}

export function hotelLanguageLabel(value: string): string {
  return HOTEL_LANGUAGE_OPTIONS.find((l) => l.value === value)?.label || value;
}

export function hotelCancellationLabel(value: string | null | undefined): string {
  if (!value) return '';
  const opt = HOTEL_CANCELLATION_OPTIONS.find((c) => c.value === value);
  return opt ? `${opt.label} — ${opt.hint}` : value;
}

/** Affiche une heure Postgres `time` / `HH:MM:SS` en `HH:MM`. */
export function formatHotelTime(value: string | null | undefined): string {
  if (!value) return '';
  const m = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(value);
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}
