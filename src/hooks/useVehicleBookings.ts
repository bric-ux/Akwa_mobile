import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { VehicleBooking, VehicleBookingStatus } from '../types';
import { useIdentityVerification } from './useIdentityVerification';
import { calculateTotalPrice, calculateFees, calculateVehiclePriceWithHours, calculateHostCommission } from './usePricing';

export interface VehicleBookingData {
  vehicleId: string;
  rentalType?: 'daily' | 'hourly'; // Type de location: 'daily' par défaut pour rétrocompatibilité
  startDate?: string; // Pour compatibilité (sera converti en startDateTime)
  endDate?: string; // Pour compatibilité (sera converti en endDateTime)
  startDateTime: string; // OBLIGATOIRE - Date et heure de début (ISO string)
  endDateTime: string; // OBLIGATOIRE - Date et heure de fin (ISO string)
  pickupLocation?: string;
  dropoffLocation?: string;
  messageToOwner?: string;
  specialRequests?: string;
  licenseDocumentUrl?: string;
  hasLicense?: boolean;
  licenseYears?: string;
  licenseNumber?: string;
}

export const useVehicleBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } = useIdentityVerification();

  const createBooking = useCallback(async (bookingData: VehicleBookingData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Vous devez être connecté pour effectuer une réservation');
      }

      // Vérifier si l'identité est vérifiée (même logique que le site web)
      if (identityLoading) {
        setError('Vérification de l\'identité en cours...');
        return { success: false, error: 'Vérification de l\'identité en cours...' };
      }

      if (!hasUploadedIdentity) {
        setError('IDENTITY_REQUIRED');
        return { success: false, error: 'IDENTITY_REQUIRED' };
      }

      // Permettre les réservations si le document est vérifié OU en cours d'examen (pending)
      // Bloquer seulement si le document a été rejeté (rejected) ou n'existe pas
      if (!isVerified && verificationStatus !== 'pending') {
        setError('IDENTITY_NOT_VERIFIED');
        return { success: false, error: 'IDENTITY_NOT_VERIFIED' };
      }

      // Les heures sont maintenant obligatoires pour toutes les réservations
      if (!bookingData.startDateTime || !bookingData.endDateTime) {
        // Si on a startDate/endDate mais pas startDateTime/endDateTime, convertir
        if (bookingData.startDate && bookingData.endDate) {
          // Utiliser les dates fournies avec des heures par défaut (00:00 pour début, 23:59 pour fin)
          const startDateObj = new Date(bookingData.startDate + 'T00:00:00');
          const endDateObj = new Date(bookingData.endDate + 'T23:59:59');
          bookingData.startDateTime = startDateObj.toISOString();
          bookingData.endDateTime = endDateObj.toISOString();
        } else {
          throw new Error('Les dates et heures de début et de fin sont requises');
        }
      }

      const startDateTime = bookingData.startDateTime;
      const endDateTime = bookingData.endDateTime;
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);

      if (end <= start) {
        throw new Error('L\'heure de fin doit être après l\'heure de début');
      }

      // Extraire les dates pour les champs start_date et end_date (pour compatibilité)
      const startDate = start.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];

      // Déterminer le type de location
      const rentalType = bookingData.rentalType || 'daily';
      
      // Récupérer les informations du véhicule pour calculer le prix
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('price_per_day, price_per_hour, hourly_rental_enabled, minimum_rental_days, minimum_rental_hours, auto_booking, security_deposit, discount_enabled, discount_min_days, discount_percentage, long_stay_discount_enabled, long_stay_discount_min_days, long_stay_discount_percentage')
        .eq('id', bookingData.vehicleId)
        .single();

      if (vehicleError || !vehicle) {
        throw new Error('Véhicule introuvable');
      }

      // Validation selon le type de location
      let rentalDays = 1;
      let rentalHours: number | null = null;

      if (rentalType === 'hourly') {
        // Validation pour location par heure
        if (!vehicle.hourly_rental_enabled) {
          throw new Error('Ce véhicule ne propose pas la location par heure');
        }

        if (!vehicle.price_per_hour || vehicle.price_per_hour <= 0) {
          throw new Error('Le prix par heure n\'est pas défini pour ce véhicule');
        }

        // Calculer le nombre d'heures
        const diffTime = end.getTime() - start.getTime();
        rentalHours = Math.ceil(diffTime / (1000 * 60 * 60)); // Arrondir à l'heure supérieure

        if (rentalHours < (vehicle.minimum_rental_hours || 1)) {
          throw new Error(`La location minimum est de ${vehicle.minimum_rental_hours || 1} heure(s)`);
        }
      } else {
        // Validation pour location par jour
        // Calculer la durée totale en heures entre start et end datetime
        const diffTime = end.getTime() - start.getTime();
        const totalHours = Math.ceil(diffTime / (1000 * 60 * 60));
        
        // Calculer les jours complets à partir des heures totales (plus précis)
        const fullDaysFromHours = Math.floor(totalHours / 24);
        
        // Logique corrigée : utiliser les heures réelles comme base principale
        // Si totalHours >= 24 : utiliser fullDaysFromHours (basé sur les heures réelles)
        // Si totalHours < 24 : facturer 1 jour minimum
        // Ne pas utiliser les jours calendaires qui peuvent donner des résultats incorrects
        if (totalHours >= 24) {
          rentalDays = fullDaysFromHours; // Utiliser directement les jours calculés à partir des heures
        } else {
          rentalDays = 1; // Minimum 1 jour pour toute location
        }

        if (rentalDays < 1) {
          throw new Error('La date de fin ne peut pas être avant la date de début');
        }

        if (rentalDays < (vehicle.minimum_rental_days || 1)) {
          throw new Error(`La location minimum est de ${vehicle.minimum_rental_days || 1} jour(s)`);
        }
        
        // Calculer les heures restantes : durée totale - (jours complets × 24 heures)
        // Utiliser fullDaysFromHours pour le calcul des heures, pas rentalDays
        // Exemple: 177 heures totales = 7 jours complets (168h) + 9 heures restantes
        const hoursInFullDays = fullDaysFromHours * 24;
        const remainingHours = totalHours - hoursInFullDays;
        
        console.log(`⏱️ [useVehicleBookings] Calcul heures: totalHours=${totalHours}, fullDaysFromHours=${fullDaysFromHours}, hoursInFullDays=${hoursInFullDays}, remainingHours=${remainingHours}, rentalDays=${rentalDays}`);
        
        // Stocker les heures supplémentaires pour le calcul du prix (si > 0)
        if (remainingHours > 0 && vehicle.hourly_rental_enabled && vehicle.price_per_hour) {
          rentalHours = remainingHours;
          console.log(`✅ [useVehicleBookings] Heures restantes calculées: ${remainingHours}h`);
        } else {
          console.log(`⚠️ [useVehicleBookings] Pas d'heures restantes: remainingHours=${remainingHours}, hourly_rental_enabled=${vehicle.hourly_rental_enabled}, price_per_hour=${vehicle.price_per_hour}`);
        }
      }

      // Vérifier la disponibilité en utilisant toujours la fonction SQL (qui prend en compte les heures)
      const { data: isAvailable, error: availabilityError } = await supabase
        .rpc('check_vehicle_hourly_availability', {
          p_vehicle_id: bookingData.vehicleId,
          p_start_datetime: startDateTime,
          p_end_datetime: endDateTime,
          p_exclude_booking_id: null
        });

      if (availabilityError) {
        throw new Error('Erreur lors de la vérification de disponibilité');
      }

      if (!isAvailable) {
        throw new Error('Ce véhicule n\'est pas disponible pour ce créneau (dates et heures)');
      }

      // Calculer le prix total selon le type de location
      let basePrice: number;
      let discountAmount = 0;
      let discountApplied = false;
      let originalTotal: number;
      let dailyRate: number | null = null;
      let hourlyRate: number | null = null;

      if (rentalType === 'hourly') {
        // Pour location par heure : pas de réductions, prix simple
        hourlyRate = vehicle.price_per_hour!;
        basePrice = hourlyRate * rentalHours!;
        originalTotal = basePrice;
      } else {
        // Pour location par jour : utiliser la logique existante avec réductions
        dailyRate = vehicle.price_per_day;
        
        // Configuration des réductions
        const discountConfig = {
          enabled: vehicle.discount_enabled || false,
          minNights: vehicle.discount_min_days || null,
          percentage: vehicle.discount_percentage || null
        };
        
        const longStayDiscountConfig = vehicle.long_stay_discount_enabled ? {
          enabled: vehicle.long_stay_discount_enabled || false,
          minNights: vehicle.long_stay_discount_min_days || null,
          percentage: vehicle.long_stay_discount_percentage || null
        } : undefined;
        
        // Utiliser la fonction centralisée pour calculer le prix avec heures et réductions
        const hourlyRateValue = (rentalHours && rentalHours > 0 && vehicle.hourly_rental_enabled && vehicle.price_per_hour) 
          ? vehicle.price_per_hour 
          : 0;
        
        const priceCalculation = calculateVehiclePriceWithHours(
          dailyRate,
          rentalDays,
          rentalHours || 0,
          hourlyRateValue,
          discountConfig,
          longStayDiscountConfig
        );
        
        const daysPrice = priceCalculation.daysPrice;
        const hoursPrice = priceCalculation.hoursPrice;
        basePrice = priceCalculation.basePrice;
        originalTotal = priceCalculation.originalTotal;
        discountAmount = priceCalculation.discountAmount;
        discountApplied = priceCalculation.discountApplied;
        
        if (hourlyRateValue > 0) {
          hourlyRate = hourlyRateValue;
        }
        
        console.log(`💰 [useVehicleBookings] Calcul combiné: ${rentalDays} jours (${priceCalculation.daysPrice} FCFA) + ${rentalHours || 0} heures (${hoursPrice} FCFA) = ${priceCalculation.totalBeforeDiscount} FCFA, réduction: ${discountAmount} FCFA, total: ${basePrice} FCFA`);
      }
      
      // Calculer les frais de service (10% + TVA du prix après réduction pour les véhicules)
      const fees = calculateFees(basePrice, rentalType === 'hourly' ? rentalHours! : rentalDays, 'vehicle');
      const totalPrice = basePrice + fees.serviceFee; // Total avec frais de service
      
      // Déterminer le statut initial en fonction de auto_booking
      const initialStatus = (vehicle as any).auto_booking === true ? 'confirmed' : 'pending';

      // Créer la réservation avec les données selon le type
      // Les datetime sont maintenant toujours présents
      const bookingInsert: any = {
        vehicle_id: bookingData.vehicleId,
        renter_id: user.id,
        rental_type: rentalType,
        start_date: startDate,
        end_date: endDate,
        start_datetime: startDateTime, // Toujours présent maintenant
        end_datetime: endDateTime, // Toujours présent maintenant
        total_price: totalPrice, // Total avec frais de service
        security_deposit: vehicle.security_deposit ?? 0,
        pickup_location: bookingData.pickupLocation || null,
        dropoff_location: bookingData.dropoffLocation || null,
        message_to_owner: bookingData.messageToOwner || null,
        special_requests: bookingData.specialRequests || null,
        has_license: bookingData.hasLicense || false,
        license_years: bookingData.licenseYears ? parseInt(bookingData.licenseYears) : null,
        license_number: bookingData.licenseNumber || null,
        status: initialStatus,
      };

      if (rentalType === 'hourly') {
        bookingInsert.rental_hours = rentalHours;
        bookingInsert.hourly_rate = hourlyRate;
        bookingInsert.rental_days = 0; // Pas de jours pour location par heure
        bookingInsert.daily_rate = 0; // Pas de tarif journalier
      } else {
        bookingInsert.rental_days = rentalDays;
        bookingInsert.daily_rate = dailyRate;
        // Ajouter rental_hours si il y a des heures restantes
        if (rentalHours && rentalHours > 0) {
          bookingInsert.rental_hours = rentalHours;
          bookingInsert.hourly_rate = hourlyRate || vehicle.price_per_hour || 0;
        }
        bookingInsert.discount_applied = discountApplied;
        bookingInsert.discount_amount = discountAmount;
        bookingInsert.original_total = originalTotal;
      }

      const { data: booking, error: bookingError } = await supabase
        .from('vehicle_bookings')
        .insert(bookingInsert)
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images
          )
        `)
        .single();

      if (bookingError) {
        throw bookingError;
      }

      // Sauvegarder le document du permis dans license_documents si uploadé
      // Exactement comme sur le site web
      if (bookingData.licenseDocumentUrl && booking && user) {
        const { error: licenseError } = await supabase
          .from('license_documents')
          .insert({
            user_id: user.id,
            vehicle_booking_id: booking.id,
            document_url: bookingData.licenseDocumentUrl,
            document_type: 'driving_license',
          });

        if (licenseError) {
          console.error('Erreur sauvegarde document permis:', licenseError);
          // Ne pas bloquer la réservation si l'enregistrement du document échoue
        }
      }

      // Envoyer les emails après création de la réservation
      try {
        // Récupérer les informations du véhicule et du propriétaire
        const { data: vehicleInfo, error: vehicleInfoError } = await supabase
          .from('vehicles')
          .select(`
            title,
            brand,
            model,
            auto_booking,
            owner_id,
            profiles!vehicles_owner_id_fkey(
              first_name,
              last_name,
              email,
              phone
            )
          `)
          .eq('id', bookingData.vehicleId)
          .single();

        if (!vehicleInfoError && vehicleInfo) {
          const ownerProfile = vehicleInfo.profiles;
          const renterProfile = user.user_metadata || {};
          const renterName = `${renterProfile.first_name || ''} ${renterProfile.last_name || ''}`.trim() || 'Locataire';
          const ownerName = `${ownerProfile?.first_name || ''} ${ownerProfile?.last_name || ''}`.trim() || 'Propriétaire';
          const vehicleTitle = vehicleInfo.title || `${vehicleInfo.brand || ''} ${vehicleInfo.model || ''}`.trim();

          const isAutoBooking = initialStatus === 'confirmed';

          if (isAutoBooking) {
            // Réservation automatique - Envoyer les emails de confirmation immédiatement
            // Calculer le revenu net du propriétaire (prix après réduction - commission avec TVA)
            const hostCommissionData = calculateHostCommission(basePrice, 'vehicle');
            const ownerNetRevenue = basePrice - hostCommissionData.hostCommission;
            
            const emailData = {
              bookingId: booking.id,
              vehicleTitle: vehicleTitle,
              vehicleBrand: vehicleInfo.brand || '',
              vehicleModel: vehicleInfo.model || '',
              vehicleYear: vehicle?.year || '',
              fuelType: vehicle?.fuel_type || '',
              renterName: renterName,
              renterEmail: user.email || '',
              renterPhone: renterProfile.phone || '',
              ownerName: ownerName,
              ownerEmail: ownerProfile?.email || '',
              ownerPhone: ownerProfile?.phone || '',
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              startDateTime: bookingData.startDateTime,
              endDateTime: bookingData.endDateTime,
              rentalDays: rentalDays,
              rentalHours: rentalHours || 0,
              dailyRate: booking.daily_rate || vehicle?.price_per_day || 0,
              hourlyRate: hourlyRate || vehicle?.price_per_hour || 0,
              basePrice: basePrice, // Prix après réduction (pour calculer le revenu net)
              totalPrice: totalPrice,
              ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire
              securityDeposit: vehicle?.security_deposit ?? booking.security_deposit ?? 0,
              pickupLocation: bookingData.pickupLocation || '',
              isInstantBooking: true,
              paymentMethod: bookingData.paymentMethod || booking.payment_method || '',
              discountAmount: discountAmount || 0, // Montant de la réduction
              vehicleDiscountEnabled: vehicle.discount_enabled || false,
              vehicleDiscountMinDays: vehicle.discount_min_days || null,
              vehicleDiscountPercentage: vehicle.discount_percentage || null,
              vehicleLongStayDiscountEnabled: vehicle.long_stay_discount_enabled || false,
              vehicleLongStayDiscountMinDays: vehicle.long_stay_discount_min_days || null,
              vehicleLongStayDiscountPercentage: vehicle.long_stay_discount_percentage || null,
            };

            // Email au locataire avec PDF
            if (user.email) {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'vehicle_booking_confirmed_renter',
                  to: user.email,
                  data: emailData
                }
              });
            }

            // Email au propriétaire avec PDF
            if (ownerProfile?.email) {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'vehicle_booking_confirmed_owner',
                  to: ownerProfile.email,
                  data: emailData
                }
              });
            }

            // Email à l'admin
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_booking_confirmed_admin',
                to: 'contact@akwahome.com',
                data: emailData
              }
            });
          } else {
            // Réservation sur demande - Envoyer les emails de demande
            // Calculer le revenu net du propriétaire (prix après réduction - commission avec TVA)
            const hostCommissionData = calculateHostCommission(basePrice, 'vehicle');
            const ownerNetRevenue = basePrice - hostCommissionData.hostCommission;
            
            console.log('📧 [useVehicleBookings] Calcul revenu net propriétaire:', {
              basePrice,
              totalPrice,
              ownerNetRevenue,
              commission: Math.round(basePrice * 0.02),
              rentalDays
            });
            
            const emailData = {
              bookingId: booking.id,
              vehicleTitle: vehicleTitle,
              vehicleBrand: vehicleInfo.brand || '',
              vehicleModel: vehicleInfo.model || '',
              vehicleYear: vehicle?.year || '',
              fuelType: vehicle?.fuel_type || '',
              renterName: renterName,
              renterEmail: user.email || '',
              renterPhone: renterProfile.phone || '',
              ownerName: ownerName,
              ownerEmail: ownerProfile?.email || '',
              ownerPhone: ownerProfile?.phone || '',
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              startDateTime: bookingData.startDateTime,
              endDateTime: bookingData.endDateTime,
              rentalDays: rentalDays,
              rentalHours: rentalHours || 0,
              dailyRate: booking.daily_rate || vehicle?.price_per_day || 0,
              hourlyRate: hourlyRate || vehicle?.price_per_hour || 0,
              basePrice: basePrice, // Prix après réduction (pour calculer le revenu net)
              totalPrice: totalPrice,
              ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire
              securityDeposit: vehicle?.security_deposit ?? booking.security_deposit ?? 0,
              pickupLocation: bookingData.pickupLocation || '',
              message: bookingData.messageToOwner || '',
              isInstantBooking: false,
              paymentMethod: bookingData.paymentMethod || booking.payment_method || '',
              discountAmount: discountAmount || 0, // Montant de la réduction
              vehicleDiscountEnabled: vehicle.discount_enabled || false,
              vehicleDiscountMinDays: vehicle.discount_min_days || null,
              vehicleDiscountPercentage: vehicle.discount_percentage || null,
              vehicleLongStayDiscountEnabled: vehicle.long_stay_discount_enabled || false,
              vehicleLongStayDiscountMinDays: vehicle.long_stay_discount_min_days || null,
              vehicleLongStayDiscountPercentage: vehicle.long_stay_discount_percentage || null,
            };
            
            console.log('📧 [useVehicleBookings] Email data envoyé:', {
              basePrice: emailData.basePrice,
              totalPrice: emailData.totalPrice,
              ownerNetRevenue: emailData.ownerNetRevenue
            });

            // Email au locataire (demande envoyée)
            if (user.email) {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'vehicle_booking_request_sent',
                  to: user.email,
                  data: emailData
                }
              });
            }

            // Email au propriétaire (nouvelle demande)
            if (ownerProfile?.email) {
              await supabase.functions.invoke('send-email', {
                body: {
                  type: 'vehicle_booking_request',
                  to: ownerProfile.email,
                  data: emailData
                }
              });
            }
          }

          console.log('✅ [useVehicleBookings] Emails de réservation envoyés');
        }
      } catch (emailError) {
        console.error('❌ [useVehicleBookings] Erreur envoi email:', emailError);
        // Ne pas faire échouer la réservation si l'email échoue
      }

      return { success: true, booking, status: booking.status };
    } catch (err: any) {
      console.error('Erreur lors de la création de la réservation:', err);
      setError(err.message || 'Erreur lors de la création de la réservation');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [hasUploadedIdentity, isVerified, identityLoading]);

  const getMyBookings = useCallback(async (): Promise<VehicleBooking[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { data, error: queryError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images,
            owner_id,
            location:locations (
              id,
              name
            ),
            vehicle_photos (
              id,
              url,
              is_main
            ),
            owner:profiles!owner_id (
              user_id,
              first_name,
              last_name,
              email,
              phone,
              avatar_url
            )
          ),
          renter:profiles!renter_id (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          ),
          license_documents (
            id,
            document_url,
            document_type,
            verified,
            verified_at
          )
        `)
        .eq('renter_id', user.id)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      return (data || []) as VehicleBooking[];
    } catch (err: any) {
      console.error('Erreur lors du chargement des réservations:', err);
      setError(err.message || 'Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getVehicleBookings = useCallback(async (vehicleId: string): Promise<VehicleBooking[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Vérifier que l'utilisateur est le propriétaire du véhicule
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('owner_id')
        .eq('id', vehicleId)
        .single();

      if (vehicleError || !vehicle) {
        throw new Error('Véhicule introuvable');
      }

      if (vehicle.owner_id !== user.id) {
        throw new Error('Vous n\'êtes pas autorisé à voir ces réservations');
      }

      const { data, error: queryError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images,
            owner_id,
            location:locations (
              id,
              name
            ),
            vehicle_photos (
              id,
              url,
              is_main
            )
          ),
          renter:profiles!vehicle_bookings_renter_id_fkey (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          ),
          license_documents (
            id,
            document_url,
            document_type,
            verified,
            verified_at
          )
        `)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      // Charger les informations du propriétaire si le véhicule existe
      if (data && data.length > 0 && data[0].vehicle?.owner_id) {
        const ownerId = data[0].vehicle.owner_id;
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email, phone, avatar_url')
          .eq('user_id', ownerId)
          .single();

        if (ownerData) {
          // Enrichir toutes les réservations avec les informations du propriétaire
          const enrichedData = data.map((booking: any) => ({
            ...booking,
            vehicle: booking.vehicle ? {
              ...booking.vehicle,
              owner: ownerData
            } : undefined
          }));

          return enrichedData as VehicleBooking[];
        }
      }

      return (data || []) as VehicleBooking[];
    } catch (err: any) {
      console.error('Erreur lors du chargement des réservations:', err);
      setError(err.message || 'Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBookingStatus = useCallback(async (
    bookingId: string,
    status: VehicleBookingStatus
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer la réservation avec toutes les informations nécessaires
      const { data: booking, error: fetchError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            year,
            fuel_type,
            owner_id
          ),
          renter:profiles!renter_id (
            user_id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('id', bookingId)
        .single();

      if (fetchError || !booking) {
        throw fetchError || new Error('Réservation introuvable');
      }

      // Mettre à jour le statut
      const { data: updatedBooking, error: updateError } = await supabase
        .from('vehicle_bookings')
        .update({ status })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Si la réservation est confirmée, envoyer les emails
      if (status === 'confirmed') {
        try {
          // Récupérer les informations du propriétaire
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('user_id', (booking.vehicle as any).owner_id)
            .single();

          const vehicle = booking.vehicle as any;
          const renter = booking.renter as any;
          const vehicleTitle = vehicle?.title || `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim();
          const renterName = `${renter?.first_name || ''} ${renter?.last_name || ''}`.trim() || 'Locataire';
          const ownerName = `${ownerProfile?.first_name || ''} ${ownerProfile?.last_name || ''}`.trim() || 'Propriétaire';

          const formatDate = (dateString: string) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
          };

          // Calculer le revenu net du propriétaire
          // totalPrice = basePrice + serviceFee (10% + 20% TVA = 12% de basePrice)
          // Donc : basePrice = totalPrice / 1.12
          const calculatedBasePrice = Math.round((booking.total_price || 0) / 1.12);
          const hostCommissionData = calculateHostCommission(calculatedBasePrice, 'vehicle');
          const ownerNetRevenue = calculatedBasePrice - hostCommissionData.hostCommission;

          const emailData = {
            bookingId: booking.id,
            vehicleTitle: vehicleTitle,
            vehicleBrand: vehicle?.brand || '',
            vehicleModel: vehicle?.model || '',
            vehicleYear: vehicle?.year || '',
            fuelType: vehicle?.fuel_type || '',
            renterName: renterName,
            renterEmail: renter?.email || '',
            renterPhone: renter?.phone || '',
            ownerName: ownerName,
            ownerEmail: ownerProfile?.email || '',
            ownerPhone: ownerProfile?.phone || '',
            startDate: formatDate(booking.start_date),
            endDate: formatDate(booking.end_date),
            startDateTime: booking.start_datetime || undefined, // Ajouté pour corriger NaN NaN
            endDateTime: booking.end_datetime || undefined, // Ajouté pour corriger NaN NaN
            rentalDays: booking.rental_days,
            rentalHours: booking.rental_hours || 0,
            dailyRate: booking.daily_rate,
            hourlyRate: booking.hourly_rate || vehicle?.price_per_hour || 0,
            basePrice: calculatedBasePrice, // Prix après réduction (calculé à partir de totalPrice)
            totalPrice: booking.total_price,
            ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire
            securityDeposit: booking.security_deposit || 0,
            pickupLocation: booking.pickup_location || '',
            isInstantBooking: false, // Confirmation manuelle = pas instantanée
            withDriver: vehicle?.with_driver || false, // Ajouté pour afficher si avec chauffeur
          };

          // Email au locataire avec PDF
          if (renter?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_booking_confirmed_renter',
                to: renter.email,
                data: emailData
              }
            });
          }

          // Email au propriétaire avec PDF
          if (ownerProfile?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_booking_confirmed_owner',
                to: ownerProfile.email,
                data: emailData
              }
            });
          }

          // Email à l'admin
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_booking_confirmed_admin',
              to: 'contact@akwahome.com',
              data: emailData
            }
          });

          console.log('✅ [useVehicleBookings] Emails de confirmation envoyés');
        } catch (emailError) {
          console.error('❌ [useVehicleBookings] Erreur envoi email:', emailError);
          // Ne pas faire échouer la mise à jour si l'email échoue
        }
      }

      return { success: true, booking: updatedBooking };
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du statut:', err);
      setError(err.message || 'Erreur lors de la mise à jour du statut');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelBooking = useCallback(async (bookingId: string, reason?: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      const { data, error: updateError } = await supabase
        .from('vehicle_bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
          cancellation_reason: reason || null,
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return { success: true, booking: data };
    } catch (err: any) {
      console.error('Erreur lors de l\'annulation:', err);
      setError(err.message || 'Erreur lors de l\'annulation');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllOwnerBookings = useCallback(async (): Promise<VehicleBooking[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Récupérer tous les véhicules du propriétaire
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('owner_id', user.id);

      if (vehiclesError) {
        throw vehiclesError;
      }

      if (!vehicles || vehicles.length === 0) {
        return [];
      }

      const vehicleIds = vehicles.map(v => v.id);

      // Récupérer toutes les réservations pour ces véhicules
      const { data, error: queryError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles (
            id,
            title,
            brand,
            model,
            images,
            owner_id,
            location:locations (
              id,
              name
            ),
            vehicle_photos (
              id,
              url,
              is_main
            )
          ),
          renter:profiles!vehicle_bookings_renter_id_fkey (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            avatar_url
          ),
          license_documents (
            id,
            document_url,
            document_type,
            verified,
            verified_at
          )
        `)
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      // Charger les informations du propriétaire pour chaque véhicule
      if (data && data.length > 0) {
        const ownerIds = [...new Set(data.map((b: any) => b.vehicle?.owner_id).filter(Boolean))];
        if (ownerIds.length > 0) {
          const { data: ownersData } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, email, phone, avatar_url')
            .in('user_id', ownerIds);

          const ownersMap = new Map((ownersData || []).map((o: any) => [o.user_id, o]));

          // Enrichir les données avec les informations du propriétaire
          const enrichedData = data.map((booking: any) => ({
            ...booking,
            vehicle: booking.vehicle ? {
              ...booking.vehicle,
              owner: ownersMap.get(booking.vehicle.owner_id) || undefined
            } : undefined
          }));

          return enrichedData as VehicleBooking[];
        }
      }

      if (queryError) {
        throw queryError;
      }

      return (data || []) as VehicleBooking[];
    } catch (err: any) {
      console.error('Erreur lors du chargement des réservations:', err);
      setError(err.message || 'Erreur lors du chargement des réservations');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createBooking,
    getMyBookings,
    getVehicleBookings,
    getAllOwnerBookings,
    updateBookingStatus,
    cancelBooking,
  };
};





