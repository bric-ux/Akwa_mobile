export const AKWAHOME_SUPPORT_KIND = 'admin_support' as const;
export const AKWAHOME_SUPPORT_TITLE = 'Service AkwaHome';
export const AKWAHOME_SUPPORT_SUBTITLE = 'Équipe AkwaHome';
export const AKWAHOME_SUPPORT_READONLY =
  'Ce fil est informatif. Seul AkwaHome peut vous écrire ici.';

export function isAdminSupportConversation(conv: {
  kind?: string | null;
  title?: string | null;
}): boolean {
  return conv.kind === AKWAHOME_SUPPORT_KIND || conv.title === AKWAHOME_SUPPORT_TITLE;
}

export function supportMessagePreview(message: string, max = 90): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}
