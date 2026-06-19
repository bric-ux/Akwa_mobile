import { useCallback, useState } from 'react';
import { supabase } from '../services/supabase';
import type { HotelEstablishment, HotelFilters } from '../types';
import { getActiveRoomTypes, getMinRoomPrice } from '../lib/hotelUtils';
import { getCachedHotels, setCachedHotels } from '../services/searchCatalogCache';

const ESTABLISHMENT_SELECT = `
  id,
  host_id,
  title,
  slug,
  description,
  establishment_type,
  location_id,
  address,
  latitude,
  longitude,
  star_rating,
  amenities,
  images,
  check_in_time,
  check_out_time,
  cancellation_policy,
  house_rules,
  rating,
  review_count,
  status,
  created_at,
  locations:location_id(id, name, type, latitude, longitude),
  hotel_establishment_photos(id, url, category, display_order),
  hotel_room_types(
    id,
    establishment_id,
    name,
    room_category,
    description,
    max_guests,
    bedrooms,
    bathrooms,
    price_per_night,
    cleaning_fee,
    taxes_per_night,
    inventory_count,
    minimum_nights,
    amenities,
    images,
    sort_order,
    status,
    discount_enabled,
    discount_min_nights,
    discount_percentage,
    long_stay_discount_enabled,
    long_stay_discount_min_nights,
    long_stay_discount_percentage
  )
`;

function enrichEstablishment(row: HotelEstablishment): HotelEstablishment {
  const activeRooms = getActiveRoomTypes(row.hotel_room_types);
  return {
    ...row,
    hotel_room_types: activeRooms,
    min_price_per_night: getMinRoomPrice({ ...row, hotel_room_types: activeRooms }),
  };
}

function matchesFilters(establishment: HotelEstablishment, filters?: HotelFilters): boolean {
  if (!filters) return true;

  if (filters.establishmentType && establishment.establishment_type !== filters.establishmentType) {
    return false;
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    const location = establishment.locations?.name?.toLowerCase() ?? '';
    const address = establishment.address?.toLowerCase() ?? '';
    const title = establishment.title.toLowerCase();
    if (!title.includes(q) && !location.includes(q) && !address.includes(q)) {
      return false;
    }
  }

  const minPrice = establishment.min_price_per_night;
  if (filters.priceMin != null && minPrice != null && minPrice < filters.priceMin) {
    return false;
  }
  if (filters.priceMax != null && minPrice != null && minPrice > filters.priceMax) {
    return false;
  }

  if (filters.guests != null && filters.guests > 0) {
    const fits = (establishment.hotel_room_types ?? []).some(
      (rt) => rt.max_guests >= filters.guests!,
    );
    if (!fits) return false;
  }

  if (filters.starRatingMin != null && filters.starRatingMin > 0) {
    const stars = establishment.star_rating ?? 0;
    if (stars < filters.starRatingMin) return false;
  }

  return (establishment.hotel_room_types?.length ?? 0) > 0;
}

export function useHotels() {
  const [establishments, setEstablishments] = useState<HotelEstablishment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<HotelFilters | undefined>(undefined);

  const fetchEstablishments = useCallback(async (filters?: HotelFilters) => {
    if (filters !== undefined) {
      setLastFilters(filters);
    }
    try {
      const cachedAll = getCachedHotels();
      if (cachedAll) {
        const filtered = cachedAll.filter((e) => matchesFilters(e, filters));
        setEstablishments(filtered);
        setLoading(false);
        return filtered;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('hotel_establishments')
        .select(ESTABLISHMENT_SELECT)
        .eq('status', 'active')
        .eq('hidden_by_admin', false)
        .eq('hide_from_home', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const enriched = (data ?? [])
        .map((row) => enrichEstablishment(row as HotelEstablishment));

      setCachedHotels(enriched);

      const filtered = enriched.filter((e) => matchesFilters(e, filters));
      setEstablishments(filtered);
      return filtered;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les hôtels';
      setError(message);
      setEstablishments([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    return fetchEstablishments(lastFilters);
  }, [fetchEstablishments, lastFilters]);

  const getEstablishmentById = useCallback(async (id: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('hotel_establishments')
        .select(ESTABLISHMENT_SELECT)
        .eq('id', id)
        .eq('status', 'active')
        .eq('hidden_by_admin', false)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) return null;
      return enrichEstablishment(data as HotelEstablishment);
    } catch (err: unknown) {
      console.error('[useHotels] getEstablishmentById', err);
      return null;
    }
  }, []);

  return {
    establishments,
    loading,
    error,
    fetchEstablishments,
    refetch,
    getEstablishmentById,
  };
}
