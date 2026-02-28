import { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useEmailService } from './useEmailService';
import { useIdentityVerification } from './useIdentityVerification';

export interface BookingData {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  guestsCount: number;
  adultsCount?: number;
  childrenCount?: number;
  infantsCount?: number;
  totalPrice: number;
  messageToHost?: string;
  discountApplied?: boolean;
  discountAmount?: number;
  originalTotal?: number;
  voucherCode?: string;
  paymentMethod?: string;
  paymentPlan?: string;
  paymentCurrency?: 'XOF' | 'EUR' | 'USD';
  paymentRate?: number;
}

export interface Booking {
  id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  adults_count: number;
  children_count: number;
  infants_count: number;
  total_price: number;
  payment_method?: string;
  payment_currency?: 'XOF' | 'EUR' | 'USD';
  exchange_rate?: number | null;
  host_net_amount?: number | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  message_to_host?: string;
  special_requests?: string;
  cancellation_penalty?: number;
  cancelled_by?: string;
  cancellation_reason?: string;
  discount_applied?: boolean;
  discount_amount?: number;
  original_total?: number;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  properties?: {
    id: string;
    title: string;
    price_per_night: number;
    host_id: string;
    max_guests?: number;
    cleaning_fee?: number;
    service_fee?: number;
    cancellation_policy?: string | null;
    images: string[];
    property_photos?: {
      id: string;
      url: string;
      category: string;
      display_order: number;
    }[];
    locations?: {
      id: string;
      name: string;
      type: string;
      latitude?: number;
      longitude?: number;
      parent_id?: string;
    };
    location?: {
      id: string;
      name: string;
      type: string;
      latitude?: number;
      longitude?: number;
      parent_id?: string;
    };
  };
}

