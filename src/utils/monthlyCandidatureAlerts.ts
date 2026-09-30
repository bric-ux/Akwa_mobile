/** Statuts qui doivent afficher un indicateur rouge côté locataire. */
export const MONTHLY_CANDIDATURE_ALERT_STATUSES = [
  'accepted',
  'rejected',
  'docs_requested',
] as const;

export type MonthlyCandidatureAlertStatus =
  (typeof MONTHLY_CANDIDATURE_ALERT_STATUSES)[number];

export const MONTHLY_CANDIDATURE_ALERTS_STORAGE_KEY = 'monthly_candidature_alerts_seen_v1';

export type MonthlyCandidatureAlertSeenMap = Record<string, string>;

export type MonthlyCandidatureAlertRow = {
  id: string;
  status: string;
  updated_at?: string | null;
  decided_at?: string | null;
  docs_requested_at?: string | null;
};

export function isMonthlyCandidatureAlertStatus(
  status: string,
): status is MonthlyCandidatureAlertStatus {
  return (MONTHLY_CANDIDATURE_ALERT_STATUSES as readonly string[]).includes(status);
}

export function monthlyCandidatureAlertSignature(row: MonthlyCandidatureAlertRow): string {
  const ts =
    (row.status === 'docs_requested' && row.docs_requested_at) ||
    ((row.status === 'accepted' || row.status === 'rejected') && row.decided_at) ||
    row.updated_at ||
    '';
  return `${row.status}|${ts}`;
}

export function isUnseenMonthlyCandidatureAlert(
  row: MonthlyCandidatureAlertRow,
  seen: MonthlyCandidatureAlertSeenMap,
): boolean {
  if (!isMonthlyCandidatureAlertStatus(row.status)) return false;
  return seen[row.id] !== monthlyCandidatureAlertSignature(row);
}

export function countUnseenMonthlyCandidatureAlerts(
  rows: MonthlyCandidatureAlertRow[],
  seen: MonthlyCandidatureAlertSeenMap,
): number {
  return rows.reduce(
    (n, row) => n + (isUnseenMonthlyCandidatureAlert(row, seen) ? 1 : 0),
    0,
  );
}

export function markMonthlyCandidatureAlertsSeen(
  rows: MonthlyCandidatureAlertRow[],
  seen: MonthlyCandidatureAlertSeenMap = {},
): MonthlyCandidatureAlertSeenMap {
  const next = { ...seen };
  for (const row of rows) {
    if (isMonthlyCandidatureAlertStatus(row.status)) {
      next[row.id] = monthlyCandidatureAlertSignature(row);
    }
  }
  return next;
}

export function parseMonthlyCandidatureAlertsSeen(
  raw: string | null | undefined,
): MonthlyCandidatureAlertSeenMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: MonthlyCandidatureAlertSeenMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
