import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { HotelEstablishment } from '../types';
import { getActiveRoomTypes, getMinRoomPrice } from '../lib/hotelUtils';
import { logError } from '../utils/logger';
import { LOCATION_WITH_PARENT_SELECT } from '../utils/locationLabel';
import { getCachedHotels, setCachedHotels } from '../services/searchCatalogCache';
import {
  loadPersistedExploreHomeHotels,
  persistExploreHomeHotels,
  getExploreHotelsMemoryCache,
  setExploreHotelsMemoryCache,
} from '../utils/exploreHomeStorage';
import { prefetchHotelShelfCovers } from '../utils/prefetchExploreShelfCovers';

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
  locations:location_id(${LOCATION_WITH_PARENT_SELECT}),
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

function applyHotels(
  enriched: HotelEstablishment[],
  setHotels: (hotels: HotelEstablishment[]) => void,
) {
  setHotels(enriched);
  setExploreHotelsMemoryCache(enriched);
  persistExploreHomeHotels(enriched);
  setCachedHotels(enriched);
  prefetchHotelShelfCovers(enriched);
}

export function useExploreHotelsHome() {
  const [hotels, setHotels] = useState<HotelEstablishment[]>(
    () => getExploreHotelsMemoryCache() ?? getCachedHotels() ?? [],
  );
  const [loading, setLoading] = useState(() => hotels.length === 0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    try {
      if (!background) {
        setLoading(true);
      }
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

      applyHotels(enriched, setHotels);
    } catch (e) {
      logError('[useExploreHotelsHome] load', e);
      setError('Impossible de charger les hôtels');
      if (!background) {
        setHotels([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const memoryHotels = getExploreHotelsMemoryCache();
      if (memoryHotels && memoryHotels.length > 0) {
        setHotels(memoryHotels);
        prefetchHotelShelfCovers(memoryHotels);
        setLoading(false);
        void load({ background: true });
        return;
      }

      const persisted = await loadPersistedExploreHomeHotels();
      if (!cancelled && persisted && persisted.length > 0) {
        setHotels(persisted);
        prefetchHotelShelfCovers(persisted);
        setLoading(false);
      }

      if (!cancelled) {
        await load({ background: !!(persisted && persisted.length > 0) });
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return {
    hotels,
    loading,
    error,
    refreshExploreHotelsHome: load,
  };
}
