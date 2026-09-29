export const AKWAHOME_SUPPORT_KIND = 'admin_support' as const;
export const AKWAHOME_SUPPORT_TITLE = 'Service AkwaHome';
export const AKWAHOME_SUPPORT_SUBTITLE = 'Équipe AkwaHome';

export function isAdminSupportConversation(conv: {
  kind?: string | null;
  title?: string | null;
}): boolean {
  return conv.kind === AKWAHOME_SUPPORT_KIND || conv.title === AKWAHOME_SUPPORT_TITLE;
}
