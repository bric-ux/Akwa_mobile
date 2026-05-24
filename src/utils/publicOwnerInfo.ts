import { supabase } from '../services/supabase';

export type PublicOwnerInfo = {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  country?: string;
  created_at?: string;
};

/** Infos publiques hôte / propriétaire (table host_public_info, accessible sans connexion). */
export async function fetchPublicOwnerInfo(userId: string): Promise<PublicOwnerInfo | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('host_public_info')
    .select('user_id, first_name, last_name, avatar_url, bio, city, country, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    user_id: data.user_id,
    first_name: data.first_name ?? '',
    last_name: data.last_name ?? '',
    avatar_url: data.avatar_url ?? undefined,
    bio: data.bio ?? undefined,
    city: data.city ?? undefined,
    country: data.country ?? undefined,
    created_at: data.created_at ?? undefined,
  };
}
