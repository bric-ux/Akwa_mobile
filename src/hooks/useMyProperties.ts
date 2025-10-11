import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Property } from './useProperties';

export const useMyProperties = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getMyProperties = async (): Promise<Property[]> => {
    if (!user) {
      setError('Vous devez être connecté');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          cities (
            id,
            name,
            region,
            country
          )
        `)
        .eq('host_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        setError('Erreur lors du chargement de vos propriétés');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error in getMyProperties:', err);
      setError('Erreur lors du chargement de vos propriétés');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateProperty = async (propertyId: string, updates: Partial<Property>) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', propertyId)
        .eq('host_id', user.id);

      if (error) {
        console.error('Error updating property:', error);
        setError('Erreur lors de la mise à jour de la propriété');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const hideProperty = async (propertyId: string) => {
    return updateProperty(propertyId, { is_active: false });
  };

  const showProperty = async (propertyId: string) => {
    return updateProperty(propertyId, { is_active: true });
  };

  const deleteProperty = async (propertyId: string) => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier s'il y a des réservations en cours
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('property_id', propertyId)
        .in('status', ['pending', 'confirmed']);

      if (bookingsError) {
        console.error('Error checking bookings:', bookingsError);
        setError('Erreur lors de la vérification des réservations');
        return { success: false };
      }

      if (bookings && bookings.length > 0) {
        setError('Impossible de supprimer une propriété avec des réservations en cours');
        return { success: false };
      }

      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId)
        .eq('host_id', user.id);

      if (error) {
        console.error('Error deleting property:', error);
        setError('Erreur lors de la suppression de la propriété');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getPropertyBookings = async (propertyId: string) => {
    if (!user) {
      setError('Vous devez être connecté');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching property bookings:', error);
        setError('Erreur lors du chargement des réservations');
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    if (!user) {
      setError('Vous devez être connecté');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier que la réservation appartient à une propriété de l'utilisateur
      const { data: booking, error: checkError } = await supabase
        .from('bookings')
        .select(`
          id,
          properties!inner(host_id)
        `)
        .eq('id', bookingId)
        .eq('properties.host_id', user.id)
        .single();

      if (checkError || !booking) {
        setError('Réservation non trouvée ou non autorisée');
        return { success: false };
      }

      const { error } = await supabase
        .from('bookings')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) {
        console.error('Error updating booking status:', error);
        setError('Erreur lors de la mise à jour du statut');
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    getMyProperties,
    updateProperty,
    hideProperty,
    showProperty,
    deleteProperty,
    getPropertyBookings,
    updateBookingStatus,
    loading,
    error,
  };
};

