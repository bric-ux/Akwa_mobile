import { useState } from 'react';
import { supabase } from '../services/supabase';

export interface BookingData {
  id: string;
  property: {
    title: string;
    address?: string;
    city_name?: string;
    city_region?: string;
    price_per_night: number;
    cleaning_fee?: number;
    service_fee?: number;
    taxes?: number;
    cancellation_policy?: string;
  };
  guest: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  host: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  check_in_date: string;
  check_out_date: string;
  guests_count: number;
  total_price: number;
  message?: string;
  discount_applied?: boolean;
  discount_amount?: number;
  payment_plan?: string;
}

export const useBookingPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndSendBookingPDF = async (bookingData: BookingData) => {
    setIsGenerating(true);
    
    try {
      console.log('📄 [useBookingPDF] Génération du PDF pour la réservation:', bookingData.id);
      
      // 1. Générer le PDF côté serveur
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-booking-pdf', {
        body: { bookingData }
      });

      if (pdfError) {
        console.error('❌ [useBookingPDF] Erreur génération PDF:', pdfError);
        throw new Error(`Erreur génération PDF: ${pdfError.message}`);
      }

      if (!pdfData?.success || !pdfData?.pdf) {
        throw new Error('Échec de la génération du PDF');
      }

      console.log('✅ [useBookingPDF] PDF généré avec succès');

      // 2. Préparer les données email
      const emailData = {
        bookingId: bookingData.id,
        propertyTitle: bookingData.property.title,
        guestName: `${bookingData.guest.first_name} ${bookingData.guest.last_name}`,
        hostName: `${bookingData.host.first_name} ${bookingData.host.last_name}`,
        checkIn: bookingData.check_in_date,
        checkOut: bookingData.check_out_date,
        totalPrice: bookingData.total_price,
        guestsCount: bookingData.guests_count,
        message: bookingData.message || '',
        discountApplied: bookingData.discount_applied || false,
        discountAmount: bookingData.discount_amount || 0,
        property: bookingData.property,
        guest: bookingData.guest,
        host: bookingData.host,
        payment_plan: bookingData.payment_plan || ''
      };

      // 3. Envoyer l'email avec le PDF en pièce jointe
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'booking_confirmed',
          to: bookingData.guest.email,
          data: emailData,
          attachments: [{
            filename: pdfData.filename,
            content: pdfData.pdf,
            type: 'application/pdf'
          }]
        }
      });

      if (emailError) {
        console.error('❌ [useBookingPDF] Erreur envoi email avec PDF:', emailError);
        throw new Error(`Erreur envoi email: ${emailError.message}`);
      }

      console.log('✅ [useBookingPDF] Email avec PDF envoyé avec succès');
      return { success: true };
    } catch (error) {
      console.error('❌ [useBookingPDF] Erreur:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBookingPDFForHost = async (bookingData: BookingData) => {
    setIsGenerating(true);
    
    try {
      console.log('📄 [useBookingPDF] Génération du PDF pour l\'hôte:', bookingData.id);
      
      // 1. Générer le PDF côté serveur
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke('generate-booking-pdf', {
        body: { bookingData }
      });

      if (pdfError) {
        console.error('❌ [useBookingPDF] Erreur génération PDF:', pdfError);
        throw new Error(`Erreur génération PDF: ${pdfError.message}`);
      }

      if (!pdfData?.success || !pdfData?.pdf) {
        throw new Error('Échec de la génération du PDF');
      }

      console.log('✅ [useBookingPDF] PDF généré avec succès pour l\'hôte');

      // 2. Préparer les données email pour l'hôte
      const emailData = {
        bookingId: bookingData.id,
        propertyTitle: bookingData.property.title,
        guestName: `${bookingData.guest.first_name} ${bookingData.guest.last_name}`,
        hostName: `${bookingData.host.first_name} ${bookingData.host.last_name}`,
        checkIn: bookingData.check_in_date,
        checkOut: bookingData.check_out_date,
        totalPrice: bookingData.total_price,
        guestsCount: bookingData.guests_count,
        message: bookingData.message || '',
        discountApplied: bookingData.discount_applied || false,
        discountAmount: bookingData.discount_amount || 0,
        property: bookingData.property,
        guest: bookingData.guest,
        host: bookingData.host,
        payment_plan: bookingData.payment_plan || ''
      };

      // 3. Envoyer l'email avec le PDF en pièce jointe à l'hôte
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'booking_confirmed_host',
          to: bookingData.host.email,
          data: emailData,
          attachments: [{
            filename: pdfData.filename,
            content: pdfData.pdf,
            type: 'application/pdf'
          }]
        }
      });

      if (emailError) {
        console.error('❌ [useBookingPDF] Erreur envoi email hôte avec PDF:', emailError);
        throw new Error(`Erreur envoi email hôte: ${emailError.message}`);
      }

      console.log('✅ [useBookingPDF] Email avec PDF envoyé avec succès à l\'hôte');
      return { success: true };
    } catch (error) {
      console.error('❌ [useBookingPDF] Erreur:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    generateAndSendBookingPDF,
    generateBookingPDFForHost
  };
};




