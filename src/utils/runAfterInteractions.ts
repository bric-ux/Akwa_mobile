/**
 * SDK 58+ : InteractionManager a été retiré de react-native.
 * Remplace `InteractionManager.runAfterInteractions` par requestIdleCallback / setTimeout.
 */
export type AfterInteractionsHandle = { cancel: () => void };

export function runAfterInteractions(task: () => void): AfterInteractionsHandle {
  let cancelled = false;
  const run = () => {
    if (!cancelled) task();
  };

  const g = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof g.requestIdleCallback === 'function') {
    const id = g.requestIdleCallback(run, { timeout: 500 });
    return {
      cancel: () => {
        cancelled = true;
        g.cancelIdleCallback?.(id);
      },
    };
  }

  const timeoutId = setTimeout(run, 0);
  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timeoutId);
    },
  };
}
