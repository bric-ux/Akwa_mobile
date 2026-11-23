/** Phrase publique à partir de la médiane renvoyée par host_typical_reply_minutes. */
export function hostReplyPhrase(
  minutes: number | null | undefined,
  t: (key: string) => string,
): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes <= 60) return t('property.repliesWithinHour');
  if (minutes <= 4 * 60) return t('property.repliesWithinHours');
  if (minutes <= 24 * 60) return t('property.repliesWithinDay');
  if (minutes <= 48 * 60) return t('property.repliesWithinTwoDays');
  return t('property.repliesWithinFewDays');
}
