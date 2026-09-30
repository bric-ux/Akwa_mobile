import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import {
  mergeNearbyHotelEstablishments,
  resolveHotelSearchCenter,
} from '../lib/hotelSearchProximity';

export type HotelRoomSearchResult = {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  cleaning_fee: number;
  taxes_per_night: number;
  max_guests: number;
  inventory_count: number;
  minimum_nights: number;
  images: string[];
  amenities: string[];
  available_units: number | null;
  establishment: {
    id: string;
    title: string;
    address: string | null;
    establishment_type: string;
    star_rating: number | null;
    rating: number;
    review_count: number;
    images: string[];
    latitude: number | null;
    longitude: number | null;
  };
};

export type ApprovedHotelRoomFilters = {
  city?: string;
  starRating?: number;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
};

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

async function mapAvailableUnits(
  roomIds: string[],
  checkIn: string,
  checkOut: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const chunkSize = 8;
  for (let i = 0; i < roomIds.length; i += chunkSize) {
    const chunk = roomIds.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (id) => {
        const { data, error } = await supabase.rpc('get_hotel_room_type_available_units', {
          p_room_type_id: id,
          p_check_in: checkIn,
          p_check_out: checkOut,
        });
        if (error) {
          console.warn('[hotel] available_units', id, error.message);
          return { id, units: 0 };
        }
        return { id, units: typeof data === 'number' ? data : Number(data) || 0 };
      }),
    );
    for (const r of results) map.set(r.id, r.units);
  }
  return map;
}

