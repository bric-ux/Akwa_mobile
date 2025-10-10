import { supabase } from '../services/supabase';

interface EmailData {
  type: 'welcome' | 'email_confirmation' | 'booking_request' | 'booking_response' | 'booking_confirmed' | 'password_reset';
  to: string;
  data: any;
}

export const useEmailService = () => {
  const sendEmail = async (emailData: EmailData) => {
    try {
      console.log('Sending email:', emailData);
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: emailData
      });

      if (error) {
        console.error('Error sending email:', error);
        throw new Error(error.message || 'Failed to send email');
      }

      console.log('Email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  };

  const sendBookingConfirmation = async (bookingData: {
    userEmail: string;
    userName: string;
    propertyTitle: string;
    checkInDate: string;
    checkOutDate: string;
    totalPrice: number;
    isAutoBooking: boolean;
    guestsCount?: number;
    message?: string;
  }) => {
    return sendEmail({
      type: bookingData.isAutoBooking ? 'booking_confirmed' : 'booking_request_sent',
      to: bookingData.userEmail,
      data: {
        guestName: bookingData.userName,
        propertyTitle: bookingData.propertyTitle,
        checkIn: bookingData.checkInDate,
        checkOut: bookingData.checkOutDate,
        totalPrice: bookingData.totalPrice,
        guests: bookingData.guestsCount || 1,
        message: bookingData.message
      }
    });
  };

  const sendWelcomeEmail = async (userEmail: string, userName: string) => {
    return sendEmail({
      type: 'welcome',
      to: userEmail,
      data: {
        userName
      }
    });
  };

  const sendEmailConfirmation = async (userEmail: string, userName: string) => {
    return sendEmail({
      type: 'email_confirmation',
      to: userEmail,
      data: {
        userName
      }
    });
  };

  const sendBookingRequestToHost = async (hostEmail: string, bookingData: {
    hostName: string;
    guestName: string;
    propertyTitle: string;
    checkInDate: string;
    checkOutDate: string;
    totalPrice: number;
    guestsCount: number;
    message?: string;
  }) => {
    return sendEmail({
      type: 'booking_request',
      to: hostEmail,
      data: {
        hostName: bookingData.hostName,
        guestName: bookingData.guestName,
        propertyTitle: bookingData.propertyTitle,
        checkIn: bookingData.checkInDate,
        checkOut: bookingData.checkOutDate,
        totalPrice: bookingData.totalPrice,
        guests: bookingData.guestsCount,
        message: bookingData.message
      }
    });
  };

  return { 
    sendEmail, 
    sendBookingConfirmation, 
    sendWelcomeEmail, 
    sendEmailConfirmation,
    sendBookingRequestToHost
  };
};
