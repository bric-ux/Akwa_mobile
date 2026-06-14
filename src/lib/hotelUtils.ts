import type { HotelEstablishment, HotelEstablishmentPhoto, HotelRoomType } from '../types';

const ESTABLISHMENT_TYPE_LABELS: Record<string, string> = {
  hotel: 'Hôtel',
  guesthouse: "Maison d'hôtes",
  residence: 'Résidence',
  aparthotel: "Appart'hôtel",
};

export function getEstablishmentTypeLabel(type?: string | null): string {
  if (!type) return 'Hébergement';
  return ESTABLISHMENT_TYPE_LABELS[type] ?? type;
}

export function getHotelCoverUrl(establishment: HotelEstablishment): string {
  const photos = establishment.hotel_establishment_photos ?? [];
  const sorted = [...photos].sort(
    (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999),
  );
  if (sorted[0]?.url) return sorted[0].url;

  const legacy = establishment.images ?? [];
  if (legacy.length > 0 && typeof legacy[0] === 'string') return legacy[0];

  return 'https://via.placeholder.com/400x280?text=Hotel';
}

export function getHotelGalleryUrls(establishment: HotelEstablishment): string[] {
  const fromPhotos = (establishment.hotel_establishment_photos ?? [])
    .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
    .map((p) => p.url)
    .filter(Boolean);

  const legacy = (establishment.images ?? []).filter(
    (url) => typeof url === 'string' && url.length > 0,
  );

  const merged = [...fromPhotos, ...legacy];
  return merged.length > 0 ? [...new Set(merged)] : [getHotelCoverUrl(establishment)];
}

export function getActiveRoomTypes(roomTypes?: HotelRoomType[] | null): HotelRoomType[] {
  return (roomTypes ?? []).filter((rt) => rt.status === 'active');
}

export function getMinRoomPrice(establishment: HotelEstablishment): number | null {
  const active = getActiveRoomTypes(establishment.hotel_room_types);
  if (active.length === 0) return null;
  return Math.min(...active.map((rt) => rt.price_per_night));
}

export function getEstablishmentLocationLabel(establishment: HotelEstablishment): string {
  if (establishment.locations?.name) return establishment.locations.name;
  if (establishment.address) return establishment.address;
  return '';
}
