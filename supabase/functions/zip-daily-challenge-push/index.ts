/**
 * Push quotidien : nouveau défi Zip disponible (cron pg_cron, 8h Abidjan).
 * verify_jwt = false — appelé par le cron avec la clé anon (comme booking-reminders).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH = 100;
const PROFILE_PAGE = 500;

const PUZZLE_META = [
  { id: "abidjan-5", theme: "Abidjan", subtitle: "De la lagune au Plateau" },
  { id: "assinie-5", theme: "Assinie", subtitle: "Entre plage et cocotiers" },
  { id: "grand-bassam-5", theme: "Grand-Bassam", subtitle: "Ville historique UNESCO" },
  { id: "yamoussoukro-5", theme: "Yamoussoukro", subtitle: "Capitale politique" },
  { id: "bouake-5", theme: "Bouaké", subtitle: "Cœur du pays Baoulé" },
  { id: "san-pedro-5", theme: "San-Pédro", subtitle: "Port du sud-ouest" },
  { id: "man-5", theme: "Man", subtitle: "Les montagnes de l'ouest" },
  { id: "korhogo-6", theme: "Korhogo", subtitle: "Porte du nord ivoirien" },
  { id: "cocody-6", theme: "Cocody", subtitle: "Quartier des ambassades" },
  { id: "marcory-6", theme: "Marcory", subtitle: "Zone 4 et vie nocturne" },
  { id: "treichville-6", theme: "Treichville", subtitle: "Marché et culture" },
  { id: "bingerville-6", theme: "Bingerville", subtitle: "Ville jardin" },
  { id: "daloa-6", theme: "Daloa", subtitle: "Capitale du Haut-Sassandra" },
  { id: "akwa-7", theme: "AkwaHome", subtitle: "Le défi du week-end" },
] as const;

function getAbidjanDateKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Africa/Abidjan" });
}

function getWeekdayIndex(date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Abidjan",
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekday] ?? 0;
}

function getDailyPuzzleMeta(date = new Date()) {
  const dateKey = getAbidjanDateKey(date);
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const weekday = getWeekdayIndex(date);
  const difficultyBoost = weekday >= 5 ? 2 : weekday >= 3 ? 1 : 0;
  const index = (hash + weekday + difficultyBoost) % PUZZLE_META.length;
  const base = PUZZLE_META[index];
  return {
    dateKey,
    puzzleId: `${dateKey}-${base.id}`,
    theme: base.theme,
    subtitle: base.subtitle,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: Record<string, string>;
};

async function sendExpoBatch(
  batch: ExpoMessage[],
  expoHeaders: Record<string, string>,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: expoHeaders,
    body: JSON.stringify(batch),
  });

  const expoJson = await expoRes.json().catch(() => ({}));
  if (!expoRes.ok) {
    console.error("[zip-daily-challenge-push] Expo API error:", expoRes.status, expoJson);
    return { delivered: 0, failed: batch.length };
  }

  const tickets = Array.isArray(expoJson?.data) ? expoJson.data : [];
  for (const ticket of tickets) {
    if (ticket?.status === "ok") delivered += 1;
    else failed += 1;
  }
  return { delivered, failed };
}

async function loadAlreadyPlayedUserIds(
  admin: ReturnType<typeof createClient>,
  puzzleDate: string,
): Promise<Set<string>> {
  const played = new Set<string>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("zip_game_results")
      .select("user_id")
      .eq("puzzle_date", puzzleDate)
      .order("user_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[zip-daily-challenge-push] zip_game_results:", error.message);
      throw error;
    }

    if (!data?.length) break;

    for (const row of data) {
      if (row.user_id) played.add(row.user_id);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return played;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const puzzle = getDailyPuzzleMeta();

    const { data: alreadySent, error: sentErr } = await admin
      .from("zip_daily_push_sent")
      .select("puzzle_date")
      .eq("puzzle_date", puzzle.dateKey)
      .maybeSingle();

    if (sentErr) {
      console.error("[zip-daily-challenge-push] sent lookup:", sentErr.message);
      throw sentErr;
    }

    if (alreadySent) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "already_sent", puzzle_date: puzzle.dateKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    const expoHeaders: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    if (expoAccessToken) {
      expoHeaders.Authorization = `Bearer ${expoAccessToken}`;
    }

    const title = `Zip du jour · ${puzzle.theme}`;
    const body = `Nouveau défi disponible ! ${puzzle.subtitle}`;
    const dataPayload: Record<string, string> = {
      type: "zip_daily",
      screen: "ZipGame",
      puzzleDate: puzzle.dateKey,
      puzzleId: puzzle.puzzleId,
      theme: puzzle.theme,
    };

    let targeted = 0;
    let delivered = 0;
    let failed = 0;
    let skippedDisabled = 0;
    let skippedAlreadyPlayed = 0;
    let offset = 0;

    const alreadyPlayed = await loadAlreadyPlayedUserIds(admin, puzzle.dateKey);

    while (true) {
      const { data: profiles, error: profileErr } = await admin
        .from("profiles")
        .select("user_id, expo_push_token, push_notifications_enabled")
        .not("expo_push_token", "is", null)
        .order("user_id", { ascending: true })
        .range(offset, offset + PROFILE_PAGE - 1);

      if (profileErr) {
        console.error("[zip-daily-challenge-push] profiles:", profileErr.message);
        throw profileErr;
      }

      if (!profiles?.length) break;

      const messages: ExpoMessage[] = [];
      for (const profile of profiles) {
        const token = profile.expo_push_token?.trim();
        if (!token) continue;
        if (profile.push_notifications_enabled === false) {
          skippedDisabled += 1;
          continue;
        }
        if (alreadyPlayed.has(profile.user_id)) {
          skippedAlreadyPlayed += 1;
          continue;
        }
        targeted += 1;
        messages.push({
          to: token,
          title,
          body,
          sound: "default",
          data: dataPayload,
        });
      }

      for (const batch of chunkArray(messages, EXPO_BATCH)) {
        const result = await sendExpoBatch(batch, expoHeaders);
        delivered += result.delivered;
        failed += result.failed;
      }

      if (profiles.length < PROFILE_PAGE) break;
      offset += PROFILE_PAGE;
    }

    const { error: logErr } = await admin.from("zip_daily_push_sent").insert({
      puzzle_date: puzzle.dateKey,
      recipients_count: targeted,
      delivered_count: delivered,
      failed_count: failed,
      skipped_disabled: skippedDisabled,
    });

    if (logErr) {
      console.error("[zip-daily-challenge-push] log insert:", logErr.message);
      throw logErr;
    }

    console.log(
      `[zip-daily-challenge-push] ${puzzle.dateKey} → targeted=${targeted} delivered=${delivered} failed=${failed} skipped_played=${skippedAlreadyPlayed}`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        puzzle_date: puzzle.dateKey,
        theme: puzzle.theme,
        targeted,
        delivered,
        failed,
        skipped_disabled: skippedDisabled,
        skipped_already_played: skippedAlreadyPlayed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[zip-daily-challenge-push]", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
