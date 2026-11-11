/** Features véhicule : code stable ↔ libellé FR stocké historiquement. */

export const VEHICLE_FEATURE_CATALOG = [
  { code: 'ac', fr: 'Climatisation' },
  { code: 'gps', fr: 'GPS' },
  { code: 'bluetooth', fr: 'Bluetooth' },
  { code: 'leather_seats', fr: 'Sièges en cuir' },
  { code: 'sunroof', fr: 'Toit ouvrant' },
  { code: 'backup_camera', fr: 'Caméra de recul' },
  { code: 'cruise_control', fr: 'Régulateur de vitesse' },
  { code: 'rain_sensor', fr: 'Détecteur de pluie' },
  { code: 'auto_lights', fr: 'Phares automatiques' },
  { code: 'parking_assist', fr: 'Parking assisté' },
  { code: 'premium_audio', fr: 'Système audio premium' },
  { code: 'usb', fr: 'USB / Chargeur' },
  { code: 'power_windows', fr: 'Vitres électriques' },
  { code: 'central_lock', fr: 'Verrouillage centralisé' },
  { code: 'airbags', fr: 'Airbags' },
] as const;

const byCode = new Map(VEHICLE_FEATURE_CATALOG.map((f) => [f.code, f]));
const byFr = new Map(VEHICLE_FEATURE_CATALOG.map((f) => [f.fr.toLowerCase(), f]));

/** Legacy web ids → code */
const LEGACY_IDS: Record<string, string> = {
  climatisation: 'ac',
  gps: 'gps',
  bluetooth: 'bluetooth',
  'sieges-cuir': 'leather_seats',
  'toit-ouvrant': 'sunroof',
  'camera-recul': 'backup_camera',
  regulateur: 'cruise_control',
  'audio-premium': 'premium_audio',
  usb: 'usb',
  'vitres-electriques': 'power_windows',
  verrouillage: 'central_lock',
  airbags: 'airbags',
};

export const PRESET_VEHICLE_FEATURE_CODES = VEHICLE_FEATURE_CATALOG.slice(0, 10).map((f) => f.code);

export function vehicleFeatureCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (byCode.has(v)) return v;
  if (LEGACY_IDS[v]) return LEGACY_IDS[v];
  const fromFr = byFr.get(v.toLowerCase());
  return fromFr?.code ?? null;
}

export function normalizeVehicleFeatureCodes(features: string[] | null | undefined): string[] {
  if (!features?.length) return [];
  const set = new Set<string>();
  for (const f of features) {
    const code = vehicleFeatureCode(f);
    if (code) set.add(code);
    else set.add(f); // custom free-text kept as-is
  }
  return Array.from(set);
}

type TFn = (key: string, params?: Record<string, string>) => string;

export function vehicleFeatureLabel(value: string | null | undefined, t: TFn): string {
  if (!value?.trim()) return '';
  const code = vehicleFeatureCode(value);
  if (code && byCode.has(code)) {
    const key = `vehicleFeature.${code}`;
    const translated = t(key);
    if (translated && translated !== key) return translated;
    return byCode.get(code)!.fr;
  }
  return value.trim();
}
