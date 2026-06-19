import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export type PredictionContact = {
  userId: string | null;
  fullName: string;
  email: string;
  phone: string;
};

export async function getPredictionContact(
  user: User | null,
  overrides?: Partial<PredictionContact>,
): Promise<PredictionContact> {
  let freshUser = user;
  if (!freshUser) {
    const { data } = await supabase.auth.getUser();
    freshUser = data.user ?? null;
  }

  const meta = (freshUser?.user_metadata as Record<string, unknown> | undefined) ?? {};
  let profileName = '';
  let profilePhone = '';
  let profileEmail = '';

  if (freshUser?.id) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('first_name,last_name,phone_e164,phone,email')
      .eq('user_id', freshUser.id)
      .maybeSingle();

    if (prof) {
      profileName = `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim();
      profilePhone = ((prof.phone_e164 as string | null) || (prof.phone as string | null) || '').trim();
      profileEmail = ((prof.email as string | null) || '').trim();
    }
  }

  const fullName = (
    overrides?.fullName ||
    profileName ||
    ((meta.full_name as string) ||
      (meta.name as string) ||
      `${(meta.first_name as string) || ''} ${(meta.last_name as string) || ''}`.trim())
  ).trim();
  const email = (overrides?.email || profileEmail || freshUser?.email || '').trim().toLowerCase();
  const phone = (
    overrides?.phone ||
    profilePhone ||
    (meta.phone_e164 as string) ||
    (meta.phone as string) ||
    freshUser?.phone ||
    ''
  ).trim();

  return {
    userId: overrides?.userId ?? freshUser?.id ?? null,
    fullName,
    email,
    phone,
  };
}
