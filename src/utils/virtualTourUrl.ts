/**
 * Valide et normalise une URL de visite virtuelle : HTTPS uniquement.
 */
export function normalizeVirtualTourUrl(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  return url.toString();
}

export function hasVirtualTourUrl(input: string | null | undefined): boolean {
  return normalizeVirtualTourUrl(input) !== null;
}
