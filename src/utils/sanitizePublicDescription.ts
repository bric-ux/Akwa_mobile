/**
 * Masque les numéros / liens de contact dans les descriptions affichées aux voyageurs :
 * remplacement par des x + rappel d’utiliser la messagerie plateforme.
 */
export const PUBLIC_DESCRIPTION_PHONE_REPLACEMENT =
  'xxxxxxx (utilisez la messagerie akwahome)';

/**
 * Remplace les téléphones détectés (formats courants CI / FR / international) par le masque + message.
 */
export function sanitizePublicDescription(text: string | null | undefined): string {
  if (text == null) return '';
  let s = String(text);
  if (!s.trim()) return s;

  const R = PUBLIC_DESCRIPTION_PHONE_REPLACEMENT;

  // Liens WhatsApp / messagerie externe
  s = s.replace(/https?:\/\/(wa\.me|api\.whatsapp\.com)[^\s]*/gi, R);
  s = s.replace(/whatsapp:\/\/[^\s]*/gi, R);

  // Liens téléphone
  s = s.replace(/tel:[+\d\s().-]+/gi, R);

  // Côte d'Ivoire +225 / 00225 (10 chiffres nationaux souvent groupés par 2)
  s = s.replace(
    /(?:\+|00)225[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}/gi,
    R
  );

  // Style français 0X XX XX XX XX
  s = s.replace(/\b0[1-9](?:[\s._-]?\d{2}){4}\b/g, R);

  // 10 chiffres collés commençant par 0 (mobile / fixe FR ou CI courant)
  s = s.replace(/\b0[1-9]\d{8}\b/g, R);

  // International +XX … (au moins ~8 chiffres après l’indicatif)
  s = s.replace(/\+(?:\d[\s.]?){8,17}\d/g, R);

  // 00 … (format international sans +)
  s = s.replace(/\b00\d{1,3}[\s.]?(?:\d[\s.]?){8,14}\d\b/g, R);

  // Évite répétitions du message si plusieurs numéros d’affilée
  const esc = R.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  s = s.replace(new RegExp(`(?:${esc})(?:\\s*[,.;]?\\s*${esc})+`, 'g'), R);

  return s;
}
