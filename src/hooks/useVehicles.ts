import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Vehicle, VehicleFilters } from '../types';

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async (filters?: VehicleFilters) => {
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

      // Filtrer par dates de disponibilité si startDate et endDate sont fournis
      let availableVehicles = data || [];
      if (filters?.startDate && filters?.endDate) {
        // Normaliser les dates au format YYYY-MM-DD pour éviter les problèmes de fuseau horaire
        const normalizeDate = (dateStr: string) => {
          if (!dateStr) return '';
          // Si c'est déjà au format YYYY-MM-DD, retourner tel quel
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateStr;
          }
          // Sinon, extraire la partie date
          return dateStr.split('T')[0];
        };
        
        const startDate = normalizeDate(filters.startDate);
        const endDate = normalizeDate(filters.endDate);
        
        console.log(`🔍 [useVehicles] Filtrage par dates: ${startDate} - ${endDate}`);
        
        // Récupérer tous les IDs de véhicules pour vérifier leur disponibilité
        const vehicleIds = availableVehicles.map(v => v.id);
        
        if (vehicleIds.length > 0) {
          // Récupérer TOUTES les réservations pour ces véhicules (pending et confirmed)
          // On va filtrer les chevauchements en JavaScript pour être sûr de ne rien manquer
          const { data: conflictingBookings, error: bookingsError } = await supabase
            .from('vehicle_bookings')
            .select('vehicle_id, start_date, end_date, status')
            .in('vehicle_id', vehicleIds)
            .in('status', ['pending', 'confirmed']);
          
          if (bookingsError) {
            console.error('❌ [useVehicles] Erreur lors de la vérification des réservations:', bookingsError);
          } else {
            console.log(`📋 [useVehicles] ${conflictingBookings?.length || 0} réservation(s) trouvée(s) pour ${vehicleIds.length} véhicule(s)`);
            if (conflictingBookings && conflictingBookings.length > 0) {
              console.log('📋 [useVehicles] Réservations:', conflictingBookings.map((b: any) => ({
                vehicle_id: b.vehicle_id,
                start_date: b.start_date,
                end_date: b.end_date,
                status: b.status
              })));
            }
          }
          
          // Récupérer TOUTES les dates bloquées pour ces véhicules
          // On va filtrer les chevauchements en JavaScript pour être sûr de ne rien manquer
          const { data: blockedDates, error: blockedError } = await supabase
            .from('vehicle_blocked_dates')
            .select('vehicle_id, start_date, end_date')
            .in('vehicle_id', vehicleIds);
          
          if (blockedError) {
            console.error('❌ [useVehicles] Erreur lors de la vérification des dates bloquées:', blockedError);
          }
          
          // Créer un Set des IDs de véhicules indisponibles
          const unavailableVehicleIds = new Set<string>();
          
          // Normaliser les dates de recherche une seule fois
          const searchStart = normalizeDate(startDate);
          const searchEnd = normalizeDate(endDate);
          
          // Vérifier les chevauchements pour les réservations
          (conflictingBookings || []).forEach((booking: any) => {
            // Normaliser les dates de la réservation
            const bookingStart = normalizeDate(booking.start_date);
            const bookingEnd = normalizeDate(booking.end_date);
            
            console.log(`🔍 [useVehicles] Vérification chevauchement: réservation ${bookingStart} - ${bookingEnd} vs recherche ${searchStart} - ${searchEnd}`);
            
            // Vérifier si les dates se chevauchent
            // Deux plages se chevauchent si: searchStart <= bookingEnd ET searchEnd >= bookingStart
            // (on utilise <= et >= pour inclure les cas où les dates se touchent exactement)
            const hasOverlap = searchStart <= bookingEnd && searchEnd >= bookingStart;
            console.log(`🔍 [useVehicles] Chevauchement détecté: ${hasOverlap} (${searchStart} <= ${bookingEnd} && ${searchEnd} >= ${bookingStart})`);
            
            if (hasOverlap) {
              unavailableVehicleIds.add(booking.vehicle_id);
              console.log(`🚫 [useVehicles] Véhicule ${booking.vehicle_id} indisponible: réservation ${bookingStart} - ${bookingEnd} chevauche recherche ${searchStart} - ${searchEnd}`);
            }
          });
          
          // Vérifier les chevauchements pour les dates bloquées
          (blockedDates || []).forEach((blocked: any) => {
            // Normaliser les dates bloquées
            const blockedStart = normalizeDate(blocked.start_date);
            const blockedEnd = normalizeDate(blocked.end_date);
            
            // Vérifier si les dates se chevauchent
            const hasOverlap = searchStart <= blockedEnd && searchEnd >= blockedStart;
            if (hasOverlap) {
              unavailableVehicleIds.add(blocked.vehicle_id);
              console.log(`🚫 [useVehicles] Véhicule ${blocked.vehicle_id} indisponible: dates bloquées ${blockedStart} - ${blockedEnd} chevauchent recherche ${searchStart} - ${searchEnd}`);
            }
          });
          
          // Filtrer les véhicules disponibles
          availableVehicles = availableVehicles.filter((vehicle: any) => {
            return !unavailableVehicleIds.has(vehicle.id);
          });
          
          console.log(`✅ [useVehicles] ${availableVehicles.length} véhicule(s) disponible(s) sur ${data?.length || 0} après filtrage par dates`);
        }
      }

      if (queryError) {
        throw queryError;
      }

      // Transformer les données (utiliser availableVehicles au lieu de data si filtrage par dates)
      const vehiclesToTransform = (filters?.startDate && filters?.endDate) ? availableVehicles : (data || []);
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

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

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
          images: vehicleData.images || [],
          documents: vehicleData.documents || [],
          features: vehicleData.features || [],
          rules: vehicleData.rules || [],
          // Nouveaux champs du site web
          with_driver: (vehicleData as any).with_driver || false,
          has_insurance: (vehicleData as any).has_insurance || false,
          insurance_details: (vehicleData as any).insurance_details || null,
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
        throw insertError;
      }

      // Send notification emails (comme sur le site web)
      try {
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
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_application_submitted',
                to: ownerProfile.email,
                data: emailData
              }
            });
          }
          
          // Email à l'admin
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_submitted',
              to: 'contact@akwahome.com',
              data: emailData
            }
          });
        }
      } catch (emailError) {
        console.error('Error sending vehicle submission email:', emailError);
        // Ne pas bloquer la création si l'email échoue
      }

      // Si des photos sont fournies, les uploader et créer les entrées vehicle_photos
      if (vehicleData.images && vehicleData.images.length > 0) {
        const photoPromises = vehicleData.images.map(async (imageUrl, index) => {
          // Si c'est une URI locale, on doit l'uploader
          if (imageUrl.startsWith('file://') || imageUrl.startsWith('content://')) {
            // Uploader l'image vers Supabase Storage
            const fileName = `vehicle-${data.id}-${Date.now()}-${index}.jpg`;
            const filePath = `${user.id}/vehicles/${fileName}`;
            
            const response = await fetch(imageUrl);
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
              vehicle_id: data.id,
              url: publicUrl,
              category: index === 0 ? 'exterior' : 'exterior',
              is_main: index === 0,
              display_order: index,
            };
          } else {
            // URL déjà publique
            return {
              vehicle_id: data.id,
              url: imageUrl,
              category: index === 0 ? 'exterior' : 'exterior',
              is_main: index === 0,
              display_order: index,
            };
          }
        });

        const photos = (await Promise.all(photoPromises)).filter(Boolean);
        
        if (photos.length > 0) {
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
      console.error('Erreur lors de l\'ajout du véhicule:', err);
      setError(err.message || 'Erreur lors de l\'ajout du véhicule');
      return { success: false, error: err.message };
    } finally {
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

        // Uploader et ajouter les nouvelles photos
        const photoPromises = vehicleData.images.map(async (imageUri, index) => {
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
              category: 'exterior',
              is_main: index === 0,
              display_order: index,
            };
          } else {
            // URL déjà publique
            return {
              vehicle_id: vehicleId,
              url: imageUri,
              category: 'exterior',
              is_main: index === 0,
              display_order: index,
            };
          }
        });

        const photos = (await Promise.all(photoPromises)).filter(Boolean);
        
        if (photos.length > 0) {
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
    refetch: () => fetchVehicles(),
  };
};

