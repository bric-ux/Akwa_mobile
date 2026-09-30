import { supabase } from '../services/supabase';
import type { BookingBreakdown, StatusCounts } from '../components/admin/AdminBookingBreakdownSection';

async function countEq(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  if (error) {
    console.warn(`[bookingBreakdown] ${table}.${value}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function countIn(table: string, column: string, values: string[]): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .in(column, values);
  if (error) {
    console.warn(`[bookingBreakdown] ${table}.in:`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function countResidenceInProgress(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed')
    .lte('check_in_date', today)
    .gt('check_out_date', today);
  if (error) return 0;
  return count ?? 0;
}

async function countHotelInProgress(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('hotel_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed')
    .lte('check_in_date', today)
    .gt('check_out_date', today);
  if (error) return 0;
  return count ?? 0;
}

async function countVehicleInProgress(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('vehicle_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed')
    .lte('start_date', today)
    .gte('end_date', today);
  if (error) return 0;
  return count ?? 0;
}

/** Fallback client si la RPC admin_booking_status_breakdown est absente / en erreur. */
export async function fetchBookingBreakdownFallback(): Promise<BookingBreakdown> {
  const [
    rPending,
    rConfirmed,
    rInProgress,
    rCancelled,
    rCompleted,
    vPending,
    vConfirmed,
    vInProgress,
    vCancelled,
    vCompleted,
    hPending,
    hConfirmed,
    hInProgress,
    hCancelled,
    hCompleted,
    mPending,
    mVisit,
    mAccepted,
    mRejected,
  ] = await Promise.all([
    countEq('bookings', 'status', 'pending'),
    countEq('bookings', 'status', 'confirmed'),
    countResidenceInProgress(),
    countEq('bookings', 'status', 'cancelled'),
    countEq('bookings', 'status', 'completed'),
    countEq('vehicle_bookings', 'status', 'pending'),
    countEq('vehicle_bookings', 'status', 'confirmed'),
    countVehicleInProgress(),
    countEq('vehicle_bookings', 'status', 'cancelled'),
    countEq('vehicle_bookings', 'status', 'completed'),
    countEq('hotel_bookings', 'status', 'pending'),
    countEq('hotel_bookings', 'status', 'confirmed'),
    countHotelInProgress(),
    countEq('hotel_bookings', 'status', 'cancelled'),
    countEq('hotel_bookings', 'status', 'completed'),
    countIn('monthly_rental_candidatures', 'status', ['sent', 'viewed', 'docs_requested']),
    countEq('monthly_rental_candidatures', 'status', 'visit_authorized'),
    countEq('monthly_rental_candidatures', 'status', 'accepted'),
    countEq('monthly_rental_candidatures', 'status', 'rejected'),
  ]);

  const residences: StatusCounts = {
    pending: rPending,
    confirmed: rConfirmed,
    in_progress: rInProgress,
    cancelled: rCancelled,
    completed: rCompleted,
  };
  const vehicles: StatusCounts = {
    pending: vPending,
    confirmed: vConfirmed,
    in_progress: vInProgress,
    cancelled: vCancelled,
    completed: vCompleted,
  };
  const hotels: StatusCounts = {
    pending: hPending,
    confirmed: hConfirmed,
    in_progress: hInProgress,
    cancelled: hCancelled,
    completed: hCompleted,
  };
  const monthly: StatusCounts = {
    pending: mPending,
    visit_authorized: mVisit,
    accepted: mAccepted,
    rejected: mRejected,
  };

  return { residences, vehicles, hotels, monthly };
}

export async function fetchAdminBookingBreakdown(): Promise<BookingBreakdown> {
  const { data, error } = await supabase.rpc('admin_booking_status_breakdown');
  if (!error && data && typeof data === 'object') {
    return data as BookingBreakdown;
  }
  if (error) {
    console.warn('admin_booking_status_breakdown RPC:', error.message);
  }
  return fetchBookingBreakdownFallback();
}
