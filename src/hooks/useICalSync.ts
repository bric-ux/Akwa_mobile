import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

export interface ICalLink {
  id: string;
  property_id: string;
  platform: string;
  import_url: string | null;
  export_url: string | null;
  last_synced_at: string | null;
  sync_enabled: boolean;
}

export const useICalSync = () => {
  const [loading, setLoading] = useState(false);

  const getICalLinks = async (propertyId: string): Promise<ICalLink[]> => {
    try {
      const { data, error } = await supabase
        .from('ical_sync_links')
        .select('*')
        .eq('property_id', propertyId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching iCal links:', error);
      return [];
    }
  };

  const addICalLink = async (
    propertyId: string,
    platform: string,
    importUrl: string
  ): Promise<{ success: boolean }> => {
    setLoading(true);
    try {
      // Pour l'export URL, on utilise une URL générique (sera géré côté serveur)
      // Sur mobile, on ne peut pas générer une URL d'export dynamique
      const exportUrl = null; // L'export sera géré par le backend si nécessaire

      const { error } = await supabase
        .from('ical_sync_links')
        .upsert({
          property_id: propertyId,
          platform,
          import_url: importUrl,
          export_url: exportUrl,
          sync_enabled: true,
        }, {
          onConflict: 'property_id,platform'
        });

      if (error) throw error;

      Alert.alert('Succès', 'Lien iCal ajouté avec succès');
      return { success: true };
    } catch (error: any) {
      console.error('Error adding iCal link:', error);
      Alert.alert('Erreur', 'Erreur lors de l\'ajout du lien iCal');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async (propertyId: string, platform: string): Promise<{ success: boolean }> => {
    setLoading(true);
    try {
      // Appeler la fonction edge pour synchroniser
      const { data, error } = await supabase.functions.invoke('sync-ical', {
        body: { propertyId, platform }
      });

      if (error) throw error;

      // Mettre à jour la date de dernière synchronisation
      await supabase
        .from('ical_sync_links')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('property_id', propertyId)
        .eq('platform', platform);

      Alert.alert('Succès', `Calendrier ${platform} synchronisé avec succès`);
      return { success: true };
    } catch (error: any) {
      console.error('Error syncing calendar:', error);
      Alert.alert('Erreur', 'Erreur lors de la synchronisation');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const removeICalLink = async (linkId: string): Promise<{ success: boolean }> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ical_sync_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      Alert.alert('Succès', 'Lien iCal supprimé');
      return { success: true };
    } catch (error: any) {
      console.error('Error removing iCal link:', error);
      Alert.alert('Erreur', 'Erreur lors de la suppression');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getICalLinks,
    addICalLink,
    syncCalendar,
    removeICalLink,
  };
};

