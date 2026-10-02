/**
 * Checkout draft hôtel (carte / Wave) — parallèle au flux logements.
 * Ne touche pas aux tables bookings / vehicle_bookings.
 */
import { Linking } from 'react-native';
import { createCheckoutSession, checkPaymentStatus } from './cardPaymentService';
import { createWaveCheckoutSession, openWavePayment } from './wavePaymentService';
import { calculateHotelBookingAmounts } from '../lib/commissions';

function makeCheckoutToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    ((Math.random() * 16) | 0).toString(16),
  );
}

export type HotelDraftCheckoutInput = {
  establishmentId: string;
  establishmentTitle: string;
  roomTypeId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  nights: number;
  pricePerNight: number;
  cleaningFee: number;
  taxesTotal: number;
  totalPrice: number;
  serviceFee?: number;
  hostCommission?: number;
  hostNetAmount?: number;
  messageToHost?: string;
  paymentMethod: 'card' | 'wave';
  currency: string;
  eurRate?: number;
  customerCountry?: string;
};

export type HotelDraftCheckoutResult = {
  checkoutToken: string;
  wave: boolean;
};

/** Payload attendu par stripe-webhook (branche hotel) / create-wave-checkout-session. */
function buildHotelDraftBody(
  input: HotelDraftCheckoutInput,
  checkoutToken: string,
): Record<string, unknown> {
  const roomSubtotal = input.pricePerNight * input.nights;
  const amounts = calculateHotelBookingAmounts(
    roomSubtotal,
    input.taxesTotal,
    input.cleaningFee,
  );
  const totalPrice = input.totalPrice ?? amounts.total;
  const serviceFee = input.serviceFee ?? amounts.serviceFee;
  const hostCommission = input.hostCommission ?? amounts.hostCommission;
  const hostNetAmount = input.hostNetAmount ?? amounts.hostNetAmount;

  const amount =
    input.paymentMethod === 'wave' && input.currency === 'EUR' && input.eurRate
      ? Math.round(totalPrice * input.eurRate)
      : Math.round(totalPrice);

  const body: Record<string, unknown> = {
    checkout_token: checkoutToken,
    booking_type: 'hotel',
    payment_type: 'booking',
    client: 'mobile',
    return_to_app: true,
    app_scheme: 'akwahomemobile',
    amount,
    establishmentId: input.establishmentId,
    establishment_id: input.establishmentId,
    establishmentTitle: input.establishmentTitle,
    check_in: input.checkIn,
    check_out: input.checkOut,
    checkInDate: input.checkIn,
    checkOutDate: input.checkOut,
    guestsCount: input.guestsCount,
    totalPrice,
    hostNetAmount,
    messageToHost: input.messageToHost || undefined,
    paymentMethod: input.paymentMethod,
    paymentPlan: 'full',
    paymentCurrency: input.currency,
    paymentRate: input.currency === 'EUR' ? input.eurRate : undefined,
    customer_country: input.customerCountry || '',
    bookingCode: `HTL-${Date.now().toString(36).toUpperCase().slice(-8)}`,
    lines: [
      {
        room_type_id: input.roomTypeId,
        quantity: 1,
        price_per_night: input.pricePerNight,
        cleaning_fee: input.cleaningFee,
        room_name: input.roomName,
      },
    ],
    pricingSnapshot: {
      basePrice: roomSubtotal,
      priceAfterDiscount: roomSubtotal,
      totalCleaningFee: input.cleaningFee,
      totalTaxes: input.taxesTotal,
      serviceFee,
      hostCommission,
      hostNetAmount,
      finalTotal: totalPrice,
    },
  };

  if (input.paymentMethod === 'card' && input.currency === 'EUR' && input.eurRate) {
    body.currency = 'eur';
    body.rate = input.eurRate;
  }

  return body;
}

export async function startHotelCardCheckout(
  input: HotelDraftCheckoutInput,
): Promise<HotelDraftCheckoutResult> {
  const checkoutToken = makeCheckoutToken();
  const body = buildHotelDraftBody({ ...input, paymentMethod: 'card' }, checkoutToken);
  const result = await createCheckoutSession(body);
  await Linking.openURL(result.url);
  return { checkoutToken: result.checkout_token ?? checkoutToken, wave: false };
}

export async function startHotelWaveCheckout(
  input: HotelDraftCheckoutInput,
): Promise<HotelDraftCheckoutResult> {
  const checkoutToken = makeCheckoutToken();
  const body = buildHotelDraftBody({ ...input, paymentMethod: 'wave' }, checkoutToken);
  const result = await createWaveCheckoutSession(body);
  await openWavePayment(result.wave_launch_url);
  return { checkoutToken: result.checkout_token ?? checkoutToken, wave: true };
}

export async function verifyHotelDraftPayment(opts: {
  checkoutToken: string;
  wave?: boolean;
}): Promise<{ paid: boolean; bookingId?: string; payment_status?: string; booking_status?: string; error?: string }> {
  try {
    const result = await checkPaymentStatus({
      booking_type: 'hotel',
      payment_type: 'booking',
      checkout_token: opts.checkoutToken,
      ...(opts.wave ? { wave: true } : {}),
    });
    if (result.error) {
      return {
        paid: false,
        payment_status: result.payment_status,
        booking_status: result.booking_status,
        error: result.error,
      };
    }
    return {
      paid: !!result.is_confirmed,
      bookingId: result.booking_id,
      payment_status: result.payment_status,
      booking_status: result.booking_status,
    };
  } catch (e) {
    return {
      paid: false,
      error: e instanceof Error ? e.message : 'Vérification impossible',
    };
  }
}