/** Catalogue public : types de chambres actifs (recherche / dispo). */
export const useApprovedHotelRooms = () => {
  const [rooms, setRooms] = useState<HotelRoomSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRooms = useCallback(
    async (filters?: ApprovedHotelRoomFilters): Promise<HotelRoomSearchResult[]> => {
      setLoading(true);
      setError(null);
      try {
        // 1) Établissements actifs (filtre ville / étoiles)
        let estQuery = supabase
          .from('hotel_establishments')
          .select(
            'id, title, address, establishment_type, star_rating, rating, review_count, images, location_id, latitude, longitude',
          )
          .eq('status', 'active')
          .eq('hidden_by_admin', false);

        if (filters?.starRating && filters.starRating > 0) {
          estQuery = estQuery.gte('star_rating', filters.starRating);
        }

        const city = filters?.city?.trim();
        const resolved = city
          ? await resolveHotelSearchCenter({
              city,
              centerLat: filters?.centerLat,
              centerLng: filters?.centerLng,
              radiusKm: filters?.radiusKm,
            })
          : null;

        if (city && resolved) {
          console.log('🔎 [hotel] début chambres', {
            city,
            center: { lat: resolved.centerLat, lng: resolved.centerLng },
            mergeRadius: resolved.mergeRadius,
          });
          if (resolved.locationIds && resolved.locationIds.length > 0) {
            const orParts = [
              `location_id.in.(${resolved.locationIds.join(',')})`,
              ...resolved.nameTerms.map((n) => `address.ilike.%${n}%`),
              ...resolved.nameTerms.map((n) => `title.ilike.%${n}%`),
            ];
            estQuery = estQuery.or(orParts.join(','));
          } else if (resolved.nameTerms.length > 0) {
            estQuery = estQuery.or(
              resolved.nameTerms
                .flatMap((n) => [`address.ilike.%${n}%`, `title.ilike.%${n}%`])
                .join(','),
            );
          } else {
            estQuery = estQuery.or(`address.ilike.%${city}%,title.ilike.%${city}%`);
          }
        }

        const { data: estRows, error: estErr } = await estQuery.limit(60);
        if (estErr) {
          setError(estErr.message);
          setRooms([]);
          return [];
        }

        let establishments = estRows || [];
        if (city && resolved?.centerLat != null && resolved.centerLng != null) {
          establishments = await mergeNearbyHotelEstablishments(
            establishments as any[],
            async (bbox) => {
              let nearbyQuery = supabase
                .from('hotel_establishments')
                .select(
                  'id, title, address, establishment_type, star_rating, rating, review_count, images, location_id, latitude, longitude',
                )
                .eq('status', 'active')
                .eq('hidden_by_admin', false)
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .gte('latitude', bbox.latMin)
                .lte('latitude', bbox.latMax)
                .gte('longitude', bbox.lngMin)
                .lte('longitude', bbox.lngMax)
                .limit(150);
              if (filters?.starRating && filters.starRating > 0) {
                nearbyQuery = nearbyQuery.gte('star_rating', filters.starRating);
              }
              const { data: nearby, error: nErr } = await nearbyQuery;
              if (nErr) throw nErr;
              return (nearby || []) as any[];
            },
            resolved.centerLat,
            resolved.centerLng,
            resolved.mergeRadius,
          );
        }

        if (!establishments?.length) {
          setRooms([]);
          return [];
        }

        const estById = Object.fromEntries(establishments.map((e) => [e.id, e]));
        const estIds = establishments.map((e) => e.id);

        // 2) Types de chambres actifs
        let roomQuery = supabase
          .from('hotel_room_types')
          .select(
            'id, establishment_id, name, description, price_per_night, cleaning_fee, taxes_per_night, max_guests, inventory_count, minimum_nights, images, amenities',
          )
          .eq('status', 'active')
          .in('establishment_id', estIds)
          .order('price_per_night', { ascending: true });

        if (filters?.guests && filters.guests > 0) {
          roomQuery = roomQuery.gte('max_guests', filters.guests);
        }

        const { data: roomRows, error: roomErr } = await roomQuery.limit(120);
        if (roomErr) {
          setError(roomErr.message);
          setRooms([]);
          return [];
        }

        const checkIn = filters?.checkIn?.trim();
        const checkOut = filters?.checkOut?.trim();
        const stayNights =
          checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
        const hasDates = stayNights > 0;

        let unitsMap = new Map<string, number>();
        if (hasDates && roomRows?.length) {
          unitsMap = await mapAvailableUnits(
            roomRows.map((r) => r.id),
            checkIn!,
            checkOut!,
          );
        }

        const mapped: HotelRoomSearchResult[] = [];
        for (const row of roomRows || []) {
          const est = estById[row.establishment_id];
          if (!est) continue;

          const minNights = row.minimum_nights || 1;
          if (hasDates && stayNights < minNights) continue;

          const available = hasDates ? (unitsMap.get(row.id) ?? 0) : null;
          if (hasDates && (available ?? 0) < 1) continue;

          mapped.push({
            id: row.id,
            name: row.name,
            description: row.description,
            price_per_night: row.price_per_night,
            cleaning_fee: row.cleaning_fee || 0,
            taxes_per_night: row.taxes_per_night || 0,
            max_guests: row.max_guests,
            inventory_count: row.inventory_count,
            minimum_nights: minNights,
            images: Array.isArray(row.images) ? row.images : [],
            amenities: Array.isArray(row.amenities) ? row.amenities : [],
            available_units: available,
            establishment: {
              id: est.id,
              title: est.title,
              address: est.address,
              establishment_type: est.establishment_type,
              star_rating: est.star_rating,
              rating: Number(est.rating) || 0,
              review_count: Number(est.review_count) || 0,
              images: Array.isArray(est.images) ? est.images : [],
              latitude: est.latitude != null ? Number(est.latitude) : null,
              longitude: est.longitude != null ? Number(est.longitude) : null,
            },
          });
        }

        setRooms(mapped);
        return mapped;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        setRooms([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { rooms, loading, error, fetchRooms };
};

/** Vérifie la dispo avant insertion de réservation. */
export async function checkHotelRoomAvailability(params: {
  establishmentId: string;
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  quantity?: number;
}): Promise<{ ok: boolean; availableUnits: number; error?: string }> {
  const quantity = params.quantity ?? 1;
  const { data: units, error: uErr } = await supabase.rpc('get_hotel_room_type_available_units', {
    p_room_type_id: params.roomTypeId,
    p_check_in: params.checkIn,
    p_check_out: params.checkOut,
  });
  if (uErr) return { ok: false, availableUnits: 0, error: uErr.message };
  const availableUnits = typeof units === 'number' ? units : Number(units) || 0;

  const { data: ok, error: cErr } = await supabase.rpc('check_hotel_booking_availability', {
    p_establishment_id: params.establishmentId,
    p_check_in: params.checkIn,
    p_check_out: params.checkOut,
    p_items: [{ room_type_id: params.roomTypeId, quantity }],
  });
  if (cErr) return { ok: false, availableUnits, error: cErr.message };
  return { ok: ok === true && availableUnits >= quantity, availableUnits };
}

/** Galerie : photos chambre d’abord, puis établissement / table photos. */
export function buildHotelGallery(params: {
  roomImages?: string[] | null;
  establishmentImages?: string[] | null;
  establishmentPhotos?: Array<{ url: string }> | null;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (url?: string | null) => {
    const u = url?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  for (const u of params.roomImages || []) push(u);
  for (const p of params.establishmentPhotos || []) push(p.url);
  for (const u of params.establishmentImages || []) push(u);
  return out;
}
