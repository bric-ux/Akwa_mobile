/**
 * Durée location véhicule alignée sur VehicleDateTimePickerModal + recherche :
 * jours calendaires inclus (« du 1er au 4 juin » = 4 jours) + heures restantes
 * après blocs de 24 h (même totalHours qu’avant pour la décomposition horaire).
 *
 * Pour totalHours &lt; 24 : rentalDays = 0 et remainingHours = totalHours ;
 * les écrans / hooks appliquent la règle métier (min 1 jour si pas d’horaire, etc.).
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
  const displayDays = Math.max(1, calendarDiffDays + 1);

  const fullDaysFromHours = Math.floor(totalHours / 24);
  const hoursRemainder = totalHours - fullDaysFromHours * 24;

  return {
    rentalDays: displayDays,
    remainingHours: hoursRemainder > 0 ? hoursRemainder : 0,
    totalHours,
  };
}
