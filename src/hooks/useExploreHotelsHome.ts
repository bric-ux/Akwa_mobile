import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { HotelEstablishment } from '../types';
import { getActiveRoomTypes, getMinRoomPrice } from '../lib/hotelUtils';
import { logError } from '../utils/logger';

const EXPLORE_HOTELS_LIMIT = 12;

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
    status
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

export function useExploreHotelsHome() {
  const [hotels, setHotels] = useState<HotelEstablishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('hotel_establishments')
        .select(ESTABLISHMENT_SELECT)
        .eq('status', 'active')
        .eq('hidden_by_admin', false)
        .eq('hide_from_home', false)
        .order('created_at', { ascending: false })
        .limit(EXPLORE_HOTELS_LIMIT * 2);

      if (fetchError) throw fetchError;

      const enriched = (data ?? [])
        .map((row) => enrichEstablishment(row as HotelEstablishment))
        .filter((e) => (e.hotel_room_types?.length ?? 0) > 0)
        .slice(0, EXPLORE_HOTELS_LIMIT);

      setHotels(enriched);
    } catch (e) {
      logError('[useExploreHotelsHome] load', e);
      setError('Impossible de charger les hôtels');
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    hotels,
    loading,
    error,
    refreshExploreHotelsHome: load,
  };
}
