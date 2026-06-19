export function sortPropertyPhotosMainFirst<
  T extends {
    is_main?: boolean | null;
    isMain?: boolean | null;
    display_order?: number | null;
    displayOrder?: number | null;
  },
>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    const aMain = a.is_main || a.isMain ? 1 : 0;
    const bMain = b.is_main || b.isMain ? 1 : 0;
    if (aMain !== bMain) return bMain - aMain;
    return (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0);
  });
}

export function buildPropertyImageUrls(
  photos:
    | Array<{
        url?: string | null;
        is_main?: boolean | null;
        isMain?: boolean | null;
        display_order?: number | null;
        displayOrder?: number | null;
      }>
    | null
    | undefined,
  fallbackImages?: string[] | null,
): string[] {
  const sorted = sortPropertyPhotosMainFirst(photos || []);
  const urls = sorted.map((photo) => photo.url).filter((url): url is string => Boolean(url));
  if (urls.length > 0) return urls;
  return fallbackImages?.filter(Boolean) || [];
}

/** Index admin « Mettre en avant cette photo » (clé featured_N). */
export function findFeaturedPhotoIndex(
  photoCategories: Record<string | number, string>,
): number {
  let featuredIndex = -1;
  for (const [key, value] of Object.entries(photoCategories)) {
    if (String(key).startsWith('featured_') && value === 'true') {
      const idx = parseInt(String(key).replace('featured_', ''), 10);
      if (!Number.isNaN(idx)) featuredIndex = idx;
    }
  }
  return featuredIndex;
}
