import { supabase } from '../services/supabase';

/** Date locale → YYYY-MM-DD (aligné sur getPriceForDate). */
function toYyyyMmDd(date: string | Date): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return toYyyyMmDd(new Date());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const BATCH_CHUNK_SIZE = 80;

/**
 * Résout le prix affichable (dynamique si période couvrant la date, sinon prix de base) pour plusieurs propriétés en peu de requêtes.
 * Même règle que getPriceForDate : parmi les périodes qui couvrent la date, on prend celle avec start_date la plus ancienne.
 */
export const getPricesForDateBatch = async (
  propertyIds: string[],
  date: string | Date,
  basePriceByPropertyId: Map<string, number>
): Promise<Map<string, number>> => {
  const dateStr = toYyyyMmDd(date);
  const uniqueIds = [...new Set(propertyIds)];
  const out = new Map<string, number>();
  for (const id of uniqueIds) {
    out.set(id, basePriceByPropertyId.get(id) ?? 0);
  }
  if (uniqueIds.length === 0) return out;

  for (let i = 0; i < uniqueIds.length; i += BATCH_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_CHUNK_SIZE);
    const { data, error } = await supabase
      .from('property_dynamic_pricing')
      .select('property_id, price_per_night, start_date')
      .in('property_id', chunk)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr);

    if (error) {
      if (__DEV__) {
        console.warn('[getPricesForDateBatch]', error.message || error.code || String(error));
      }
      continue;
    }

    const rows = [...(data || [])].sort((a: { property_id: string; start_date: string }, b) => {
      if (a.property_id !== b.property_id) return String(a.property_id).localeCompare(String(b.property_id));
      return String(a.start_date).localeCompare(String(b.start_date));
    });

    const seenInChunk = new Set<string>();
    for (const row of rows) {
      const pid = String(row.property_id);
      if (seenInChunk.has(pid)) continue;
      seenInChunk.add(pid);
      const dyn = Number(row.price_per_night);
      if (!Number.isNaN(dyn) && dyn > 0) {
        out.set(pid, dyn);
      }
    }
  }

  return out;
};

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
    // .limit(1) requis : .maybeSingle() renvoie une erreur si >1 ligne (périodes qui se chevauchent)
    const { data, error } = await supabase
      .from('property_dynamic_pricing')
      .select('price_per_night')
      .eq('property_id', propertyId)
      .lte('start_date', dateStr) // start_date <= date
      .gte('end_date', dateStr) // end_date >= date
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn(
          '[getPriceForDate] dynamic pricing:',
          error.message || (error as { code?: string }).code || String(error)
        );
      }
      return basePrice;
    }

    return data?.price_per_night || basePrice;
  } catch (error) {
    if (__DEV__) console.warn('[getPriceForDate]', error);
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
      if (__DEV__) {
        console.warn(
          '[getAveragePriceForPeriod]',
          error.message || (error as { code?: string }).code || String(error)
        );
      }
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
    if (__DEV__) console.warn('[getAveragePriceForPeriod]', error);
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
      if (__DEV__) {
        console.warn(
          '[getDynamicPrices]',
          error.message || (error as { code?: string }).code || String(error)
        );
      }
      return [];
    }

    return data || [];
  } catch (error) {
    if (__DEV__) console.warn('[getDynamicPrices]', error);
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