export const useBookings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { sendBookingRequest, sendBookingRequestSent, sendBookingConfirmed, sendBookingConfirmedHost } = useEmailService();
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } = useIdentityVerification();

  const createBooking = async (bookingData: BookingData) => {
    if (!user) {
      setError('Vous devez être connecté pour effectuer une réservation');
      return { success: false };
    }

    // Vérifier si l'identité est vérifiée (même logique que le site web)
    if (identityLoading) {
      setError('Vérification de l\'identité en cours...');
      return { success: false };
    }

    if (!hasUploadedIdentity) {
      setError('IDENTITY_REQUIRED');
      return { success: false };
    }

    // Permettre les réservations si le document est vérifié OU en cours d'examen (pending)
    // Bloquer seulement si le document a été rejeté (rejected) ou n'existe pas
    if (!isVerified && verificationStatus !== 'pending') {
      setError('IDENTITY_NOT_VERIFIED');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Récupérer les infos de la propriété
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('auto_booking, minimum_nights, max_guests, price_per_night, cleaning_fee, taxes, free_cleaning_min_days')
        .eq('id', bookingData.propertyId)
        .single();

      if (propertyError) {
        console.error('Property fetch error:', propertyError);
        setError('Erreur lors de la récupération des informations de la propriété');
        return { success: false, error: 'Erreur lors de la récupération des informations de la propriété' };
      }

      // Vérification de la disponibilité des dates
      // IMPORTANT: Récupérer TOUTES les réservations qui bloquent les dates pour être cohérent avec le calendrier
      // Le calendrier affiche les dates comme indisponibles si elles ont des réservations pending ou confirmed
      // Note: in_progress n'existe pas dans l'enum, c'est calculé dynamiquement à partir de confirmed
      // Donc la vérification doit prendre en compte pending et confirmed pour éviter les incohérences
      const { data: existingBookingsRaw, error: checkError } = await supabase
        .from('bookings')
        .select('id, check_in_date, check_out_date, status, payment_method')
        .eq('property_id', bookingData.propertyId)
        .in('status', ['confirmed', 'pending']) // in_progress n'existe pas dans l'enum, c'est calculé dynamiquement
        .gte('check_out_date', new Date().toISOString().split('T')[0]); // Seulement les réservations qui ne sont pas terminées

      if (checkError) {
        console.error('Availability check error:', checkError);
        setError('Erreur lors de la vérification de disponibilité');
        return { success: false, error: 'Erreur lors de la vérification de disponibilité' };
      }

      // Les réservations carte "pending" ne bloquent les dates que si un paiement est confirmé.
      // Si l'utilisateur ferme Stripe sans payer, ces réservations ne doivent pas rendre les dates indisponibles.
      let existingBookings = (existingBookingsRaw || []) as any[];
      const pendingCardBookings = existingBookings.filter(
        (booking) => booking.status === 'pending' && booking.payment_method === 'card'
      );

      if (pendingCardBookings.length > 0) {
        const pendingCardIds = pendingCardBookings.map((booking) => booking.id);
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('booking_id, status')
          .in('booking_id', pendingCardIds);

        if (paymentsError) {
          console.error('Availability card payment check error:', paymentsError);
          setError('Erreur lors de la vérification des paiements carte');
          return { success: false, error: 'Erreur lors de la vérification des paiements carte' };
        }

        const paidBookingIds = new Set(
          (payments || [])
            .filter((payment: any) => ['completed', 'succeeded', 'paid'].includes(String(payment.status || '').toLowerCase()))
            .map((payment: any) => payment.booking_id)
        );

        existingBookings = existingBookings.filter((booking) => {
          if (booking.status === 'pending' && booking.payment_method === 'card') {
            return paidBookingIds.has(booking.id);
          }
          return true;
        });
      }

      // Vérifier aussi les dates bloquées manuellement
      const { data: blockedDates, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('start_date, end_date')
        .eq('property_id', bookingData.propertyId);

      if (blockedError) {
        console.error('Blocked dates check error:', blockedError);
        setError('Erreur lors de la vérification des dates bloquées');
        return { success: false, error: 'Erreur lors de la vérification des dates bloquées' };
      }

      // Vérifier manuellement les conflits avec les réservations confirmées
      // Deux réservations se chevauchent si :
      // - La nouvelle commence avant la fin de l'existante ET finit après le début de l'existante
      const bookingStart = new Date(bookingData.checkInDate);
      const bookingEnd = new Date(bookingData.checkOutDate);
      bookingStart.setHours(0, 0, 0, 0);
      bookingEnd.setHours(0, 0, 0, 0);

      const hasBookingConflict = existingBookings?.some(booking => {
        const existingStart = new Date(booking.check_in_date);
        const existingEnd = new Date(booking.check_out_date);
        existingStart.setHours(0, 0, 0, 0);
        existingEnd.setHours(0, 0, 0, 0);

        // Vérifier le chevauchement : la nouvelle commence avant la fin de l'existante 
        // ET finit après le début de l'existante
        // IMPORTANT: Utiliser <= et >= pour inclure les dates limites (check-in et check-out)
        const overlaps = bookingStart < existingEnd && bookingEnd > existingStart;
        
        if (overlaps) {
          if (__DEV__) console.log('🔴 Conflit détecté:', {
            nouvelle: `${bookingData.checkInDate} - ${bookingData.checkOutDate}`,
            existante: `${booking.check_in_date} - ${booking.check_out_date}`,
            status: booking.status
          });
        }
        
        return overlaps;
      });

      if (hasBookingConflict) {
        setError('Ces dates sont déjà réservées');
        return { success: false, error: 'Ces dates sont déjà réservées' };
      }

      // Vérifier les conflits avec les dates bloquées
      const hasBlockedConflict = blockedDates?.some(({ start_date, end_date }) => {
        const blockedStart = new Date(start_date);
        const blockedEnd = new Date(end_date);
        const bookingStart = new Date(bookingData.checkInDate);
        const bookingEnd = new Date(bookingData.checkOutDate);
        
        return (
          (bookingStart >= blockedStart && bookingStart < blockedEnd) ||
          (bookingEnd > blockedStart && bookingEnd <= blockedEnd) ||
          (bookingStart <= blockedStart && bookingEnd >= blockedEnd)
        );
      });

      if (hasBlockedConflict) {
        setError('Ces dates sont bloquées par le propriétaire');
        return { success: false, error: 'Ces dates sont bloquées par le propriétaire' };
      }

      // Vérifier le nombre minimum de nuits
      const nights = Math.ceil(
        (new Date(bookingData.checkOutDate).getTime() - new Date(bookingData.checkInDate).getTime()) 
        / (1000 * 60 * 60 * 24)
      );

      if (nights < (propertyData.minimum_nights || 1)) {
        setError(`Cette propriété nécessite un minimum de ${propertyData.minimum_nights || 1} nuit(s)`);
        return { success: false, error: `Cette propriété nécessite un minimum de ${propertyData.minimum_nights || 1} nuit(s)` };
      }

      // Vérifier le nombre maximum de voyageurs
      if (bookingData.guestsCount > (propertyData.max_guests || 10)) {
        setError(`Le nombre maximum de voyageurs est ${propertyData.max_guests || 10}`);
        return { success: false, error: `Le nombre maximum de voyageurs est ${propertyData.max_guests || 10}` };
      }

      // Paiement par carte : la réservation n'est effective qu'après paiement Stripe (toujours pending)
      // Les autres méthodes : confirmed si auto_booking, sinon pending
      const isCardPayment = bookingData.paymentMethod === 'card';
      const initialStatus = isCardPayment ? 'pending' : (propertyData.auto_booking ? 'confirmed' : 'pending');

      // Calculer host_net_amount en utilisant la fonction centralisée
      // (nights est déjà calculé plus haut pour la vérification du minimum)
      const { calculateHostNetAmount } = await import('../lib/hostNetAmount');
      const hostNetAmountParams = {
        pricePerNight: propertyData.price_per_night || 0,
        nights: nights,
        discountAmount: bookingData.discountAmount || 0,
        cleaningFee: propertyData.cleaning_fee || 0,
        taxesPerNight: propertyData.taxes || 0,
        freeCleaningMinDays: propertyData.free_cleaning_min_days || null,
        status: initialStatus,
        serviceType: 'property' as const,
      };
      
      // Log pour debug
      if (__DEV__) console.log('🔍 [useBookings Mobile] Calcul host_net_amount:', {
        pricePerNight: hostNetAmountParams.pricePerNight,
        nights: hostNetAmountParams.nights,
        discountAmount: hostNetAmountParams.discountAmount,
        cleaningFee: hostNetAmountParams.cleaningFee,
        taxesPerNight: hostNetAmountParams.taxesPerNight,
        freeCleaningMinDays: hostNetAmountParams.freeCleaningMinDays,
        status: hostNetAmountParams.status,
      });
      
      const hostNetAmountResult = calculateHostNetAmount(hostNetAmountParams);
      
      // Log du résultat
      if (__DEV__) console.log('🔍 [useBookings Mobile] Résultat calcul host_net_amount:', {
        basePrice: hostNetAmountResult.basePrice,
        priceAfterDiscount: hostNetAmountResult.priceAfterDiscount,
        effectiveCleaningFee: hostNetAmountResult.effectiveCleaningFee,
        effectiveTaxes: hostNetAmountResult.effectiveTaxes,
        hostCommissionHT: hostNetAmountResult.hostCommissionHT,
        hostCommissionVAT: hostNetAmountResult.hostCommissionVAT,
        hostCommission: hostNetAmountResult.hostCommission,
        hostNetAmount: hostNetAmountResult.hostNetAmount,
      });

      // Log avant insertion
      if (__DEV__) console.log('💾 [useBookings Mobile] Valeur host_net_amount à stocker:', hostNetAmountResult.hostNetAmount);
      
      // Créer la réservation
      // Log avant insertion pour vérifier les valeurs
      if (__DEV__) console.log('💾 [useBookings Mobile] Valeurs à stocker:', {
        discount_amount: bookingData.discountAmount || 0,
        discount_applied: bookingData.discountApplied || false,
        original_total: bookingData.originalTotal || bookingData.totalPrice,
        host_net_amount: hostNetAmountResult.hostNetAmount,
      });
      
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          property_id: bookingData.propertyId,
          guest_id: user.id,
          check_in_date: bookingData.checkInDate,
          check_out_date: bookingData.checkOutDate,
          guests_count: bookingData.guestsCount,
          adults_count: bookingData.adultsCount || 1,
          children_count: bookingData.childrenCount || 0,
          infants_count: bookingData.infantsCount || 0,
          total_price: bookingData.totalPrice,
          host_net_amount: hostNetAmountResult.hostNetAmount,
          message_to_host: bookingData.messageToHost,
          special_requests: bookingData.messageToHost,
          discount_applied: bookingData.discountApplied || false,
          discount_amount: bookingData.discountAmount || 0,
          original_total: bookingData.originalTotal || bookingData.totalPrice,
          payment_method: bookingData.paymentMethod || null,
          payment_plan: bookingData.paymentPlan || null,
          status: initialStatus,
        })
        .select(`
          *,
          discount_amount,
          discount_applied,
          original_total,
          host_net_amount
        `)
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        setError('Erreur lors de la création de la réservation');
        return { success: false, error: `Erreur lors de la création de la réservation: ${bookingError.message}` };
      }
      
      // Log après insertion pour vérifier la valeur stockée
      if (__DEV__) console.log('✅ [useBookings Mobile] Réservation créée avec host_net_amount:', booking?.host_net_amount);

      // Stocker tous les détails de calcul dans booking_calculation_details
      // Cela évite tous les recalculs dans les emails, PDFs et affichages
      try {
        // Calculer les frais de service (12% pour propriétés)
        const { calculateFees } = await import('./usePricing');
        const fees = calculateFees(
          hostNetAmountResult.priceAfterDiscount,
          nights,
          'property',
          {
            cleaning_fee: propertyData.cleaning_fee || 0,
            taxes: propertyData.taxes || 0,
            free_cleaning_min_days: propertyData.free_cleaning_min_days || null
          }
        );

        const calculationDetails = {
          booking_id: booking.id,
          booking_type: 'property',
          
          // Prix de base
          base_price: hostNetAmountResult.basePrice,
          price_after_discount: hostNetAmountResult.priceAfterDiscount,
          base_price_with_driver: null, // N/A pour propriétés
          
          // Réductions
          discount_amount: bookingData.discountAmount || 0,
          discount_applied: bookingData.discountApplied || false,
          original_total: bookingData.originalTotal || bookingData.totalPrice,
          discount_type: bookingData.discountApplied ? 'normal' : null, // TODO: détecter long_stay si applicable
          
          // Frais de service (voyageur)
          service_fee: fees.serviceFee,
          service_fee_ht: fees.serviceFeeHT,
          service_fee_vat: fees.serviceFeeVAT,
          
          // Commission hôte
          host_commission: hostNetAmountResult.hostCommission,
          host_commission_ht: hostNetAmountResult.hostCommissionHT,
          host_commission_vat: hostNetAmountResult.hostCommissionVAT,
          
          // Frais additionnels
          effective_cleaning_fee: hostNetAmountResult.effectiveCleaningFee,
          effective_taxes: hostNetAmountResult.effectiveTaxes,
          
          // Détails véhicules (null pour propriétés)
          days_price: null,
          hours_price: null,
          driver_fee: null,
          total_before_discount: null,
          
          // Totaux finaux
          total_price: bookingData.totalPrice,
          host_net_amount: hostNetAmountResult.hostNetAmount,
          
          // Snapshot des données utilisées pour le calcul
          calculation_snapshot: {
            serviceType: 'property',
            pricePerNight: propertyData.price_per_night || 0,
            nights: nights,
            discountAmount: bookingData.discountAmount || 0,
            cleaningFee: propertyData.cleaning_fee || 0,
            taxesPerNight: propertyData.taxes || 0,
            freeCleaningMinDays: propertyData.free_cleaning_min_days || null,
            status: initialStatus,
            commissionRates: {
              travelerFeePercent: 12, // 12% pour propriétés
              hostFeePercent: 2 // 2% pour propriétés
            },
            paymentCurrency: bookingData.paymentCurrency || 'XOF',
            paymentRate: bookingData.paymentRate || null,
            calculatedAt: new Date().toISOString()
          }
        };

        const { error: calcDetailsError } = await supabase
          .from('booking_calculation_details')
          .insert(calculationDetails);

        if (calcDetailsError) {
          console.error('❌ [useBookings Mobile] Erreur stockage détails calcul:', calcDetailsError);
          // Ne pas faire échouer la réservation si l'insertion des détails échoue
        } else {
          if (__DEV__) console.log('✅ [useBookings Mobile] Détails de calcul stockés pour réservation:', booking.id);
        }
      } catch (calcError) {
        console.error('❌ [useBookings Mobile] Erreur lors du stockage des détails de calcul:', calcError);
        // Ne pas faire échouer la réservation si l'insertion des détails échoue
      }

      // Marquer le code promotionnel comme utilisé si un code a été fourni
      if (bookingData.voucherCode && booking?.id) {
        try {
          const { error: voucherError } = await supabase
            .from('user_discount_vouchers')
            .update({
              status: 'used',
              used_on_booking_id: booking.id,
              used_at: new Date().toISOString()
            })
            .eq('voucher_code', bookingData.voucherCode.toUpperCase().trim())
            .eq('user_id', user.id)
            .eq('status', 'active');

          if (voucherError) {
            console.error('Error updating voucher:', voucherError);
            // Ne pas faire échouer la réservation si la mise à jour du voucher échoue
          }
        } catch (voucherUpdateError) {
          console.error('Error updating voucher:', voucherUpdateError);
          // Ne pas faire échouer la réservation si la mise à jour du voucher échoue
        }
      }

      // Envoyer les emails après création de la réservation
      try {
        // Récupérer les informations complètes de la propriété, hôte et voyageur
        const { data: propertyInfo, error: propertyInfoError } = await supabase
          .from('properties')
          .select(`
            title,
            host_id,
            address,
            price_per_night,
            cleaning_fee,
            service_fee,
            taxes,
            free_cleaning_min_days,
            cancellation_policy,
            check_in_time,
            check_out_time,
            house_rules,
            auto_booking,
            locations:location_id(
              id,
              name,
              type,
              latitude,
              longitude,
              parent_id
            ),
            profiles!properties_host_id_fkey(
              first_name,
              last_name,
              email,
              phone
            )
          `)
          .eq('id', bookingData.propertyId)
          .single();

        if (propertyInfoError) {
          console.error('❌ [useBookings] Erreur récupération infos propriété:', propertyInfoError);
        } else {
          const hostProfile = propertyInfo.profiles;
          const guestName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Voyageur';
          const hostName = `${hostProfile.first_name} ${hostProfile.last_name}`;
          
          // Paiement carte : aucun email ici, les emails seront envoyés par le webhook Stripe après paiement
          if (isCardPayment) {
            if (__DEV__) console.log('✅ [useBookings] Paiement carte - emails envoyés après paiement Stripe (webhook)');
          } else if (initialStatus === 'confirmed') {
            if (__DEV__) console.log('✅ [useBookings] Réservation automatique détectée - envoi email de confirmation uniquement');
            // IMPORTANT: Vérifier si un email a déjà été envoyé pour éviter les doublons
            // On envoie l'email UNIQUEMENT depuis le mobile, pas depuis un trigger en base
            // Préparer les données pour le PDF
            const pdfBookingData = {
              id: booking.id,
              property: {
                title: propertyInfo.title,
                address: propertyInfo.address || '',
                city_name: propertyInfo.locations?.name || '',
                city_region: propertyInfo.locations?.type === 'city' ? propertyInfo.locations?.name : '',
                price_per_night: propertyInfo.price_per_night || 0,
                cleaning_fee: propertyInfo.cleaning_fee || 0,
                service_fee: propertyInfo.service_fee || 0,
                taxes: propertyInfo.taxes || 0,
                cancellation_policy: propertyInfo.cancellation_policy || 'flexible'
              },
              guest: {
                first_name: user.user_metadata?.first_name || '',
                last_name: user.user_metadata?.last_name || '',
                email: user.email || '',
                phone: user.user_metadata?.phone || ''
              },
              host: {
                first_name: hostProfile.first_name || '',
                last_name: hostProfile.last_name || '',
                email: hostProfile.email || '',
                phone: hostProfile.phone || ''
              },
              check_in_date: bookingData.checkInDate,
              check_out_date: bookingData.checkOutDate,
              guests_count: bookingData.guestsCount,
              total_price: bookingData.totalPrice,
              status: 'confirmed',
              created_at: booking.created_at,
              message: bookingData.messageToHost || '',
              discount_applied: bookingData.discountApplied || false,
              discount_amount: bookingData.discountAmount || 0,
              original_total: bookingData.originalTotal || bookingData.totalPrice,
              payment_method: bookingData.paymentMethod || '',
              payment_plan: bookingData.paymentPlan || ''
            };

            // Envoyer les emails de confirmation avec PDF (générés automatiquement par send-email)
            try {
              if (__DEV__) console.log('📧 [useBookings] Envoi emails de confirmation avec PDF...');
              
              // Email au voyageur avec PDF (généré automatiquement)
              const guestEmailData = {
                type: 'booking_confirmed',
                to: user.email || '',
                data: {
                  bookingId: booking.id,
                  guestName: guestName,
                  propertyTitle: propertyInfo.title,
                  checkIn: bookingData.checkInDate,
                  checkOut: bookingData.checkOutDate,
                  guestsCount: bookingData.guestsCount,
                  totalPrice: bookingData.totalPrice,
                  discountApplied: bookingData.discountApplied || false,
                  discountAmount: bookingData.discountAmount || 0,
                  property: {
                    title: propertyInfo.title,
                    address: propertyInfo.address || '',
                    city_name: propertyInfo.locations?.name || '',
                    city_region: propertyInfo.locations?.type === 'region' ? propertyInfo.locations?.name : '',
                    price_per_night: propertyInfo.price_per_night || 0,
                    cleaning_fee: propertyInfo.cleaning_fee || 0,
                    service_fee: propertyInfo.service_fee || 0,
                    taxes: propertyInfo.taxes || 0,
                    cancellation_policy: propertyInfo.cancellation_policy || 'flexible',
                    check_in_time: propertyInfo.check_in_time,
                    check_out_time: propertyInfo.check_out_time,
                    house_rules: propertyInfo.house_rules
                  },
                  guest: {
                    first_name: user.user_metadata?.first_name || '',
                    last_name: user.user_metadata?.last_name || '',
                    email: user.email || '',
                    phone: user.user_metadata?.phone || ''
                  },
                  host: {
                    first_name: hostProfile.first_name || '',
                    last_name: hostProfile.last_name || '',
                    email: hostProfile.email || '',
                    phone: hostProfile.phone || ''
                  },
                  status: 'confirmed',
                  message: bookingData.messageToHost || '',
                  payment_method: bookingData.paymentMethod || '',
                  payment_plan: bookingData.paymentPlan || '',
                  payment_currency: bookingData.paymentCurrency || 'XOF',
                  exchange_rate: bookingData.paymentRate || null
                }
              };

              // Envoyer l'email de confirmation au voyageur (comme sur le site web)
                if (__DEV__) console.log('📧 [useBookings] Envoi email de confirmation au voyageur (réservation automatique)');
              const guestEmailResult = await supabase.functions.invoke('send-email', { body: guestEmailData });
              if (guestEmailResult.error) {
                console.error('❌ [useBookings] Erreur email voyageur:', guestEmailResult.error);
              } else {
                if (__DEV__) console.log('✅ [useBookings] Email avec PDF envoyé au voyageur (réservation automatique)');
              }

              // Délai pour éviter le rate limit
              await new Promise(resolve => setTimeout(resolve, 600));

              // Email à l'hôte avec PDF (généré automatiquement)
              const hostEmailData = {
                type: 'booking_confirmed_host',
                to: hostProfile.email,
                data: {
                  bookingId: booking.id,
                  hostName: hostName,
                  guestName: guestName,
                  propertyTitle: propertyInfo.title,
                  checkIn: bookingData.checkInDate,
                  checkOut: bookingData.checkOutDate,
                  guestsCount: bookingData.guestsCount,
                  totalPrice: bookingData.totalPrice,
                  host_net_amount: (booking as any).host_net_amount, // Inclure host_net_amount stocké
                  discountApplied: bookingData.discountApplied || false,
                  discountAmount: bookingData.discountAmount || 0,
                  property: {
                    title: propertyInfo.title,
                    address: propertyInfo.address || '',
                    city_name: propertyInfo.locations?.name || '',
                    city_region: propertyInfo.locations?.type === 'region' ? propertyInfo.locations?.name : '',
                    price_per_night: propertyInfo.price_per_night || 0,
                    cleaning_fee: propertyInfo.cleaning_fee || 0,
                    service_fee: propertyInfo.service_fee || 0,
                    taxes: propertyInfo.taxes || 0,
                    cancellation_policy: propertyInfo.cancellation_policy || 'flexible',
                    check_in_time: propertyInfo.check_in_time,
                    check_out_time: propertyInfo.check_out_time,
                    house_rules: propertyInfo.house_rules
                  },
                  guest: {
                    first_name: user.user_metadata?.first_name || '',
                    last_name: user.user_metadata?.last_name || '',
                    email: user.email || '',
                    phone: user.user_metadata?.phone || ''
                  },
                  host: {
                    first_name: hostProfile.first_name || '',
                    last_name: hostProfile.last_name || '',
                    email: hostProfile.email || '',
                    phone: hostProfile.phone || ''
                  },
                  status: 'confirmed',
                  message: bookingData.messageToHost || '',
                  payment_method: bookingData.paymentMethod || '',
                  payment_plan: bookingData.paymentPlan || '',
                  payment_currency: bookingData.paymentCurrency || 'XOF',
                  exchange_rate: bookingData.paymentRate || null
                }
              };

              const hostEmailResult = await supabase.functions.invoke('send-email', { body: hostEmailData });
              if (hostEmailResult.error) {
                console.error('❌ [useBookings] Erreur email hôte:', hostEmailResult.error);
              } else {
                if (__DEV__) console.log('✅ [useBookings] Email avec PDF envoyé à l\'hôte');
              }
            } catch (emailError) {
              console.error('❌ [useBookings] Erreur envoi emails:', emailError);
              // Ne pas faire échouer la réservation si l'email échoue
            }
          } else if (initialStatus === 'pending') {
            // Réservation en attente - envoyer les emails de demande (comme sur le site web)
            if (__DEV__) console.log('✅ [useBookings] Réservation en attente - envoi emails de demande');
            
            // Email de notification à l'hôte
            // Inclure host_net_amount dans l'email de demande
            await sendBookingRequest(
              hostProfile.email,
              hostName,
              guestName,
              propertyInfo.title,
              bookingData.checkInDate,
              bookingData.checkOutDate,
              bookingData.guestsCount,
              bookingData.totalPrice,
              bookingData.messageToHost,
              bookingData.discountAmount || 0,
              {
                title: propertyInfo.title,
                address: propertyInfo.address || '',
                city_name: propertyInfo.locations?.name || '',
                price_per_night: propertyInfo.price_per_night || 0,
                cleaning_fee: propertyInfo.cleaning_fee || 0,
                service_fee: propertyInfo.service_fee || 0,
                taxes: propertyInfo.taxes || 0,
                free_cleaning_min_days: propertyInfo.free_cleaning_min_days || null, // Inclure free_cleaning_min_days
                cancellation_policy: propertyInfo.cancellation_policy || 'flexible',
                check_in_time: propertyInfo.check_in_time,
                check_out_time: propertyInfo.check_out_time,
                house_rules: propertyInfo.house_rules
              },
              booking?.host_net_amount || hostNetAmountResult.hostNetAmount, // Inclure host_net_amount
              bookingData.paymentCurrency || 'XOF',
              bookingData.paymentRate || undefined
            );

            // Délai pour éviter le rate limit
            await new Promise(resolve => setTimeout(resolve, 600));

            // Email de confirmation au voyageur (demande envoyée)
            await sendBookingRequestSent(
              user.email || '',
              guestName,
              propertyInfo.title,
              bookingData.checkInDate,
              bookingData.checkOutDate,
              bookingData.guestsCount,
              bookingData.totalPrice,
              bookingData.paymentCurrency || 'XOF',
              bookingData.paymentRate || undefined
            );
          }

          if (__DEV__) console.log('✅ [useBookings] Emails de réservation envoyés');
        }
      } catch (emailError) {
        console.error('❌ [useBookings] Erreur envoi email:', emailError);
        // Ne pas faire échouer la réservation si l'email échoue
      }

      return { success: true, booking };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false, error: `Une erreur inattendue est survenue: ${err}` };
    } finally {
      setLoading(false);
    }
  };

  const getUserBookings = async () => {
    if (!user) {
      setError('Vous devez être connecté pour voir vos réservations');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          *,
          properties (
            id,
            title,
            price_per_night,
            host_id,
            max_guests,
            cleaning_fee,
            service_fee,
            taxes,
            cancellation_policy,
            check_in_time,
            check_out_time,
            house_rules,
            discount_enabled,
            discount_min_nights,
            discount_percentage,
            long_stay_discount_enabled,
            long_stay_discount_min_nights,
            long_stay_discount_percentage,
            free_cleaning_min_days,
            images,
            property_photos (
              id,
              url,
              category,
              display_order
            ),
            locations:location_id (
              id,
              name,
              type,
              latitude,
              longitude,
              parent_id
            )
          )
        `)
        .eq('guest_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookings:', error);
        setError('Erreur lors du chargement des réservations');
        return [];
      }

      // Mettre à jour automatiquement le statut des réservations passées
      const updatedBookings = await updateBookingStatuses(bookings as Booking[]);

      // Ne pas afficher les réservations carte "pending" tant que Stripe n'a pas confirmé le paiement.
      // Cela évite qu'une demande apparaisse dans "Mes réservations" après fermeture Stripe sans paiement.
      const cardPendingBookings = updatedBookings.filter(
        (booking) => booking.payment_method === 'card' && booking.status === 'pending'
      );

      if (cardPendingBookings.length === 0) {
        return updatedBookings;
      }

      const cardPendingIds = cardPendingBookings.map((booking) => booking.id);
      const { data: cardPayments, error: paymentError } = await supabase
        .from('payments')
        .select('booking_id, status')
        .in('booking_id', cardPendingIds);

      if (paymentError) {
        console.error('Error fetching card payments:', paymentError);
        // En cas d'erreur, on renvoie la liste complète plutôt que de cacher des données potentiellement valides.
        return updatedBookings;
      }

      const paidBookingIds = new Set(
        (cardPayments || [])
          .filter((payment: any) => ['completed', 'succeeded', 'paid'].includes(String(payment.status || '').toLowerCase()))
          .map((payment: any) => payment.booking_id)
      );

      return updatedBookings.filter((booking) => {
        if (booking.payment_method === 'card' && booking.status === 'pending') {
          return paidBookingIds.has(booking.id);
        }
        return true;
      });
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatuses = async (bookings: Booking[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Commencer à minuit pour la comparaison

    // Retourner les réservations avec les statuts mis à jour côté client uniquement
    // Évite les erreurs de contraintes de la base de données
    return bookings.map(booking => {
      const checkOutDate = new Date(booking.check_out_date);
      checkOutDate.setHours(0, 0, 0, 0);

      // Si la date de checkout est passée et que le statut n'est pas déjà terminé ou annulé
      if (checkOutDate < today && 
          booking.status !== 'completed' && 
          booking.status !== 'cancelled') {
        if (__DEV__) console.log(`Réservation ${booking.id} marquée comme terminée côté client`);
        return { ...booking, status: 'completed' as const };
      }
      return booking;
    });
  };

  const cancelBooking = async (bookingId: string) => {
    if (!user) {
      setError('Vous devez être connecté pour annuler une réservation');
      return { success: false };
    }

    setLoading(true);
    setError(null);

    try {
      // Vérifier d'abord le statut de la réservation
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('status, check_out_date')
        .eq('id', bookingId)
        .eq('guest_id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching booking:', fetchError);
        setError('Erreur lors de la récupération de la réservation');
        return { success: false };
      }

      // Vérifier si la réservation peut être annulée
      if (booking.status === 'completed') {
        setError('Impossible d\'annuler une réservation terminée');
        return { success: false, error: 'Impossible d\'annuler une réservation terminée' };
      }

      if (booking.status === 'cancelled') {
        setError('Cette réservation est déjà annulée');
        return { success: false, error: 'Cette réservation est déjà annulée' };
      }

      // Récupérer les détails complets de la réservation pour les emails et les vérifications
      const { data: fullBooking, error: fetchFullError } = await supabase
        .from('bookings')
        .select(`
          *,
          properties!inner(
            id,
            title,
            price_per_night,
            host_id,
            cancellation_policy
          ),
          profiles!bookings_guest_id_fkey(
            first_name,
            last_name,
            email
          )
        `)
        .eq('id', bookingId)
        .eq('guest_id', user.id)
        .single();

      if (fetchFullError) {
        console.error('Error fetching full booking:', fetchFullError);
        setError('Erreur lors de la récupération de la réservation');
        return { success: false };
      }

      // Vérifier que les dates ne sont pas passées
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkOutDate = new Date(fullBooking.check_out_date);
      checkOutDate.setHours(0, 0, 0, 0);

      if (checkOutDate < today) {
        setError('Impossible d\'annuler une réservation dont les dates sont passées');
        return { success: false, error: 'Impossible d\'annuler une réservation dont les dates sont passées' };
      }

      // Calculer les informations d'annulation (mêmes règles que useBookingCancellation : 8.1, 8.2, 8.3)
      const checkInDate = new Date(fullBooking.check_in_date);
      checkInDate.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const totalNights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const baseAmount = fullBooking.properties.price_per_night * totalNights;
      const feesAndTaxes = Math.max(0, fullBooking.total_price - baseAmount);
      const policy = fullBooking.properties.cancellation_policy || 'flexible';
      const isPending = fullBooking.status === 'pending';
      const isInProgress = checkInDate <= now && now <= checkOutDate;
      const nightsElapsed = isInProgress ? Math.max(0, Math.ceil((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const remainingNights = isInProgress ? Math.max(0, totalNights - nightsElapsed) : totalNights;
      const remainingNightsAmount = remainingNights * fullBooking.properties.price_per_night;

      let refundAmount = 0;
      let penaltyAmount = 0;

      if (isPending) {
        refundAmount = fullBooking.total_price;
      } else if (isInProgress) {
        if (remainingNights <= 0) {
          refundAmount = 0;
          penaltyAmount = fullBooking.total_price;
        } else {
          const taxesProRata = totalNights > 0 ? (remainingNights / totalNights) * feesAndTaxes : 0;
          if (policy === 'flexible') refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
          else if (policy === 'moderate') refundAmount = Math.round(0.5 * remainingNightsAmount + taxesProRata);
          else if (policy === 'strict') refundAmount = Math.round(taxesProRata);
          else refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
          penaltyAmount = Math.max(0, fullBooking.total_price - refundAmount);
        }
      } else {
        const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (policy === 'flexible') {
          if (hoursUntilCheckIn >= 24) refundAmount = fullBooking.total_price;
          else {
            const taxesProRata = totalNights > 0 ? (remainingNights / totalNights) * feesAndTaxes : 0;
            refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
            penaltyAmount = Math.max(0, fullBooking.total_price - refundAmount);
          }
        } else if (policy === 'moderate') {
          if (daysUntilCheckIn >= 5) refundAmount = fullBooking.total_price;
          else {
            const taxesProRata = totalNights > 0 ? (remainingNights / totalNights) * feesAndTaxes : 0;
            refundAmount = Math.round(0.5 * remainingNightsAmount + taxesProRata);
            penaltyAmount = Math.max(0, fullBooking.total_price - refundAmount);
          }
        } else if (policy === 'strict') {
          if (daysUntilCheckIn >= 28) refundAmount = fullBooking.total_price;
          else if (daysUntilCheckIn >= 7) {
            refundAmount = Math.round(0.5 * fullBooking.total_price);
            penaltyAmount = fullBooking.total_price - refundAmount;
          } else {
            const taxesProRata = totalNights > 0 ? (remainingNights / totalNights) * feesAndTaxes : 0;
            refundAmount = Math.round(taxesProRata);
            penaltyAmount = Math.max(0, fullBooking.total_price - refundAmount);
          }
        } else if (policy === 'non_refundable') {
          penaltyAmount = fullBooking.total_price;
        } else {
          if (hoursUntilCheckIn >= 24) refundAmount = fullBooking.total_price;
          else {
            const taxesProRata = totalNights > 0 ? (remainingNights / totalNights) * feesAndTaxes : 0;
            refundAmount = Math.round(0.8 * remainingNightsAmount + taxesProRata);
            penaltyAmount = Math.max(0, fullBooking.total_price - refundAmount);
          }
        }
      }

      // Procéder à l'annulation
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Annulation par le voyageur',
          cancellation_penalty: penaltyAmount
        })
        .eq('id', bookingId)
        .eq('guest_id', user.id);

      if (error) {
        console.error('Error cancelling booking:', error);
        setError('Erreur lors de l\'annulation de la réservation');
        return { success: false };
      }

      // Envoyer les emails explicites aux deux parties
      try {
        // Récupérer le profil de l'hôte
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('user_id', fullBooking.properties.host_id)
          .single();

        // Email au voyageur (confirmation de son annulation)
        if (fullBooking.profiles?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_cancelled_guest',
              to: fullBooking.profiles.email,
              data: {
                guestName: `${fullBooking.profiles.first_name || ''} ${fullBooking.profiles.last_name || ''}`.trim(),
                propertyTitle: fullBooking.properties.title,
                checkIn: fullBooking.check_in_date,
                checkOut: fullBooking.check_out_date,
                guests: fullBooking.guests_count,
                totalPrice: fullBooking.total_price,
                refundAmount: refundAmount,
                penaltyAmount: penaltyAmount,
                reason: 'Annulation par le voyageur',
                siteUrl: 'https://akwahome.com'
              }
            }
          });
          if (__DEV__) console.log('✅ Email d\'annulation envoyé au voyageur');
        }

        // Email à l'hôte (notification de l'annulation)
        if (hostProfile?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'booking_cancelled_host',
              to: hostProfile.email,
              data: {
                hostName: `${hostProfile.first_name || ''} ${hostProfile.last_name || ''}`.trim(),
                propertyTitle: fullBooking.properties.title,
                guestName: `${fullBooking.profiles.first_name || ''} ${fullBooking.profiles.last_name || ''}`.trim(),
                checkIn: fullBooking.check_in_date,
                checkOut: fullBooking.check_out_date,
                guests: fullBooking.guests_count,
                totalPrice: fullBooking.total_price,
                penaltyAmount: penaltyAmount,
                reason: 'Annulation par le voyageur',
                siteUrl: 'https://akwahome.com'
              }
            }
          });
          if (__DEV__) console.log('✅ Email d\'annulation envoyé à l\'hôte');
        }
      } catch (emailError) {
        console.error('❌ Erreur envoi emails annulation:', emailError);
        // Ne pas faire échouer l'annulation si l'email échoue
      }

      return { success: true };
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Une erreur inattendue est survenue');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return {
    createBooking,
    getUserBookings,
    cancelBooking,
    loading,
    error,
  };
};
