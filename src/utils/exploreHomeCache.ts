import type { LayoutSection } from './exploreCityLayout';
import type { Property } from '../types';

export const EXPLORE_HOME_CACHE_TTL_MS = 2 * 60 * 1000;

let exploreHomeCache: {
  sections: LayoutSection<Property>[];
  at: number;
} | null = null;

export function getExploreHomeCache() {
  return exploreHomeCache;
}

export function setExploreHomeCache(sections: LayoutSection<Property>[]) {
  exploreHomeCache = { sections, at: Date.now() };
}

export function invalidateExploreHomeCache() {
  exploreHomeCache = null;
}
