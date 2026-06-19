import type { HostApplication } from '../hooks/useHostApplications';

type CategorizedHostPhoto = {
  url?: string;
  uri?: string;
  category?: string;
  isMain?: boolean;
  is_main?: boolean;
  displayOrder?: number;
  display_order?: number;
};

function parseCategorizedPhotos(application: HostApplication): CategorizedHostPhoto[] {
  if (!application.categorized_photos) return [];

  try {
    const raw =
      typeof application.categorized_photos === 'string'
        ? JSON.parse(application.categorized_photos)
        : application.categorized_photos;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function sortHostPhotos(photos: CategorizedHostPhoto[]): CategorizedHostPhoto[] {
  return [...photos].sort((a, b) => {
    const aMain = a.is_main || a.isMain ? 1 : 0;
    const bMain = b.is_main || b.isMain ? 1 : 0;
    if (aMain !== bMain) return bMain - aMain;
    return (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0);
  });
}

/** Photo principale d'une candidature hôte (isMain / is_main, sinon première image). */
export function getHostApplicationCoverUrl(application: HostApplication): string | null {
  const categorized = sortHostPhotos(parseCategorizedPhotos(application));
  if (categorized.length > 0) {
    const main = categorized.find((photo) => photo.is_main || photo.isMain);
    const pick = main ?? categorized[0];
    return pick?.url || pick?.uri || null;
  }

  if (application.images && application.images.length > 0) {
    return application.images[0];
  }

  return null;
}

export function getHostApplicationPhotoCount(application: HostApplication): number {
  const categorized = parseCategorizedPhotos(application);
  if (categorized.length > 0) return categorized.length;
  return application.images?.length ?? 0;
}

export function getHostApplicationPhotoUrls(application: HostApplication): string[] {
  const categorized = sortHostPhotos(parseCategorizedPhotos(application));
  if (categorized.length > 0) {
    return categorized.map((photo) => photo.url || photo.uri).filter(Boolean) as string[];
  }
  return application.images ?? [];
}

export function getHostApplicationSortedPhotos(
  application: HostApplication,
): CategorizedHostPhoto[] {
  return sortHostPhotos(parseCategorizedPhotos(application));
}
