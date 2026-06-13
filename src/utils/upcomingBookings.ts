/** Réservation logement à venir : non annulée/terminée, pas en cours, fin ≥ aujourd'hui. */
export function isUpcomingPropertyBooking(
  booking: {
    status?: string;
    check_in_date?: string;
    check_out_date?: string;
  },
  isInProgress: (b: typeof booking) => boolean,
): boolean {
  if (!booking?.check_out_date) return false;
  if (booking.status === 'cancelled' || booking.status === 'completed') return false;
  if (isInProgress(booking)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkOut = new Date(booking.check_out_date);
  checkOut.setHours(0, 0, 0, 0);
  if (checkOut < today) return false;

  return booking.status === 'pending' || booking.status === 'confirmed';
}

/** Réservation véhicule à venir : même logique avec start_date / end_date. */
export function isUpcomingVehicleBooking(
  booking: {
    status?: string;
    start_date?: string;
    end_date?: string;
  },
  isInProgress: (b: typeof booking) => boolean,
): boolean {
  if (!booking?.end_date) return false;
  if (booking.status === 'cancelled' || booking.status === 'completed') return false;
  if (isInProgress(booking)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(booking.end_date);
  endDate.setHours(0, 0, 0, 0);
  if (endDate < today) return false;

  return booking.status === 'pending' || booking.status === 'confirmed';
}

export function countUpcomingPropertyBookings<T extends Parameters<typeof isUpcomingPropertyBooking>[0]>(
  bookings: T[],
  isInProgress: (b: T) => boolean,
): number {
  return bookings.filter((b) => isUpcomingPropertyBooking(b, isInProgress)).length;
}

export function countUpcomingVehicleBookings<T extends Parameters<typeof isUpcomingVehicleBooking>[0]>(
  bookings: T[],
  isInProgress: (b: T) => boolean,
): number {
  return bookings.filter((b) => isUpcomingVehicleBooking(b, isInProgress)).length;
}
