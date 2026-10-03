import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Modal,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../services/AuthContext';
import { useCurrency } from '../hooks/useCurrency';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import { useLanguage } from '../contexts/LanguageContext';
import type { RootStackParamList } from '../types';
import { HOTEL_COLORS } from '../constants/colors';
import PropertyMap from '../components/PropertyMap';
import { notifyHotelBookingCreated } from '../services/hotelBookingNotifications';
import {
  buildHotelGallery,
  checkHotelRoomAvailability,
} from '../hooks/useApprovedHotelRooms';
import MediaThumb from '../components/MediaThumb';
import {
  formatHotelTime,
  hotelAmenityLabel,
  hotelCancellationLabel,
  hotelLanguageLabel,
} from '../constants/hotelListing';
import { calculateHotelBookingAmounts } from '../lib/commissions';
import {
  startHotelCardCheckout,
  startHotelWaveCheckout,
  verifyHotelDraftPayment,
} from '../services/hotelDraftCheckout';

type PaymentMethod = 'cash' | 'card' | 'wave';
type Route = RouteProp<RootStackParamList, 'HotelEstablishmentDetail'>;

type RoomType = {
  id: string;
  name: string;
  description: string | null;
  price_per_night: number;
  cleaning_fee: number;
  taxes_per_night: number;
  max_guests: number;
  inventory_count: number;
  minimum_nights: number;
  images: string[];
};

const SCREEN_W = Dimensions.get('window').width;

