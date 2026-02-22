import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import type { MonthlyRentalListing } from '../types';

export interface MonthlyRentalListingInput {
  title: string;
  description: string | null;
  location: string;
  location_id?: string | null;
  property_type?: string | null;
  surface_m2: number;
  number_of_rooms: number;
  bedrooms: number;
  bathrooms: number;
  is_furnished: boolean;
  monthly_rent_price: number;
  security_deposit?: number | null;
  minimum_duration_months?: number | null;
  charges_included: boolean;
  address_details?: string | null;
  images?: string[];
  categorized_photos?: unknown;
  amenities?: string[];
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
}

export const useMonthlyRentalListings = (hostId: string | undefined) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getListingById = useCallback(
    async (listingId: string): Promise<MonthlyRentalListing | null> => {
      const uid = hostId || user?.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from('monthly_rental_listings')
        .select('*')
        .eq('id', listingId)
        .eq('owner_id', uid)
        .single();
      if (error || !data) return null;
      return data as MonthlyRentalListing;
    },
    [hostId, user?.id]
  );

  const getMyListings = useCallback(async (): Promise<MonthlyRentalListing[]> => {
    const uid = hostId || user?.id;
    if (!uid) return [];

    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('monthly_rental_listings')
        .select('*')
        .eq('owner_id', uid)
        .order('updated_at', { ascending: false });

      if (err) {
        setError(err.message);
        return [];
      }
      return (data || []) as MonthlyRentalListing[];
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      return [];
    } finally {
      setLoading(false);
    }
  }, [hostId, user?.id]);

  const createListing = useCallback(
    async (input: MonthlyRentalListingInput): Promise<{ success: boolean; id?: string; error?: string }> => {
      const uid = hostId || user?.id;
      if (!uid) return { success: false, error: 'Non connecté' };

      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('monthly_rental_listings')
          .insert({
            owner_id: uid,
            title: input.title,
            description: input.description || null,
            location: input.location,
            location_id: input.location_id || null,
            property_type: input.property_type || null,
            surface_m2: input.surface_m2,
            number_of_rooms: input.number_of_rooms,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            is_furnished: input.is_furnished,
            monthly_rent_price: input.monthly_rent_price,
            security_deposit: input.security_deposit ?? null,
            minimum_duration_months: input.minimum_duration_months ?? null,
            charges_included: input.charges_included,
            address_details: input.address_details || null,
            images: input.images || [],
            categorized_photos: input.categorized_photos || null,
            amenities: input.amenities || [],
            status: input.status || 'draft',
          })
          .select('id')
          .single();

        if (err) {
          setError(err.message);
          return { success: false, error: err.message };
        }
        return { success: true, id: data?.id };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [hostId, user?.id]
  );

  const updateListing = useCallback(
    async (listingId: string, input: Partial<MonthlyRentalListingInput>): Promise<{ success: boolean; error?: string }> => {
      const uid = hostId || user?.id;
      if (!uid) return { success: false, error: 'Non connecté' };

      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('monthly_rental_listings')
          .update({
            ...input,
            updated_at: new Date().toISOString(),
          })
          .eq('id', listingId)
          .eq('owner_id', uid);

        if (err) {
          setError(err.message);
          return { success: false, error: err.message };
        }
        return { success: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [hostId, user?.id]
  );

  const submitForApproval = useCallback(
    async (listingId: string, _hasPaid?: boolean): Promise<{ success: boolean; error?: string }> => {
      const uid = hostId || user?.id;
      if (!uid) return { success: false, error: 'Non connecté' };
      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('monthly_rental_listings')
          .update({
            status: 'pending',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', listingId)
          .eq('owner_id', uid);
        if (err) {
          setError(err.message);
          return { success: false, error: err.message };
        }
        return { success: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [hostId, user?.id]
  );

  const deleteListing = useCallback(
    async (listingId: string): Promise<{ success: boolean; error?: string }> => {
      const uid = hostId || user?.id;
      if (!uid) return { success: false, error: 'Non connecté' };

      setLoading(true);
      setError(null);
      try {
        const { error: err } = await supabase
          .from('monthly_rental_listings')
          .delete()
          .eq('id', listingId)
          .eq('owner_id', uid);

        if (err) {
          setError(err.message);
          return { success: false, error: err.message };
        }
        return { success: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [hostId, user?.id]
  );

  return {
    getListingById,
    getMyListings,
    createListing,
    updateListing,
    submitForApproval,
    deleteListing,
    loading,
    error,
  };
};
