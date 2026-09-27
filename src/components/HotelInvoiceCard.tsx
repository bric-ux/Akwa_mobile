import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HOTEL_COLORS } from '../constants/colors';
import akwaHomeLogo from '../../assets/icon.png';

export type HotelInvoiceData = {
  bookingCode: string | null;
  hotelTitle: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  pricePerNight: number;
  cleaningFee: number;
  taxesTotal: number;
  total: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  status: string;
  travelerName?: string;
  createdAt?: string;
};

const PAY_METHOD: Record<string, string> = {
  cash: 'Espèces à l’arrivée',
  card: 'Carte bancaire',
  wave: 'Wave',
};

const PAY_STATUS: Record<string, string> = {
  unpaid: 'À régler à l’arrivée',
  paid: 'Payé',
  refunded: 'Remboursé',
  waived: 'Offert',
};

const BOOKING_STATUS: Record<string, string> = {
  pending: 'En attente de confirmation',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  completed: 'Terminée',
};

function formatFcfa(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type Props = {
  data: HotelInvoiceData;
  /** traveler | host */
  variant?: 'traveler' | 'host';
};

export default function HotelInvoiceCard({ data, variant = 'traveler' }: Props) {
  const nightsLine = data.pricePerNight * data.nights;
  const payLabel = PAY_METHOD[data.paymentMethod || ''] || data.paymentMethod || '—';
  const payStatusLabel = PAY_STATUS[data.paymentStatus || ''] || data.paymentStatus || '—';

  return (
    <View style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.header}>
        <Image source={akwaHomeLogo} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>AkwaHome</Text>
          <Text style={styles.docTitle}>
            {variant === 'host' ? 'Fiche réservation hôtel' : 'Facture / reçu'}
          </Text>
        </View>
        {data.bookingCode ? (
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{data.bookingCode}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.hotel}>{data.hotelTitle}</Text>
      <Text style={styles.room}>{data.roomName}</Text>

      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={16} color="#64748b" />
        <Text style={styles.rowText}>
          {formatDate(data.checkIn)} → {formatDate(data.checkOut)}
        </Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="moon-outline" size={16} color="#64748b" />
        <Text style={styles.rowText}>
          {data.nights} nuit{data.nights > 1 ? 's' : ''} · {data.guests} voyageur
          {data.guests > 1 ? 's' : ''}
        </Text>
      </View>
      {data.travelerName ? (
        <View style={styles.row}>
          <Ionicons name="person-outline" size={16} color="#64748b" />
          <Text style={styles.rowText}>{data.travelerName}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.line}>
        <Text style={styles.lineLabel}>
          Chambre × {data.nights} nuit{data.nights > 1 ? 's' : ''}
        </Text>
        <Text style={styles.lineValue}>{formatFcfa(nightsLine)}</Text>
      </View>
      {data.taxesTotal > 0 ? (
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Taxes</Text>
          <Text style={styles.lineValue}>{formatFcfa(data.taxesTotal)}</Text>
        </View>
      ) : null}
      {data.cleaningFee > 0 ? (
        <View style={styles.line}>
          <Text style={styles.lineLabel}>Frais de ménage</Text>
          <Text style={styles.lineValue}>{formatFcfa(data.cleaningFee)}</Text>
        </View>
      ) : null}

      <View style={[styles.line, styles.totalLine]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatFcfa(data.total)}</Text>
      </View>

      <View style={styles.payBox}>
        <View style={styles.payRow}>
          <Ionicons name="cash-outline" size={18} color={HOTEL_COLORS.primary} />
          <Text style={styles.payMethod}>{payLabel}</Text>
        </View>
        <Text style={styles.payStatus}>{payStatusLabel}</Text>
        <Text style={styles.bookingStatus}>
          Statut : {BOOKING_STATUS[data.status] || data.status}
        </Text>
      </View>

      {data.paymentMethod === 'cash' && data.paymentStatus !== 'paid' ? (
        <Text style={styles.hint}>
          Le montant est à régler en espèces à l’accueil de l’hôtel le jour de l’arrivée.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    paddingBottom: 16,
  },
  accent: { height: 4, backgroundColor: HOTEL_COLORS.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  logo: { width: 36, height: 36, borderRadius: 8 },
  brand: { fontSize: 12, fontWeight: '700', color: HOTEL_COLORS.primary, letterSpacing: 0.4 },
  docTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  codeBadge: {
    backgroundColor: HOTEL_COLORS.light,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeText: { fontSize: 12, fontWeight: '700', color: HOTEL_COLORS.dark },
  hotel: {
    marginHorizontal: 16,
    marginTop: 8,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  room: { marginHorizontal: 16, marginTop: 2, fontSize: 14, color: '#64748b' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  rowText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 18 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
    marginHorizontal: 16,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  lineLabel: { fontSize: 14, color: '#64748b' },
  lineValue: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  totalLine: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  totalValue: { fontSize: 16, fontWeight: '800', color: HOTEL_COLORS.primary },
  payBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: HOTEL_COLORS.light,
  },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payMethod: { fontSize: 14, fontWeight: '700', color: HOTEL_COLORS.dark },
  payStatus: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#334155' },
  bookingStatus: { marginTop: 4, fontSize: 12, color: '#64748b' },
  hint: {
    marginHorizontal: 16,
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
  },
});
