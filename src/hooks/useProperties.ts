import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Property, SearchFilters, Amenity } from '../types';

/** Date de référence pour le prix affiché en liste : arrivée recherchée ou aujourd’hui */
function getRefDateStrForListPricing(filters?: SearchFilters): string {
  if (filters?.checkIn) {
    const ci = filters.checkIn as string | Date;
    if (typeof ci === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ci)) return ci;
    const d = new Date(ci);
    if (Number.isNaN(d.getTime())) {
      const t = new Date();
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
import { getAmenityIcon } from '../utils/amenityIcons';
import { calculateDistance, isWithinRadius } from '../utils/distance';
import { log, logError, logWarn } from '../utils/logger';
import { getPricesForDateBatch } from '../utils/priceCalculator';

// Fonction helper pour calculer rating et review_count depuis les avis approuvés
const calculateRatingFromReviews = async (propertyId: string): Promise<{ rating: number; review_count: number }> => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating, approved')
      .eq('property_id', propertyId)
      .eq('approved', true);

    if (error) {
      logError('❌ Erreur lors du calcul du rating:', error);
      return { rating: 0, review_count: 0 };
    }

    const approvedReviews = reviews || [];
    const reviewCount = approvedReviews.length;
    const rating = reviewCount > 0
      ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
      : 0;

    return {
      rating: Math.round(rating * 100) / 100,
      review_count: reviewCount
    };
  } catch (err) {
    logError('❌ Erreur lors du calcul du rating:', err);
    return { rating: 0, review_count: 0 };
  }
};

// Fonction optimisée pour calculer les ratings de plusieurs propriétés en une seule requête
const calculateRatingsFromReviewsBatch = async (propertyIds: string[]): Promise<Map<string, { rating: number; review_count: number }>> => {
  if (propertyIds.length === 0) {
    return new Map();
  }

  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('property_id, rating, approved')
      .in('property_id', propertyIds)
      .eq('approved', true);

    if (error) {
      logError('❌ Erreur lors du calcul batch des ratings:', error);
      // Fallback: retourner des valeurs par défaut pour toutes les propriétés
      const result = new Map<string, { rating: number; review_count: number }>();
      propertyIds.forEach(id => result.set(id, { rating: 0, review_count: 0 }));
      return result;
    }

    // Grouper les avis par property_id et calculer les moyennes
    const ratingsMap = new Map<string, { rating: number; review_count: number }>();
    
    // Initialiser toutes les propriétés avec des valeurs par défaut
    propertyIds.forEach(id => {
      ratingsMap.set(id, { rating: 0, review_count: 0 });
    });

    // Grouper les avis par property_id
    const reviewsByProperty = new Map<string, number[]>();
    (reviews || []).forEach(review => {
      if (!reviewsByProperty.has(review.property_id)) {
        reviewsByProperty.set(review.property_id, []);
      }
      reviewsByProperty.get(review.property_id)!.push(review.rating);
    });

    // Calculer les moyennes
    reviewsByProperty.forEach((ratings, propertyId) => {
      const reviewCount = ratings.length;
      const rating = reviewCount > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / reviewCount
        : 0;
      
      ratingsMap.set(propertyId, {
        rating: Math.round(rating * 100) / 100,
        review_count: reviewCount
      });
    });

    return ratingsMap;
  } catch (err) {
    logError('❌ Erreur lors du calcul batch des ratings:', err);
    // Fallback: retourner des valeurs par défaut
    const result = new Map<string, { rating: number; review_count: number }>();
    propertyIds.forEach(id => result.set(id, { rating: 0, review_count: 0 }));
    return result;
  }
};

type UsePropertiesOptions = { source?: 'home' | 'search' };

