import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { normalizePhoneE164 } from "../_shared/normalizePhone.ts";
import { isAllowedSignupPhone } from "../_shared/signupPhone.ts";
import { sendSmsSmart, isAfricanE164 } from "../_shared/sms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  phone: z.string().trim().min(8).max(25),
  purpose: z.enum(["signup", "login", "reset"]).default("signup"),
});

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuration serveur manquante" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Numéro de téléphone invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneE164 = normalizePhoneE164(parsed.data.phone);
    if (!phoneE164) {
      return new Response(
        JSON.stringify({
          error: "Format de numéro invalide. Utilisez le format international (+225 07...)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const purpose = parsed.data.purpose;

    if (purpose === "signup" && !isAllowedSignupPhone(phoneE164)) {
      return new Response(
        JSON.stringify({
          error:
            "Inscription par téléphone disponible uniquement pour la Côte d'Ivoire et l'Europe.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: phoneCount } = await supabase
      .from("phone_otp_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("phone_e164", phoneE164)
      .gte("sent_at", oneHourAgo);

    if ((phoneCount ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Trop de SMS envoyés à ce numéro. Réessayez dans 1 heure." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { count: ipCount } = await supabase
      .from("phone_otp_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("sent_at", oneHourAgo);

    if ((ipCount ?? 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Trop de demandes depuis votre adresse. Réessayez plus tard." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingEmail } = await supabase.rpc("resolve_phone_to_email", {
      p_phone: phoneE164,
    });

    if (purpose === "signup") {
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id, phone_verified")
        .eq("phone_e164", phoneE164)
        .maybeSingle();

      if (existing?.phone_verified || existingEmail) {
        return new Response(
          JSON.stringify({ error: "Ce numéro est déjà associé à un compte. Connectez-vous." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (purpose === "login" || purpose === "reset") {
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id, phone_verified")
        .eq("phone_e164", phoneE164)
        .eq("phone_verified", true)
        .maybeSingle();

      if (!existing && !existingEmail) {
        return new Response(
          JSON.stringify({ error: "Aucun compte associé à ce numéro." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const code = generateCode();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase
      .from("phone_verification_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone_e164", phoneE164)
      .eq("purpose", purpose)
      .is("consumed_at", null);

    const { error: insertErr } = await supabase.from("phone_verification_codes").insert({
      phone_e164: phoneE164,
      code_hash: codeHash,
      purpose,
      expires_at: expiresAt,
      ip_address: ip,
    });

    if (insertErr) {
      console.error("Insert OTP failed:", insertErr);
      return new Response(
        JSON.stringify({ error: "Erreur interne" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smsBody = `AkwaHome : votre code de verification est ${code}. Valide 10 minutes. Ne partagez jamais ce code.`;

    const smsResult = await sendSmsSmart(phoneE164, smsBody);

    if (!smsResult.ok) {
      const errAny: Record<string, unknown> =
        smsResult.error && typeof smsResult.error === "object"
          ? (smsResult.error as Record<string, unknown>)
          : { message: String(smsResult.error ?? "") };

      console.error(`SMS provider error (${smsResult.provider}):`, smsResult.status, errAny);

      if (smsResult.provider === "twilio") {
        const twCode = Number(errAny?.code);
        const INVALID_NUMBER_CODES = new Set([21211, 21614]);
        const UNSUPPORTED_CODES = new Set([30410, 30007, 21408]);

        let userMessage = "Échec d'envoi du SMS. Vérifiez votre numéro.";
        if (INVALID_NUMBER_CODES.has(twCode)) {
          userMessage =
            "Numéro invalide. Vérifiez l'indicatif pays et saisissez le numéro complet au format international.";
        } else if (UNSUPPORTED_CODES.has(twCode)) {
          userMessage =
            "Ce numéro n'est pas pris en charge pour l'envoi de SMS. Utilisez un autre numéro ou connectez-vous via votre adresse e-mail.";
        }

        return new Response(
          JSON.stringify({
            error: userMessage,
            code: twCode,
            provider: "twilio",
            details: errAny?.message || errAny,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const termiiMsg =
        (typeof errAny?.message === "string" && errAny.message) ||
        "Échec d'envoi du SMS. Vérifiez votre numéro et réessayez.";
      return new Response(
        JSON.stringify({ error: termiiMsg, provider: "termii", details: errAny }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `SMS OTP sent via ${smsResult.provider} (african=${isAfricanE164(phoneE164)}):`,
      smsResult.sid,
    );

    await supabase.from("phone_otp_rate_limits").insert({
      phone_e164: phoneE164,
      ip_address: ip,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Code envoyé par SMS", provider: smsResult.provider }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-phone-otp error:", err);
    return new Response(
      JSON.stringify({ error: "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
