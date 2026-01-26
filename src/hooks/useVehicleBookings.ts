import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { VehicleBooking, VehicleBookingStatus } from '../types';
import { useIdentityVerification } from './useIdentityVerification';
import { calculateTotalPrice, calculateFees } from './usePricing';

export interface VehicleBookingData {
  vehicleId: string;
  startDate: string;
  endDate: string;
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

      // Calculer le nombre de jours (comme sur le site web: différence + 1)
      // Si les dates sont identiques, c'est 1 jour de location
      let rentalDays = 1;
      if (bookingData.startDate !== bookingData.endDate) {
        const start = new Date(bookingData.startDate + 'T00:00:00');
        const end = new Date(bookingData.endDate + 'T00:00:00');
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        rentalDays = diffDays + 1; // Ajouter 1 pour inclure le jour de départ
      }

      // Permettre les locations d'un jour minimum (ex: du 1er au 1er janvier = 1 jour)
      if (rentalDays < 1) {
        throw new Error('La date de fin ne peut pas être avant la date de début');
      }

      // Récupérer les informations du véhicule pour calculer le prix
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('price_per_day, minimum_rental_days, auto_booking, security_deposit, discount_enabled, discount_min_days, discount_percentage, long_stay_discount_enabled, long_stay_discount_min_days, long_stay_discount_percentage')
        .eq('id', bookingData.vehicleId)
        .single();

      if (vehicleError || !vehicle) {
        throw new Error('Véhicule introuvable');
      }

      if (rentalDays < (vehicle.minimum_rental_days || 1)) {
        throw new Error(`La location minimum est de ${vehicle.minimum_rental_days || 1} jour(s)`);
      }

      // Vérifier la disponibilité (pending, confirmed - les réservations terminées ne bloquent pas)
      const { data: existingBookings, error: availabilityError } = await supabase
        .from('vehicle_bookings')
        .select('id, start_date, end_date, status')
        .eq('vehicle_id', bookingData.vehicleId)
        .in('status', ['pending', 'confirmed'])
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (availabilityError) {
        throw availabilityError;
      }

      // Vérifier les dates bloquées manuellement
      const { data: blockedDates, error: blockedError } = await supabase
        .from('vehicle_blocked_dates')
        .select('start_date, end_date, reason')
        .eq('vehicle_id', bookingData.vehicleId)
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (blockedError) {
        console.error('Blocked dates check error:', blockedError);
      }

      // Vérifier les conflits avec les réservations existantes
      const bookingStart = new Date(bookingData.startDate);
      const bookingEnd = new Date(bookingData.endDate);
      
      const hasBookingConflict = existingBookings?.some(booking => {
        const existingStart = new Date(booking.start_date);
        const existingEnd = new Date(booking.end_date);
        
        return (
          (bookingStart <= existingEnd && bookingEnd >= existingStart)
        );
      });

      if (hasBookingConflict) {
        throw new Error('Ce véhicule n\'est pas disponible pour ces dates');
      }

      // Vérifier les conflits avec les dates bloquées
      const hasBlockedConflict = blockedDates?.some(({ start_date, end_date }) => {
        const blockedStart = new Date(start_date);
        const blockedEnd = new Date(end_date);
        
        return (
          (bookingStart <= blockedEnd && bookingEnd >= blockedStart)
        );
      });

      if (hasBlockedConflict) {
        throw new Error('Ces dates sont bloquées par le propriétaire');
      }

      // Calculer le prix total avec réductions et frais de service
      const dailyRate = vehicle.price_per_day;
      
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
      
      // Calculer le prix avec réductions
      const pricing = calculateTotalPrice(dailyRate, rentalDays, discountConfig, longStayDiscountConfig);
      const basePrice = pricing.totalPrice; // Prix après réduction
      
      // Calculer les frais de service (10% du prix après réduction pour les véhicules)
      const fees = calculateFees(basePrice, rentalDays, 'vehicle');
      const totalPrice = basePrice + fees.serviceFee; // Total avec frais de service
      
      // Déterminer le statut initial en fonction de auto_booking
      const initialStatus = (vehicle as any).auto_booking === true ? 'confirmed' : 'pending';

      // Créer la réservation (sans license_document_url qui n'existe pas dans la table)
      // Note: discount_applied et discount_amount n'existent pas dans vehicle_bookings
      const { data: booking, error: bookingError } = await supabase
        .from('vehicle_bookings')
        .insert({
          vehicle_id: bookingData.vehicleId,
          renter_id: user.id,
          start_date: bookingData.startDate,
          end_date: bookingData.endDate,
          rental_days: rentalDays,
          daily_rate: dailyRate,
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
        })
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
            // Calculer le revenu net du propriétaire (prix après réduction - commission 2%)
            const ownerNetRevenue = basePrice - Math.round(basePrice * 0.02);
            
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
              rentalDays: rentalDays,
              dailyRate: booking.daily_rate || vehicle?.price_per_day || 0,
              basePrice: basePrice, // Prix après réduction (pour calculer le revenu net)
              totalPrice: totalPrice,
              ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire
              securityDeposit: vehicle?.security_deposit ?? booking.security_deposit ?? 0,
              pickupLocation: bookingData.pickupLocation || '',
              isInstantBooking: true,
              paymentMethod: bookingData.paymentMethod || booking.payment_method || '',
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
            // Calculer le revenu net du propriétaire (prix après réduction - commission 2%)
            const ownerNetRevenue = basePrice - Math.round(basePrice * 0.02);
            
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
              rentalDays: rentalDays,
              dailyRate: booking.daily_rate || vehicle?.price_per_day || 0,
              basePrice: basePrice, // Prix après réduction (pour calculer le revenu net)
              totalPrice: totalPrice,
              ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire
              securityDeposit: vehicle?.security_deposit ?? booking.security_deposit ?? 0,
              pickupLocation: bookingData.pickupLocation || '',
              message: bookingData.messageToOwner || '',
              isInstantBooking: false,
              paymentMethod: bookingData.paymentMethod || booking.payment_method || '',
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
          // totalPrice = basePrice + serviceFee (10% de basePrice)
          // Donc : basePrice = totalPrice / 1.10
          const calculatedBasePrice = Math.round((booking.total_price || 0) / 1.10);
          const ownerNetRevenue = calculatedBasePrice - Math.round(calculatedBasePrice * 0.02);

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
            rentalDays: booking.rental_days,
            dailyRate: booking.daily_rate,
            basePrice: calculatedBasePrice, // Prix après réduction (calculé à partir de totalPrice)
            totalPrice: booking.total_price,
            ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire
            securityDeposit: booking.security_deposit || 0,
            pickupLocation: booking.pickup_location || '',
            isInstantBooking: false, // Confirmation manuelle = pas instantanée
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





