import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'akwahome_recent_destination_searches';
const MAX_RECENT = 8;

const DEFAULT_SEED = ['Abidjan', 'Yamoussoukro', 'Grand-Bassam', 'San-Pédro'];

/** Charge l’historique local (Android / iOS). Seed si vide. */
export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_SEED];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SEED];
    const cleaned = parsed
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim());
    return cleaned.length > 0 ? cleaned.slice(0, MAX_RECENT) : [...DEFAULT_SEED];
  } catch {
    return [...DEFAULT_SEED];
  }
}

async function persist(list: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // ignore storage errors
  }
}

/** Ajoute / remonte une recherche en tête, puis persiste. */
export async function pushRecentSearch(query: string): Promise<string[]> {
  const term = query.trim();
  if (!term) return loadRecentSearches();

  const current = await loadRecentSearches();
  const without = current.filter((s) => s.toLowerCase() !== term.toLowerCase());
  const next = [term, ...without].slice(0, MAX_RECENT);
  await persist(next);
  return next;
}

export async function removeRecentSearch(query: string): Promise<string[]> {
  const term = query.trim().toLowerCase();
  const current = await loadRecentSearches();
  const next = current.filter((s) => s.toLowerCase() !== term);
  await persist(next.length > 0 ? next : [...DEFAULT_SEED]);
  return next.length > 0 ? next : [...DEFAULT_SEED];
}
