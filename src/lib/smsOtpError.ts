/** Termii (Afrique) — crédit épuisé */
export const SMS_OTP_TERMII_CREDIT_ERROR_FR =
  "Problème d'envoi du SMS. Pour vous inscrire, utilisez l'inscription par e-mail ou avec Gmail.";

/** Twilio (Europe) — crédit / compte */
export const SMS_OTP_TWILIO_UNAVAILABLE_FR =
  "L'inscription par téléphone est momentanément indisponible. Utilisez l'inscription par e-mail.";

/** @deprecated Alias Termii */
export const SMS_OTP_CREDIT_ERROR_FR = SMS_OTP_TERMII_CREDIT_ERROR_FR;

const SMS_CREDIT_ERROR_RE =
  /insufficient\s*balance|insufficient_balance|insufficient\s*credit|insufficient\s*funds|you have insufficient|low\s*balance|not enough credit|balance is too low|account balance|wallet|quota exceeded|billing/i;

const TWILIO_BILLING_RE =
  /unable to create record.*balance|account.*not active|insufficient funds/i;

export function mapSmsOtpUserMessage(message: string | null | undefined): string {
  const trimmed = (message ?? '').trim();
  if (!trimmed) return trimmed;

  if (
    trimmed === SMS_OTP_TWILIO_UNAVAILABLE_FR ||
    trimmed === SMS_OTP_TERMII_CREDIT_ERROR_FR ||
    trimmed === SMS_OTP_CREDIT_ERROR_FR
  ) {
    return trimmed;
  }

  if (TWILIO_BILLING_RE.test(trimmed) || /account balance|too low to send|twilio/i.test(trimmed)) {
    return SMS_OTP_TWILIO_UNAVAILABLE_FR;
  }
  if (SMS_CREDIT_ERROR_RE.test(trimmed)) return SMS_OTP_TERMII_CREDIT_ERROR_FR;

  return trimmed;
}
