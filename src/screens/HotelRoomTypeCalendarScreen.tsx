import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useHotelRoomTypeAvailabilityCalendar } from '../hooks/useHotelRoomTypeAvailabilityCalendar';
import { useHotelBlockedDates, HotelBlockedDate } from '../hooks/useHotelBlockedDates';
import { useHotelICalSync, HotelICalLink } from '../hooks/useHotelICalSync';
import { supabase } from '../services/supabase';
import { HOTEL_COLORS } from '../constants/colors';
import type { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'HotelRoomTypeCalendar'>;

const PRIMARY = HOTEL_COLORS.primary;

const HotelRoomTypeCalendarScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { roomTypeId, roomTypeName } = route.params;

  const { unavailableDates, inventoryCount, loading: calendarLoading, refetch, isDateUnavailable } =
    useHotelRoomTypeAvailabilityCalendar(roomTypeId);
  const { getBlockedDates, blockDates, unblockDates, loading: blockedLoading } = useHotelBlockedDates();
  const {
    getICalLinks,
    addICalLink,
    syncCalendar,
    removeICalLink,
    clearSyncedBlockedDates,
    loading: icalLoading,
  } = useHotelICalSync();

  const [blockedDatesList, setBlockedDatesList] = useState<HotelBlockedDate[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [icalLinks, setICalLinks] = useState<HotelICalLink[]>([]);
  const [showICalForm, setShowICalForm] = useState(false);
  const [icalUrl, setICalUrl] = useState('');
  const [icalPlatform, setICalPlatform] = useState('airbnb');
  const [exportUrl, setExportUrl] = useState('');

  useEffect(() => {
    loadBlockedDates();
    loadICalLinks();
    generateExportUrl();
  }, [roomTypeId]);

  const generateExportUrl = () => {
    const supabaseUrl = supabase?.supabaseUrl || 'https://hqzgndjbxzgsyfoictgo.supabase.co';
    setExportUrl(`${supabaseUrl}/functions/v1/export-ical?roomTypeId=${roomTypeId}`);
  };

  const loadBlockedDates = async () => {
    const dates = await getBlockedDates(roomTypeId);
    setBlockedDatesList(dates);
  };

  const loadICalLinks = async () => {
    const links = await getICalLinks(roomTypeId);
    setICalLinks(links);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBlockedDates(), loadICalLinks(), refetch()]);
    setRefreshing(false);
  };

  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const formatDateShort = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const getDateBlockType = (date: Date): 'reserved' | 'blocked' | 'synced' | 'available' => {
    const dateStr = formatDateToISO(date);
    const blockingEntry = blockedDatesList.find(
      (blocked) => dateStr >= blocked.start_date && dateStr <= blocked.end_date,
    );

    if (blockingEntry) {
      const entryReason = String(blockingEntry.reason || '');
      if (entryReason.startsWith('Synchronisation')) return 'synced';
      return 'blocked';
    }

    const unavailable = unavailableDates.find(
      (period) => dateStr >= period.start_date && dateStr <= period.end_date,
    );
    if (unavailable) return 'reserved';
    return 'available';
  };

  const handleDatePress = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate < today || isDateUnavailable(date)) return;

    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setIsSelectingRange(true);
    } else if (selectedStartDate && !selectedEndDate) {
      if (date >= selectedStartDate) {
        setSelectedEndDate(date);
        setIsSelectingRange(false);
      } else {
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(date);
        setIsSelectingRange(false);
      }
    }
  };

  const handleBlockDates = async () => {
    if (!selectedStartDate || !selectedEndDate) {
      Alert.alert('Erreur', 'Veuillez sélectionner une période');
      return;
    }

    const result = await blockDates(
      roomTypeId,
      formatDateToISO(selectedStartDate),
      formatDateToISO(selectedEndDate),
      reason,
    );

    if (result.success) {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setReason('');
      setIsSelectingRange(false);
      await loadBlockedDates();
      await refetch();
    }
  };

  const handleUnblock = async (id: string) => {
    Alert.alert('Débloquer les dates', 'Êtes-vous sûr de vouloir débloquer ces dates ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Débloquer',
        style: 'destructive',
        onPress: async () => {
          const result = await unblockDates(id);
          if (result.success) {
            await loadBlockedDates();
            await refetch();
          }
        },
      },
    ]);
  };

  const handleCopyExportUrl = async () => {
    try {
      await Clipboard.setStringAsync(exportUrl);
      Alert.alert('Succès', 'Lien d\'export copié dans le presse-papiers');
    } catch {
      Alert.alert('Erreur', 'Impossible de copier le lien');
    }
  };

  const handleAddICalLink = async () => {
    if (!icalUrl.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une URL iCal');
      return;
    }
    const result = await addICalLink(roomTypeId, icalPlatform, icalUrl);
    if (result.success) {
      setICalUrl('');
      setShowICalForm(false);
      await loadICalLinks();
      await refetch();
      await loadBlockedDates();
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'prev' ? -1 : 1));
    setCurrentMonth(newMonth);
  };

  const days = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Calendrier</Text>
          {roomTypeName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {roomTypeName}
            </Text>
          ) : null}
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.infoBanner}>
          <Ionicons name="bed-outline" size={18} color={PRIMARY} />
          <Text style={styles.infoBannerText}>
            {inventoryCount} unité{inventoryCount !== 1 ? 's' : ''} pour ce type de chambre
          </Text>
        </View>

        <View style={styles.calendarSection}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth('prev')}>
              <Ionicons name="chevron-back" size={24} color={PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth('next')}>
              <Ionicons name="chevron-forward" size={24} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarGrid}>
            {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, index) => (
              <View key={index} style={styles.dayHeader}>
                <Text style={styles.dayHeaderText}>{day}</Text>
              </View>
            ))}

            {days.map((date, index) => {
              if (!date) return <View key={`empty-${index}`} style={styles.dayCell} />;

              const dateStr = formatDateToISO(date);
              const isPast = date < today;
              const unavailable = isDateUnavailable(date);
              const blockType = getDateBlockType(date);
              const isSelected =
                selectedStartDate &&
                selectedEndDate &&
                date >= selectedStartDate &&
                date <= selectedEndDate;
              const isStart =
                selectedStartDate && date.getTime() === selectedStartDate.getTime();
              const isEnd = selectedEndDate && date.getTime() === selectedEndDate.getTime();

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.dayCell,
                    isPast && styles.dayCellPast,
                    unavailable && blockType === 'reserved' && styles.dayCellReserved,
                    unavailable && blockType === 'blocked' && styles.dayCellBlocked,
                    unavailable && blockType === 'synced' && styles.dayCellSynced,
                    isSelected && styles.dayCellSelected,
                    isStart && styles.dayCellStart,
                    isEnd && styles.dayCellEnd,
                  ]}
                  onPress={() => handleDatePress(date)}
                  disabled={isPast || unavailable}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isPast && styles.dayTextPast,
                      unavailable && blockType === 'reserved' && styles.dayTextReserved,
                      unavailable && blockType === 'blocked' && styles.dayTextBlocked,
                      unavailable && blockType === 'synced' && styles.dayTextSynced,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {(selectedStartDate || isSelectingRange) && (
          <View style={styles.selectionSection}>
            <View style={[styles.selectionCard, isSelectingRange && styles.selectionCardActive]}>
              <Text style={styles.selectionTitle}>
                {isSelectingRange ? 'Sélection en cours...' : 'Période sélectionnée'}
              </Text>
              {selectedStartDate && (
                <Text style={styles.selectionDate}>Du {formatDate(selectedStartDate)}</Text>
              )}
              {selectedEndDate && (
                <Text style={styles.selectionDate}>Au {formatDate(selectedEndDate)}</Text>
              )}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Raison (optionnel)</Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Ex: Travaux, fermeture saisonnière..."
                multiline
              />
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.blockButton]}
                onPress={handleBlockDates}
                disabled={
                  blockedLoading || !selectedStartDate || !selectedEndDate || isSelectingRange
                }
              >
                {blockedLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Bloquer</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setSelectedStartDate(null);
                  setSelectedEndDate(null);
                  setReason('');
                  setIsSelectingRange(false);
                }}
              >
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Périodes indisponibles</Text>
          {calendarLoading ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : unavailableDates.length === 0 ? (
            <Text style={styles.emptyText}>Aucune période indisponible</Text>
          ) : (
            unavailableDates.map((period, index) => {
              const isBlocked = blockedDatesList.find(
                (b) => b.start_date === period.start_date && b.end_date === period.end_date,
              );
              const isSynced = (period.reason || '').startsWith('Synchronisation');

              return (
                <View key={index} style={styles.periodCard}>
                  <View style={styles.periodInfo}>
                    <View
                      style={[
                        styles.badge,
                        isSynced
                          ? styles.badgeSynced
                          : period.reason === 'Réservé' || period.reason?.startsWith('Réservé')
                            ? styles.badgeReserved
                            : styles.badgeBlocked,
                      ]}
                    >
                      <Text style={styles.badgeText}>{period.reason || 'Bloqué'}</Text>
                    </View>
                    <Text style={styles.periodDate}>
                      {period.start_date === period.end_date
                        ? formatDateShort(new Date(period.start_date))
                        : `${formatDateShort(new Date(period.start_date))} → ${formatDateShort(new Date(period.end_date))}`}
                    </Text>
                  </View>
                  {isBlocked && !isSynced && (
                    <TouchableOpacity
                      onPress={() => handleUnblock(isBlocked.id)}
                      disabled={blockedLoading}
                    >
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="share-outline" size={20} color={PRIMARY} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Lien d'export pour autres sites</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Copiez ce lien pour synchroniser ce type de chambre avec Airbnb, Booking.com, etc.
          </Text>
          <View style={styles.exportUrlContainer}>
            <Text style={styles.exportUrlText} numberOfLines={1}>
              {exportUrl}
            </Text>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyExportUrl}>
              <Ionicons name="copy-outline" size={20} color={PRIMARY} />
              <Text style={styles.copyButtonText}>Copier</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="link" size={20} color={PRIMARY} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Synchronisation Airbnb & autres plateformes</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Importez automatiquement les réservations depuis d'autres plateformes via iCal
          </Text>

          {!showICalForm ? (
            <TouchableOpacity style={styles.addICalButton} onPress={() => setShowICalForm(true)}>
              <Ionicons name="add-circle-outline" size={20} color={PRIMARY} />
              <Text style={styles.addICalButtonText}>Ajouter une synchronisation</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.icalForm}>
              <Text style={styles.label}>Plateforme</Text>
              <View style={styles.platformSelector}>
                {['airbnb', 'booking', 'vrbo', 'other'].map((platform) => (
                  <TouchableOpacity
                    key={platform}
                    style={[
                      styles.platformOption,
                      icalPlatform === platform && styles.platformOptionActive,
                    ]}
                    onPress={() => setICalPlatform(platform)}
                  >
                    <Text
                      style={[
                        styles.platformOptionText,
                        icalPlatform === platform && styles.platformOptionTextActive,
                      ]}
                    >
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>URL du calendrier iCal</Text>
              <TextInput
                style={styles.textInput}
                value={icalUrl}
                onChangeText={setICalUrl}
                placeholder="https://www.airbnb.com/calendar/ical/..."
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.blockButton]}
                  onPress={handleAddICalLink}
                  disabled={icalLoading || !icalUrl.trim()}
                >
                  <Text style={styles.actionButtonText}>Ajouter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={() => {
                    setShowICalForm(false);
                    setICalUrl('');
                  }}
                >
                  <Text style={styles.actionButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {icalLinks.length > 0 && (
            <View style={styles.icalLinksList}>
              {icalLinks.map((link) => (
                <View key={link.id} style={styles.icalLinkCard}>
                  <Text style={styles.platformBadgeText}>
                    {link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}
                  </Text>
                  <View style={styles.icalLinkActions}>
                    <TouchableOpacity
                      onPress={() => syncCalendar(roomTypeId, link.platform)}
                      disabled={icalLoading}
                    >
                      <Ionicons name="refresh" size={18} color={PRIMARY} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => clearSyncedBlockedDates(roomTypeId, link.platform)}
                      disabled={icalLoading}
                    >
                      <Ionicons name="remove-circle-outline" size={18} color={PRIMARY} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeICalLink(link.id)}
                      disabled={icalLoading}
                    >
                      <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Légende</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#fff' }]} />
              <Text style={styles.legendText}>Disponible</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#e67e22' }]} />
              <Text style={styles.legendText}>Réservé</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#6c5ce7' }]} />
              <Text style={styles.legendText}>Bloqué (sync iCal)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#e74c3c' }]} />
              <Text style={styles.legendText}>Bloqué manuellement</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  placeholder: { width: 40 },
  scrollView: { flex: 1 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 20,
    marginBottom: 0,
    padding: 12,
    backgroundColor: HOTEL_COLORS.light,
    borderRadius: 10,
  },
  infoBannerText: { color: PRIMARY, fontWeight: '600', fontSize: 14 },
  calendarSection: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 15,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { width: '14.28%', alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: { fontSize: 12, fontWeight: '600', color: '#666' },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  dayCellPast: { backgroundColor: '#f5f5f5', opacity: 0.5 },
  dayCellReserved: { backgroundColor: '#fff3e0', borderColor: '#e67e22', borderWidth: 2 },
  dayCellBlocked: { backgroundColor: '#ffebee', borderColor: '#e74c3c', borderWidth: 2 },
  dayCellSynced: { backgroundColor: '#f3f0ff', borderColor: '#6c5ce7', borderWidth: 2 },
  dayCellSelected: { backgroundColor: '#e3f2fd', borderColor: '#2196F3' },
  dayCellStart: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  dayCellEnd: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  dayText: { fontSize: 14, color: '#333' },
  dayTextPast: { color: '#999' },
  dayTextReserved: { color: '#e67e22', fontWeight: '600' },
  dayTextBlocked: { color: '#e74c3c', fontWeight: '600' },
  dayTextSynced: { color: '#6c5ce7', fontWeight: '600' },
  dayTextSelected: { color: '#2196F3', fontWeight: 'bold' },
  selectionSection: { margin: 20, marginTop: 0 },
  selectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  selectionCardActive: { borderColor: '#ffc107', backgroundColor: '#fffbf0' },
  selectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  selectionDate: { fontSize: 14, color: '#666', marginBottom: 4 },
  inputSection: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 44,
  },
  actionButtons: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  blockButton: { backgroundColor: PRIMARY },
  cancelButton: { backgroundColor: '#6c757d' },
  actionButtonText: { color: '#fff', fontWeight: '600' },
  section: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
    padding: 15,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  sectionSubtitle: { fontSize: 13, color: '#666', marginBottom: 12 },
  emptyText: { color: '#999', fontStyle: 'italic' },
  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  periodInfo: { flex: 1 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  badgeReserved: { backgroundColor: '#fff3e0' },
  badgeBlocked: { backgroundColor: '#ffebee' },
  badgeSynced: { backgroundColor: '#f3f0ff' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#333' },
  periodDate: { fontSize: 14, color: '#666' },
  exportUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  exportUrlText: { flex: 1, fontSize: 12, color: '#666' },
  copyButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyButtonText: { color: PRIMARY, fontWeight: '600', fontSize: 13 },
  addICalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  addICalButtonText: { color: PRIMARY, fontWeight: '600' },
  icalForm: { gap: 10 },
  platformSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  platformOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  platformOptionActive: { backgroundColor: HOTEL_COLORS.light, borderColor: PRIMARY },
  platformOptionText: { color: '#666', fontSize: 13 },
  platformOptionTextActive: { color: PRIMARY, fontWeight: '600' },
  icalLinksList: { marginTop: 12, gap: 8 },
  icalLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  platformBadgeText: { fontWeight: '600', color: '#333' },
  icalLinkActions: { flexDirection: 'row', gap: 16 },
  legend: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendColor: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#ddd' },
  legendText: { fontSize: 13, color: '#666' },
});

export default HotelRoomTypeCalendarScreen;
