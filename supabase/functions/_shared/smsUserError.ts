const SMS_CREDIT_ERROR_RE =
  /insufficient\s*balance|insufficient_balance|insufficient\s*credit|insufficient\s*funds|you have insufficient|low\s*balance|not enough credit|balance is too low|account balance|wallet|quota exceeded|billing/i;

/** Termii (Afrique) — crédit épuisé */
export const SMS_OTP_TERMII_CREDIT_ERROR_FR =
  "Problème d'envoi du SMS. Pour vous inscrire, utilisez l'inscription par e-mail ou avec Gmail.";

/** Twilio (Europe) — crédit / compte */
export const SMS_OTP_TWILIO_UNAVAILABLE_FR =
  "L'inscription par téléphone est momentanément indisponible. Utilisez l'inscription par e-mail.";

/** @deprecated Alias Termii */
export const SMS_OTP_CREDIT_ERROR_FR = SMS_OTP_TERMII_CREDIT_ERROR_FR;

const TWILIO_BILLING_CODES = new Set([20003, 20005, 30002, 30429, 21617]);

const TWILIO_INVALID_NUMBER_CODES = new Set([21211, 21614]);
const TWILIO_UNSUPPORTED_CODES = new Set([30410, 30007, 21408]);

export function isSmsCreditOrQuotaError(text: string): boolean {
  return SMS_CREDIT_ERROR_RE.test(text);
}

function extractErrorText(errAny: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of ["message", "title", "error", "description", "more_info"]) {
    const v = errAny[key];
    if (typeof v === "string") parts.push(v);
  }
  try {
    parts.push(JSON.stringify(errAny));
  } catch {
    /* ignore */
  }
  return parts.join(" ");
}

export function mapSmsOtpUserMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;
  if (isSmsCreditOrQuotaError(trimmed)) return SMS_OTP_TERMII_CREDIT_ERROR_FR;
  return trimmed;
}

export function termiiErrorToUserMessage(errAny: Record<string, unknown>): string {
  const combined = extractErrorText(errAny);
  if (isSmsCreditOrQuotaError(combined)) return SMS_OTP_TERMII_CREDIT_ERROR_FR;
  if (typeof errAny.message === "string" && errAny.message.trim()) {
    return mapSmsOtpUserMessage(errAny.message);
  }
  return "Échec d'envoi du SMS. Vérifiez votre numéro et réessayez.";
}

export function twilioErrorToUserMessage(errAny: Record<string, unknown>): string {
  const twCode = Number(errAny?.code);
  const combined = extractErrorText(errAny);

  if (isSmsCreditOrQuotaError(combined) || TWILIO_BILLING_CODES.has(twCode)) {
    return SMS_OTP_TWILIO_UNAVAILABLE_FR;
  }
  if (TWILIO_INVALID_NUMBER_CODES.has(twCode)) {
    return "Numéro invalide. Vérifiez l'indicatif pays et saisissez le numéro complet au format international.";
  }
  if (TWILIO_UNSUPPORTED_CODES.has(twCode)) {
    return "Ce numéro n'est pas pris en charge pour l'envoi de SMS. Utilisez un autre numéro ou connectez-vous via votre adresse e-mail.";
  }
  if (typeof errAny.message === "string" && errAny.message.trim()) {
    const msg = errAny.message.trim();
    if (isSmsCreditOrQuotaError(msg)) return SMS_OTP_TWILIO_UNAVAILABLE_FR;
    return msg;
  }
  return "Échec d'envoi du SMS. Vérifiez votre numéro.";
}
