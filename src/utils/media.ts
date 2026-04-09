const VIDEO_PATH_RE = /\.(mp4|mov|m4v|webm|mkv)(\?|#|$)/i;

export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const path = url.split(/[?#]/)[0].toLowerCase();
  return VIDEO_PATH_RE.test(path);
}

export function getPropertyCoverUrl(property: {
  photos?: Array<{ url?: string; is_main?: boolean; isMain?: boolean; display_order?: number | null }>;
  images?: string[];
}): string {
  const list: string[] = [];
  if (property.photos?.length) {
    const sorted = [...property.photos].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
    const main = sorted.find((p) => p.is_main || p.isMain);
    if (main?.url) list.push(main.url);
    sorted.forEach((p) => {
      if (p.url && p.url !== main?.url) list.push(p.url);
    });
  }
  property.images?.forEach((u) => u && list.push(u));
  for (const u of list) {
    if (!isVideoUrl(u)) return u;
  }
  return list[0] || 'https://via.placeholder.com/300x200';
}

/** URLs dans l’ordre d’affichage (principale d’abord, puis display_order, puis images legacy). */
export function getPropertyGalleryUrls(property: {
  photos?: Array<{
    url?: string;
    is_main?: boolean;
    isMain?: boolean;
    display_order?: number | null;
    displayOrder?: number | null;
  }>;
  images?: string[];
}): string[] {
  const list: string[] = [];
  if (property.photos?.length) {
    const sorted = [...property.photos].sort(
      (a, b) =>
        (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0)
    );
    const main = sorted.find((p) => p.is_main || p.isMain);
    if (main?.url) list.push(main.url);
    sorted.forEach((p) => {
      if (p.url && p.url !== main?.url) list.push(p.url);
    });
  }
  property.images?.forEach((u) => {
    if (u && !list.includes(u)) list.push(u);
  });
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const u of list) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    deduped.push(u);
  }
  return deduped;
}

export function getVehicleCoverUrl(vehicle: {
  images?: string[];
  vehicle_photos?: Array<{ url?: string; is_main?: boolean; category?: string; display_order?: number }>;
  photos?: Array<{ url?: string; is_main?: boolean; category?: string; display_order?: number }>;
}): string {
  const raw = vehicle.vehicle_photos || vehicle.photos || [];
  const sorted = [...raw].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const ordered: typeof raw = [];
  const main = sorted.find((p) => p.is_main);
  if (main) ordered.push(main);
  sorted.forEach((p) => {
    if (p !== main) ordered.push(p);
  });
  const urls: string[] = [];
  ordered.forEach((p) => p.url && urls.push(p.url));
  vehicle.images?.forEach((u) => u && urls.push(u));
  for (const u of urls) {
    if (!isVideoUrl(u)) return u;
  }
  return urls[0] || '';
}

export function guessVideoContentType(fileExt: string): string {
  const e = fileExt.toLowerCase();
  if (e === 'mov') return 'video/quicktime';
  if (e === 'webm') return 'video/webm';
  if (e === 'mkv') return 'video/x-matroska';
  return 'video/mp4';
}

export function guessImageContentType(fileExt: string): string {
  const e = fileExt.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'gif') return 'image/gif';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Ligne média (hôte / véhicule) : vidéo si flag, catégorie `video`, ou extension d’URL. */
export function isMediaRowVideo(row: {
  uri?: string;
  url?: string;
  isVideo?: boolean;
  category?: string;
}): boolean {
  if (row.isVideo === true) return true;
  if (row.category === 'video') return true;
  const u = row.uri || row.url;
  return isVideoUrl(u);
}

/**
 * Une seule vignette « principale » possible, jamais une vidéo.
 */
export function normalizeHostMediaRows<
  T extends { uri: string; isMain?: boolean; isVideo?: boolean; category?: string },
>(rows: T[]): T[] {
  const tagged = rows.map((row) => {
    const vid = isMediaRowVideo(row);
    return { ...row, isVideo: vid, isMain: vid ? false : Boolean(row.isMain) } as T;
  });
  const nonVideoIdx = tagged
    .map((row, i) => (!isMediaRowVideo(row) ? i : -1))
    .filter((i) => i >= 0);
  if (nonVideoIdx.length === 0) {
    return tagged.map((row) => ({ ...row, isMain: false } as T));
  }
  let mainIndex = tagged.findIndex((row) => row.isMain);
  if (mainIndex < 0 || isMediaRowVideo(tagged[mainIndex])) {
    mainIndex = nonVideoIdx[0];
  }
  return tagged.map((row, i) => ({
    ...row,
    isMain: i === mainIndex && !isMediaRowVideo(row),
  })) as T;
}

/** Photos propriété (url + is_main) : une seule principale, jamais une vidéo. */
export function normalizePropertyPhotoRows<T extends { url: string; is_main?: boolean; isMain?: boolean }>(
  photos: T[]
): T[] {
  if (photos.length === 0) return photos;
  const rows = photos.map((p) => ({
    uri: p.url,
    isMain: Boolean(p.is_main || p.isMain),
    category: '',
  }));
  const norm = normalizeHostMediaRows(rows);
  return photos.map((p, i) => ({
    ...p,
    is_main: norm[i].isMain,
    isMain: norm[i].isMain,
  })) as T[];
}

export function getVehicleGalleryUrls(vehicle: {
  images?: string[];
  vehicle_photos?: Array<{ url?: string; is_main?: boolean; display_order?: number }>;
  photos?: Array<{ url?: string; is_main?: boolean; display_order?: number }>;
}): string[] {
  const raw = vehicle.vehicle_photos || vehicle.photos || [];
  if (raw.length > 0) {
    const sorted = [...raw].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });
    return sorted.map((p) => p.url).filter(Boolean) as string[];
  }
  return vehicle.images?.filter(Boolean) || [];
}
