import { supabase } from './supabase';
import { sendPushToUser } from './pushNotificationService';
import { notifyAdminsModerationPush } from './notifyAdminsModerationPush';
import { monthlyRentalDocumentLabel } from '../constants/monthlyRentalDocuments';

const ADMIN_EMAIL = 'contact@akwahome.com';

async function sendEmail(type: string, to: string, data: Record<string, unknown>): Promise<void> {
  if (!to.trim()) return;
  try {
    await supabase.functions.invoke('send-email', { body: { type, to, data } });
  } catch (e) {
    if (__DEV__) console.warn('[monthlyCandidatureNotifications] email failed:', type, e);
  }
}

type ListingContext = {
  id: string;
  title: string;
  owner_id: string;
  ownerEmail: string;
  ownerName: string;
};

async function loadListingContext(listingId: string): Promise<ListingContext | null> {
  const { data: listing } = await supabase
    .from('monthly_rental_listings')
    .select('id, title, owner_id')
    .eq('id', listingId)
    .maybeSingle();
  if (!listing) return null;

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('user_id', listing.owner_id)
    .maybeSingle();

  const ownerName =
    [ownerProfile?.first_name, ownerProfile?.last_name].filter(Boolean).join(' ') || 'Propriétaire';

  return {
    id: listing.id,
    title: listing.title,
    owner_id: listing.owner_id,
    ownerEmail: ownerProfile?.email || '',
    ownerName,
  };
}

export async function notifyMonthlyCandidatureSubmitted(params: {
  listingId: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  candidatureId: string;
}): Promise<void> {
  const listing = await loadListingContext(params.listingId);
  if (!listing) return;

  await Promise.all([
    sendEmail('monthly_candidature_submitted_owner', listing.ownerEmail, {
      ownerName: listing.ownerName,
      tenantName: params.tenantName,
      listingTitle: listing.title,
      listingId: listing.id,
    }),
    sendEmail('monthly_candidature_submitted_tenant', params.tenantEmail, {
      tenantName: params.tenantName,
      listingTitle: listing.title,
      listingId: listing.id,
    }),
    sendEmail('monthly_candidature_submitted_admin', ADMIN_EMAIL, {
      tenantName: params.tenantName,
      ownerName: listing.ownerName,
      listingTitle: listing.title,
      listingId: listing.id,
    }),
    sendPushToUser(
      listing.owner_id,
      'Nouvelle candidature bail',
      `${params.tenantName} — ${listing.title}`,
      {
        type: 'monthly_candidature',
        listingId: listing.id,
        candidatureId: params.candidatureId,
        screen: 'MonthlyRentalCandidatures',
      },
    ).catch(() => {}),
    notifyAdminsModerationPush({
      entityType: 'monthly_candidature',
      entityId: params.candidatureId,
      title: 'Nouvelle candidature bail',
      body: `${params.tenantName} — ${listing.title}`,
      adminScreen: 'AdminMonthlyRental',
    }),
  ]);
}

export async function notifyMonthlyCandidatureStatusChange(params: {
  listingId: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  status: 'accepted' | 'rejected' | 'docs_requested';
  requestedDocuments?: string[];
}): Promise<void> {
  const listing = await loadListingContext(params.listingId);
  if (!listing) return;

  if (params.status === 'docs_requested') {
    const requestedDocuments = (params.requestedDocuments || []).map(monthlyRentalDocumentLabel);
    await Promise.all([
      sendEmail('monthly_candidature_docs_requested', params.tenantEmail, {
        tenantName: params.tenantName,
        listingTitle: listing.title,
        ownerName: listing.ownerName,
        listingId: listing.id,
        requestedDocuments,
      }),
      sendPushToUser(
        params.tenantId,
        'Documents demandés',
        `Le propriétaire de ${listing.title} demande des documents complémentaires.`,
        {
          type: 'monthly_candidature',
          listingId: listing.id,
          screen: 'MyMonthlyRentalCandidatures',
        },
      ).catch(() => {}),
    ]);
    return;
  }

  const accepted = params.status === 'accepted';
  const emailType = accepted ? 'monthly_candidature_accepted' : 'monthly_candidature_rejected';

  await Promise.all([
    sendEmail(emailType, params.tenantEmail, {
      tenantName: params.tenantName,
      listingTitle: listing.title,
      ownerName: listing.ownerName,
      listingId: listing.id,
    }),
    sendPushToUser(
      params.tenantId,
      accepted ? 'Candidature acceptée' : 'Candidature refusée',
      accepted
        ? `Votre dossier pour ${listing.title} a été accepté.`
        : `Votre dossier pour ${listing.title} n'a pas été retenu.`,
      {
        type: 'monthly_candidature',
        listingId: listing.id,
        screen: 'MyMonthlyRentalCandidatures',
      },
    ).catch(() => {}),
  ]);
}
