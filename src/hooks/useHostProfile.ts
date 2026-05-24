import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { fetchPublicOwnerInfo } from '../utils/publicOwnerInfo';

export interface HostProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  bio?: string;
  phone?: string;
  email: string;
  created_at: string;
  city?: string;
  country?: string;
  identity_verified?: boolean;
  properties?: {
    id: string;
    title: string;
    slug?: string | null;
    price_per_night?: number | null;
    images?: string[] | null;
    rating?: number;
    review_count?: number;
    locations?: { name?: string } | null;
    property_photos?: Array<{ url: string; is_main?: boolean | null }> | null;
  }[];
  total_reviews?: number;
  average_rating?: number;
  total_properties?: number;
}

const HOST_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const hostProfileCache = new Map<string, { profile: HostProfile; at: number }>();

function mapProfileRow(row: Record<string, unknown>, hostId: string): HostProfile {
  return {
    id: String(row.user_id ?? row.id ?? hostId),
    first_name: String(row.first_name ?? ''),
    last_name: String(row.last_name ?? ''),
    avatar_url: (row.avatar_url as string | undefined) ?? undefined,
    bio: (row.bio as string | undefined) ?? undefined,
    phone: (row.phone as string | undefined) ?? undefined,
    email: String(row.email ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
    city: (row.city as string | undefined) ?? undefined,
    country: (row.country as string | undefined) ?? undefined,
    identity_verified: Boolean(row.identity_verified),
  };
}

async function loadProfileFromProfilesTable(hostId: string) {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', hostId)
    .maybeSingle();

  if (profileError || !profileData) {
    return null;
  }

  return mapProfileRow(profileData as Record<string, unknown>, hostId);
}

export const useHostProfile = () => {
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHostProfile = useCallback(async (hostId: string) => {
    const cached = hostProfileCache.get(hostId);
    if (cached && Date.now() - cached.at < HOST_PROFILE_CACHE_TTL_MS) {
      setHostProfile(cached.profile);
      setLoading(false);
      setError(null);
      return cached.profile;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 [useHostProfile] Chargement du profil pour hostId:', hostId);

      let baseProfile: HostProfile | null = null;

      const publicInfo = await fetchPublicOwnerInfo(hostId);
      if (publicInfo) {
        baseProfile = mapProfileRow(publicInfo as unknown as Record<string, unknown>, hostId);
        console.log('✅ [useHostProfile] Profil chargé depuis host_public_info:', baseProfile);
      } else {
        console.log('⚠️ [useHostProfile] Pas dans host_public_info, essai profiles (utilisateur connecté)...');
        baseProfile = await loadProfileFromProfilesTable(hostId);
        if (baseProfile) {
          console.log('✅ [useHostProfile] Profil chargé depuis profiles:', baseProfile);
        }
      }

      if (!baseProfile) {
        console.log('⚠️ [useHostProfile] Profil introuvable pour hostId:', hostId);
        setHostProfile(null);
        setError('Profil indisponible');
        return null;
      }

      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id, title, slug, price_per_night, images, rating, review_count, host_id,
          locations:location_id ( name ),
          property_photos ( url, is_main, display_order )
        `)
        .eq('host_id', hostId)
        .eq('is_active', true)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (propertiesError) {
        console.error('❌ [useHostProfile] Erreur lors du chargement des propriétés:', propertiesError);
      } else {
        console.log('✅ [useHostProfile] Propriétés chargées:', properties?.length || 0);
      }

      const propertiesList = properties || [];
      const propertyIds = propertiesList.map((p) => p.id);

      let totalReviews = 0;
      let averageRating = 0;

      if (propertyIds.length > 0) {
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select('rating, approved')
          .in('property_id', propertyIds)
          .eq('approved', true);

        if (reviewsError) {
          console.error('❌ [useHostProfile] Erreur lors du chargement des avis:', reviewsError);
          totalReviews = propertiesList.reduce((sum, prop) => sum + (prop.review_count || 0), 0);
          const propertiesWithRating = propertiesList.filter((prop) => prop.rating && prop.rating > 0);
          averageRating =
            propertiesWithRating.length > 0
              ? propertiesWithRating.reduce((sum, prop) => sum + (prop.rating || 0), 0) /
                propertiesWithRating.length
              : 0;
        } else {
          const approvedReviews = reviews || [];
          totalReviews = approvedReviews.length;
          averageRating =
            totalReviews > 0
              ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
              : 0;
        }
      }

      const totalProperties = propertiesList.length;

      const enrichedProfile = {
        ...baseProfile,
        properties: propertiesList,
        total_reviews: totalReviews,
        average_rating: Math.round(averageRating * 10) / 10,
        total_properties: totalProperties,
      };

      setHostProfile(enrichedProfile);
      hostProfileCache.set(hostId, { profile: enrichedProfile, at: Date.now() });
      return enrichedProfile;
    } catch (err) {
      console.error('❌ [useHostProfile] Erreur lors du chargement du profil hôte:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    hostProfile,
    loading,
    error,
    getHostProfile,
  };
};
