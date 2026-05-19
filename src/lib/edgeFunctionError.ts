/**
 * Supabase renvoie souvent `error` + `data: null` quand l’edge function répond en 4xx/5xx.
 * Le corps JSON ({ error: "..." }) est dans `error.context` (Response).
 */
export async function readEdgeFunctionError(
  data: unknown,
  fnError: unknown,
): Promise<string | null> {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }

  const err = fnError as { context?: Response; message?: string } | null;
  if (err?.context && typeof err.context.json === 'function') {
    try {
      const body = await err.context.json();
      if (body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string') {
        const msg = (body as { error: string }).error.trim();
        if (msg) return msg;
      }
    } catch {
      // corps déjà lu ou non-JSON
    }
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    const generic = 'Edge Function returned a non-2xx status code';
    if (err.message.trim() !== generic) return err.message.trim();
  }

  return null;
}

export async function getEdgeFunctionErrorMessage(
  data: unknown,
  fnError: unknown,
  fallback: string,
): Promise<string> {
  const msg = await readEdgeFunctionError(data, fnError);
  return msg || fallback;
}
