import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HotelEstablishment, HotelRoomType } from '../types';
import { useAuth } from '../services/AuthContext';
import { useCurrency } from '../hooks/useCurrency';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import BookingIdentityAlert from './BookingIdentityAlert';
import { useHotelBookings, buildLinesFromRoomType } from '../hooks/useHotelBookings';
import {
  calculateHotelBookingPricing,
  getHotelOnlineChargeAmount,
} from '../lib/hotelBookingPricing';
import { createCheckoutSession } from '../services/cardPaymentService';
import { createWaveCheckoutSession, openWavePayment } from '../services/wavePaymentService';
import { HOTEL_COLORS } from '../constants/colors';

interface HotelBookingModalProps {
  visible: boolean;
  onClose: () => void;
  establishment: HotelEstablishment;
  roomType: HotelRoomType;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  onSuccess?: () => void;
}

const HotelBookingModal: React.FC<HotelBookingModalProps> = ({
  visible,
  onClose,
  establishment,
  roomType,
  initialCheckIn,
  initialCheckOut,
  initialGuests = 1,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { currency, rates, formatPriceForPayment, changeCurrency } = useCurrency();
  const { hasUploadedIdentity, isVerified, verificationStatus, loading: identityLoading } =
    useIdentityVerification();
  const { createHotelBooking, loading } = useHotelBookings();

  const [checkIn, setCheckIn] = useState(initialCheckIn || '');
  const [checkOut, setCheckOut] = useState(initialCheckOut || '');
  const [guests, setGuests] = useState(initialGuests);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wave' | 'cash' | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<'full' | 'split'>('full');
  const [openingPayment, setOpeningPayment] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCheckIn(initialCheckIn || '');
    setCheckOut(initialCheckOut || '');
    setGuests(initialGuests);
    setQuantity(1);
    setPaymentMethod(null);
    setPaymentPlan('full');
  }, [visible, initialCheckIn, initialCheckOut, initialGuests]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  const pricing = useMemo(() => {
    if (nights < 1) return null;
    const lines = buildLinesFromRoomType(roomType, quantity);
    return calculateHotelBookingPricing(
      lines,
      nights,
      currency,
      paymentMethod === 'card',
    );
  }, [nights, roomType, quantity, currency, paymentMethod]);

  const effectivePlan = paymentMethod === 'cash' ? 'full' : paymentPlan;
  const onlineCharge =
    pricing != null
      ? getHotelOnlineChargeAmount(pricing.finalTotal, pricing.serviceFee, effectivePlan)
      : 0;

  const assertIdentity = useCallback(() => {
    if (identityLoading) {
      Alert.alert('Vérification', 'Vérification de l\'identité en cours...');
      return false;
    }
    if (!hasUploadedIdentity) {
      Alert.alert(
        'Vérification d\'identité requise',
        'Vous devez envoyer une pièce d\'identité pour réserver. Rendez-vous dans votre profil.',
      );
      return false;
    }
    if (!isVerified && verificationStatus !== 'pending') {
      Alert.alert(
        'Identité en cours de vérification',
        'Votre pièce sera validée par notre équipe avant confirmation.',
      );
      return false;
    }
    return true;
  }, [identityLoading, hasUploadedIdentity, isVerified, verificationStatus]);

  const buildDraftPayload = useCallback(
    (checkoutToken: string, method: 'card' | 'wave') => {
      const lines = [
        {
          room_type_id: roomType.id,
          quantity,
          price_per_night: roomType.price_per_night,
          cleaning_fee: roomType.cleaning_fee || 0,
          taxes_per_night: roomType.taxes_per_night || 0,
        },
      ];
      return {
        checkout_token: checkoutToken,
        booking_type: 'hotel',
        payment_type: 'booking',
        client: 'mobile',
        return_to_app: true,
        app_scheme: 'akwahomemobile',
        amount: onlineCharge,
        property_title: `${establishment.title} — ${roomType.name}`,
        check_in: checkIn,
        check_out: checkOut,
        establishmentId: establishment.id,
        establishmentTitle: establishment.title,
        hostId: establishment.host_id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestsCount: guests,
        lines,
        totalPrice: pricing!.finalTotal,
        hostNetAmount: pricing!.hostNetAmount,
        messageToHost: message.trim() || undefined,
        paymentMethod: method,
        paymentPlan: effectivePlan,
        paymentCurrency: currency,
        paymentRate: currency === 'EUR' ? rates.EUR : undefined,
        pricingSnapshot: pricing,
        ...(currency === 'EUR' && rates.EUR ? { currency: 'eur', rate: rates.EUR } : {}),
      };
    },
    [
      roomType,
      quantity,
      establishment,
      checkIn,
      checkOut,
      guests,
      onlineCharge,
      pricing,
      message,
      effectivePlan,
      currency,
      rates.EUR,
    ],
  );

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Connectez-vous pour réserver.');
      return;
    }
    if (!checkIn || !checkOut) {
      Alert.alert('Dates requises', 'Indiquez les dates d\'arrivée et de départ.');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Paiement', 'Choisissez un mode de paiement.');
      return;
    }
    if (!pricing) return;

    const minNights = roomType.minimum_nights || 1;
    if (nights < minNights) {
      Alert.alert('Durée', `Minimum ${minNights} nuit(s) pour cette chambre.`);
      return;
    }
    if (guests > roomType.max_guests * quantity) {
      Alert.alert('Voyageurs', `Maximum ${roomType.max_guests * quantity} voyageurs.`);
      return;
    }

    if (paymentMethod === 'card' || paymentMethod === 'wave') {
      if (!assertIdentity()) return;
      if (paymentMethod === 'wave' && currency !== 'XOF') {
        Alert.alert('Wave', 'Le paiement Wave est disponible en FCFA uniquement.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Passer en CFA', onPress: () => void changeCurrency('XOF') },
        ]);
        return;
      }

      try {
        setOpeningPayment(true);
        const checkoutToken = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () =>
          (Math.random() * 16 | 0).toString(16),
        );
        const body = buildDraftPayload(checkoutToken, paymentMethod);
        if (paymentMethod === 'card') {
          const res = await createCheckoutSession(body);
          await Linking.openURL(res.url);
        } else {
          const waveAmount =
            currency === 'EUR' && rates.EUR
              ? Math.round(onlineCharge * rates.EUR)
              : Math.round(onlineCharge);
          const res = await createWaveCheckoutSession({ ...body, amount: waveAmount });
          await openWavePayment(res.wave_launch_url);
        }
        onClose();
        Alert.alert(
          'Paiement en cours',
          'Finalisez le paiement pour confirmer votre réservation. Vous serez notifié une fois le paiement validé.',
        );
      } catch (e) {
        Alert.alert(
          'Erreur',
          e instanceof Error ? e.message : 'Impossible d\'ouvrir le paiement.',
        );
      } finally {
        setOpeningPayment(false);
      }
      return;
    }

    if (!assertIdentity()) return;

    const lines = [
      {
        room_type_id: roomType.id,
        quantity,
        price_per_night: roomType.price_per_night,
        cleaning_fee: roomType.cleaning_fee || 0,
        taxes_per_night: roomType.taxes_per_night || 0,
      },
    ];

    const result = await createHotelBooking({
      establishmentId: establishment.id,
      establishmentTitle: establishment.title,
      hostId: establishment.host_id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guestsCount: guests,
      lines,
      totalPrice: pricing.finalTotal,
      hostNetAmount: pricing.hostNetAmount,
      messageToHost: message.trim() || undefined,
      paymentMethod: 'cash',
      paymentPlan: 'full',
      paymentCurrency: currency,
      paymentRate: currency === 'EUR' ? rates.EUR : undefined,
      pricingSnapshot: pricing,
    });

    if (!result.success) {
      if (result.error === 'IDENTITY_REQUIRED' || result.error === 'IDENTITY_NOT_VERIFIED') {
        assertIdentity();
        return;
      }
      Alert.alert('Erreur', 'La réservation n\'a pas pu être enregistrée.');
      return;
    }

    Alert.alert(
      result.status === 'confirmed' ? 'Réservation confirmée' : 'Demande envoyée',
      result.status === 'confirmed'
        ? 'Paiement en espèces à l\'arrivée. Bon séjour !'
        : 'L\'hôtel confirmera votre demande sous peu.',
      [{ text: 'OK', onPress: () => { onSuccess?.(); onClose(); } }],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Réserver</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.establishment}>{establishment.title}</Text>
          <Text style={styles.roomName}>{roomType.name}</Text>

          <BookingIdentityAlert />

          <Text style={styles.label}>Arrivée (AAAA-MM-JJ)</Text>
          <TextInput style={styles.input} value={checkIn} onChangeText={setCheckIn} placeholder="2026-06-15" />
          <Text style={styles.label}>Départ (AAAA-MM-JJ)</Text>
          <TextInput style={styles.input} value={checkOut} onChangeText={setCheckOut} placeholder="2026-06-18" />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Voyageurs</Text>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => setGuests((g) => Math.max(1, g - 1))}>
                  <Ionicons name="remove-circle-outline" size={28} color={HOTEL_COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{guests}</Text>
                <TouchableOpacity
                  onPress={() => setGuests((g) => Math.min(roomType.max_guests * quantity, g + 1))}
                >
                  <Ionicons name="add-circle-outline" size={28} color={HOTEL_COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Chambres</Text>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Ionicons name="remove-circle-outline" size={28} color={HOTEL_COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{quantity}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setQuantity((q) => Math.min(roomType.inventory_count || 1, q + 1))
                  }
                >
                  <Ionicons name="add-circle-outline" size={28} color={HOTEL_COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Message à l'hôtel (optionnel)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Heure d'arrivée, demandes particulières..."
          />

          <Text style={styles.sectionTitle}>Mode de paiement</Text>
          {(['card', 'wave', 'cash'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.payOption, paymentMethod === m && styles.payOptionActive]}
              onPress={() => {
                setPaymentMethod(m);
                if (m === 'cash') setPaymentPlan('full');
              }}
            >
              <Ionicons
                name={m === 'card' ? 'card-outline' : m === 'wave' ? 'phone-portrait-outline' : 'cash-outline'}
                size={22}
                color={paymentMethod === m ? HOTEL_COLORS.primary : '#64748b'}
              />
              <Text style={styles.payLabel}>
                {m === 'card' ? 'Carte bancaire' : m === 'wave' ? 'Wave' : 'Espèces à l\'arrivée'}
              </Text>
              {paymentMethod === m ? (
                <Ionicons name="checkmark-circle" size={22} color={HOTEL_COLORS.primary} />
              ) : null}
            </TouchableOpacity>
          ))}

          {paymentMethod && paymentMethod !== 'cash' ? (
            <View style={styles.planRow}>
              <TouchableOpacity
                style={[styles.planBtn, paymentPlan === 'full' && styles.planBtnActive]}
                onPress={() => setPaymentPlan('full')}
              >
                <Text style={styles.planText}>Paiement intégral</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.planBtn, paymentPlan === 'split' && styles.planBtnActive]}
                onPress={() => setPaymentPlan('split')}
              >
                <Text style={styles.planText}>50 % maintenant</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {pricing ? (
            <View style={styles.summary}>
              <Text style={styles.summaryLine}>
                {nights} nuit{nights > 1 ? 's' : ''} × {quantity} chambre{quantity > 1 ? 's' : ''}
              </Text>
              <Text style={styles.summaryLine}>Frais de service (1 %) : {formatPriceForPayment(pricing.serviceFee)}</Text>
              <Text style={styles.total}>
                Total : {formatPriceForPayment(pricing.finalTotal)}
              </Text>
              {paymentMethod && paymentMethod !== 'cash' && effectivePlan === 'split' ? (
                <Text style={styles.summaryLine}>
                  À payer maintenant : {formatPriceForPayment(onlineCharge)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, (loading || openingPayment) && styles.submitDisabled]}
          onPress={() => void handleSubmit()}
          disabled={loading || openingPayment}
        >
          {loading || openingPayment ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Confirmer la réservation</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  establishment: { fontSize: 14, color: '#64748b' },
  roomName: { fontSize: 20, fontWeight: '800', marginBottom: 16, color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 16, marginTop: 8 },
  col: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperVal: { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  payOptionActive: { borderColor: HOTEL_COLORS.primary, backgroundColor: HOTEL_COLORS.light },
  payLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  planRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  planBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  planBtnActive: { borderColor: HOTEL_COLORS.primary, backgroundColor: HOTEL_COLORS.light },
  planText: { fontSize: 13, fontWeight: '600' },
  summary: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    gap: 6,
  },
  summaryLine: { fontSize: 14, color: '#64748b' },
  total: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  submitBtn: {
    margin: 16,
    backgroundColor: HOTEL_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

export default HotelBookingModal;
