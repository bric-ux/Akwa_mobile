import { supabase } from '../services/supabase';

export type AdminBookingService = 'residences' | 'vehicles' | 'hotels';
export type AdminBookingStatusKey =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'cancelled'
  | 'completed';

export type AdminBookingSummary = {
  id: string;
  guestName: string;
  listingTitle: string;
  nights: number;
  checkIn: string;
  checkOut: string;
  paid: number;
  akwaFee: number;
  hostNet: number;
  modified: boolean;
};

const STATUS_LABELS: Record<AdminBookingStatusKey, string> = {
  pending: 'En attente',
  confirmed: 'Confirmées',
  in_progress: 'En cours',
  cancelled: 'Annulées',
  completed: 'Terminées',
};

const SERVICE_LABELS: Record<AdminBookingService, string> = {
  residences: 'Résidences meublées',
  vehicles: 'Véhicules',
  hotels: 'Hôtels',
};

export function adminBookingStatusTitle(
  service: AdminBookingService,
  status: AdminBookingStatusKey,
): string {
  return `${SERVICE_LABELS[service]} · ${STATUS_LABELS[status]}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nightsBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const a = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

async function guestNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from('public_profiles')
    .select('user_id, first_name, last_name')
    .in('user_id', unique);
  for (const row of data || []) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    if (row.user_id && name) map.set(row.user_id, name);
  }
  return map;
}

async function feeByBooking(
  bookingType: 'property' | 'vehicle' | 'hotel',
  bookingIds: string[],
): Promise<Map<string, { service: number; host: number; hostNet: number }>> {
  const map = new Map<string, { service: number; host: number; hostNet: number }>();
  if (bookingIds.length === 0) return map;
  const { data } = await supabase
    .from('booking_calculation_details')
    .select('booking_id, service_fee, host_commission, host_net_amount')
    .eq('booking_type', bookingType)
    .in('booking_id', bookingIds);
  for (const row of data || []) {
    if (!row.booking_id) continue;
    map.set(row.booking_id, {
      service: money(row.service_fee),
      host: money(row.host_commission),
      hostNet: money(row.host_net_amount),
    });
  }
  return map;
}

function queryError(error: { message?: string } | null): never {
  throw new Error(error?.message || 'Chargement impossible');
}

async function modifiedIds(table: string, bookingIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (bookingIds.length === 0) return set;
  const { data, error } = await supabase
    .from(table)
    .select('booking_id')
    .in('booking_id', bookingIds);
  if (error) return set;
  for (const row of data || []) {
    if (row.booking_id) set.add(row.booking_id);
  }
  return set;
}

export async function fetchAdminBookingStatusList(
  service: AdminBookingService,
  status: AdminBookingStatusKey,
): Promise<AdminBookingSummary[]> {
  const today = todayIso();
  const dbStatus = status === 'in_progress' ? 'confirmed' : status;

  if (service === 'residences') {
    let query = supabase
      .from('bookings')
      .select('id, guest_id, check_in_date, check_out_date, total_price, host_net_amount, properties(title)')
      .eq('status', dbStatus)
      .order('check_in_date', { ascending: false })
      .limit(80);
    if (status === 'in_progress') {
      query = query.lte('check_in_date', today).gt('check_out_date', today);
    }
    const { data, error } = await query;
    if (error) queryError(error);
    const rows = data || [];
    const ids = rows.map((row) => row.id);
    const [names, mods, fees] = await Promise.all([
      guestNames(rows.map((row) => row.guest_id)),
      modifiedIds('booking_modification_requests', ids),
      feeByBooking('property', ids),
    ]);
    return rows.map((row) => {
      const fee = fees.get(row.id);
      return {
        id: row.id,
        guestName: names.get(row.guest_id) || 'Voyageur',
        listingTitle: (row.properties as { title?: string } | null)?.title || 'Résidence',
        nights: nightsBetween(row.check_in_date, row.check_out_date),
        checkIn: row.check_in_date,
        checkOut: row.check_out_date,
        paid: money(row.total_price),
        akwaFee: (fee?.service || 0) + (fee?.host || 0),
        hostNet: fee?.hostNet || money(row.host_net_amount),
        modified: mods.has(row.id),
      };
    });
  }

  if (service === 'vehicles') {
    let query = supabase
      .from('vehicle_bookings')
      .select(
        'id, renter_id, start_date, end_date, rental_days, total_price, host_net_amount, vehicles(title, brand, model)',
      )
      .eq('status', dbStatus)
      .order('start_date', { ascending: false })
      .limit(80);
    if (status === 'in_progress') {
      query = query.lte('start_date', today).gte('end_date', today);
    }
    const { data, error } = await query;
    if (error) queryError(error);
    const rows = data || [];
    const ids = rows.map((row) => row.id);
    const [names, mods, fees] = await Promise.all([
      guestNames(rows.map((row) => row.renter_id)),
      modifiedIds('vehicle_booking_modification_requests', ids),
      feeByBooking('vehicle', ids),
    ]);
    return rows.map((row) => {
      const vehicle = row.vehicles as { title?: string; brand?: string; model?: string } | null;
      const title =
        vehicle?.title?.trim() ||
        [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ') ||
        'Véhicule';
      const fee = fees.get(row.id);
      const span = nightsBetween(row.start_date, row.end_date);
      return {
        id: row.id,
        guestName: names.get(row.renter_id) || 'Locataire',
        listingTitle: title,
        nights: span > 0 ? span : Math.max(1, Number(row.rental_days) || 1),
        checkIn: row.start_date,
        checkOut: row.end_date,
        paid: money(row.total_price),
        akwaFee: (fee?.service || 0) + (fee?.host || 0),
        hostNet: fee?.hostNet || money(row.host_net_amount),
        modified: mods.has(row.id),
      };
    });
  }

  let query = supabase
    .from('hotel_bookings')
    .select(
      'id, guest_id, check_in_date, check_out_date, total_price, host_net_amount, hotel_establishments(title)',
    )
    .eq('status', dbStatus)
    .order('check_in_date', { ascending: false })
    .limit(80);
  if (status === 'in_progress') {
    query = query.lte('check_in_date', today).gt('check_out_date', today);
  }
  const { data, error } = await query;
  if (error) queryError(error);
  const rows = data || [];
  const ids = rows.map((row) => row.id);
  const [names, fees] = await Promise.all([
    guestNames(rows.map((row) => row.guest_id)),
    feeByBooking('hotel', ids),
  ]);
  return rows.map((row) => {
    const fee = fees.get(row.id);
    return {
      id: row.id,
      guestName: names.get(row.guest_id) || 'Voyageur',
      listingTitle: (row.hotel_establishments as { title?: string } | null)?.title || 'Hôtel',
      nights: nightsBetween(row.check_in_date, row.check_out_date),
      checkIn: row.check_in_date,
      checkOut: row.check_out_date,
      paid: money(row.total_price),
      akwaFee: (fee?.service || 0) + (fee?.host || 0),
      hostNet: fee?.hostNet || money(row.host_net_amount),
      modified: false,
    };
  });
}