export const useProperties = (options?: UsePropertiesOptions) => {
  const source: 'home' | 'search' = options?.source ?? 'search';
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache simple pour éviter les requêtes répétées
  const [cache, setCache] = useState<Map<string, Property[]>>(new Map());

  // Cache pour les équipements (éviter de les charger à chaque fois)
  const [amenitiesCache, setAmenitiesCache] = useState<Map<string, { id: string; name: string; icon: string }>>(new Map());

  // Charger le cache des équipements une seule fois
  useEffect(() => {
    const loadAmenitiesCache = async () => {
      try {
        log('🔄 [useProperties] Chargement initial du cache des équipements...');
        const { data: amenities, error } = await supabase
          .from('property_amenities')
          .select('id, name');
        
        if (error) {
          logError('❌ [useProperties] Erreur lors du chargement du cache:', error);
          throw error;
        }
        
        if (amenities && amenities.length > 0) {
          const cache = new Map<string, { id: string; name: string; icon: string }>();
          amenities.forEach(amenity => {
            // Indexer par ID (UUID)
            cache.set(amenity.id, {
              id: amenity.id,
              name: amenity.name,
              icon: getAmenityIcon(amenity.name)
            });
            // Aussi indexer par nom en minuscules pour faciliter la recherche
            cache.set(amenity.name.toLowerCase(), {
              id: amenity.id,
              name: amenity.name,
              icon: getAmenityIcon(amenity.name)
            });
          });
          setAmenitiesCache(cache);
          log('✅ [useProperties] Cache des équipements chargé:', amenities.length, 'équipements');
        } else {
          logWarn('⚠️ [useProperties] Aucun équipement trouvé dans property_amenities');
        }
      } catch (error) {
        logError('❌ [useProperties] Erreur lors du chargement du cache des équipements:', error);
      }
    };
    
    loadAmenitiesCache();
  }, []);

  // Fonction pour mapper les équipements depuis la base de données (par ID ou nom)
  const mapAmenities = useCallback(async (amenityIdsOrNames: string[] | null) => {
    log('🔄 [mapAmenities] Input:', {
      amenityIdsOrNames,
      isArray: Array.isArray(amenityIdsOrNames),
      length: Array.isArray(amenityIdsOrNames) ? amenityIdsOrNames.length : 'N/A',
      type: typeof amenityIdsOrNames
    });
    
    if (!amenityIdsOrNames || !Array.isArray(amenityIdsOrNames) || amenityIdsOrNames.length === 0) {
      console.log('⚠️ [mapAmenities] Input invalide ou vide, retour []');
      return [];
    }

    try {
      // Toujours s'assurer que le cache est chargé (même s'il est vide, le recharger)
      if (amenitiesCache.size === 0) {
        console.log('🔄 [mapAmenities] Chargement du cache des équipements...');
        const { data: amenities, error } = await supabase
          .from('property_amenities')
          .select('id, name');

        if (error) {
          console.error('❌ [mapAmenities] Erreur lors du chargement du cache:', error);
          throw error;
        }

        if (amenities && amenities.length > 0) {
          const cache = new Map<string, { id: string; name: string; icon: string }>();
          amenities.forEach(amenity => {
            cache.set(amenity.id, {
              id: amenity.id,
              name: amenity.name,
              icon: getAmenityIcon(amenity.name)
            });
            // Aussi indexer par nom (insensible à la casse) pour faciliter la recherche
            cache.set(amenity.name.toLowerCase(), {
              id: amenity.id,
              name: amenity.name,
              icon: getAmenityIcon(amenity.name)
            });
          });
          setAmenitiesCache(cache);
          console.log('✅ [mapAmenities] Cache des équipements chargé:', cache.size / 2, 'équipements');
        } else {
          console.warn('⚠️ [mapAmenities] Aucun équipement trouvé dans property_amenities');
        }
      }

      // Vérifier si c'est un UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const result = amenityIdsOrNames
        .map(idOrName => {
          // Si c'est un UUID, chercher dans le cache par ID
          if (uuidRegex.test(idOrName)) {
            const cached = amenitiesCache.get(idOrName);
            if (cached) {
              return cached;
            }
            // UUID non trouvé dans le cache, ignorer
            return null;
          }
          
          // Sinon, c'est un nom - chercher dans le cache par nom (insensible à la casse)
          // D'abord essayer de trouver par la clé en minuscules (si on a indexé par nom)
          const cachedByName = amenitiesCache.get(idOrName.toLowerCase());
          if (cachedByName) {
            console.log('✅ [mapAmenities] Trouvé dans cache par nom:', cachedByName);
            return cachedByName;
          }
          
          // Sinon, chercher dans les valeurs du cache
          const amenity = Array.from(amenitiesCache.values()).find(a => 
            a.name.toLowerCase() === idOrName.toLowerCase()
          );
          
          if (amenity) {
            console.log('✅ [mapAmenities] Trouvé dans cache par recherche:', amenity);
            return amenity;
          }
          
          // Si le nom n'est pas trouvé dans le cache, créer un objet équipement avec le nom
          // (cas où les équipements sont déjà des noms après conversion dans la DB)
          // IMPORTANT: Ne pas ignorer les équipements qui ne sont pas dans le cache
          const trimmedName = idOrName.trim();
          if (trimmedName) {
            const createdAmenity = {
              id: `name-${trimmedName}`,
              name: trimmedName,
              icon: getAmenityIcon(trimmedName)
            };
            console.log('✅ [mapAmenities] Créé équipement depuis nom (non trouvé dans cache):', createdAmenity);
            return createdAmenity;
          }
          
          return null;
        })
        .filter(Boolean) as { id: string; name: string; icon: string }[];
      
      console.log('✅ [mapAmenities] Résultat final:', {
        inputCount: amenityIdsOrNames.length,
        outputCount: result.length,
        result: result
      });
      
      return result;
    } catch (err) {
      console.error('❌ [mapAmenities] Erreur lors du chargement des équipements:', err);
      // En cas d'erreur, essayer de retourner les noms directement comme équipements
      if (!amenityIdsOrNames || !Array.isArray(amenityIdsOrNames)) {
        return [];
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return amenityIdsOrNames
        .filter(name => name && typeof name === 'string' && !uuidRegex.test(name))
        .map(name => ({
          id: `name-${name}`,
          name: name.trim(),
          icon: getAmenityIcon(name)
        }));
    }
  }, [amenitiesCache]);

  useEffect(() => {
    fetchProperties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]); // recharger si le contexte change

  const fetchProperties = useCallback(async (filters?: SearchFilters) => {
    try {
      setLoading(true);
      setError(null);

      // Créer une clé de cache basée sur les filtres
      const cacheKey = JSON.stringify({ source, filters: filters || {} });
      
      // Vérifier le cache d'abord
      if (cache.has(cacheKey)) {
        setProperties(cache.get(cacheKey)!);
        setLoading(false);
        return;
      }

      // Récupérer les location_ids à filtrer
      let locationIds: string[] | null = null;
      
      // Recherche par ville
      if (filters?.city) {
        const searchTerm = filters.city.trim();
        const { data: cityData } = await supabase
          .from('locations')
          .select('id')
          .eq('type', 'city')
          .ilike('name', `%${searchTerm}%`);
        
        if (cityData && cityData.length > 0) {
          // C'est une ville, récupérer tous les enfants (communes, quartiers)
          const cityIds = cityData.map(c => c.id);
          
          // Étape 1: Récupérer les communes (enfants directs de la ville)
          const { data: communeLocations } = await supabase
            .from('locations')
            .select('id')
            .in('parent_id', cityIds)
            .eq('type', 'commune');
          
          const communeIds = (communeLocations || []).map(l => l.id);
          
          // Étape 2: Récupérer les quartiers (enfants des communes)
          let neighborhoodIds: string[] = [];
          if (communeIds.length > 0) {
            const { data: neighborhoodLocations } = await supabase
              .from('locations')
              .select('id')
              .in('parent_id', communeIds)
              .eq('type', 'neighborhood');
            
            neighborhoodIds = (neighborhoodLocations || []).map(l => l.id);
          }
          
          // Inclure les villes, les communes ET les quartiers
          locationIds = [...cityIds, ...communeIds, ...neighborhoodIds];
          
          console.log(`✅ Ville trouvée: ${cityIds.length} ville(s), ${communeIds.length} commune(s), ${neighborhoodIds.length} quartier(s) (total: ${locationIds.length} locations) pour "${searchTerm}"`);
        } else {
          // Chercher dans les communes
          const { data: communeData } = await supabase
            .from('locations')
            .select('id, type, parent_id')
            .eq('type', 'commune')
            .ilike('name', `%${searchTerm}%`);
          
          if (communeData && communeData.length > 0) {
            // C'est une commune, récupérer la commune ET tous ses quartiers
            const communeIds = communeData.map(c => c.id);
            
            const { data: neighborhoodLocations } = await supabase
              .from('locations')
              .select('id')
              .in('parent_id', communeIds)
              .eq('type', 'neighborhood');
            
            const neighborhoodIds = (neighborhoodLocations || []).map(l => l.id);
            
            // Inclure les communes ET les quartiers
            locationIds = [...communeIds, ...neighborhoodIds];
            
            console.log(`✅ Commune trouvée: ${communeIds.length} commune(s), ${neighborhoodIds.length} quartier(s) (total: ${locationIds.length} locations) pour "${searchTerm}"`);
          } else {
            // Chercher dans les quartiers
            const { data: neighborhoodData } = await supabase
              .from('locations')
              .select('id')
              .eq('type', 'neighborhood')
              .ilike('name', `%${searchTerm}%`);
            
            if (neighborhoodData && neighborhoodData.length > 0) {
              locationIds = neighborhoodData.map(l => l.id);
              console.log(`✅ Quartier trouvé: ${locationIds.length} quartier(s) pour "${searchTerm}"`);
            }
          }
        }
        
        if (!locationIds || locationIds.length === 0) {
          console.log(`❌ Aucune localisation trouvée pour "${searchTerm}"`);
          setProperties([]);
          setLoading(false);
          return;
        }
      }

      // Query properties avec nouvelle structure locations
      let query = supabase
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
            is_main,
            created_at
          )
        `)
        .eq('is_active', true)
        .eq('is_hidden', false);

      // Accueil (Explorer/Home) : masquer uniquement certaines annonces sur la home
      if (source === 'home') {
        query = query.eq('hide_from_home', false);
      }

      // Appliquer le filtre location_id si présent
      if (locationIds && locationIds.length > 0) {
        query = query
          .in('location_id', locationIds)
          .not('location_id', 'is', null);
      }

      if (filters?.guests) {
        query = query.gte('max_guests', filters.guests);
      }

      if (filters?.priceMin) {
        query = query.gte('price_per_night', filters.priceMin);
      }

      if (filters?.priceMax) {
        query = query.lte('price_per_night', filters.priceMax);
      }

      if (filters?.propertyType && ['apartment', 'house', 'villa', 'eco_lodge', 'other'].includes(filters.propertyType)) {
        query = query.eq('property_type', filters.propertyType as any);
      }

      // Filtres pour les équipements (recherche dans les amenities)
      // Support des anciens filtres booléens pour compatibilité
      if (filters?.wifi) {
        query = query.contains('amenities', ['WiFi gratuit']);
      }
      if (filters?.parking) {
        query = query.contains('amenities', ['Parking gratuit']);
      }
      if (filters?.pool) {
        query = query.contains('amenities', ['Piscine']);
      }
      if (filters?.airConditioning) {
        query = query.contains('amenities', ['Climatisation']);
      }
      
      // Optimisation : limiter les résultats et trier par pertinence
      const { data, error } = await query
        .order('price_per_night', { ascending: true })
        .limit(100); // Augmenter la limite pour permettre le filtrage côté client

      if (error) {
        throw error;
      }

      // Log pour déboguer les propriétés retournées
      console.log('🔍 Propriétés retournées par la requête:', data?.length || 0);
      if (data && data.length > 0) {
        data.forEach((prop, index) => {
          console.log(`   ${index + 1}. ${prop.title} - Active: ${prop.is_active}, Masquée: ${prop.is_hidden}`);
        });
      }

      // Filtrer par équipements si spécifié (filtrage côté client pour "ET" logique)
      let filteredData = data || [];
      if (filters?.amenities && filters.amenities.length > 0) {
        filteredData = filteredData.filter((property) => {
          const propertyAmenities = property.amenities || [];
          // Vérifier que tous les équipements sélectionnés sont présents
          return filters.amenities!.every(selectedAmenity => 
            propertyAmenities.includes(selectedAmenity)
          );
        });
        console.log(`🔍 Filtrage par équipements: ${data?.length || 0} → ${filteredData.length} propriétés`);
      }

      // Filtrer et calculer les distances si recherche par rayon
      let propertiesWithDistance = filteredData;
      if (filters?.centerLat && filters?.centerLng && filters?.radiusKm) {
        
        propertiesWithDistance = filteredData
          .map((property) => {
            const location = (property as any).locations;
            const propertyLat = location?.latitude || property.latitude;
            const propertyLng = location?.longitude || property.longitude;
            
            if (!propertyLat || !propertyLng) {
              return null; // Propriété sans coordonnées
            }
            
            const distance = calculateDistance(
              filters.centerLat!,
              filters.centerLng!,
              propertyLat,
              propertyLng
            );
            
            const withinRadius = isWithinRadius(
              filters.centerLat!,
              filters.centerLng!,
              propertyLat,
              propertyLng,
              filters.radiusKm!
            );
            
            return withinRadius ? { ...property, distance } : null;
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity)); // Trier par distance croissante
        
        console.log(`📍 Filtrage par rayon ${filters.radiusKm}km: ${filteredData.length} → ${propertiesWithDistance.length} propriétés`);
      }
      
      filteredData = propertiesWithDistance;

      // Filtrer par disponibilité si des dates sont spécifiées
      if (filters?.checkIn && filters?.checkOut && filteredData.length > 0) {
        console.log(`📅 Filtrage par disponibilité: ${filters.checkIn} - ${filters.checkOut}`);
        
        // Normaliser les dates au format YYYY-MM-DD (sans décalage de fuseau horaire)
        const normalizeDate = (date: string | Date | null | undefined): string => {
          if (!date) return '';
          if (typeof date === 'string') {
            // Si c'est déjà au format YYYY-MM-DD, le retourner tel quel
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
            // Sinon, parser la date et utiliser les composants locaux pour éviter le décalage UTC
            const dateObj = new Date(date);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          // Si c'est un objet Date, utiliser les composants locaux
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        const normalizedCheckIn = normalizeDate(filters.checkIn);
        const normalizedCheckOut = normalizeDate(filters.checkOut);
        
        console.log(`📅 Dates normalisées: ${normalizedCheckIn} - ${normalizedCheckOut}`);
        
        const availableProperties = [];
        
        for (const property of filteredData) {
          try {
            // Récupérer les réservations qui bloquent les dates (seulement confirmed pour la recherche)
            // Les réservations pending ne bloquent pas les dates dans la recherche (comme sur le site web)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            const { data: bookings, error: bookingsError } = await supabase
              .from('bookings')
              .select('check_in_date, check_out_date, status')
              .eq('property_id', property.id)
              .eq('status', 'confirmed') // Seulement les réservations confirmées bloquent les dates
              .gte('check_out_date', todayStr);
            
            if (bookingsError) {
              console.error(`❌ Erreur lors de la vérification des réservations pour ${property.id}:`, bookingsError);
              // En cas d'erreur, inclure la propriété pour ne pas la masquer par erreur
              availableProperties.push(property);
              continue;
            }
            
            // Récupérer les dates bloquées manuellement
            const { data: blockedDates, error: blockedError } = await supabase
              .from('blocked_dates')
              .select('start_date, end_date, reason')
              .eq('property_id', property.id);
            
            if (blockedError) {
              console.error(`❌ Erreur lors de la vérification des dates bloquées pour ${property.id}:`, blockedError);
            }
            
            // Combiner toutes les périodes indisponibles
            const unavailableDates = [
              ...(bookings || []).map(booking => ({
                start_date: booking.check_in_date,
                end_date: booking.check_out_date,
                reason: 'Réservé'
              })),
              ...(blockedDates || []).map(blocked => ({
                start_date: blocked.start_date,
                end_date: blocked.end_date,
                reason: blocked.reason || 'Bloqué manuellement'
              }))
            ];
            
            // Vérifier si les dates demandées chevauchent une période indisponible
            // Formule standard de chevauchement: checkIn < end_date ET checkOut > start_date
            const hasConflict = unavailableDates.some(({ start_date, end_date }) => {
              const normalizedStart = normalizeDate(start_date);
              const normalizedEnd = normalizeDate(end_date);
              
              // Deux plages se chevauchent si: checkIn < end_date ET checkOut > start_date
              const hasOverlap = normalizedCheckIn < normalizedEnd && normalizedCheckOut > normalizedStart;
              
              if (hasOverlap) {
                console.log(`🚫 Propriété ${property.id} (${property.title}) indisponible:`, {
                  requested: { checkIn: normalizedCheckIn, checkOut: normalizedCheckOut },
                  blocked: { start_date: normalizedStart, end_date: normalizedEnd }
                });
              }
              
              return hasOverlap;
            });
            
            if (!hasConflict) {
              availableProperties.push(property);
            }
          } catch (error) {
            console.error(`❌ Erreur lors de la vérification de disponibilité pour ${property.id}:`, error);
            // En cas d'erreur, inclure la propriété pour ne pas la masquer par erreur
            availableProperties.push(property);
          }
        }
        
        console.log(`📅 Filtrage par disponibilité: ${filteredData.length} → ${availableProperties.length} propriétés disponibles`);
        filteredData = availableProperties;
      }

      // Optimisation: Calculer tous les ratings en une seule requête batch
      const propertyIds = (filteredData || []).map(p => p.id);
      const ratingsMap = await calculateRatingsFromReviewsBatch(propertyIds);

      // Transformer les données avec les équipements
      const transformedProperties = await Promise.all(
        (filteredData || []).map(async (property) => {
          const mappedAmenities = await mapAmenities(property.amenities);
          console.log(`🏠 ${property.title} - Équipements:`, property.amenities, '→ Mappés:', mappedAmenities);
          
          // Ajouter les équipements personnalisés s'ils existent
          const customAmenitiesList = property.custom_amenities && Array.isArray(property.custom_amenities) 
            ? property.custom_amenities.map((name: string) => ({
                id: `custom-${name}`,
                name: name.trim(),
                icon: '➕'
              }))
            : [];
          
          const allAmenities = [...mappedAmenities, ...customAmenitiesList];
          console.log(`💰 ${property.title} - Réductions:`, {
            discount_enabled: property.discount_enabled,
            discount_min_nights: property.discount_min_nights,
            discount_percentage: property.discount_percentage,
            long_stay_discount_enabled: property.long_stay_discount_enabled,
            long_stay_discount_min_nights: property.long_stay_discount_min_nights,
            long_stay_discount_percentage: property.long_stay_discount_percentage
          });
          
          // Récupérer le rating calculé depuis le batch (ou utiliser celui de la DB)
          const calculatedRating = ratingsMap.get(property.id) || { rating: 0, review_count: 0 };
          
          // Utiliser les valeurs calculées (ou celles de la DB si elles sont plus récentes)
          const finalRating = calculatedRating.rating || property.rating || 0;
          const finalReviewCount = calculatedRating.review_count || property.review_count || 0;


          // Traiter les photos catégorisées
          const categorizedPhotos = property.property_photos || [];
          const sortedPhotos = categorizedPhotos.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
          
          // Créer un tableau d'images pour la compatibilité avec l'ancien système
          const imageUrls = sortedPhotos.map((photo: any) => photo.url);
          
          // Si pas de photos catégorisées, utiliser l'ancien système
          const fallbackImages = property.images || [];
          const finalImages = imageUrls.length > 0 ? imageUrls : fallbackImages;

          // Debug pour la propriété "haut standing"
          if (property.title && property.title.toLowerCase().includes('haut standing')) {
            console.log('🏠 useProperties - Transformation des données:', {
              title: property.title,
              categorizedPhotosRaw: categorizedPhotos,
              categorizedPhotosLength: categorizedPhotos.length,
              sortedPhotos: sortedPhotos,
              sortedPhotosLength: sortedPhotos.length,
              imageUrls: imageUrls,
              imageUrlsLength: imageUrls.length,
              fallbackImages: fallbackImages,
              fallbackImagesLength: fallbackImages.length,
              finalImages: finalImages,
              finalImagesLength: finalImages.length
            });
          }

          // Extraire les coordonnées de location
          const location = (property as any).locations;
          const latitude = location?.latitude || property.latitude;
          const longitude = location?.longitude || property.longitude;

          const transformedProperty = {
            ...property,
            images: finalImages, // Pour compatibilité avec l'ancien système
            photos: sortedPhotos, // Nouveau système de photos catégorisées
            price_per_night: property.price_per_night || Math.floor(Math.random() * 50000) + 10000, // Prix entre 10k et 60k FCFA
            rating: Math.round(finalRating * 100) / 100, // Note finale (calculée ou de base)
            review_count: finalReviewCount, // Nombre d'avis final
            amenities: allAmenities,
            custom_amenities: property.custom_amenities || [],
            // Inclure les champs de règles et horaires
            house_rules: property.house_rules || '',
            check_in_time: property.check_in_time || null,
            check_out_time: property.check_out_time || null,
            address_details: property.address_details || '',
            host_guide: property.host_guide || '',
            // Inclure les réductions (courte durée et long séjour)
            discount_enabled: property.discount_enabled || false,
            discount_min_nights: property.discount_min_nights || null,
            discount_percentage: property.discount_percentage || null,
            long_stay_discount_enabled: property.long_stay_discount_enabled || false,
            long_stay_discount_min_nights: property.long_stay_discount_min_nights || null,
            long_stay_discount_percentage: property.long_stay_discount_percentage || null,
            // Extraire et mapper location
            location: location ? {
              id: location.id,
              name: location.name,
              type: location.type,
              latitude: location.latitude,
              longitude: location.longitude,
              parent_id: location.parent_id
            } : undefined,
            // Extraire les coordonnées directement sur la propriété pour compatibilité
            latitude: latitude,
            longitude: longitude,
            // Garder locations pour compatibilité
            locations: location,
            // Distance calculée si recherche par rayon
            distance: (property as any).distance
          };

          // Log pour déboguer les images
          console.log(`🏠 ${property.title} - Images transformées:`, {
            imageCount: finalImages.length,
            firstImage: finalImages[0],
            hasPhotos: categorizedPhotos.length > 0
          });

          return transformedProperty;
        })
      );

      console.log('🎯 Propriétés transformées:', transformedProperties.length);

      const refDate = getRefDateStrForListPricing(filters);
      const baseMap = new Map(
        transformedProperties.map((p: Property) => [p.id, p.price_per_night || 0])
      );
      const priceMap = await getPricesForDateBatch(
        transformedProperties.map((p: Property) => p.id),
        refDate,
        baseMap
      );
      const withDynamic: Property[] = transformedProperties.map((p: Property) => ({
        ...p,
        dynamic_price_today: priceMap.get(p.id) ?? p.price_per_night,
      }));

      setProperties(withDynamic);

      // Mettre en cache les résultats
      setCache(prev => new Map(prev).set(cacheKey, withDynamic));
      
    } catch (err) {
      console.error('Erreur lors du chargement des propriétés:', err);
      setError('Erreur lors du chargement des propriétés');
    } finally {
      setLoading(false);
    }
  }, [mapAmenities]); // Supprimer cache des dépendances pour éviter la boucle

  const getPropertyById = useCallback(async (id: string) => {
    try {
      console.log('🔍 Recherche de la propriété avec ID:', id);
      
      // Vérifier que l'ID est valide
      if (!id || typeof id !== 'string') {
        throw new Error('ID de propriété invalide');
      }

      // Vérifier la connexion Supabase
      if (!supabase) {
        throw new Error('Client Supabase non initialisé');
      }
      
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
            is_main,
            created_at
          )
        `)
        .eq('id', id)
        .maybeSingle(); // Utiliser maybeSingle() au lieu de single() - Permettre les propriétés masquées/inactives

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw new Error(`Erreur de base de données: ${error.message}`);
      }

      if (!data) {
        console.log('❌ Aucune propriété trouvée avec cet ID:', id);
        throw new Error('Propriété non trouvée');
      }

      console.log('✅ Propriété trouvée:', data.title, '- Active:', data.is_active, '- Masquée:', data.is_hidden);
      console.log('📊 Rating et review_count depuis la DB:', {
        rating: data.rating,
        review_count: data.review_count
      });

      // Traiter les photos (sans attendre le rating — en parallèle avec équipements)
      const categorizedPhotos = data.property_photos || [];
      const sortedPhotos = categorizedPhotos.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
      const imageUrls = sortedPhotos.map((photo: any) => photo.url);
      const fallbackImages = data.images || [];
      const finalImages = imageUrls.length > 0 ? imageUrls : fallbackImages;

      // Rating + équipements en parallèle (moins de latence à l’ouverture fiche propriété)
      const [calculatedRating, mappedAmenities] = await Promise.all([
        calculateRatingFromReviews(data.id),
        mapAmenities(data.amenities),
      ]);
      console.log('📊 Rating calculé depuis les avis:', calculatedRating);
      console.log('🔄 [getPropertyById] Après mapAmenities:', mappedAmenities?.length ?? 0, 'équipements');

      const finalRating = calculatedRating.rating || data.rating || 0;
      const finalReviewCount = calculatedRating.review_count || data.review_count || 0;
      const customAmenitiesList = data.custom_amenities && Array.isArray(data.custom_amenities)
        ? data.custom_amenities.map((name: string) => ({
            id: `custom-${name}`,
            name: name.trim(),
            icon: '➕'
          }))
        : [];
      const allAmenities = [...mappedAmenities, ...customAmenitiesList];
      console.log('✅ [getPropertyById] Tous les équipements (standards + personnalisés):', allAmenities);
      
      // Extraire les coordonnées de location
      const location = (data as any).locations;
      let latitude = location?.latitude || data.latitude;
      let longitude = location?.longitude || data.longitude;
      
      // Si pas de coordonnées et qu'on a un location_id, utiliser la fonction RPC pour remonter la hiérarchie
      if ((!latitude || !longitude) && data.location_id) {
        try {
          console.log(`🔄 [getPropertyById] Récupération des coordonnées via RPC pour location_id: ${data.location_id}`);
          const { data: coords, error: coordsError } = await supabase
            .rpc('get_location_coordinates', { location_uuid: data.location_id });
          
          if (coordsError) {
            console.warn('⚠️ [getPropertyById] Erreur lors de la récupération des coordonnées via RPC:', coordsError);
          } else if (coords && coords.length > 0 && coords[0].latitude && coords[0].longitude) {
            latitude = coords[0].latitude;
            longitude = coords[0].longitude;
            console.log(`✅ [getPropertyById] Coordonnées récupérées via RPC: [${latitude}, ${longitude}]`);
          }
        } catch (error) {
          console.warn('⚠️ [getPropertyById] Erreur lors de la récupération des coordonnées via RPC:', error);
        }
      }
      
      // Debug pour vérifier les coordonnées
      if (!latitude && !longitude) {
        console.log(`⚠️ [getPropertyById] Propriété "${data.title}" sans coordonnées:`, {
          hasLocation: !!location,
          locationData: location,
          locationId: data.location_id,
          propertyLatitude: data.latitude,
          propertyLongitude: data.longitude
        });
      } else {
        console.log(`✅ [getPropertyById] Coordonnées finales pour "${data.title}": [${latitude}, ${longitude}]`);
      }

      // Debug pour vérifier les champs de règles et horaires
      console.log('🔍 [getPropertyById] Données brutes de la propriété:', {
        title: data.title,
        house_rules: data.house_rules,
        check_in_time: data.check_in_time,
        check_out_time: data.check_out_time,
        address_details: data.address_details,
        host_guide: data.host_guide,
        amenities: data.amenities,
        amenitiesType: typeof data.amenities,
        amenitiesIsArray: Array.isArray(data.amenities),
        amenitiesLength: Array.isArray(data.amenities) ? data.amenities.length : 'N/A',
        custom_amenities: data.custom_amenities,
        long_stay_discount_enabled: data.long_stay_discount_enabled,
        long_stay_discount_min_nights: data.long_stay_discount_min_nights,
        long_stay_discount_percentage: data.long_stay_discount_percentage,
        discount_enabled: data.discount_enabled,
        discount_min_nights: data.discount_min_nights,
        discount_percentage: data.discount_percentage
      });

      const transformedData = {
        ...data,
        images: finalImages, // Pour compatibilité avec l'ancien système
        photos: sortedPhotos, // Nouveau système de photos catégorisées
        price_per_night: data.price_per_night || Math.floor(Math.random() * 50000) + 10000,
        rating: finalRating > 0 ? Math.round(finalRating * 100) / 100 : 0, // Note finale depuis la DB (mise à jour par trigger)
        review_count: finalReviewCount, // Nombre d'avis final depuis la DB (mise à jour par trigger)
        amenities: allAmenities,
        custom_amenities: data.custom_amenities || [],
        // Inclure les champs de règles et horaires (s'assurer qu'ils ne sont pas undefined)
        house_rules: data.house_rules || '',
        check_in_time: data.check_in_time || null,
        check_out_time: data.check_out_time || null,
        address_details: data.address_details || '',
        host_guide: data.host_guide || '',
        // Inclure les réductions (courte durée et long séjour)
        discount_enabled: data.discount_enabled || false,
        discount_min_nights: data.discount_min_nights || null,
        discount_percentage: data.discount_percentage || null,
        long_stay_discount_enabled: data.long_stay_discount_enabled || false,
        long_stay_discount_min_nights: data.long_stay_discount_min_nights || null,
        long_stay_discount_percentage: data.long_stay_discount_percentage || null,
        // Extraire et mapper location
        location: location ? {
          id: location.id,
          name: location.name,
          type: location.type,
          latitude: location.latitude,
          longitude: location.longitude,
          parent_id: location.parent_id
        } : undefined,
        // Extraire les coordonnées directement sur la propriété pour compatibilité
        latitude: latitude,
        longitude: longitude,
        // Garder locations pour compatibilité
        locations: location
      };

      console.log('✅ Propriété transformée:', {
        title: transformedData.title,
        house_rules: transformedData.house_rules,
        check_in_time: transformedData.check_in_time,
        check_out_time: transformedData.check_out_time,
        amenitiesCount: transformedData.amenities?.length || 0,
        amenities: transformedData.amenities,
        long_stay_discount_enabled: transformedData.long_stay_discount_enabled,
        long_stay_discount_min_nights: transformedData.long_stay_discount_min_nights,
        long_stay_discount_percentage: transformedData.long_stay_discount_percentage,
        discount_enabled: transformedData.discount_enabled,
        discount_min_nights: transformedData.discount_min_nights,
        discount_percentage: transformedData.discount_percentage
      });
      return transformedData;
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement de la propriété:', err);
      
      // Gestion spécifique des erreurs réseau
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        throw new Error('Erreur de connexion réseau. Vérifiez votre connexion internet.');
      }
      
      // Gestion des erreurs Supabase
      if (err.message?.includes('JWT') || err.message?.includes('auth')) {
        throw new Error('Erreur d\'authentification. Veuillez vous reconnecter.');
      }
      
      // Erreur générique
      throw new Error(err.message || 'Impossible de charger la propriété');
    }
  }, [mapAmenities]);

  // Fonction pour forcer un rafraîchissement complet (ignore le cache)
  const refreshProperties = useCallback(async (filters?: SearchFilters) => {
    console.log('🔄 Rafraîchissement forcé des propriétés (cache ignoré)');
    
    try {
      setLoading(true);
      setError(null);

      // Créer une clé de cache basée sur les filtres
      const cacheKey = JSON.stringify(filters || {});
      
      // Supprimer l'entrée du cache pour forcer une nouvelle requête
      setCache(prevCache => {
        const newCache = new Map(prevCache);
        newCache.delete(cacheKey);
        return newCache;
      });

      // Récupérer les location_ids à filtrer
      let locationIds: string[] | null = null;
      
      // Recherche par ville
      if (filters?.city) {
        const searchTerm = filters.city.trim();
        const { data: cityData } = await supabase
          .from('locations')
          .select('id')
          .eq('type', 'city')
          .ilike('name', `%${searchTerm}%`);
        
        if (cityData && cityData.length > 0) {
          // C'est une ville, récupérer tous les enfants (communes, quartiers)
          const cityIds = cityData.map(c => c.id);
          
          // Étape 1: Récupérer les communes (enfants directs de la ville)
          const { data: communeLocations } = await supabase
            .from('locations')
            .select('id')
            .in('parent_id', cityIds)
            .eq('type', 'commune');
          
          const communeIds = (communeLocations || []).map(l => l.id);
          
          // Étape 2: Récupérer les quartiers (enfants des communes)
          let neighborhoodIds: string[] = [];
          if (communeIds.length > 0) {
            const { data: neighborhoodLocations } = await supabase
              .from('locations')
              .select('id')
              .in('parent_id', communeIds)
              .eq('type', 'neighborhood');
            
            neighborhoodIds = (neighborhoodLocations || []).map(l => l.id);
          }
          
          // Inclure les villes, les communes ET les quartiers
          locationIds = [...cityIds, ...communeIds, ...neighborhoodIds];
          
          console.log(`✅ Ville trouvée: ${cityIds.length} ville(s), ${communeIds.length} commune(s), ${neighborhoodIds.length} quartier(s) (total: ${locationIds.length} locations) pour "${searchTerm}"`);
        } else {
          // Chercher dans les communes
          const { data: communeData } = await supabase
            .from('locations')
            .select('id, type, parent_id')
            .eq('type', 'commune')
            .ilike('name', `%${searchTerm}%`);
          
          if (communeData && communeData.length > 0) {
            // C'est une commune, récupérer la commune ET tous ses quartiers
            const communeIds = communeData.map(c => c.id);
            
            const { data: neighborhoodLocations } = await supabase
              .from('locations')
              .select('id')
              .in('parent_id', communeIds)
              .eq('type', 'neighborhood');
            
            const neighborhoodIds = (neighborhoodLocations || []).map(l => l.id);
            
            // Inclure les communes ET les quartiers
            locationIds = [...communeIds, ...neighborhoodIds];
            
            console.log(`✅ Commune trouvée: ${communeIds.length} commune(s), ${neighborhoodIds.length} quartier(s) (total: ${locationIds.length} locations) pour "${searchTerm}"`);
          } else {
            // Chercher dans les quartiers
            const { data: neighborhoodData } = await supabase
              .from('locations')
              .select('id')
              .eq('type', 'neighborhood')
              .ilike('name', `%${searchTerm}%`);
            
            if (neighborhoodData && neighborhoodData.length > 0) {
              locationIds = neighborhoodData.map(l => l.id);
              console.log(`✅ Quartier trouvé: ${locationIds.length} quartier(s) pour "${searchTerm}"`);
            }
          }
        }
        
        if (!locationIds || locationIds.length === 0) {
          console.log(`❌ Aucune localisation trouvée pour "${searchTerm}"`);
          setProperties([]);
          setLoading(false);
          return;
        }
      }

      // Query properties avec nouvelle structure locations
      let query = supabase
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
            is_main,
            created_at
          )
        `)
        .eq('is_active', true)
        .eq('is_hidden', false);

      // Appliquer le filtre location_id si présent
      if (locationIds && locationIds.length > 0) {
        query = query
          .in('location_id', locationIds)
          .not('location_id', 'is', null);
      }

      // Appliquer les filtres d'équipements
      if (filters?.wifi) {
        query = query.contains('amenities', ['WiFi gratuit']);
      }
      if (filters?.parking) {
        query = query.contains('amenities', ['Parking gratuit']);
      }
      if (filters?.pool) {
        query = query.contains('amenities', ['Piscine']);
      }
      if (filters?.airConditioning) {
        query = query.contains('amenities', ['Climatisation']);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur lors du chargement des propriétés:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} propriété(s) chargée(s) (rafraîchissement forcé)`);

      // Optimisation: Calculer tous les ratings en une seule requête batch
      const propertyIds = (data || []).map(p => p.id);
      const ratingsMap = await calculateRatingsFromReviewsBatch(propertyIds);

      // Transformer les données avec les équipements
      const transformedData = await Promise.all(
        (data || []).map(async (property) => {
          // Récupérer le rating calculé depuis le batch (ou utiliser celui de la DB)
          const calculatedRating = ratingsMap.get(property.id) || { rating: 0, review_count: 0 };
          
          // Utiliser les valeurs calculées (ou celles de la DB si elles sont plus récentes)
          const finalRating = calculatedRating.rating || property.rating || 0;
          const finalReviewCount = calculatedRating.review_count || property.review_count || 0;

          // Traiter les photos catégorisées
          const categorizedPhotos = property.property_photos || [];
          const sortedPhotos = categorizedPhotos.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
          
          // Créer un tableau d'images pour la compatibilité avec l'ancien système
          const imageUrls = sortedPhotos.map((photo: any) => photo.url);
          
          // Si pas de photos catégorisées, utiliser l'ancien système
          const fallbackImages = property.images || [];
          const finalImages = imageUrls.length > 0 ? imageUrls : fallbackImages;

          // Debug pour la propriété "haut standing" dans refreshProperties
          if (property.title && property.title.toLowerCase().includes('haut standing')) {
            console.log('🔄 refreshProperties - Transformation des données:', {
              title: property.title,
              categorizedPhotosRaw: categorizedPhotos,
              categorizedPhotosLength: categorizedPhotos.length,
              sortedPhotos: sortedPhotos,
              sortedPhotosLength: sortedPhotos.length,
              imageUrls: imageUrls,
              imageUrlsLength: imageUrls.length,
              fallbackImages: fallbackImages,
              fallbackImagesLength: fallbackImages.length,
              finalImages: finalImages,
              finalImagesLength: finalImages.length
            });
          }

          // Ajouter les équipements personnalisés s'ils existent
          const mappedAmenitiesForRefresh = await mapAmenities(property.amenities);
          const customAmenitiesListForRefresh = property.custom_amenities && Array.isArray(property.custom_amenities)
            ? property.custom_amenities.map((name: string) => ({
                id: `custom-${name}`,
                name: name.trim(),
                icon: '➕'
              }))
            : [];
          const allAmenitiesForRefresh = [...mappedAmenitiesForRefresh, ...customAmenitiesListForRefresh];
          
          // Extraire les coordonnées de location
          const location = (property as any).locations;
          const latitude = location?.latitude || property.latitude;
          const longitude = location?.longitude || property.longitude;

          const transformedProperty = {
            ...property,
            images: finalImages, // Pour compatibilité avec l'ancien système
            photos: sortedPhotos, // Nouveau système de photos catégorisées
            price_per_night: property.price_per_night || Math.floor(Math.random() * 50000) + 10000,
            rating: Math.round(finalRating * 100) / 100, // Note finale (calculée ou de base)
            review_count: finalReviewCount, // Nombre d'avis final
            amenities: allAmenitiesForRefresh,
            custom_amenities: property.custom_amenities || [],
            // Inclure les champs de règles et horaires
            house_rules: property.house_rules || '',
            check_in_time: property.check_in_time || null,
            check_out_time: property.check_out_time || null,
            address_details: property.address_details || '',
            host_guide: property.host_guide || '',
            // Inclure les réductions (courte durée et long séjour)
            discount_enabled: property.discount_enabled || false,
            discount_min_nights: property.discount_min_nights || null,
            discount_percentage: property.discount_percentage || null,
            long_stay_discount_enabled: property.long_stay_discount_enabled || false,
            long_stay_discount_min_nights: property.long_stay_discount_min_nights || null,
            long_stay_discount_percentage: property.long_stay_discount_percentage || null,
            // Extraire et mapper location
            location: location ? {
              id: location.id,
              name: location.name,
              type: location.type,
              latitude: location.latitude,
              longitude: location.longitude,
              parent_id: location.parent_id
            } : undefined,
            // Extraire les coordonnées directement sur la propriété pour compatibilité
            latitude: latitude,
            longitude: longitude,
            // Garder locations pour compatibilité
            locations: location
          };


          return transformedProperty;
        })
      );

      const refDate = getRefDateStrForListPricing(filters);
      const baseMapRefresh = new Map(
        transformedData.map((p: Property) => [p.id, p.price_per_night || 0])
      );
      const priceMapRefresh = await getPricesForDateBatch(
        transformedData.map((p: Property) => p.id),
        refDate,
        baseMapRefresh
      );
      const withDynamicRefresh: Property[] = transformedData.map((p: Property) => ({
        ...p,
        dynamic_price_today: priceMapRefresh.get(p.id) ?? p.price_per_night,
      }));

      // Mettre à jour le cache avec les nouvelles données
      setCache(prevCache => {
        const newCache = new Map(prevCache);
        newCache.set(cacheKey, withDynamicRefresh);
        return newCache;
      });

      setProperties(withDynamicRefresh);
    } catch (err) {
      console.error('❌ Erreur lors du rafraîchissement:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [mapAmenities]); // Supprimer fetchProperties des dépendances

  return {
    properties,
    loading,
    error,
    fetchProperties,
    getPropertyById,
    refreshProperties, // Nouvelle fonction pour rafraîchissement forcé
    refetch: () => {
      setLoading(true);
      setProperties([]);
    }
  };
};
