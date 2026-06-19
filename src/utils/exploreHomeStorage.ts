import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HotelEstablishment, Property } from '../types';
import type { LayoutSection } from './exploreCityLayout';

const HOME_SECTIONS_KEY = 'explore_home_sections_v1';
const HOME_HOTELS_KEY = 'explore_home_hotels_v1';
const PERSIST_TTL_MS = 15 * 60 * 1000;
export const EXPLORE_HOTELS_MEMORY_TTL_MS = 2 * 60 * 1000;

let exploreHotelsMemoryCache: {
  hotels: HotelEstablishment[];
  at: number;
} | null = null;

type Persisted<T> = {
  at: number;
  data: T;
};

async function readPersisted<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted<T>;
    if (Date.now() - parsed.at > PERSIST_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function writePersisted<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), data } satisfies Persisted<T>),
    );
  } catch {
    // ignore quota / serialization errors
  }
}

export function loadPersistedExploreHomeSections(): Promise<LayoutSection<Property>[] | null> {
  return readPersisted<LayoutSection<Property>[]>(HOME_SECTIONS_KEY);
}

export function persistExploreHomeSections(sections: LayoutSection<Property>[]): void {
  void writePersisted(HOME_SECTIONS_KEY, sections);
}

export function loadPersistedExploreHomeHotels(): Promise<HotelEstablishment[] | null> {
  return readPersisted<HotelEstablishment[]>(HOME_HOTELS_KEY);
}

export function persistExploreHomeHotels(hotels: HotelEstablishment[]): void {
  void writePersisted(HOME_HOTELS_KEY, hotels);
}

export function getExploreHotelsMemoryCache(): HotelEstablishment[] | null {
  if (!exploreHotelsMemoryCache) return null;
  if (Date.now() - exploreHotelsMemoryCache.at > EXPLORE_HOTELS_MEMORY_TTL_MS) {
    exploreHotelsMemoryCache = null;
    return null;
  }
  return exploreHotelsMemoryCache.hotels;
}

export function setExploreHotelsMemoryCache(hotels: HotelEstablishment[]): void {
  exploreHotelsMemoryCache = { hotels, at: Date.now() };
}

export function invalidateExploreHotelsMemoryCache(): void {
  exploreHotelsMemoryCache = null;
}