function parseISODate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatStayDate(iso: string, locale: string, emptyLabel: string): string {
  const d = parseISODate(iso);
  if (!d) return emptyLabel;
  return d.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = parseISODate(checkIn);
  const b = parseISODate(checkOut);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function makeBookingCode(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `HTL-${t.slice(-5)}${r}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function HotelEstablishmentDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatPrice, currency, rates, changeCurrency } = useCurrency();
  const { hasUploadedIdentity, isVerified, verificationStatus } = useIdentityVerification();
  const dateLocale = language === 'en' ? 'en-US' : 'fr-FR';
  const nightLabel = (n: number) =>
    t(n > 1 ? 'hotel.night_other' : 'hotel.night_one');
  const {
    establishmentId,
    roomTypeId: initialRoomTypeId,
    checkIn: paramCheckIn,
    checkOut: paramCheckOut,
    guests: paramGuests,
  } = route.params;

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [hotelPhotos, setHotelPhotos] = useState<Array<{ url: string }>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(
    initialRoomTypeId || null,
  );
  const [checkIn, setCheckIn] = useState(paramCheckIn || '');
  const [checkOut, setCheckOut] = useState(paramCheckOut || '');
  const [guests, setGuests] = useState(paramGuests || 2);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<number | null>(null);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [datePicker, setDatePicker] = useState<'in' | 'out' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [openingPay, setOpeningPay] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingWave, setPendingWave] = useState(false);
  const [pendingStartedAt, setPendingStartedAt] = useState<number | null>(null);
  const [checkingPay, setCheckingPay] = useState(false);
  const [payStatusHint, setPayStatusHint] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STRIPE_PENDING_TIMEOUT_MS = 10 * 60 * 1000;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: est }, { data: roomRows }, { data: photos }] = await Promise.all([
        supabase
          .from('hotel_establishments')
          .select('*')
          .eq('id', establishmentId)
          .eq('status', 'active')
          .eq('hidden_by_admin', false)
          .maybeSingle(),
        supabase
          .from('hotel_room_types')
          .select(
            'id, name, description, price_per_night, cleaning_fee, taxes_per_night, max_guests, inventory_count, minimum_nights, images',
          )
          .eq('establishment_id', establishmentId)
          .eq('status', 'active')
          .order('sort_order', { ascending: true }),
        supabase
          .from('hotel_establishment_photos')
          .select('url, display_order')
          .eq('establishment_id', establishmentId)
          .order('display_order', { ascending: true }),
      ]);
      if (cancelled) return;

      const list: RoomType[] = ((roomRows as any[]) || []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price_per_night: r.price_per_night,
        cleaning_fee: r.cleaning_fee || 0,
        taxes_per_night: r.taxes_per_night || 0,
        max_guests: r.max_guests,
        inventory_count: r.inventory_count,
        minimum_nights: r.minimum_nights || 1,
        images: Array.isArray(r.images) ? r.images : [],
      }));

      setItem(est);
      setRooms(list);
      setHotelPhotos((photos as Array<{ url: string }>) || []);
      setSelectedRoomId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        if (initialRoomTypeId && list.some((r) => r.id === initialRoomTypeId)) {
          return initialRoomTypeId;
        }
        return list[0]?.id ?? null;
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [establishmentId, initialRoomTypeId]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  );

  const gallery = useMemo(
    () =>
      buildHotelGallery({
        roomImages: selectedRoom?.images,
        establishmentPhotos: hotelPhotos,
        establishmentImages: item?.images,
      }),
    [selectedRoom, hotelPhotos, item],
  );

  const nights = nightsBetween(checkIn, checkOut);
  const roomSubtotal = selectedRoom && nights > 0 ? selectedRoom.price_per_night * nights : 0;
  const taxesTotal =
    selectedRoom && nights > 0 ? (selectedRoom.taxes_per_night || 0) * nights : 0;
  const cleaningFee = selectedRoom?.cleaning_fee || 0;
  const hotelAmounts = calculateHotelBookingAmounts(roomSubtotal, taxesTotal, cleaningFee);
  const serviceFee = hotelAmounts.serviceFee;
  const hostCommission = hotelAmounts.hostCommission;
  const hostNetAmount = hotelAmounts.hostNetAmount;
  const total = hotelAmounts.total;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedRoom || nights < 1) {
        setAvailableUnits(null);
        return;
      }
      setCheckingAvail(true);
      const { data, error } = await supabase.rpc('get_hotel_room_type_available_units', {
        p_room_type_id: selectedRoom.id,
        p_check_in: checkIn,
        p_check_out: checkOut,
      });
      if (cancelled) return;
      if (error) {
        setAvailableUnits(0);
      } else {
        setAvailableUnits(typeof data === 'number' ? data : Number(data) || 0);
      }
      setCheckingAvail(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRoom, checkIn, checkOut, nights]);

  useEffect(() => {
    setGalleryIndex(0);
  }, [selectedRoomId, gallery.length]);

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);
    if (idx !== galleryIndex) setGalleryIndex(idx);
  };

  const onPickDate = (which: 'in' | 'out', date: Date) => {
    const iso = toISODate(date);
    if (which === 'in') {
      setCheckIn(iso);
      const out = parseISODate(checkOut);
      if (!out || out <= date) {
        const next = new Date(date);
        next.setDate(next.getDate() + 1);
        setCheckOut(toISODate(next));
      }
    } else {
      setCheckOut(iso);
    }
    if (Platform.OS === 'android') setDatePicker(null);
  };

  const adjustGuests = (delta: number) => {
    const max = selectedRoom?.max_guests || 10;
    setGuests((g) => Math.min(max, Math.max(1, g + delta)));
  };

  const resetPendingPay = useCallback(() => {
    setPendingToken(null);
    setPendingWave(false);
    setPendingStartedAt(null);
    setPayStatusHint(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const onPaymentConfirmed = useCallback(
    (bookingId?: string) => {
      resetPendingPay();
      Alert.alert(
        t('hotel.paymentConfirmed'),
        t('hotel.paymentConfirmedDesc'),
        [
          {
            text: t('hotel.viewBooking'),
            onPress: () => {
              if (bookingId) {
                navigation.replace('HotelBookingDetail', {
                  bookingId,
                  role: 'guest',
                });
              } else {
                navigation.navigate('MyBookings');
              }
            },
          },
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ],
      );
    },
    [navigation, resetPendingPay, t],
  );

  const verifyPendingPay = useCallback(async () => {
    if (!pendingToken) return;
    setCheckingPay(true);
    try {
      const result = await verifyHotelDraftPayment({
        checkoutToken: pendingToken,
        wave: pendingWave,
      });
      setPayStatusHint(
        t('hotel.payStatusHint', {
          payment: result.payment_status || 'pending',
          booking: result.booking_status || 'pending',
        }),
      );
      if (result.paid) {
        onPaymentConfirmed(result.bookingId);
      }
    } finally {
      setCheckingPay(false);
    }
  }, [pendingToken, pendingWave, onPaymentConfirmed, t]);

  useEffect(() => {
    if (!pendingToken) return;
    const tick = () => {
      void verifyPendingPay();
    };
    pollRef.current = setInterval(tick, 4000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
    };
  }, [pendingToken, verifyPendingPay]);

  useEffect(() => {
    if (!pendingToken || !pendingStartedAt) return;
    const timer = setInterval(() => {
      if (Date.now() - pendingStartedAt > STRIPE_PENDING_TIMEOUT_MS) {
        resetPendingPay();
        Alert.alert(t('hotel.paymentTimeoutTitle'), t('hotel.paymentTimeoutDesc'));
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [pendingToken, pendingStartedAt, resetPendingPay, t]);

  const handleBook = useCallback(async () => {
    if (!user) {
      navigation.navigate('Auth', {
        returnTo: 'HotelEstablishmentDetail',
        returnParams: {
          establishmentId,
          roomTypeId: selectedRoomId || undefined,
          checkIn: checkIn || undefined,
          checkOut: checkOut || undefined,
          guests,
        },
      });
      return;
    }
    if (!selectedRoom) {
      Alert.alert(t('hotel.selectRoomTitle'), t('hotel.selectRoom'));
      return;
    }
    if (nights < 1) {
      Alert.alert(t('hotel.selectDatesTitle'), t('hotel.selectDatesMsg'));
      return;
    }
    if (nights < selectedRoom.minimum_nights) {
      Alert.alert(
        t('hotel.minStayTitle'),
        t('hotel.minStay', {
          count: String(selectedRoom.minimum_nights),
          nightLabel: nightLabel(selectedRoom.minimum_nights),
        }),
      );
      return;
    }
    if (guests > selectedRoom.max_guests) {
      Alert.alert(
        t('hotel.capacityTitle'),
        t('hotel.capacity', { count: String(selectedRoom.max_guests) }),
      );
      return;
    }

    // Carte / Wave : identité requise (comme logements) — espèces OK sans
    if (paymentMethod === 'card' || paymentMethod === 'wave') {
      if (!hasUploadedIdentity) {
        Alert.alert(t('hotel.identityRequiredTitle'), t('hotel.identityRequiredDesc'));
        return;
      }
      if (!isVerified && verificationStatus !== 'pending') {
        Alert.alert(t('hotel.verificationTitle'), t('hotel.verificationDesc'));
        return;
      }
    }

    if (paymentMethod === 'wave' && currency !== 'XOF') {
      Alert.alert(t('hotel.currencyRequiredTitle'), t('hotel.currencyRequiredDesc'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('hotel.switchToCfa'),
          onPress: async () => {
            await changeCurrency('XOF');
            Alert.alert(t('hotel.currencyUpdatedTitle'), t('hotel.currencyUpdatedDesc'));
          },
        },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      const avail = await checkHotelRoomAvailability({
        establishmentId,
        checkIn,
        checkOut,
        roomTypeId: selectedRoom.id,
        quantity: 1,
      });
      if (!avail.ok) {
        Alert.alert(
          t('hotel.unavailableTitle'),
          avail.error ||
            t('hotel.notEnoughRooms', { count: String(avail.availableUnits) }),
        );
        setAvailableUnits(avail.availableUnits);
        return;
      }

      const draftInput = {
        establishmentId,
        establishmentTitle: item?.title || t('hotel.defaultTitle'),
        roomTypeId: selectedRoom.id,
        roomName: selectedRoom.name,
        checkIn,
        checkOut,
        guestsCount: guests,
        nights,
        pricePerNight: selectedRoom.price_per_night,
        cleaningFee: selectedRoom.cleaning_fee || 0,
        taxesTotal,
        totalPrice: total,
        serviceFee,
        hostCommission,
        hostNetAmount,
        messageToHost: message.trim() || undefined,
        paymentMethod: paymentMethod as 'card' | 'wave',
        currency,
        eurRate: rates?.EUR,
        customerCountry:
          (user?.user_metadata as any)?.country_code ||
          (user?.user_metadata as any)?.country ||
          '',
      };

      // ——— Carte / Wave : draft checkout (aucune ligne hotel_bookings avant paiement) ———
      if (paymentMethod === 'card' || paymentMethod === 'wave') {
        setOpeningPay(true);
        try {
          const result =
            paymentMethod === 'card'
              ? await startHotelCardCheckout(draftInput)
              : await startHotelWaveCheckout(draftInput);
          setPendingToken(result.checkoutToken);
          setPendingWave(result.wave);
          setPendingStartedAt(Date.now());
          setPayStatusHint(null);
        } finally {
          setOpeningPay(false);
        }
        return;
      }

      // ——— Espèces à l’arrivée (existant) ———
      const autoConfirm = !!(item as any)?.auto_booking;
      const bookingCode = makeBookingCode();

      const basePayload: Record<string, unknown> = {
        establishment_id: establishmentId,
        guest_id: user.id,
        check_in_date: checkIn,
        check_out_date: checkOut,
        guests_count: guests,
        total_price: total,
        host_net_amount: hostNetAmount,
        status: autoConfirm ? 'confirmed' : 'pending',
        message_to_host: message.trim() || null,
        payment_currency: 'XOF',
        payment_method: 'cash',
        payment_plan: 'full',
        booking_code: bookingCode,
        payment_status: 'unpaid',
      };

      let booking: { id: string } | null = null;
      let error: { message: string } | null = null;
      ({ data: booking, error } = await supabase
        .from('hotel_bookings')
        .insert(basePayload as any)
        .select('id')
        .single());

      if (error && /payment_status|paid_at|paid_by/i.test(error.message || '')) {
        const { payment_status: _ps, ...fallback } = basePayload;
        ({ data: booking, error } = await supabase
          .from('hotel_bookings')
          .insert(fallback as any)
          .select('id')
          .single());
      }
      if (error) throw error;
      if (!booking) throw new Error(t('hotel.bookingNotCreated'));

      const lineTotal = roomSubtotal + taxesTotal + cleaningFee;
      const { error: itemErr } = await supabase.from('hotel_booking_items').insert({
        booking_id: booking.id,
        room_type_id: selectedRoom.id,
        quantity: 1,
        price_per_night: selectedRoom.price_per_night,
        cleaning_fee: selectedRoom.cleaning_fee || 0,
        line_total: lineTotal,
      });
      if (itemErr) throw itemErr;

      try {
        await supabase.from('booking_calculation_details').insert({
          booking_id: booking.id,
          booking_type: 'hotel',
          base_price: roomSubtotal,
          price_after_discount: roomSubtotal,
          discount_amount: 0,
          discount_applied: false,
          service_fee: serviceFee,
          service_fee_ht: serviceFee,
          service_fee_vat: 0,
          host_commission: hostCommission,
          host_commission_ht: hostCommission,
          host_commission_vat: 0,
          effective_cleaning_fee: cleaningFee,
          effective_taxes: taxesTotal,
          total_price: total,
          host_net_amount: hostNetAmount,
        } as any);
      } catch (calcErr) {
        if (__DEV__) console.warn('[hotel cash] booking_calculation_details:', calcErr);
      }

      notifyHotelBookingCreated(booking.id).catch(() => {});

      Alert.alert(
        autoConfirm ? t('hotel.bookingConfirmed') : t('hotel.requestSent'),
        autoConfirm
          ? t('hotel.cashConfirmedDesc', {
              amount: formatPrice(total),
              code: bookingCode,
            })
          : t('hotel.cashPendingDesc', {
              amount: formatPrice(total),
              code: bookingCode,
            }),
        [
          {
            text: t('hotel.viewBooking'),
            onPress: () =>
              navigation.replace('HotelBookingDetail', {
                bookingId: booking!.id,
                role: 'guest',
              }),
          },
          {
            text: t('common.ok'),
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : t('hotel.bookingImpossible'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    user,
    navigation,
    establishmentId,
    selectedRoom,
    selectedRoomId,
    checkIn,
    checkOut,
    nights,
    guests,
    total,
    taxesTotal,
    serviceFee,
    hostCommission,
    hostNetAmount,
    message,
    item,
    formatPrice,
    paymentMethod,
    hasUploadedIdentity,
    isVerified,
    verificationStatus,
    currency,
    rates,
    changeCurrency,
    roomSubtotal,
    cleaningFee,
    t,
    nightLabel,
  ]);

  const canBook =
    !!selectedRoom &&
    nights >= (selectedRoom?.minimum_nights || 1) &&
    availableUnits != null &&
    availableUnits >= 1 &&
    !pendingToken;

  const pickerValue =
    datePicker === 'out'
      ? parseISODate(checkOut) || startOfToday()
      : parseISODate(checkIn) || startOfToday();

  const pickerMin =
    datePicker === 'out' && checkIn
      ? (() => {
          const d = parseISODate(checkIn) || startOfToday();
          const n = new Date(d);
          n.setDate(n.getDate() + 1);
          return n;
        })()
      : startOfToday();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {selectedRoom?.name || item?.title || t('hotel.defaultTitle')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={HOTEL_COLORS.primary} />
      ) : !item ? (
        <Text style={styles.empty}>{t('hotel.notFound')}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {gallery.length > 0 ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onGalleryScroll}
                scrollEventThrottle={16}
              >
                {gallery.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={styles.hero}>
                    <MediaThumb
                      uri={uri}
                      style={styles.heroMedia}
                      resizeMode="cover"
                      contentPosition="center"
                      fitWholeImage
                      priority={i === 0 ? 'high' : 'normal'}
                      recyclingKey={`hotel-hero-${establishmentId}-${i}`}
                    />
                  </View>
                ))}
              </ScrollView>
              {gallery.length > 1 ? (
                <View style={styles.dots}>
                  <Text style={styles.dotsText}>
                    {galleryIndex + 1} / {gallery.length}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Ionicons name="business-outline" size={48} color="#fff" />
            </View>
          )}

          <Text style={styles.hotelName}>{item.title}</Text>
          {item.star_rating ? (
            <Text style={styles.meta}>
              {item.star_rating}★ · {item.establishment_type}
            </Text>
          ) : (
            <Text style={styles.meta}>{item.establishment_type}</Text>
          )}
          {item.address ? (
            <Text style={styles.address}>
              <Ionicons name="location-outline" size={14} color="#666" /> {item.address}
            </Text>
          ) : null}
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}

          {(item.latitude != null && item.longitude != null) || item.address ? (
            <View style={{ marginHorizontal: 20 }}>
              <PropertyMap
                latitude={item.latitude != null ? Number(item.latitude) : undefined}
                longitude={item.longitude != null ? Number(item.longitude) : undefined}
                locationName={item.address || item.title}
                cityName={item.address || undefined}
              />
            </View>
          ) : null}

          <View style={styles.infoBlock}>
            <Text style={styles.infoBlockTitle}>{t('hotel.conditionsInfo')}</Text>
            {(item.check_in_time || item.check_out_time) && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color={HOTEL_COLORS.primary} />
                <Text style={styles.infoText}>
                  {item.check_in_time
                    ? t('hotel.checkInFrom', {
                        time: formatHotelTime(item.check_in_time),
                      })
                    : null}
                  {item.check_in_time && item.check_out_time ? ' · ' : ''}
                  {item.check_out_time
                    ? t('hotel.checkOutBefore', {
                        time: formatHotelTime(item.check_out_time),
                      })
                    : null}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Ionicons name="paw-outline" size={18} color={HOTEL_COLORS.primary} />
              <Text style={styles.infoText}>
                {item.pets_allowed ? t('hotel.petsAllowed') : t('hotel.petsNotAllowed')}
              </Text>
            </View>
            {Array.isArray(item.spoken_languages) && item.spoken_languages.length > 0 ? (
              <View style={styles.infoRow}>
                <Ionicons name="chatbubbles-outline" size={18} color={HOTEL_COLORS.primary} />
                <Text style={styles.infoText}>
                  {t('hotel.languages', {
                    list: item.spoken_languages
                      .map((l: string) => hotelLanguageLabel(l))
                      .join(', '),
                  })}
                </Text>
              </View>
            ) : null}
            {item.cancellation_policy ? (
              <View style={styles.infoRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={HOTEL_COLORS.primary} />
                <Text style={styles.infoText}>
                  {t('hotel.cancellation', {
                    policy: hotelCancellationLabel(item.cancellation_policy),
                  })}
                </Text>
              </View>
            ) : null}
            {Array.isArray(item.amenities) && item.amenities.length > 0 ? (
              <View style={styles.amenityWrap}>
                {item.amenities.map((a: string) => (
                  <View key={a} style={styles.amenityChip}>
                    <Text style={styles.amenityChipText}>{hotelAmenityLabel(a)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {item.house_rules ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.rulesTitle}>{t('hotel.houseRules')}</Text>
                <Text style={styles.rulesText}>{item.house_rules}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>{t('hotel.roomTypes')}</Text>
          {rooms.length === 0 ? (
            <Text style={styles.emptyRooms}>{t('hotel.noRoomsPublished')}</Text>
          ) : (
            rooms.map((room) => {
              const selected = room.id === selectedRoomId;
              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.roomCard, selected && styles.roomCardSelected]}
                  onPress={() => setSelectedRoomId(room.id)}
                  activeOpacity={0.85}
                >
                  {room.images[0] ? (
                    <MediaThumb
                      uri={room.images[0]}
                      style={styles.roomThumb}
                      resizeMode="cover"
                      contentPosition="center"
                      fitWholeImage
                      priority="normal"
                      recyclingKey={`room-thumb-${room.id}`}
                    />
                  ) : (
                    <View style={[styles.roomThumb, styles.roomThumbFallback]}>
                      <Ionicons name="bed-outline" size={22} color="#94a3b8" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    {!!room.description && (
                      <Text style={styles.roomDesc} numberOfLines={2}>
                        {room.description}
                      </Text>
                    )}
                    <Text style={styles.roomMeta}>
                      {t('hotel.roomMeta', {
                        max: String(room.max_guests),
                        nights: String(room.minimum_nights),
                        nightLabel: nightLabel(room.minimum_nights),
                      })}
                    </Text>
                  </View>
                  <Text style={styles.roomPrice}>
                    {formatPrice(room.price_per_night)}
                    {'\n'}
                    <Text style={styles.roomPriceUnit}>{t('search.perNight')}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })
          )}

          {rooms.length > 0 ? (
            <View style={styles.bookPanel}>
              <Text style={styles.bookPanelTitle}>{t('hotel.yourStay')}</Text>

              <View style={styles.datesRow}>
                <TouchableOpacity
                  style={styles.dateTile}
                  onPress={() => setDatePicker('in')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateLabel}>{t('booking.arrival')}</Text>
                  <Text style={styles.dateValue}>
                    {formatStayDate(checkIn, dateLocale, t('hotel.chooseDate'))}
                  </Text>
                </TouchableOpacity>
                <View style={styles.dateArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
                </View>
                <TouchableOpacity
                  style={styles.dateTile}
                  onPress={() => setDatePicker('out')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateLabel}>{t('booking.departure')}</Text>
                  <Text style={styles.dateValue}>
                    {formatStayDate(checkOut, dateLocale, t('hotel.chooseDate'))}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.guestsRow}>
                <View>
                  <Text style={styles.dateLabel}>{t('booking.guests')}</Text>
                  <Text style={styles.guestsHint}>
                    {t('hotel.maxGuests', {
                      max: String(selectedRoom?.max_guests ?? '—'),
                    })}
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => adjustGuests(-1)}
                    disabled={guests <= 1}
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={guests <= 1 ? '#cbd5e1' : '#0f172a'}
                    />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{guests}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => adjustGuests(1)}
                    disabled={!!selectedRoom && guests >= selectedRoom.max_guests}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        selectedRoom && guests >= selectedRoom.max_guests
                          ? '#cbd5e1'
                          : '#0f172a'
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={styles.messageInput}
                multiline
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
                placeholder={t('hotel.messagePlaceholder')}
                placeholderTextColor="#94a3b8"
              />

              {/* Méthodes de paiement */}
              <Text style={[styles.dateLabel, { marginTop: 14, marginBottom: 8 }]}>
                {t('hotel.payment')}
              </Text>
              <View style={styles.payMethods}>
                {(
                  [
                    {
                      id: 'cash' as const,
                      icon: 'cash' as const,
                      label: t('booking.cash'),
                      hint: t('hotel.cashHint'),
                    },
                    {
                      id: 'wave' as const,
                      icon: 'phone-portrait' as const,
                      label: t('booking.wave'),
                      hint: t('hotel.waveRecommended'),
                    },
                    {
                      id: 'card' as const,
                      icon: 'card' as const,
                      label: t('hotel.cardShort'),
                      hint: t('hotel.cardHint'),
                    },
                  ] as const
                ).map((m) => {
                  const selected = paymentMethod === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.payMethodChip, selected && styles.payMethodChipOn]}
                      onPress={() => setPaymentMethod(m.id)}
                      activeOpacity={0.85}
                      disabled={!!pendingToken}
                    >
                      <Ionicons
                        name={m.icon}
                        size={18}
                        color={selected ? HOTEL_COLORS.primary : '#64748b'}
                      />
                      <Text style={[styles.payMethodLabel, selected && styles.payMethodLabelOn]}>
                        {m.label}
                      </Text>
                      <Text style={styles.payMethodHint}>{m.hint}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {paymentMethod === 'cash' ? (
                <View style={styles.payCard}>
                  <View style={styles.payCardIcon}>
                    <Ionicons name="cash" size={22} color={HOTEL_COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payCardTitle}>{t('hotel.cashOnArrival')}</Text>
                    <Text style={styles.payCardDesc}>{t('hotel.cashOnArrivalDesc')}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color={HOTEL_COLORS.primary} />
                </View>
              ) : (
                <View style={styles.payCard}>
                  <View style={styles.payCardIcon}>
                    <Ionicons
                      name={paymentMethod === 'wave' ? 'phone-portrait' : 'card'}
                      size={22}
                      color={paymentMethod === 'wave' ? '#8b5cf6' : '#2563eb'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payCardTitle}>
                      {paymentMethod === 'wave'
                        ? t('hotel.wavePayment')
                        : t('booking.card')}
                    </Text>
                    <Text style={styles.payCardDesc}>
                      {paymentMethod === 'wave'
                        ? t('hotel.waveRedirectDesc')
                        : t('hotel.stripeRedirectDesc')}
                    </Text>
                  </View>
                </View>
              )}

              {pendingToken ? (
                <View style={styles.pendingBox}>
                  <ActivityIndicator color={pendingWave ? '#8b5cf6' : '#2563eb'} />
                  <Text style={styles.pendingText}>
                    {pendingWave ? t('hotel.finalizeWave') : t('hotel.finalizeStripe')}
                  </Text>
                  {payStatusHint ? (
                    <Text style={styles.pendingHint}>
                      {t('hotel.statusPrefix', { status: payStatusHint })}
                    </Text>
                  ) : null}
                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      style={styles.pendingPrimary}
                      onPress={() => void verifyPendingPay()}
                      disabled={checkingPay}
                    >
                      {checkingPay ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.pendingPrimaryText}>
                          {t('booking.verifyPayment')}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pendingSecondary} onPress={resetPendingPay}>
                      <Text style={styles.pendingSecondaryText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {nights > 0 && selectedRoom ? (
                <View style={styles.summary}>
                  {checkingAvail ? (
                    <ActivityIndicator size="small" color={HOTEL_COLORS.primary} />
                  ) : availableUnits != null ? (
                    <Text
                      style={[
                        styles.availText,
                        availableUnits < 1 ? styles.availNone : styles.availOk,
                      ]}
                    >
                      {availableUnits < 1
                        ? t('hotel.unavailableDates')
                        : availableUnits === 1
                          ? t('hotel.roomsAvailable_one')
                          : t('hotel.roomsAvailable_other', {
                              count: String(availableUnits),
                            })}
                    </Text>
                  ) : null}

                  <View style={styles.sumLine}>
                    <Text style={styles.sumLabel}>
                      {t('hotel.nightsLine', {
                        price: formatPrice(selectedRoom.price_per_night),
                        nights: String(nights),
                        nightLabel: nightLabel(nights),
                      })}
                    </Text>
                    <Text style={styles.sumValue}>{formatPrice(roomSubtotal)}</Text>
                  </View>
                  {taxesTotal > 0 ? (
                    <View style={styles.sumLine}>
                      <Text style={styles.sumLabel}>{t('hotel.taxes')}</Text>
                      <Text style={styles.sumValue}>{formatPrice(taxesTotal)}</Text>
                    </View>
                  ) : null}
                  {cleaningFee > 0 ? (
                    <View style={styles.sumLine}>
                      <Text style={styles.sumLabel}>{t('hotel.cleaning')}</Text>
                      <Text style={styles.sumValue}>{formatPrice(cleaningFee)}</Text>
                    </View>
                  ) : null}
                  {serviceFee > 0 ? (
                    <View style={styles.sumLine}>
                      <Text style={styles.sumLabel}>
                        {t('hotel.serviceFeePercent', {
                          percent: String(hotelAmounts.travelerFeePercent),
                        })}
                      </Text>
                      <Text style={styles.sumValue}>{formatPrice(serviceFee)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.sumLine, styles.sumTotal]}>
                    <Text style={styles.sumTotalLabel}>
                      {paymentMethod === 'cash'
                        ? t('hotel.totalOnArrival')
                        : t('booking.total')}
                    </Text>
                    <Text style={styles.sumTotalValue}>{formatPrice(total)}</Text>
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.bookBtn,
                  (!canBook || submitting || openingPay) && { opacity: 0.55 },
                ]}
                onPress={handleBook}
                disabled={submitting || openingPay || !canBook}
              >
                {submitting || openingPay ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.bookBtnText}>
                    {nights < 1
                      ? t('hotel.chooseDates')
                      : availableUnits != null && availableUnits < 1
                        ? t('hotel.unavailable')
                        : paymentMethod === 'cash'
                          ? t('hotel.bookPayOnArrival')
                          : paymentMethod === 'wave'
                            ? t('booking.payWithWave')
                            : t('hotel.payByCard')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Date picker */}
      {datePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          minimumDate={pickerMin}
          onChange={(_, date) => {
            if (date) onPickDate(datePicker, date);
            else setDatePicker(null);
          }}
        />
      ) : null}

      <Modal
        visible={!!datePicker && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDatePicker(null)}>
                <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {datePicker === 'out' ? t('booking.departure') : t('booking.arrival')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onPickDate(datePicker!, pickerValue);
                  setDatePicker(null);
                }}
              >
                <Text style={styles.modalDone}>{t('common.ok')}</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="spinner"
              minimumDate={pickerMin}
              onChange={(_, date) => {
                if (date && datePicker) onPickDate(datePicker, date);
              }}
              locale={dateLocale}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#333' },
  empty: { marginTop: 40, textAlign: 'center', color: '#666' },
  content: { paddingBottom: 48 },
  hero: { width: SCREEN_W, height: 280, backgroundColor: '#0f172a', overflow: 'hidden' },
  heroMedia: { width: '100%', height: '100%' },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dotsText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  hotelName: {
    marginTop: 16,
    marginHorizontal: 20,
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  meta: {
    marginHorizontal: 20,
    marginTop: 6,
    fontSize: 14,
    color: HOTEL_COLORS.primary,
    fontWeight: '600',
  },
  address: { marginHorizontal: 20, marginTop: 8, fontSize: 14, color: '#666' },
  desc: { marginHorizontal: 20, marginTop: 16, fontSize: 15, lineHeight: 22, color: '#444' },
  infoBlock: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoBlockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#334155' },
  amenityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  amenityChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  amenityChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  rulesTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  rulesText: { fontSize: 13, lineHeight: 19, color: '#475569' },
  sectionTitle: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  emptyRooms: { marginHorizontal: 20, color: '#888', fontSize: 14 },
  roomCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  roomCardSelected: {
    borderColor: HOTEL_COLORS.primary,
    backgroundColor: HOTEL_COLORS.light,
  },
  roomThumb: { width: 72, height: 54, borderRadius: 10, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  roomThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  roomName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  roomDesc: { marginTop: 4, fontSize: 13, color: '#64748b' },
  roomMeta: { marginTop: 6, fontSize: 12, color: '#94a3b8' },
  roomPrice: { fontSize: 14, fontWeight: '700', color: HOTEL_COLORS.primary, textAlign: 'right' },
  roomPriceUnit: { fontSize: 11, fontWeight: '500', color: '#64748b' },

  bookPanel: {
    marginTop: 20,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e4f3',
  },
  bookPanelTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1523',
    marginBottom: 14,
  },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTile: {
    flex: 1,
    backgroundColor: '#f7f5fb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ebe6f5',
  },
  dateArrow: { paddingHorizontal: 2 },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c7390',
    letterSpacing: 0.3,
  },
  dateValue: { marginTop: 6, fontSize: 15, fontWeight: '700', color: '#1a1523' },
  guestsRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f7f5fb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ebe6f5',
  },
  guestsHint: { marginTop: 4, fontSize: 12, color: '#94a3b8' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1523',
    minWidth: 24,
    textAlign: 'center',
  },
  messageInput: {
    marginTop: 12,
    backgroundColor: '#f7f5fb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 72,
    fontSize: 14,
    color: '#1a1523',
    borderWidth: 1,
    borderColor: '#ebe6f5',
  },
  payMethods: { flexDirection: 'row', gap: 8 },
  payMethodChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: '#f7f5fb',
    borderWidth: 1,
    borderColor: '#ebe6f5',
  },
  payMethodChipOn: {
    backgroundColor: HOTEL_COLORS.light,
    borderColor: HOTEL_COLORS.primary,
  },
  payMethodLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  payMethodLabelOn: { color: HOTEL_COLORS.dark },
  payMethodHint: { fontSize: 10, color: '#94a3b8' },
  payCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#faf9fc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ebe6f5',
  },
  payCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: HOTEL_COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payCardTitle: { fontSize: 14, fontWeight: '700', color: '#1a1523' },
  payCardDesc: { marginTop: 3, fontSize: 12, lineHeight: 16, color: '#64748b' },
  pendingBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f7f5fb',
    borderWidth: 1,
    borderColor: '#ebe6f5',
    gap: 10,
    alignItems: 'center',
  },
  pendingText: { color: '#334155', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  pendingHint: { color: '#94a3b8', fontSize: 11 },
  pendingActions: { flexDirection: 'row', gap: 8, width: '100%' },
  pendingPrimary: {
    flex: 1,
    backgroundColor: HOTEL_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  pendingPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pendingSecondary: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  pendingSecondaryText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  summary: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e8e4f3',
    gap: 8,
  },
  availText: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  availOk: { color: '#15803d' },
  availNone: { color: '#b91c1c' },
  sumLine: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel: { fontSize: 13, color: '#64748b' },
  sumValue: { fontSize: 13, fontWeight: '600', color: '#1a1523' },
  sumTotal: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e8e4f3',
  },
  sumTotalLabel: { fontSize: 14, fontWeight: '700', color: '#1a1523' },
  sumTotalValue: { fontSize: 16, fontWeight: '800', color: HOTEL_COLORS.primary },
  bookBtn: {
    marginTop: 16,
    backgroundColor: HOTEL_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  modalCancel: { fontSize: 16, color: '#64748b' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  modalDone: { fontSize: 16, fontWeight: '700', color: HOTEL_COLORS.primary },
});
