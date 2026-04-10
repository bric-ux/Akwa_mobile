import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { Property } from './useProperties';
import { useEmailService } from './useEmailService';
import { bumpPublicPropertyListVersion } from '../utils/publicPropertyListVersion';

export const useMyProperties = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { sendBookingCancelled } = useEmailService();

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
          locations:location_id (
            id,
            name,
            type,
            latitude,
            longitude,
            parent_id
          ),
          property_photos (
            id,
            url,
            category,
            display_order,
            is_main
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

  const updateProperty = async (
    propertyId: string,
    updates: Partial<Property>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      const msg = 'Vous devez être connecté';
      setError(msg);
      return { success: false, error: msg };
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
        const msg =
          error.message?.includes('masquée par l') || error.message?.includes('administrateurs')
            ? error.message
            : 'Erreur lors de la mise à jour de la propriété';
        setError(msg);
        return { success: false, error: msg };
      }

      if (updates.is_active !== undefined || updates.is_hidden !== undefined) {
        bumpPublicPropertyListVersion();
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error:', err);
      const msg = 'Une erreur inattendue est survenue';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const hideProperty = async (propertyId: string) => {
    return updateProperty(propertyId, { is_active: false });
  };

  const showProperty = async (
    propertyId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      const msg = 'Vous devez être connecté';
      setError(msg);
      return { success: false, error: msg };
    }
    const { data: row, error: fetchErr } = await supabase
      .from('properties')
      .select('hidden_by_admin')
      .eq('id', propertyId)
      .eq('host_id', user.id)
      .maybeSingle();
    if (fetchErr) {
      console.error('showProperty:', fetchErr);
      const msg = 'Impossible de vérifier le statut de la propriété';
      setError(msg);
      return { success: false, error: msg };
    }
    if (row?.hidden_by_admin) {
      const msg =
        'Cette annonce a été masquée par l’administration. Seul un administrateur peut la réactiver.';
      setError(msg);
      return { success: false, error: msg };
    }
    return updateProperty(propertyId, { is_active: true });
  };


  const deleteProperty = async (propertyId: string) => {
    if (!user) {
      const errorMsg = 'Vous devez être connecté';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier que la propriété appartient bien à l'utilisateur
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('id, host_id, title')
        .eq('id', propertyId)
        .single();

      if (propertyError) {
        console.error('❌ Error checking property:', propertyError);
        const errorMsg = `Propriété introuvable: ${propertyError.message}`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (!property) {
        const errorMsg = 'Propriété introuvable';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      if (property.host_id !== user.id) {
        const errorMsg = 'Vous n\'êtes pas autorisé à supprimer cette propriété';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Vérifier s'il y a des réservations en attente (pending) et les annuler automatiquement
      const { data: pendingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, status, check_in_date, check_out_date, guests_count, total_price, guest_id')
        .eq('property_id', propertyId)
        .eq('status', 'pending');

      if (bookingsError) {
        console.error('❌ Error checking bookings:', bookingsError);
        const errorMsg = `Erreur lors de la vérification des réservations: ${bookingsError.message}`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Annuler automatiquement les réservations en attente
      if (pendingBookings && pendingBookings.length > 0) {
        console.log(`🔄 Annulation automatique de ${pendingBookings.length} réservation(s) en attente...`);
        
        for (const booking of pendingBookings) {
          // Récupérer le profil de l'invité pour l'email
          let guestEmail: string | null = null;
          let guestName = 'Invité';
          
          try {
            const { data: guestProfile, error: profileError } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('user_id', booking.guest_id)
              .maybeSingle();
            
            if (!profileError && guestProfile) {
              guestEmail = guestProfile.email || null;
              guestName = `${guestProfile.first_name || ''} ${guestProfile.last_name || ''}`.trim() || 'Invité';
            }
          } catch (profileErr) {
            console.warn('⚠️ Impossible de récupérer le profil de l\'invité:', profileErr);
          }
          
          // Mettre à jour le statut de la réservation
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ 
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', booking.id);

          if (updateError) {
            console.error(`❌ Erreur lors de l'annulation de la réservation ${booking.id}:`, updateError);
            // Continuer même si l'annulation échoue
          } else {
            // Envoyer un email d'annulation à l'invité si possible
            if (guestEmail) {
              try {
                await sendBookingCancelled(
                  guestEmail,
                  guestName,
                  property.title,
                  booking.check_in_date,
                  booking.check_out_date,
                  booking.guests_count,
                  booking.total_price
                );
                console.log(`✅ Email d'annulation envoyé à ${guestEmail}`);
              } catch (emailError) {
                console.error('❌ Erreur lors de l\'envoi de l\'email d\'annulation:', emailError);
                // Ne pas bloquer la suppression si l'email échoue
              }
            }
          }
        }
        
        console.log(`✅ ${pendingBookings.length} réservation(s) en attente annulée(s) automatiquement`);
      }

      // Vérifier s'il y a des réservations confirmées (on empêche la suppression dans ce cas)
      const { data: confirmedBookings, error: confirmedBookingsError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('property_id', propertyId)
        .eq('status', 'confirmed');

      if (confirmedBookingsError) {
        console.error('❌ Error checking confirmed bookings:', confirmedBookingsError);
        // Ne pas bloquer la suppression si on ne peut pas vérifier
      } else if (confirmedBookings && confirmedBookings.length > 0) {
        const errorMsg = `Impossible de supprimer une propriété avec ${confirmedBookings.length} réservation(s) confirmée(s). Veuillez d'abord annuler ces réservations.`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Supprimer la propriété
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId)
        .eq('host_id', user.id);

      if (error) {
        console.error('❌ Error deleting property:', error);
        const errorMsg = `Erreur lors de la suppression: ${error.message || error.code || 'Erreur inconnue'}`;
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('✅ Propriété supprimée avec succès');
      bumpPublicPropertyListVersion();
      return { success: true };
    } catch (err: any) {
      console.error('❌ Unexpected error:', err);
      const errorMsg = `Une erreur inattendue est survenue: ${err?.message || 'Erreur inconnue'}`;
      setError(errorMsg);
      return { success: false, error: errorMsg };
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


