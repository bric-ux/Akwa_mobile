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
  }, []);

  const fetchProperties = async (filters?: SearchFilters) => {
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

      // Query properties with cities
      let query = supabase
        .from('properties')
        .select(`
          *,
          cities:city_id (
            id,
            name,
            region
          )
        `)
        .eq('is_active', true)
        .eq('is_hidden', false);

      // Appliquer les filtres côté serveur
      if (filters?.city) {
        // D'abord vérifier si la ville existe
        const { data: cityExists } = await supabase
          .from('cities')
          .select('id, name')
          .eq('name', filters.city)
          .single();
        
        if (!cityExists) {
          console.log(`⚠️ Ville "${filters.city}" non trouvée dans la base de données`);
          setProperties([]);
          setLoading(false);
          return;
        }
        
        query = query
          .select(`
            *,
            cities!inner(id, name, region, country)
          `)
          .eq('cities.name', filters.city);
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
          
          return {
            ...property,
            images: property.images || [],
            price_per_night: property.price_per_night || Math.floor(Math.random() * 50000) + 10000, // Prix entre 10k et 60k FCFA
            rating: Math.random() * 2 + 3, // Note aléatoire entre 3 et 5 pour la démo
            reviews_count: Math.floor(Math.random() * 50) + 5, // Nombre d'avis aléatoire
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
  };

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
          )
        `)
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle(); // Utiliser maybeSingle() au lieu de single()

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw new Error(`Erreur de base de données: ${error.message}`);
      }

      if (!data) {
        console.log('❌ Aucune propriété trouvée avec cet ID:', id);
        throw new Error('Propriété non trouvée ou inactive');
      }

      console.log('✅ Propriété trouvée:', data.title);

      // Transformer les données avec les équipements
      const transformedData = {
        ...data,
        images: data.images || [],
        price_per_night: data.price_per_night || Math.floor(Math.random() * 50000) + 10000,
        rating: Math.random() * 2 + 3,
        reviews_count: Math.floor(Math.random() * 50) + 5,
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

  return {
    properties,
    loading,
    error,
    fetchProperties,
    getPropertyById,
    refetch: () => {
      setLoading(true);
      setProperties([]);
    }
  };
};
