/**
 * Surplus chauffeur : montant configuré **par jour** sur le véhicule.
 * Les créneaux facturés à l’heure sont proratisés : jour × tarif + heures × (tarif / 24).
 */
export function computeVehicleDriverFee(
  driverFeePerDay: number,
  rentalDays: number,
  rentalHours: number
): number {
  if (!driverFeePerDay || driverFeePerDay <= 0) return 0;
  const d = Math.max(0, rentalDays);
  const h = Math.max(0, rentalHours);
  const fromDays = driverFeePerDay * d;
  const fromHours = h > 0 ? driverFeePerDay * (h / 24) : 0;
  return Math.round(fromDays + fromHours);
}
