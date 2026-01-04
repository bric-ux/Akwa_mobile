import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_DATES_KEY = 'search_dates';

export interface SearchDates {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  babies?: number;
}

export const useSearchDates = () => {
  const [searchDates, setSearchDates] = useState<SearchDates>({});
  const [loading, setLoading] = useState(true);

  // Charger les dates sauvegardées au démarrage
  useEffect(() => {
    loadSearchDates();
  }, []);

  const loadSearchDates = async () => {
    try {
      setLoading(true);
      const saved = await AsyncStorage.getItem(SEARCH_DATES_KEY);
      console.log('📅 Tentative de chargement des dates depuis AsyncStorage:', saved);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSearchDates(parsed);
        console.log('📅 Dates de recherche chargées avec succès:', parsed);
      } else {
        console.log('📅 Aucune date sauvegardée trouvée');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSearchDates = async (dates: SearchDates) => {
    try {
      const datesToSave = JSON.stringify(dates);
      await AsyncStorage.setItem(SEARCH_DATES_KEY, datesToSave);
      setSearchDates(dates);
      console.log('📅 Dates de recherche sauvegardées avec succès:', dates);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des dates:', error);
    }
  };

  const clearSearchDates = async () => {
    try {
      await AsyncStorage.removeItem(SEARCH_DATES_KEY);
      setSearchDates({});
      console.log('📅 Dates de recherche supprimées');
    } catch (error) {
      console.error('Erreur lors de la suppression des dates:', error);
    }
  };

  return {
    searchDates,
    saveSearchDates,
    clearSearchDates,
    loading,
  };
};

