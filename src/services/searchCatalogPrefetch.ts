import type { HomeCategoryId } from '../types/homeCategory';

type PrefetchHandlers = {
  prefetchResidence: () => void;
  prefetchHotel: () => void;
  prefetchMonthly: () => void;
};

let handlers: PrefetchHandlers | null = null;

export function registerSearchCatalogPrefetch(next: PrefetchHandlers | null): void {
  handlers = next;
}

export function prefetchHomeCategory(category: HomeCategoryId): void {
  if (!handlers) return;
  switch (category) {
    case 'residence':
      handlers.prefetchResidence();
      break;
    case 'hotel':
      handlers.prefetchHotel();
      break;
    case 'monthly':
      handlers.prefetchMonthly();
      break;
    default:
      break;
  }
}
