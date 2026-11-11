export type ListingLanguage = 'fr' | 'en';

/**
 * Affiche le texte EN s’il existe et que la langue UI est EN, sinon le FR (ou l’inverse si seul EN).
 */
export function localizedListingText(
  language: ListingLanguage,
  fr?: string | null,
  en?: string | null,
): string {
  const frTrim = fr?.trim() || '';
  const enTrim = en?.trim() || '';
  if (language === 'en') return enTrim || frTrim;
  return frTrim || enTrim;
}
