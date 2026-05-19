// Shared SMS sender: routes to Termii for African numbers, Twilio for the rest.
// Used by send-phone-otp and send-email edge functions (same Supabase project as web).

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const TERMII_BASE_URL = "https://v3.api.termii.com";

const AFRICA_DIAL_CODES = [
  "211","212","213","216","218","220","221","222","223","224","225","226","227",
  "228","229","230","231","232","233","234","235","236","237","238","239","240",
  "241","242","243","244","245","246","247","248","249","250","251","252","253",
  "254","255","256","257","258","260","261","262","263","264","265","266","267",
  "268","269","290","291","297","298","299",
  "20","27",
];

export function isAfricanE164(e164: string): boolean {
  const digits = (e164 || "").replace(/^\+/, "").replace(/\D/g, "");
  if (!digits) return false;
  return AFRICA_DIAL_CODES.some((p) => digits.startsWith(p));
}

export type SmsResult = {
  ok: boolean;
  provider: "termii" | "twilio";
  sid?: string;
  status?: number;
  error?: unknown;
};

async function sendViaTermii(toE164: string, body: string): Promise<SmsResult> {
  const apiKey = Deno.env.get("TERMII_API_KEY");
  const sender = Deno.env.get("TERMII_SENDER_ID") || "N-Alert";
  if (!apiKey) {
    return { ok: false, provider: "termii", error: "TERMII_API_KEY missing" };
  }
  const to = toE164.replace(/^\+/, "");
  const payload = {
    to,
    from: sender,
    sms: body,
    type: "plain",
    channel: sender === "N-Alert" ? "dnd" : "generic",
    api_key: apiKey,
  };
  try {
    const resp = await fetch(`${TERMII_BASE_URL}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || json?.code === "ERROR" || json?.status >= 400) {
      console.error("Termii SMS error:", resp.status, json);
      return { ok: false, provider: "termii", status: resp.status, error: json };
    }
    console.log("✅ Termii SMS sent:", json?.message_id || json?.message);
    return { ok: true, provider: "termii", sid: json?.message_id };
  } catch (err) {
    console.error("Termii request failed:", err);
    return { ok: false, provider: "termii", error: String(err) };
  }
}

async function sendViaTwilio(toE164: string, body: string): Promise<SmsResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_PHONE_NUMBER) {
    return { ok: false, provider: "twilio", error: "Twilio config missing" };
  }
  try {
    const resp = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toE164,
        From: TWILIO_PHONE_NUMBER,
        Body: body,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Twilio SMS error:", resp.status, json);
      return { ok: false, provider: "twilio", status: resp.status, error: json };
    }
    console.log("✅ Twilio SMS sent:", json?.sid);
    return { ok: true, provider: "twilio", sid: json?.sid };
  } catch (err) {
    console.error("Twilio request failed:", err);
    return { ok: false, provider: "twilio", error: String(err) };
  }
}

/** Numéros africains → Termii uniquement (pas de fallback Twilio). */
export async function sendSmsSmart(toE164: string, body: string): Promise<SmsResult> {
  if (isAfricanE164(toE164)) {
    return sendViaTermii(toE164, body);
  }
  return sendViaTwilio(toE164, body);
}
