import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

interface DynamicPriceEntry {
  id: string;
  start_date: string;
  end_date: string;
  price_per_night: number;
}

export const useDynamicPricing = () => {
  const [loading, setLoading] = useState(false);

  const getDynamicPrices = async (propertyId: string): Promise<DynamicPriceEntry[]> => {
    try {
      const { data, error } = await supabase
        .from('property_dynamic_pricing')
        .select('*')
        .eq('property_id', propertyId)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching dynamic prices:', error);
      return [];
    }
  };

  const setPriceForPeriod = async (
    propertyId: string,
    startDate: string,
    endDate: string,
    pricePerNight: number
  ) => {
    setLoading(true);
    try {
      // Vérifier s'il y a des prix existants qui chevauchent cette période
      const { data: allPrices, error: checkError } = await supabase
        .from('property_dynamic_pricing')
        .select('id, start_date, end_date')
        .eq('property_id', propertyId);

      if (checkError) {
        console.error('Error checking overlapping prices:', checkError);
      }

      // Filtrer les prix qui chevauchent
      const overlappingPrices = (allPrices || []).filter(price => {
        const priceStart = new Date(price.start_date);
        const priceEnd = new Date(price.end_date);
        const newStart = new Date(startDate);
        const newEnd = new Date(endDate);
        
        // Vérifier le chevauchement : les périodes se chevauchent si
        // start_date <= newEnd ET end_date >= newStart
        return priceStart <= newEnd && priceEnd >= newStart;
      });

      // Supprimer les prix qui chevauchent
      if (overlappingPrices.length > 0) {
        const idsToDelete = overlappingPrices.map(p => p.id);
        const { error: deleteError } = await supabase
          .from('property_dynamic_pricing')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('Error deleting overlapping prices:', deleteError);
        }
      }

      // Insérer le nouveau prix
      const { error } = await supabase
        .from('property_dynamic_pricing')
        .insert({
          property_id: propertyId,
          start_date: startDate,
          end_date: endDate,
          price_per_night: pricePerNight,
        });

      if (error) throw error;

      Alert.alert('Succès', 'Le prix pour cette période a été défini avec succès.');
      return { success: true };
    } catch (error: any) {
      console.error('Error setting dynamic price:', error);
      Alert.alert('Erreur', error.message || 'Impossible de définir le prix.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const deleteDynamicPrice = async (priceId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('property_dynamic_pricing')
        .delete()
        .eq('id', priceId);

      if (error) throw error;

      Alert.alert('Succès', 'Le prix personnalisé a été supprimé.');
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting dynamic price:', error);
      Alert.alert('Erreur', 'Impossible de supprimer le prix.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const getPriceForDate = async (propertyId: string, date: string): Promise<number | null> => {
    try {
      // Vérifier s'il y a un prix dynamique pour cette date
      const { data, error } = await supabase
        .from('property_dynamic_pricing')
        .select('price_per_night')
        .eq('property_id', propertyId)
        .lte('start_date', date)  // start_date <= date
        .gte('end_date', date)     // end_date >= date
        .maybeSingle();

      if (error) throw error;
      return data?.price_per_night || null;
    } catch (error) {
      console.error('Error getting price for date:', error);
      return null;
    }
  };

  return {
    loading,
    getDynamicPrices,
    setPriceForPeriod,
    deleteDynamicPrice,
    getPriceForDate,
  };
};


