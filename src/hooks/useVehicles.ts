import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Vehicle, VehicleFilters } from '../types';

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<VehicleFilters | undefined>(undefined);

  const fetchVehicles = useCallback(async (filters?: VehicleFilters) => {
    // Stocker les filtres pour les réutiliser dans refetch
    if (filters !== undefined) {
      setLastFilters(filters);
    }
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('vehicles')
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
          vehicle_photos (
            id,
            url,
            category,
            is_main,
            display_order,
            created_at
          ),
          owner:profiles!owner_id (
            user_id,
            first_name,
            last_name,
            avatar_url,
            identity_verified,
            city,
            country,
            bio
          )
        `)
        .eq('is_active', true)
        .eq('is_approved', true); // Only show approved vehicles to public

      // Appliquer les filtres
      if (filters?.vehicleType) {
        query = query.eq('vehicle_type', filters.vehicleType);
      }

      if (filters?.brand) {
        query = query.eq('brand', filters.brand);
      }

      if (filters?.priceMin) {
        query = query.gte('price_per_day', filters.priceMin);
      }

      if (filters?.priceMax) {
        query = query.lte('price_per_day', filters.priceMax);
      }

      if (filters?.transmission) {
        query = query.eq('transmission', filters.transmission);
      }

      if (filters?.fuelType) {
        query = query.eq('fuel_type', filters.fuelType);
      }

      if (filters?.seats) {
        query = query.gte('seats', filters.seats);
      }

      // Recherche hiérarchique par localisation (comme pour les propriétés)
      let locationIds: string[] | null = null;
      
      if (filters?.locationName) {
        const searchTerm = filters.locationName.trim();
        
        // Recherche par ville
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
          
          console.log(`✅ [useVehicles] Ville trouvée: ${cityIds.length} ville(s), ${communeIds.length} commune(s), ${neighborhoodIds.length} quartier(s) (total: ${locationIds.length} locations) pour "${searchTerm}"`);
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
            
            console.log(`✅ [useVehicles] Commune trouvée: ${communeIds.length} commune(s), ${neighborhoodIds.length} quartier(s) (total: ${locationIds.length} locations) pour "${searchTerm}"`);
          } else {
            // Chercher dans les quartiers
            const { data: neighborhoodData } = await supabase
              .from('locations')
              .select('id')
              .eq('type', 'neighborhood')
              .ilike('name', `%${searchTerm}%`);
            
            if (neighborhoodData && neighborhoodData.length > 0) {
              locationIds = neighborhoodData.map(l => l.id);
              console.log(`✅ [useVehicles] Quartier trouvé: ${locationIds.length} quartier(s) pour "${searchTerm}"`);
            }
          }
        }
        
        if (!locationIds || locationIds.length === 0) {
          console.log(`❌ [useVehicles] Aucune localisation trouvée pour "${searchTerm}"`);
          setVehicles([]);
          setLoading(false);
          return;
        }
      } else if (filters?.locationId) {
        // Filtre direct par ID (pour compatibilité)
        locationIds = [filters.locationId];
      }

      // Appliquer le filtre location_id si présent
      if (locationIds && locationIds.length > 0) {
        query = query
          .in('location_id', locationIds)
          .not('location_id', 'is', null);
      }

      if (filters?.features && filters.features.length > 0) {
        // Filtrer par équipements (tous doivent être présents)
        filters.features.forEach(feature => {
          query = query.contains('features', [feature]);
        });
      }

      // Recherche textuelle (marque, modèle, titre, description, localisation)
      if (filters?.search && filters.search.trim()) {
        const searchTerm = filters.search.trim().toLowerCase();
        // Recherche dans plusieurs champs via OR
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%`);
      }

      const { data, error: queryError } = await query
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false });

      // Filtrer par disponibilité (jour ou heure selon le type)
      let availableVehicles = data || [];
      
      console.log(`🔍 [useVehicles] Filtres reçus:`, {
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        startDateTime: filters?.startDateTime,
        endDateTime: filters?.endDateTime,
        rentalType: filters?.rentalType
      });
      
      // Si recherche par heure
      if (filters?.startDateTime && filters?.endDateTime && filters?.rentalType === 'hourly') {
        const startDateTime = new Date(filters.startDateTime);
        const endDateTime = new Date(filters.endDateTime);
        
        // Vérifier la disponibilité pour chaque véhicule
        const availabilityChecks = await Promise.all(
          availableVehicles.map(async (vehicle: any) => {
            try {
              const { data: availabilityData, error: availabilityError } = await supabase
                .rpc('check_vehicle_hourly_availability', {
                  p_vehicle_id: vehicle.id,
                  p_start_datetime: startDateTime.toISOString(),
                  p_end_datetime: endDateTime.toISOString(),
                  p_exclude_booking_id: null
                });
              
              if (availabilityError) {
                console.error(`❌ [useVehicles] Erreur pour véhicule ${vehicle.id}:`, availabilityError);
                return false;
              }
              
              // La fonction SQL retourne true si disponible, false si indisponible
              const isActuallyAvailable = availabilityData === true;
              
              console.log(`🔍 [useVehicles] Véhicule ${vehicle.id} (${vehicle.title || vehicle.brand}): isAvailable=${availabilityData} (type: ${typeof availabilityData}), disponible=${isActuallyAvailable}`);
              
              return isActuallyAvailable;
            } catch (error) {
              console.error('Error in availability check:', error);
              return false;
            }
          })
        );
        
        availableVehicles = availableVehicles.filter((_: any, index: number) => 
          availabilityChecks[index]
        );
      }
      // Si recherche par jour - utiliser la fonction SQL avec datetime pour une vérification précise
      else if (filters?.startDate && filters?.endDate) {
        console.log(`✅ [useVehicles] Filtrage par jour activé: ${filters.startDate} - ${filters.endDate}`);
        // Construire les datetime à partir des dates (par défaut: début à 00:00, fin à 23:59:59)
        const startDateObj = new Date(filters.startDate);
        startDateObj.setHours(0, 0, 0, 0);
        const startDateTime = startDateObj.toISOString();
        
        const endDateObj = new Date(filters.endDate);
        endDateObj.setHours(23, 59, 59, 999);
        const endDateTime = endDateObj.toISOString();
        
        console.log(`🔍 [useVehicles] Filtrage par dates avec datetime: ${startDateTime} - ${endDateTime}`);
        
        // Vérifier la disponibilité pour chaque véhicule en utilisant la fonction SQL
        const availabilityChecks = await Promise.all(
          availableVehicles.map(async (vehicle: any) => {
            try {
              const { data: isAvailable, error: availabilityError } = await supabase
                .rpc('check_vehicle_hourly_availability', {
                  p_vehicle_id: vehicle.id,
                  p_start_datetime: startDateTime,
                  p_end_datetime: endDateTime,
                  p_exclude_booking_id: null
                });
              
              if (availabilityError) {
                console.error(`❌ [useVehicles] Erreur pour véhicule ${vehicle.id}:`, availabilityError);
                return false;
              }
              
              // La fonction SQL retourne true si disponible, false si indisponible
              // isAvailable peut être true, false, ou null/undefined
              const isActuallyAvailable = isAvailable === true;
              
              console.log(`🔍 [useVehicles] Véhicule ${vehicle.id} (${vehicle.title || vehicle.brand}): isAvailable=${isAvailable} (type: ${typeof isAvailable}), disponible=${isActuallyAvailable}`);
              
              return isActuallyAvailable;
            } catch (error) {
              console.error(`❌ [useVehicles] Erreur pour véhicule ${vehicle.id}:`, error);
              return false;
            }
          })
        );
        
        // Log détaillé des résultats
        const availableCount = availabilityChecks.filter(Boolean).length;
        const unavailableCount = availabilityChecks.length - availableCount;
        console.log(`📊 [useVehicles] Résultats: ${availableCount} disponible(s), ${unavailableCount} indisponible(s) sur ${availableVehicles.length} véhicule(s) vérifié(s)`);
        
        availableVehicles = availableVehicles.filter((_: any, index: number) => {
          const isAvailable = availabilityChecks[index];
          if (!isAvailable) {
            console.log(`🚫 [useVehicles] Véhicule ${availableVehicles[index].id} filtré (indisponible)`);
          }
          return isAvailable;
        });
        
        console.log(`✅ [useVehicles] ${availableVehicles.length} véhicule(s) disponible(s) sur ${data?.length || 0} après filtrage par dates`);
      } else {
        console.log(`⚠️ [useVehicles] Pas de filtrage par dates - startDate: ${filters?.startDate}, endDate: ${filters?.endDate}`);
      }

      if (queryError) {
        throw queryError;
      }

      // Transformer les données (utiliser availableVehicles au lieu de data si filtrage par dates)
      const vehiclesToTransform = (filters?.startDate && filters?.endDate) ? availableVehicles : (data || []);
      console.log(`🔄 [useVehicles] Transformation: ${vehiclesToTransform.length} véhicule(s) à transformer (availableVehicles: ${availableVehicles.length}, data: ${data?.length || 0})`);
      const transformedVehicles: Vehicle[] = vehiclesToTransform.map((vehicle: any) => {
        // Extraire la première image principale ou la première image
        const photos = vehicle.vehicle_photos || [];
        const mainPhoto = photos.find((p: any) => p.is_main) || photos[0];
        const images = mainPhoto ? [mainPhoto.url] : (vehicle.images || []);

        return {
          ...vehicle,
          location: vehicle.locations ? {
            id: vehicle.locations.id,
            name: vehicle.locations.name,
            type: vehicle.locations.type,
            latitude: vehicle.locations.latitude,
            longitude: vehicle.locations.longitude,
            parent_id: vehicle.locations.parent_id,
          } : undefined,
          photos: photos,
          images: images.length > 0 ? images : vehicle.images || [],
          owner: vehicle.owner ? {
            user_id: vehicle.owner.user_id,
            first_name: vehicle.owner.first_name,
            last_name: vehicle.owner.last_name,
            avatar_url: vehicle.owner.avatar_url,
            identity_verified: vehicle.owner.identity_verified,
            city: vehicle.owner.city,
            country: vehicle.owner.country,
            bio: vehicle.owner.bio,
          } : undefined,
        };
      });

      console.log(`🎯 [useVehicles] Véhicules finaux à afficher: ${transformedVehicles.length} véhicule(s)`);
      if (transformedVehicles.length > 0) {
        console.log(`🎯 [useVehicles] IDs des véhicules à afficher:`, transformedVehicles.map(v => v.id));
      }

      setVehicles(transformedVehicles);
    } catch (err: any) {
      console.error('Erreur lors du chargement des véhicules:', err);
      setError(err.message || 'Erreur lors du chargement des véhicules');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getVehicleById = useCallback(async (vehicleId: string): Promise<Vehicle | null> => {
    try {
      setLoading(true);
      setError(null);

      // Vérifier si l'utilisateur est connecté et s'il est le propriétaire
      const { data: { user } } = await supabase.auth.getUser();
      let isOwner = false;

      if (user) {
        // Vérifier si l'utilisateur est le propriétaire
        const { data: vehicleCheck } = await supabase
          .from('vehicles')
          .select('owner_id')
          .eq('id', vehicleId)
          .single();
        
        isOwner = vehicleCheck?.owner_id === user.id;
      }

      let query = supabase
        .from('vehicles')
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
          vehicle_photos (
            id,
            url,
            category,
            is_main,
            display_order,
            created_at
          ),
          owner:profiles!owner_id (
            user_id,
            first_name,
            last_name,
            avatar_url,
            identity_verified,
            city,
            country,
            bio
          )
        `)
        .eq('id', vehicleId);

      // Si l'utilisateur n'est pas le propriétaire, filtrer par is_approved et is_active
      if (!isOwner) {
        query = query.eq('is_active', true).eq('is_approved', true);
      }

      const { data, error: queryError } = await query.single();

      if (queryError) {
        throw queryError;
      }

      if (!data) {
        return null;
      }

      const photos = data.vehicle_photos || [];
      const images = photos.length > 0 
        ? photos.map((p: any) => p.url)
        : (data.images || []);

      return {
        ...data,
        location: data.locations ? {
          id: data.locations.id,
          name: data.locations.name,
          type: data.locations.type,
          latitude: data.locations.latitude,
          longitude: data.locations.longitude,
          parent_id: data.locations.parent_id,
        } : undefined,
        photos: photos,
        images: images,
        owner: data.owner ? {
          user_id: data.owner.user_id,
          first_name: data.owner.first_name,
          last_name: data.owner.last_name,
          avatar_url: data.owner.avatar_url,
          identity_verified: data.owner.identity_verified,
          city: data.owner.city,
          country: data.owner.country,
          bio: data.owner.bio,
        } : undefined,
      };
    } catch (err: any) {
      console.error('Erreur lors du chargement du véhicule:', err);
      setError(err.message || 'Erreur lors du chargement du véhicule');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMyVehicles = useCallback(async (): Promise<Vehicle[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ [getMyVehicles] Utilisateur non connecté');
        throw new Error('Utilisateur non connecté');
      }

      console.log('🔍 [getMyVehicles] Récupération des véhicules pour user:', user.id);

      // Test simple d'abord pour voir si on récupère des données
      const { data: testData, error: testError } = await supabase
        .from('vehicles')
        .select('id, title, owner_id')
        .eq('owner_id', user.id)
        .limit(5);
      
      console.log('🧪 [getMyVehicles] Test simple:', {
        count: testData?.length || 0,
        error: testError,
        data: testData
      });

      const { data, error: queryError } = await supabase
        .from('vehicles')
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
          vehicle_photos (
            id,
            url,
            category,
            is_main,
            display_order,
            created_at
          )
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (queryError) {
        console.error('❌ [getMyVehicles] Erreur Supabase:', queryError);
        console.error('❌ [getMyVehicles] Détails de l\'erreur:', JSON.stringify(queryError, null, 2));
        throw queryError;
      }

      console.log(`✅ [getMyVehicles] ${data?.length || 0} véhicule(s) trouvé(s)`);
      if (data && data.length > 0) {
        console.log('📋 [getMyVehicles] Premier véhicule:', JSON.stringify(data[0], null, 2));
      }

      const transformedVehicles: Vehicle[] = (data || []).map((vehicle: any) => {
        const photos = vehicle.vehicle_photos || [];
        // Trier les photos : is_main en premier, puis par display_order
        const sortedPhotos = photos.sort((a: any, b: any) => {
          if (a.is_main && !b.is_main) return -1;
          if (!a.is_main && b.is_main) return 1;
          return (a.display_order || 0) - (b.display_order || 0);
        });
        const images = sortedPhotos.length > 0 
          ? sortedPhotos.map((p: any) => p.url)
          : (vehicle.images || []);

        return {
          ...vehicle,
          location: vehicle.locations ? {
            id: vehicle.locations.id,
            name: vehicle.locations.name,
            type: vehicle.locations.type,
            latitude: vehicle.locations.latitude,
            longitude: vehicle.locations.longitude,
            parent_id: vehicle.locations.parent_id,
          } : undefined,
          photos: sortedPhotos,
          images: images,
        };
      });

      console.log(`✅ [getMyVehicles] ${transformedVehicles.length} véhicule(s) transformé(s)`);
      return transformedVehicles;
    } catch (err: any) {
      console.error('❌ [getMyVehicles] Erreur lors du chargement de mes véhicules:', err);
      setError(err.message || 'Erreur lors du chargement de mes véhicules');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // SUPPRIMÉ: useEffect qui appelait fetchVehicles() sans filtres
  // Le fetchVehicles doit être appelé explicitement avec des filtres depuis VehiclesScreen
  // useEffect(() => {
  //   fetchVehicles();
  // }, [fetchVehicles]);

  const addVehicle = useCallback(async (vehicleData: Partial<Vehicle>) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // New vehicles are pending approval by default (comme sur le site web)
      const { data, error: insertError } = await supabase
        .from('vehicles')
        .insert({
          owner_id: user.id,
          title: vehicleData.title,
          description: vehicleData.description || null,
          vehicle_type: vehicleData.vehicle_type,
          brand: vehicleData.brand,
          model: vehicleData.model,
          year: vehicleData.year,
          plate_number: vehicleData.plate_number || null,
          seats: vehicleData.seats || 5,
          transmission: vehicleData.transmission || null,
          fuel_type: vehicleData.fuel_type || null,
          mileage: vehicleData.mileage || null,
          location_id: vehicleData.location_id || null,
          price_per_day: vehicleData.price_per_day,
          price_per_week: vehicleData.price_per_week || null,
          price_per_month: vehicleData.price_per_month || null,
          security_deposit: vehicleData.security_deposit || 0,
          minimum_rental_days: vehicleData.minimum_rental_days || 1,
          hourly_rental_enabled: (vehicleData as any).hourly_rental_enabled || false,
          price_per_hour: (vehicleData as any).price_per_hour || null,
          minimum_rental_hours: (vehicleData as any).minimum_rental_hours || null,
          images: vehicleData.images || [],
          documents: vehicleData.documents || [],
          features: vehicleData.features || [],
          rules: vehicleData.rules || [],
          // Nouveaux champs du site web
          with_driver: (vehicleData as any).with_driver || false,
          has_insurance: (vehicleData as any).has_insurance || false,
          insurance_details: (vehicleData as any).insurance_details || null,
          insurance_expiration_date: (vehicleData as any).insurance_expiration_date || null,
          requires_license: (vehicleData as any).requires_license !== false,
          min_license_years: (vehicleData as any).min_license_years || 0,
          discount_enabled: (vehicleData as any).discount_enabled || false,
          discount_min_days: (vehicleData as any).discount_min_days || 7,
          discount_percentage: (vehicleData as any).discount_percentage || 10,
          long_stay_discount_enabled: (vehicleData as any).long_stay_discount_enabled || false,
          long_stay_discount_min_days: (vehicleData as any).long_stay_discount_min_days || 30,
          long_stay_discount_percentage: (vehicleData as any).long_stay_discount_percentage || 20,
          // Statut d'approbation (comme sur le site web)
          is_approved: false,
          approval_status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ [useVehicles] Erreur insertion véhicule:', insertError);
        throw insertError;
      }
      
      console.log('✅ [useVehicles] Véhicule inséré avec succès:', data.id);

      // Send notification emails (comme sur le site web)
      try {
        console.log('📧 [useVehicles] Envoi des emails de notification...');
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, phone')
          .eq('user_id', user.id)
          .single();
        
        if (ownerProfile) {
          const emailData = {
            ownerName: `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'Propriétaire',
            ownerEmail: ownerProfile.email,
            ownerPhone: ownerProfile.phone,
            vehicleTitle: vehicleData.title,
            vehicleBrand: vehicleData.brand,
            vehicleModel: vehicleData.model,
            vehicleYear: vehicleData.year,
            pricePerDay: vehicleData.price_per_day,
          };
          
          // Email au propriétaire du véhicule
          if (ownerProfile.email) {
            try {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'vehicle_application_submitted',
                  to: ownerProfile.email,
                  data: emailData
                }
              });
              console.log('✅ [useVehicles] Email propriétaire envoyé');
            } catch (emailError) {
              console.error('❌ [useVehicles] Erreur email propriétaire:', emailError);
            }
          }
          
          // Email à l'admin
          try {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_submitted',
                to: 'contact@akwahome.com',
                data: emailData
              }
            });
            console.log('✅ [useVehicles] Email admin envoyé');
          } catch (emailError) {
            console.error('❌ [useVehicles] Erreur email admin:', emailError);
          }
        }
      } catch (emailError) {
        console.error('❌ [useVehicles] Erreur globale envoi emails:', emailError);
        // Ne pas bloquer la création si l'email échoue
      }

      // Si des photos sont fournies, les uploader et créer les entrées vehicle_photos
      if (vehicleData.images && vehicleData.images.length > 0) {
        try {
          console.log('📸 [useVehicles] Début upload des photos...');
          // Récupérer les informations sur les photos si disponibles
          const photosInfo = (vehicleData as any).photos || [];
          
          const photoPromises = vehicleData.images.map(async (imageUrl, index) => {
            try {
              // Trouver les informations de la photo correspondante
              const photoInfo = photosInfo[index] || {};
              const isMain = photoInfo.isMain || (index === 0 && !photosInfo.some((p: any) => p.isMain));
              const category = photoInfo.category || 'exterior';
              const displayOrder = photoInfo.displayOrder !== undefined ? photoInfo.displayOrder : index;
              
          // Si c'est une URI locale, on doit l'uploader
          // MAIS normalement, les images devraient déjà être uploadées avant d'appeler addVehicle
          // Si on reçoit encore une URI locale, c'est une erreur, on la saute
          if (imageUrl.startsWith('file://') || imageUrl.startsWith('content://')) {
            console.warn(`⚠️ [useVehicles] Image ${index + 1} a une URI locale (devrait être uploadée avant):`, imageUrl);
            // Ne pas uploader ici pour éviter les blocages - les images devraient être uploadées avant
            return null;
          } else {
            // URL déjà publique
            console.log(`✅ [useVehicles] Image ${index + 1} déjà publique:`, imageUrl.substring(0, 50) + '...');
            return {
              vehicle_id: data.id,
              url: imageUrl,
              category: category,
              is_main: isMain,
              display_order: displayOrder,
            };
          }
            } catch (photoError: any) {
              console.error(`❌ [useVehicles] Erreur pour photo ${index + 1}:`, photoError);
              return null;
            }
          });

          const photos = (await Promise.all(photoPromises)).filter(Boolean);
          console.log(`📸 [useVehicles] ${photos.length} photo(s) prête(s) à être insérée(s)`);
          
          if (photos.length > 0) {
            // S'assurer qu'il n'y a qu'une seule photo principale
            const mainPhotos = photos.filter((p: any) => p.is_main);
            if (mainPhotos.length > 1) {
              // Si plusieurs photos sont marquées principales, ne garder que la première
              const firstMainIndex = photos.findIndex((p: any) => p.is_main);
              photos.forEach((p: any, index: number) => {
                if (index !== firstMainIndex) {
                  p.is_main = false;
                }
              });
            } else if (mainPhotos.length === 0 && photos.length > 0) {
              // Si aucune photo principale, marquer la première
              photos[0].is_main = true;
            }
            
            const { error: photosError } = await supabase
              .from('vehicle_photos')
              .insert(photos);

            if (photosError) {
              console.error('❌ [useVehicles] Erreur lors de l\'insertion des photos:', photosError);
            } else {
              console.log('✅ [useVehicles] Photos insérées avec succès');
            }
          }
        } catch (photosError: any) {
          console.error('❌ [useVehicles] Erreur globale lors du traitement des photos:', photosError);
          // Ne pas bloquer la création du véhicule si les photos échouent
        }
      }

      console.log('✅ [useVehicles] Véhicule créé avec succès, ID:', data.id);
      return { success: true, vehicle: data };
    } catch (err: any) {
      console.error('❌ [useVehicles] Erreur lors de l\'ajout du véhicule:', err);
      const errorMessage = err.message || err.details || 'Erreur lors de l\'ajout du véhicule';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      console.log('🔄 [useVehicles] Fin de addVehicle, setLoading(false)');
      setLoading(false);
    }
  }, []);

  const updateVehicle = useCallback(async (vehicleId: string, vehicleData: Partial<Vehicle>) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Vérifier que l'utilisateur est le propriétaire
      const { data: existingVehicle, error: checkError } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('id', vehicleId)
        .single();

      if (checkError || !existingVehicle) {
        throw new Error('Véhicule introuvable');
      }

      if (existingVehicle.owner_id !== user.id) {
        throw new Error('Vous n\'êtes pas autorisé à modifier ce véhicule');
      }

      // Préparer les données de mise à jour
      const updateData: any = {};
      if (vehicleData.title !== undefined) updateData.title = vehicleData.title;
      if (vehicleData.description !== undefined) updateData.description = vehicleData.description;
      if (vehicleData.vehicle_type !== undefined) updateData.vehicle_type = vehicleData.vehicle_type;
      if (vehicleData.brand !== undefined) updateData.brand = vehicleData.brand;
      if (vehicleData.model !== undefined) updateData.model = vehicleData.model;
      if (vehicleData.year !== undefined) updateData.year = vehicleData.year;
      if (vehicleData.plate_number !== undefined) updateData.plate_number = vehicleData.plate_number;
      if (vehicleData.seats !== undefined) updateData.seats = vehicleData.seats;
      if (vehicleData.transmission !== undefined) updateData.transmission = vehicleData.transmission;
      if (vehicleData.fuel_type !== undefined) updateData.fuel_type = vehicleData.fuel_type;
      if (vehicleData.mileage !== undefined) updateData.mileage = vehicleData.mileage;
      if (vehicleData.location_id !== undefined) updateData.location_id = vehicleData.location_id;
      if (vehicleData.price_per_day !== undefined) updateData.price_per_day = vehicleData.price_per_day;
      if (vehicleData.price_per_week !== undefined) updateData.price_per_week = vehicleData.price_per_week;
      if (vehicleData.price_per_month !== undefined) updateData.price_per_month = vehicleData.price_per_month;
      if (vehicleData.security_deposit !== undefined) updateData.security_deposit = vehicleData.security_deposit;
      if (vehicleData.minimum_rental_days !== undefined) updateData.minimum_rental_days = vehicleData.minimum_rental_days;
      if (vehicleData.auto_booking !== undefined) updateData.auto_booking = vehicleData.auto_booking;
      if (vehicleData.features !== undefined) updateData.features = vehicleData.features;
      if (vehicleData.rules !== undefined) updateData.rules = vehicleData.rules;
      if (vehicleData.is_active !== undefined) updateData.is_active = vehicleData.is_active;
      // Champs de location par heure
      if (vehicleData.hourly_rental_enabled !== undefined) updateData.hourly_rental_enabled = vehicleData.hourly_rental_enabled;
      if (vehicleData.price_per_hour !== undefined) updateData.price_per_hour = vehicleData.price_per_hour;
      if (vehicleData.minimum_rental_hours !== undefined) updateData.minimum_rental_hours = vehicleData.minimum_rental_hours;

      const { data, error: updateError } = await supabase
        .from('vehicles')
        .update(updateData)
        .eq('id', vehicleId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Mettre à jour les photos si fournies
      if (vehicleData.images && vehicleData.images.length > 0) {
        // Supprimer les anciennes photos
        await supabase
          .from('vehicle_photos')
          .delete()
          .eq('vehicle_id', vehicleId);

        // Récupérer les informations sur les photos si disponibles
        const photosInfo = (vehicleData as any).photos || [];
        
        // Uploader et ajouter les nouvelles photos
        const photoPromises = vehicleData.images.map(async (imageUri, index) => {
          // Trouver les informations de la photo correspondante
          const photoInfo = photosInfo[index] || {};
          const isMain = photoInfo.isMain || (index === 0 && !photosInfo.some((p: any) => p.isMain));
          const category = photoInfo.category || 'exterior';
          const displayOrder = photoInfo.displayOrder !== undefined ? photoInfo.displayOrder : index;
          
          // Si c'est une URI locale, on doit l'uploader
          if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
            const fileName = `vehicle-${vehicleId}-${Date.now()}-${index}.jpg`;
            const filePath = `${user.id}/vehicles/${fileName}`;
            
            const response = await fetch(imageUri);
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            const { error: uploadError } = await supabase.storage
              .from('property-images')
              .upload(filePath, uint8Array, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              console.error('Erreur upload image:', uploadError);
              return null;
            }

            const { data: { publicUrl } } = supabase.storage
              .from('property-images')
              .getPublicUrl(filePath);

            return {
              vehicle_id: vehicleId,
              url: publicUrl,
              category: category,
              is_main: isMain,
              display_order: displayOrder,
            };
          } else {
            // URL déjà publique
            return {
              vehicle_id: vehicleId,
              url: imageUri,
              category: category,
              is_main: isMain,
              display_order: displayOrder,
            };
          }
        });

        const photos = (await Promise.all(photoPromises)).filter(Boolean);
        
        if (photos.length > 0) {
          // S'assurer qu'il n'y a qu'une seule photo principale
          const mainPhotos = photos.filter((p: any) => p.is_main);
          if (mainPhotos.length > 1) {
            // Si plusieurs photos sont marquées principales, ne garder que la première
            const firstMainIndex = photos.findIndex((p: any) => p.is_main);
            photos.forEach((p: any, index: number) => {
              if (index !== firstMainIndex) {
                p.is_main = false;
              }
            });
          } else if (mainPhotos.length === 0 && photos.length > 0) {
            // Si aucune photo principale, marquer la première
            photos[0].is_main = true;
          }
          
          const { error: photosError } = await supabase
            .from('vehicle_photos')
            .insert(photos);

          if (photosError) {
            console.error('Erreur lors de l\'insertion des photos:', photosError);
          }
        }
      }

      return { success: true, vehicle: data };
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du véhicule:', err);
      setError(err.message || 'Erreur lors de la mise à jour du véhicule');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteVehicle = useCallback(async (vehicleId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Vérifier que l'utilisateur est le propriétaire
      const { data: existingVehicle, error: checkError } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('id', vehicleId)
        .single();

      if (checkError || !existingVehicle) {
        throw new Error('Véhicule introuvable');
      }

      if (existingVehicle.owner_id !== user.id) {
        throw new Error('Vous n\'êtes pas autorisé à supprimer ce véhicule');
      }

      // Vérifier s'il y a des réservations actives
      const { data: activeBookings } = await supabase
        .from('vehicle_bookings')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .in('status', ['pending', 'confirmed']);

      if (activeBookings && activeBookings.length > 0) {
        throw new Error('Impossible de supprimer le véhicule : il y a des réservations en cours');
      }

      const { error: deleteError } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);

      if (deleteError) {
        throw deleteError;
      }

      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors de la suppression du véhicule:', err);
      setError(err.message || 'Erreur lors de la suppression du véhicule');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    vehicles,
    loading,
    error,
    fetchVehicles,
    getVehicleById,
    getMyVehicles,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    refetch: () => fetchVehicles(lastFilters),
  };
};

