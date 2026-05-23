/** Type d'échec de chargement pour afficher le bon message UX. */
export type LoadFailureKind = 'offline' | 'network' | 'not_found' | 'unknown';

const NOT_FOUND_PATTERNS = [
  'non trouv',
  'not found',
  'introuvable',
  'n\'existe pas',
  'does not exist',
  'pgrst116',
];

const NETWORK_PATTERNS = [
  'network',
  'réseau',
  'fetch',
  'timeout',
  'timed out',
  'connexion',
  'connection',
  'failed to fetch',
  'network request failed',
  'abort',
];

function messageFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
}

export function classifyLoadError(error: unknown, isOffline = false): LoadFailureKind {
  if (isOffline) return 'offline';

  const msg = messageFromError(error).toLowerCase();
  if (!msg) return 'unknown';

  if (NOT_FOUND_PATTERNS.some((p) => msg.includes(p))) {
    return 'not_found';
  }

  if (NETWORK_PATTERNS.some((p) => msg.includes(p))) {
    return 'network';
  }

  // Codes Supabase « aucune ligne »
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === 'PGRST116') return 'not_found';
  }

  return 'unknown';
}
