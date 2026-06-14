import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

interface UnavailableDate {
  start_date: string;
  end_date: string;
  reason?: string;
  endExclusive?: boolean;
}

export const useHotelRoomTypeAvailabilityCalendar = (roomTypeId: string) => {
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  const [inventoryCount, setInventoryCount] = useState(1);
  const [loading, setLoading] = useState(false);

  const normalizeDate = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  };

  const fetchUnavailableDates = useCallback(async () => {
    if (!roomTypeId) return;

    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const { data: roomType, error: roomTypeError } = await supabase
        .from('hotel_room_types')
        .select('inventory_count')
        .eq('id', roomTypeId)
        .single();

      if (roomTypeError) {
        console.error('Error fetching room type inventory:', roomTypeError);
      }

      const inventory = roomType?.inventory_count ?? 1;
      setInventoryCount(inventory);

      const { data: bookingItems, error: bookingsError } = await supabase
        .from('hotel_booking_items')
        .select(
          'quantity, hotel_bookings(id, check_in_date, check_out_date, status, payment_method)',
        )
        .eq('room_type_id', roomTypeId);

      if (bookingsError) {
        console.error('Error fetching hotel bookings:', bookingsError);
      }

      let bookings = ((bookingItems || []) as any[]).filter(
        (item) =>
          item.hotel_bookings &&
          ['confirmed', 'pending'].includes(item.hotel_bookings.status) &&
          item.hotel_bookings.check_out_date >= todayStr,
      );
      const pendingCardBookings = bookings.filter(
        (item) =>
          item.hotel_bookings.status === 'pending' &&
          item.hotel_bookings.payment_method === 'card',
      );

      if (pendingCardBookings.length > 0) {
        const pendingCardIds = pendingCardBookings.map((item) => item.hotel_bookings.id);
        const { data: payments, error: paymentsError } = await supabase
          .from('hotel_payments')
          .select('booking_id, status')
          .in('booking_id', pendingCardIds);

        if (!paymentsError) {
          const paidBookingIds = new Set(
            (payments || [])
              .filter((payment: any) =>
                ['completed', 'succeeded', 'paid'].includes(
                  String(payment.status || '').toLowerCase(),
                ),
              )
              .map((payment: any) => payment.booking_id),
          );

          bookings = bookings.filter((item) => {
            if (
              item.hotel_bookings.status === 'pending' &&
              item.hotel_bookings.payment_method === 'card'
            ) {
              return paidBookingIds.has(item.hotel_bookings.id);
            }
            return true;
          });
        }
      }

      const { data: blockedDates, error: blockedError } = await supabase
        .from('hotel_room_type_blocked_dates')
        .select('start_date, end_date, reason')
        .eq('room_type_id', roomTypeId);

      if (blockedError) {
        console.error('Error fetching hotel blocked dates:', blockedError);
      }

      const unavailableMap = new Map<string, UnavailableDate>();

      const bookedByDate = new Map<string, number>();
      bookings.forEach((item) => {
        const checkIn = normalizeDate(item.hotel_bookings.check_in_date);
        const checkOut = normalizeDate(item.hotel_bookings.check_out_date);
        const quantity = item.quantity ?? 1;

        let current = new Date(checkIn);
        const end = new Date(checkOut);
        while (current < end) {
          const dateStr = normalizeDate(current.toISOString().split('T')[0]);
          bookedByDate.set(dateStr, (bookedByDate.get(dateStr) || 0) + quantity);
          current.setDate(current.getDate() + 1);
        }
      });

      bookedByDate.forEach((booked, dateStr) => {
        if (booked >= inventory) {
          const key = `booking-${dateStr}`;
          unavailableMap.set(key, {
            start_date: dateStr,
            end_date: dateStr,
            reason: 'Réservé',
            endExclusive: false,
          });
        } else if (booked > 0) {
          const key = `partial-${dateStr}`;
          unavailableMap.set(key, {
            start_date: dateStr,
            end_date: dateStr,
            reason: `Réservé (${booked}/${inventory})`,
            endExclusive: false,
          });
        }
      });

      (blockedDates || []).forEach((blocked) => {
        const start = normalizeDate(blocked.start_date);
        const end = normalizeDate(blocked.end_date);
        const key = `blocked-${start}-${end}`;
        unavailableMap.set(key, {
          start_date: start,
          end_date: end,
          reason: blocked.reason || 'Bloqué',
          endExclusive: false,
        });
      });

      setUnavailableDates(Array.from(unavailableMap.values()));
    } catch (error) {
      console.error('Error fetching hotel availability calendar:', error);
    } finally {
      setLoading(false);
    }
  }, [roomTypeId]);

  useEffect(() => {
    fetchUnavailableDates();
  }, [fetchUnavailableDates]);

  const isDateUnavailable = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return unavailableDates.some(({ start_date, end_date, endExclusive }) => {
      const normalizedStart = normalizeDate(start_date);
      const normalizedEnd = normalizeDate(end_date);
      const exclusive = endExclusive !== false;
      return exclusive
        ? dateStr >= normalizedStart && dateStr < normalizedEnd
        : dateStr >= normalizedStart && dateStr <= normalizedEnd;
    });
  };

  const isDateRangeUnavailable = (startDate: Date, endDate: Date) => {
    const toStr = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startStr = toStr(startDate);
    const endStr = toStr(endDate);

    return unavailableDates.some(({ start_date, end_date, endExclusive }) => {
      const normalizedStart = normalizeDate(start_date);
      const normalizedEnd = normalizeDate(end_date);
      const exclusive = endExclusive !== false;
      return exclusive
        ? startStr < normalizedEnd && endStr > normalizedStart
        : startStr <= normalizedEnd && endStr > normalizedStart;
    });
  };

  return {
    unavailableDates,
    inventoryCount,
    loading,
    refetch: fetchUnavailableDates,
    isDateUnavailable,
    isDateRangeUnavailable,
  };
};
