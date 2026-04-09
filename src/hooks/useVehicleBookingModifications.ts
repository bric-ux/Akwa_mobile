import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';
import { calculateHostCommission } from './usePricing';
import { computeVehicleDriverFee } from '../lib/vehicleDriverFee';
import { getTravelerServiceFeeTtcMultiplier } from '../lib/commissions';

export interface VehicleBookingModificationData {
  bookingId: string;
  requestedStartDate: string;
  requestedEndDate: string;
  requestedStartDateTime?: string;
  requestedEndDateTime?: string;
  requestedRentalDays: number;
  requestedRentalHours?: number;
  requestedTotalPrice: number;
  message?: string;
}

export const useVehicleBookingModifications = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modifyBooking = useCallback(async (data: VehicleBookingModificationData) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Récupérer la réservation actuelle
      const { data: booking, error: bookingError } = await supabase
        .from('vehicle_bookings')
        .select(`
          *,
          vehicle:vehicles!inner(
            id,
            owner_id,
            price_per_day,
            price_per_hour,
            hourly_rental_enabled,
            discount_enabled,
            discount_min_days,
            discount_percentage,
            long_stay_discount_enabled,
            long_stay_discount_min_days,
            long_stay_discount_percentage,
            title,
            brand,
            model
          ),
          renter:profiles!vehicle_bookings_renter_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', data.bookingId)
        .single();

      if (bookingError || !booking) {
        throw new Error('Réservation introuvable');
      }

      // Vérifier que l'utilisateur est le locataire
      if (booking.renter_id !== user.id) {
        throw new Error('Vous n\'êtes pas autorisé à modifier cette réservation');
      }

      // Vérifier que la réservation peut être modifiée
      if (booking.status === 'cancelled' || booking.status === 'completed') {
        throw new Error('Cette réservation ne peut plus être modifiée');
      }

      // Même règle que l’app (VehicleBookingScreen / modal) : créneaux datetime + blocages host
      if (data.requestedStartDateTime && data.requestedEndDateTime) {
        const { data: isAvailable, error: availError } = await supabase.rpc('check_vehicle_hourly_availability', {
          p_vehicle_id: booking.vehicle.id,
          p_start_datetime: data.requestedStartDateTime,
          p_end_datetime: data.requestedEndDateTime,
          p_exclude_booking_id: data.bookingId,
        });
        if (availError) {
          console.error('Erreur vérification disponibilité (RPC):', availError);
          throw new Error('Impossible de vérifier la disponibilité du véhicule');
        }
        if (!isAvailable) {
          throw new Error('Ces dates ne sont pas disponibles pour ce véhicule');
        }
      } else {
        const { data: conflictingBookings, error: conflictError } = await supabase
          .from('vehicle_bookings')
          .select('id, start_date, end_date, status')
          .eq('vehicle_id', booking.vehicle.id)
          .in('status', ['pending', 'confirmed'])
          .neq('id', data.bookingId)
          .or(`and(start_date.lte.${data.requestedEndDate},end_date.gte.${data.requestedStartDate})`);

        if (conflictError) {
          console.error('Erreur vérification disponibilité:', conflictError);
        }

        if (conflictingBookings && conflictingBookings.length > 0) {
          throw new Error('Ces dates ne sont pas disponibles pour ce véhicule');
        }
      }

      // Si la réservation est en attente (pending), mettre à jour directement
      if (booking.status === 'pending') {
        const updateData: any = {
          start_date: data.requestedStartDate,
          end_date: data.requestedEndDate,
          rental_days: data.requestedRentalDays,
          total_price: data.requestedTotalPrice,
          daily_rate: booking.vehicle.price_per_day,
          updated_at: new Date().toISOString(),
        };
        
        // Ajouter les datetime si fournis
        if (data.requestedStartDateTime) {
          updateData.start_datetime = data.requestedStartDateTime;
        }
        if (data.requestedEndDateTime) {
          updateData.end_datetime = data.requestedEndDateTime;
        }
        
        // Ajouter rental_hours si fourni
        if (data.requestedRentalHours !== undefined && data.requestedRentalHours > 0) {
          updateData.rental_hours = data.requestedRentalHours;
          updateData.hourly_rate = booking.vehicle.price_per_hour || 0;
        }
        
        const { error: updateError } = await supabase
          .from('vehicle_bookings')
          .update(updateData)
          .eq('id', data.bookingId);

        if (updateError) {
          throw updateError;
        }

        // Envoyer les emails de notification pour modification de demande en attente
        try {
          const ownerProfile = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', booking.vehicle.owner_id)
            .single();

          const vehicleTitle = booking.vehicle.title || `${booking.vehicle.brand} ${booking.vehicle.model}`;
          const renterName = `${booking.renter?.first_name || ''} ${booking.renter?.last_name || ''}`.trim();

          // Calculer les revenus nets pour l'email (total = base × multiplicateur frais service TTC)
          const vehFeeMult = getTravelerServiceFeeTtcMultiplier('vehicle');
          const oldBasePrice = Math.round((booking.total_price || 0) / vehFeeMult);
          const oldHostCommissionData = calculateHostCommission(oldBasePrice, 'vehicle');
          const oldOwnerNetRevenue = oldBasePrice - oldHostCommissionData.hostCommission;
          
          const newBasePrice = Math.round((data.requestedTotalPrice || 0) / vehFeeMult);
          const newHostCommissionData = calculateHostCommission(newBasePrice, 'vehicle');
          const newOwnerNetRevenue = newBasePrice - newHostCommissionData.hostCommission;

          // Email au propriétaire
          if (ownerProfile.data?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'pending_vehicle_booking_modified_owner',
                to: ownerProfile.data.email,
                data: {
                  ownerName: `${ownerProfile.data.first_name || ''} ${ownerProfile.data.last_name || ''}`.trim() || 'Cher propriétaire',
                  renterName: renterName || 'Un locataire',
                  vehicleTitle: vehicleTitle,
                  oldStartDate: new Date(booking.start_date).toLocaleDateString('fr-FR'),
                  oldEndDate: new Date(booking.end_date).toLocaleDateString('fr-FR'),
                  newStartDate: new Date(data.requestedStartDate).toLocaleDateString('fr-FR'),
                  newEndDate: new Date(data.requestedEndDate).toLocaleDateString('fr-FR'),
                  oldRentalDays: booking.rental_days,
                  oldRentalHours: booking.rental_hours || 0,
                  newRentalDays: data.requestedRentalDays,
                  newRentalHours: data.requestedRentalHours || 0,
                  oldTotalPrice: booking.total_price,
                  oldBasePrice: oldBasePrice,
                  oldOwnerNetRevenue: oldOwnerNetRevenue,
                  newTotalPrice: data.requestedTotalPrice,
                  newBasePrice: newBasePrice,
                  newOwnerNetRevenue: newOwnerNetRevenue,
                  message: data.message || null,
                  payment_currency: (booking as any).payment_currency || undefined,
                  exchange_rate: (booking as any).exchange_rate || undefined
                },
              },
            });
          }

          // Email au locataire
          if (booking.renter?.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'pending_vehicle_booking_modified_renter',
                to: booking.renter.email,
                data: {
                  renterName: renterName || 'Cher client',
                  vehicleTitle: vehicleTitle,
                  oldStartDate: new Date(booking.start_date).toLocaleDateString('fr-FR'),
                  oldEndDate: new Date(booking.end_date).toLocaleDateString('fr-FR'),
                  newStartDate: new Date(data.requestedStartDate).toLocaleDateString('fr-FR'),
                  newEndDate: new Date(data.requestedEndDate).toLocaleDateString('fr-FR'),
                  oldRentalDays: booking.rental_days,
                  oldRentalHours: booking.rental_hours || 0,
                  newRentalDays: data.requestedRentalDays,
                  newRentalHours: data.requestedRentalHours || 0,
                  oldTotalPrice: booking.total_price,
                  newTotalPrice: data.requestedTotalPrice,
                  payment_currency: (booking as any).payment_currency || undefined,
                  exchange_rate: (booking as any).exchange_rate || undefined
                },
              },
            });
          }
        } catch (emailError) {
          console.error('Erreur envoi email modification:', emailError);
          // Ne pas faire échouer la modification si l'email échoue
        }

        return { success: true };
      }

      // ✅ Calculer le surplus (différence entre nouveau et ancien total)
      const originalTotalPrice = booking.total_price || 0;
      const requestedTotalPrice = data.requestedTotalPrice || 0;
      const surplusAmount = requestedTotalPrice - originalTotalPrice; // Surplus payé par le locataire
      
      // ✅ Calculer le surplus net propriétaire (surplus - commission)
      const surplusFeeMult = getTravelerServiceFeeTtcMultiplier('vehicle');
      const surplusBasePrice = surplusAmount > 0 ? Math.round(surplusAmount / surplusFeeMult) : 0;
      const surplusHostCommissionData = surplusBasePrice > 0 ? calculateHostCommission(surplusBasePrice, 'vehicle') : { hostCommission: 0, hostCommissionHT: 0, hostCommissionVAT: 0 };
      const surplusNetOwner = surplusBasePrice - surplusHostCommissionData.hostCommission;
      
      // Pour les réservations confirmées, créer une demande de modification
      const requestData: any = {
        booking_id: data.bookingId,
        renter_id: user.id,
        owner_id: booking.vehicle.owner_id,
        original_start_date: booking.start_date,
        original_end_date: booking.end_date,
        original_rental_days: booking.rental_days,
        original_total_price: booking.total_price,
        requested_start_date: data.requestedStartDate,
        requested_end_date: data.requestedEndDate,
        requested_rental_days: data.requestedRentalDays,
        requested_total_price: data.requestedTotalPrice,
        surplus_amount: surplusAmount, // ✅ Stocker le surplus locataire
        surplus_net_owner: surplusNetOwner, // ✅ Stocker le surplus net propriétaire
        renter_message: data.message || null,
        status: 'pending'
      };
      
      // Ajouter les datetime et heures originales si disponibles
      if (booking.start_datetime) {
        requestData.original_start_datetime = booking.start_datetime;
      }
      if (booking.end_datetime) {
        requestData.original_end_datetime = booking.end_datetime;
      }
      if (booking.rental_hours !== undefined && booking.rental_hours > 0) {
        requestData.original_rental_hours = booking.rental_hours;
      }
      
      // Ajouter les datetime et heures demandées si fournis
      if (data.requestedStartDateTime) {
        requestData.requested_start_datetime = data.requestedStartDateTime;
      }
      if (data.requestedEndDateTime) {
        requestData.requested_end_datetime = data.requestedEndDateTime;
      }
      if (data.requestedRentalHours !== undefined && data.requestedRentalHours > 0) {
        requestData.requested_rental_hours = data.requestedRentalHours;
      }
      
      const { data: modificationRequest, error: createRequestError } = await supabase
        .from('vehicle_booking_modification_requests')
        .insert(requestData)
        .select()
        .single();

      if (createRequestError) {
        throw createRequestError;
      }

      // Envoyer les emails de notification pour modification de réservation confirmée
      try {
        const [ownerResult, renterResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', booking.vehicle.owner_id)
            .single(),
          supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', user.id)
            .single()
        ]);

        const ownerProfile = ownerResult.data;
        const renterProfile = renterResult.data;
        const vehicleTitle = booking.vehicle.title || `${booking.vehicle.brand} ${booking.vehicle.model}`;
        const renterName = renterProfile 
          ? `${renterProfile.first_name || ''} ${renterProfile.last_name || ''}`.trim() 
          : 'Un locataire';

        // ✅ Le surplus est déjà calculé plus haut (ligne ~210)
        // Utiliser les valeurs calculées : surplusAmount et surplusNetOwner

        // Email au propriétaire
        if (ownerProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_modification_requested',
              to: ownerProfile.email,
              data: {
                ownerName: `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'Cher propriétaire',
                renterName: renterName,
                vehicleTitle: vehicleTitle,
                originalStartDate: booking.start_date,
                originalEndDate: booking.end_date,
                originalStartDateTime: booking.start_datetime || undefined,
                originalEndDateTime: booking.end_datetime || undefined,
                originalDays: booking.rental_days ?? 0,
                originalHours: booking.rental_hours || 0,
                originalPrice: booking.total_price,
                requestedStartDate: data.requestedStartDate,
                requestedEndDate: data.requestedEndDate,
                requestedStartDateTime: data.requestedStartDateTime || undefined,
                requestedEndDateTime: data.requestedEndDateTime || undefined,
                requestedDays: data.requestedRentalDays,
                requestedHours: data.requestedRentalHours || 0,
                requestedPrice: data.requestedTotalPrice,
                surplusAmount: surplusAmount, // ✅ Surplus payé par le locataire (seulement le surplus, pas le total)
                surplusNetOwner: surplusNetOwner, // ✅ Surplus net reçu par le propriétaire (seulement le surplus net, pas le total)
                renterMessage: data.message || null,
                bookingId: booking.id,
                payment_currency: (booking as any).payment_currency || undefined,
                exchange_rate: (booking as any).exchange_rate || undefined
              },
            },
          });
          console.log('✅ Email de demande de modification envoyé au propriétaire:', ownerProfile.email);
        }

        // Email au locataire (confirmation de sa demande)
        if (renterProfile?.email) {
          try {
            const emailData = {
              renterName: renterName || 'Cher client',
              vehicleTitle: vehicleTitle,
              vehicleBrand: booking.vehicle.brand || '',
              vehicleModel: booking.vehicle.model || '',
              originalStartDate: booking.start_date,
              originalEndDate: booking.end_date,
              originalStartDateTime: booking.start_datetime || undefined,
              originalEndDateTime: booking.end_datetime || undefined,
              originalDays: booking.rental_days ?? 0,
              originalHours: booking.rental_hours || 0,
              originalPrice: booking.total_price,
              requestedStartDate: data.requestedStartDate,
              requestedEndDate: data.requestedEndDate,
              requestedStartDateTime: data.requestedStartDateTime || undefined,
              requestedEndDateTime: data.requestedEndDateTime || undefined,
              requestedDays: data.requestedRentalDays,
              requestedHours: data.requestedRentalHours || 0,
              requestedPrice: data.requestedTotalPrice,
              surplusAmount: surplusAmount, // ✅ Surplus payé par le locataire
              dailyRate: booking.vehicle.price_per_day || booking.daily_rate || 0,
              bookingId: booking.id,
              payment_currency: (booking as any).payment_currency || undefined,
              exchange_rate: (booking as any).exchange_rate || undefined
            };
            
            if (__DEV__) console.log('📧 [useVehicleBookingModifications] Envoi email au locataire:', {
              to: renterProfile.email,
              type: 'vehicle_modification_request_sent',
              data: emailData
            });
            
            const emailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_modification_request_sent',
                to: renterProfile.email,
                data: emailData,
              },
            });
            
            if (emailResponse.error) {
              console.error('❌ [useVehicleBookingModifications] Erreur envoi email au locataire:', emailResponse.error);
              console.error('❌ [useVehicleBookingModifications] Détails erreur:', JSON.stringify(emailResponse.error, null, 2));
            } else {
              if (__DEV__) console.log('✅ [useVehicleBookingModifications] Email de confirmation envoyé au locataire:', renterProfile.email);
              if (__DEV__) console.log('✅ [useVehicleBookingModifications] Réponse email:', emailResponse.data);
            }
          } catch (renterEmailError: any) {
            console.error('❌ [useVehicleBookingModifications] Erreur lors de l\'envoi de l\'email au locataire:', renterEmailError);
            console.error('❌ [useVehicleBookingModifications] Stack:', renterEmailError.stack);
          }
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email modification:', emailError);
        // Ne pas faire échouer la création si l'email échoue
      }

      return { success: true };
    } catch (err: any) {
      console.error('Erreur lors de la modification:', err);
      setError(err.message || 'Erreur lors de la modification');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Récupérer les demandes en attente pour un propriétaire
  const getPendingRequestsForOwner = useCallback(async (ownerId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_booking_modification_requests')
        .select(`
          *,
          booking:vehicle_bookings(
            id,
            status
          )
        `)
        .eq('owner_id', ownerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrer pour exclure les demandes concernant des réservations en statut "pending"
      const filteredData = (data || []).filter((request: any) => {
        return request.booking?.status !== 'pending';
      });

      return filteredData as any[];
    } catch (error) {
      console.error('Erreur récupération demandes en attente:', error);
      return [];
    }
  }, []);

  // Récupérer la demande en attente pour une réservation (prend la plus récente si plusieurs)
  const getBookingPendingRequest = useCallback(async (bookingId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_booking_modification_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur vérification demande en cours:', error);
      return null;
    }
  }, []);

  // Approuver une demande de modification
  const approveModificationRequest = useCallback(async (requestId: string, ownerMessage?: string) => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer la demande avec toutes les données nécessaires
      const { data: request, error: fetchError } = await supabase
        .from('vehicle_booking_modification_requests')
        .select(`
          *,
          surplus_amount,
          surplus_net_owner,
          booking:vehicle_bookings(
            id,
            vehicle_id,
            renter_id,
            daily_rate,
            hourly_rate,
            rental_hours,
            pickup_location,
            security_deposit,
            host_net_amount,
            vehicles(
              id,
              brand,
              model,
              year,
              fuel_type,
              owner_id,
              price_per_day,
              price_per_hour,
              hourly_rental_enabled,
              driver_fee,
              with_driver,
              discount_enabled,
              discount_min_days,
              discount_percentage,
              long_stay_discount_enabled,
              long_stay_discount_min_days,
              long_stay_discount_percentage,
              security_deposit
            ),
            renter:profiles!vehicle_bookings_renter_id_fkey(
              first_name,
              last_name,
              email,
              phone
            )
          )
        `)
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new Error('Demande de modification introuvable');
      }

      // Mettre à jour la réservation
      const updateData: any = {
        start_date: request.requested_start_date,
        end_date: request.requested_end_date,
        rental_days: request.requested_rental_days,
        total_price: request.requested_total_price,
        updated_at: new Date().toISOString()
      };
      
      // Ajouter les datetime si disponibles
      if (request.requested_start_datetime) {
        updateData.start_datetime = request.requested_start_datetime;
      }
      if (request.requested_end_datetime) {
        updateData.end_datetime = request.requested_end_datetime;
      }
      
      // Ajouter rental_hours si disponible
      if (request.requested_rental_hours !== undefined && request.requested_rental_hours > 0) {
        updateData.rental_hours = request.requested_rental_hours;
        // Récupérer le prix par heure du véhicule
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('price_per_hour')
          .eq('id', request.booking.vehicle_id)
          .single();
        if (vehicleData?.price_per_hour) {
          updateData.hourly_rate = vehicleData.price_per_hour;
        }
      }
      
      // ✅ Récupérer le véhicule AVANT de l'utiliser
      const bookingData = request.booking;
      let vehicle = bookingData?.vehicles;
      
      if (!vehicle) {
        // Récupérer le véhicule depuis la base si pas dans la requête
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', bookingData.vehicle_id)
          .single();
        if (vehicleData) {
          vehicle = vehicleData;
        } else {
          throw new Error('Véhicule introuvable');
        }
      }
      
      // ✅ Récupérer le surplus depuis la demande (déjà calculé lors de la création)
      const surplusAmount = request.surplus_amount || 0; // Surplus payé par le locataire
      const surplusNetOwner = request.surplus_net_owner || 0; // Surplus net reçu par le propriétaire
      
      // Calculer host_net_amount pour la modification (nouveau total)
      const totalWithServiceFee = request.requested_total_price;
      const approveFeeMult = getTravelerServiceFeeTtcMultiplier('vehicle');
      const priceAfterDiscountWithDriver = Math.round(totalWithServiceFee / approveFeeMult);
      const hostCommissionData = calculateHostCommission(priceAfterDiscountWithDriver, 'vehicle');
      const newHostNetAmount = priceAfterDiscountWithDriver - hostCommissionData.hostCommission;
      
      // ✅ Le host_net_amount final = ancien host_net_amount + surplus net
      // OU = nouveau host_net_amount calculé (les deux devraient être équivalents)
      const originalHostNetAmount = request.booking.host_net_amount || 0;
      const finalHostNetAmount = originalHostNetAmount + (surplusAmount > 0 ? surplusNetOwner : 0);
      
      // Ajouter host_net_amount à updateData
      updateData.host_net_amount = finalHostNetAmount;

      const { error: updateBookingError } = await supabase
        .from('vehicle_bookings')
        .update(updateData)
        .eq('id', request.booking_id);

      if (updateBookingError) throw updateBookingError;

      // ✅ Mettre à jour booking_calculation_details
      const { updateVehicleBookingCalculationDetails } = await import('../lib/updateBookingCalculationDetails');
      await updateVehicleBookingCalculationDetails(
        request.booking_id,
        {
          start_date: request.requested_start_date,
          end_date: request.requested_end_date,
          total_price: request.requested_total_price,
          rental_days: request.requested_rental_days,
          rental_hours: request.requested_rental_hours,
          daily_rate: request.booking.daily_rate,
          hourly_rate: request.booking.hourly_rate,
          discount_amount: request.booking.discount_amount,
          discount_applied: request.booking.discount_applied,
          original_total: request.booking.original_total,
          with_driver: request.booking.with_driver,
          payment_currency: (request.booking as any).payment_currency,
          payment_method: (request.booking as any).payment_method,
        },
        {
          price_per_day: vehicle?.price_per_day || 0,
          price_per_hour: vehicle?.price_per_hour,
          driver_fee: vehicle?.driver_fee,
          with_driver: vehicle?.with_driver,
          discount_enabled: vehicle?.discount_enabled,
          discount_min_days: vehicle?.discount_min_days,
          discount_percentage: vehicle?.discount_percentage,
          long_stay_discount_enabled: vehicle?.long_stay_discount_enabled,
          long_stay_discount_min_days: vehicle?.long_stay_discount_min_days,
          long_stay_discount_percentage: vehicle?.long_stay_discount_percentage,
          security_deposit: vehicle?.security_deposit,
        },
        request.booking.status || 'confirmed'
      );

      // Mettre à jour le statut de la demande
      const { error: updateError } = await supabase
        .from('vehicle_booking_modification_requests')
        .update({
          status: 'approved',
          owner_response_message: ownerMessage || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Envoyer les emails avec justificatifs
      try {
        const renter = bookingData?.renter;
        
        if (!vehicle || !renter) {
          throw new Error('Données de réservation incomplètes');
        }

        const vehicleTitle = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim();
        const renterName = `${renter.first_name || ''} ${renter.last_name || ''}`.trim() || 'Locataire';
        
        // Récupérer les infos du propriétaire
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, phone')
          .eq('user_id', vehicle.owner_id)
          .single();

        const ownerName = ownerProfile 
          ? `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() 
          : 'Propriétaire';

        // BUG FIX: Calculer correctement le prix après réduction et la réduction
        // request.requested_total_price est le total payé par le locataire (inclut les frais de service = 12% TTC)
        const dailyRate = bookingData.daily_rate || vehicle.price_per_day || 0;
        const hourlyRate = request.requested_rental_hours && request.requested_rental_hours > 0 
          ? (bookingData.hourly_rate || vehicle.price_per_hour || 0)
          : 0;
        const rentalHours = request.requested_rental_hours || 0;
        const daysPrice = dailyRate * request.requested_rental_days;
        const hoursPrice = rentalHours > 0 && hourlyRate > 0 ? rentalHours * hourlyRate : 0;
        const driverFeePerDay = (bookingData.with_driver && vehicle.driver_fee) ? Number(vehicle.driver_fee) : 0;
        const reqDays = request.requested_rental_days || 0;
        const reqHours = request.requested_rental_hours || 0;
        const driverFee =
          driverFeePerDay > 0 ? computeVehicleDriverFee(driverFeePerDay, reqDays, reqHours) : 0;
        
        // Calculer le prix avant réduction (jours + heures uniquement, SANS chauffeur)
        const totalBeforeDiscount = daysPrice + hoursPrice;
        
        const emailFeeMult = getTravelerServiceFeeTtcMultiplier('vehicle');
        const totalWithServiceFee = request.requested_total_price; // Total payé par locataire
        const priceAfterDiscountWithDriver = Math.round(totalWithServiceFee / emailFeeMult);
        
        // Calculer le prix après réduction (sans chauffeur)
        const priceAfterDiscount = priceAfterDiscountWithDriver - driverFee;
        
        // Calculer la réduction sur (jours + heures) uniquement
        const discountAmount = totalBeforeDiscount - priceAfterDiscount;
        
        // Calculer le revenu net du propriétaire
        // IMPORTANT: La commission est calculée sur priceAfterDiscountWithDriver (inclut le chauffeur)
        // IMPORTANT: La caution n'est PAS incluse dans le revenu net car elle est payée en espèces
        const hostCommissionData = calculateHostCommission(priceAfterDiscountWithDriver, 'vehicle');
        const securityDeposit = bookingData?.security_deposit || vehicle?.security_deposit || 0;
        const ownerNetRevenue = priceAfterDiscountWithDriver - hostCommissionData.hostCommission;
        
        const emailData = {
          bookingId: request.booking_id,
          vehicleTitle: vehicleTitle,
          vehicleBrand: vehicle.brand || '',
          vehicleModel: vehicle.model || '',
          vehicleYear: vehicle.year || '',
          fuelType: vehicle.fuel_type || '',
          renterName: renterName,
          renterEmail: renter.email || '',
          renterPhone: renter.phone || '',
          ownerName: ownerName,
          ownerEmail: ownerProfile?.email || '',
          ownerPhone: ownerProfile?.phone || '',
          startDate: request.requested_start_date,
          endDate: request.requested_end_date,
          rentalDays: request.requested_rental_days,
          rentalHours: rentalHours,
          dailyRate: dailyRate,
          hourlyRate: hourlyRate,
          basePrice: priceAfterDiscountWithDriver, // Prix après réduction + chauffeur
          totalPrice: request.requested_total_price,
          discountAmount: discountAmount, // Réduction sur (jours + heures) uniquement
          ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire
          securityDeposit: securityDeposit,
          driverFee: driverFee, // Ajouter le surplus chauffeur pour le PDF
          pickupLocation: bookingData.pickup_location || '',
          isInstantBooking: false,
          withDriver: bookingData.with_driver || false,
          // BUG FIX: Ajouter les données de réduction pour que le PDF puisse recalculer correctement
          vehicleDiscountEnabled: vehicle.discount_enabled || false,
          vehicleDiscountMinDays: vehicle.discount_min_days || null,
          vehicleDiscountPercentage: vehicle.discount_percentage || null,
          vehicleLongStayDiscountEnabled: vehicle.long_stay_discount_enabled || false,
          vehicleLongStayDiscountMinDays: vehicle.long_stay_discount_min_days || null,
          vehicleLongStayDiscountPercentage: vehicle.long_stay_discount_percentage || null,
          payment_currency: (bookingData as any).payment_currency || undefined,
          exchange_rate: (bookingData as any).exchange_rate || undefined
        };

        // Email au locataire avec PDF
        if (renter.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_booking_confirmed_renter',
              to: renter.email,
              data: {
                ...emailData,
                isModification: true,
              }
            }
          });
          console.log('✅ Email avec PDF envoyé au locataire');
        }

        // Email au propriétaire avec PDF
        if (ownerProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_booking_confirmed_owner',
              to: ownerProfile.email,
              data: {
                ...emailData,
                isModification: true,
              }
            }
          });
          console.log('✅ Email avec PDF envoyé au propriétaire');
        }

        // Email à l'admin avec les deux PDFs
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'vehicle_booking_confirmed_admin',
            to: 'contact@akwahome.com',
            data: {
              ...emailData,
              isModification: true,
            }
          }
        });
        console.log('✅ Email avec PDFs envoyé à l\'admin');
      } catch (emailError) {
        console.error('❌ Erreur envoi emails approbation:', emailError);
        // Ne pas faire échouer l'approbation si l'email échoue
      }

      Alert.alert('Succès', 'La modification a été approuvée et les justificatifs ont été envoyés.');
      return { success: true };
    } catch (err: any) {
      console.error('Erreur approbation:', err);
      setError(err.message || 'Erreur lors de l\'approbation');
      Alert.alert('Erreur', err.message || 'Impossible d\'approuver la modification');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Refuser une demande de modification
  const rejectModificationRequest = useCallback(async (requestId: string, ownerMessage?: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: request, error: fetchError } = await supabase
        .from('vehicle_booking_modification_requests')
        .select(`
          *,
          booking:vehicle_bookings(
            vehicles(
              brand,
              model
            ),
            renter:profiles!vehicle_bookings_renter_id_fkey(
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new Error('Demande de modification introuvable');
      }

      // Mettre à jour le statut de la demande
      const { error: updateError } = await supabase
        .from('vehicle_booking_modification_requests')
        .update({
          status: 'rejected',
          owner_response_message: ownerMessage || null,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Envoyer un email au locataire
      try {
        const renter = request.booking?.renter;
        const vehicle = request.booking?.vehicles;
        
        if (renter?.email) {
          const booking = request.booking as any;
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_modification_rejected',
              to: renter.email,
              data: {
                renterName: `${renter.first_name || ''} ${renter.last_name || ''}`.trim() || 'Cher client',
                vehicleTitle: `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Véhicule',
                ownerMessage: ownerMessage || null,
                bookingId: request.booking_id,
                originalStartDate: booking?.start_date,
                originalEndDate: booking?.end_date,
                originalStartDateTime: booking?.start_datetime,
                originalEndDateTime: booking?.end_datetime,
                originalDays: booking?.rental_days,
                originalHours: booking?.rental_hours || 0,
                originalPrice: booking?.total_price,
                payment_currency: booking?.payment_currency || undefined,
                exchange_rate: booking?.exchange_rate || undefined
              }
            }
          });
          console.log('✅ Email de refus envoyé au locataire');
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi email refus:', emailError);
      }

      Alert.alert('Succès', 'La demande de modification a été refusée.');
      return { success: true };
    } catch (err: any) {
      console.error('Erreur refus:', err);
      setError(err.message || 'Erreur lors du refus');
      Alert.alert('Erreur', err.message || 'Impossible de refuser la modification');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Annuler une demande de modification
  const cancelModificationRequest = useCallback(async (requestId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer la demande avant de l'annuler pour les emails
      const { data: request, error: fetchError } = await supabase
        .from('vehicle_booking_modification_requests')
        .select(`
          *,
          booking:vehicle_bookings(
            vehicles(
              brand,
              model,
              owner_id
            ),
            renter:profiles!vehicle_bookings_renter_id_fkey(
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new Error('Demande de modification introuvable');
      }

      // Mettre à jour le statut
      const { error: updateError } = await supabase
        .from('vehicle_booking_modification_requests')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Envoyer les emails de notification
      try {
        if (__DEV__) console.log('📧 [cancelModificationRequest] Données récupérées:', {
          requestId,
          bookingId: request.booking_id,
          renterId: request.renter_id,
          ownerId: request.owner_id,
          hasBooking: !!request.booking,
          hasVehicle: !!request.booking?.vehicles,
        });

        const renter = request.booking?.renter;
        const vehicle = request.booking?.vehicles;
        const vehicleTitle = vehicle ? `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() : 'Véhicule';

        // Récupérer le profil du propriétaire
        // Essayer d'abord depuis vehicle.owner_id, sinon depuis request.owner_id
        let ownerProfile = null;
        const ownerId = vehicle?.owner_id || request.owner_id;
        
        if (ownerId) {
          const { data: owner, error: ownerError } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', ownerId)
            .single();
          
          if (ownerError) {
            console.error('❌ [cancelModificationRequest] Erreur récupération profil propriétaire:', ownerError);
          } else {
            ownerProfile = owner;
          }
        }

        if (__DEV__) console.log('📧 [cancelModificationRequest] Profils récupérés:', {
          ownerProfile: ownerProfile ? { email: ownerProfile.email, name: `${ownerProfile.first_name} ${ownerProfile.last_name}` } : null,
          renter: renter ? { email: renter.email, name: `${renter.first_name} ${renter.last_name}` } : null,
        });

        // Email au propriétaire (même type que la fonction Edge expire-pending-requests)
        if (ownerProfile?.email) {
          try {
            const formatDate = (dateStr: string) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            };

            const emailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_modification_cancelled_owner',
                to: ownerProfile.email,
                data: {
                  ownerName: `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'Cher propriétaire',
                  renterName: renter ? `${renter.first_name || ''} ${renter.last_name || ''}`.trim() : 'Un locataire',
                  vehicleTitle: vehicleTitle,
                  originalStartDate: request.original_start_date,
                  originalEndDate: request.original_end_date,
                  originalDays: request.original_rental_days,
                  originalPrice: request.original_total_price
                }
              }
            });
            
            if (emailResponse.error) {
              console.error('❌ [cancelModificationRequest] Erreur envoi email au propriétaire:', emailResponse.error);
            } else {
              if (__DEV__) console.log('✅ [cancelModificationRequest] Email d\'annulation envoyé au propriétaire:', ownerProfile.email);
            }
          } catch (ownerEmailError: any) {
            console.error('❌ [cancelModificationRequest] Erreur lors de l\'envoi de l\'email au propriétaire:', ownerEmailError);
          }
        }

        // Email au locataire (même type que la fonction Edge expire-pending-requests)
        if (renter?.email) {
          try {
            const formatDate = (dateStr: string) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            };

            const emailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_modification_cancelled',
                to: renter.email,
                data: {
                  renterName: `${renter.first_name || ''} ${renter.last_name || ''}`.trim() || 'Cher client',
                  vehicleTitle: vehicleTitle,
                  originalStartDate: request.original_start_date,
                  originalEndDate: request.original_end_date,
                  originalDays: request.original_rental_days,
                  originalPrice: request.original_total_price
                }
              }
            });
            
            if (emailResponse.error) {
              console.error('❌ [cancelModificationRequest] Erreur envoi email au locataire:', emailResponse.error);
            } else {
              if (__DEV__) console.log('✅ [cancelModificationRequest] Email d\'annulation envoyé au locataire:', renter.email);
            }
          } catch (renterEmailError: any) {
            console.error('❌ [cancelModificationRequest] Erreur lors de l\'envoi de l\'email au locataire:', renterEmailError);
          }
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi emails annulation:', emailError);
        // Ne pas faire échouer l'annulation si l'email échoue
      }

      Alert.alert('Succès', 'La demande de modification a été annulée.');
      return { success: true };
    } catch (err: any) {
      console.error('Erreur annulation:', err);
      setError(err.message || 'Erreur lors de l\'annulation');
      Alert.alert('Erreur', err.message || 'Impossible d\'annuler la modification');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    modifyBooking,
    getPendingRequestsForOwner,
    getBookingPendingRequest,
    approveModificationRequest,
    rejectModificationRequest,
    cancelModificationRequest,
    loading,
    error,
  };
};


