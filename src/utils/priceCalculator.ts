import { supabase } from '../services/supabase';

/**
 * Calcule le prix d'une propriété pour une date donnée en tenant compte des prix dynamiques
 * @param propertyId - ID de la propriété
 * @param date - Date pour laquelle calculer le prix (format YYYY-MM-DD ou Date)
 * @param basePrice - Prix de base de la propriété
 * @returns Prix à utiliser pour cette date
 */
export const getPriceForDate = async (
  propertyId: string,
  date: string | Date,
  basePrice: number
): Promise<number> => {
  try {
    // Convertir la date en format YYYY-MM-DD si nécessaire
    let dateStr: string;
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = date;
    }

    // Vérifier s'il y a un prix dynamique pour cette date
    const { data, error } = await supabase
      .from('property_dynamic_pricing')
      .select('price_per_night')
      .eq('property_id', propertyId)
      .lte('start_date', dateStr)  // start_date <= date
      .gte('end_date', dateStr)     // end_date >= date
      .maybeSingle();

    if (error) {
      console.error('Error fetching dynamic price:', error);
      return basePrice;
    }

    return data?.price_per_night || basePrice;
  } catch (error) {
    console.error('Error in getPriceForDate:', error);
    return basePrice;
  }
};

/**
 * Calcule le prix moyen pour une période en tenant compte des prix dynamiques
 * @param propertyId - ID de la propriété
 * @param startDate - Date de début (format YYYY-MM-DD ou Date)
 * @param endDate - Date de fin (format YYYY-MM-DD ou Date)
 * @param basePrice - Prix de base de la propriété
 * @returns Prix moyen pour la période
 */
export const getAveragePriceForPeriod = async (
  propertyId: string,
  startDate: string | Date,
  endDate: string | Date,
  basePrice: number
): Promise<number> => {
  try {
    // Convertir les dates en format YYYY-MM-DD si nécessaire
    let startDateStr: string;
    let endDateStr: string;

    if (startDate instanceof Date) {
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      startDateStr = `${year}-${month}-${day}`;
    } else {
      startDateStr = startDate;
    }

    if (endDate instanceof Date) {
      const year = endDate.getFullYear();
      const month = String(endDate.getMonth() + 1).padStart(2, '0');
      const day = String(endDate.getDate()).padStart(2, '0');
      endDateStr = `${year}-${month}-${day}`;
    } else {
      endDateStr = endDate;
    }

    // Récupérer tous les prix dynamiques qui chevauchent la période
    const { data: dynamicPrices, error } = await supabase
      .from('property_dynamic_pricing')
      .select('start_date, end_date, price_per_night')
      .eq('property_id', propertyId)
      .or(`and(start_date.lte.${endDateStr},end_date.gte.${startDateStr})`);

    if (error) {
      console.error('Error fetching dynamic prices:', error);
      return basePrice;
    }

    if (!dynamicPrices || dynamicPrices.length === 0) {
      return basePrice;
    }

    // Calculer le prix moyen en tenant compte des périodes
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let totalPrice = 0;
    let totalDays = 0;

    // Pour chaque jour de la période
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Trouver le prix pour ce jour
      const priceForDay = dynamicPrices.find(price => {
        return dateStr >= price.start_date && dateStr <= price.end_date;
      });

      totalPrice += priceForDay ? priceForDay.price_per_night : basePrice;
      totalDays++;

      // Passer au jour suivant
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalDays > 0 ? Math.round(totalPrice / totalDays) : basePrice;
  } catch (error) {
    console.error('Error in getAveragePriceForPeriod:', error);
    return basePrice;
  }
};

/**
 * Récupère tous les prix dynamiques d'une propriété
 * @param propertyId - ID de la propriété
 * @returns Liste des prix dynamiques
 */
export const getDynamicPrices = async (propertyId: string) => {
  try {
    const { data, error } = await supabase
      .from('property_dynamic_pricing')
      .select('*')
      .eq('property_id', propertyId)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching dynamic prices:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getDynamicPrices:', error);
    return [];
  }
};

/**
 * Formate un prix en FCFA avec séparateurs de milliers
 * Compatible avec le site web : formate directement sans division
 * @param price - Prix en FCFA (integer) - comme sur le site web
 * @returns Prix formaté (ex: "15 000 FCFA")
 */
export const formatPrice = (price: number): string => {
  if (price === null || price === undefined) return '0 FCFA';
  // Formatage direct comme sur le site web (pas de division par 100)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

/**
 * Formate un montant déjà en FCFA (alias de formatPrice pour compatibilité)
 * @param amount - Montant en FCFA (integer)
 * @returns Montant formaté (ex: "18 000 FCFA")
 */
export const formatAmount = (amount: number): string => {
  return formatPrice(amount);
};

