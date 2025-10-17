import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Property, SearchFilters, Amenity } from '../types';
import { getAmenityIcon } from '../utils/amenityIcons';

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache simple pour éviter les requêtes répétées
  const [cache, setCache] = useState<Map<string, Property[]>>(new Map());

  // Fonction pour mapper les équipements depuis la base de données
  const mapAmenities = useCallback(async (amenityNames: string[] | null) => {
    if (!amenityNames || !Array.isArray(amenityNames) || amenityNames.length === 0) {
      return [];
    }

    try {
      const { data: amenities, error } = await supabase
        .from('property_amenities')
        .select('*');

      if (error) throw error;

      return amenityNames
        .map(name => {
          const amenity = amenities?.find(a => a.name === name);
          return amenity ? {
            id: amenity.id,
            name: amenity.name,
            icon: getAmenityIcon(amenity.name)
          } : null;
        })
        .filter(Boolean) as { id: string; name: string; icon: string }[];
    } catch (err) {
      console.error('Erreur lors du chargement des équipements:', err);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, []); // Garder un tableau vide pour le chargement initial

  const fetchProperties = useCallback(async (filters?: SearchFilters) => {
    try {
      setLoading(true);
      setError(null);

      // Créer une clé de cache basée sur les filtres
      const cacheKey = JSON.stringify(filters || {});
      
      // Vérifier le cache d'abord
      if (cache.has(cacheKey)) {
        setProperties(cache.get(cacheKey)!);
        setLoading(false);
        return;
      }

      // Query properties with cities - seulement les propriétés actives et non masquées
      let query = supabase
        .from('properties')
        .select(`
          *,
          cities:city_id (
            id,
            name,
            region
          ),
          reviews!property_id (
            rating,
            created_at
          )
        `)
        .eq('is_active', true)
        .eq('is_hidden', false);

      // Appliquer les filtres côté serveur
      if (filters?.city) {
        const searchTerm = filters.city.trim();
        
        // D'abord, chercher dans les villes
        const { data: cityExists } = await supabase
          .from('cities')
          .select('id, name')
          .ilike('name', searchTerm)
          .single();
        
        let cityId = cityExists?.id;
        
        if (!cityId) {
          // Chercher directement dans les communes (priorité avant les quartiers)
          const { data: communeExists } = await supabase
            .from('neighborhoods')
            .select('city_id, name, commune')
            .ilike('commune', searchTerm)
            .single();
          
          if (communeExists) {
            cityId = communeExists.city_id;
            console.log(`✅ Commune trouvée: "${communeExists.commune}" pour la recherche "${searchTerm}"`);
          }
        }
        
        if (!cityId) {
          // Chercher dans les quartiers (nom du quartier)
          const { data: neighborhoodExists } = await supabase
            .from('neighborhoods')
            .select('city_id, name, commune')
            .ilike('name', searchTerm)
            .single();
          
          if (neighborhoodExists) {
            cityId = neighborhoodExists.city_id;
            console.log(`✅ Quartier trouvé: "${neighborhoodExists.name}" (${neighborhoodExists.commune}) pour la recherche "${searchTerm}"`);
          }
        }
        
        if (cityExists) {
          console.log(`✅ Ville trouvée: "${cityExists.name}" pour la recherche "${searchTerm}"`);
        }
        
        if (!cityId) {
          console.log(`⚠️ Aucune ville, quartier ou commune trouvé pour "${searchTerm}"`);
          setProperties([]);
          setLoading(false);
          return;
        }
        
        query = query
          .select(`
            *,
            cities!inner(id, name, region)
          `)
          .eq('cities.id', cityId);
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
        .limit(50);

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

      // Transformer les données avec les équipements
      const transformedProperties = await Promise.all(
        (data || []).map(async (property) => {
          const mappedAmenities = await mapAmenities(property.amenities);
          console.log(`🏠 ${property.title} - Équipements:`, property.amenities, '→ Mappés:', mappedAmenities);
          console.log(`💰 ${property.title} - Réductions:`, {
            discount_enabled: property.discount_enabled,
            discount_min_nights: property.discount_min_nights,
            discount_percentage: property.discount_percentage
          });
          
          // Calculer la vraie moyenne des avis et le nombre d'avis
          const reviews = property.reviews || [];
          const reviewCount = reviews.length;
          const averageRating = reviewCount > 0 
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount 
            : 0;

          // Si on a des avis calculés en base, les utiliser en priorité
          const finalRating = property.rating && property.review_count ? property.rating : averageRating;
          const finalReviewCount = property.review_count || reviewCount;

          // Debug pour la propriété "haut standing"
          if (property.title && property.title.toLowerCase().includes('haut standing')) {
            console.log('🏠 Debug propriété haut standing:', {
              title: property.title,
              propertyId: property.id,
              propertyRating: property.rating,
              propertyReviewCount: property.review_count,
              reviews: reviews,
              reviewCount: reviewCount,
              averageRating: averageRating,
              finalRating: finalRating,
              finalReviewCount: finalReviewCount,
              calculatedRating: Math.round(finalRating * 100) / 100,
              rawPropertyKeys: Object.keys(property),
              hasReviewsProperty: 'reviews' in property,
              reviewsType: typeof property.reviews,
              reviewsIsArray: Array.isArray(property.reviews)
            });
          }

          return {
            ...property,
            images: property.images || [],
            price_per_night: property.price_per_night || Math.floor(Math.random() * 50000) + 10000, // Prix entre 10k et 60k FCFA
            rating: Math.round(finalRating * 100) / 100, // Note finale (calculée ou de base)
            review_count: finalReviewCount, // Nombre d'avis final
            amenities: mappedAmenities
          };
        })
      );

      console.log('🎯 Propriétés transformées:', transformedProperties.length);

      setProperties(transformedProperties);
      
      // Mettre en cache les résultats
      setCache(prev => new Map(prev).set(cacheKey, transformedProperties));
      
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
          cities:city_id (
            id,
            name,
            region
          ),
          reviews!property_id (
            rating,
            comment,
            created_at,
            reviewer_id
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

      // Calculer la vraie moyenne des avis et le nombre d'avis
      const reviews = data.reviews || [];
      const averageRating = reviews.length > 0 
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
        : 0;
      const reviewCount = reviews.length;

      // Si on a des avis calculés en base, les utiliser en priorité
      const finalRating = data.rating && data.review_count ? data.rating : averageRating;
      const finalReviewCount = data.review_count || reviewCount;

      // Transformer les données avec les équipements
      const transformedData = {
        ...data,
        images: data.images || [],
        price_per_night: data.price_per_night || Math.floor(Math.random() * 50000) + 10000,
        rating: Math.round(finalRating * 100) / 100, // Note finale (calculée ou de base)
        review_count: finalReviewCount, // Nombre d'avis final
        amenities: await mapAmenities(data.amenities)
      };

      console.log('✅ Propriété transformée:', transformedData.title);
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

      // Query properties with cities - seulement les propriétés actives et non masquées
      let query = supabase
        .from('properties')
        .select(`
          *,
          cities:city_id (
            id,
            name,
            region
          ),
          reviews!property_id (
            rating,
            created_at
          )
        `)
        .eq('is_active', true)
        .eq('is_hidden', false);

      // Appliquer les filtres côté serveur
      if (filters?.city) {
        const searchTerm = filters.city.trim();
        
        // D'abord, chercher dans les villes
        const { data: cityExists } = await supabase
          .from('cities')
          .select('id, name')
          .ilike('name', searchTerm)
          .single();
        
        // Si pas trouvé dans les villes, chercher dans les quartiers
        let cityId = cityExists?.id;
        
        if (!cityId) {
          const { data: neighborhoodExists } = await supabase
            .from('neighborhoods')
            .select('city_id, name, commune')
            .ilike('name', searchTerm)
            .single();
          
          if (neighborhoodExists) {
            cityId = neighborhoodExists.city_id;
            console.log(`✅ Quartier trouvé: "${neighborhoodExists.name}" (${neighborhoodExists.commune}) pour la recherche "${searchTerm}"`);
          }
        } else {
          console.log(`✅ Ville trouvée: "${cityExists.name}" pour la recherche "${searchTerm}"`);
        }
        
        if (!cityId) {
          console.log(`⚠️ Aucune ville ou quartier trouvé pour "${searchTerm}"`);
          setProperties([]);
          setLoading(false);
          return;
        }
        
        query = query
          .select(`
            *,
            cities!inner(id, name, region)
          `)
          .eq('city_id', cityId);
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

      // Transformer les données avec les équipements
      const transformedData = await Promise.all(
        (data || []).map(async (property) => {
          // Calculer la vraie moyenne des avis et le nombre d'avis
          const reviews = property.reviews || [];
          const reviewCount = reviews.length;
          const averageRating = reviewCount > 0 
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount 
            : 0;

          // Si on a des avis calculés en base, les utiliser en priorité
          const finalRating = property.rating && property.review_count ? property.rating : averageRating;
          const finalReviewCount = property.review_count || reviewCount;

          return {
            ...property,
            images: property.images || [],
            price_per_night: property.price_per_night || Math.floor(Math.random() * 50000) + 10000,
            rating: Math.round(finalRating * 100) / 100, // Note finale (calculée ou de base)
            review_count: finalReviewCount, // Nombre d'avis final
            amenities: await mapAmenities(property.amenities)
          };
        })
      );

      // Mettre à jour le cache avec les nouvelles données
      setCache(prevCache => {
        const newCache = new Map(prevCache);
        newCache.set(cacheKey, transformedData);
        return newCache;
      });

      setProperties(transformedData);
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
