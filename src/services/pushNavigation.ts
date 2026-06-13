import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types';

/** Types de `data.type` alignés avec sendPushToUser côté hooks */
export const PUSH_TYPE_MESSAGE = 'message';
export const PUSH_TYPE_PROPERTY_BOOKING = 'property_booking';
export const PUSH_TYPE_VEHICLE_BOOKING = 'vehicle_booking';
export const PUSH_TYPE_ADMIN_NEW_BOOKING = 'admin_new_booking';
export const PUSH_TYPE_ADMIN_NEW_IDENTITY = 'admin_new_identity';
export const PUSH_TYPE_ZIP_DAILY = 'zip_daily';

/**
 * Navigation depuis le tap sur une notification (données Expo dans content.data).
 * Retourne true si une route a été poussée.
 */
export function navigateFromPushData(
  navigationRef: NavigationContainerRef<RootStackParamList> | null,
  raw: Record<string, unknown>
): boolean {
  if (!navigationRef?.isReady()) return false;

  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    data[k] = typeof v === 'string' ? v : String(v);
  }

  const type = data.type || 'general';

  if (type === PUSH_TYPE_MESSAGE && data.conversationId) {
    navigationRef.navigate('Messaging', {
      conversationId: data.conversationId,
      ...(data.propertyId ? { propertyId: data.propertyId } : {}),
      ...(data.vehicleId ? { vehicleId: data.vehicleId } : {}),
    });
    return true;
  }

  if (type === PUSH_TYPE_PROPERTY_BOOKING && data.bookingId) {
    navigationRef.navigate('PropertyBookingDetails', { bookingId: data.bookingId });
    return true;
  }

  if (type === PUSH_TYPE_VEHICLE_BOOKING && data.bookingId) {
    navigationRef.navigate('VehicleBookingDetails', { bookingId: data.bookingId });
    return true;
  }

  if (type === PUSH_TYPE_ADMIN_NEW_BOOKING && data.bookingId) {
    navigationRef.navigate('AdminBookingManagement', {
      bookingId: data.bookingId,
      bookingType:
        data.bookingType === 'vehicle' || data.bookingType === 'property'
          ? data.bookingType
          : undefined,
    });
    return true;
  }

  if (type === PUSH_TYPE_ADMIN_NEW_IDENTITY) {
    navigationRef.navigate('AdminIdentityDocuments', {
      ...(data.documentId ? { documentId: data.documentId } : {}),
      ...(data.userId ? { userId: data.userId } : {}),
    });
    return true;
  }

  if (type === PUSH_TYPE_ZIP_DAILY || data.screen === 'ZipGame') {
    navigationRef.navigate('ZipGame');
    return true;
  }

  return false;
}

/** Âge d’une notification Expo (date parfois en s, parfois en ms selon la plateforme). */
export function getNotificationAgeMs(notification: { date?: number }): number {
  const d = notification.date;
  if (d == null || !Number.isFinite(d)) return Number.POSITIVE_INFINITY;
  const ms = d < 1e12 ? d * 1000 : d;
  return Date.now() - ms;
}
