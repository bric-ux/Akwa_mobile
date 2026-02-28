import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { VehicleBooking, VehicleBookingStatus } from '../types';
import { useIdentityVerification } from './useIdentityVerification';
import { calculateTotalPrice, calculateFees, calculateVehiclePriceWithHours, calculateHostCommission } from './usePricing';
import { useCurrency } from './useCurrency';

export type VehiclePaymentMethod = 'card' | 'wave' | 'orange_money' | 'mtn_money' | 'moov_money' | 'paypal' | 'cash';

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
  useDriver?: boolean; // Si le locataire choisit d'utiliser le chauffeur (quand with_driver est true)
  paymentMethod?: VehiclePaymentMethod; // Moyen de paiement choisi par le voyageur
  paymentCurrency?: 'XOF' | 'EUR' | 'USD';
  paymentRate?: number;
}

export const useVehicleBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } = useIdentityVerification();
  const { currency, rates } = useCurrency();

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

      // Validation : la date de fin doit être strictement supérieure à la date de début
      if (endDate <= startDate) {
        throw new Error('La date de rendu doit être strictement supérieure à la date de prise. Vous ne pouvez pas commencer et terminer la location le même jour.');
      }

      // Déterminer le type de location
      const rentalType = bookingData.rentalType || 'daily';
      
      // Récupérer les informations du véhicule pour calculer le prix
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('price_per_day, price_per_hour, hourly_rental_enabled, minimum_rental_days, minimum_rental_hours, auto_booking, security_deposit, discount_enabled, discount_min_days, discount_percentage, long_stay_discount_enabled, long_stay_discount_min_days, long_stay_discount_percentage, with_driver, driver_fee')
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
        // Si totalHours < 24 : ne pas facturer de jour complet, seulement les heures (rentalDays = 0)
        // Ne pas utiliser les jours calendaires qui peuvent donner des résultats incorrects
        if (totalHours >= 24) {
          rentalDays = fullDaysFromHours; // Utiliser directement les jours calculés à partir des heures
        } else {
          rentalDays = 0; // Pas de jour complet pour une location de moins de 24 heures
        }

        // Validation : si totalHours < 24, on doit avoir hourly_rental_enabled
        if (totalHours < 24 && (!vehicle.hourly_rental_enabled || !vehicle.price_per_hour)) {
          throw new Error('Les locations de moins de 24 heures nécessitent un tarif horaire');
        }

        // Validation du minimum de jours (seulement si rentalDays > 0)
        if (rentalDays > 0 && rentalDays < (vehicle.minimum_rental_days || 1)) {
          throw new Error(`La location minimum est de ${vehicle.minimum_rental_days || 1} jour(s)`);
        }
        
        // Calculer les heures restantes : durée totale - (jours complets × 24 heures)
        // Utiliser fullDaysFromHours pour le calcul des heures, pas rentalDays
        // Exemple: 177 heures totales = 7 jours complets (168h) + 9 heures restantes
        const hoursInFullDays = fullDaysFromHours * 24;
        const remainingHours = totalHours - hoursInFullDays;
        
        if (__DEV__) console.log(`⏱️ [useVehicleBookings] Calcul heures: totalHours=${totalHours}, fullDaysFromHours=${fullDaysFromHours}, hoursInFullDays=${hoursInFullDays}, remainingHours=${remainingHours}, rentalDays=${rentalDays}`);
        
        // Stocker les heures pour le calcul du prix
        // Si totalHours < 24, toutes les heures sont facturées comme heures (pas de jour complet)
        // Si totalHours >= 24, on facture les jours complets + les heures restantes
        if (totalHours < 24 && vehicle.hourly_rental_enabled && vehicle.price_per_hour) {
          rentalHours = totalHours; // Toutes les heures sont facturées comme heures, pas de jour complet
          if (__DEV__) console.log(`✅ [useVehicleBookings] Location < 24h: ${totalHours}h facturées comme heures`);
        } else if (remainingHours > 0 && vehicle.hourly_rental_enabled && vehicle.price_per_hour) {
          rentalHours = remainingHours; // Heures au-delà des jours complets
          if (__DEV__) console.log(`✅ [useVehicleBookings] Heures restantes calculées: ${remainingHours}h`);
        } else {
          if (__DEV__) console.log(`⚠️ [useVehicleBookings] Pas d'heures restantes: remainingHours=${remainingHours}, hourly_rental_enabled=${vehicle.hourly_rental_enabled}, price_per_hour=${vehicle.price_per_hour}`);
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
      let priceCalculation: ReturnType<typeof calculateVehiclePriceWithHours> | null = null;
      let discountType: 'normal' | 'long_stay' | null = null;

      if (rentalType === 'hourly') {
        // Pour location par heure : pas de réductions, prix simple
        hourlyRate = vehicle.price_per_hour!;
        basePrice = hourlyRate! * rentalHours!;
        originalTotal = basePrice;
        discountType = null;
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
        
        priceCalculation = calculateVehiclePriceWithHours(
          dailyRate!,
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
        discountType = priceCalculation.discountType || null;
        
        if (hourlyRateValue > 0) {
          hourlyRate = hourlyRateValue;
        }
        
        if (__DEV__) console.log(`💰 [useVehicleBookings] Calcul combiné: ${rentalDays} jours (${priceCalculation.daysPrice} FCFA) + ${rentalHours || 0} heures (${hoursPrice} FCFA) = ${priceCalculation.totalBeforeDiscount} FCFA, réduction: ${discountAmount} FCFA, total: ${basePrice} FCFA`);
      }
      
      // Ajouter le surplus chauffeur si le véhicule est proposé avec chauffeur et que le locataire choisit le chauffeur
      // IMPORTANT: Vérifier que useDriver est explicitement true (pas juste truthy)
      const vehicleWithDriver = (vehicle as any).with_driver === true;
      const userWantsDriver = bookingData.useDriver === true; // Doit être explicitement true
      const driverFeeAmount = (vehicle as any).driver_fee || 0;
      
      // Logs TOUJOURS affichés pour débogage
      console.log('🔍 [useVehicleBookings] Vérification chauffeur:', {
        'vehicle.with_driver': (vehicle as any).with_driver,
        'vehicleWithDriver (=== true)': vehicleWithDriver,
        'bookingData.useDriver': bookingData.useDriver,
        'bookingData.useDriver type': typeof bookingData.useDriver,
        'userWantsDriver (=== true)': userWantsDriver,
        'vehicle.driver_fee': (vehicle as any).driver_fee,
        'driverFeeAmount': driverFeeAmount,
        'toutes conditions remplies': vehicleWithDriver && userWantsDriver && driverFeeAmount > 0,
        'condition 1 (vehicleWithDriver)': vehicleWithDriver,
        'condition 2 (userWantsDriver)': userWantsDriver,
        'condition 3 (driverFeeAmount > 0)': driverFeeAmount > 0
      });
      
      const driverFee = (vehicleWithDriver && userWantsDriver && driverFeeAmount > 0) 
        ? driverFeeAmount 
        : 0;
      
      console.log('💰 [useVehicleBookings] Calcul driverFee:', {
        driverFee,
        basePrice,
        basePriceWithDriver: basePrice + driverFee,
        'Pourquoi driverFee est 0?': {
          'vehicleWithDriver': vehicleWithDriver,
          'userWantsDriver': userWantsDriver,
          'driverFeeAmount > 0': driverFeeAmount > 0,
          'Toutes conditions': vehicleWithDriver && userWantsDriver && driverFeeAmount > 0
        }
      });
      
      const basePriceWithDriver = basePrice + driverFee;
      
      // Calculer les frais de service (10% + TVA du prix après réduction pour les véhicules)
      const fees = calculateFees(basePriceWithDriver, rentalType === 'hourly' ? rentalHours! : rentalDays, 'vehicle');
      const totalPrice = basePriceWithDriver + fees.serviceFee; // Total avec frais de service
      
      // Calculer le revenu net du propriétaire (prix avec chauffeur - commission)
      // IMPORTANT: La commission est calculée sur basePriceWithDriver (inclut le chauffeur)
      const hostCommissionData = calculateHostCommission(basePriceWithDriver, 'vehicle');
      // IMPORTANT: La caution n'est PAS incluse dans le revenu net car elle est payée en espèces
      const hostNetAmount = basePriceWithDriver - hostCommissionData.hostCommission;
      
      // Pour la carte, la réservation reste pending jusqu'à confirmation du paiement (webhook Stripe).
      const isCardPayment = bookingData.paymentMethod === 'card';
      const initialStatus = isCardPayment
        ? 'pending'
        : ((vehicle as any).auto_booking === true ? 'confirmed' : 'pending');

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
        host_net_amount: hostNetAmount, // Revenu net du propriétaire (stocké pour éviter les recalculs)
        security_deposit: vehicle.security_deposit ?? 0,
        pickup_location: bookingData.pickupLocation || null,
        dropoff_location: bookingData.dropoffLocation || null,
        message_to_owner: bookingData.messageToOwner || null,
        special_requests: bookingData.specialRequests || null,
        has_license: bookingData.hasLicense || false,
        license_years: bookingData.licenseYears ? parseInt(bookingData.licenseYears) : null,
        license_number: bookingData.licenseNumber || null,
        with_driver: bookingData.useDriver === true, // Stocker si le locataire a choisi le chauffeur
        status: initialStatus,
        payment_method: bookingData.paymentMethod || null, // Moyen de paiement choisi
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

      let checkoutUrl: string | null = null;
      let paymentInitError: string | null = null;

      // Paiement carte: initier Stripe Checkout immédiatement après création de la réservation pending.
      if (isCardPayment && booking?.id) {
        try {
          const vehicleTitle = (vehicle as any).title || `${(vehicle as any).brand || ''} ${(vehicle as any).model || ''}`.trim() || 'Réservation véhicule';
          const checkoutBody: Record<string, unknown> = {
            booking_id: booking.id,
            amount: totalPrice,
            property_title: vehicleTitle,
            check_in: startDate,
            check_out: endDate,
            booking_type: 'vehicle',
            customer_country: user?.user_metadata?.country_code || user?.user_metadata?.country || '',
          };
          if ((bookingData.paymentCurrency || currency) === 'EUR' && (bookingData.paymentRate || rates.EUR)) {
            checkoutBody.currency = 'eur';
            checkoutBody.rate = bookingData.paymentRate || rates.EUR;
          } else if ((bookingData.paymentCurrency || currency) === 'USD' && (bookingData.paymentRate || rates.USD)) {
            checkoutBody.currency = 'usd';
            checkoutBody.rate = bookingData.paymentRate || rates.USD;
          }

          const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout-session', {
            body: checkoutBody,
          });

          if (checkoutError || !checkoutData?.url) {
            console.error('❌ [useVehicleBookings] Erreur init Stripe checkout:', checkoutError, checkoutData);
            paymentInitError = 'Impossible d\'ouvrir la page de paiement sécurisée.';
          } else {
            checkoutUrl = checkoutData.url;
          }
        } catch (checkoutErr: any) {
          console.error('❌ [useVehicleBookings] Exception init Stripe checkout:', checkoutErr);
          paymentInitError = checkoutErr?.message || 'Impossible d\'ouvrir la page de paiement sécurisée.';
        }
      }

      // Stocker tous les détails de calcul dans booking_calculation_details
      // Cela évite tous les recalculs dans les emails, PDFs et affichages
      try {
        // Utiliser les valeurs déjà calculées
        const daysPrice = rentalType === 'hourly' ? 0 : (priceCalculation ? priceCalculation.daysPrice : (dailyRate! * rentalDays));
        const hoursPrice = rentalType === 'hourly' ? (rentalHours! * hourlyRate!) : (priceCalculation ? priceCalculation.hoursPrice : (rentalHours && hourlyRate ? rentalHours * hourlyRate : 0));
        const totalBeforeDiscount = rentalType === 'hourly' ? basePrice : (priceCalculation ? priceCalculation.totalBeforeDiscount : (daysPrice + hoursPrice));

        const calculationDetails = {
          booking_id: booking.id,
          booking_type: 'vehicle',
          
          // Prix de base
          base_price: basePrice,
          price_after_discount: basePrice, // basePrice est déjà après réduction
          base_price_with_driver: basePriceWithDriver,
          
          // Réductions
          discount_amount: discountAmount,
          discount_applied: discountApplied,
          original_total: originalTotal,
          discount_type: discountType,
          
          // Frais de service (voyageur)
          service_fee: fees.serviceFee,
          service_fee_ht: fees.serviceFeeHT,
          service_fee_vat: fees.serviceFeeVAT,
          
          // Commission propriétaire
          host_commission: hostCommissionData.hostCommission,
          host_commission_ht: hostCommissionData.hostCommissionHT,
          host_commission_vat: hostCommissionData.hostCommissionVAT,
          
          // Frais additionnels (0 pour véhicules)
          effective_cleaning_fee: 0,
          effective_taxes: 0,
          
          // Détails véhicules
          days_price: daysPrice,
          hours_price: hoursPrice,
          driver_fee: driverFee,
          total_before_discount: totalBeforeDiscount,
          
          // Totaux finaux
          total_price: totalPrice,
          host_net_amount: hostNetAmount,
          
          // Snapshot des données utilisées pour le calcul
          calculation_snapshot: {
            serviceType: 'vehicle',
            rentalType: rentalType,
            dailyRate: dailyRate,
            hourlyRate: hourlyRate || null,
            rentalDays: rentalDays,
            rentalHours: rentalHours || null,
            discountConfig: {
              enabled: vehicle.discount_enabled || false,
              minDays: vehicle.discount_min_days || null,
              percentage: vehicle.discount_percentage || null
            },
            longStayDiscountConfig: vehicle.long_stay_discount_enabled ? {
              enabled: vehicle.long_stay_discount_enabled || false,
              minDays: vehicle.long_stay_discount_min_days || null,
              percentage: vehicle.long_stay_discount_percentage || null
            } : null,
            withDriver: bookingData.useDriver === true,
            driverFee: driverFee,
            securityDeposit: vehicle.security_deposit ?? 0,
            commissionRates: {
              travelerFeePercent: 10, // 10% HT pour véhicules
              hostFeePercent: 2 // 2% HT pour véhicules
            },
            paymentCurrency: bookingData.paymentCurrency || currency || 'XOF',
            paymentRate: bookingData.paymentRate || (bookingData.paymentCurrency === 'EUR' ? rates.EUR : bookingData.paymentCurrency === 'USD' ? rates.USD : null),
            calculatedAt: new Date().toISOString()
          }
        };

        if (__DEV__) {
          console.log('💾 [useVehicleBookings] Insertion booking_calculation_details:', {
            booking_id: booking.id,
            driver_fee: calculationDetails.driver_fee,
            base_price_with_driver: calculationDetails.base_price_with_driver,
            total_price: calculationDetails.total_price,
            'Vérification driverFee avant insertion': driverFee
          });
        }

        const { error: calcDetailsError } = await supabase
          .from('booking_calculation_details')
          .insert(calculationDetails);

        if (calcDetailsError) {
          console.error('❌ [useVehicleBookings] Erreur stockage détails calcul:', calcDetailsError);
          // Ne pas faire échouer la réservation si l'insertion des détails échoue
        } else {
          if (__DEV__) console.log('✅ [useVehicleBookings] Détails de calcul stockés pour réservation:', booking.id);
        }
      } catch (calcError) {
        console.error('❌ [useVehicleBookings] Erreur lors du stockage des détails de calcul:', calcError);
        // Ne pas faire échouer la réservation si l'insertion des détails échoue
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
          const ownerProfile = Array.isArray(vehicleInfo.profiles) ? vehicleInfo.profiles[0] : vehicleInfo.profiles;
          const renterProfile = user.user_metadata || {};
          const renterName = `${(renterProfile as any).first_name || ''} ${(renterProfile as any).last_name || ''}`.trim() || 'Locataire';
          const ownerName = `${(ownerProfile as any)?.first_name || ''} ${(ownerProfile as any)?.last_name || ''}`.trim() || 'Propriétaire';
          const vehicleTitle = vehicleInfo.title || `${vehicleInfo.brand || ''} ${vehicleInfo.model || ''}`.trim();

          const isAutoBooking = initialStatus === 'confirmed';

          if (isAutoBooking) {
            // Réservation automatique - Envoyer les emails de confirmation immédiatement
            // Calculer le revenu net du propriétaire (prix après réduction + chauffeur - commission avec TVA + caution)
            // IMPORTANT: La commission est calculée sur basePriceWithDriver (inclut le chauffeur)
            const hostCommissionData = calculateHostCommission(basePriceWithDriver, 'vehicle');
            // IMPORTANT: La caution n'est PAS incluse dans le revenu net car elle est payée en espèces
            const ownerNetRevenue = basePriceWithDriver - hostCommissionData.hostCommission;
            
            const emailData = {
              bookingId: booking.id,
              vehicleTitle: vehicleTitle,
              vehicleBrand: vehicleInfo.brand || '',
              vehicleModel: vehicleInfo.model || '',
              vehicleYear: (vehicle as any)?.year || '',
              fuelType: (vehicle as any)?.fuel_type || '',
              renterName: renterName,
              renterEmail: user.email || '',
              renterPhone: (renterProfile as any).phone || '',
              ownerName: ownerName,
              ownerEmail: (ownerProfile as any)?.email || '',
              ownerPhone: (ownerProfile as any)?.phone || '',
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              startDateTime: bookingData.startDateTime,
              endDateTime: bookingData.endDateTime,
              rentalDays: rentalDays,
              rentalHours: rentalHours || 0,
              dailyRate: booking.daily_rate || vehicle?.price_per_day || 0,
              hourlyRate: hourlyRate || vehicle?.price_per_hour || 0,
              basePrice: basePriceWithDriver, // Prix après réduction + chauffeur (pour calculer le revenu net)
              totalPrice: totalPrice,
              ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire (sans la caution, payée en espèces)
              securityDeposit: vehicle?.security_deposit ?? booking.security_deposit ?? 0,
              driverFee: driverFee, // Ajouter le surplus chauffeur pour le PDF
              withDriver: bookingData.useDriver === true,
              pickupLocation: bookingData.pickupLocation || '',
              isInstantBooking: true,
              paymentMethod: (bookingData as any).paymentMethod || booking.payment_method || '',
              payment_currency: bookingData.paymentCurrency || currency || 'XOF',
              exchange_rate: bookingData.paymentRate || (bookingData.paymentCurrency === 'EUR' ? rates.EUR : bookingData.paymentCurrency === 'USD' ? rates.USD : null),
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
                  to: (ownerProfile as any)?.email || '',
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
          } else if (isCardPayment) {
            if (__DEV__) console.log('✅ [useVehicleBookings] Paiement carte - emails envoyés après confirmation Stripe');
          } else {
            // Réservation sur demande - Envoyer les emails de demande
            // Calculer le revenu net du propriétaire (prix après réduction + chauffeur - commission avec TVA + caution)
            // IMPORTANT: La commission est calculée sur basePriceWithDriver (inclut le chauffeur)
            const hostCommissionData = calculateHostCommission(basePriceWithDriver, 'vehicle');
            // IMPORTANT: La caution n'est PAS incluse dans le revenu net car elle est payée en espèces
            const ownerNetRevenue = basePriceWithDriver - hostCommissionData.hostCommission;
            
            if (__DEV__) console.log('📧 [useVehicleBookings] Calcul revenu net propriétaire:', {
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
              vehicleYear: (vehicle as any)?.year || '',
              fuelType: (vehicle as any)?.fuel_type || '',
              renterName: renterName,
              renterEmail: user.email || '',
              renterPhone: (renterProfile as any).phone || '',
              ownerName: ownerName,
              ownerEmail: (ownerProfile as any)?.email || '',
              ownerPhone: (ownerProfile as any)?.phone || '',
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              startDateTime: bookingData.startDateTime,
              endDateTime: bookingData.endDateTime,
              rentalDays: rentalDays,
              rentalHours: rentalHours || 0,
              dailyRate: booking.daily_rate || vehicle?.price_per_day || 0,
              hourlyRate: hourlyRate || vehicle?.price_per_hour || 0,
              basePrice: basePriceWithDriver, // Prix après réduction + chauffeur (pour calculer le revenu net)
              totalPrice: totalPrice,
              ownerNetRevenue: ownerNetRevenue, // Revenu net du propriétaire (sans la caution, payée en espèces)
              securityDeposit: vehicle?.security_deposit ?? booking.security_deposit ?? 0,
              driverFee: driverFee, // Ajouter le surplus chauffeur pour le PDF
              withDriver: bookingData.useDriver === true,
              pickupLocation: bookingData.pickupLocation || '',
              message: bookingData.messageToOwner || '',
              isInstantBooking: false,
              paymentMethod: (bookingData as any).paymentMethod || booking.payment_method || '',
              payment_currency: bookingData.paymentCurrency || currency || 'XOF',
              exchange_rate: bookingData.paymentRate || (bookingData.paymentCurrency === 'EUR' ? rates.EUR : bookingData.paymentCurrency === 'USD' ? rates.USD : null),
              discountAmount: discountAmount || 0, // Montant de la réduction
              vehicleDiscountEnabled: vehicle.discount_enabled || false,
              vehicleDiscountMinDays: vehicle.discount_min_days || null,
              vehicleDiscountPercentage: vehicle.discount_percentage || null,
              vehicleLongStayDiscountEnabled: vehicle.long_stay_discount_enabled || false,
              vehicleLongStayDiscountMinDays: vehicle.long_stay_discount_min_days || null,
              vehicleLongStayDiscountPercentage: vehicle.long_stay_discount_percentage || null,
            };
            
            if (__DEV__) console.log('📧 [useVehicleBookings] Email data envoyé:', {
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
                  to: (ownerProfile as any)?.email || '',
                  data: emailData
                }
              });
            }
          }

          if (__DEV__) console.log('✅ [useVehicleBookings] Emails de réservation envoyés');
        }
      } catch (emailError) {
        console.error('❌ [useVehicleBookings] Erreur envoi email:', emailError);
        // Ne pas faire échouer la réservation si l'email échoue
      }

      return { success: true, booking, status: booking.status, checkoutUrl, paymentInitError };
    } catch (err: any) {
      console.error('Erreur lors de la création de la réservation:', err);
      setError(err.message || 'Erreur lors de la création de la réservation');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [hasUploadedIdentity, isVerified, identityLoading, currency, rates.EUR, rates.USD]);

  const getMyBookings = useCallback(async (): Promise<VehicleBooking[]> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // IMPORTANT: Inclure driver_fee et with_driver pour le calcul correct du total
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
            driver_fee,
            with_driver,
            security_deposit,
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

      // IMPORTANT: Inclure driver_fee et with_driver pour le calcul correct du revenu net
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
            driver_fee,
            with_driver,
            security_deposit,
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
          // ✅ PRIORITÉ: Récupérer les données stockées depuis booking_calculation_details
          const { data: calculationDetails } = await supabase
            .from('booking_calculation_details')
            .select('*')
            .eq('booking_id', booking.id)
            .eq('booking_type', 'vehicle')
            .single();

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

          // ✅ Utiliser les données stockées si disponibles, sinon fallback sur recalcul
          let ownerNetRevenue: number;
          let basePriceWithDriver: number;
          let driverFee: number;
          
          if (calculationDetails) {
            // ✅ UTILISER DIRECTEMENT les valeurs stockées - AUCUN recalcul
            ownerNetRevenue = calculationDetails.host_net_amount;
            basePriceWithDriver = calculationDetails.base_price_with_driver || calculationDetails.price_after_discount;
            driverFee = calculationDetails.driver_fee || 0;
            
            if (__DEV__) {
              console.log('✅ [useVehicleBookings] Utilisation données stockées pour email confirmation:', {
                host_net_amount: ownerNetRevenue,
                base_price_with_driver: basePriceWithDriver,
                driver_fee: driverFee,
              });
            }
          } else {
            // ⚠️ FALLBACK: Recalculer uniquement pour les anciennes réservations sans données stockées
            if (__DEV__) console.log('⚠️ [useVehicleBookings] Pas de données stockées, recalcul pour ancienne réservation');
            basePriceWithDriver = Math.round((booking.total_price || 0) / 1.12);
            const hostCommissionData = calculateHostCommission(basePriceWithDriver, 'vehicle');
            ownerNetRevenue = basePriceWithDriver - hostCommissionData.hostCommission;
            driverFee = (booking.with_driver === true && vehicle?.with_driver && (vehicle as any).driver_fee) ? (vehicle as any).driver_fee : 0;
          }

          const emailData = {
            bookingId: booking.id, // ✅ CRUCIAL: bookingId doit être présent pour que le PDF récupère les données stockées
            vehicleTitle: vehicleTitle,
            vehicleBrand: vehicle?.brand || '',
            vehicleModel: vehicle?.model || '',
            vehicleYear: (vehicle as any)?.year || '',
            fuelType: (vehicle as any)?.fuel_type || '',
            renterName: renterName,
            renterEmail: renter?.email || '',
            renterPhone: renter?.phone || '',
            ownerName: ownerName,
            ownerEmail: (ownerProfile as any)?.email || '',
            ownerPhone: (ownerProfile as any)?.phone || '',
            startDate: formatDate(booking.start_date),
            endDate: formatDate(booking.end_date),
            startDateTime: booking.start_datetime || undefined,
            endDateTime: booking.end_datetime || undefined,
            rentalDays: booking.rental_days,
            rentalHours: booking.rental_hours || 0,
            dailyRate: booking.daily_rate,
            hourlyRate: booking.hourly_rate || vehicle?.price_per_hour || 0,
            basePrice: basePriceWithDriver, // ✅ Utiliser la valeur stockée
            totalPrice: booking.total_price,
            ownerNetRevenue: ownerNetRevenue, // ✅ Utiliser la valeur stockée
            securityDeposit: booking.security_deposit || 0,
            pickupLocation: booking.pickup_location || '',
            isInstantBooking: false, // Confirmation manuelle = pas instantanée
            withDriver: booking.with_driver === true,
            vehicleDriverFee: driverFee, // ✅ Utiliser la valeur stockée
            driverFee: driverFee, // ✅ Ajouter aussi driverFee pour le PDF
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

          if (__DEV__) console.log('✅ [useVehicleBookings] Emails de confirmation envoyés');
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
      // IMPORTANT: Inclure driver_fee et with_driver pour le calcul correct du revenu net
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
            driver_fee,
            with_driver,
            security_deposit,
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





