import { supabase } from './supabase';
import {
  notifyAdminsModerationPush,
  type ModerationEntityType,
} from './notifyAdminsModerationPush';

const ADMIN_EMAIL = 'contact@akwahome.com';

async function sendModerationEmail(
  type: string,
  to: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!to.trim()) return;
  try {
    await supabase.functions.invoke('send-email', { body: { type, to, data } });
  } catch (e) {
    if (__DEV__) console.warn('[moderationNotifications] email failed:', type, e);
  }
}

type NotifyAdminModerationParams = {
  entityType: ModerationEntityType;
  entityId: string;
  listingTitle: string;
  submitterName: string;
  adminScreen: string;
  emailType: string;
  pushTitle: string;
  pushBody: string;
  emailData: Record<string, unknown>;
};

export async function notifyAdminModerationSubmission(
  params: NotifyAdminModerationParams,
): Promise<void> {
  await Promise.all([
    sendModerationEmail(params.emailType, ADMIN_EMAIL, {
      listingTitle: params.listingTitle,
      submitterName: params.submitterName,
      ...params.emailData,
    }),
    notifyAdminsModerationPush({
      entityType: params.entityType,
      entityId: params.entityId,
      title: params.pushTitle,
      body: params.pushBody,
      adminScreen: params.adminScreen,
    }),
  ]);
}

export async function notifyMonthlyListingSubmitted(
  listingId: string,
  title: string,
  ownerName: string,
): Promise<void> {
  await notifyAdminModerationSubmission({
    entityType: 'monthly_listing',
    entityId: listingId,
    listingTitle: title,
    submitterName: ownerName,
    adminScreen: 'AdminMonthlyRental',
    emailType: 'monthly_listing_submitted',
    pushTitle: 'Annonce bail à valider',
    pushBody: `${ownerName} — ${title}`,
    emailData: { ownerName, listingId },
  });
}

export async function notifyHotelEstablishmentSubmitted(
  establishmentId: string,
  title: string,
  hostName: string,
): Promise<void> {
  await notifyAdminModerationSubmission({
    entityType: 'hotel_establishment',
    entityId: establishmentId,
    listingTitle: title,
    submitterName: hostName,
    adminScreen: 'AdminHotels',
    emailType: 'hotel_establishment_submitted',
    pushTitle: 'Établissement hôtel à valider',
    pushBody: `${hostName} — ${title}`,
    emailData: { hostName, establishmentId },
  });
}
