// Hook pour l'envoi d'emails avec les mêmes contenus que le site web
import { supabase } from '../services/supabase';

const isDev = __DEV__;

export interface EmailData {
  type: 'welcome' | 'email_confirmation' | 'booking_request' | 'booking_request_sent' | 'booking_response' | 'booking_confirmed' | 'booking_confirmed_host' | 'booking_cancelled' | 'booking_cancelled_host' | 'booking_completed' | 'booking_completed_host' | 'password_reset' | 'new_message' | 'host_application_submitted' | 'host_application_received' | 'host_application_approved' | 'host_application_rejected' | 'new_property_review' | 'new_guest_review' | 'new_vehicle_review' | 'new_renter_review' | 'new_property_review_response' | 'property_review_published' | 'new_guest_review_response' | 'guest_review_published' | 'new_vehicle_review_response' | 'vehicle_review_published' | 'new_vehicle_renter_review_response' | 'vehicle_renter_review_published' | 'conciergerie_request';
  to: string;
  data: any;
}

export const useEmailService = () => {
  const sendEmail = async (emailData: EmailData) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: emailData
      });

      if (error) {
        if (isDev) console.error('[useEmailService] Erreur:', error);
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      if (isDev) console.error('[useEmailService] Erreur:', error);
      return { success: false, error };
    }
  };

  // Fonctions spécifiques pour chaque type d'email
  const sendWelcomeEmail = async (email: string, firstName: string) => {
    return sendEmail({
      type: 'welcome',
      to: email,
      data: { firstName }
    });
  };

  const sendEmailConfirmation = async (email: string, confirmationUrl: string) => {
    return sendEmail({
      type: 'email_confirmation',
      to: email,
      data: { confirmationUrl }
    });
  };

  const sendBookingRequest = async (hostEmail: string, hostName: string, guestName: string, propertyTitle: string, checkIn: string, checkOut: string, guests: number, totalPrice: number, message?: string, discountAmount?: number, property?: any, hostNetAmount?: number, paymentCurrency?: string, exchangeRate?: number) => {
    return sendEmail({
      type: 'booking_request',
      to: hostEmail,
      data: {
        hostName,
        guestName,
        propertyTitle,
        checkIn,
        checkOut,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests,
        totalPrice,
        message,
        discountAmount: discountAmount || 0,
        host_net_amount: hostNetAmount, // Inclure host_net_amount pour l'affichage dans l'email
        payment_currency: paymentCurrency,
        exchange_rate: exchangeRate,
        nights: property ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)) : undefined,
        pricePerNight: property?.price_per_night || 0,
        property: property ? {
          ...property,
          free_cleaning_min_days: property.free_cleaning_min_days || null, // S'assurer que free_cleaning_min_days est inclus
        } : undefined
      }
    });
  };

  const sendBookingRequestSent = async (guestEmail: string, guestName: string, propertyTitle: string, checkIn: string, checkOut: string, guests: number, totalPrice: number, paymentCurrency?: string, exchangeRate?: number) => {
    return sendEmail({
      type: 'booking_request_sent',
      to: guestEmail,
      data: {
        guestName,
        propertyTitle,
        checkIn,
        checkOut,
        guests,
        totalPrice,
        payment_currency: paymentCurrency,
        exchange_rate: exchangeRate
      }
    });
  };

  const sendBookingResponse = async (guestEmail: string, guestName: string, propertyTitle: string, checkIn: string, checkOut: string, guests: number, totalPrice: number, status: 'confirmed' | 'cancelled') => {
    return sendEmail({
      type: 'booking_response',
      to: guestEmail,
      data: {
        guestName,
        propertyTitle,
        checkIn,
        checkOut,
        guests,
        totalPrice,
        status
      }
    });
  };

  const sendBookingConfirmed = async (guestEmail: string, guestName: string, propertyTitle: string, checkIn: string, checkOut: string, guests: number, totalPrice: number, hostName: string, hostPhone: string, hostEmail: string, propertyAddress: string, specialMessage?: string) => {
    return sendEmail({
      type: 'booking_confirmed',
      to: guestEmail,
      data: {
        guestName,
        propertyTitle,
        checkIn,
        checkOut,
        guests,
        totalPrice,
        hostName,
        hostPhone,
        hostEmail,
        propertyAddress,
        specialMessage
      }
    });
  };

  const sendBookingConfirmedHost = async (hostEmail: string, hostName: string, guestName: string, propertyTitle: string, checkIn: string, checkOut: string, guests: number, totalPrice: number) => {
    return sendEmail({
      type: 'booking_confirmed_host',
      to: hostEmail,
      data: {
        hostName,
        guestName,
        propertyTitle,
        checkIn,
        checkOut,
        guests,
        totalPrice
      }
    });
  };

  const sendBookingCancelled = async (guestEmail: string, guestName: string, propertyTitle: string, checkIn: string, checkOut: string, guests: number, totalPrice: number) => {
    return sendEmail({
      type: 'booking_cancelled',
      to: guestEmail,
      data: {
        guestName,
        propertyTitle,
        checkIn,
        checkOut,
        guests,
        totalPrice
      }
    });
  };

  const sendBookingCancelledHost = async (hostEmail: string, hostName: string, guestName: string, propertyTitle: string, checkIn: string, checkOut: string, guests: number, totalPrice: number) => {
    return sendEmail({
      type: 'booking_cancelled_host',
      to: hostEmail,
      data: {
        hostName,
        guestName,
        propertyTitle,
        checkIn,
        checkOut,
        guests,
        totalPrice
      }
    });
  };

  const sendBookingCompleted = async (guestEmail: string, guestName: string, propertyTitle: string) => {
    return sendEmail({
      type: 'booking_completed',
      to: guestEmail,
      data: {
        guestName,
        propertyTitle
      }
    });
  };

  const sendBookingCompletedHost = async (hostEmail: string, hostName: string, guestName: string, propertyTitle: string) => {
    return sendEmail({
      type: 'booking_completed_host',
      to: hostEmail,
      data: {
        hostName,
        guestName,
        propertyTitle
      }
    });
  };

  const sendPasswordReset = async (email: string, resetUrl: string, firstName?: string) => {
    return sendEmail({
      type: 'password_reset',
      to: email,
      data: {
        resetUrl,
        firstName
      }
    });
  };

  const sendNewMessage = async (recipientEmail: string, recipientName: string, senderName: string, propertyTitle: string, message: string) => {
    return sendEmail({
      type: 'new_message',
      to: recipientEmail,
      data: {
        recipientName,
        senderName,
        propertyTitle,
        message
      }
    });
  };

  const sendHostApplicationSubmitted = async (hostEmail: string, hostName: string, propertyTitle: string, propertyType: string, location: string) => {
    return sendEmail({
      type: 'host_application_submitted',
      to: hostEmail,
      data: {
        hostName,
        propertyTitle,
        propertyType,
        location
      }
    });
  };

  const sendHostApplicationReceived = async (adminEmail: string, hostName: string, hostEmail: string, propertyTitle: string, propertyType: string, location: string, pricePerNight: number) => {
    return sendEmail({
      type: 'host_application_received',
      to: adminEmail,
      data: {
        hostName,
        hostEmail,
        propertyTitle,
        propertyType,
        location,
        pricePerNight
      }
    });
  };

  const sendHostApplicationApproved = async (hostEmail: string, hostName: string, propertyTitle: string, propertyType: string, location: string) => {
    return sendEmail({
      type: 'host_application_approved',
      to: hostEmail,
      data: {
        hostName,
        propertyTitle,
        propertyType,
        location
      }
    });
  };

  const sendHostApplicationRejected = async (hostEmail: string, hostName: string, propertyTitle: string, reason?: string) => {
    return sendEmail({
      type: 'host_application_rejected',
      to: hostEmail,
      data: {
        hostName,
        propertyTitle,
        reason: reason || 'Votre candidature ne répond pas à nos critères.'
      }
    });
  };

  const sendNewPropertyReview = async (hostEmail: string, hostName: string, guestName: string, propertyTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'new_property_review',
      to: hostEmail,
      data: {
        hostName,
        guestName,
        propertyTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  const sendNewGuestReview = async (guestEmail: string, guestName: string, hostName: string, propertyTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'new_guest_review',
      to: guestEmail,
      data: {
        guestName,
        hostName,
        propertyTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  const sendNewVehicleReview = async (ownerEmail: string, ownerName: string, renterName: string, vehicleTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'new_vehicle_review',
      to: ownerEmail,
      data: {
        ownerName,
        renterName,
        vehicleTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  const sendNewRenterReview = async (renterEmail: string, renterName: string, ownerName: string, vehicleTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'new_renter_review',
      to: renterEmail,
      data: {
        renterName,
        ownerName,
        vehicleTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  const sendNewPropertyReviewResponse = async (guestEmail: string, guestName: string, hostName: string, propertyTitle: string, response: string) => {
    return sendEmail({
      type: 'new_property_review_response',
      to: guestEmail,
      data: {
        guestName,
        hostName,
        propertyTitle,
        response
      }
    });
  };

  const sendPropertyReviewPublished = async (guestEmail: string, guestName: string, hostName: string, propertyTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'property_review_published',
      to: guestEmail,
      data: {
        guestName,
        hostName,
        propertyTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  const sendNewGuestReviewResponse = async (hostEmail: string, hostName: string, guestName: string, propertyTitle: string, response: string) => {
    return sendEmail({
      type: 'new_guest_review_response',
      to: hostEmail,
      data: {
        hostName,
        guestName,
        propertyTitle,
        response
      }
    });
  };

  const sendGuestReviewPublished = async (hostEmail: string, hostName: string, guestName: string, propertyTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'guest_review_published',
      to: hostEmail,
      data: {
        hostName,
        guestName,
        propertyTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  const sendNewVehicleReviewResponse = async (renterEmail: string, renterName: string, ownerName: string, vehicleTitle: string, response: string) => {
    return sendEmail({
      type: 'new_vehicle_review_response',
      to: renterEmail,
      data: {
        renterName,
        ownerName,
        vehicleTitle,
        response
      }
    });
  };

  const sendVehicleReviewPublished = async (renterEmail: string, renterName: string, ownerName: string, vehicleTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'vehicle_review_published',
      to: renterEmail,
      data: {
        renterName,
        ownerName,
        vehicleTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  const sendNewVehicleRenterReviewResponse = async (ownerEmail: string, ownerName: string, renterName: string, vehicleTitle: string, response: string) => {
    return sendEmail({
      type: 'new_vehicle_renter_review_response',
      to: ownerEmail,
      data: {
        ownerName,
        renterName,
        vehicleTitle,
        response
      }
    });
  };

  const sendVehicleRenterReviewPublished = async (ownerEmail: string, ownerName: string, renterName: string, vehicleTitle: string, rating: number, comment?: string) => {
    return sendEmail({
      type: 'vehicle_renter_review_published',
      to: ownerEmail,
      data: {
        ownerName,
        renterName,
        vehicleTitle,
        rating,
        comment: comment || ''
      }
    });
  };

  return {
    sendEmail,
    sendWelcomeEmail,
    sendEmailConfirmation,
    sendBookingRequest,
    sendBookingRequestSent,
    sendBookingResponse,
    sendBookingConfirmed,
    sendBookingConfirmedHost,
    sendBookingCancelled,
    sendBookingCancelledHost,
    sendBookingCompleted,
    sendBookingCompletedHost,
    sendPasswordReset,
    sendNewMessage,
    sendHostApplicationSubmitted,
    sendHostApplicationReceived,
    sendHostApplicationApproved,
    sendHostApplicationRejected,
    sendNewPropertyReview,
    sendNewGuestReview,
    sendNewVehicleReview,
    sendNewRenterReview,
    sendNewPropertyReviewResponse,
    sendPropertyReviewPublished,
    sendNewGuestReviewResponse,
    sendGuestReviewPublished,
    sendNewVehicleReviewResponse,
    sendVehicleReviewPublished,
    sendNewVehicleRenterReviewResponse,
    sendVehicleRenterReviewPublished,
  };
};