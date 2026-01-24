import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

export interface VehicleBookingModificationData {
  bookingId: string;
  requestedStartDate: string;
  requestedEndDate: string;
  requestedRentalDays: number;
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

      // Vérifier la disponibilité des nouvelles dates
      const { data: conflictingBookings, error: conflictError } = await supabase
        .from('vehicle_bookings')
        .select('id, start_date, end_date, status')
        .eq('vehicle_id', booking.vehicle.id)
        .in('status', ['pending', 'confirmed', 'completed'])
        .neq('id', data.bookingId)
        .or(`and(start_date.lte.${data.requestedEndDate},end_date.gte.${data.requestedStartDate})`);

      if (conflictError) {
        console.error('Erreur vérification disponibilité:', conflictError);
      }

      if (conflictingBookings && conflictingBookings.length > 0) {
        throw new Error('Ces dates ne sont pas disponibles pour ce véhicule');
      }

      // Si la réservation est en attente (pending), mettre à jour directement
      if (booking.status === 'pending') {
        const { error: updateError } = await supabase
          .from('vehicle_bookings')
          .update({
            start_date: data.requestedStartDate,
            end_date: data.requestedEndDate,
            rental_days: data.requestedRentalDays,
            total_price: data.requestedTotalPrice,
            daily_rate: booking.vehicle.price_per_day,
            updated_at: new Date().toISOString(),
          })
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
                  newRentalDays: data.requestedRentalDays,
                  oldTotalPrice: booking.total_price,
                  newTotalPrice: data.requestedTotalPrice,
                  message: data.message || null,
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
                  newRentalDays: data.requestedRentalDays,
                  oldTotalPrice: booking.total_price,
                  newTotalPrice: data.requestedTotalPrice,
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

      // Pour les réservations confirmées, créer une demande de modification
      const { data: modificationRequest, error: createRequestError } = await supabase
        .from('vehicle_booking_modification_requests')
        .insert({
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
          renter_message: data.message || null,
          status: 'pending'
        })
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
                originalDays: booking.rental_days,
                originalPrice: booking.total_price,
                requestedStartDate: data.requestedStartDate,
                requestedEndDate: data.requestedEndDate,
                requestedDays: data.requestedRentalDays,
                requestedPrice: data.requestedTotalPrice,
                renterMessage: data.message || null,
                bookingId: booking.id,
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
              originalDays: booking.rental_days,
              originalPrice: booking.total_price,
              requestedStartDate: data.requestedStartDate,
              requestedEndDate: data.requestedEndDate,
              requestedDays: data.requestedRentalDays,
              requestedPrice: data.requestedTotalPrice,
              dailyRate: booking.vehicle.price_per_day || booking.daily_rate || 0,
              bookingId: booking.id,
            };
            
            console.log('📧 [useVehicleBookingModifications] Envoi email au locataire:', {
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
              console.log('✅ [useVehicleBookingModifications] Email de confirmation envoyé au locataire:', renterProfile.email);
              console.log('✅ [useVehicleBookingModifications] Réponse email:', emailResponse.data);
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

  // Récupérer la demande en attente pour une réservation
  const getBookingPendingRequest = useCallback(async (bookingId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_booking_modification_requests')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('status', 'pending')
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
          booking:vehicle_bookings(
            id,
            vehicle_id,
            renter_id,
            daily_rate,
            pickup_location,
            security_deposit,
            vehicles(
              id,
              brand,
              model,
              year,
              fuel_type,
              owner_id,
              price_per_day
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
      const { error: updateBookingError } = await supabase
        .from('vehicle_bookings')
        .update({
          start_date: request.requested_start_date,
          end_date: request.requested_end_date,
          rental_days: request.requested_rental_days,
          total_price: request.requested_total_price,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.booking_id);

      if (updateBookingError) throw updateBookingError;

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
        const bookingData = request.booking;
        const vehicle = bookingData?.vehicles;
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
          dailyRate: bookingData.daily_rate || vehicle.price_per_day || 0,
          totalPrice: request.requested_total_price,
          securityDeposit: bookingData.security_deposit || 0,
          pickupLocation: bookingData.pickup_location || '',
          isInstantBooking: false,
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
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_modification_rejected',
              to: renter.email,
              data: {
                renterName: `${renter.first_name || ''} ${renter.last_name || ''}`.trim() || 'Cher client',
                vehicleTitle: `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim() || 'Véhicule',
                ownerMessage: ownerMessage || null,
                bookingId: request.booking_id
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
        console.log('📧 [cancelModificationRequest] Données récupérées:', {
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

        console.log('📧 [cancelModificationRequest] Profils récupérés:', {
          ownerProfile: ownerProfile ? { email: ownerProfile.email, name: `${ownerProfile.first_name} ${ownerProfile.last_name}` } : null,
          renter: renter ? { email: renter.email, name: `${renter.first_name} ${renter.last_name}` } : null,
        });

        // Email au propriétaire
        if (ownerProfile?.email) {
          try {
            console.log('📧 [cancelModificationRequest] Envoi email au propriétaire:', {
              to: ownerProfile.email,
              type: 'vehicle_modification_cancelled',
              ownerName: `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'Cher propriétaire',
              renterName: renter ? `${renter.first_name || ''} ${renter.last_name || ''}`.trim() : 'Un locataire',
              vehicleTitle: vehicleTitle,
            });
            
            const emailResponse = await supabase.functions.invoke('send-email', {
              body: {
                type: 'vehicle_modification_cancelled',
                to: ownerProfile.email,
                data: {
                  ownerName: `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'Cher propriétaire',
                  renterName: renter ? `${renter.first_name || ''} ${renter.last_name || ''}`.trim() : 'Un locataire',
                  vehicleTitle: vehicleTitle,
                  bookingId: request.booking_id,
                },
              },
            });
            
            if (emailResponse.error) {
              console.error('❌ [cancelModificationRequest] Erreur envoi email au propriétaire:', emailResponse.error);
              console.error('❌ [cancelModificationRequest] Détails erreur:', JSON.stringify(emailResponse.error, null, 2));
            } else {
              console.log('✅ [cancelModificationRequest] Email d\'annulation envoyé au propriétaire:', ownerProfile.email);
              console.log('✅ [cancelModificationRequest] Réponse email:', emailResponse.data);
            }
          } catch (ownerEmailError: any) {
            console.error('❌ [cancelModificationRequest] Erreur lors de l\'envoi de l\'email au propriétaire:', ownerEmailError);
            console.error('❌ [cancelModificationRequest] Stack:', ownerEmailError.stack);
          }
        } else {
          console.warn('⚠️ [cancelModificationRequest] Pas d\'email propriétaire trouvé pour owner_id:', vehicle?.owner_id);
          console.warn('⚠️ [cancelModificationRequest] ownerProfile:', ownerProfile);
          console.warn('⚠️ [cancelModificationRequest] vehicle:', vehicle);
        }

        // Email au locataire
        if (renter?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'vehicle_modification_cancelled_renter',
              to: renter.email,
              data: {
                renterName: `${renter.first_name || ''} ${renter.last_name || ''}`.trim() || 'Cher client',
                vehicleTitle: vehicleTitle,
                bookingId: request.booking_id,
              },
            },
          });
          console.log('✅ Email d\'annulation envoyé au locataire');
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


