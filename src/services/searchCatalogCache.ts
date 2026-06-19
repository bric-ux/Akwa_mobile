import type { Property, HotelEstablishment, MonthlyRentalListing } from '../types';

const TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { data: T; at: number };

function isFresh<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
  return entry != null && Date.now() - entry.at < TTL_MS;
}

const propertiesCache = new Map<string, CacheEntry<Property[]>>();
let hotelsCache: CacheEntry<HotelEstablishment[]> | null = null;
const monthlyCache = new Map<string, CacheEntry<MonthlyRentalListing[]>>();

function normalizeFilters(filters?: object | null): Record<string, unknown> {
  if (filters == null || typeof filters !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

export function propertyCatalogKey(source: string, filters?: object): string {
  return JSON.stringify({ source, filters: normalizeFilters(filters) });
}

export function getCachedProperties(key: string): Property[] | null {
  const entry = propertiesCache.get(key);
  return isFresh(entry) ? entry.data : null;
}

export function setCachedProperties(key: string, data: Property[]): void {
  propertiesCache.set(key, { data, at: Date.now() });
}

export function getCachedHotels(): HotelEstablishment[] | null {
  return isFresh(hotelsCache) ? hotelsCache.data : null;
}

export function setCachedHotels(data: HotelEstablishment[]): void {
  hotelsCache = { data, at: Date.now() };
}

export function monthlyCatalogKey(filters?: object): string {
  return JSON.stringify(normalizeFilters(filters));
}

export function getCachedMonthly(key: string): MonthlyRentalListing[] | null {
  const entry = monthlyCache.get(key);
  return isFresh(entry) ? entry.data : null;
}

export function setCachedMonthly(key: string, data: MonthlyRentalListing[]): void {
  monthlyCache.set(key, { data, at: Date.now() });
}
