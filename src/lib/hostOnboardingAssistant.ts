import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROPERTY_TYPES } from '../constants/hostListingForm';

const ALLOWED_PROPERTY_TYPES = new Set<string>(PROPERTY_TYPES.map((p) => p.value));

/** Lieu issu de CitySearchInputModal (villes / quartiers en base) */
export type HostAssistantLocationPlace = {
  id: string;
  name: string;
  type: 'city' | 'neighborhood' | 'commune';
  region?: string;
  commune?: string;
  city_id?: string;
};

/** Brouillon produit par l’assistant IA (clés alignées sur BecomeHostScreen formData) */
export type HostAssistantFormDraft = {
  propertyType?: string;
  /** Libellé affiché (identique au lieu choisi dans la liste) */
  location?: string;
  /** Référence structurée pour BecomeHost (selectedLocation) */
  locationPlace?: HostAssistantLocationPlace;
  guests?: string;
  bedrooms?: string;
  bathrooms?: string;
  title?: string;
  description?: string;
  price?: string;
  addressDetails?: string;
};

export const HOST_ASSISTANT_DRAFT_STORAGE_KEY = 'akwahome_host_assistant_draft_v2';

function clampIntString(v: unknown, min: number, max: number): string | undefined {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : parseInt(String(v ?? '').replace(/\D/g, ''), 10);
  if (!Number.isFinite(n)) return undefined;
  const c = Math.min(max, Math.max(min, Math.round(n)));
  return String(c);
}

/** Fusionne un patch renvoyé par l’Edge (snake_case / nombres) dans un brouillon camelCase pour le formulaire */
export function mergeAssistantPatch(
  current: HostAssistantFormDraft,
  patch: Record<string, unknown>,
): HostAssistantFormDraft {
  const next = { ...current };
  const setStr = (key: keyof HostAssistantFormDraft, v: unknown) => {
    if (v === undefined || v === null) return;
    if (key === 'locationPlace') return;
    const s = typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : String(v).trim();
    if (s) next[key] = s as never;
  };

  const ptRaw = patch.property_type;
  if (typeof ptRaw === 'string' && ALLOWED_PROPERTY_TYPES.has(ptRaw)) {
    next.propertyType = ptRaw;
  }
  // location_label volontairement ignorée : la localisation vient uniquement du sélecteur (liste officielle).
  const g = clampIntString(patch.guests, 1, 32);
  if (g) next.guests = g;
  const bd = clampIntString(patch.bedrooms, 1, 24);
  if (bd) next.bedrooms = bd;
  const bt = clampIntString(patch.bathrooms, 1, 24);
  if (bt) next.bathrooms = bt;
  setStr('title', patch.title);
  setStr('description', patch.description);
  const priceRaw = patch.price_per_night;
  if (priceRaw !== undefined && priceRaw !== null) {
    const n = typeof priceRaw === 'number' ? priceRaw : parseInt(String(priceRaw).replace(/\s/g, ''), 10);
    if (Number.isFinite(n) && n > 0 && n <= 1_000_000_000) {
      next.price = String(Math.round(n));
    }
  }
  setStr('addressDetails', patch.address_details);
  return next;
}

export async function saveHostAssistantDraft(draft: HostAssistantFormDraft): Promise<void> {
  await AsyncStorage.setItem(HOST_ASSISTANT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export async function consumeHostAssistantDraft(): Promise<HostAssistantFormDraft | null> {
  const raw = await AsyncStorage.getItem(HOST_ASSISTANT_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(HOST_ASSISTANT_DRAFT_STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw) as HostAssistantFormDraft;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Messages pour le bouton « Continuer vers le formulaire » (localisation = liste officielle uniquement) */
export function getAssistantDraftBlockingMessage(d: HostAssistantFormDraft): string | null {
  if (!d.propertyType?.trim() || !ALLOWED_PROPERTY_TYPES.has(d.propertyType)) {
    return 'Sélectionnez un type de logement parmi les boutons.';
  }
  if (!d.location?.trim() || !d.locationPlace?.id) {
    return 'Choisissez une localisation via la recherche (ville, commune ou quartier enregistré).';
  }
  if (!d.guests?.trim()) {
    return 'Indiquez le nombre de voyageurs (boutons ou réponse à l’assistant).';
  }
  if (!d.bedrooms?.trim()) {
    return 'Indiquez le nombre de chambres.';
  }
  if (!d.bathrooms?.trim()) {
    return 'Indiquez le nombre de salles de bain.';
  }
  return null;
}
