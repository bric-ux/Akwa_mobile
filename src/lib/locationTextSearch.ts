/**
 * Recherche lieux multi-mots : « cocody angré » doit matcher
 * un quartier « Angré » sous Cocody (pas seulement name ILIKE '%cocody angré%').
 */

const STOP_WORDS = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'a',
  'à',
  'au',
  'aux',
  'en',
  'et',
  'sur',
  'pres',
  'près',
  'ci',
]);

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens significatifs (≥ 2 car.), stopwords exclus. */
export function tokenizeSearchQuery(query: string): string[] {
  const norm = normalizeSearchText(query);
  if (!norm) return [];
  return norm
    .split(/[\s,/|-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/** Filtre PostgREST OR : name.ilike.%tok1%,name.ilike.%tok2%… */
export function buildNameIlikeOrFilter(tokens: string[]): string | null {
  if (!tokens.length) return null;
  return tokens.map((t) => `name.ilike.%${t}%`).join(',');
}

export function haystackMatchesAllTokens(haystack: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const h = normalizeSearchText(haystack).replace(/[-\s]/g, ' ');
  return tokens.every((tok) => {
    const t = tok.replace(/-/g, ' ');
    return h.includes(t) || h.replace(/\s/g, '').includes(t.replace(/\s/g, ''));
  });
}

export function scoreTokenMatch(name: string, tokens: string[], query: string): number {
  const n = normalizeSearchText(name);
  const q = normalizeSearchText(query);
  let score = 0;
  if (n === q) score += 100;
  else if (n.startsWith(q)) score += 80;
  else if (n.includes(q)) score += 60;

  for (const tok of tokens) {
    if (n === tok) score += 40;
    else if (n.startsWith(tok)) score += 25;
    else if (n.includes(tok)) score += 15;
  }
  return score;
}
