import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Property, SearchFilters, Amenity } from '../types';
import { getAmenityIcon } from '../utils/amenityIcons';
import { calculateDistance, isWithinRadius } from '../utils/distance';

// Fonction helper pour calculer rating et review_count depuis les avis approuvés
const calculateRatingFromReviews = async (propertyId: string): Promise<{ rating: number; review_count: number }> => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating, approved')
      .eq('property_id', propertyId)
      .eq('approved', true);

    if (error) {
      console.error('❌ Erreur lors du calcul du rating:', error);
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
    console.error('❌ Erreur lors du calcul du rating:', err);
    return { rating: 0, review_count: 0 };
  }
};

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
          // Récupérer tous les enfants (communes, quartiers) de ces villes
          const cityIds = cityData.map(c => c.id);
          const { data: childLocations } = await supabase
            .from('locations')
            .select('id')
            .in('parent_id', cityIds);
          
          // Inclure les villes ET leurs enfants
          locationIds = [...cityIds, ...(childLocations || []).map(l => l.id)];
        } else {
          // Chercher dans les communes
          const { data: communeData } = await supabase
            .from('locations')
            .select('id, type, parent_id')
            .eq('type', 'commune')
            .ilike('name', `%${searchTerm}%`);
          
          if (communeData && communeData.length > 0) {
            const communeIds = communeData.map(c => c.id);
            const { data: childLocations } = await supabase
              .from('locations')
              .select('id')
              .in('parent_id', communeIds);
            
            locationIds = [...communeIds, ...(childLocations || []).map(l => l.id)];
          } else {
            // Chercher dans les quartiers
            const { data: neighborhoodData } = await supabase
              .from('locations')
              .select('id')
              .eq('type', 'neighborhood')
              .ilike('name', `%${searchTerm}%`);
            
            if (neighborhoodData && neighborhoodData.length > 0) {
              locationIds = neighborhoodData.map(l => l.id);
            }
          }
        }
        
        if (!locationIds || locationIds.length === 0) {
          console.log(`⚠️ Aucune location trouvée pour "${searchTerm}"`);
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
            discount_percentage: property.discount_percentage
          });
          
          // Calculer la vraie moyenne des avis et le nombre d'avis
          // Filtrer uniquement les avis approuvés par l'admin
          // Calculer dynamiquement rating et review_count depuis les avis approuvés
          // pour garantir que les valeurs sont toujours à jour dans l'overview
          const calculatedRating = await calculateRatingFromReviews(property.id);
          
          // Utiliser les valeurs calculées (ou celles de la DB si elles sont plus récentes)
          const finalRating = calculatedRating.rating || property.rating || 0;
          const finalReviewCount = calculatedRating.review_count || property.review_count || 0;


          // Traiter les photos catégorisées
          const categorizedPhotos = property.property_photos || [];
          const sortedPhotos = categorizedPhotos.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          
          // Créer un tableau d'images pour la compatibilité avec l'ancien système
          const imageUrls = sortedPhotos.map(photo => photo.url);
          
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

      // Calculer dynamiquement rating et review_count depuis les avis approuvés
      // pour garantir que les valeurs sont toujours à jour
      const calculatedRating = await calculateRatingFromReviews(data.id);
      console.log('📊 Rating calculé depuis les avis:', calculatedRating);
      
      // Utiliser les valeurs calculées (ou celles de la DB si elles sont plus récentes)
      const finalRating = calculatedRating.rating || data.rating || 0;
      const finalReviewCount = calculatedRating.review_count || data.review_count || 0;

      // Traiter les photos catégorisées
      const categorizedPhotos = data.property_photos || [];
      const sortedPhotos = categorizedPhotos.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      
      // Créer un tableau d'images pour la compatibilité avec l'ancien système
      const imageUrls = sortedPhotos.map(photo => photo.url);
      
      // Si pas de photos catégorisées, utiliser l'ancien système
      const fallbackImages = data.images || [];
      const finalImages = imageUrls.length > 0 ? imageUrls : fallbackImages;

      // Transformer les données avec les équipements
      const mappedAmenities = await mapAmenities(data.amenities);
      const customAmenitiesList = data.custom_amenities && Array.isArray(data.custom_amenities)
        ? data.custom_amenities.map((name: string) => ({
            id: `custom-${name}`,
            name: name.trim(),
            icon: '➕'
          }))
        : [];
      const allAmenities = [...mappedAmenities, ...customAmenitiesList];
      
      // Extraire les coordonnées de location
      const location = (data as any).locations;
      const latitude = location?.latitude || data.latitude;
      const longitude = location?.longitude || data.longitude;
      
      // Debug pour vérifier les coordonnées
      if (!latitude && !longitude) {
        console.log(`⚠️ [getPropertyById] Propriété "${data.title}" sans coordonnées:`, {
          hasLocation: !!location,
          locationData: location,
          propertyLatitude: data.latitude,
          propertyLongitude: data.longitude
        });
      }

      const transformedData = {
        ...data,
        images: finalImages, // Pour compatibilité avec l'ancien système
        photos: sortedPhotos, // Nouveau système de photos catégorisées
        price_per_night: data.price_per_night || Math.floor(Math.random() * 50000) + 10000,
        rating: finalRating > 0 ? Math.round(finalRating * 100) / 100 : 0, // Note finale depuis la DB (mise à jour par trigger)
        review_count: finalReviewCount, // Nombre d'avis final depuis la DB (mise à jour par trigger)
        amenities: allAmenities,
        custom_amenities: data.custom_amenities || [],
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
          // Récupérer tous les enfants (communes, quartiers) de ces villes
          const cityIds = cityData.map(c => c.id);
          const { data: childLocations } = await supabase
            .from('locations')
            .select('id')
            .in('parent_id', cityIds);
          
          // Inclure les villes ET leurs enfants
          locationIds = [...cityIds, ...(childLocations || []).map(l => l.id)];
        } else {
          // Chercher dans les communes
          const { data: communeData } = await supabase
            .from('locations')
            .select('id, type, parent_id')
            .eq('type', 'commune')
            .ilike('name', `%${searchTerm}%`);
          
          if (communeData && communeData.length > 0) {
            const communeIds = communeData.map(c => c.id);
            const { data: childLocations } = await supabase
              .from('locations')
              .select('id')
              .in('parent_id', communeIds);
            
            locationIds = [...communeIds, ...(childLocations || []).map(l => l.id)];
          } else {
            // Chercher dans les quartiers
            const { data: neighborhoodData } = await supabase
              .from('locations')
              .select('id')
              .eq('type', 'neighborhood')
              .ilike('name', `%${searchTerm}%`);
            
            if (neighborhoodData && neighborhoodData.length > 0) {
              locationIds = neighborhoodData.map(l => l.id);
            }
          }
        }
        
        if (!locationIds || locationIds.length === 0) {
          console.log(`⚠️ Aucune location trouvée pour "${searchTerm}"`);
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

      // Transformer les données avec les équipements
      const transformedData = await Promise.all(
        (data || []).map(async (property) => {
          // Calculer la vraie moyenne des avis et le nombre d'avis
          // Filtrer uniquement les avis approuvés par l'admin
          // Calculer dynamiquement rating et review_count depuis les avis approuvés
          // pour garantir que les valeurs sont toujours à jour dans l'overview
          const calculatedRating = await calculateRatingFromReviews(property.id);
          
          // Utiliser les valeurs calculées (ou celles de la DB si elles sont plus récentes)
          const finalRating = calculatedRating.rating || property.rating || 0;
          const finalReviewCount = calculatedRating.review_count || property.review_count || 0;

          // Traiter les photos catégorisées
          const categorizedPhotos = property.property_photos || [];
          const sortedPhotos = categorizedPhotos.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          
          // Créer un tableau d'images pour la compatibilité avec l'ancien système
          const imageUrls = sortedPhotos.map(photo => photo.url);
          
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
