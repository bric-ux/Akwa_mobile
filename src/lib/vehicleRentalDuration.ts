/**
 * Durée location véhicule à partir d’ISO début/fin.
 * - totalHours : différence arrondie à l’heure supérieure.
 * - &lt; 24 h : rentalDays = 0, remainingHours = totalHours.
 * - Sinon : jours « inclusifs » sur les dates UTC (comme avant pour les longues durées),
 *   sauf le cas classique **une seule étape de calendrier et ≤ 24 h** (prise un jour, restitution
 *   le lendemain à la même heure) qui doit rester **1 jour**, pas 2.
 */
export type VehicleRentalDurationParts = {
  rentalDays: number;
  remainingHours: number;
  totalHours: number;
};

export function computeVehicleRentalDurationFromIso(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): VehicleRentalDurationParts {
  if (!startIso || !endIso) {
    return { rentalDays: 0, remainingHours: 0, totalHours: 0 };
  }
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { rentalDays: 0, remainingHours: 0, totalHours: 0 };
  }
  const diffTime = end.getTime() - start.getTime();
  const totalHours = Math.ceil(diffTime / (1000 * 60 * 60));

  if (totalHours < 24) {
    return { rentalDays: 0, remainingHours: totalHours, totalHours };
  }

  const startDayUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const endDayUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const calendarDiffDays = Math.round((endDayUtc - startDayUtc) / (1000 * 60 * 60 * 24));

  const rentalDays = Math.max(1, calendarDiffDays + 1);

  const fullDaysFromHours = Math.floor(totalHours / 24);
  const hoursRemainder = totalHours - fullDaysFromHours * 24;

  return {
    rentalDays,
    remainingHours: hoursRemainder > 0 ? hoursRemainder : 0,
    totalHours,
  };
}
