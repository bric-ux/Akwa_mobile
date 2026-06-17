import { useCallback, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type {
  HotelEstablishment,
  HotelEstablishmentType,
  HotelRoomType,
} from '../types';
import { isVideoUrl } from '../utils/media';

const HOST_ESTABLISHMENT_SELECT = `
  id,
  host_id,
  title,
  slug,
  description,
  establishment_type,
  location_id,
  address,
  address_details,
  latitude,
  longitude,
  star_rating,
  amenities,
  images,
  check_in_time,
  check_out_time,
  cancellation_policy,
  house_rules,
  status,
  hidden_by_admin,
  rating,
  review_count,
  created_at,
  updated_at,
  locations:location_id(id, name, type, latitude, longitude),
  hotel_establishment_photos(id, url, category, display_order),
  hotel_room_types(
    id,
    establishment_id,
    name,
    room_category,
    description,
    max_guests,
    bedrooms,
    bathrooms,
    price_per_night,
    cleaning_fee,
    taxes_per_night,
    inventory_count,
    minimum_nights,
    amenities,
    images,
    sort_order,
    status,
    discount_enabled,
    discount_min_nights,
    discount_percentage,
    long_stay_discount_enabled,
    long_stay_discount_min_nights,
    long_stay_discount_percentage
  )
`;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function uniqueSlug(title: string): string {
  const base = slugify(title) || 'hotel';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export interface CreateEstablishmentInput {
  title: string;
  description?: string;
  establishment_type: HotelEstablishmentType;
  location_id?: string | null;
  address?: string;
  address_details?: string;
  star_rating?: number | null;
  amenities?: string[];
  imageUrls?: string[];
  check_in_time?: string;
  check_out_time?: string;
  cancellation_policy?: string;
  house_rules?: string;
  status?: 'draft' | 'active' | 'hidden';
}

export interface UpdateEstablishmentInput extends Partial<CreateEstablishmentInput> {
  imageUrls?: string[];
}

export interface CreateRoomTypeInput {
  establishment_id: string;
  name: string;
  room_category?: string;
  description?: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  price_per_night: number;
  cleaning_fee?: number;
  inventory_count: number;
  minimum_nights?: number;
  amenities?: string[];
  imageUrls?: string[];
  status?: 'active' | 'hidden';
  discount_enabled?: boolean;
  discount_min_nights?: number | null;
  discount_percentage?: number | null;
  long_stay_discount_enabled?: boolean;
  long_stay_discount_min_nights?: number | null;
  long_stay_discount_percentage?: number | null;
}

export interface UpdateRoomTypeInput extends Partial<Omit<CreateRoomTypeInput, 'establishment_id'>> {
  imageUrls?: string[];
}

async function syncEstablishmentPhotos(
  establishmentId: string,
  imageUrls: string[],
): Promise<void> {
  await (supabase as any)
    .from('hotel_establishment_photos')
    .delete()
    .eq('establishment_id', establishmentId);

  if (imageUrls.length === 0) return;

  const rows = imageUrls.map((url, index) => ({
    establishment_id: establishmentId,
    url,
    display_order: index,
    category: isVideoUrl(url) ? 'video' : 'autre',
  }));

  const { error } = await (supabase as any)
    .from('hotel_establishment_photos')
    .insert(rows);

  if (error) throw error;
}

export function useHostHotels() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMyEstablishments = useCallback(async (): Promise<HotelEstablishment[]> => {
    if (!user) return [];

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('hotel_establishments')
        .select(HOST_ESTABLISHMENT_SELECT)
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return (data ?? []) as HotelEstablishment[];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getEstablishmentById = useCallback(
    async (establishmentId: string): Promise<HotelEstablishment | null> => {
      if (!user) return null;

      try {
        const { data, error: fetchError } = await (supabase as any)
          .from('hotel_establishments')
          .select(HOST_ESTABLISHMENT_SELECT)
          .eq('id', establishmentId)
          .eq('host_id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        return (data as HotelEstablishment) ?? null;
      } catch (err) {
        console.error('[useHostHotels] getEstablishmentById', err);
        return null;
      }
    },
    [user],
  );

  const createEstablishment = useCallback(
    async (
      input: CreateEstablishmentInput,
      options?: { hostId?: string },
    ): Promise<{ success: boolean; establishmentId?: string; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Vous devez être connecté' };
      }

      const hostId = options?.hostId ?? user.id;

      setLoading(true);
      setError(null);

      try {
        const imageUrls = input.imageUrls ?? [];
        const payload = {
          host_id: hostId,
          title: input.title.trim(),
          slug: uniqueSlug(input.title),
          description: input.description?.trim() || null,
          establishment_type: input.establishment_type,
          location_id: input.location_id ?? null,
          address: input.address?.trim() || null,
          address_details: input.address_details?.trim() || null,
          star_rating: input.star_rating ?? null,
          amenities: input.amenities ?? [],
          images: imageUrls,
          check_in_time: input.check_in_time || null,
          check_out_time: input.check_out_time || null,
          cancellation_policy: input.cancellation_policy?.trim() || null,
          house_rules: input.house_rules?.trim() || null,
          status: input.status ?? 'draft',
        };

        const { data, error: insertError } = await (supabase as any)
          .from('hotel_establishments')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) throw insertError;

        const establishmentId = data.id as string;
        if (imageUrls.length > 0) {
          await syncEstablishmentPhotos(establishmentId, imageUrls);
        }

        return { success: true, establishmentId };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Impossible de créer l\'établissement';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const updateEstablishment = useCallback(
    async (
      establishmentId: string,
      input: UpdateEstablishmentInput,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Vous devez être connecté' };
      }

      setLoading(true);
      setError(null);

      try {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (input.title !== undefined) updates.title = input.title.trim();
        if (input.description !== undefined) updates.description = input.description?.trim() || null;
        if (input.establishment_type !== undefined) updates.establishment_type = input.establishment_type;
        if (input.location_id !== undefined) updates.location_id = input.location_id;
        if (input.address !== undefined) updates.address = input.address?.trim() || null;
        if (input.address_details !== undefined) {
          updates.address_details = input.address_details?.trim() || null;
        }
        if (input.star_rating !== undefined) updates.star_rating = input.star_rating;
        if (input.amenities !== undefined) updates.amenities = input.amenities;
        if (input.check_in_time !== undefined) updates.check_in_time = input.check_in_time || null;
        if (input.check_out_time !== undefined) updates.check_out_time = input.check_out_time || null;
        if (input.cancellation_policy !== undefined) {
          updates.cancellation_policy = input.cancellation_policy?.trim() || null;
        }
        if (input.house_rules !== undefined) updates.house_rules = input.house_rules?.trim() || null;
        if (input.status !== undefined) updates.status = input.status;
        if (input.imageUrls !== undefined) {
          updates.images = input.imageUrls;
          await syncEstablishmentPhotos(establishmentId, input.imageUrls);
        }

        const { error: updateError } = await (supabase as any)
          .from('hotel_establishments')
          .update(updates)
          .eq('id', establishmentId)
          .eq('host_id', user.id);

        if (updateError) throw updateError;
        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Impossible de mettre à jour';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const setEstablishmentStatus = useCallback(
    async (
      establishmentId: string,
      status: 'draft' | 'active' | 'hidden',
    ): Promise<{ success: boolean; error?: string }> => {
      return updateEstablishment(establishmentId, { status });
    },
    [updateEstablishment],
  );

  const createRoomType = useCallback(
    async (
      input: CreateRoomTypeInput,
    ): Promise<{ success: boolean; roomTypeId?: string; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Vous devez être connecté' };
      }

      setLoading(true);
      setError(null);

      try {
        const imageUrls = input.imageUrls ?? [];
        const { data: existing } = await (supabase as any)
          .from('hotel_room_types')
          .select('sort_order')
          .eq('establishment_id', input.establishment_id)
          .order('sort_order', { ascending: false })
          .limit(1);

        const nextOrder = ((existing?.[0]?.sort_order as number) ?? -1) + 1;

        const payload = {
          establishment_id: input.establishment_id,
          name: input.name.trim(),
          room_category: input.room_category || null,
          description: input.description?.trim() || null,
          max_guests: input.max_guests,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          price_per_night: input.price_per_night,
          cleaning_fee: input.cleaning_fee ?? 0,
          inventory_count: input.inventory_count,
          minimum_nights: input.minimum_nights ?? 1,
          amenities: input.amenities ?? [],
          images: imageUrls,
          sort_order: nextOrder,
          status: input.status ?? 'active',
          discount_enabled: input.discount_enabled ?? false,
          discount_min_nights: input.discount_min_nights ?? null,
          discount_percentage: input.discount_percentage ?? null,
          long_stay_discount_enabled: input.long_stay_discount_enabled ?? false,
          long_stay_discount_min_nights: input.long_stay_discount_min_nights ?? null,
          long_stay_discount_percentage: input.long_stay_discount_percentage ?? null,
        };

        const { data, error: insertError } = await (supabase as any)
          .from('hotel_room_types')
          .insert(payload)
          .select('id')
          .single();

        if (insertError) throw insertError;
        return { success: true, roomTypeId: data.id as string };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Impossible d\'ajouter la chambre';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const updateRoomType = useCallback(
    async (
      roomTypeId: string,
      establishmentId: string,
      input: UpdateRoomTypeInput,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Vous devez être connecté' };
      }

      setLoading(true);
      setError(null);

      try {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.room_category !== undefined) updates.room_category = input.room_category || null;
        if (input.description !== undefined) updates.description = input.description?.trim() || null;
        if (input.max_guests !== undefined) updates.max_guests = input.max_guests;
        if (input.bedrooms !== undefined) updates.bedrooms = input.bedrooms;
        if (input.bathrooms !== undefined) updates.bathrooms = input.bathrooms;
        if (input.price_per_night !== undefined) updates.price_per_night = input.price_per_night;
        if (input.cleaning_fee !== undefined) updates.cleaning_fee = input.cleaning_fee;
        if (input.inventory_count !== undefined) updates.inventory_count = input.inventory_count;
        if (input.minimum_nights !== undefined) updates.minimum_nights = input.minimum_nights;
        if (input.amenities !== undefined) updates.amenities = input.amenities;
        if (input.status !== undefined) updates.status = input.status;
        if (input.imageUrls !== undefined) updates.images = input.imageUrls;
        if (input.discount_enabled !== undefined) updates.discount_enabled = input.discount_enabled;
        if (input.discount_min_nights !== undefined) updates.discount_min_nights = input.discount_min_nights;
        if (input.discount_percentage !== undefined) updates.discount_percentage = input.discount_percentage;
        if (input.long_stay_discount_enabled !== undefined) {
          updates.long_stay_discount_enabled = input.long_stay_discount_enabled;
        }
        if (input.long_stay_discount_min_nights !== undefined) {
          updates.long_stay_discount_min_nights = input.long_stay_discount_min_nights;
        }
        if (input.long_stay_discount_percentage !== undefined) {
          updates.long_stay_discount_percentage = input.long_stay_discount_percentage;
        }

        const { error: updateError } = await (supabase as any)
          .from('hotel_room_types')
          .update(updates)
          .eq('id', roomTypeId)
          .eq('establishment_id', establishmentId);

        if (updateError) throw updateError;

        const { data: est } = await (supabase as any)
          .from('hotel_establishments')
          .select('host_id')
          .eq('id', establishmentId)
          .single();

        if (!est || est.host_id !== user.id) {
          return { success: false, error: 'Accès refusé' };
        }

        return { success: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Impossible de mettre à jour la chambre';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  const getRoomTypeById = useCallback(
    async (roomTypeId: string, establishmentId: string): Promise<HotelRoomType | null> => {
      if (!user) return null;

      try {
        const { data, error: fetchError } = await (supabase as any)
          .from('hotel_room_types')
          .select('*')
          .eq('id', roomTypeId)
          .eq('establishment_id', establishmentId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        return (data as HotelRoomType) ?? null;
      } catch (err) {
        console.error('[useHostHotels] getRoomTypeById', err);
        return null;
      }
    },
    [user],
  );

  return {
    loading,
    error,
    getMyEstablishments,
    getEstablishmentById,
    createEstablishment,
    updateEstablishment,
    setEstablishmentStatus,
    createRoomType,
    updateRoomType,
    getRoomTypeById,
  };
}
