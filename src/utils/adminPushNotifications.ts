import { supabase } from '../services/supabase';

const PUSH_SELECT =
  'user_id, first_name, last_name, email, is_host, expo_push_token, push_notifications_enabled';

export type PushNotificationAudience =
  | 'single'
  | 'all_push_users'
  | 'hosts'
  | 'vehicle_owners'
  | 'all_hosts_and_owners';

export type PushNotificationRecipient = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_host: boolean;
  is_vehicle_owner: boolean;
  push_ready: boolean;
};

export type AdminSendPushResult = {
  ok: boolean;
  delivered: number;
  skipped: number;
  skipped_no_token?: number;
  skipped_disabled?: number;
  failed: number;
  total_requested?: number;
  error?: string;
};

function profileCanReceivePush(row: {
  expo_push_token?: string | null;
  push_notifications_enabled?: boolean | null;
}): boolean {
  const token = row.expo_push_token?.trim();
  return Boolean(token) && row.push_notifications_enabled !== false;
}

export function getPushRecipientDisplayName(
  recipient: Pick<PushNotificationRecipient, 'first_name' | 'last_name' | 'email'>,
): string {
  const name = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ').trim();
  return name || recipient.email || 'Utilisateur';
}

export async function fetchPushNotificationRecipients(): Promise<PushNotificationRecipient[]> {
  const [profilesRes, vehiclesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(PUSH_SELECT)
      .not('expo_push_token', 'is', null)
      .order('first_name', { ascending: true }),
    supabase
      .from('vehicles')
      .select('owner_id')
      .eq('is_active', true)
      .eq('is_approved', true),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (vehiclesRes.error) throw vehiclesRes.error;

  const vehicleOwnerIds = new Set(
    (vehiclesRes.data ?? []).map((v) => v.owner_id).filter(Boolean) as string[],
  );

  return (profilesRes.data ?? []).map((row) => ({
    user_id: row.user_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    is_host: Boolean(row.is_host),
    is_vehicle_owner: vehicleOwnerIds.has(row.user_id),
    push_ready: profileCanReceivePush(row),
  }));
}

export function filterRecipientsByAudience(
  recipients: PushNotificationRecipient[],
  audience: PushNotificationAudience,
  selectedUserId: string | null,
): PushNotificationRecipient[] {
  switch (audience) {
    case 'single':
      return selectedUserId
        ? recipients.filter((r) => r.user_id === selectedUserId && r.push_ready)
        : [];
    case 'hosts':
      return recipients.filter((r) => r.is_host && r.push_ready);
    case 'vehicle_owners':
      return recipients.filter((r) => r.is_vehicle_owner && r.push_ready);
    case 'all_hosts_and_owners':
      return recipients.filter(
        (r) => (r.is_host || r.is_vehicle_owner) && r.push_ready,
      );
    case 'all_push_users':
    default:
      return recipients.filter((r) => r.push_ready);
  }
}

export async function adminSendPushNotifications(params: {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  type?: string;
}): Promise<AdminSendPushResult> {
  const { data, error } = await supabase.functions.invoke('admin-send-push', {
    body: params,
  });

  if (error) {
    throw error;
  }

  const result = (data ?? {}) as AdminSendPushResult;
  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}
