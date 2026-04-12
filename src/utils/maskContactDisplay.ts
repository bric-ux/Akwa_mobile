/** Même logique que le web (cote-d-ivoire-stays/src/lib/maskContactDisplay.ts) */

export function maskEmailForDisplay(email: string | null | undefined): string {
  if (email == null) return '';
  const t = String(email).trim();
  if (!t) return '';
  const at = t.indexOf('@');
  if (at <= 0) return '••••';
  const local = t.slice(0, at);
  const domain = t.slice(at + 1).trim();
  if (!domain) return '••••';
  const first = local[0] ?? '•';
  return `${first}••••@${domain}`;
}

export function maskPhoneForDisplay(phone: string | null | undefined): string {
  if (phone == null) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}
